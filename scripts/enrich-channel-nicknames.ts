/**
 * scripts/enrich-channel-nicknames.ts
 *
 * 扫描所有 outlets 的 douyin/weibo channels,调 tikhub user_info 端点拿到
 * 真实账号昵称,回填到 channels[].nickname。
 *
 * 默认情况下,媒体字典 import 把所有 douyin/weibo/kuaishou channel.nickname
 * 直接置成 outletName(如"中国日报")。这并不准确——抖音号实际昵称可能是
 * "中国日报CHINADAILY"或"中国日报视频",微博可能是"@人民日报法人微博"等。
 *
 * 本脚本:
 *   - 对每条 channel 调 tikhub 拿真实 nickname
 *   - 更新到 channels[].nickname
 *   - --dry-run 预演
 *   - 跳过没有 identifier(secUid/uid/userId)的 channel
 *   - 跳过 kuaishou(tikhub user_info 需登录 cookies)
 *
 * 用法:
 *   DATABASE_URL=... pnpm tsx scripts/enrich-channel-nicknames.ts --dry-run
 *   DATABASE_URL=... pnpm tsx scripts/enrich-channel-nicknames.ts
 *   # 只跑某个 outlet:
 *   DATABASE_URL=... pnpm tsx scripts/enrich-channel-nicknames.ts --outlet 人民日报
 *
 * 成本: 每条 channel 约 $0.005 USD。一次性全跑 ~ $1-2 USD。
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { mediaOutletDictionary } from "@/db/schema/media-outlet-dictionary";
import type {
  Channel,
  DouyinChannel,
  WeiboChannel,
} from "@/lib/media-outlet/channels";

const BASE = process.env.TIKHUB_API_BASE_URL ?? "https://api.tikhub.io";
const KEY = process.env.TIKHUB_API_KEY;
if (!KEY) {
  console.error("❌ TIKHUB_API_KEY 未配置");
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const onlyOutletName = (() => {
  const i = args.indexOf("--outlet");
  return i >= 0 ? args[i + 1] : null;
})();

interface NicknameResult {
  outletId: string;
  outletName: string;
  channelIndex: number;
  platform: string;
  identifier: string;
  oldNick: string;
  newNick: string | null;
  status: "updated" | "same" | "failed" | "skipped_no_id";
  reason?: string;
}

async function fetchWithRetry(url: string, retries = 2): Promise<unknown> {
  for (let i = 0; i <= retries; i++) {
    try {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${KEY}` } });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) {
      if (i === retries) {
        console.warn(`  [fetch] 重试 ${retries} 次仍失败: ${(e as Error).message.slice(0, 80)}`);
        return null;
      }
      // 网络抖动: 等 2-5 秒重试
      await new Promise((r) => setTimeout(r, 2000 + i * 1000));
    }
  }
  return null;
}

async function fetchDouyinNickname(secUid: string): Promise<string | null> {
  const data = await fetchWithRetry(
    `${BASE}/api/v1/douyin/web/handler_user_profile?sec_user_id=${encodeURIComponent(secUid)}`,
  );
  return ((data as { data?: { user?: { nickname?: string } } } | null)?.data?.user?.nickname) ?? null;
}

async function fetchWeiboNickname(uid: string): Promise<string | null> {
  const data = await fetchWithRetry(
    `${BASE}/api/v1/weibo/web_v2/fetch_user_info?uid=${encodeURIComponent(uid)}`,
  );
  return ((data as { data?: { user?: { screen_name?: string } } } | null)?.data?.user?.screen_name) ?? null;
}

async function main() {
  const outlets = await db.select().from(mediaOutletDictionary);
  const target = onlyOutletName
    ? outlets.filter((o) => o.outletName === onlyOutletName)
    : outlets;
  console.log(
    `📋 处理 ${target.length} 个 outlet (${onlyOutletName ? `仅 "${onlyOutletName}"` : "全部"}) ${dryRun ? "(DRY RUN)" : ""}\n`,
  );

  const results: NicknameResult[] = [];
  let apiCalls = 0;

  for (const o of target) {
    const channels = (o.channels ?? []) as Channel[];
    let modified = false;
    const next: Channel[] = [...channels];

    for (let i = 0; i < next.length; i++) {
      const ch = next[i]!;
      const oldNick = "nickname" in ch ? ch.nickname : "";

      if (ch.type === "douyin") {
        const dy = ch as DouyinChannel;
        if (!dy.secUid) {
          results.push({
            outletId: o.id,
            outletName: o.outletName,
            channelIndex: i,
            platform: "douyin",
            identifier: "",
            oldNick,
            newNick: null,
            status: "skipped_no_id",
          });
          continue;
        }
        apiCalls++;
        const nick = await fetchDouyinNickname(dy.secUid);
        if (!nick) {
          results.push({
            outletId: o.id,
            outletName: o.outletName,
            channelIndex: i,
            platform: "douyin",
            identifier: dy.secUid,
            oldNick,
            newNick: null,
            status: "failed",
            reason: "API 无 nickname",
          });
          continue;
        }
        if (nick === oldNick) {
          results.push({
            outletId: o.id,
            outletName: o.outletName,
            channelIndex: i,
            platform: "douyin",
            identifier: dy.secUid,
            oldNick,
            newNick: nick,
            status: "same",
          });
          continue;
        }
        next[i] = { ...dy, nickname: nick };
        modified = true;
        results.push({
          outletId: o.id,
          outletName: o.outletName,
          channelIndex: i,
          platform: "douyin",
          identifier: dy.secUid,
          oldNick,
          newNick: nick,
          status: "updated",
        });
      } else if (ch.type === "weibo") {
        const wb = ch as WeiboChannel;
        if (!wb.uid) {
          results.push({
            outletId: o.id,
            outletName: o.outletName,
            channelIndex: i,
            platform: "weibo",
            identifier: "",
            oldNick,
            newNick: null,
            status: "skipped_no_id",
          });
          continue;
        }
        apiCalls++;
        const nick = await fetchWeiboNickname(wb.uid);
        if (!nick) {
          results.push({
            outletId: o.id,
            outletName: o.outletName,
            channelIndex: i,
            platform: "weibo",
            identifier: wb.uid,
            oldNick,
            newNick: null,
            status: "failed",
            reason: "API 无 screen_name",
          });
          continue;
        }
        if (nick === oldNick) {
          results.push({
            outletId: o.id,
            outletName: o.outletName,
            channelIndex: i,
            platform: "weibo",
            identifier: wb.uid,
            oldNick,
            newNick: nick,
            status: "same",
          });
          continue;
        }
        next[i] = { ...wb, nickname: nick };
        modified = true;
        results.push({
          outletId: o.id,
          outletName: o.outletName,
          channelIndex: i,
          platform: "weibo",
          identifier: wb.uid,
          oldNick,
          newNick: nick,
          status: "updated",
        });
      }
      // kuaishou skip - 需 cookies
      // wechat_oa skip - 公众号 name 已经是真实名
      // website skip - 没有"账号昵称"概念
    }

    if (modified && !dryRun) {
      await db
        .update(mediaOutletDictionary)
        .set({ channels: next, updatedAt: new Date() })
        .where(eq(mediaOutletDictionary.id, o.id));
    }
  }

  // 统计
  const stats = {
    updated: results.filter((r) => r.status === "updated").length,
    same: results.filter((r) => r.status === "same").length,
    failed: results.filter((r) => r.status === "failed").length,
    skippedNoId: results.filter((r) => r.status === "skipped_no_id").length,
  };

  console.log("━━━ 改名样例(前 20 条) ━━━\n");
  for (const r of results.filter((r) => r.status === "updated").slice(0, 20)) {
    console.log(
      `  [${r.platform}] ${r.outletName.padEnd(20)} "${r.oldNick}" → "${r.newNick}"`,
    );
  }

  console.log("\n━━━ 汇总 ━━━");
  console.log(`API 调用:        ${apiCalls}`);
  console.log(`成功更新:        ${stats.updated}`);
  console.log(`昵称无变化:      ${stats.same}`);
  console.log(`API 失败:        ${stats.failed}`);
  console.log(`无 identifier:   ${stats.skippedNoId}`);
  console.log(`预估花费:        ~$${(apiCalls * 0.005).toFixed(2)} USD`);

  if (stats.failed > 0) {
    console.log("\n失败明细:");
    for (const r of results.filter((r) => r.status === "failed").slice(0, 15)) {
      console.log(`  [${r.platform}] ${r.outletName} (${r.identifier}): ${r.reason}`);
    }
  }

  if (dryRun) {
    console.log("\n(DRY RUN — 没写库)");
  } else {
    console.log("\n✅ 完成");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});

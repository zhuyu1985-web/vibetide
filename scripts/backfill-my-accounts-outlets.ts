/**
 * scripts/backfill-my-accounts-outlets.ts
 *
 * 把 my_accounts 表里没有 outlet_id 的账号回填到 media_outlet_dictionary：
 *   1. 按 my_account.name 创建 outlet（outlet_tier/region 用规则推断）
 *   2. 按 platform 加 channel skeleton 到 channels[]:
 *      - douyin/weibo: 尝试 TikHub user-search 拿 secUid/uid
 *      - app/website: 用 my_account.account_url
 *      - 其他: nickname-only skeleton（identifier 留空，cron 会 SKIP，用户后续 UI 补）
 *   3. 更新 my_account.outlet_id 指向新 outlet
 *
 * 用法：
 *   npx tsx --env-file=.env.local scripts/backfill-my-accounts-outlets.ts          # 真跑
 *   npx tsx --env-file=.env.local scripts/backfill-my-accounts-outlets.ts --dry    # 干跑
 */

import { db } from "@/db";
import { myAccounts, mediaOutletDictionary } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import type { Channel } from "@/lib/media-outlet/channels";

const ORG_ID = "a0000000-0000-4000-8000-000000000001";
const TIKHUB_BASE = process.env.TIKHUB_API_BASE_URL ?? "https://api.tikhub.io";
const TIKHUB_KEY = process.env.TIKHUB_API_KEY;
const dryRun = process.argv.includes("--dry");

// ─── TikHub user search 尝试（端点结构推断；失败兜底 null）───────────
async function tikhubFetchJson(path: string): Promise<unknown | null> {
  if (!TIKHUB_KEY) return null;
  try {
    const url = new URL(path, TIKHUB_BASE);
    const r = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${TIKHUB_KEY}` },
    });
    if (!r.ok) {
      console.warn(`  [tikhub] ${r.status} ${path}`);
      return null;
    }
    return await r.json();
  } catch (err) {
    console.warn(`  [tikhub] fetch fail ${path}: ${(err as Error).message}`);
    return null;
  }
}

interface FoundDouyinUser {
  secUid: string;
  nickname: string;
  uid?: string;
}

async function searchDouyinUser(keyword: string): Promise<FoundDouyinUser | null> {
  // TikHub 抖音用户搜索端点（如不存在会 404，函数返 null）
  const data = await tikhubFetchJson(
    `/api/v1/douyin/web/handler_user_search?keyword=${encodeURIComponent(keyword)}&offset=0&count=5`,
  );
  if (!data) return null;
  const list = ((data as Record<string, unknown>).data as Record<string, unknown>)
    ?.user_list as Array<Record<string, unknown>> | undefined;
  const first = list?.[0]?.user_info as Record<string, unknown> | undefined;
  if (!first?.sec_uid) return null;
  return {
    secUid: String(first.sec_uid),
    nickname: String(first.nickname ?? keyword),
    uid: first.uid ? String(first.uid) : undefined,
  };
}

interface FoundWeiboUser {
  uid: string;
  nickname: string;
}

async function searchWeiboUser(keyword: string): Promise<FoundWeiboUser | null> {
  // TikHub 微博搜索用户（fetch_search type=3）
  const data = await tikhubFetchJson(
    `/api/v1/weibo/web/fetch_search?keyword=${encodeURIComponent(keyword)}&page=1&type=user`,
  );
  if (!data) return null;
  // 兜底解析多种可能的响应结构
  const root = data as Record<string, unknown>;
  const inner = (root.data as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  const cards = inner?.cards as Array<Record<string, unknown>> | undefined;
  if (!cards) return null;
  for (const card of cards) {
    const user =
      (card.user as Record<string, unknown>) ||
      ((card.card_group as Array<Record<string, unknown>>)?.[0]?.user as Record<string, unknown>);
    if (user?.id || user?.idstr) {
      return {
        uid: String(user.idstr ?? user.id),
        nickname: String(user.screen_name ?? keyword),
      };
    }
  }
  return null;
}

// ─── 主流程 ───────────────────────────────────────────────────────
async function main() {
  console.log(`${dryRun ? "🔍 DRY RUN" : "🚀 REAL RUN"}\n`);
  const todo = await db
    .select()
    .from(myAccounts)
    .where(and(eq(myAccounts.organizationId, ORG_ID), isNull(myAccounts.outletId)));

  console.log(`待回填 ${todo.length} 个账号\n`);

  let createdOutlets = 0;
  let linkedAccounts = 0;
  let identifierFound = 0;
  const skipped: string[] = [];

  for (const acc of todo) {
    console.log(`\n[${acc.platform}] ${acc.name} (@${acc.handle})`);

    // 1. 推断 outlet metadata
    const outletName = acc.name;
    const outletTier = guessTier(acc.handle, acc.name);
    const outletRegion = guessRegion(acc.name);

    // 2. 构造 channels[] —— 按平台分支
    const channels: Channel[] = [];

    if (acc.platform === "website" || acc.platform === "app") {
      const url = acc.accountUrl ?? "";
      if (url) {
        try {
          const domain = new URL(url).host;
          channels.push({
            type: "website",
            url,
            domain,
          });
          identifierFound++;
        } catch {
          console.log(`  ⚠ 无效 URL: ${url}`);
        }
      }
    } else if (acc.platform === "douyin") {
      // 先放置 nickname-only skeleton，TikHub 拿到 secUid 再覆盖
      let secUid = "";
      const found = await searchDouyinUser(acc.name);
      if (found) {
        secUid = found.secUid;
        identifierFound++;
        console.log(`  ✓ TikHub 找到 secUid = ${secUid.slice(0, 20)}...`);
      } else {
        console.log(`  ✗ TikHub 未找到 secUid，留空待手动补`);
      }
      channels.push({
        type: "douyin",
        nickname: acc.name,
        secUid,
        profileUrl: acc.accountUrl ?? undefined,
      });
    } else if (acc.platform === "weibo") {
      let uid = "";
      const found = await searchWeiboUser(acc.name);
      if (found) {
        uid = found.uid;
        identifierFound++;
        console.log(`  ✓ TikHub 找到 uid = ${uid}`);
      } else {
        console.log(`  ✗ TikHub 未找到 uid，留空待手动补`);
      }
      channels.push({
        type: "weibo",
        nickname: acc.name,
        uid,
        profileUrl: acc.accountUrl ?? undefined,
      });
    } else if (acc.platform === "kuaishou") {
      channels.push({
        type: "kuaishou",
        nickname: acc.name,
        userId: "",
        profileUrl: acc.accountUrl ?? undefined,
      });
      console.log(`  ⚠ kuaishou 需登录 cookies，userId 留空`);
    } else {
      skipped.push(`${acc.platform}/${acc.handle}: 平台暂不支持`);
      continue;
    }

    if (dryRun) {
      console.log(`  [DRY] 将创建 outlet "${outletName}" (tier=${outletTier} region=${outletRegion})`);
      console.log(`        channels: ${JSON.stringify(channels)}`);
      continue;
    }

    // 3. upsert outlet —— 同 (orgId, name) 已存在 → 合并 channels[]
    const existing = await db.query.mediaOutletDictionary.findFirst({
      where: and(
        eq(mediaOutletDictionary.organizationId, ORG_ID),
        eq(mediaOutletDictionary.outletName, outletName),
      ),
    });

    let outletId: string;
    if (existing) {
      // 合并 channels（同 type 已存在则跳过，避免覆盖已配的 secUid）
      const currentChannels = (existing.channels ?? []) as Channel[];
      const mergedChannels = [...currentChannels];
      for (const ch of channels) {
        if (!mergedChannels.find((c) => c.type === ch.type)) {
          mergedChannels.push(ch);
        }
      }
      if (mergedChannels.length !== currentChannels.length) {
        await db
          .update(mediaOutletDictionary)
          .set({ channels: mergedChannels, updatedAt: new Date() })
          .where(eq(mediaOutletDictionary.id, existing.id));
        console.log(`  ↻ outlet 已存在，已合并 ${channels.length} 个 channel`);
      } else {
        console.log(`  ↻ outlet 已存在，channel 已包含 type=${channels[0]?.type}`);
      }
      outletId = existing.id;
    } else {
      const [outlet] = await db
        .insert(mediaOutletDictionary)
        .values({
          organizationId: ORG_ID,
          outletName,
          outletTier,
          outletRegion,
          isActive: true,
          channels,
        })
        .returning({ id: mediaOutletDictionary.id });
      outletId = outlet.id;
      createdOutlets++;
      console.log(`  ✅ 新建 outlet_id = ${outletId}`);
    }

    // 4. 回写 my_account.outlet_id
    await db
      .update(myAccounts)
      .set({ outletId, updatedAt: new Date() })
      .where(eq(myAccounts.id, acc.id));
    linkedAccounts++;
  }

  console.log("\n━━━ 汇总 ━━━");
  console.log(`处理账号:    ${todo.length}`);
  console.log(`新建 outlet: ${createdOutlets}`);
  console.log(`绑定账号:    ${linkedAccounts}`);
  console.log(`找到 ID:     ${identifierFound}/${todo.length}`);
  if (skipped.length > 0) {
    console.log("\n跳过:");
    for (const s of skipped) console.log(`  - ${s}`);
  }

  if (dryRun) {
    console.log("\n(DRY RUN — 未真写)");
  }
  process.exit(0);
}

function guessTier(handle: string, name: string): string {
  // BRTV 体系 → provincial（北京市级广播电视台）
  if (/brtv|btv|北京电视|北京卫视|北京广播|btime|北京时间/i.test(handle + name)) {
    return "provincial";
  }
  return "city";
}

function guessRegion(name: string): string {
  if (/北京|京津冀|BRTV|BTV|btime|北京时间/i.test(name)) return "北京";
  return "北京";
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});

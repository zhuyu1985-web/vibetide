/**
 * scripts/probe-tikhub-account-endpoints.ts
 *
 * 用真实 tikhub.io API 探测 4 个 account-mode 端点的响应结构,验证 mappers
 * (src/lib/collection/adapters/tikhub/account-mappers.ts) 字段名是否对得上。
 *
 * 把每个平台的原始响应 dump 到 scripts/tikhub-probe-output/<platform>.json,
 * 同时跑 mapper 看抽到几条 item 输出 mismatch 提示。
 *
 * 用法:
 *   1. 准备测试账号(任选有公开内容的):
 *      - 抖音 secUid: 在 douyin.com 主页 URL 里复制(MS4wLjABxxx...)
 *      - 微博 uid: weibo.com/u/{uid}
 *      - 快手 userId: kuaishou.com/profile/{userId}
 *      - 公众号 ghid: gh_xxxxx (从公众号后台获取)
 *
 *   2. 设置 env(.env.local 已有 TIKHUB_API_KEY 即可)
 *
 *   3. 跑探针(任选要测的平台,跳过的填 ""):
 *
 *      pnpm tsx scripts/probe-tikhub-account-endpoints.ts \
 *        --secuid MS4wLjABAAAAxxx \
 *        --uid 2803301701 \
 *        --userid 3xy4nh4nzqzkfxg \
 *        --ghid gh_a3d35d4c9d3f
 *
 *   4. 查看输出:
 *      - scripts/tikhub-probe-output/{douyin,weibo,kuaishou,wechat_oa}.json (raw response)
 *      - 控制台打印 mapper 抽到几条 item + 第一条 item 摘要
 *      - 如果 mapper 返回 0 但 raw 里有数据 → 字段名 mismatch,去 account-mappers.ts 改
 *
 *  ⚠️  本脚本会真实调用 tikhub API 消耗预算($0.001-0.005 per call),
 *      4 个平台跑一次约 $0.02 USD。
 */

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import {
  mapDouyinAccountResponse,
  mapWeiboAccountResponse,
  mapKuaishouAccountResponse,
  mapWechatMpAccountResponse,
} from "@/lib/collection/adapters/tikhub/account-mappers";
import { TIKHUB_ACCOUNT_PLATFORM_ENDPOINTS } from "@/lib/collection/adapters/tikhub/config";
import type { RawItem } from "@/lib/collection/types";

const BASE = process.env.TIKHUB_API_BASE_URL ?? "https://api.tikhub.io";
const KEY = process.env.TIKHUB_API_KEY;
const OUT_DIR = "scripts/tikhub-probe-output";

if (!KEY) {
  console.error("❌ TIKHUB_API_KEY 未配置,无法探测");
  process.exit(1);
}

// 解析 CLI args
function getArg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i < 0) return undefined;
  return process.argv[i + 1];
}

const secUid = getArg("--secuid");
const uid = getArg("--uid");
const userId = getArg("--userid");
const ghid = getArg("--ghid");

mkdirSync(OUT_DIR, { recursive: true });

interface ProbeCase {
  platform: "douyin" | "weibo" | "kuaishou" | "wechat_oa";
  identifier: string | undefined;
  params: Record<string, string | number>;
  mapper: (resp: unknown) => RawItem[];
}

const cases: ProbeCase[] = [
  {
    platform: "douyin",
    identifier: secUid,
    params: secUid ? { sec_user_id: secUid, max_cursor: 0, count: 20 } : {},
    mapper: mapDouyinAccountResponse,
  },
  {
    platform: "weibo",
    identifier: uid,
    params: uid ? { uid, page: 1 } : {},
    mapper: mapWeiboAccountResponse,
  },
  {
    platform: "kuaishou",
    identifier: userId,
    params: userId ? { user_id: userId, pcursor: 0, count: 20 } : {},
    mapper: mapKuaishouAccountResponse,
  },
  {
    platform: "wechat_oa",
    identifier: ghid,
    params: ghid ? { ghid, offset: 0 } : {},
    mapper: mapWechatMpAccountResponse,
  },
];

function getFlagForPlatform(p: ProbeCase["platform"]): string {
  return { douyin: "secuid", weibo: "uid", kuaishou: "userid", wechat_oa: "ghid" }[p];
}

async function probe(c: ProbeCase): Promise<void> {
  console.log(`\n━━━ ${c.platform.toUpperCase()} ━━━`);
  if (!c.identifier) {
    console.log(`  ⏭️  未提供识别符,跳过(传 --${getFlagForPlatform(c.platform)} 启用)`);
    return;
  }

  const endpoint = TIKHUB_ACCOUNT_PLATFORM_ENDPOINTS[c.platform];
  const url = new URL(endpoint, BASE);
  for (const [k, v] of Object.entries(c.params)) {
    url.searchParams.set(k, String(v));
  }

  console.log(`  GET ${url.toString()}`);

  const t0 = Date.now();
  let resp: Response;
  try {
    resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${KEY}` },
    });
  } catch (err) {
    console.error(`  ❌ 网络错误: ${(err as Error).message}`);
    return;
  }
  const elapsed = Date.now() - t0;
  console.log(`  HTTP ${resp.status} (${elapsed}ms)`);

  let data: unknown;
  try {
    data = await resp.json();
  } catch {
    const text = await resp.text().catch(() => "");
    console.error(`  ❌ 响应非 JSON: ${text.slice(0, 200)}`);
    return;
  }

  // dump raw
  const outPath = join(OUT_DIR, `${c.platform}.json`);
  writeFileSync(outPath, JSON.stringify(data, null, 2), "utf-8");
  console.log(`  📁 raw response → ${outPath}`);

  // 跑 mapper
  let items: RawItem[] = [];
  try {
    items = c.mapper(data);
  } catch (err) {
    console.error(`  ❌ mapper 抛错: ${(err as Error).message}`);
    return;
  }

  console.log(`  📊 mapper 抽到 ${items.length} 条 item`);
  if (items.length > 0) {
    const sample = items[0]!;
    console.log(`  样例: title="${sample.title?.slice(0, 50)}", url=${sample.url}`);
    console.log(`        publishedAt=${sample.publishedAt?.toISOString() ?? "(无)"}`);
  } else {
    // mapper 返回 0 但 raw 里可能有数据 — 提示字段 mismatch
    const dataField = (data as { data?: unknown })?.data;
    if (dataField && typeof dataField === "object") {
      const topKeys = Object.keys(dataField as Record<string, unknown>);
      console.warn(
        `  ⚠️  mapper 返回 0 条但响应非空。data 顶层字段: [${topKeys.join(", ")}]`,
      );
      console.warn(
        `      account-mappers.ts 里 ${c.platform} 的 mapper 可能字段名对不上,请打开 ${outPath} 检查实际结构。`,
      );
    }
  }
}

async function main() {
  console.log(`🔍 探测 tikhub account-mode endpoints`);
  console.log(`   BASE URL: ${BASE}`);
  console.log(`   输出目录: ${OUT_DIR}/`);

  for (const c of cases) {
    await probe(c);
  }

  console.log("\n✅ 探测完成");
  console.log("\n下一步:");
  console.log("  1. 检查每个 .json 文件,找到真实 list 字段名");
  console.log("  2. 对照 src/lib/collection/adapters/tikhub/account-mappers.ts 里");
  console.log("     mapDouyinAccountResponse / mapWeiboAccountResponse / mapKuaishouAccountResponse / mapWechatMpAccountResponse");
  console.log("     字段访问路径(如 r?.list ?? r?.cards),按真实响应调整");
  console.log("  3. 跑 npx vitest run 确保单测不挂(单测用的是 fixture,不依赖真实 API)");
  console.log("  4. 改完 mapper 后再跑一次本脚本验证");
}

main().catch((err) => {
  console.error("❌ 探测失败:", err);
  process.exit(1);
});

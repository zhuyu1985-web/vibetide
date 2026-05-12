/**
 * scripts/import-outlet-channels-from-xlsx.ts
 *
 * 把 docs/media-outlets-channels-todo.xlsx 里录入的账号 URL 同步到
 * media_outlet_dictionary.channels jsonb 字段。
 *
 * 合并语义(MERGE PER PLATFORM):
 *   - Excel 中某平台填了值 → 该平台所有 channels 用 Excel 数据 REPLACE
 *   - Excel 中某平台留空 → 保留 DB 现有的该平台 channels(不删)
 *   - 这样允许多次部分填充 + 重跑
 *
 * 多账号 cell:用换行(\n) 或 | 分隔
 *
 * 抖音短链(v.douyin.com/xxxx):无法离线解析 sec_uid,会原样存 profileUrl
 *   + 加进末尾 TODO 报告。运营在浏览器里打开短链获取完整 URL 后回填 Excel 重跑。
 *
 * 用法:
 *   DATABASE_URL=... pnpm tsx scripts/import-outlet-channels-from-xlsx.ts
 *   # 默认读 docs/media-outlets-channels-todo.xlsx
 *   pnpm tsx scripts/import-outlet-channels-from-xlsx.ts path/to/file.xlsx --dry-run
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import * as XLSX from "xlsx";
import { writeFileSync } from "fs";
import { db } from "@/db";
import { mediaOutletDictionary } from "@/db/schema/media-outlet-dictionary";
import { eq } from "drizzle-orm";
import {
  parseDouyinProfileUrl,
  parseWeiboProfileUrl,
  parseKuaishouProfileUrl,
  parseWebsiteUrl,
} from "@/lib/media-outlet/url-parsers";
import type {
  Channel,
  ChannelType,
  WebsiteChannel,
  WechatOaChannel,
  DouyinChannel,
  WeiboChannel,
  KuaishouChannel,
} from "@/lib/media-outlet/channels";

// ─── CLI args ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const filePath =
  args.find((a) => a.endsWith(".xlsx")) ?? "docs/media-outlets-channels-todo.xlsx";

console.log(`📂 Reading: ${filePath} ${dryRun ? "(DRY RUN)" : ""}\n`);

// ─── 数据结构 ────────────────────────────────────────────────────
interface XlsxRow {
  分级?: string;
  媒体名?: string;
  集团?: string;
  区域?: string;
  区县?: string;
  行业?: string;
  已知网站?: string;
  已知公众号名?: string;
  抖音主页url?: string;
  微博主页url?: string;
  快手主页url?: string;
  公众号ghid?: string;
  备注?: string;
}

interface UnresolvedShort {
  outletName: string;
  platform: ChannelType;
  url: string;
}

const unresolvedShorts: UnresolvedShort[] = [];

// ─── 工具:多值 cell 拆分 ─────────────────────────────────────────
function splitCell(s: string | undefined): string[] {
  if (!s) return [];
  return s
    .split(/[\n|]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

// ─── 平台解析(每平台独立,返回该平台所有 channels) ─────────────────

function parseWebsites(cell: string | undefined): WebsiteChannel[] {
  return splitCell(cell).flatMap((domain) => {
    // 已知网站填的是域名(如 "people.com.cn"),不是完整 URL
    const url = domain.startsWith("http") ? domain : `https://${domain}`;
    const ch = parseWebsiteUrl(url);
    return ch ? [ch] : [];
  });
}

function parseDouyins(cell: string | undefined, outletName: string): DouyinChannel[] {
  return splitCell(cell).flatMap((url) => {
    // 长链 douyin.com/user/MS4wxxx
    const longForm = parseDouyinProfileUrl(url);
    if (longForm) {
      return [{ ...longForm, nickname: outletName }];
    }
    // 短链 v.douyin.com/xxxx → 存 profileUrl,标 TODO
    if (/^https?:\/\/v\.douyin\.com\//.test(url)) {
      unresolvedShorts.push({ outletName, platform: "douyin", url });
      return [
        {
          type: "douyin" as const,
          nickname: outletName,
          secUid: "", // 待解析
          profileUrl: url,
        },
      ];
    }
    console.warn(`  ⚠️  无法识别的抖音 URL: ${url}`);
    return [];
  });
}

function parseWeibos(cell: string | undefined, outletName: string): WeiboChannel[] {
  return splitCell(cell).flatMap((url) => {
    const ch = parseWeiboProfileUrl(url);
    if (!ch) {
      console.warn(`  ⚠️  无法识别的微博 URL: ${url}`);
      return [];
    }
    return [{ ...ch, nickname: outletName }];
  });
}

function parseKuaishous(cell: string | undefined, outletName: string): KuaishouChannel[] {
  return splitCell(cell).flatMap((url) => {
    // 剥离 query string (?source=SEARCH 这种)
    const clean = url.split("?")[0]!;
    const ch = parseKuaishouProfileUrl(clean);
    if (!ch) {
      console.warn(`  ⚠️  无法识别的快手 URL: ${url}`);
      return [];
    }
    // 保留原 URL 给 profileUrl(含 query 也不影响)
    return [{ ...ch, nickname: outletName, profileUrl: url }];
  });
}

function parseWechatOas(
  namesCell: string | undefined,
  ghidCell: string | undefined,
): WechatOaChannel[] {
  const names = splitCell(namesCell);
  const ghid = ghidCell?.trim();
  if (names.length === 0 && !ghid) return [];

  // 没有 names 但有 ghid → 用 ghid 作为占位名(用户后续补)
  if (names.length === 0 && ghid) {
    return [{ type: "wechat_oa", name: ghid, ghid }];
  }

  return names.map((name, i) => {
    const ch: WechatOaChannel = { type: "wechat_oa", name };
    // 只把 ghid 挂给第一个 name(单 ghid 情形);多个 name 多个 ghid 的复杂情形 Excel 不支持
    if (i === 0 && ghid && /^gh_[a-zA-Z0-9]+$/.test(ghid)) ch.ghid = ghid;
    return ch;
  });
}

// ─── 合并语义 ────────────────────────────────────────────────────
/**
 * 把 Excel 解析出的"按平台"channels 合并到 DB 现有 channels:
 *   - 该 platform 在 Excel 里有任何 channel → 用 Excel 的 REPLACE 整个 platform
 *   - Excel 里某 platform 全空 → 保留 DB 现有
 */
function mergeChannels(
  existing: Channel[],
  fromExcel: Record<ChannelType, Channel[]>,
): Channel[] {
  const platformsTouchedByExcel = (Object.keys(fromExcel) as ChannelType[]).filter(
    (t) => fromExcel[t].length > 0,
  );
  // 保留 DB 中"Excel 没覆盖"的 platform 的 channels
  const preserved = existing.filter((c) => !platformsTouchedByExcel.includes(c.type));
  // 合入 Excel 提供的 channels
  const incoming = platformsTouchedByExcel.flatMap((t) => fromExcel[t]);
  return [...preserved, ...incoming];
}

// ─── 主流程 ──────────────────────────────────────────────────────
async function main() {
  // 1. 读 Excel
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]!]!;
  const rows = XLSX.utils.sheet_to_json<XlsxRow>(sheet, { defval: "" });
  console.log(`Excel 共 ${rows.length} 行\n`);

  // 2. 读 DB 现有 outlets
  const allOutlets = await db.select().from(mediaOutletDictionary);
  const outletByName = new Map(allOutlets.map((o) => [o.outletName, o]));
  console.log(`DB 有 ${allOutlets.length} 个 outlets\n`);

  // 3. 逐行处理
  const stats = {
    matched: 0,
    notFound: 0,
    updated: 0,
    skippedNoChange: 0,
    addedByPlatform: { website: 0, wechat_oa: 0, douyin: 0, weibo: 0, kuaishou: 0 } as Record<ChannelType, number>,
  };

  for (const row of rows) {
    const name = row.媒体名?.trim();
    if (!name) continue;

    const outlet = outletByName.get(name);
    if (!outlet) {
      console.warn(`  ❌ DB 找不到 outlet "${name}",跳过(Excel 里有但 DB 没有)`);
      stats.notFound++;
      continue;
    }
    stats.matched++;

    // 解析该行所有平台
    const fromExcel: Record<ChannelType, Channel[]> = {
      website: parseWebsites(row.已知网站),
      wechat_oa: parseWechatOas(row.已知公众号名, row.公众号ghid),
      douyin: parseDouyins(row.抖音主页url, name),
      weibo: parseWeibos(row.微博主页url, name),
      kuaishou: parseKuaishous(row.快手主页url, name),
    };

    // groupName 也从 Excel 同步
    const groupName = row.集团?.trim() || null;

    // 计算合并后 channels
    const merged = mergeChannels((outlet.channels ?? []) as Channel[], fromExcel);

    // 统计新增数(简单按"该平台 channel count 增加了多少"算)
    const existingByType = new Map<ChannelType, number>();
    for (const c of (outlet.channels ?? []) as Channel[]) {
      existingByType.set(c.type, (existingByType.get(c.type) ?? 0) + 1);
    }
    for (const t of Object.keys(fromExcel) as ChannelType[]) {
      const before = existingByType.get(t) ?? 0;
      const after = fromExcel[t].length > 0 ? fromExcel[t].length : before;
      if (after > before) stats.addedByPlatform[t] += after - before;
    }

    if (dryRun) continue;

    // 写回 DB(也同步 groupName)
    await db
      .update(mediaOutletDictionary)
      .set({
        channels: merged,
        groupName: groupName,
        updatedAt: new Date(),
      })
      .where(eq(mediaOutletDictionary.id, outlet.id));
    stats.updated++;
  }

  // 4. 打印统计
  console.log("\n━━━ 导入结果 ━━━");
  console.log(`匹配 outlet:  ${stats.matched}`);
  console.log(`DB 找不到:    ${stats.notFound}`);
  if (!dryRun) console.log(`已更新:        ${stats.updated}`);
  console.log("各平台新增 channels:");
  for (const [t, n] of Object.entries(stats.addedByPlatform)) {
    if (n > 0) console.log(`  ${t.padEnd(12)} +${n}`);
  }

  // 5. 输出短链 TODO
  if (unresolvedShorts.length > 0) {
    console.log(`\n━━━ ⚠️  ${unresolvedShorts.length} 条抖音短链需人工解析 ━━━`);
    console.log("(浏览器打开短链 → 拿到 douyin.com/user/MS4wxxx 完整 URL → 回填 Excel → 重跑本脚本)\n");
    const todoPath = "scripts/tikhub-probe-output/douyin-shortlinks-todo.csv";
    const lines = ["媒体名,短链,完整URL(待填)"];
    for (const u of unresolvedShorts) {
      console.log(`  ${u.outletName.padEnd(20)}  ${u.url}`);
      lines.push(`${u.outletName},${u.url},`);
    }
    writeFileSync(todoPath, lines.join("\n") + "\n");
    console.log(`\n📁 TODO 清单写入: ${todoPath}`);
  }

  if (dryRun) {
    console.log("\n(DRY RUN — 没写库)");
  } else {
    console.log("\n✅ 导入完成");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Import failed:", err);
  process.exit(1);
});

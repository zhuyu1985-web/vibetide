/**
 * scripts/import-outlet-channels-from-xlsx.ts
 *
 * 把 docs/media-outlets-channels-todo.xlsx 里录入的账号 URL 同步到
 * media_outlet_dictionary.channels jsonb 字段。
 *
 * 合并语义(ADD-ONLY,按 type+identifier 去重):
 *   - DB 中已有相同 (type, identifier) → 跳过,不重复添加
 *   - DB 中没有 → append 到 channels 数组
 *   - DB 中有但 Excel 没有 → 保留(不删除)
 *   - 这样可以多次重跑、跨多个 sheet 累积录入,绝不重复添加
 *
 * 多 Sheet 支持:
 *   读取所有 sheet,列名归一化(兼容"抖音主页 url" 带空格 与 "抖音主页url" 不带空格)。
 *   同一媒体名在多 sheet 出现时,所有 sheet 的 channels 累积去重合并。
 *
 * 新 outlet:
 *   - Excel 中媒体名 DB 不存在 → 自动 INSERT 新 outlet (用 Excel 行的 metadata)
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
import { getChannelIdentifier } from "@/lib/media-outlet/channels";

// ─── CLI args ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const filePath =
  args.find((a) => a.endsWith(".xlsx")) ?? "docs/media-outlets-channels-todo.xlsx";

console.log(`📂 Reading: ${filePath} ${dryRun ? "(DRY RUN)" : ""}\n`);

// ─── 数据结构 ────────────────────────────────────────────────────
// 列名归一化后的 row 形态;读 Excel 时把"抖音主页 url"(带空格)
// 也归一为"抖音主页url"(无空格)。
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

/** 列名归一化:去掉所有空白,把"抖音主页 url" → "抖音主页url" */
function normalizeRow(raw: Record<string, unknown>): XlsxRow {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    const normKey = k.replace(/\s+/g, "");
    out[normKey] = v;
  }
  return out as XlsxRow;
}

/** outletTier 中文 → enum 映射(第二批 sheet 用中文) */
const TIER_LABEL_TO_ENUM: Record<string, string> = {
  央级: "central",
  央: "central",
  "省/市级": "provincial_municipal",
  省市级: "provincial_municipal",
  省级: "provincial_municipal",
  市级: "provincial_municipal",
  行业: "industry",
  区县融媒: "district_media",
  区县: "district_media",
  政务新媒体: "government_self_media",
  政务: "government_self_media",
};

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

// ─── 合并语义 (ADD-ONLY,按 type+identifier 去重) ─────────────────────
/**
 * 生成 channel 唯一 key,用于跨重跑去重。
 * 同 type 同 identifier 视为重复(即便其他字段如 nickname 不同也算同账号)。
 * - website: domain
 * - wechat_oa: ghid (无 ghid 退到 name,因为这阶段也没法采集)
 * - douyin: secUid
 * - weibo: uid
 * - kuaishou: userId
 */
function channelKey(c: Channel): string {
  const id = getChannelIdentifier(c) ?? "";
  if (c.type === "wechat_oa" && !c.ghid) {
    // 没 ghid 的公众号靠 name 区分(只是反查标识,不能 tikhub 采集)
    return `wechat_oa:name:${c.name}`;
  }
  return `${c.type}:${id}`;
}

/**
 * ADD-ONLY 合并:
 *   - 现有 channels 全部保留
 *   - Excel 来的 channel 如果 (type, identifier) 已存在 → 跳过 (返回 dupes)
 *   - 不存在 → append
 *
 * 返回: {merged: 合并后数组, addedCount: 真正新加的数量, dupesCount: 跳过的重复数}
 */
function addOnlyMergeChannels(
  existing: Channel[],
  fromExcel: Channel[],
): { merged: Channel[]; addedCount: number; dupesCount: number } {
  const existingKeys = new Set(existing.map(channelKey));
  const result = [...existing];
  let added = 0;
  let dupes = 0;
  for (const ch of fromExcel) {
    const k = channelKey(ch);
    if (existingKeys.has(k)) {
      dupes++;
      continue;
    }
    result.push(ch);
    existingKeys.add(k);
    added++;
  }
  return { merged: result, addedCount: added, dupesCount: dupes };
}

// ─── 主流程 ──────────────────────────────────────────────────────
async function main() {
  // 1. 读 Excel — 所有 sheet
  const wb = XLSX.readFile(filePath);
  console.log(`📂 Excel sheets: ${wb.SheetNames.join(", ")}`);

  // 合并所有 sheet 的 rows(归一化列名)
  const allRows: { sheet: string; row: XlsxRow }[] = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName]!;
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    for (const r of raw) {
      const row = normalizeRow(r);
      if (row.媒体名?.trim()) allRows.push({ sheet: sheetName, row });
    }
    console.log(`  - ${sheetName}: ${raw.length} 行`);
  }
  console.log(`总计 ${allRows.length} 行有效\n`);

  // 2. 读 DB 现有 outlets
  const allOutlets = await db.select().from(mediaOutletDictionary);
  const outletByName = new Map(allOutlets.map((o) => [o.outletName, o]));
  console.log(`DB 现有 ${allOutlets.length} 个 outlets\n`);

  // 3. 同名跨 sheet 合并 channels(累积),metadata 以最后出现的为准
  interface MergedRow {
    name: string;
    tier: string | null;
    region: string | null;
    district: string | null;
    industry: string | null;
    groupName: string | null;
    fromExcelChannels: Channel[];
    sourceSheets: string[];
  }
  const mergedByName = new Map<string, MergedRow>();

  // 默认 org id (用于新 outlet 的 organizationId)
  const defaultOrgId = allOutlets[0]?.organizationId;
  if (!defaultOrgId && !dryRun) {
    throw new Error("DB 没有任何 outlet,无法推断 defaultOrgId");
  }

  for (const { sheet, row } of allRows) {
    const name = row.媒体名!.trim();
    const channels: Channel[] = [
      ...parseWebsites(row.已知网站),
      ...parseWechatOas(row.已知公众号名, row.公众号ghid),
      ...parseDouyins(row.抖音主页url, name),
      ...parseWeibos(row.微博主页url, name),
      ...parseKuaishous(row.快手主页url, name),
    ];

    const tierLabel = row.分级?.trim() ?? "";
    const tier = TIER_LABEL_TO_ENUM[tierLabel] ?? null;
    const groupName = row.集团?.trim() || null;
    const region = row.区域?.trim() || null;
    const district = row.区县?.trim() || null;
    const industry = row.行业?.trim() || null;

    const existing = mergedByName.get(name);
    if (existing) {
      existing.fromExcelChannels.push(...channels);
      existing.sourceSheets.push(sheet);
      // metadata 取后者覆盖(允许第二批补集团名)
      if (groupName) existing.groupName = groupName;
      if (region && !existing.region) existing.region = region;
      if (district && !existing.district) existing.district = district;
      if (industry && !existing.industry) existing.industry = industry;
      if (tier && !existing.tier) existing.tier = tier;
    } else {
      mergedByName.set(name, {
        name,
        tier,
        region,
        district,
        industry,
        groupName,
        fromExcelChannels: channels,
        sourceSheets: [sheet],
      });
    }
  }

  console.log(`合并后唯一媒体: ${mergedByName.size}\n`);

  // 4. 逐媒体 ADD-ONLY 合并 + UPDATE / INSERT
  const stats = {
    existingMatched: 0,
    newInserted: 0,
    skippedNoChange: 0,
    channelsAdded: 0,
    channelsDuplicate: 0,
    addedByPlatform: { website: 0, wechat_oa: 0, douyin: 0, weibo: 0, kuaishou: 0 } as Record<ChannelType, number>,
  };

  for (const [name, m] of mergedByName) {
    const outlet = outletByName.get(name);

    if (outlet) {
      // UPDATE 路径
      stats.existingMatched++;
      const before = (outlet.channels ?? []) as Channel[];
      const { merged, addedCount, dupesCount } = addOnlyMergeChannels(
        before,
        m.fromExcelChannels,
      );
      stats.channelsAdded += addedCount;
      stats.channelsDuplicate += dupesCount;

      if (addedCount === 0) {
        stats.skippedNoChange++;
      } else {
        // 按平台统计新增
        const beforeKeys = new Set(before.map(channelKey));
        for (const ch of merged) {
          if (!beforeKeys.has(channelKey(ch))) {
            stats.addedByPlatform[ch.type]++;
          }
        }
        if (!dryRun) {
          await db
            .update(mediaOutletDictionary)
            .set({
              channels: merged,
              groupName: m.groupName ?? outlet.groupName,
              outletRegion: m.region ?? outlet.outletRegion,
              outletDistrict: m.district ?? outlet.outletDistrict,
              industryTag: m.industry ?? outlet.industryTag,
              updatedAt: new Date(),
            })
            .where(eq(mediaOutletDictionary.id, outlet.id));
        }
      }
    } else {
      // INSERT 路径 (新 outlet)
      stats.newInserted++;
      // 去重(Excel 内部同 outlet 多 sheet 也可能有 dup)
      const seen = new Set<string>();
      const dedupedChannels = m.fromExcelChannels.filter((c) => {
        const k = channelKey(c);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      stats.channelsAdded += dedupedChannels.length;
      stats.channelsDuplicate += m.fromExcelChannels.length - dedupedChannels.length;

      for (const ch of dedupedChannels) {
        stats.addedByPlatform[ch.type]++;
      }

      if (!m.tier) {
        console.warn(`  ⚠️  跳过新 outlet "${name}":没有有效"分级"列(原值="${m.tier}")`);
        stats.newInserted--;
        continue;
      }

      if (!dryRun && defaultOrgId) {
        await db.insert(mediaOutletDictionary).values({
          organizationId: defaultOrgId,
          outletName: m.name,
          groupName: m.groupName,
          outletTier: m.tier,
          outletRegion: m.region,
          outletDistrict: m.district,
          industryTag: m.industry,
          channels: dedupedChannels,
        });
      }
      console.log(`  ➕ 新 outlet: ${name} (tier=${m.tier}, +${dedupedChannels.length} channels) [from sheet: ${m.sourceSheets.join(",")}]`);
    }
  }

  // 5. 打印统计
  console.log("\n━━━ 导入结果 ━━━");
  console.log(`已存在 outlet:    ${stats.existingMatched} 个`);
  console.log(`新增 outlet:      ${stats.newInserted} 个`);
  console.log(`无变化 (全 dup): ${stats.skippedNoChange} 个`);
  console.log(`\n新加 channels:    ${stats.channelsAdded} 条`);
  console.log(`跳过的重复:       ${stats.channelsDuplicate} 条`);
  console.log("\n按平台新加:");
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

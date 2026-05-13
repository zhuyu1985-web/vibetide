/**
 * scripts/import-media-dict-from-xlsx.ts
 *
 * 把"媒体字典模板"长格式 Excel 写回 media_outlet_dictionary。配套
 * scripts/export-media-dict-to-xlsx.ts 使用,形成"export → 编辑 → import"闭环。
 *
 * Excel 格式(单 sheet "媒体字典"):
 *   媒体名 | 分级 | 集团/上级单位 | 区域 | 区县 | 行业 | 描述 | 状态 |
 *   平台 | 账号名 | 识别符 | 主页 URL | 备注
 *
 * 语义:
 *   - 按"媒体名"groupby,每行一个 channel(同 outlet 多账号占多行)
 *   - outlet 元数据从该组的第一行非空值取
 *   - channels: ADD-ONLY 合并(按 type+identifier 去重),与现有 channels 累加
 *   - 状态列"停用"→ is_active=false
 *   - URL 缺识别符时用 parseAnyChannelUrl 自动解析(抖音/微博/快手主页都支持)
 *
 * 用法:
 *   pnpm tsx scripts/import-media-dict-from-xlsx.ts --dry-run
 *   pnpm tsx scripts/import-media-dict-from-xlsx.ts
 *   pnpm tsx scripts/import-media-dict-from-xlsx.ts path/to/file.xlsx
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import * as XLSX from "xlsx";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { mediaOutletDictionary } from "@/db/schema/media-outlet-dictionary";
import {
  parseDouyinProfileUrl,
  parseWeiboProfileUrl,
  parseKuaishouProfileUrl,
  parseWebsiteUrl,
} from "@/lib/media-outlet/url-parsers";
import {
  channelsArraySchema,
  getChannelIdentifier,
  type Channel,
  type ChannelType,
  type WebsiteChannel,
  type WechatOaChannel,
  type DouyinChannel,
  type WeiboChannel,
  type KuaishouChannel,
} from "@/lib/media-outlet/channels";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const filePath =
  args.find((a) => a.endsWith(".xlsx")) ?? "docs/media-dict-template.xlsx";

// 中文标签 → DB enum 映射
const TIER_LABEL_TO_ENUM: Record<string, string> = {
  央级: "central",
  "省/市级": "provincial_municipal",
  省市级: "provincial_municipal",
  行业: "industry",
  区县融媒: "district_media",
  区县: "district_media",
  政务新媒体: "government_self_media",
  政务: "government_self_media",
};

const PLATFORM_LABEL_TO_TYPE: Record<string, ChannelType> = {
  网站: "website",
  微信公众号: "wechat_oa",
  公众号: "wechat_oa",
  抖音: "douyin",
  微博: "weibo",
  快手: "kuaishou",
};

interface ExcelRow {
  媒体名?: string;
  分级?: string;
  "集团/上级单位"?: string;
  集团?: string; // 兼容旧列名
  区域?: string;
  区县?: string;
  行业?: string;
  描述?: string;
  状态?: string;
  平台?: string;
  账号名?: string;
  识别符?: string;
  "主页 URL"?: string;
  备注?: string;
}

function norm(s: string | number | undefined): string {
  if (s === undefined || s === null) return "";
  return String(s).trim();
}

/** 构造 Channel 对象。优先用"识别符"列,缺时从 URL 解析。 */
function buildChannel(
  platform: ChannelType,
  nickname: string,
  identifier: string,
  url: string,
  outletNameFallback: string,
): Channel | null {
  // 用 URL 解析作为兜底
  const parsedFromUrl = (() => {
    if (!url) return null;
    switch (platform) {
      case "douyin":
        return parseDouyinProfileUrl(url);
      case "weibo":
        return parseWeiboProfileUrl(url);
      case "kuaishou":
        return parseKuaishouProfileUrl(url);
      case "website":
        return parseWebsiteUrl(url);
      default:
        return null;
    }
  })();

  switch (platform) {
    case "website": {
      const domain = identifier || parsedFromUrl?.type === "website" ? (parsedFromUrl as WebsiteChannel | null)?.domain : "";
      const finalUrl = url || (domain ? `https://${domain}` : "");
      if (!finalUrl && !domain) return null;
      const ch: WebsiteChannel = {
        type: "website",
        url: finalUrl,
        domain: identifier || (parsedFromUrl as WebsiteChannel | null)?.domain || domain || "",
      };
      return ch;
    }
    case "wechat_oa": {
      const name = nickname || outletNameFallback;
      if (!name) return null;
      const ghid = identifier || undefined;
      const ch: WechatOaChannel = {
        type: "wechat_oa",
        name,
        ...(ghid ? { ghid } : {}),
      };
      return ch;
    }
    case "douyin": {
      const secUid =
        identifier ||
        (parsedFromUrl?.type === "douyin" ? (parsedFromUrl as DouyinChannel).secUid : "");
      if (!secUid) return null;
      const ch: DouyinChannel = {
        type: "douyin",
        nickname: nickname || outletNameFallback,
        secUid,
        ...(url ? { profileUrl: url } : {}),
      };
      return ch;
    }
    case "weibo": {
      const uid =
        identifier ||
        (parsedFromUrl?.type === "weibo" ? (parsedFromUrl as WeiboChannel).uid : "");
      if (!uid) return null;
      const ch: WeiboChannel = {
        type: "weibo",
        nickname: nickname || outletNameFallback,
        uid,
        ...(url ? { profileUrl: url } : {}),
      };
      return ch;
    }
    case "kuaishou": {
      const userId =
        identifier ||
        (parsedFromUrl?.type === "kuaishou" ? (parsedFromUrl as KuaishouChannel).userId : "");
      if (!userId) return null;
      const ch: KuaishouChannel = {
        type: "kuaishou",
        nickname: nickname || outletNameFallback,
        userId,
        ...(url ? { profileUrl: url } : {}),
      };
      return ch;
    }
  }
}

function channelKey(c: Channel): string {
  const id = getChannelIdentifier(c) ?? "";
  if (c.type === "wechat_oa" && !c.ghid) return `wechat_oa:name:${c.name}`;
  return `${c.type}:${id}`;
}

async function main() {
  console.log(`📂 Reading: ${filePath} ${dryRun ? "(DRY RUN)" : ""}\n`);

  const wb = XLSX.readFile(filePath);
  const sheetName = wb.SheetNames.find((n) => n === "媒体字典") ?? wb.SheetNames[0];
  if (!sheetName) {
    console.error("❌ Excel 无任何 sheet");
    process.exit(1);
  }
  const sheet = wb.Sheets[sheetName]!;
  const rawRows = XLSX.utils.sheet_to_json<ExcelRow>(sheet, { defval: "" });
  console.log(`Excel 共 ${rawRows.length} 行 (sheet="${sheetName}")\n`);

  // 1) 按媒体名 groupby
  interface OutletGroup {
    name: string;
    tier: string | null;
    groupName: string | null;
    region: string | null;
    district: string | null;
    industry: string | null;
    description: string | null;
    isActive: boolean;
    channels: Channel[];
    rowsWithUnknownPlatform: number;
  }
  const groups = new Map<string, OutletGroup>();

  for (const r of rawRows) {
    const name = norm(r.媒体名);
    if (!name) continue;

    const tierLabel = norm(r.分级);
    const tier = TIER_LABEL_TO_ENUM[tierLabel] ?? null;
    const groupName = norm(r["集团/上级单位"] || r.集团) || null;
    const region = norm(r.区域) || null;
    const district = norm(r.区县) || null;
    const industry = norm(r.行业) || null;
    const description = norm(r.描述) || null;
    const isActive = norm(r.状态) !== "停用";

    let g = groups.get(name);
    if (!g) {
      g = {
        name,
        tier,
        groupName,
        region,
        district,
        industry,
        description,
        isActive,
        channels: [],
        rowsWithUnknownPlatform: 0,
      };
      groups.set(name, g);
    } else {
      // 多行重复元数据时,以非空值覆盖
      if (tier && !g.tier) g.tier = tier;
      if (groupName && !g.groupName) g.groupName = groupName;
      if (region && !g.region) g.region = region;
      if (district && !g.district) g.district = district;
      if (industry && !g.industry) g.industry = industry;
      if (description && !g.description) g.description = description;
      if (norm(r.状态) === "停用") g.isActive = false;
    }

    // 解析 channel
    const platformLabel = norm(r.平台);
    if (!platformLabel) continue; // 空 outlet 行

    const platform = PLATFORM_LABEL_TO_TYPE[platformLabel];
    if (!platform) {
      g.rowsWithUnknownPlatform++;
      continue;
    }

    const nickname = norm(r.账号名);
    const identifier = norm(r.识别符);
    const url = norm(r["主页 URL"]);

    const ch = buildChannel(platform, nickname, identifier, url, name);
    if (ch) g.channels.push(ch);
    else {
      console.warn(`  ⚠️  无法构造 channel: "${name}" 平台=${platformLabel} 缺识别符且 URL 无法解析`);
    }
  }

  console.log(`媒体合并后 ${groups.size} 个 outlet\n`);

  // 2) UPSERT 每个 outlet
  const allOutlets = await db.select().from(mediaOutletDictionary);
  const outletByName = new Map(allOutlets.map((o) => [o.outletName, o]));
  const defaultOrgId = allOutlets[0]?.organizationId;
  if (!defaultOrgId && !dryRun) {
    throw new Error("DB 没有任何 outlet,无法推断 organizationId");
  }

  const stats = {
    existingMatched: 0,
    newInserted: 0,
    skippedNoChange: 0,
    channelsAdded: 0,
    channelsDuplicate: 0,
    deactivated: 0,
    addedByPlatform: { website: 0, wechat_oa: 0, douyin: 0, weibo: 0, kuaishou: 0 } as Record<ChannelType, number>,
  };

  for (const [name, g] of groups) {
    // 校验 channels(zod)
    const parse = channelsArraySchema.safeParse(g.channels);
    if (!parse.success) {
      console.warn(`  ⚠️  "${name}" channel 校验失败:${parse.error.issues[0]?.message}`);
      continue;
    }

    const existing = outletByName.get(name);

    if (existing) {
      stats.existingMatched++;
      // ADD-ONLY 合并 channels
      const existingChannels = (existing.channels ?? []) as Channel[];
      const existingKeys = new Set(existingChannels.map(channelKey));
      const merged = [...existingChannels];
      let added = 0;
      let dupes = 0;
      for (const ch of g.channels) {
        const k = channelKey(ch);
        if (existingKeys.has(k)) {
          dupes++;
          continue;
        }
        merged.push(ch);
        existingKeys.add(k);
        added++;
        stats.addedByPlatform[ch.type]++;
      }
      stats.channelsAdded += added;
      stats.channelsDuplicate += dupes;

      // 状态变更
      const deactivating = existing.isActive && !g.isActive;
      if (deactivating) stats.deactivated++;

      if (added === 0 && !deactivating && existing.isActive === g.isActive) {
        stats.skippedNoChange++;
        continue;
      }

      if (!dryRun) {
        await db
          .update(mediaOutletDictionary)
          .set({
            channels: merged,
            groupName: g.groupName ?? existing.groupName,
            outletRegion: g.region ?? existing.outletRegion,
            outletDistrict: g.district ?? existing.outletDistrict,
            industryTag: g.industry ?? existing.industryTag,
            description: g.description ?? existing.description,
            isActive: g.isActive,
            updatedAt: new Date(),
          })
          .where(eq(mediaOutletDictionary.id, existing.id));
      }
    } else {
      // INSERT
      if (!g.tier) {
        console.warn(`  ⚠️  跳过新 outlet "${name}":缺"分级"列`);
        continue;
      }
      stats.newInserted++;

      // 去重 channels(Excel 内部可能有重复行)
      const seen = new Set<string>();
      const dedupedChannels = g.channels.filter((c) => {
        const k = channelKey(c);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      stats.channelsAdded += dedupedChannels.length;
      stats.channelsDuplicate += g.channels.length - dedupedChannels.length;
      for (const ch of dedupedChannels) stats.addedByPlatform[ch.type]++;

      console.log(
        `  ➕ 新 outlet: ${name} (tier=${g.tier}, +${dedupedChannels.length} channels)`,
      );

      if (!dryRun && defaultOrgId) {
        await db.insert(mediaOutletDictionary).values({
          organizationId: defaultOrgId,
          outletName: g.name,
          groupName: g.groupName,
          outletTier: g.tier,
          outletRegion: g.region,
          outletDistrict: g.district,
          industryTag: g.industry,
          description: g.description,
          isActive: g.isActive,
          channels: dedupedChannels,
        });
      }
    }
  }

  // 3) 统计
  console.log("\n━━━ 导入结果 ━━━");
  console.log(`已存在 outlet:    ${stats.existingMatched} 个`);
  console.log(`新增 outlet:      ${stats.newInserted} 个`);
  console.log(`无变化:           ${stats.skippedNoChange} 个`);
  console.log(`停用切换:         ${stats.deactivated} 个`);
  console.log(`\n新加 channels:    ${stats.channelsAdded} 条`);
  console.log(`跳过的重复:       ${stats.channelsDuplicate} 条`);
  console.log("按平台新加:");
  for (const [t, n] of Object.entries(stats.addedByPlatform)) {
    if (n > 0) console.log(`  ${t.padEnd(12)} +${n}`);
  }

  if (dryRun) {
    console.log("\n(DRY RUN — 没写库)");
  } else {
    console.log("\n✅ 完成");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Import failed:", err);
  process.exit(1);
});

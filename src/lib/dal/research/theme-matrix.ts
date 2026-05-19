// src/lib/dal/research/theme-matrix.ts
//
// Excel 主题统计三维表 DAL — (区县 × 主题词 × outlet × channel) 聚合。
//
// 输出口径(per 客户 2026-05-19 Excel 模板"3.主题重复报道数量统计表"):
//   - 区县:     research_collected_item_districts ⇄ cq_districts (41 个)
//   - 主题词:   research_collected_item_topics    ⇄ research_topics (16 个)
//   - 媒体源:   collected_items.outlet_id         ⇄ media_outlet_dictionary
//   - 渠道拆分: jsonb_array_elements(source_channels) -> 微信/微博/抖音... 分别计 1
//
// 去重: 同一稿件 + 同一渠道 = 1 次(COUNT(DISTINCT ci.id) GROUP BY channel)。
// 跑前置: research-backfill-annotate 完成后再调本 DAL，否则 annotation 表空。

import { and, eq, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { collectedItems } from "@/db/schema/collection";
import { mediaOutletDictionary } from "@/db/schema/media-outlet-dictionary";
import { cqDistricts } from "@/db/schema/research/cq-districts";
import { researchTopics } from "@/db/schema/research/research-topics";
import {
  researchCollectedItemDistricts,
  researchCollectedItemTopics,
} from "@/db/schema/research/annotations";
import { formatChannelLabel } from "@/lib/collection/constants";

export interface ThemeMatrixFilter {
  organizationId: string;
  publishedAtFrom?: Date;
  publishedAtTo?: Date;
  /** true 时 published_at IS NULL 的稿件也计入(默认排除) */
  includeUndated?: boolean;
}

export interface ThemeMatrixCell {
  districtId: string;
  districtName: string;
  topicId: string;
  topicName: string;
  outletId: string | null;
  outletName: string | null;
  outletTier: string | null;
  outletDistrict: string | null;
  /** 原始渠道 slug, 如 tikhub_weibo / tophub/微博 / rss/host.com */
  channelSlug: string;
  /** 可读 label, 如 微博 / 微信公众号 / 网站(RSS) */
  channelLabel: string;
  count: number;
}

/**
 * 跑 (区县 × 主题词 × outlet × channel) 四维 group-by 聚合。
 *
 * @example
 *   const cells = await computeThemeMatrix({
 *     organizationId: orgId,
 *     publishedAtFrom: new Date("2025-01-01"),
 *     publishedAtTo: new Date("2025-12-31"),
 *   });
 *   // 在调用方做透视: row=区县, col=outlet+channel, 主题词另开 sheet 或维度
 */
export async function computeThemeMatrix(
  filter: ThemeMatrixFilter,
): Promise<ThemeMatrixCell[]> {
  const conditions: SQL[] = [eq(collectedItems.organizationId, filter.organizationId)];
  if (filter.publishedAtFrom) {
    conditions.push(sql`${collectedItems.publishedAt} >= ${filter.publishedAtFrom}`);
  }
  if (filter.publishedAtTo) {
    conditions.push(sql`${collectedItems.publishedAt} <= ${filter.publishedAtTo}`);
  }
  if (!filter.includeUndated) {
    conditions.push(sql`${collectedItems.publishedAt} IS NOT NULL`);
  }
  const whereExpr = and(...conditions);

  const rows = await db
    .select({
      districtId: researchCollectedItemDistricts.districtId,
      districtName: cqDistricts.name,
      topicId: researchCollectedItemTopics.topicId,
      topicName: researchTopics.name,
      outletId: collectedItems.outletId,
      outletName: mediaOutletDictionary.outletName,
      outletTier: mediaOutletDictionary.outletTier,
      outletDistrict: mediaOutletDictionary.outletDistrict,
      channelSlug: sql<string>`sc->>'channel'`,
      count: sql<number>`COUNT(DISTINCT ${collectedItems.id})::int`,
    })
    .from(collectedItems)
    .innerJoin(
      researchCollectedItemTopics,
      eq(researchCollectedItemTopics.collectedItemId, collectedItems.id),
    )
    .innerJoin(
      researchTopics,
      eq(researchTopics.id, researchCollectedItemTopics.topicId),
    )
    .innerJoin(
      researchCollectedItemDistricts,
      eq(researchCollectedItemDistricts.collectedItemId, collectedItems.id),
    )
    .innerJoin(
      cqDistricts,
      eq(cqDistricts.id, researchCollectedItemDistricts.districtId),
    )
    .leftJoin(
      mediaOutletDictionary,
      and(
        eq(mediaOutletDictionary.id, collectedItems.outletId),
        eq(mediaOutletDictionary.organizationId, collectedItems.organizationId),
      ),
    )
    .innerJoin(
      // LATERAL unnest source_channels[*]. 写入侧保证至少 1 个 entry,所以 INNER JOIN 安全。
      sql`LATERAL jsonb_array_elements(${collectedItems.sourceChannels}) AS sc`,
      sql`TRUE`,
    )
    .where(whereExpr)
    .groupBy(
      researchCollectedItemDistricts.districtId,
      cqDistricts.name,
      researchCollectedItemTopics.topicId,
      researchTopics.name,
      collectedItems.outletId,
      mediaOutletDictionary.outletName,
      mediaOutletDictionary.outletTier,
      mediaOutletDictionary.outletDistrict,
      sql`sc->>'channel'`,
    )
    .orderBy(
      cqDistricts.name,
      researchTopics.name,
      sql`${mediaOutletDictionary.outletName} NULLS LAST`,
      sql`sc->>'channel'`,
    );

  return rows.map((r) => ({
    districtId: r.districtId,
    districtName: r.districtName,
    topicId: r.topicId,
    topicName: r.topicName,
    outletId: r.outletId,
    outletName: r.outletName,
    outletTier: r.outletTier,
    outletDistrict: r.outletDistrict,
    channelSlug: r.channelSlug,
    channelLabel: formatChannelLabel(r.channelSlug),
    count: r.count,
  }));
}

/**
 * 把 computeThemeMatrix 输出按 Excel 模板 1:1 透视:
 *   行: (区县, 主题词)
 *   列: outletName(若为区县融媒/区县政务则按 tier 汇总,不细分到具体 outlet)
 *   单元格: 跨 channel 求和
 *
 * Excel "区县融媒体" "区县生态环境局" 是 1 列 — 在客户端透视时把对应 tier 的所有 outlet 求和。
 */
export function pivotForExcelTemplate(cells: ThemeMatrixCell[]): Map<
  string, // `${districtName}__${topicName}__${outletKey}`
  number
> {
  const m = new Map<string, number>();
  for (const c of cells) {
    // outletKey: 央/市/行业 用具体 outletName;区县融媒/政务 用 tier(整列汇总)
    const outletKey =
      c.outletTier === "district_media"
        ? "__DISTRICT_MEDIA__"
        : c.outletTier === "government_self_media"
          ? "__GOV_SELF_MEDIA__"
          : (c.outletName ?? "__UNCLASSIFIED__");
    const key = `${c.districtName}__${c.topicName}__${outletKey}`;
    m.set(key, (m.get(key) ?? 0) + c.count);
  }
  return m;
}

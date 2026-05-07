// src/lib/research/report-aggregator.ts
//
// A5 Phase 2 — 报告聚合器
//
// 基于 hitItemIds 计算 4 维 group-by 聚合 + 累计趋势，输出 AggregatesJson。
// 4 维：媒体层级 / 区县 / 主题 / 日趋势（含累计）。
//
// 设计要点：
//  - 多租户安全：所有 SQL 强制 `eq(collectedItems.organizationId, orgId)` + `inArray(id, hitItemIds)`
//  - Drizzle query builder（无原始 SQL 字符串拼接，避免注入）
//  - 4 维并行（Promise.all）缩短 DB roundtrip 总延迟
//  - 空 hitItemIds → 直接返回零态，不查 DB
//  - HIT_ITEMS_ALL_DELETED：传入了 ID 但全部已被删 → 抛错（数据漂移由调用方 step 1 兜底）
//  - topMediaNames per tier 限制 3 个 distinct
//  - dailyTrend 累计单调递增
//
// 引用：
//  - spec §3.3 AggregatesJson + §4.1 Step 1 load+aggregate
//  - plan Phase 2 lines 522-832

import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { collectedItems } from "@/db/schema/collection";
import {
  researchCollectedItemDistricts,
  researchCollectedItemTopics,
} from "@/db/schema/research/annotations";
import { cqDistricts } from "@/db/schema/research/cq-districts";
import { researchTopics } from "@/db/schema/research/research-topics";
import { mediaOutletDictionary } from "@/db/schema/media-outlet-dictionary";
import type { AggregatesJson } from "@/db/schema/research/reports";

const TOP_N_PER_GROUP = 3;

/**
 * 基于 hitItemIds 跑 4 维聚合：媒体层级 / 区县 / 主题 / 时间趋势(日)。
 *
 * @param organizationId   多租户 scope
 * @param hitItemIds       collected_items.id 列表（≤ 500）；空 → 零态
 * @returns AggregatesJson
 * @throws  Error("HIT_ITEMS_ALL_DELETED") 当 hitItemIds 非空但全部不存在 / 不属于该 org
 */
export async function computeReportAggregates(
  organizationId: string,
  hitItemIds: string[],
): Promise<AggregatesJson> {
  if (hitItemIds.length === 0) {
    return emptyAggregates();
  }

  // ── Step 0: 取出"还活着且属于本 org"的 items（做漂移过滤 + 拿 outletName 给 topMediaNames 用）
  // leftJoin mediaOutletDictionary 用 outletId（非 FK，但 col exist）
  const aliveRows = await db
    .select({
      id: collectedItems.id,
      outletTier: collectedItems.outletTier,
      outletName: mediaOutletDictionary.outletName,
    })
    .from(collectedItems)
    .leftJoin(
      mediaOutletDictionary,
      and(
        eq(mediaOutletDictionary.id, collectedItems.outletId),
        eq(mediaOutletDictionary.organizationId, collectedItems.organizationId),
      ),
    )
    .where(
      and(
        eq(collectedItems.organizationId, organizationId),
        inArray(collectedItems.id, hitItemIds),
      ),
    );

  if (aliveRows.length === 0) {
    throw new Error("HIT_ITEMS_ALL_DELETED");
  }

  const liveIds = aliveRows.map((r) => r.id);
  const totalCount = liveIds.length;

  // ── 4 维并行（Promise.all 缩短延迟）
  const [tierGrouped, districtRows, topicRows, trendRows] = await Promise.all([
    // 1) 媒体层级
    db
      .select({
        tier: collectedItems.outletTier,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(collectedItems)
      .where(
        and(
          eq(collectedItems.organizationId, organizationId),
          inArray(collectedItems.id, liveIds),
        ),
      )
      .groupBy(collectedItems.outletTier),

    // 2) 区县（join annotations + districts，distinct 是为应对一个 item 多个 annotation 行）
    db
      .select({
        districtId: researchCollectedItemDistricts.districtId,
        districtName: cqDistricts.name,
        count: sql<number>`COUNT(DISTINCT ${researchCollectedItemDistricts.collectedItemId})::int`,
      })
      .from(researchCollectedItemDistricts)
      .innerJoin(
        cqDistricts,
        eq(cqDistricts.id, researchCollectedItemDistricts.districtId),
      )
      .where(inArray(researchCollectedItemDistricts.collectedItemId, liveIds))
      .groupBy(
        researchCollectedItemDistricts.districtId,
        cqDistricts.name,
      )
      .orderBy(sql`COUNT(*) DESC`),

    // 3) 主题
    db
      .select({
        topicId: researchCollectedItemTopics.topicId,
        topicName: researchTopics.name,
        count: sql<number>`COUNT(DISTINCT ${researchCollectedItemTopics.collectedItemId})::int`,
      })
      .from(researchCollectedItemTopics)
      .innerJoin(
        researchTopics,
        eq(researchTopics.id, researchCollectedItemTopics.topicId),
      )
      .where(inArray(researchCollectedItemTopics.collectedItemId, liveIds))
      .groupBy(researchCollectedItemTopics.topicId, researchTopics.name)
      .orderBy(sql`COUNT(*) DESC`),

    // 4) 日趋势：用 to_char 截断到 YYYY-MM-DD（按 publishedAt；NULL 不进趋势图）
    db
      .select({
        date: sql<string>`to_char(${collectedItems.publishedAt}, 'YYYY-MM-DD')`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(collectedItems)
      .where(
        and(
          eq(collectedItems.organizationId, organizationId),
          inArray(collectedItems.id, liveIds),
          sql`${collectedItems.publishedAt} IS NOT NULL`,
        ),
      )
      .groupBy(sql`to_char(${collectedItems.publishedAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${collectedItems.publishedAt}, 'YYYY-MM-DD') ASC`),
  ]);

  // ── 拼装 mediaTierDistribution：每个 tier 取至多 3 个 distinct outletName
  const mediaTierDistribution = tierGrouped.map((r) => {
    const seen = new Set<string>();
    const topMediaNames: string[] = [];
    for (const row of aliveRows) {
      if (row.outletTier !== r.tier) continue;
      const name = row.outletName;
      if (!name || seen.has(name)) continue;
      seen.add(name);
      topMediaNames.push(name);
      if (topMediaNames.length >= TOP_N_PER_GROUP) break;
    }
    return {
      tier: r.tier ?? "未分类",
      count: r.count,
      percentage: round1((r.count * 100) / totalCount),
      topMediaNames,
    };
  });

  // ── 区县分布（topTopics 留作下游 cross-pivot 填补，初版返回空数组）
  const districtDistribution = districtRows.map((r) => ({
    districtId: r.districtId,
    districtName: r.districtName,
    count: r.count,
    percentage: round1((r.count * 100) / totalCount),
    topTopics: [] as string[],
  }));

  // ── 主题分布（topDistricts / topMedia 留空，cross-pivot 在 V2 填）
  const topicDistribution = topicRows.map((r) => ({
    topicId: r.topicId,
    topicName: r.topicName,
    count: r.count,
    percentage: round1((r.count * 100) / totalCount),
    topDistricts: [] as string[],
    topMedia: [] as string[],
  }));

  // ── 日趋势 + 累计
  let cumulative = 0;
  const dailyTrend = trendRows.map((r) => {
    cumulative += r.count;
    return { date: r.date, count: r.count, cumulative };
  });

  return {
    mediaTierDistribution,
    districtDistribution,
    topicDistribution,
    dailyTrend,
    hitCount: totalCount,
    isAiFallback: false,
    generatedAt: new Date().toISOString(),
  };
}

// ── helpers ────────────────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function emptyAggregates(): AggregatesJson {
  return {
    mediaTierDistribution: [],
    districtDistribution: [],
    topicDistribution: [],
    dailyTrend: [],
    hitCount: 0,
    isAiFallback: false,
    generatedAt: new Date().toISOString(),
  };
}

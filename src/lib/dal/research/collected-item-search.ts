import { and, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { collectedItems, collectedItemContents } from "@/db/schema/collection";
import {
  researchCollectedItemTopics,
  researchCollectedItemDistricts,
} from "@/db/schema/research/annotations";
import { mediaOutletDictionary } from "@/db/schema/media-outlet-dictionary";
import { getChannelMatchers } from "@/lib/collection/constants";
import type {
  AdvancedSearchCondition,
  SidebarFilter,
} from "@/app/(dashboard)/research/search-mode-types";

export interface CollectedItemSearchFilter {
  outletTier?: string | "unclassified";
  outletId?: string;
  outletRegion?: string;
  contentType?: string;
  publishedAtFrom?: Date;
  publishedAtTo?: Date;
  topicIds?: string[];
  districtIds?: string[];
  titleKeyword?: string;
  contentKeyword?: string;
  /** 限定 firstSeenSourceId ∈ sourceIds (取代历史的 research_news_articles 双写方案) */
  sourceIds?: string[];
  /**
   * 按可读渠道 label 过滤(微博 / 抖音 / 微信公众号 / 视频号 / 小红书 / 知乎 /
   * 快手 / 网站 / 热榜 / 搜索)。多 label 之间取并集(OR)。
   * 实际 SQL 由 getChannelMatchers 展开成 firstSeenChannel 的 exact + prefix
   * ILIKE 组合。
   */
  channelLabels?: string[];
}

export interface CollectedItemWithAnnotations {
  id: string;
  title: string;
  content: string | null;
  outletId: string | null;
  outletTier: string | null;
  outletRegion: string | null;
  outletName: string | null;
  publishedAt: Date | null;
  contentType: string;
  url: string | null;
  /** 首次采集到的渠道 slug,例如 tikhub_weibo / tophub/微博 / rss/host.com */
  firstSeenChannel: string;
  /** 全部命中此 item 的渠道列表(去重前的原始 jsonb,与 collectedItems.sourceChannels schema 对齐) */
  sourceChannels: Array<{
    channel: string;
    url?: string;
    sourceId: string;
    runId: string;
    capturedAt: string;
  }>;
}

function buildChannelLabelExpr(labels: string[] | undefined): SQL | undefined {
  if (!labels?.length) return undefined;
  const m = getChannelMatchers(labels);
  const parts: SQL[] = [];
  if (m.exact.length) parts.push(inArray(collectedItems.firstSeenChannel, m.exact));
  for (const p of m.prefix) {
    parts.push(ilike(collectedItems.firstSeenChannel, `${p}%`));
  }
  return parts.length ? or(...parts) : undefined;
}

export async function searchCollectedItemsForResearch(
  orgId: string,
  filter: CollectedItemSearchFilter,
  pagination: { limit: number; offset: number },
): Promise<{ items: CollectedItemWithAnnotations[]; total: number }> {
  const conditions = [eq(collectedItems.organizationId, orgId)];

  if (filter.outletTier === "unclassified") {
    conditions.push(sql`${collectedItems.outletTier} IS NULL`);
  } else if (filter.outletTier) {
    conditions.push(eq(collectedItems.outletTier, filter.outletTier));
  }
  if (filter.outletId) {
    conditions.push(eq(collectedItems.outletId, filter.outletId));
  }
  if (filter.outletRegion) {
    conditions.push(eq(collectedItems.outletRegion, filter.outletRegion));
  }
  if (filter.contentType) {
    conditions.push(eq(collectedItems.contentType, filter.contentType));
  }
  if (filter.titleKeyword) {
    conditions.push(ilike(collectedItems.title, `%${filter.titleKeyword}%`));
  }
  if (filter.contentKeyword) {
    // 正文已拆到副表 — EXISTS 子查询命中 trigram GIN(副表索引)
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM collected_item_contents cic
        WHERE cic.item_id = ${collectedItems.id}
          AND cic.content ILIKE ${"%" + filter.contentKeyword + "%"}
      )`,
    );
  }
  if (filter.publishedAtFrom) {
    conditions.push(
      sql`${collectedItems.publishedAt} >= ${filter.publishedAtFrom}`,
    );
  }
  if (filter.publishedAtTo) {
    conditions.push(
      sql`${collectedItems.publishedAt} <= ${filter.publishedAtTo}`,
    );
  }
  if (filter.sourceIds?.length) {
    conditions.push(inArray(collectedItems.firstSeenSourceId, filter.sourceIds));
  }
  const channelExpr = buildChannelLabelExpr(filter.channelLabels);
  if (channelExpr) conditions.push(channelExpr);

  // topic / district 过滤 — 用 EXISTS 子查询避免 leftJoin 引起重复行
  if (filter.topicIds?.length) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${researchCollectedItemTopics} cit
        WHERE cit.collected_item_id = ${collectedItems.id}
          AND cit.topic_id IN (${sql.join(
            filter.topicIds.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})
      )`,
    );
  }
  if (filter.districtIds?.length) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${researchCollectedItemDistricts} cid
        WHERE cid.collected_item_id = ${collectedItems.id}
          AND cid.district_id IN (${sql.join(
            filter.districtIds.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})
      )`,
    );
  }

  const where = and(...conditions);

  const items = await db
    .select({
      id: collectedItems.id,
      title: collectedItems.title,
      // 正文走副表 LEFT JOIN — 列表场景未必都需要 content,但保留原 API 兼容下游(下次重构可再拆出"详情/列表"两种 query)
      content: collectedItemContents.content,
      outletId: collectedItems.outletId,
      outletTier: collectedItems.outletTier,
      outletRegion: collectedItems.outletRegion,
      outletName: mediaOutletDictionary.outletName,
      publishedAt: collectedItems.publishedAt,
      contentType: collectedItems.contentType,
      url: collectedItems.canonicalUrl,
      firstSeenChannel: collectedItems.firstSeenChannel,
      sourceChannels: collectedItems.sourceChannels,
    })
    .from(collectedItems)
    .leftJoin(
      mediaOutletDictionary,
      eq(collectedItems.outletId, mediaOutletDictionary.id),
    )
    .leftJoin(
      collectedItemContents,
      eq(collectedItemContents.itemId, collectedItems.id),
    )
    .where(where)
    .orderBy(sql`${collectedItems.publishedAt} DESC NULLS LAST`)
    .limit(pagination.limit)
    .offset(pagination.offset);

  const [countRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(collectedItems)
    .where(where);

  return { items, total: countRow?.count ?? 0 };
}

// ───────────────────────────────────────────────────────────
// A4 高级检索：advancedSearchCollectedItems
// 11 字段 + 5 操作符 + drizzle and()/or() 嵌套实现 SQL 左结合
// + sidebarFilter 各组独立 OR-bracket（跨组 AND）
// + organizationId 强制 + ≤10 conditions 校验
// ───────────────────────────────────────────────────────────

export async function advancedSearchCollectedItems(
  orgId: string,
  conditions: AdvancedSearchCondition[],
  pagination: { limit: number; offset: number },
  sidebarFilter?: SidebarFilter,
): Promise<{ items: CollectedItemWithAnnotations[]; total: number }> {
  if (conditions.length > 10) throw new Error("conditions exceed max 10");

  const sidebarExprs = buildSidebarExprs(sidebarFilter);
  if (conditions.length === 0 && sidebarExprs.length === 0) {
    return { items: [], total: 0 };
  }

  // 必备：org 隔离
  const orgScope: SQL = eq(collectedItems.organizationId, orgId);

  // 拼接用户 conditions 为 SQL 表达式（左结合）
  let userExpr: SQL | undefined;
  if (conditions.length > 0) {
    userExpr = buildSingleCondition(conditions[0]!);
    for (let i = 1; i < conditions.length; i++) {
      const op = conditions[i - 1]!.logic;
      const next = buildSingleCondition(conditions[i]!);
      userExpr = op === "and" ? and(userExpr!, next)! : or(userExpr!, next)!;
    }
  }

  // sidebar 每组单独 OR-bracket（保留分组），再与 userExpr 一起 AND
  const allParts: SQL[] = [orgScope, ...sidebarExprs];
  if (userExpr) allParts.push(userExpr);
  const finalExpr: SQL = and(...allParts)!;

  const items = await db
    .select({
      id: collectedItems.id,
      title: collectedItems.title,
      content: collectedItemContents.content,
      outletId: collectedItems.outletId,
      outletTier: collectedItems.outletTier,
      outletRegion: collectedItems.outletRegion,
      outletName: mediaOutletDictionary.outletName,
      publishedAt: collectedItems.publishedAt,
      contentType: collectedItems.contentType,
      url: collectedItems.canonicalUrl,
      firstSeenChannel: collectedItems.firstSeenChannel,
      sourceChannels: collectedItems.sourceChannels,
    })
    .from(collectedItems)
    .leftJoin(
      mediaOutletDictionary,
      eq(collectedItems.outletId, mediaOutletDictionary.id),
    )
    .leftJoin(
      collectedItemContents,
      eq(collectedItemContents.itemId, collectedItems.id),
    )
    .where(finalExpr)
    .orderBy(sql`${collectedItems.publishedAt} DESC NULLS LAST`)
    .limit(pagination.limit)
    .offset(pagination.offset);

  const [countRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(collectedItems)
    .where(finalExpr);

  return { items, total: countRow?.count ?? 0 };
}

/**
 * 把 SidebarFilter 各组转成独立 SQL OR-bracket，跨组 AND。
 * 这样可以保留分组语义，避免线性化 AND/OR 串导致的优先级丢失。
 */
function buildSidebarExprs(s?: SidebarFilter): SQL[] {
  if (!s) return [];
  const out: SQL[] = [];
  if (s.outletTiers?.length) {
    out.push(or(...s.outletTiers.map((t) => eq(collectedItems.outletTier, t)))!);
  }
  if (s.contentTypes?.length) {
    out.push(or(...s.contentTypes.map((t) => eq(collectedItems.contentType, t)))!);
  }
  if (s.districtIds?.length) {
    const districtOrs = s.districtIds.map(
      (id) =>
        sql`EXISTS (SELECT 1 FROM ${researchCollectedItemDistricts} cid WHERE cid.collected_item_id = ${collectedItems.id} AND cid.district_id = ${id}::uuid)`,
    );
    out.push(or(...districtOrs)!);
  }
  if (s.topicIds?.length) {
    const topicOrs = s.topicIds.map(
      (id) =>
        sql`EXISTS (SELECT 1 FROM ${researchCollectedItemTopics} cit WHERE cit.collected_item_id = ${collectedItems.id} AND cit.topic_id = ${id}::uuid)`,
    );
    out.push(or(...topicOrs)!);
  }
  if (s.publishedAtRange) {
    out.push(
      sql`${collectedItems.publishedAt} BETWEEN ${new Date(s.publishedAtRange.from).toISOString()}::timestamptz AND ${new Date(s.publishedAtRange.to).toISOString()}::timestamptz`,
    );
  }
  if (s.sourceIds?.length) {
    out.push(inArray(collectedItems.firstSeenSourceId, s.sourceIds));
  }
  return out;
}

function buildSingleCondition(c: AdvancedSearchCondition): SQL {
  switch (c.field) {
    case "title":
      return c.operator === "contains"
        ? ilike(collectedItems.title, `%${c.value}%`)
        : sql`(${collectedItems.title} NOT ILIKE ${`%${c.value}%`} OR ${collectedItems.title} IS NULL)`;
    case "content":
      // 正文已拆到副表 collected_item_contents
      return c.operator === "contains"
        ? sql`EXISTS (
            SELECT 1 FROM collected_item_contents cic
            WHERE cic.item_id = ${collectedItems.id} AND cic.content ILIKE ${`%${c.value}%`}
          )`
        : sql`NOT EXISTS (
            SELECT 1 FROM collected_item_contents cic
            WHERE cic.item_id = ${collectedItems.id} AND cic.content ILIKE ${`%${c.value}%`}
          )`;
    case "author":
      return c.operator === "contains"
        ? sql`${collectedItems.rawMetadata}->>'author' ILIKE ${`%${c.value}%`}`
        : sql`(${collectedItems.rawMetadata}->>'author' NOT ILIKE ${`%${c.value}%`} OR ${collectedItems.rawMetadata}->>'author' IS NULL)`;
    case "outletName":
      return c.operator === "contains"
        ? sql`EXISTS (SELECT 1 FROM ${mediaOutletDictionary} mod WHERE mod.id = ${collectedItems.outletId} AND mod.outlet_name ILIKE ${`%${c.value}%`})`
        : sql`(NOT EXISTS (SELECT 1 FROM ${mediaOutletDictionary} mod WHERE mod.id = ${collectedItems.outletId} AND mod.outlet_name ILIKE ${`%${c.value}%`}) OR ${collectedItems.outletId} IS NULL)`;
    case "outletTier":
      if (c.value === "unclassified") return sql`${collectedItems.outletTier} IS NULL`;
      return c.operator === "equals"
        ? eq(collectedItems.outletTier, c.value)
        : sql`(${collectedItems.outletTier} != ${c.value} OR ${collectedItems.outletTier} IS NULL)`;
    case "outletRegion":
      return c.operator === "equals"
        ? eq(collectedItems.outletRegion, c.value)
        : sql`(${collectedItems.outletRegion} != ${c.value} OR ${collectedItems.outletRegion} IS NULL)`;
    case "contentType":
      return c.operator === "equals"
        ? eq(collectedItems.contentType, c.value)
        : sql`${collectedItems.contentType} != ${c.value}`;
    case "platform":
      return c.operator === "equals"
        ? eq(collectedItems.firstSeenChannel, c.value)
        : sql`${collectedItems.firstSeenChannel} != ${c.value}`;
    case "district":
      return c.operator === "equals"
        ? sql`EXISTS (SELECT 1 FROM ${researchCollectedItemDistricts} cid WHERE cid.collected_item_id = ${collectedItems.id} AND cid.district_id = ${c.value}::uuid)`
        : sql`NOT EXISTS (SELECT 1 FROM ${researchCollectedItemDistricts} cid WHERE cid.collected_item_id = ${collectedItems.id} AND cid.district_id = ${c.value}::uuid)`;
    case "topic":
      return c.operator === "equals"
        ? sql`EXISTS (SELECT 1 FROM ${researchCollectedItemTopics} cit WHERE cit.collected_item_id = ${collectedItems.id} AND cit.topic_id = ${c.value}::uuid)`
        : sql`NOT EXISTS (SELECT 1 FROM ${researchCollectedItemTopics} cit WHERE cit.collected_item_id = ${collectedItems.id} AND cit.topic_id = ${c.value}::uuid)`;
    case "publishedAt": {
      if (!c.valueRange) throw new Error("publishedAt requires valueRange");
      // postgres-js BETWEEN 需要 timestamp 字面量，把 Date 转 ISO 字符串再 ::timestamptz 转换
      return sql`${collectedItems.publishedAt} BETWEEN ${new Date(c.valueRange.from).toISOString()}::timestamptz AND ${new Date(c.valueRange.to).toISOString()}::timestamptz`;
    }
  }
}

/**
 * Phase 8 Task 8.3 — "生成报告"入口专用：
 * 仅 SELECT id + 全量返回（≤ limit 条），不分页，不带 outlet/title/content。
 *
 * 复用 advancedSearchCollectedItems 内部相同的 expr composition 逻辑
 * （buildSidebarExprs + buildSingleCondition），保证检索语义一致。
 *
 * 用于把当前高级检索条件命中的全量 itemIds（最多 500）一次性回传给
 * createReportFromSearch；前端只需要 conditions + sidebarFilter，无需依赖
 * 列表分页态。
 */
export async function fetchAllHitItemIdsForReport(
  orgId: string,
  conditions: AdvancedSearchCondition[],
  sidebarFilter: SidebarFilter | undefined,
  limit: number = 500,
): Promise<string[]> {
  if (conditions.length > 10) throw new Error("conditions exceed max 10");

  const sidebarExprs = buildSidebarExprs(sidebarFilter);
  if (conditions.length === 0 && sidebarExprs.length === 0) return [];

  const orgScope: SQL = eq(collectedItems.organizationId, orgId);

  let userExpr: SQL | undefined;
  if (conditions.length > 0) {
    userExpr = buildSingleCondition(conditions[0]!);
    for (let i = 1; i < conditions.length; i++) {
      const op = conditions[i - 1]!.logic;
      const next = buildSingleCondition(conditions[i]!);
      userExpr = op === "and" ? and(userExpr!, next)! : or(userExpr!, next)!;
    }
  }

  const allParts: SQL[] = [orgScope, ...sidebarExprs];
  if (userExpr) allParts.push(userExpr);
  const finalExpr: SQL = and(...allParts)!;

  const rows = await db
    .select({ id: collectedItems.id })
    .from(collectedItems)
    .where(finalExpr)
    .orderBy(sql`${collectedItems.publishedAt} DESC NULLS LAST`)
    .limit(limit);
  return rows.map((r) => r.id);
}

import { db } from "@/db";
import {
  collectedItems,
  collectionSources,
  collectionRuns,
  collectionLogs,
  hotTopics,
} from "@/db/schema";
import type { InferSelectModel } from "drizzle-orm";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";

export type CollectedItemRow = InferSelectModel<typeof collectedItems>;

// ────────────────────────────────────────────────
// 筛选 + 分页
// ────────────────────────────────────────────────

export interface ContentFilters {
  sourceType?: string;
  targetModule?: string;
  enrichmentStatus?: "pending" | "enriched" | "failed";
  sinceMs?: number; // 时间窗起始 epoch ms
  untilMs?: number; // 可选结束
  platformAlias?: string; // 匹配 first_seen_channel 或 source_channels[*].channel
  searchText?: string; // title + content ILIKE
}

export interface PaginationOpts {
  limit?: number;
  offset?: number;
}

export interface ListCollectedItemsResult {
  items: CollectedItemRow[];
  total: number;
}

export async function listCollectedItems(
  organizationId: string,
  filters: ContentFilters = {},
  pagination: PaginationOpts = {},
): Promise<ListCollectedItemsResult> {
  const limit = pagination.limit ?? 50;
  const offset = pagination.offset ?? 0;

  const conditions = [eq(collectedItems.organizationId, organizationId)];

  if (filters.sourceType) {
    // 需要 join collection_sources.sourceType
    const sourceIds = await db
      .select({ id: collectionSources.id })
      .from(collectionSources)
      .where(
        and(
          eq(collectionSources.organizationId, organizationId),
          eq(collectionSources.sourceType, filters.sourceType),
        ),
      );
    if (sourceIds.length === 0) {
      return { items: [], total: 0 };
    }
    conditions.push(inArray(collectedItems.firstSeenSourceId, sourceIds.map((r) => r.id)));
  }

  if (filters.targetModule) {
    // derived_modules 是 text[],用 array contains
    conditions.push(
      sql`${collectedItems.derivedModules} @> ARRAY[${filters.targetModule}]::text[]`,
    );
  }

  if (filters.enrichmentStatus) {
    conditions.push(eq(collectedItems.enrichmentStatus, filters.enrichmentStatus));
  }

  if (filters.sinceMs !== undefined) {
    conditions.push(gte(collectedItems.firstSeenAt, new Date(filters.sinceMs)));
  }
  if (filters.untilMs !== undefined) {
    conditions.push(
      sql`${collectedItems.firstSeenAt} <= ${new Date(filters.untilMs)}`,
    );
  }

  if (filters.platformAlias) {
    conditions.push(
      sql`(${collectedItems.firstSeenChannel} ILIKE ${`%/${filters.platformAlias}`} OR ${collectedItems.sourceChannels} @> ${JSON.stringify([{ channel: `tophub/${filters.platformAlias}` }])}::jsonb)`,
    );
  }

  if (filters.searchText) {
    const q = `%${filters.searchText}%`;
    conditions.push(
      sql`(${collectedItems.title} ILIKE ${q} OR ${collectedItems.content} ILIKE ${q})`,
    );
  }

  const rows = await db
    .select()
    .from(collectedItems)
    .where(and(...conditions))
    .orderBy(desc(collectedItems.firstSeenAt))
    .limit(limit)
    .offset(offset);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(collectedItems)
    .where(and(...conditions));

  return { items: rows, total: count };
}

// ────────────────────────────────────────────────
// 详情 + 派生反查
// ────────────────────────────────────────────────

export interface DerivedRecordSummary {
  module: "hot_topics" | "news" | "benchmarking" | "knowledge";
  recordId: string;
  title?: string;
  linkHref: string;
}

export async function getDerivedRecordsForItem(
  itemId: string,
  organizationId: string,
): Promise<DerivedRecordSummary[]> {
  const results: DerivedRecordSummary[] = [];

  // hot_topics (Phase 2 已建 FK)
  const ht = await db
    .select({ id: hotTopics.id, title: hotTopics.title })
    .from(hotTopics)
    .where(
      and(
        eq(hotTopics.organizationId, organizationId),
        eq(hotTopics.collectedItemId, itemId),
      ),
    );
  for (const r of ht) {
    results.push({
      module: "hot_topics",
      recordId: r.id,
      title: r.title,
      linkHref: `/inspiration?topicId=${r.id}`,
    });
  }

  // news_articles / platform_content / knowledge_items 的 FK 要到 Phase 5 才加

  return results;
}

export async function getCollectedItemDetail(
  itemId: string,
  organizationId: string,
): Promise<CollectedItemRow | null> {
  const [row] = await db
    .select()
    .from(collectedItems)
    .where(
      and(
        eq(collectedItems.id, itemId),
        eq(collectedItems.organizationId, organizationId),
      ),
    )
    .limit(1);
  return row ?? null;
}

// ────────────────────────────────────────────────
// 监控面板查询
// ────────────────────────────────────────────────

export interface MonitoringSummary {
  itemsLast24h: number;
  itemsLast7d: number;
  totalRunsLast24h: number;
  failedRunsLast24h: number;
  successRate24h: number; // 0..1
  activeSources: number;
  totalSources: number;
}

export async function getMonitoringSummary(
  organizationId: string,
): Promise<MonitoringSummary> {
  const now = Date.now();
  const since24h = new Date(now - 24 * 60 * 60 * 1000);
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const [items24] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(collectedItems)
    .where(
      and(
        eq(collectedItems.organizationId, organizationId),
        gte(collectedItems.firstSeenAt, since24h),
      ),
    );

  const [items7d] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(collectedItems)
    .where(
      and(
        eq(collectedItems.organizationId, organizationId),
        gte(collectedItems.firstSeenAt, since7d),
      ),
    );

  const [runs] = await db
    .select({
      total: sql<number>`count(*)::int`,
      failed: sql<number>`count(*) FILTER (WHERE ${collectionRuns.status} = 'failed')::int`,
    })
    .from(collectionRuns)
    .where(
      and(
        eq(collectionRuns.organizationId, organizationId),
        gte(collectionRuns.startedAt, since24h),
      ),
    );

  const [sources] = await db
    .select({
      total: sql<number>`count(*)::int`,
      active: sql<number>`count(*) FILTER (WHERE ${collectionSources.enabled} = true)::int`,
    })
    .from(collectionSources)
    .where(
      and(
        eq(collectionSources.organizationId, organizationId),
        sql`${collectionSources.deletedAt} IS NULL`,
      ),
    );

  const total24 = runs?.total ?? 0;
  const failed24 = runs?.failed ?? 0;
  return {
    itemsLast24h: items24?.c ?? 0,
    itemsLast7d: items7d?.c ?? 0,
    totalRunsLast24h: total24,
    failedRunsLast24h: failed24,
    successRate24h: total24 > 0 ? (total24 - failed24) / total24 : 1,
    activeSources: sources?.active ?? 0,
    totalSources: sources?.total ?? 0,
  };
}

export interface CollectionTrendPoint {
  date: string; // YYYY-MM-DD
  inserted: number;
  merged: number;
  failed: number;
}

export async function getCollectionTrend(
  organizationId: string,
  days = 7,
): Promise<CollectionTrendPoint[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      date: sql<string>`to_char(${collectionRuns.startedAt}, 'YYYY-MM-DD')`,
      inserted: sql<number>`sum(${collectionRuns.itemsInserted})::int`,
      merged: sql<number>`sum(${collectionRuns.itemsMerged})::int`,
      failed: sql<number>`sum(${collectionRuns.itemsFailed})::int`,
    })
    .from(collectionRuns)
    .where(
      and(
        eq(collectionRuns.organizationId, organizationId),
        gte(collectionRuns.startedAt, since),
      ),
    )
    .groupBy(sql`to_char(${collectionRuns.startedAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${collectionRuns.startedAt}, 'YYYY-MM-DD')`);

  return rows.map((r) => ({
    date: r.date,
    inserted: r.inserted ?? 0,
    merged: r.merged ?? 0,
    failed: r.failed ?? 0,
  }));
}

export interface SourceErrorSummary {
  sourceId: string;
  sourceName: string;
  sourceType: string;
  failedCount: number;
  partialCount: number;
  lastFailedAt: Date | null;
  lastErrorMessage: string | null;
}

export async function getSourceErrorList(
  organizationId: string,
  days = 7,
  limit = 10,
): Promise<SourceErrorSummary[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      sourceId: collectionRuns.sourceId,
      failed: sql<number>`count(*) FILTER (WHERE ${collectionRuns.status} = 'failed')::int`,
      partial: sql<number>`count(*) FILTER (WHERE ${collectionRuns.status} = 'partial')::int`,
      lastFailedAt: sql<Date | null>`max(${collectionRuns.finishedAt}) FILTER (WHERE ${collectionRuns.status} = 'failed')`,
      lastErrorMessage: sql<string | null>`(array_agg(${collectionRuns.errorSummary} ORDER BY ${collectionRuns.finishedAt} DESC) FILTER (WHERE ${collectionRuns.status} = 'failed'))[1]`,
    })
    .from(collectionRuns)
    .where(
      and(
        eq(collectionRuns.organizationId, organizationId),
        gte(collectionRuns.startedAt, since),
      ),
    )
    .groupBy(collectionRuns.sourceId)
    .orderBy(
      sql`count(*) FILTER (WHERE ${collectionRuns.status} = 'failed') DESC`,
    )
    .limit(limit);

  const sourceIds = rows.map((r) => r.sourceId);
  const sourceRows =
    sourceIds.length > 0
      ? await db
          .select({
            id: collectionSources.id,
            name: collectionSources.name,
            sourceType: collectionSources.sourceType,
          })
          .from(collectionSources)
          .where(inArray(collectionSources.id, sourceIds))
      : [];
  const nameMap = new Map(sourceRows.map((s) => [s.id, s]));

  return rows
    .filter((r) => (r.failed ?? 0) + (r.partial ?? 0) > 0)
    .map((r) => ({
      sourceId: r.sourceId,
      sourceName: nameMap.get(r.sourceId)?.name ?? "(已删除)",
      sourceType: nameMap.get(r.sourceId)?.sourceType ?? "?",
      failedCount: r.failed ?? 0,
      partialCount: r.partial ?? 0,
      lastFailedAt: r.lastFailedAt,
      lastErrorMessage: r.lastErrorMessage,
    }));
}

export interface RecentErrorRow {
  logId: number;
  loggedAt: Date;
  sourceId: string;
  sourceName: string;
  level: "info" | "warn" | "error";
  message: string;
}

export async function getRecentErrors(
  organizationId: string,
  limit = 30,
): Promise<RecentErrorRow[]> {
  const rows = await db
    .select({
      logId: collectionLogs.id,
      loggedAt: collectionLogs.loggedAt,
      sourceId: collectionLogs.sourceId,
      sourceName: collectionSources.name,
      level: collectionLogs.level,
      message: collectionLogs.message,
    })
    .from(collectionLogs)
    .innerJoin(collectionSources, eq(collectionLogs.sourceId, collectionSources.id))
    .where(
      and(
        eq(collectionSources.organizationId, organizationId),
        eq(collectionLogs.level, "error"),
      ),
    )
    .orderBy(desc(collectionLogs.loggedAt))
    .limit(limit);

  return rows.map((r) => ({
    logId: r.logId,
    loggedAt: r.loggedAt,
    sourceId: r.sourceId,
    sourceName: r.sourceName,
    level: r.level as "info" | "warn" | "error",
    message: r.message,
  }));
}

import { db } from "@/db";
import {
  collectionSources,
  collectionRuns,
  collectionLogs,
  collectedItems,
} from "@/db/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";

export type CollectionSourceRow = InferSelectModel<typeof collectionSources>;
export type CollectionRunRow = InferSelectModel<typeof collectionRuns>;
export type CollectionLogRow = InferSelectModel<typeof collectionLogs>;
export type CollectedItemRow = InferSelectModel<typeof collectedItems>;

export interface SourceListFilters {
  sourceType?: string;
  enabled?: boolean;
  targetModule?: string;
  searchName?: string;
}

/** 列出本组织的所有源(未软删除),按名称排序。 */
export async function listCollectionSources(
  organizationId: string,
  filters: SourceListFilters = {},
): Promise<CollectionSourceRow[]> {
  const conditions = [
    eq(collectionSources.organizationId, organizationId),
    isNull(collectionSources.deletedAt),
  ];
  if (filters.sourceType) {
    conditions.push(eq(collectionSources.sourceType, filters.sourceType));
  }
  if (typeof filters.enabled === "boolean") {
    conditions.push(eq(collectionSources.enabled, filters.enabled));
  }
  if (filters.searchName) {
    conditions.push(sql`${collectionSources.name} ILIKE ${"%" + filters.searchName + "%"}`);
  }
  const rows = await db
    .select()
    .from(collectionSources)
    .where(and(...conditions))
    .orderBy(collectionSources.name);

  if (filters.targetModule) {
    return rows.filter((r) => r.targetModules.includes(filters.targetModule!));
  }
  return rows;
}

/** 读取单个源,确保归属本组织(否则返回 null)。 */
export async function getCollectionSourceById(
  sourceId: string,
  organizationId: string,
): Promise<CollectionSourceRow | null> {
  const [row] = await db
    .select()
    .from(collectionSources)
    .where(
      and(
        eq(collectionSources.id, sourceId),
        eq(collectionSources.organizationId, organizationId),
        isNull(collectionSources.deletedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** 断言源归属本组织,不满足抛出。写操作前调用。 */
export async function assertSourceOwnership(
  sourceId: string,
  organizationId: string,
): Promise<CollectionSourceRow> {
  const row = await getCollectionSourceById(sourceId, organizationId);
  if (!row) throw new Error(`Source ${sourceId} not found or not in organization`);
  return row;
}

/** 列出某源最近的 N 次运行。 */
export async function listRecentRunsBySource(
  sourceId: string,
  organizationId: string,
  limit = 20,
): Promise<CollectionRunRow[]> {
  return db
    .select()
    .from(collectionRuns)
    .where(
      and(
        eq(collectionRuns.sourceId, sourceId),
        eq(collectionRuns.organizationId, organizationId),
      ),
    )
    .orderBy(desc(collectionRuns.startedAt))
    .limit(limit);
}

/** 列出某运行的日志。 */
export async function listLogsByRun(
  runId: string,
  limit = 200,
): Promise<CollectionLogRow[]> {
  return db
    .select()
    .from(collectionLogs)
    .where(eq(collectionLogs.runId, runId))
    .orderBy(desc(collectionLogs.loggedAt))
    .limit(limit);
}

/** 列出某源最近采集到的 items(仅首抓自该源的)。 */
export async function listRecentItemsBySource(
  sourceId: string,
  organizationId: string,
  limit = 20,
): Promise<CollectedItemRow[]> {
  return db
    .select()
    .from(collectedItems)
    .where(
      and(
        eq(collectedItems.organizationId, organizationId),
        eq(collectedItems.firstSeenSourceId, sourceId),
      ),
    )
    .orderBy(desc(collectedItems.firstSeenAt))
    .limit(limit);
}

/** 查询组织级的源统计概况。 */
export async function getOrgCollectionSummary(
  organizationId: string,
): Promise<{
  totalSources: number;
  enabledSources: number;
  totalItemsLast24h: number;
  failedRunsLast24h: number;
}> {
  const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [sources] = await db
    .select({
      total: sql<number>`count(*)::int`,
      enabled: sql<number>`count(*) FILTER (WHERE ${collectionSources.enabled} = true)::int`,
    })
    .from(collectionSources)
    .where(
      and(
        eq(collectionSources.organizationId, organizationId),
        isNull(collectionSources.deletedAt),
      ),
    );
  const [items] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(collectedItems)
    .where(
      and(
        eq(collectedItems.organizationId, organizationId),
        sql`${collectedItems.firstSeenAt} >= ${sinceIso}::timestamptz`,
      ),
    );
  const [runs] = await db
    .select({ failed: sql<number>`count(*)::int` })
    .from(collectionRuns)
    .where(
      and(
        eq(collectionRuns.organizationId, organizationId),
        eq(collectionRuns.status, "failed"),
        sql`${collectionRuns.startedAt} >= ${sinceIso}::timestamptz`,
      ),
    );
  return {
    totalSources: sources?.total ?? 0,
    enabledSources: sources?.enabled ?? 0,
    totalItemsLast24h: items?.count ?? 0,
    failedRunsLast24h: runs?.failed ?? 0,
  };
}

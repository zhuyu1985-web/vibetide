import { db } from "@/db";
import {
  collectedItems,
  collectedItemContents,
  collectionSources,
  collectionRuns,
  collectionLogs,
  hotTopics,
} from "@/db/schema";
import { mediaOutletDictionary } from "@/db/schema/media-outlet-dictionary";
import type { InferSelectModel } from "drizzle-orm";
import { and, desc, eq, getTableColumns, gte, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import {
  CHANNEL_BUCKET_ORDER,
  CHANNEL_BUCKET_SLUG,
  getChannelBucketMatcher,
  normalizeChannelBucketSlug,
} from "@/lib/collection/channel-bucket";

export type CollectedItemRow = InferSelectModel<typeof collectedItems>;

/** 详情行 = 主表全字段 + 副表 content/ocrText/asrText(可为 null,表示该 item 没有该种正文)。 */
export type CollectedItemDetailRow = CollectedItemRow & {
  content: string | null;
  ocrText: string | null;
  asrText: string | null;
};

/** CollectedItemRow extended with outlet name + source type joined. */
export type CollectedItemWithOutlet = CollectedItemRow & {
  outletName: string | null;
  /** Source type slug (rss / tophub / jina_url / list_scraper / tavily / tikhub / bocha) from collection_sources, joined via firstSeenSourceId. May be null if source was deleted. */
  sourceType: string | null;
};

// ────────────────────────────────────────────────
// 筛选 + 分页
// ────────────────────────────────────────────────

export interface ContentFilters {
  sourceType?: string;
  targetModule?: string;
  enrichmentStatus?: "pending" | "enriched" | "failed";
  sinceMs?: number; // 采集时间窗起始 epoch ms(作用在 first_seen_at)
  untilMs?: number; // 采集时间窗结束
  /** 发布时间范围(作用在 collected_items.published_at) */
  publishedSinceMs?: number;
  publishedUntilMs?: number;
  platformAlias?: string; // 匹配 first_seen_channel 或 source_channels[*].channel
  searchText?: string; // title + content + ocr + asr ILIKE
  // Outlet filters (Task 5.1)
  outletTier?: string | "unclassified"; // "unclassified" → IS NULL; any tier slug → exact match
  outletId?: string;
  outletRegion?: string;
  // category 改 text[] 后:单值匹配=数组 contains
  category?: string;
  tag?: string;      // 在 collected_items.tags (text[]) 内 contains

  // ── 舆情/账号维度(对齐 docs/data.xlsx) ──
  /** 平台中文归一名(微信/今日头条/微博/...) */
  platform?: string;
  /** 作者昵称(模糊匹配 ILIKE) */
  author?: string;
  /** 平台用户 ID 精确匹配 */
  accountId?: string;
  /** 情感倾向 */
  sentiment?: string;
  /** 信息类型(原创/转发) */
  infoType?: string;
  /** IP 属地省份 */
  ipRegion?: string;
  /** 发布地(前缀匹配,支持"重庆市" → 命中"重庆市,涪陵区") */
  postRegion?: string;
  /** 提及地命中(text[] @>) */
  mentionedRegion?: string;
  /** 命中关键词(text[] @>) */
  matchedKeyword?: string;
  /** 命中地域(text[] @>) */
  matchedRegion?: string;
  /** 行业命中(text[] @>;跟 category 数组共用 GIN) */
  industry?: string;
  /** 互动量下限(any-of: like >= N OR comment >= N OR ...) */
  minLikeCount?: number;
  minCommentCount?: number;
  minViewCount?: number;
}

export interface PaginationOpts {
  limit?: number;
  offset?: number;
}

export interface ListCollectedItemsResult {
  items: CollectedItemWithOutlet[];
  total: number;
}

function buildPlatformAliasCondition(platformAlias: string): SQL | undefined {
  const normalizedAlias = normalizeChannelBucketSlug(platformAlias);
  const matcher = getChannelBucketMatcher(normalizedAlias);
  if (!matcher) {
    const fallback = `%${platformAlias.trim()}%`;
    return sql`(${collectedItems.firstSeenChannel} ILIKE ${fallback} OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(${collectedItems.sourceChannels}) AS sc
      WHERE sc->>'channel' ILIKE ${fallback}
    ))`;
  }

  const parts: SQL[] = [];
  if (matcher.exact.length > 0) {
    parts.push(inArray(collectedItems.firstSeenChannel, matcher.exact));
    for (const ch of matcher.exact) {
      parts.push(sql`EXISTS (
        SELECT 1 FROM jsonb_array_elements(${collectedItems.sourceChannels}) AS sc
        WHERE sc->>'channel' = ${ch}
      )`);
    }
  }
  for (const prefix of matcher.prefix) {
    const pattern = `${prefix}%`;
    parts.push(ilike(collectedItems.firstSeenChannel, pattern));
    parts.push(sql`EXISTS (
      SELECT 1 FROM jsonb_array_elements(${collectedItems.sourceChannels}) AS sc
      WHERE sc->>'channel' ILIKE ${pattern}
    )`);
  }
  return parts.length > 0 ? or(...parts) : undefined;
}

export async function buildCollectedItemConditions(
  organizationId: string,
  filters: ContentFilters = {},
  options: { omitPlatformAlias?: boolean } = {},
): Promise<SQL[]> {
  const conditions: SQL[] = [eq(collectedItems.organizationId, organizationId)];

  if (filters.sourceType) {
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
      conditions.push(sql`false`);
    } else {
      conditions.push(inArray(collectedItems.firstSeenSourceId, sourceIds.map((r) => r.id)));
    }
  }

  if (filters.targetModule) {
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
  if (filters.publishedSinceMs !== undefined) {
    conditions.push(gte(collectedItems.publishedAt, new Date(filters.publishedSinceMs)));
  }
  if (filters.publishedUntilMs !== undefined) {
    conditions.push(
      sql`${collectedItems.publishedAt} <= ${new Date(filters.publishedUntilMs)}`,
    );
  }

  if (filters.platformAlias && !options.omitPlatformAlias) {
    const condition = buildPlatformAliasCondition(filters.platformAlias);
    if (condition) conditions.push(condition);
  }

  if (filters.searchText) {
    const q = `%${filters.searchText}%`;
    conditions.push(
      sql`(${collectedItems.title} ILIKE ${q} OR EXISTS (
        SELECT 1 FROM collected_item_contents cic
        WHERE cic.item_id = ${collectedItems.id}
          AND (cic.content ILIKE ${q} OR cic.ocr_text ILIKE ${q} OR cic.asr_text ILIKE ${q})
      ))`,
    );
  }

  if (filters.outletTier === "unclassified") {
    conditions.push(isNull(collectedItems.outletTier));
  } else if (filters.outletTier) {
    conditions.push(eq(collectedItems.outletTier, filters.outletTier));
  }
  if (filters.outletId) {
    conditions.push(eq(collectedItems.outletId, filters.outletId));
  }
  if (filters.outletRegion) {
    conditions.push(eq(collectedItems.outletRegion, filters.outletRegion));
  }
  if (filters.category) {
    conditions.push(sql`${collectedItems.category} @> ARRAY[${filters.category}]::text[]`);
  }
  if (filters.tag) {
    conditions.push(sql`${collectedItems.tags} @> ARRAY[${filters.tag}]::text[]`);
  }

  if (filters.platform) {
    conditions.push(eq(collectedItems.platform, filters.platform));
  }
  if (filters.author) {
    const q = `%${filters.author}%`;
    conditions.push(sql`(
      ${collectedItems.author} ILIKE ${q}
      OR ${collectedItems.platform} ILIKE ${q}
      OR ${collectedItems.rawMetadata}->>'source' ILIKE ${q}
      OR ${collectedItems.rawMetadata}->>'publicAccountName' ILIKE ${q}
    )`);
  }
  if (filters.accountId) {
    conditions.push(eq(collectedItems.accountId, filters.accountId));
  }
  if (filters.sentiment) {
    conditions.push(eq(collectedItems.sentiment, filters.sentiment));
  }
  if (filters.infoType) {
    conditions.push(eq(collectedItems.infoType, filters.infoType));
  }
  if (filters.ipRegion) {
    conditions.push(eq(collectedItems.ipRegion, filters.ipRegion));
  }
  if (filters.postRegion) {
    conditions.push(sql`${collectedItems.postRegion} LIKE ${filters.postRegion + "%"}`);
  }
  if (filters.mentionedRegion) {
    conditions.push(sql`${collectedItems.mentionedRegions} @> ARRAY[${filters.mentionedRegion}]::text[]`);
  }
  if (filters.matchedKeyword) {
    conditions.push(sql`${collectedItems.matchedKeywords} @> ARRAY[${filters.matchedKeyword}]::text[]`);
  }
  if (filters.matchedRegion) {
    conditions.push(sql`${collectedItems.matchedRegions} @> ARRAY[${filters.matchedRegion}]::text[]`);
  }
  if (filters.industry) {
    conditions.push(sql`${collectedItems.industries} @> ARRAY[${filters.industry}]::text[]`);
  }
  if (filters.minLikeCount !== undefined) {
    conditions.push(gte(collectedItems.likeCount, filters.minLikeCount));
  }
  if (filters.minCommentCount !== undefined) {
    conditions.push(gte(collectedItems.commentCount, filters.minCommentCount));
  }
  if (filters.minViewCount !== undefined) {
    conditions.push(gte(collectedItems.viewCount, filters.minViewCount));
  }

  return conditions;
}

export async function listCollectedItems(
  organizationId: string,
  filters: ContentFilters = {},
  pagination: PaginationOpts = {},
): Promise<ListCollectedItemsResult> {
  const limit = pagination.limit ?? 50;
  const offset = pagination.offset ?? 0;

  const conditions = await buildCollectedItemConditions(organizationId, filters);

  // 用 getTableColumns 拿全字段,避免每次新增列都要回来加一行 select
  const rows = await db
    .select({
      ...getTableColumns(collectedItems),
      // joined from dictionary
      outletName: mediaOutletDictionary.outletName,
      // joined from collection_sources (firstSeenSourceId)
      sourceType: collectionSources.sourceType,
    })
    .from(collectedItems)
    .leftJoin(mediaOutletDictionary, eq(collectedItems.outletId, mediaOutletDictionary.id))
    .leftJoin(collectionSources, eq(collectedItems.firstSeenSourceId, collectionSources.id))
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

export async function listCollectedItemChannelCounts(
  organizationId: string,
  filters: ContentFilters = {},
): Promise<Record<string, number>> {
  const baseConditions = await buildCollectedItemConditions(organizationId, filters, {
    omitPlatformAlias: true,
  });

  const entries = await Promise.all(
    CHANNEL_BUCKET_ORDER.map(async (bucket) => {
      const condition = buildPlatformAliasCondition(CHANNEL_BUCKET_SLUG[bucket]);
      if (!condition) return [bucket, 0] as const;

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(collectedItems)
        .where(and(...baseConditions, condition));

      return [bucket, count] as const;
    }),
  );

  return Object.fromEntries(entries);
}

// ────────────────────────────────────────────────
// 筛选候选项(给内容池 UI 的 Select 下拉用)
// ────────────────────────────────────────────────

export interface CollectedItemFilterOptions {
  categories: string[];          // collected_items.category 去重排序
  tags: string[];                // collected_items.tags 展开 + 去重 + 排序
  platforms: string[];           // collected_items.platform 去重(按使用次数 DESC)
  accounts: string[];            // author / raw_metadata.source / publicAccountName 去重
}

/**
 * 拉本 org 下 collected_items 已经出现过的 category / tag 候选值。
 * 给内容池 UI 的下拉框显示用。
 *
 * 注意:用 LIMIT 截断避免极端情况下数据量爆炸(候选项 > 500 时 UI 也没意义了)。
 */
export async function listCollectedItemFilterOptions(
  organizationId: string,
): Promise<CollectedItemFilterOptions> {
  const [categories, tags, platforms, accounts] = await Promise.all([
    db.execute<{ category: string }>(sql`
      SELECT DISTINCT unnest(category) AS category
      FROM collected_items
      WHERE organization_id = ${organizationId}::uuid
      ORDER BY category
      LIMIT 500
    `),
    db.execute<{ tag: string }>(sql`
      SELECT DISTINCT unnest(tags) AS tag
      FROM collected_items
      WHERE organization_id = ${organizationId}::uuid AND tags IS NOT NULL
      ORDER BY tag
      LIMIT 500
    `),
    // 平台按使用次数倒序(常用平台优先显示)
    db.execute<{ platform: string }>(sql`
      SELECT platform
      FROM collected_items
      WHERE organization_id = ${organizationId}::uuid AND platform IS NOT NULL
      GROUP BY platform
      ORDER BY COUNT(*) DESC
      LIMIT 100
    `),
    db.execute<{ account: string }>(sql`
      SELECT account
      FROM (
        SELECT author AS account
        FROM collected_items
        WHERE organization_id = ${organizationId}::uuid
          AND author IS NOT NULL
          AND btrim(author) <> ''
        UNION ALL
        SELECT raw_metadata->>'source' AS account
        FROM collected_items
        WHERE organization_id = ${organizationId}::uuid
          AND raw_metadata->>'source' IS NOT NULL
          AND btrim(raw_metadata->>'source') <> ''
        UNION ALL
        SELECT raw_metadata->>'publicAccountName' AS account
        FROM collected_items
        WHERE organization_id = ${organizationId}::uuid
          AND raw_metadata->>'publicAccountName' IS NOT NULL
          AND btrim(raw_metadata->>'publicAccountName') <> ''
      ) s
      GROUP BY account
      ORDER BY COUNT(*) DESC, account
      LIMIT 300
    `),
  ]);

  return {
    categories: categories.map((r) => r.category),
    tags: tags.map((r) => r.tag),
    platforms: platforms.map((r) => r.platform),
    accounts: accounts.map((r) => r.account),
  };
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

/**
 * 导出查询:按当前筛选条件拉所有匹配行(不分页),LEFT JOIN contents 副表带回正文/OCR/ASR。
 * 用于"导出 Excel"功能,前端不显示但需要落 Excel。
 *
 * 安全限制:hardMaxRows 防止误导致 OOM。默认 100000 行(单次导出上限);超过抛错让 UI 提示分批。
 */
export async function exportCollectedItemsForExcel(
  organizationId: string,
  filters: ContentFilters = {},
  hardMaxRows = 100000,
): Promise<Array<CollectedItemRow & { content: string | null; ocrText: string | null; asrText: string | null }>> {
  const conditions = await buildCollectedItemConditions(organizationId, filters);

  // 先 count 检查上限,避免拉完才发现超
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(collectedItems)
    .where(and(...conditions));
  if (n > hardMaxRows) {
    throw new Error(`匹配 ${n} 条,超过单次导出上限 ${hardMaxRows} 条,请收紧筛选条件后再试`);
  }

  const rows = await db
    .select({
      ...getTableColumns(collectedItems),
      content: collectedItemContents.content,
      ocrText: collectedItemContents.ocrText,
      asrText: collectedItemContents.asrText,
    })
    .from(collectedItems)
    .leftJoin(collectedItemContents, eq(collectedItemContents.itemId, collectedItems.id))
    .where(and(...conditions))
    .orderBy(desc(collectedItems.firstSeenAt));

  return rows;
}

/**
 * 批量删除采集项(硬删除)。
 * - 严格按 org 隔离,避免跨租户误删
 * - 副表 collected_item_contents 由 ON DELETE CASCADE 自动清
 * - 下游 hot_topics.collected_item_id 的 FK 行为由 schema 决定(SET NULL / CASCADE)
 * 返回实际被删的行数(传入 ids 可能含已删/越权,只返回真正命中本 org 的数)。
 */
export async function bulkDeleteCollectedItemsByIds(
  organizationId: string,
  ids: string[],
): Promise<{ deletedCount: number }> {
  if (ids.length === 0) return { deletedCount: 0 };
  const deleted = await db
    .delete(collectedItems)
    .where(
      and(
        eq(collectedItems.organizationId, organizationId),
        inArray(collectedItems.id, ids),
      ),
    )
    .returning({ id: collectedItems.id });
  return { deletedCount: deleted.length };
}

export async function getCollectedItemDetail(
  itemId: string,
  organizationId: string,
): Promise<CollectedItemDetailRow | null> {
  // 正文/OCR/ASR 都在副表;详情 LEFT JOIN 一次性带回(列表则不带,见 loadCollectedItems)。
  const [row] = await db
    .select({
      item: collectedItems,
      content: collectedItemContents.content,
      ocrText: collectedItemContents.ocrText,
      asrText: collectedItemContents.asrText,
    })
    .from(collectedItems)
    .leftJoin(collectedItemContents, eq(collectedItemContents.itemId, collectedItems.id))
    .where(
      and(
        eq(collectedItems.id, itemId),
        eq(collectedItems.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!row) return null;
  return { ...row.item, content: row.content, ocrText: row.ocrText, asrText: row.asrText };
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

import { db } from "@/db";
import { newsArticles } from "@/db/schema/research/news-articles";
import { cqDistricts } from "@/db/schema/research/cq-districts";
import { desc, sql, ilike, or, inArray, gte, lte, and, eq } from "drizzle-orm";

// NOTE: outletTierSnapshot / outletId columns removed from newsArticles in A1 Phase 0.
// stub: outletName / outletTier returned as NULL until A3 re-connects collected_items.
// MediaTier kept for AdvancedSearchField compatibility.
type SourceChannel = "tavily" | "whitelist_crawl" | "manual_url";

export type ArticleSearchParams = {
  keyword?: string;
  tiers?: string[];
  districtIds?: string[];
  outletId?: string;
  sourceChannels?: string[];
  timeStart?: string;
  timeEnd?: string;
  page?: number;
  pageSize?: number;
};

export type ArticleSearchResult = {
  id: string;
  url: string;
  title: string;
  publishedAt: Date | null;
  outletName: string | null;
  outletTier: string | null;
  districtName: string | null;
  sourceChannel: string;
  crawledAt: Date;
  /** 兜底：outlet 未命中时从 rawMetadata.platforms[0] 取（"微博"/"知乎"等） */
  platformFallback: string | null;
};

function extractPlatformFallback(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const platforms = (raw as { platforms?: unknown }).platforms;
  if (!Array.isArray(platforms) || platforms.length === 0) return null;
  const first = platforms[0];
  return typeof first === "string" ? first : null;
}

export type ArticleSearchResponse = {
  articles: ArticleSearchResult[];
  total: number;
  page: number;
  pageSize: number;
};

export async function searchNewsArticles(
  params: ArticleSearchParams,
): Promise<ArticleSearchResponse> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 50;
  const offset = (page - 1) * pageSize;

  const conditions = [];

  if (params.keyword && params.keyword.trim()) {
    const kw = `%${params.keyword.trim()}%`;
    conditions.push(
      or(
        ilike(newsArticles.title, kw),
        ilike(newsArticles.content, kw),
      ),
    );
  }

  // stub: tiers / outletId filters silently ignored until A3 reconnects outlet data
  if (params.districtIds?.length) {
    conditions.push(inArray(newsArticles.districtIdSnapshot, params.districtIds));
  }

  if (params.sourceChannels?.length) {
    conditions.push(
      inArray(newsArticles.sourceChannel, params.sourceChannels as SourceChannel[]),
    );
  }

  if (params.timeStart) {
    conditions.push(gte(newsArticles.publishedAt, new Date(params.timeStart)));
  }
  if (params.timeEnd) {
    conditions.push(lte(newsArticles.publishedAt, new Date(params.timeEnd)));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Count total
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(newsArticles)
    .where(whereClause);
  const total = countRow?.count ?? 0;

  // Fetch page
  const rows = await db
    .select({
      id: newsArticles.id,
      url: newsArticles.url,
      title: newsArticles.title,
      publishedAt: newsArticles.publishedAt,
      districtIdSnapshot: newsArticles.districtIdSnapshot,
      sourceChannel: newsArticles.sourceChannel,
      crawledAt: newsArticles.crawledAt,
      rawMetadata: newsArticles.rawMetadata,
    })
    .from(newsArticles)
    .where(whereClause)
    .orderBy(desc(newsArticles.publishedAt), desc(newsArticles.crawledAt))
    .limit(pageSize)
    .offset(offset);

  // Resolve district names in batch
  const districtIds = [...new Set(rows.map((r) => r.districtIdSnapshot).filter(Boolean))] as string[];

  const districtNames = districtIds.length > 0
    ? await db.select({ id: cqDistricts.id, name: cqDistricts.name }).from(cqDistricts).where(inArray(cqDistricts.id, districtIds))
    : [];

  const districtMap = new Map(districtNames.map((d) => [d.id, d.name]));

  const articles: ArticleSearchResult[] = rows.map((r) => ({
    id: r.id,
    url: r.url,
    title: r.title,
    publishedAt: r.publishedAt,
    outletName: null, // stub: A3 阶段接 collected_items
    outletTier: null, // stub: A3 阶段接 collected_items
    districtName: r.districtIdSnapshot ? (districtMap.get(r.districtIdSnapshot) ?? null) : null,
    sourceChannel: r.sourceChannel,
    crawledAt: r.crawledAt,
    platformFallback: extractPlatformFallback(r.rawMetadata),
  }));

  return { articles, total, page, pageSize };
}

/* ─── Advanced Search ─── */

export type AdvancedSearchField =
  | "title" | "content" | "keyword" | "outletName"
  | "tier" | "district" | "channel" | "publishedAt";

export type AdvancedSearchOperator =
  | "contains" | "not_contains" | "equals" | "not_equals" | "between";

export type SearchCondition = {
  field: AdvancedSearchField;
  operator: AdvancedSearchOperator;
  value: string;
  value2?: string;
  logic: "and" | "or";
};

export type AdvancedSearchParams = {
  conditions: SearchCondition[];
  page?: number;
  pageSize?: number;
};

function buildConditionExpr(c: SearchCondition) {
  const val = c.value;
  const val2 = c.value2;

  switch (c.field) {
    case "title":
      if (c.operator === "contains") return ilike(newsArticles.title, `%${val}%`);
      if (c.operator === "not_contains")
        return sql`NOT (${newsArticles.title} ILIKE ${"%" + val + "%"})`;
      break;
    case "content":
      if (c.operator === "contains") return ilike(newsArticles.content, `%${val}%`);
      if (c.operator === "not_contains")
        return sql`NOT (${newsArticles.content} ILIKE ${"%" + val + "%"})`;
      break;
    case "keyword": {
      const kw = `%${val}%`;
      if (c.operator === "contains")
        return or(ilike(newsArticles.title, kw), ilike(newsArticles.content, kw));
      if (c.operator === "not_contains")
        return sql`NOT (${newsArticles.title} ILIKE ${kw} OR ${newsArticles.content} ILIKE ${kw})`;
      break;
    }
    case "outletName":
      // stub: outletName search not available until A3; silently returns no matches
      return sql`FALSE`;
    case "tier":
      // stub: tier search not available until A3; silently returns no matches
      return sql`FALSE`;
    case "district":
      if (c.operator === "equals") return eq(newsArticles.districtIdSnapshot, val);
      if (c.operator === "not_equals")
        return sql`${newsArticles.districtIdSnapshot} != ${val}`;
      break;
    case "channel":
      if (c.operator === "equals") return eq(newsArticles.sourceChannel, val as SourceChannel);
      break;
    case "publishedAt":
      if (c.operator === "between" && val && val2)
        return and(
          gte(newsArticles.publishedAt, new Date(val)),
          lte(newsArticles.publishedAt, new Date(val2)),
        );
      break;
  }
  return undefined;
}

export async function advancedSearchNewsArticles(
  params: AdvancedSearchParams,
): Promise<ArticleSearchResponse> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 50;
  const offset = (page - 1) * pageSize;

  // Build expressions from conditions
  const exprs = params.conditions
    .map((c) => ({ expr: buildConditionExpr(c), logic: c.logic }))
    .filter((e) => e.expr !== undefined) as { expr: NonNullable<ReturnType<typeof buildConditionExpr>>; logic: "and" | "or" }[];

  // Group into OR-groups split by AND logic
  const orGroups: (typeof exprs)[] = [];
  let currentGroup: typeof exprs = [];

  for (const item of exprs) {
    if (item.logic === "or" && currentGroup.length > 0) {
      currentGroup.push(item);
    } else {
      if (currentGroup.length > 0) orGroups.push(currentGroup);
      currentGroup = [item];
    }
  }
  if (currentGroup.length > 0) orGroups.push(currentGroup);

  const groupExprs = orGroups.map((g) =>
    g.length === 1 ? g[0].expr : or(...g.map((i) => i.expr)),
  );

  const whereClause =
    groupExprs.length === 0
      ? undefined
      : groupExprs.length === 1
        ? groupExprs[0]
        : and(...groupExprs);

  // Count
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(newsArticles)
    .where(whereClause);
  const total = countRow?.count ?? 0;

  // Fetch page
  const rows = await db
    .select({
      id: newsArticles.id,
      url: newsArticles.url,
      title: newsArticles.title,
      publishedAt: newsArticles.publishedAt,
      districtIdSnapshot: newsArticles.districtIdSnapshot,
      sourceChannel: newsArticles.sourceChannel,
      crawledAt: newsArticles.crawledAt,
      rawMetadata: newsArticles.rawMetadata,
    })
    .from(newsArticles)
    .where(whereClause)
    .orderBy(desc(newsArticles.publishedAt), desc(newsArticles.crawledAt))
    .limit(pageSize)
    .offset(offset);

  // Resolve district names
  const districtIds = [...new Set(rows.map((r) => r.districtIdSnapshot).filter(Boolean))] as string[];

  const districtNames = districtIds.length > 0
    ? await db.select({ id: cqDistricts.id, name: cqDistricts.name }).from(cqDistricts).where(inArray(cqDistricts.id, districtIds))
    : [];

  const districtMap = new Map(districtNames.map((d) => [d.id, d.name]));

  const articles: ArticleSearchResult[] = rows.map((r) => ({
    id: r.id,
    url: r.url,
    title: r.title,
    publishedAt: r.publishedAt,
    outletName: null, // stub: A3 阶段接 collected_items
    outletTier: null, // stub: A3 阶段接 collected_items
    districtName: r.districtIdSnapshot ? (districtMap.get(r.districtIdSnapshot) ?? null) : null,
    sourceChannel: r.sourceChannel,
    crawledAt: r.crawledAt,
    platformFallback: extractPlatformFallback(r.rawMetadata),
  }));

  return { articles, total, page, pageSize };
}

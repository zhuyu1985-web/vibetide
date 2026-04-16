import { db } from "@/db";
import { newsArticles } from "@/db/schema/research/news-articles";
import { mediaOutlets } from "@/db/schema/research/media-outlets";
import { cqDistricts } from "@/db/schema/research/cq-districts";
import { desc, sql, ilike, or, inArray, gte, lte, and, eq } from "drizzle-orm";

type MediaTier = "central" | "provincial_municipal" | "industry" | "district_media";
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
};

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

  if (params.tiers?.length) {
    conditions.push(
      inArray(newsArticles.outletTierSnapshot, params.tiers as MediaTier[]),
    );
  }

  if (params.districtIds?.length) {
    conditions.push(inArray(newsArticles.districtIdSnapshot, params.districtIds));
  }

  if (params.outletId) {
    conditions.push(eq(newsArticles.outletId, params.outletId));
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
      outletTier: newsArticles.outletTierSnapshot,
      districtIdSnapshot: newsArticles.districtIdSnapshot,
      outletId: newsArticles.outletId,
      sourceChannel: newsArticles.sourceChannel,
      crawledAt: newsArticles.crawledAt,
    })
    .from(newsArticles)
    .where(whereClause)
    .orderBy(desc(newsArticles.publishedAt), desc(newsArticles.crawledAt))
    .limit(pageSize)
    .offset(offset);

  // Resolve outlet names and district names in batch
  const outletIds = [...new Set(rows.map((r) => r.outletId).filter(Boolean))] as string[];
  const districtIds = [...new Set(rows.map((r) => r.districtIdSnapshot).filter(Boolean))] as string[];

  const outletNames = outletIds.length > 0
    ? await db.select({ id: mediaOutlets.id, name: mediaOutlets.name }).from(mediaOutlets).where(inArray(mediaOutlets.id, outletIds))
    : [];
  const districtNames = districtIds.length > 0
    ? await db.select({ id: cqDistricts.id, name: cqDistricts.name }).from(cqDistricts).where(inArray(cqDistricts.id, districtIds))
    : [];

  const outletMap = new Map(outletNames.map((o) => [o.id, o.name]));
  const districtMap = new Map(districtNames.map((d) => [d.id, d.name]));

  const articles: ArticleSearchResult[] = rows.map((r) => ({
    id: r.id,
    url: r.url,
    title: r.title,
    publishedAt: r.publishedAt,
    outletName: r.outletId ? (outletMap.get(r.outletId) ?? null) : null,
    outletTier: r.outletTier,
    districtName: r.districtIdSnapshot ? (districtMap.get(r.districtIdSnapshot) ?? null) : null,
    sourceChannel: r.sourceChannel,
    crawledAt: r.crawledAt,
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
      if (c.operator === "contains")
        return sql`${newsArticles.outletId} IN (SELECT id FROM research_media_outlets WHERE name ILIKE ${"%" + val + "%"})`;
      if (c.operator === "not_contains")
        return sql`${newsArticles.outletId} IN (SELECT id FROM research_media_outlets WHERE NOT (name ILIKE ${"%" + val + "%"}))`;
      if (c.operator === "equals")
        return sql`${newsArticles.outletId} IN (SELECT id FROM research_media_outlets WHERE name = ${val})`;
      break;
    case "tier":
      if (c.operator === "equals") return eq(newsArticles.outletTierSnapshot, val as MediaTier);
      if (c.operator === "not_equals")
        return sql`${newsArticles.outletTierSnapshot} != ${val}`;
      break;
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
      outletTier: newsArticles.outletTierSnapshot,
      districtIdSnapshot: newsArticles.districtIdSnapshot,
      outletId: newsArticles.outletId,
      sourceChannel: newsArticles.sourceChannel,
      crawledAt: newsArticles.crawledAt,
    })
    .from(newsArticles)
    .where(whereClause)
    .orderBy(desc(newsArticles.publishedAt), desc(newsArticles.crawledAt))
    .limit(pageSize)
    .offset(offset);

  // Resolve outlet / district names
  const outletIds = [...new Set(rows.map((r) => r.outletId).filter(Boolean))] as string[];
  const districtIds = [...new Set(rows.map((r) => r.districtIdSnapshot).filter(Boolean))] as string[];

  const outletNames = outletIds.length > 0
    ? await db.select({ id: mediaOutlets.id, name: mediaOutlets.name }).from(mediaOutlets).where(inArray(mediaOutlets.id, outletIds))
    : [];
  const districtNames = districtIds.length > 0
    ? await db.select({ id: cqDistricts.id, name: cqDistricts.name }).from(cqDistricts).where(inArray(cqDistricts.id, districtIds))
    : [];

  const outletMap = new Map(outletNames.map((o) => [o.id, o.name]));
  const districtMap = new Map(districtNames.map((d) => [d.id, d.name]));

  const articles: ArticleSearchResult[] = rows.map((r) => ({
    id: r.id,
    url: r.url,
    title: r.title,
    publishedAt: r.publishedAt,
    outletName: r.outletId ? (outletMap.get(r.outletId) ?? null) : null,
    outletTier: r.outletTier,
    districtName: r.districtIdSnapshot ? (districtMap.get(r.districtIdSnapshot) ?? null) : null,
    sourceChannel: r.sourceChannel,
    crawledAt: r.crawledAt,
  }));

  return { articles, total, page, pageSize };
}

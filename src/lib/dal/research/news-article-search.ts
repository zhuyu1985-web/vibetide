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

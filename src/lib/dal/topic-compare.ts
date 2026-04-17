import { db } from "@/db";
import {
  articles,
  benchmarkAnalyses,
  monitoredPlatforms,
  platformContent,
} from "@/db/schema";
import { eq, desc, and, inArray, or, sql } from "drizzle-orm";
import type {
  TopicCompareArticle,
  TopicCompareDetail,
  NetworkReport,
  CompetitorGroup,
  BenchmarkAISummary,
} from "@/lib/types";

/* ─── Helpers ─── */

/**
 * Extract keywords from a title for fuzzy matching against crawled platform content.
 * Strategy: remove common punctuation, split by whitespace and delimiters,
 * keep tokens with 2+ chars (Chinese phrases mostly).
 */
function extractKeywords(title: string): string[] {
  if (!title) return [];
  const cleaned = title
    .replace(/[，。、：；！？（）【】《》""''—\-—,.!?()\[\]<>:"]/g, " ")
    .trim();
  const tokens = cleaned
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  // Also add 2-gram windows for Chinese titles (since Chinese doesn't tokenize on space)
  const grams: string[] = [];
  for (const tk of tokens) {
    if (tk.length >= 4) {
      grams.push(tk.slice(0, 4));
    }
  }
  return Array.from(new Set([...tokens, ...grams])).slice(0, 6);
}

function mapMediaType(raw: string): TopicCompareArticle["contentType"] {
  if (!raw) return "text";
  const v = raw.toLowerCase();
  if (v.includes("video") || v === "视频") return "video";
  if (v.includes("live") || v === "直播") return "live";
  if (v.includes("short") || v === "短视频") return "short_video";
  return "text";
}

function mapPlatformCategoryToMediaLevel(
  cat: string | null
): NetworkReport["mediaLevel"] {
  switch (cat) {
    case "central":
      return "central";
    case "provincial":
      return "provincial";
    case "municipal":
      return "city";
    case "industry":
      return "industry";
    default:
      return "self_media";
  }
}

function mapCategoryToCompetitorLevel(
  cat: string | null
): CompetitorGroup["level"] {
  switch (cat) {
    case "central":
      return "central";
    case "provincial":
      return "provincial";
    case "municipal":
      return "city";
    default:
      return "other";
  }
}

const LEVEL_LABEL: Record<CompetitorGroup["level"], string> = {
  central: "央级媒体",
  provincial: "省级媒体",
  city: "市级媒体",
  other: "其他媒体",
};

const LEVEL_COLOR: Record<CompetitorGroup["level"], string> = {
  central:
    "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800/30",
  provincial:
    "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800/30",
  city:
    "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800/30",
  other:
    "bg-gray-50 border-gray-200 dark:bg-gray-900/40 dark:border-gray-700/40",
};

/* ─── List page ─── */

interface ArticleRow {
  id: string;
  title: string;
  publishedAt: Date | null;
  mediaType: string;
  publishChannels: string[] | null;
  spreadData: {
    views?: number;
    likes?: number;
    shares?: number;
    comments?: number;
  } | null;
}

/**
 * Get published articles for the topic-compare list page.
 * Cross-references benchmarkAnalyses (by sourceArticleId or topicTitle)
 * to determine hasAnalysis flag and benchmark count.
 */
export async function getTopicCompareArticles(
  orgId: string,
  limit = 50
): Promise<TopicCompareArticle[]> {
  const rows = (await db
    .select({
      id: articles.id,
      title: articles.title,
      publishedAt: articles.publishedAt,
      mediaType: articles.mediaType,
      publishChannels: articles.publishChannels,
      spreadData: articles.spreadData,
    })
    .from(articles)
    .where(
      and(
        eq(articles.organizationId, orgId),
        inArray(articles.status, ["published", "reviewing"])
      )
    )
    .orderBy(desc(articles.publishedAt))
    .limit(limit)) as ArticleRow[];

  if (rows.length === 0) return [];

  // Load analyses for this org, build a lookup map by articleId AND by topicTitle
  const analyses = await db
    .select({
      id: benchmarkAnalyses.id,
      topicTitle: benchmarkAnalyses.topicTitle,
      sourceArticleId: benchmarkAnalyses.sourceArticleId,
      mediaScores: benchmarkAnalyses.mediaScores,
      analyzedAt: benchmarkAnalyses.analyzedAt,
    })
    .from(benchmarkAnalyses)
    .where(eq(benchmarkAnalyses.organizationId, orgId));

  const byArticleId = new Map<string, (typeof analyses)[number]>();
  const byTitle = new Map<string, (typeof analyses)[number]>();
  for (const a of analyses) {
    if (a.sourceArticleId) byArticleId.set(a.sourceArticleId, a);
    byTitle.set(a.topicTitle, a);
  }

  return rows.map((row) => {
    const analysis = byArticleId.get(row.id) ?? byTitle.get(row.title);
    const scores = (analysis?.mediaScores as unknown[]) ?? [];
    // mediaScores includes our own row; subtract it for competitor count
    const benchmarkCount = Array.isArray(scores)
      ? Math.max(0, scores.length - 1)
      : 0;

    return {
      id: row.id,
      title: row.title,
      publishedAt: row.publishedAt?.toISOString() ?? "",
      channels: (row.publishChannels as string[]) ?? [],
      contentType: mapMediaType(row.mediaType),
      readCount: row.spreadData?.views ?? 0,
      likeCount: row.spreadData?.likes ?? 0,
      commentCount: row.spreadData?.comments ?? 0,
      shareCount: row.spreadData?.shares ?? 0,
      benchmarkCount,
      hasAnalysis: !!analysis,
    };
  });
}

/* ─── Detail page ─── */

/**
 * Find platform content records that match an article's topic
 * via keyword fuzzy search on title/summary/topics.
 */
async function findMatchingPlatformContent(orgId: string, title: string) {
  const keywords = extractKeywords(title);
  if (keywords.length === 0) return [];

  // Build OR conditions for each keyword against title / summary
  const keywordConds = keywords.map((kw) =>
    or(
      sql`${platformContent.title} ILIKE ${"%" + kw + "%"}`,
      sql`${platformContent.summary} ILIKE ${"%" + kw + "%"}`
    )
  );

  const rows = await db
    .select({
      content: platformContent,
      platformName: monitoredPlatforms.name,
      platformCategory: monitoredPlatforms.category,
    })
    .from(platformContent)
    .leftJoin(
      monitoredPlatforms,
      eq(platformContent.platformId, monitoredPlatforms.id)
    )
    .where(
      and(
        eq(platformContent.organizationId, orgId),
        or(...keywordConds)
      )
    )
    .orderBy(desc(platformContent.publishedAt))
    .limit(100);

  return rows;
}

/**
 * Get a single article's full topic-compare detail:
 * - article header
 * - stats (total / central / provincial / other / time range)
 * - aiSummary (from benchmark_analyses.ai_summary, null if not generated yet)
 * - reports list (network reports from platform_content)
 * - competitor groups (grouped by monitored_platforms.category)
 */
export async function getTopicCompareDetail(
  orgId: string,
  articleId: string
): Promise<{
  detail: TopicCompareDetail;
  reports: NetworkReport[];
  competitorGroups: CompetitorGroup[];
} | null> {
  // 1) Load the article
  const articleRows = (await db
    .select({
      id: articles.id,
      title: articles.title,
      publishedAt: articles.publishedAt,
      mediaType: articles.mediaType,
      publishChannels: articles.publishChannels,
      spreadData: articles.spreadData,
    })
    .from(articles)
    .where(
      and(eq(articles.id, articleId), eq(articles.organizationId, orgId))
    )
    .limit(1)) as ArticleRow[];

  if (articleRows.length === 0) return null;
  const article = articleRows[0];

  // 2) Find matching benchmark analysis (by sourceArticleId OR by topicTitle)
  const analysisRows = await db
    .select()
    .from(benchmarkAnalyses)
    .where(
      and(
        eq(benchmarkAnalyses.organizationId, orgId),
        or(
          eq(benchmarkAnalyses.sourceArticleId, article.id),
          eq(benchmarkAnalyses.topicTitle, article.title)
        )
      )
    )
    .orderBy(desc(benchmarkAnalyses.analyzedAt))
    .limit(1);

  const analysis = analysisRows[0];

  // 3) Find matching platform content
  const matched = await findMatchingPlatformContent(orgId, article.title);

  // 4) Compute stats
  let earliestTime = "";
  let latestTime = "";
  let centralCount = 0;
  let provincialCount = 0;
  let otherCount = 0;
  const times: number[] = [];

  for (const row of matched) {
    const cat = row.platformCategory;
    if (cat === "central") centralCount++;
    else if (cat === "provincial") provincialCount++;
    else otherCount++;
    if (row.content.publishedAt) {
      times.push(new Date(row.content.publishedAt).getTime());
    }
  }

  if (times.length > 0) {
    earliestTime = new Date(Math.min(...times)).toISOString();
    latestTime = new Date(Math.max(...times)).toISOString();
  }

  // 5) Build reports list
  const reports: NetworkReport[] = matched.map((row) => ({
    id: row.content.id,
    title: row.content.title,
    sourceOutlet: row.platformName ?? "未知来源",
    mediaLevel: mapPlatformCategoryToMediaLevel(row.platformCategory),
    publishedAt: row.content.publishedAt?.toISOString() ?? "",
    author: row.content.author ?? "",
    summary: row.content.summary ?? "",
    sourceUrl: row.content.sourceUrl,
    contentType: row.content.category ?? "text",
    aiInterpretation: null, // Stored as text in DB; full structured interpretation is a future enhancement
  }));

  // 6) Build competitor groups grouped by media level → outlet
  const levelMap = new Map<
    CompetitorGroup["level"],
    Map<string, CompetitorGroup["outlets"][number]["articles"]>
  >();

  for (const row of matched) {
    const level = mapCategoryToCompetitorLevel(row.platformCategory);
    const outletName = row.platformName ?? "未知来源";
    if (!levelMap.has(level)) levelMap.set(level, new Map());
    const outlets = levelMap.get(level)!;
    if (!outlets.has(outletName)) outlets.set(outletName, []);
    outlets.get(outletName)!.push({
      title: row.content.title,
      subject: row.content.category ?? "综合",
      publishedAt: row.content.publishedAt
        ? new Date(row.content.publishedAt).toLocaleString("zh-CN", {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "",
      channel: row.platformName ?? "",
      sourceUrl: row.content.sourceUrl,
    });
  }

  const competitorGroups: CompetitorGroup[] = Array.from(levelMap.entries())
    .map(([level, outletsMap]) => ({
      level,
      levelLabel: LEVEL_LABEL[level],
      levelColor: LEVEL_COLOR[level],
      outlets: Array.from(outletsMap.entries()).map(([outletName, arts]) => ({
        outletName,
        articles: arts,
      })),
    }))
    .sort((a, b) => {
      const order: CompetitorGroup["level"][] = [
        "central",
        "provincial",
        "city",
        "other",
      ];
      return order.indexOf(a.level) - order.indexOf(b.level);
    });

  // 7) Build TopicCompareArticle from article row
  const topicCompareArticle: TopicCompareArticle = {
    id: article.id,
    title: article.title,
    publishedAt: article.publishedAt?.toISOString() ?? "",
    channels: (article.publishChannels as string[]) ?? [],
    contentType: mapMediaType(article.mediaType),
    readCount: article.spreadData?.views ?? 0,
    likeCount: article.spreadData?.likes ?? 0,
    commentCount: article.spreadData?.comments ?? 0,
    shareCount: article.spreadData?.shares ?? 0,
    benchmarkCount: matched.length,
    hasAnalysis: !!analysis,
  };

  const detail: TopicCompareDetail = {
    article: topicCompareArticle,
    stats: {
      totalReports: matched.length,
      centralCount,
      provincialCount,
      otherCount,
      earliestTime,
      latestTime,
      trendDelta: 0,
    },
    aiSummary: (analysis?.aiSummary as BenchmarkAISummary | null) ?? null,
    lastAnalyzedAt: analysis?.analyzedAt?.toISOString() ?? null,
  };

  return { detail, reports, competitorGroups };
}

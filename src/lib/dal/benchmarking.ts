import { db } from "@/db";
import {
  benchmarkAnalyses,
  missedTopics,
  weeklyReports,
  monitoredPlatforms,
  platformContent,
  benchmarkAlerts,
  articles,
  hotTopics,
} from "@/db/schema";
import { eq, desc, sql, and, gte, inArray } from "drizzle-orm";
import type {
  BenchmarkTopic,
  MissedTopic,
  WeeklyReport,
  MonitoredPlatformUI,
  PlatformContentUI,
  BenchmarkAlertUI,
  PlatformComparisonRow,
  CoverageOverview,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Existing functions
// ---------------------------------------------------------------------------

export async function getBenchmarkTopics(
  orgId: string
): Promise<BenchmarkTopic[]> {
  const rows = await db.query.benchmarkAnalyses.findMany({
    where: eq(benchmarkAnalyses.organizationId, orgId),
    orderBy: [desc(benchmarkAnalyses.analyzedAt)],
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.topicTitle,
    category: row.category || "",
    mediaScores:
      (row.mediaScores as BenchmarkTopic["mediaScores"]) || [],
    radarData: (row.radarData as BenchmarkTopic["radarData"]) || [],
    improvements: (row.improvements as string[]) || [],
  }));
}

export async function getMissedTopics(
  orgId: string
): Promise<MissedTopic[]> {
  const rows = await db.query.missedTopics.findMany({
    where: eq(missedTopics.organizationId, orgId),
    orderBy: [desc(missedTopics.discoveredAt)],
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    priority: row.priority,
    discoveredAt: row.discoveredAt.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    competitors: (row.competitors as string[]) || [],
    heatScore: row.heatScore || 0,
    category: row.category || "",
    type: row.type,
    status: row.status,
  }));
}

export async function getWeeklyReport(
  orgId: string
): Promise<WeeklyReport | null> {
  const row = await db.query.weeklyReports.findFirst({
    where: eq(weeklyReports.organizationId, orgId),
    orderBy: [desc(weeklyReports.createdAt)],
  });

  if (!row) return null;

  return {
    period: row.period,
    overallScore: row.overallScore || 0,
    missedRate: row.missedRate || 0,
    responseSpeed: row.responseSpeed || "",
    coverageRate: row.coverageRate || 0,
    trends: (row.trends as WeeklyReport["trends"]) || [],
    gapList: (row.gapList as WeeklyReport["gapList"]) || [],
  };
}

export async function getMissedTypeDistribution(
  orgId: string
): Promise<{ name: string; value: number; color: string }[]> {
  const rows = await db
    .select({
      type: missedTopics.type,
      count: sql<number>`count(*)::int`,
    })
    .from(missedTopics)
    .where(eq(missedTopics.organizationId, orgId))
    .groupBy(missedTopics.type);

  const colorMap: Record<string, { name: string; color: string }> = {
    breaking: { name: "突发新闻", color: "#ef4444" },
    trending: { name: "趋势话题", color: "#f59e0b" },
    analysis: { name: "深度分析", color: "#3b82f6" },
  };

  return rows.map((row) => ({
    name: colorMap[row.type]?.name || row.type,
    value: row.count,
    color: colorMap[row.type]?.color || "#6b7280",
  }));
}

export function getBenchmarkDimensions(): string[] {
  return ["叙事角度", "视觉品质", "互动策略", "时效性"];
}

// ---------------------------------------------------------------------------
// Topic Candidates (for user selection in 同题对标)
// ---------------------------------------------------------------------------

export interface TopicCandidate {
  id: string;
  title: string;
  source: "article" | "hot_topic";
  category?: string;
  status?: string;
}

export async function getTopicCandidates(
  orgId: string
): Promise<TopicCandidate[]> {
  const [articleRows, hotTopicRows] = await Promise.all([
    db
      .select({ id: articles.id, title: articles.title, category: articles.categoryId, status: articles.status })
      .from(articles)
      .where(eq(articles.organizationId, orgId))
      .orderBy(desc(articles.updatedAt))
      .limit(30),
    db
      .select({ id: hotTopics.id, title: hotTopics.title, category: hotTopics.category })
      .from(hotTopics)
      .where(eq(hotTopics.organizationId, orgId))
      .orderBy(desc(hotTopics.heatScore))
      .limit(30),
  ]);

  const results: TopicCandidate[] = [];

  for (const a of articleRows) {
    results.push({
      id: a.id,
      title: a.title,
      source: "article",
      category: a.category ?? undefined,
      status: a.status,
    });
  }

  for (const h of hotTopicRows) {
    results.push({
      id: h.id,
      title: h.title,
      source: "hot_topic",
      category: h.category ?? undefined,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Monitored Platforms
// ---------------------------------------------------------------------------

export async function getMonitoredPlatforms(
  orgId: string
): Promise<MonitoredPlatformUI[]> {
  const rows = await db.query.monitoredPlatforms.findMany({
    where: eq(monitoredPlatforms.organizationId, orgId),
    orderBy: [desc(monitoredPlatforms.createdAt)],
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    url: row.url,
    category: row.category,
    province: row.province ?? undefined,
    crawlFrequencyMinutes: row.crawlFrequencyMinutes ?? 120,
    status: row.status,
    crawlConfig: (row.crawlConfig as MonitoredPlatformUI["crawlConfig"]) ?? {},
    lastCrawledAt: row.lastCrawledAt?.toISOString(),
    lastErrorMessage: row.lastErrorMessage ?? undefined,
    totalContentCount: row.totalContentCount ?? 0,
  }));
}

export async function getMonitoredPlatformById(
  orgId: string,
  id: string
): Promise<MonitoredPlatformUI | null> {
  const row = await db.query.monitoredPlatforms.findFirst({
    where: and(
      eq(monitoredPlatforms.id, id),
      eq(monitoredPlatforms.organizationId, orgId)
    ),
  });

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    url: row.url,
    category: row.category,
    province: row.province ?? undefined,
    crawlFrequencyMinutes: row.crawlFrequencyMinutes ?? 120,
    status: row.status,
    crawlConfig: (row.crawlConfig as MonitoredPlatformUI["crawlConfig"]) ?? {},
    lastCrawledAt: row.lastCrawledAt?.toISOString(),
    lastErrorMessage: row.lastErrorMessage ?? undefined,
    totalContentCount: row.totalContentCount ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Platform Content
// ---------------------------------------------------------------------------

export async function getRecentPlatformContent(
  orgId: string,
  options: {
    platformId?: string;
    days?: number;
    limit?: number;
    coverageStatus?: string;
  } = {}
): Promise<PlatformContentUI[]> {
  const { platformId, days = 7, limit = 50, coverageStatus } = options;

  const conditions = [eq(platformContent.organizationId, orgId)];

  if (platformId) {
    conditions.push(eq(platformContent.platformId, platformId));
  }
  if (days > 0) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    conditions.push(gte(platformContent.crawledAt, since));
  }
  if (coverageStatus) {
    conditions.push(sql`${platformContent.coverageStatus} = ${coverageStatus}` as ReturnType<typeof eq>);
  }

  const rows = await db
    .select({
      id: platformContent.id,
      platformId: platformContent.platformId,
      platformName: monitoredPlatforms.name,
      title: platformContent.title,
      summary: platformContent.summary,
      sourceUrl: platformContent.sourceUrl,
      author: platformContent.author,
      publishedAt: platformContent.publishedAt,
      topics: platformContent.topics,
      category: platformContent.category,
      sentiment: platformContent.sentiment,
      importance: platformContent.importance,
      coverageStatus: platformContent.coverageStatus,
      gapAnalysis: platformContent.gapAnalysis,
      crawledAt: platformContent.crawledAt,
      analyzedAt: platformContent.analyzedAt,
    })
    .from(platformContent)
    .leftJoin(monitoredPlatforms, eq(platformContent.platformId, monitoredPlatforms.id))
    .where(and(...conditions))
    .orderBy(desc(platformContent.crawledAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    platformId: row.platformId,
    platformName: row.platformName ?? undefined,
    title: row.title,
    summary: row.summary ?? undefined,
    sourceUrl: row.sourceUrl,
    author: row.author ?? undefined,
    publishedAt: row.publishedAt?.toISOString(),
    topics: (row.topics as string[]) ?? [],
    category: row.category ?? undefined,
    sentiment: row.sentiment ?? undefined,
    importance: row.importance ?? 0,
    coverageStatus: row.coverageStatus ?? undefined,
    gapAnalysis: row.gapAnalysis ?? undefined,
    crawledAt: row.crawledAt.toISOString(),
    analyzedAt: row.analyzedAt?.toISOString(),
  }));
}

export async function getContentTopicDistribution(
  orgId: string,
  days = 7
): Promise<{ topic: string; count: number }[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({ topics: platformContent.topics })
    .from(platformContent)
    .where(
      and(
        eq(platformContent.organizationId, orgId),
        gte(platformContent.crawledAt, since)
      )
    );

  const topicCounts = new Map<string, number>();
  for (const row of rows) {
    const topics = (row.topics as string[]) ?? [];
    for (const topic of topics) {
      topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
    }
  }

  return Array.from(topicCounts.entries())
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Benchmark Alerts
// ---------------------------------------------------------------------------

export async function getBenchmarkAlerts(
  orgId: string,
  options: {
    status?: string;
    priority?: string;
    type?: string;
    limit?: number;
  } = {}
): Promise<BenchmarkAlertUI[]> {
  const { status, priority, type, limit = 50 } = options;

  const conditions = [eq(benchmarkAlerts.organizationId, orgId)];
  if (status) {
    conditions.push(sql`${benchmarkAlerts.status} = ${status}` as ReturnType<typeof eq>);
  }
  if (priority) {
    conditions.push(sql`${benchmarkAlerts.priority} = ${priority}` as ReturnType<typeof eq>);
  }
  if (type) {
    conditions.push(sql`${benchmarkAlerts.type} = ${type}` as ReturnType<typeof eq>);
  }

  const rows = await db.query.benchmarkAlerts.findMany({
    where: and(...conditions),
    orderBy: [desc(benchmarkAlerts.createdAt)],
    limit,
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    priority: row.priority,
    type: row.type,
    status: row.status,
    platformContentIds: (row.platformContentIds as string[]) ?? [],
    relatedPlatforms: (row.relatedPlatforms as string[]) ?? [],
    relatedTopics: (row.relatedTopics as string[]) ?? [],
    analysisData: (row.analysisData as BenchmarkAlertUI["analysisData"]) ?? {},
    actionNote: row.actionNote ?? undefined,
    workflowInstanceId: row.workflowInstanceId ?? undefined,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getAlertStats(
  orgId: string
): Promise<{ total: number; urgent: number; high: number; new: number; actioned: number }> {
  const rows = await db
    .select({
      status: benchmarkAlerts.status,
      priority: benchmarkAlerts.priority,
      count: sql<number>`count(*)::int`,
    })
    .from(benchmarkAlerts)
    .where(eq(benchmarkAlerts.organizationId, orgId))
    .groupBy(benchmarkAlerts.status, benchmarkAlerts.priority);

  let total = 0;
  let urgent = 0;
  let high = 0;
  let newCount = 0;
  let actioned = 0;

  for (const row of rows) {
    total += row.count;
    if (row.priority === "urgent") urgent += row.count;
    if (row.priority === "high") high += row.count;
    if (row.status === "new") newCount += row.count;
    if (row.status === "actioned") actioned += row.count;
  }

  return { total, urgent, high, new: newCount, actioned };
}

export async function getUnreadAlertCount(orgId: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(benchmarkAlerts)
    .where(
      and(
        eq(benchmarkAlerts.organizationId, orgId),
        eq(benchmarkAlerts.status, "new")
      )
    );

  return result?.count ?? 0;
}

// ---------------------------------------------------------------------------
// Coverage Analysis
// ---------------------------------------------------------------------------

export async function getCoverageOverview(
  orgId: string,
  days = 7
): Promise<CoverageOverview> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      coverageStatus: platformContent.coverageStatus,
      category: monitoredPlatforms.category,
      count: sql<number>`count(*)::int`,
    })
    .from(platformContent)
    .leftJoin(monitoredPlatforms, eq(platformContent.platformId, monitoredPlatforms.id))
    .where(
      and(
        eq(platformContent.organizationId, orgId),
        gte(platformContent.crawledAt, since)
      )
    )
    .groupBy(platformContent.coverageStatus, monitoredPlatforms.category);

  let totalExternal = 0;
  let covered = 0;
  let missed = 0;
  const byCategoryMap = new Map<string, { total: number; covered: number; missed: number }>();

  for (const row of rows) {
    totalExternal += row.count;
    const cat = row.category ?? "central";

    if (!byCategoryMap.has(cat)) {
      byCategoryMap.set(cat, { total: 0, covered: 0, missed: 0 });
    }
    const entry = byCategoryMap.get(cat)!;
    entry.total += row.count;

    if (row.coverageStatus === "covered") {
      covered += row.count;
      entry.covered += row.count;
    } else if (row.coverageStatus === "missed") {
      missed += row.count;
      entry.missed += row.count;
    }
  }

  return {
    totalExternal,
    covered,
    missed,
    coverageRate: totalExternal > 0 ? Math.round((covered / totalExternal) * 100) : 0,
    byPlatformCategory: Array.from(byCategoryMap.entries()).map(
      ([category, data]) => ({
        category: category as CoverageOverview["byPlatformCategory"][number]["category"],
        ...data,
      })
    ),
  };
}

export async function getCoverageTrend(
  orgId: string,
  weeks = 8
): Promise<{ week: string; coverageRate: number; missedCount: number; score: number }[]> {
  const results: { week: string; coverageRate: number; missedCount: number; score: number }[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(Date.now() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000);

    const [stats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        covered: sql<number>`count(*) filter (where ${platformContent.coverageStatus} = 'covered')::int`,
        missed: sql<number>`count(*) filter (where ${platformContent.coverageStatus} = 'missed')::int`,
      })
      .from(platformContent)
      .where(
        and(
          eq(platformContent.organizationId, orgId),
          gte(platformContent.crawledAt, weekStart),
          sql`${platformContent.crawledAt} < ${weekEnd}`
        )
      );

    const total = stats?.total ?? 0;
    const coveredCount = stats?.covered ?? 0;
    const missedCount = stats?.missed ?? 0;
    const coverageRate = total > 0 ? Math.round((coveredCount / total) * 100) : 0;

    results.push({
      week: `W${weeks - i}`,
      coverageRate,
      missedCount,
      score: Math.max(0, 100 - missedCount * 5),
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Multi-Platform Comparison
// ---------------------------------------------------------------------------

export async function getMultiPlatformComparison(
  orgId: string
): Promise<PlatformComparisonRow[]> {
  const rows = await db
    .select({
      platformName: monitoredPlatforms.name,
      category: monitoredPlatforms.category,
      totalContent: sql<number>`count(${platformContent.id})::int`,
      coveredCount: sql<number>`count(*) filter (where ${platformContent.coverageStatus} = 'covered')::int`,
      missedCount: sql<number>`count(*) filter (where ${platformContent.coverageStatus} = 'missed')::int`,
      avgImportance: sql<number>`coalesce(avg(${platformContent.importance}), 0)::float`,
    })
    .from(monitoredPlatforms)
    .leftJoin(platformContent, eq(monitoredPlatforms.id, platformContent.platformId))
    .where(eq(monitoredPlatforms.organizationId, orgId))
    .groupBy(monitoredPlatforms.name, monitoredPlatforms.category);

  return rows.map((row) => ({
    platformName: row.platformName,
    category: row.category,
    totalContent: row.totalContent,
    coveredCount: row.coveredCount,
    missedCount: row.missedCount,
    coverageRate: row.totalContent > 0
      ? Math.round((row.coveredCount / row.totalContent) * 100)
      : 0,
    avgImportance: Math.round(row.avgImportance),
  }));
}

// ---------------------------------------------------------------------------
// Auto-generate analysis from existing crawled content
// ---------------------------------------------------------------------------

/**
 * If platformContent has data but benchmarkAnalyses/missedTopics are empty,
 * generate analysis records inline. Called from page.tsx on load.
 */
export async function autoGenerateAnalysisIfNeeded(orgId: string) {
  const [contentCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(platformContent)
    .where(eq(platformContent.organizationId, orgId));

  if (contentCount.count === 0) return; // No content, nothing to analyze

  const [analysesCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(benchmarkAnalyses)
    .where(eq(benchmarkAnalyses.organizationId, orgId));

  const [missedCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(missedTopics)
    .where(eq(missedTopics.organizationId, orgId));

  if (analysesCount.count > 0 && missedCount.count > 0) return; // Already has data

  const dimensions = ["叙事角度", "视觉品质", "互动策略", "时效性"];

  // Load all content grouped by platform
  const allContent = await db
    .select({
      id: platformContent.id,
      platformId: platformContent.platformId,
      platformName: monitoredPlatforms.name,
      title: platformContent.title,
      summary: platformContent.summary,
      category: platformContent.category,
      topics: platformContent.topics,
      importance: platformContent.importance,
      coverageStatus: platformContent.coverageStatus,
      gapAnalysis: platformContent.gapAnalysis,
      publishedAt: platformContent.publishedAt,
      crawledAt: platformContent.crawledAt,
    })
    .from(platformContent)
    .leftJoin(monitoredPlatforms, eq(platformContent.platformId, monitoredPlatforms.id))
    .where(eq(platformContent.organizationId, orgId));

  if (allContent.length === 0) return;

  // Generate missedTopics if none exist
  if (missedCount.count === 0) {
    const missedItems = allContent.filter(
      (c) => c.coverageStatus === "missed" || c.coverageStatus === "partially_covered"
    );

    for (const item of missedItems) {
      const importance = item.importance ?? 50;
      const priority = importance >= 85 ? "high" : importance >= 60 ? "medium" : "low";
      const topicType = importance >= 90 ? "breaking" : importance >= 60 ? "trending" : "analysis";

      await db.insert(missedTopics).values({
        organizationId: orgId,
        title: item.title,
        priority: priority as "high" | "medium" | "low",
        discoveredAt: item.crawledAt ?? new Date(),
        competitors: [item.platformName ?? "外部平台"],
        heatScore: importance,
        category: item.category || "综合",
        type: topicType as "breaking" | "trending" | "analysis",
        status: "missed",
      });
    }
  }

  // Generate benchmarkAnalyses if none exist
  if (analysesCount.count === 0) {
    // Group by category, pick top item per category
    const categoryGroups = new Map<string, typeof allContent>();
    for (const item of allContent) {
      if ((item.importance ?? 0) < 40) continue;
      const cat = item.category || "综合";
      if (!categoryGroups.has(cat)) categoryGroups.set(cat, []);
      categoryGroups.get(cat)!.push(item);
    }

    for (const [category, items] of categoryGroups) {
      const sorted = items.sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0));
      const topItem = sorted[0];

      // Group platforms for this category's analysis
      const platformGroups = new Map<string, typeof items>();
      for (const item of sorted.slice(0, 6)) {
        const pName = item.platformName ?? "外部平台";
        if (!platformGroups.has(pName)) platformGroups.set(pName, []);
        platformGroups.get(pName)!.push(item);
      }

      const mediaScores = Array.from(platformGroups.entries()).map(([pName, pItems]) => {
        const bestItem = pItems[0];
        const baseScore = Math.round((bestItem.importance ?? 50) * 0.85);
        return {
          media: pName,
          isUs: false,
          scores: dimensions.map((dim) => ({
            dimension: dim,
            score: Math.min(100, baseScore + Math.floor(Math.random() * 15)),
          })),
          total: baseScore + Math.floor(Math.random() * 10),
          publishTime: bestItem.publishedAt
            ? new Date(bestItem.publishedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
            : "未知",
        };
      });

      // Add "我方" row
      const isCovered = items.some((i) => i.coverageStatus === "covered");
      const ourBase = isCovered ? 70 : 35;
      mediaScores.push({
        media: "我方",
        isUs: true,
        scores: dimensions.map((dim) => ({
          dimension: dim,
          score: ourBase + Math.floor(Math.random() * 15),
        })),
        total: ourBase + Math.floor(Math.random() * 10),
        publishTime: isCovered ? "已发布" : "未覆盖",
      });

      const radarData = dimensions.map((dim) => {
        const allScores = mediaScores.map(
          (ms) => ms.scores.find((s) => s.dimension === dim)?.score ?? 0
        );
        return {
          dimension: dim,
          us: mediaScores.find((ms) => ms.isUs)?.scores.find((s) => s.dimension === dim)?.score ?? 0,
          best: Math.max(...allScores),
        };
      });

      const improvements: string[] = [];
      for (const item of items) {
        if (item.gapAnalysis) improvements.push(item.gapAnalysis);
      }
      if (improvements.length === 0) {
        improvements.push("建议持续关注该话题的后续发展动态");
      }

      await db.insert(benchmarkAnalyses).values({
        organizationId: orgId,
        topicTitle: topItem.title,
        category,
        mediaScores,
        radarData,
        improvements,
      });
    }
  }

  await identifyMissedFromHotTopics(orgId);
}

export async function identifyMissedFromHotTopics(orgId: string): Promise<void> {
  const p0Topics = await db
    .select({ id: hotTopics.id, title: hotTopics.title, heatScore: hotTopics.heatScore, category: hotTopics.category, platforms: hotTopics.platforms })
    .from(hotTopics)
    .where(and(eq(hotTopics.organizationId, orgId), eq(hotTopics.priority, "P0")));

  for (const topic of p0Topics) {
    // Check if article with similar title exists
    const [match] = await db
      .select({ id: articles.id })
      .from(articles)
      .where(and(eq(articles.organizationId, orgId), sql`${articles.title} ILIKE ${"%" + topic.title.slice(0, 20) + "%"}`))
      .limit(1);

    if (match) continue;

    // Check if already in missedTopics
    const [existing] = await db
      .select({ id: missedTopics.id })
      .from(missedTopics)
      .where(and(eq(missedTopics.organizationId, orgId), sql`${missedTopics.title} = ${topic.title}`))
      .limit(1);

    if (existing) continue;

    await db.insert(missedTopics).values({
      organizationId: orgId,
      title: topic.title,
      priority: "high",
      discoveredAt: new Date(),
      competitors: [],
      heatScore: topic.heatScore || 0,
      category: topic.category || "综合",
      type: "trending",
      status: "missed",
      sourceType: "social_hot",
      sourcePlatform: ((topic.platforms as string[]) ?? [])[0] ?? "热搜",
    });
  }
}

import { db } from "@/db";
import { missedTopics, benchmarkPosts, benchmarkAccounts, myPosts } from "@/db/schema";
import { and, eq, gte, lte, desc, ilike, sql, inArray } from "drizzle-orm";

export interface MissingTopicRow {
  id: string;
  title: string;
  topic: string | null;
  decision: "covered" | "suspected" | "confirmed" | "excluded" | "pushed";
  pushStatus: "not_pushed" | "pushed" | "push_failed";
  uiStatus: "covered" | "suspected" | "confirmed" | "excluded" | "pushed";
  heatScore: number;
  discoveredAt: string;
  primaryBenchmarkPostId: string;
  primarySourceName: string | null;
  primarySourceLevel: string | null;
  primarySourcePlatform: string | null;
  primarySourceUrl: string | null;
  relatedCount: number;
  matchedMyPostId: string | null;
  matchedMyPostTitle: string | null;
}

function mapUiStatus(
  decision: MissingTopicRow["decision"],
  pushStatus: MissingTopicRow["pushStatus"]
): MissingTopicRow["uiStatus"] {
  if (decision === "covered") return "covered";
  if (decision === "excluded") return "excluded";
  if (pushStatus === "pushed") return "pushed";
  return decision;
}

export interface ListMissingTopicsFilters {
  decisions?: Array<"covered" | "suspected" | "confirmed" | "excluded">;
  pushStatuses?: Array<"not_pushed" | "pushed" | "push_failed">;
  keyword?: string;
  minHeatScore?: number;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export async function listMissingTopics(
  orgId: string,
  filters: ListMissingTopicsFilters = {}
): Promise<{ items: MissingTopicRow[]; total: number }> {
  const { decisions, pushStatuses, keyword, minHeatScore, from, to, page = 1, pageSize = 50 } =
    filters;

  const conditions = [eq(missedTopics.organizationId, orgId)];
  if (decisions?.length) conditions.push(inArray(missedTopics.decision, decisions));
  if (pushStatuses?.length) conditions.push(inArray(missedTopics.pushStatus, pushStatuses));
  if (keyword?.trim()) conditions.push(ilike(missedTopics.title, `%${keyword.trim()}%`));
  if (typeof minHeatScore === "number")
    conditions.push(gte(missedTopics.heatScore, minHeatScore));
  if (from) conditions.push(gte(missedTopics.discoveredAt, new Date(from)));
  if (to) conditions.push(lte(missedTopics.discoveredAt, new Date(to)));

  const where = and(...conditions);

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: missedTopics.id,
        title: missedTopics.title,
        topic: missedTopics.topic,
        decision: missedTopics.decision,
        pushStatus: missedTopics.pushStatus,
        heatScore: missedTopics.heatScore,
        discoveredAt: missedTopics.discoveredAt,
        relatedIds: missedTopics.relatedBenchmarkPostIds,
        matchedMyPostId: missedTopics.matchedMyPostId,
        matchedMyPostTitleSnapshot: missedTopics.matchedMyPostTitleSnapshot,
        primaryBenchmarkPostId: missedTopics.primaryBenchmarkPostId,
        primaryPostTitle: benchmarkPosts.title,
        primaryPostUrl: benchmarkPosts.sourceUrl,
        accountName: benchmarkAccounts.name,
        accountLevel: benchmarkAccounts.level,
        accountPlatform: benchmarkAccounts.platform,
      })
      .from(missedTopics)
      .leftJoin(
        benchmarkPosts,
        eq(missedTopics.primaryBenchmarkPostId, benchmarkPosts.id)
      )
      .leftJoin(
        benchmarkAccounts,
        eq(benchmarkPosts.benchmarkAccountId, benchmarkAccounts.id)
      )
      .where(where)
      .orderBy(desc(missedTopics.discoveredAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)::int` }).from(missedTopics).where(where),
  ]);

  const items: MissingTopicRow[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    topic: r.topic,
    decision: r.decision,
    pushStatus: r.pushStatus as MissingTopicRow["pushStatus"],
    uiStatus: mapUiStatus(
      r.decision,
      r.pushStatus as MissingTopicRow["pushStatus"]
    ),
    heatScore: Math.round(r.heatScore ?? 0),
    discoveredAt: r.discoveredAt.toISOString(),
    primaryBenchmarkPostId: r.primaryBenchmarkPostId,
    primarySourceName: r.accountName,
    primarySourceLevel: r.accountLevel,
    primarySourcePlatform: r.accountPlatform,
    primarySourceUrl: r.primaryPostUrl,
    relatedCount: ((r.relatedIds as string[]) ?? []).length,
    matchedMyPostId: r.matchedMyPostId,
    matchedMyPostTitle: r.matchedMyPostTitleSnapshot,
  }));

  return { items, total: totalRow[0]?.count ?? 0 };
}

// ---------------------------------------------------------------------------
// 详情页
// ---------------------------------------------------------------------------

export interface MissingTopicBenchmarkReport {
  id: string;
  title: string;
  summary: string | null;
  body: string | null;
  sourceUrl: string | null;
  publishedAt: string | null;
  views: number;
  likes: number;
  accountId: string;
  accountName: string;
  accountLevel: string;
  accountPlatform: string;
  accountRegion: string | null;
}

export interface MissingTopicComparisonAnalysis {
  summary: string;
  mediaPerspectives: Array<{
    accountName: string;
    level: string;
    angle: string;
    keyPoints: string[];
    tone: string;
    differentiator: string;
  }>;
  dimensionComparison: Array<{
    dimension: string;
    winners: string[];
    comment: string;
  }>;
  coverageGaps: Array<{
    gap: string;
    suggestion: string;
    urgency: "high" | "medium" | "low";
  }>;
  recommendedAngle: string;
  recommendedHeadline: string;
}

export interface MissingTopicDetail {
  id: string;
  title: string;
  topic: string | null;
  decision: MissingTopicRow["decision"];
  pushStatus: MissingTopicRow["pushStatus"];
  uiStatus: MissingTopicRow["uiStatus"];
  heatScore: number;
  discoveredAt: string;
  contentFingerprint: string | null;

  // 覆盖/排除/推送审计
  matchedMyPostId: string | null;
  matchedMyPostTitle: string | null;
  excludedReasonCode: string | null;
  excludedReasonText: string | null;
  confirmedAt: string | null;
  pushedAt: string | null;
  pushErrorMessage: string | null;

  // 所有报道此话题的对标媒体
  primaryReport: MissingTopicBenchmarkReport | null;
  relatedReports: MissingTopicBenchmarkReport[];

  // 缓存的对比分析
  comparisonAnalysis: MissingTopicComparisonAnalysis | null;
  analyzedAt: string | null;
}

export async function getMissingTopicDetail(
  orgId: string,
  topicId: string
): Promise<MissingTopicDetail | null> {
  const [topic] = await db
    .select()
    .from(missedTopics)
    .where(and(eq(missedTopics.id, topicId), eq(missedTopics.organizationId, orgId)))
    .limit(1);
  if (!topic) return null;

  // 汇总所有相关 benchmark_post ids
  const postIds = [
    topic.primaryBenchmarkPostId,
    ...((topic.relatedBenchmarkPostIds as string[]) ?? []),
  ];

  let reports: MissingTopicBenchmarkReport[] = [];
  if (postIds.length > 0) {
    const rows = await db
      .select({
        id: benchmarkPosts.id,
        title: benchmarkPosts.title,
        summary: benchmarkPosts.summary,
        body: benchmarkPosts.body,
        sourceUrl: benchmarkPosts.sourceUrl,
        publishedAt: benchmarkPosts.publishedAt,
        views: benchmarkPosts.views,
        likes: benchmarkPosts.likes,
        accountId: benchmarkAccounts.id,
        accountName: benchmarkAccounts.name,
        accountLevel: benchmarkAccounts.level,
        accountPlatform: benchmarkAccounts.platform,
        accountRegion: benchmarkAccounts.region,
      })
      .from(benchmarkPosts)
      .innerJoin(benchmarkAccounts, eq(benchmarkPosts.benchmarkAccountId, benchmarkAccounts.id))
      .where(inArray(benchmarkPosts.id, postIds))
      .orderBy(desc(benchmarkPosts.publishedAt));

    reports = rows.map((r) => ({
      id: r.id,
      title: r.title,
      summary: r.summary,
      body: r.body,
      sourceUrl: r.sourceUrl,
      publishedAt: r.publishedAt?.toISOString() ?? null,
      views: r.views ?? 0,
      likes: r.likes ?? 0,
      accountId: r.accountId,
      accountName: r.accountName,
      accountLevel: r.accountLevel,
      accountPlatform: r.accountPlatform,
      accountRegion: r.accountRegion,
    }));
  }

  const primaryReport =
    reports.find((r) => r.id === topic.primaryBenchmarkPostId) ?? null;
  const relatedReports = reports.filter((r) => r.id !== topic.primaryBenchmarkPostId);

  const aiSummary = topic.aiSummary as MissingTopicComparisonAnalysis | null;

  return {
    id: topic.id,
    title: topic.title,
    topic: topic.topic,
    decision: topic.decision,
    pushStatus: topic.pushStatus as MissingTopicRow["pushStatus"],
    uiStatus: mapUiStatus(
      topic.decision,
      topic.pushStatus as MissingTopicRow["pushStatus"]
    ),
    heatScore: Math.round(topic.heatScore ?? 0),
    discoveredAt: topic.discoveredAt.toISOString(),
    contentFingerprint: topic.contentFingerprint,

    matchedMyPostId: topic.matchedMyPostId,
    matchedMyPostTitle: topic.matchedMyPostTitleSnapshot,
    excludedReasonCode: topic.excludedReasonCode,
    excludedReasonText: topic.excludedReasonText,
    confirmedAt: topic.confirmedAt?.toISOString() ?? null,
    pushedAt: topic.pushedAt?.toISOString() ?? null,
    pushErrorMessage: topic.pushErrorMessage,

    primaryReport,
    relatedReports,
    comparisonAnalysis:
      aiSummary && typeof aiSummary === "object" && "mediaPerspectives" in aiSummary
        ? aiSummary
        : null,
    analyzedAt: topic.updatedAt.toISOString(),
  };
}

export async function getMissingTopicKpis(orgId: string) {
  const rows = await db
    .select({
      decision: missedTopics.decision,
      pushStatus: missedTopics.pushStatus,
      count: sql<number>`count(*)::int`,
    })
    .from(missedTopics)
    .where(eq(missedTopics.organizationId, orgId))
    .groupBy(missedTopics.decision, missedTopics.pushStatus);

  let total = 0;
  let suspected = 0;
  let confirmed = 0;
  let covered = 0;
  let pushed = 0;
  let excluded = 0;
  for (const r of rows) {
    total += r.count;
    if (r.decision === "suspected") suspected += r.count;
    if (r.decision === "confirmed") confirmed += r.count;
    if (r.decision === "covered") covered += r.count;
    if (r.decision === "excluded") excluded += r.count;
    if (r.pushStatus === "pushed") pushed += r.count;
  }
  const denom = Math.max(1, total - excluded);
  const coverageRate = Math.round((covered / denom) * 1000) / 10;

  return {
    totalClues: total,
    suspectedMissed: suspected,
    confirmedMissed: confirmed,
    covered,
    excluded,
    pushed,
    coverageRate,
  };
}

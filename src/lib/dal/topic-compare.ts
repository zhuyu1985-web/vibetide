import { db } from "@/db";
import {
  myPosts,
  myAccounts,
  myPostDistributions,
  topicMatches,
  benchmarkPosts,
  benchmarkAccounts,
} from "@/db/schema";
import { and, eq, desc, sql, inArray } from "drizzle-orm";
import type { TenDimensionAnalysis } from "@/lib/topic-matching/dimension-analyzer";

export interface TopicCompareListRow {
  id: string;
  title: string;
  summary: string | null;
  topic: string | null;
  publishedAt: string | null;

  // 聚合数据
  totalViews: number;
  totalLikes: number;
  totalShares: number;
  totalComments: number;

  // 多渠道发布
  distributionCount: number;
  distributions: Array<{
    accountId: string;
    accountName: string;
    accountPlatform: string;
    publishedUrl: string | null;
    publishedAt: string | null;
    views: number;
  }>;

  // 同题对标情况
  matchCount: number;
  hasAnalysis: boolean;
  lastAnalyzedAt: string | null;
  summaryExpired: boolean;
}

export async function listTopicCompareItems(
  orgId: string,
  filters: {
    platform?: string;
    accountId?: string;
    limit?: number;
  } = {}
): Promise<TopicCompareListRow[]> {
  const { platform, accountId, limit = 100 } = filters;

  // Step 1: 先按 filter 找到目标 my_post_ids（通过 distributions 过滤）
  let postIdCandidates: string[] | null = null;
  if (platform || accountId) {
    const distConditions = [];
    if (accountId) distConditions.push(eq(myPostDistributions.myAccountId, accountId));
    if (platform && !accountId)
      distConditions.push(eq(myAccounts.platform, platform as never));

    const rows = await db
      .select({ myPostId: myPostDistributions.myPostId })
      .from(myPostDistributions)
      .innerJoin(myAccounts, eq(myPostDistributions.myAccountId, myAccounts.id))
      .where(and(eq(myAccounts.organizationId, orgId), ...distConditions));

    postIdCandidates = Array.from(new Set(rows.map((r) => r.myPostId)));
    if (postIdCandidates.length === 0) return [];
  }

  // Step 2: 查 my_posts
  const postConditions = [eq(myPosts.organizationId, orgId)];
  if (postIdCandidates) postConditions.push(inArray(myPosts.id, postIdCandidates));

  const posts = await db
    .select({
      id: myPosts.id,
      title: myPosts.title,
      summary: myPosts.summary,
      topic: myPosts.topic,
      publishedAt: myPosts.publishedAt,
      totalViews: myPosts.totalViews,
      totalLikes: myPosts.totalLikes,
      totalShares: myPosts.totalShares,
      totalComments: myPosts.totalComments,
    })
    .from(myPosts)
    .where(and(...postConditions))
    .orderBy(desc(myPosts.publishedAt))
    .limit(limit);

  if (posts.length === 0) return [];

  const postIds = posts.map((p) => p.id);

  // Step 3: 批量查 distributions
  const distRows = await db
    .select({
      myPostId: myPostDistributions.myPostId,
      accountId: myAccounts.id,
      accountName: myAccounts.name,
      accountPlatform: myAccounts.platform,
      publishedUrl: myPostDistributions.publishedUrl,
      publishedAt: myPostDistributions.publishedAt,
      views: myPostDistributions.views,
    })
    .from(myPostDistributions)
    .innerJoin(myAccounts, eq(myPostDistributions.myAccountId, myAccounts.id))
    .where(inArray(myPostDistributions.myPostId, postIds));

  const distByPost = new Map<string, typeof distRows>();
  for (const d of distRows) {
    if (!distByPost.has(d.myPostId)) distByPost.set(d.myPostId, []);
    distByPost.get(d.myPostId)!.push(d);
  }

  // Step 4: 批量查 topic_matches
  const matchRows = await db
    .select({
      myPostId: topicMatches.myPostId,
      matchCount: topicMatches.matchCount,
      aiAnalysis: topicMatches.aiAnalysis,
      aiAnalysisAt: topicMatches.aiAnalysisAt,
      expiresAt: topicMatches.expiresAt,
    })
    .from(topicMatches)
    .where(and(eq(topicMatches.organizationId, orgId), inArray(topicMatches.myPostId, postIds)));

  const matchByPost = new Map<string, (typeof matchRows)[number]>();
  for (const m of matchRows) matchByPost.set(m.myPostId, m);

  // Step 5: 组装
  const now = Date.now();
  return posts.map((p) => {
    const match = matchByPost.get(p.id);
    const hasAnalysis = !!(
      match?.aiAnalysis &&
      (match.aiAnalysis as { overallVerdict?: string }).overallVerdict
    );
    const summaryExpired =
      (match?.expiresAt && match.expiresAt.getTime() < now) ?? false;
    const dists = distByPost.get(p.id) ?? [];

    return {
      id: p.id,
      title: p.title,
      summary: p.summary,
      topic: p.topic,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      totalViews: p.totalViews ?? 0,
      totalLikes: p.totalLikes ?? 0,
      totalShares: p.totalShares ?? 0,
      totalComments: p.totalComments ?? 0,
      distributionCount: dists.length,
      distributions: dists.map((d) => ({
        accountId: d.accountId,
        accountName: d.accountName,
        accountPlatform: d.accountPlatform,
        publishedUrl: d.publishedUrl,
        publishedAt: d.publishedAt?.toISOString() ?? null,
        views: d.views ?? 0,
      })),
      matchCount: match?.matchCount ?? 0,
      hasAnalysis,
      lastAnalyzedAt: match?.aiAnalysisAt?.toISOString() ?? null,
      summaryExpired,
    };
  });
}

// ---------------------------------------------------------------------------
// 详情页
// ---------------------------------------------------------------------------

export interface TopicCompareDetail {
  myPost: {
    id: string;
    title: string;
    summary: string | null;
    body: string | null;
    topic: string | null;
    publishedAt: string | null;
    originalSourceUrl: string | null;
    totalViews: number;
    totalLikes: number;
    totalShares: number;
    totalComments: number;
  };
  distributions: Array<{
    id: string;
    accountId: string;
    accountName: string;
    accountPlatform: string;
    publishedUrl: string | null;
    publishedAt: string | null;
    views: number;
    likes: number;
    shares: number;
    comments: number;
  }>;
  match: {
    matchCount: number;
    similarityScore: number | null;
    overallTopic: string;
    benchmarkPostIds: string[];
    aiAnalysis: TenDimensionAnalysis | null;
    radarData: Array<{ dimension: string; score: number }> | null;
    lastAnalyzedAt: string | null;
    summaryExpired: boolean;
  } | null;
  benchmarkReports: Array<{
    id: string;
    title: string;
    summary: string | null;
    body: string | null;
    sourceUrl: string | null;
    publishedAt: string | null;
    accountId: string;
    accountName: string;
    accountLevel: string;
    accountPlatform: string;
    views: number;
    likes: number;
    similarityScore: number;
    reason: string;
  }>;
}

export async function getTopicCompareDetail(
  orgId: string,
  myPostId: string
): Promise<TopicCompareDetail | null> {
  const [post] = await db
    .select()
    .from(myPosts)
    .where(and(eq(myPosts.id, myPostId), eq(myPosts.organizationId, orgId)))
    .limit(1);
  if (!post) return null;

  // distributions
  const dists = await db
    .select({
      id: myPostDistributions.id,
      accountId: myAccounts.id,
      accountName: myAccounts.name,
      accountPlatform: myAccounts.platform,
      publishedUrl: myPostDistributions.publishedUrl,
      publishedAt: myPostDistributions.publishedAt,
      views: myPostDistributions.views,
      likes: myPostDistributions.likes,
      shares: myPostDistributions.shares,
      comments: myPostDistributions.comments,
    })
    .from(myPostDistributions)
    .innerJoin(myAccounts, eq(myPostDistributions.myAccountId, myAccounts.id))
    .where(eq(myPostDistributions.myPostId, myPostId));

  // topic_match
  const [match] = await db
    .select()
    .from(topicMatches)
    .where(eq(topicMatches.myPostId, myPostId))
    .limit(1);

  // benchmark reports
  const benchmarkReports: TopicCompareDetail["benchmarkReports"] = [];
  if (match) {
    const ids = (match.benchmarkPostIds as string[]) ?? [];
    const reasons =
      (match.matchedReasons as Array<{
        benchmarkPostId: string;
        similarityScore: number;
        reason: string;
      }>) ?? [];
    const reasonMap = new Map(reasons.map((r) => [r.benchmarkPostId, r]));

    if (ids.length > 0) {
      const benchRows = await db
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
        })
        .from(benchmarkPosts)
        .innerJoin(
          benchmarkAccounts,
          eq(benchmarkPosts.benchmarkAccountId, benchmarkAccounts.id)
        )
        .where(inArray(benchmarkPosts.id, ids))
        .orderBy(desc(benchmarkPosts.publishedAt));

      for (const row of benchRows) {
        const reasonEntry = reasonMap.get(row.id);
        benchmarkReports.push({
          id: row.id,
          title: row.title,
          summary: row.summary,
          body: row.body,
          sourceUrl: row.sourceUrl,
          publishedAt: row.publishedAt?.toISOString() ?? null,
          accountId: row.accountId,
          accountName: row.accountName,
          accountLevel: row.accountLevel,
          accountPlatform: row.accountPlatform,
          views: row.views ?? 0,
          likes: row.likes ?? 0,
          similarityScore: reasonEntry?.similarityScore ?? 0.85,
          reason: reasonEntry?.reason ?? "",
        });
      }
    }
  }

  return {
    myPost: {
      id: post.id,
      title: post.title,
      summary: post.summary,
      body: post.body,
      topic: post.topic,
      publishedAt: post.publishedAt?.toISOString() ?? null,
      originalSourceUrl: post.originalSourceUrl,
      totalViews: post.totalViews ?? 0,
      totalLikes: post.totalLikes ?? 0,
      totalShares: post.totalShares ?? 0,
      totalComments: post.totalComments ?? 0,
    },
    distributions: dists.map((d) => ({
      id: d.id,
      accountId: d.accountId,
      accountName: d.accountName,
      accountPlatform: d.accountPlatform,
      publishedUrl: d.publishedUrl,
      publishedAt: d.publishedAt?.toISOString() ?? null,
      views: d.views ?? 0,
      likes: d.likes ?? 0,
      shares: d.shares ?? 0,
      comments: d.comments ?? 0,
    })),
    match: match
      ? {
          matchCount: match.matchCount,
          similarityScore: match.similarityScore,
          overallTopic:
            (match.aiAnalysis as { overallTopic?: string } | null)?.overallTopic ?? "",
          benchmarkPostIds: (match.benchmarkPostIds as string[]) ?? [],
          aiAnalysis:
            (match.aiAnalysis as TenDimensionAnalysis & { overallTopic?: string } | null) &&
            (match.aiAnalysis as TenDimensionAnalysis).overallVerdict
              ? (match.aiAnalysis as TenDimensionAnalysis)
              : null,
          radarData:
            (match.radarData as Array<{ dimension: string; score: number }> | null) ?? null,
          lastAnalyzedAt: match.aiAnalysisAt?.toISOString() ?? null,
          summaryExpired:
            (match.expiresAt && match.expiresAt.getTime() < Date.now()) ?? false,
        }
      : null,
    benchmarkReports,
  };
}

/**
 * 供列表顶部渠道/账号筛选器用
 */
export async function listTopicComparePlatformOptions(
  orgId: string
): Promise<Array<{
  platform: string;
  accounts: Array<{ id: string; name: string; handle: string; postCount: number }>;
}>> {
  const rows = await db
    .select({
      platform: myAccounts.platform,
      id: myAccounts.id,
      name: myAccounts.name,
      handle: myAccounts.handle,
      postCount: sql<number>`count(${myPostDistributions.id})::int`,
    })
    .from(myAccounts)
    .leftJoin(myPostDistributions, eq(myPostDistributions.myAccountId, myAccounts.id))
    .where(and(eq(myAccounts.organizationId, orgId), eq(myAccounts.isEnabled, true)))
    .groupBy(myAccounts.id, myAccounts.platform, myAccounts.name, myAccounts.handle);

  const byPlatform = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!byPlatform.has(r.platform)) byPlatform.set(r.platform, []);
    byPlatform.get(r.platform)!.push(r);
  }
  return Array.from(byPlatform.entries()).map(([platform, accounts]) => ({
    platform,
    accounts: accounts
      .filter((a) => a.postCount > 0)
      .map((a) => ({ id: a.id, name: a.name, handle: a.handle, postCount: a.postCount })),
  }));
}

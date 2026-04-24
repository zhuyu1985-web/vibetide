import { db } from "@/db";
import { myPosts, topicMatches } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { recallCandidates } from "./keyword-recall";
import { matchSameTopicViaLLM } from "./llm-matcher";

/**
 * 对一条 my_post 执行同题匹配：
 *   1. 关键词召回候选（benchmark_posts）
 *   2. LLM 判定同题
 *   3. upsert 到 topic_matches
 *
 * 缓存：topic_matches.expiresAt（默认 2h）；forceRefresh 可强制重跑。
 */

export interface FindMatchesResult {
  myPostId: string;
  matchCount: number;
  matches: Array<{
    benchmarkPostId: string;
    similarityScore: number;
    reason: string;
  }>;
  overallTopic: string;
  cached: boolean;
}

export async function findSameTopicMatches(params: {
  orgId: string;
  myPostId: string;
  forceRefresh?: boolean;
}): Promise<FindMatchesResult> {
  const { orgId, myPostId, forceRefresh = false } = params;

  // 读 my_post
  const [post] = await db
    .select()
    .from(myPosts)
    .where(and(eq(myPosts.id, myPostId), eq(myPosts.organizationId, orgId)))
    .limit(1);
  if (!post) throw new Error("作品不存在或无权访问");

  // 命中缓存短路
  if (!forceRefresh) {
    const [existing] = await db
      .select()
      .from(topicMatches)
      .where(eq(topicMatches.myPostId, myPostId))
      .limit(1);
    if (
      existing &&
      existing.expiresAt &&
      existing.expiresAt.getTime() > Date.now()
    ) {
      const ids = (existing.benchmarkPostIds as string[]) ?? [];
      const reasons = (existing.matchedReasons as Array<{
        benchmarkPostId: string;
        similarityScore: number;
        reason: string;
      }>) ?? [];
      return {
        myPostId,
        matchCount: ids.length,
        matches: reasons,
        overallTopic: (existing.aiAnalysis as { overallTopic?: string } | null)?.overallTopic ?? "",
        cached: true,
      };
    }
  }

  // 召回候选
  const candidates = await recallCandidates({
    orgId,
    title: post.title,
    publishedAt: post.publishedAt,
    topK: 30,
    timeWindowHours: 72,
  });

  // LLM 判定
  let matchedFromLLM: Awaited<ReturnType<typeof matchSameTopicViaLLM>> = {
    matched: [],
    overallTopic: "",
  };
  if (candidates.length > 0) {
    try {
      matchedFromLLM = await matchSameTopicViaLLM({
        myPostTitle: post.title,
        myPostBody: post.body ?? post.summary ?? "",
        candidates,
      });
    } catch (err) {
      console.error("[topic-matching] LLM 判定失败，回退到关键词 Top-5:", err);
      // Fallback：关键词 Top-5 作为匹配结果，分数统一给 0.5
      matchedFromLLM = {
        matched: candidates.slice(0, 5).map((c) => ({
          candidateId: c.id,
          similarityScore: 0.5,
          reason: "关键词召回（LLM 降级）",
        })),
        overallTopic: post.topic ?? post.title,
      };
    }
  }

  const matchedIds = matchedFromLLM.matched.map((m) => m.candidateId);
  const matchedReasons = matchedFromLLM.matched.map((m) => ({
    benchmarkPostId: m.candidateId,
    similarityScore: m.similarityScore,
    reason: m.reason,
  }));

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 2 * 3600 * 1000); // 2h

  // upsert topic_matches
  await db
    .insert(topicMatches)
    .values({
      organizationId: orgId,
      myPostId,
      benchmarkPostIds: matchedIds,
      matchCount: matchedIds.length,
      similarityScore: matchedFromLLM.matched.length
        ? matchedFromLLM.matched.reduce((s, m) => s + m.similarityScore, 0) /
          matchedFromLLM.matched.length
        : 0,
      matchedBy: "llm",
      matchedReasons,
      aiAnalysis: { overallTopic: matchedFromLLM.overallTopic },
      aiAnalysisSource: "benchmark_posts",
      aiAnalysisAt: now,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: topicMatches.myPostId,
      set: {
        benchmarkPostIds: matchedIds,
        matchCount: matchedIds.length,
        similarityScore: matchedFromLLM.matched.length
          ? matchedFromLLM.matched.reduce((s, m) => s + m.similarityScore, 0) /
            matchedFromLLM.matched.length
          : 0,
        matchedReasons,
        aiAnalysisAt: now,
        expiresAt,
        updatedAt: now,
      },
    });

  return {
    myPostId,
    matchCount: matchedIds.length,
    matches: matchedReasons,
    overallTopic: matchedFromLLM.overallTopic,
    cached: false,
  };
}

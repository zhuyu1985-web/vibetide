import { db } from "@/db";
import {
  benchmarkPosts,
  benchmarkAccounts,
  missedTopics,
} from "@/db/schema";
import { and, eq, gte, lte, or, sql, isNull, inArray, ne, desc } from "drizzle-orm";
import { matchSameTopicViaLLM } from "./llm-matcher";
import type { CandidatePost } from "./keyword-recall";

/**
 * 为某条 missed_topic 做"语义扩展搜索"：
 *   用 primary benchmark_post 的标题 + 正文作为锚点，
 *   找到其他账号可能改写了标题但报道同一事件的帖子，
 *   写回到 related_benchmark_post_ids。
 *
 * 与 find-matches（给 my_post 用）的区别：
 *   这里的锚点是对标账号的一篇报道，对其他对标账号做同题检索。
 */
export async function expandMissedTopic(params: {
  orgId: string;
  topicId: string;
}): Promise<{ expanded: number; totalRelated: number }> {
  const { orgId, topicId } = params;

  const [topic] = await db
    .select()
    .from(missedTopics)
    .where(and(eq(missedTopics.id, topicId), eq(missedTopics.organizationId, orgId)))
    .limit(1);
  if (!topic) throw new Error("漏题不存在");

  // 读取 primary post
  const [primary] = await db
    .select({
      id: benchmarkPosts.id,
      title: benchmarkPosts.title,
      summary: benchmarkPosts.summary,
      body: benchmarkPosts.body,
      publishedAt: benchmarkPosts.publishedAt,
    })
    .from(benchmarkPosts)
    .where(eq(benchmarkPosts.id, topic.primaryBenchmarkPostId))
    .limit(1);
  if (!primary) throw new Error("主 benchmark_post 不存在");

  const existingRelated = new Set<string>(
    (topic.relatedBenchmarkPostIds as string[]) ?? []
  );
  existingRelated.add(primary.id);

  // 关键词召回：时间窗 ±96h（比 my_post 宽松）
  const keywords = extractKeywords(primary.title);
  if (keywords.length === 0) return { expanded: 0, totalRelated: existingRelated.size - 1 };

  const publishedAt = primary.publishedAt ?? new Date();
  const from = new Date(publishedAt.getTime() - 96 * 3600_000);
  const to = new Date(publishedAt.getTime() + 96 * 3600_000);

  const keywordConds = keywords.map((kw) =>
    or(
      sql`${benchmarkPosts.title} ILIKE ${"%" + kw + "%"}`,
      sql`${benchmarkPosts.summary} ILIKE ${"%" + kw + "%"}`,
      sql`${benchmarkPosts.body} ILIKE ${"%" + kw + "%"}`
    )
  );

  const candidates = await db
    .select({
      id: benchmarkPosts.id,
      title: benchmarkPosts.title,
      summary: benchmarkPosts.summary,
      body: benchmarkPosts.body,
      topic: benchmarkPosts.topic,
      publishedAt: benchmarkPosts.publishedAt,
      sourceUrl: benchmarkPosts.sourceUrl,
      accountId: benchmarkAccounts.id,
      accountName: benchmarkAccounts.name,
      accountHandle: benchmarkAccounts.handle,
      accountLevel: benchmarkAccounts.level,
      accountPlatform: benchmarkAccounts.platform,
    })
    .from(benchmarkPosts)
    .innerJoin(benchmarkAccounts, eq(benchmarkPosts.benchmarkAccountId, benchmarkAccounts.id))
    .where(
      and(
        or(
          isNull(benchmarkAccounts.organizationId),
          eq(benchmarkAccounts.organizationId, orgId)
        ),
        eq(benchmarkAccounts.isEnabled, true),
        gte(benchmarkPosts.publishedAt, from),
        lte(benchmarkPosts.publishedAt, to),
        ne(benchmarkPosts.id, primary.id),
        or(...keywordConds)
      )
    )
    .orderBy(desc(benchmarkPosts.publishedAt))
    .limit(30);

  if (candidates.length === 0) {
    return { expanded: 0, totalRelated: existingRelated.size - 1 };
  }

  // LLM 判定同题（锚点是 primary post）
  let matched: Array<{ candidateId: string; similarityScore: number; reason: string }> = [];
  try {
    const result = await matchSameTopicViaLLM({
      myPostTitle: primary.title,
      myPostBody: primary.body ?? primary.summary ?? "",
      candidates: candidates as CandidatePost[],
      minScore: 0.7,
    });
    matched = result.matched;
  } catch (err) {
    console.error("[expand-missed-topic] LLM 降级为关键词 Top-5:", err);
    matched = candidates.slice(0, 5).map((c) => ({
      candidateId: c.id,
      similarityScore: 0.6,
      reason: "关键词召回",
    }));
  }

  let expanded = 0;
  for (const m of matched) {
    if (!existingRelated.has(m.candidateId)) {
      existingRelated.add(m.candidateId);
      expanded++;
    }
  }

  // 回写
  const nextRelated = Array.from(existingRelated).filter((id) => id !== primary.id);
  await db
    .update(missedTopics)
    .set({
      relatedBenchmarkPostIds: nextRelated,
      updatedAt: new Date(),
    })
    .where(eq(missedTopics.id, topicId));

  return { expanded, totalRelated: nextRelated.length };
}

function extractKeywords(title: string): string[] {
  if (!title) return [];
  const cleaned = title.replace(/[，。、：；！？（）【】《》""''—\-,.!?()\[\]<>:"]/g, " ").trim();
  const tokens = cleaned.split(/\s+/).filter((t) => t.length >= 2);
  const grams: string[] = [];
  for (const tk of tokens) {
    if (tk.length >= 4) {
      grams.push(tk.slice(0, 4));
      if (tk.length >= 6) grams.push(tk.slice(0, 6));
    }
  }
  return Array.from(new Set([...tokens, ...grams])).slice(0, 8);
}

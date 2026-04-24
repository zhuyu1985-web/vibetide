import { db } from "@/db";
import { benchmarkPosts, benchmarkAccounts } from "@/db/schema";
import { and, eq, gte, lte, or, sql, isNull, desc } from "drizzle-orm";

export interface CandidatePost {
  id: string;
  title: string;
  summary: string | null;
  body: string | null;
  topic: string | null;
  publishedAt: Date | null;
  sourceUrl: string | null;
  accountId: string;
  accountName: string;
  accountHandle: string;
  accountLevel: string;
  accountPlatform: string;
}

/**
 * 关键词召回：按标题/摘要/正文 trigram 近似匹配 + 发布时间窗 ±72h。
 *
 * 返回 Top-K 候选，之后由 LLM 判定是否真同题。
 */
export async function recallCandidates(params: {
  orgId: string;
  title: string;
  publishedAt: Date | null;
  topK?: number;
  timeWindowHours?: number;
}): Promise<CandidatePost[]> {
  const { title, publishedAt, topK = 30, timeWindowHours = 72 } = params;

  const keywords = extractKeywords(title);
  if (keywords.length === 0) return [];

  // 时间窗
  const baseTime = publishedAt ? publishedAt.getTime() : Date.now();
  const from = new Date(baseTime - timeWindowHours * 3600 * 1000);
  const to = new Date(baseTime + timeWindowHours * 3600 * 1000);

  // 关键词 OR ILIKE
  const keywordConds = keywords.map((kw) =>
    or(
      sql`${benchmarkPosts.title} ILIKE ${"%" + kw + "%"}`,
      sql`${benchmarkPosts.summary} ILIKE ${"%" + kw + "%"}`,
      sql`${benchmarkPosts.body} ILIKE ${"%" + kw + "%"}`
    )
  );

  const rows = await db
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
          eq(benchmarkAccounts.organizationId, params.orgId)
        ),
        eq(benchmarkAccounts.isEnabled, true),
        gte(benchmarkPosts.publishedAt, from),
        lte(benchmarkPosts.publishedAt, to),
        or(...keywordConds)
      )
    )
    .orderBy(desc(benchmarkPosts.publishedAt))
    .limit(topK);

  return rows.map((r) => ({
    ...r,
    accountLevel: r.accountLevel,
    accountPlatform: r.accountPlatform,
  }));
}

function extractKeywords(title: string): string[] {
  if (!title) return [];
  const cleaned = title
    .replace(/[，。、：；！？（）【】《》""''—\-—,.!?()\[\]<>:"]/g, " ")
    .trim();
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

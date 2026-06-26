import { inngest } from "@/inngest/client";
import type { InngestEvents } from "@/inngest/events";
import { db } from "@/db";
import { articles, categories } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { analyzeArticleStructured } from "@/lib/articles/analyze";
import { appendMessage } from "@/lib/dal/cowork-conversations";

type Data = InngestEvents["article/ai-analysis.requested"]["data"];

/** 核心逻辑：载稿 → 结构化分析 → 写回字段 + 状态机 → 分析卡。 */
export async function runArticleAiAnalyze(data: Data): Promise<void> {
  const article = await db.query.articles.findFirst({
    where: and(
      eq(articles.id, data.articleId),
      eq(articles.organizationId, data.organizationId),
    ),
    columns: { id: true, title: true, body: true, metadata: true },
  });
  if (!article) return;

  await db
    .update(articles)
    .set({ aiAnalysisStatus: "processing" })
    .where(eq(articles.id, data.articleId));

  // org 现有分类名作为候选允许值，供 AI 择一
  const cats = await db.query.categories.findMany({
    where: eq(categories.organizationId, data.organizationId),
    columns: { id: true, name: true },
  });

  const digest = await analyzeArticleStructured({
    title: article.title,
    body: article.body ?? "",
    categories: cats.map((c) => c.name),
  });

  const matched = cats.find((c) => c.name === digest.category);
  const existingMeta = article.metadata ?? {};

  await db
    .update(articles)
    .set({
      summary: digest.summary,
      tags: digest.tags,
      keywords: digest.keyPoints,
      ...(matched ? { categoryId: matched.id } : {}),
      aiAnalysisStatus: "done",
      metadata: {
        ...existingMeta,
        aiDigest: digest,
        ...(matched ? {} : { suggestedCategory: digest.category }),
      },
      updatedAt: new Date(),
    })
    .where(eq(articles.id, data.articleId));

  if (data.conversationId) {
    await appendMessage(data.conversationId, {
      role: "assistant",
      kind: "import_card",
      content: `🧠 已完成结构化分析：${digest.tags.slice(0, 4).join(" · ")}`,
      meta: {
        stage: "analyzed",
        articleId: data.articleId,
        title: article.title,
        summary: digest.summary,
      },
    });
  }
}

export const articleAiAnalyze = inngest.createFunction(
  { id: "article-ai-analyze", retries: 2, concurrency: { limit: 5 } },
  { event: "article/ai-analysis.requested" },
  async ({ event, step }) => {
    await step.run("analyze", () => runArticleAiAnalyze(event.data));
    return { ok: true };
  },
);

/** 终态失败 → 标 failed + 失败卡。 */
export const articleAiAnalyzeFailureHandler = inngest.createFunction(
  { id: "article-ai-analyze-failure-handler", retries: 1 },
  { event: "inngest/function.failed" },
  async ({ event, step }) => {
    const d = event.data as Record<string, unknown>;
    if (d?.function_id !== "article-ai-analyze") return;
    const orig = (d?.event as { data?: Data } | undefined)?.data;
    if (!orig) return;
    await step.run("mark-failed", async () => {
      await db
        .update(articles)
        .set({ aiAnalysisStatus: "failed" })
        .where(eq(articles.id, orig.articleId));
      if (orig.conversationId) {
        await appendMessage(orig.conversationId, {
          role: "assistant",
          kind: "import_card",
          content: "❌ 结构化分析失败，可稍后在稿件详情页手动重试",
          meta: { stage: "failed", articleId: orig.articleId },
        });
      }
    });
  },
);

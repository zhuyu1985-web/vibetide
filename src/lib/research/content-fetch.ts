import { db } from "@/db";
import { newsArticles } from "@/db/schema/research/news-articles";
import { eq } from "drizzle-orm";
import { fetchViaJinaReader } from "@/lib/web-fetch";

export type ContentFetchResult =
  | { status: "done" }
  | { status: "skipped"; reason: string };

/**
 * 按 articleId 异步拉取正文并回填。
 *
 * 状态转移：
 *   pending/failed   → fetching → done          （成功）
 *                              → skipped        （空正文）
 *                              → failed + throw（Jina 出错，让 Inngest 重试）
 *   done/skipped     → 直接返回 skipped（幂等）
 *
 * 失败时先持久化 status=failed + 错误信息到 rawMetadata，然后抛出以触发
 * Inngest retry。重试时 status=failed 会被视为可重试（不在 done/skipped 白名单里）。
 */
export async function fetchAndUpdateArticleContent(
  articleId: string,
): Promise<ContentFetchResult> {
  const [row] = await db
    .select({
      id: newsArticles.id,
      url: newsArticles.url,
      contentFetchStatus: newsArticles.contentFetchStatus,
      rawMetadata: newsArticles.rawMetadata,
    })
    .from(newsArticles)
    .where(eq(newsArticles.id, articleId))
    .limit(1);

  if (!row) {
    throw new Error(`article ${articleId} not found`);
  }
  if (row.contentFetchStatus === "done" || row.contentFetchStatus === "skipped") {
    return { status: "skipped", reason: `already-${row.contentFetchStatus}` };
  }

  await db
    .update(newsArticles)
    .set({ contentFetchStatus: "fetching" })
    .where(eq(newsArticles.id, articleId));

  try {
    const { content } = await fetchViaJinaReader(row.url);
    if (!content || content.trim().length === 0) {
      await db
        .update(newsArticles)
        .set({ contentFetchStatus: "skipped" })
        .where(eq(newsArticles.id, articleId));
      return { status: "skipped", reason: "empty-content" };
    }

    await db
      .update(newsArticles)
      .set({ content, contentFetchStatus: "done" })
      .where(eq(newsArticles.id, articleId));

    return { status: "done" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const existingMeta = (row.rawMetadata as Record<string, unknown>) ?? {};
    await db
      .update(newsArticles)
      .set({
        contentFetchStatus: "failed",
        rawMetadata: { ...existingMeta, contentFetchError: msg },
      })
      .where(eq(newsArticles.id, articleId));
    throw e;
  }
}

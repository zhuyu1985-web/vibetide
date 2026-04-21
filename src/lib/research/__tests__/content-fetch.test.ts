import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { newsArticles } from "@/db/schema/research/news-articles";
import { eq } from "drizzle-orm";
import { fetchAndUpdateArticleContent } from "../content-fetch";

vi.mock("@/lib/web-fetch", () => ({
  fetchViaJinaReader: vi.fn(),
}));

// Re-import after mock is set up
const { fetchViaJinaReader } = await import("@/lib/web-fetch");
const mockedFetch = fetchViaJinaReader as unknown as ReturnType<typeof vi.fn>;

describe("fetchAndUpdateArticleContent", () => {
  let articleId: string;
  let url: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    url = `https://example.com/test-${randomUUID()}`;
    const [row] = await db
      .insert(newsArticles)
      .values({
        url,
        urlHash: `hash-${randomUUID()}`,
        title: "test article",
        content: null,
        sourceChannel: "hot_topic_crawler",
        contentFetchStatus: "pending",
      })
      .returning({ id: newsArticles.id });
    articleId = row.id;
  });

  afterEach(async () => {
    await db.delete(newsArticles).where(eq(newsArticles.id, articleId));
  });

  it("updates content and marks status=done on Jina success", async () => {
    mockedFetch.mockResolvedValue({ title: "t", content: "正文内容...." });

    const result = await fetchAndUpdateArticleContent(articleId);
    expect(result.status).toBe("done");

    const [row] = await db
      .select()
      .from(newsArticles)
      .where(eq(newsArticles.id, articleId));
    expect(row.content).toBe("正文内容....");
    expect(row.contentFetchStatus).toBe("done");
  });

  it("marks status=failed + stores error + throws on Jina failure", async () => {
    mockedFetch.mockRejectedValue(new Error("Jina 503"));

    await expect(fetchAndUpdateArticleContent(articleId)).rejects.toThrow("Jina 503");

    const [row] = await db
      .select()
      .from(newsArticles)
      .where(eq(newsArticles.id, articleId));
    expect(row.contentFetchStatus).toBe("failed");
    expect((row.rawMetadata as { contentFetchError?: string })?.contentFetchError).toBe("Jina 503");
  });

  it("marks status=skipped + returns skipped on empty content", async () => {
    mockedFetch.mockResolvedValue({ title: "t", content: "   " });

    const result = await fetchAndUpdateArticleContent(articleId);
    expect(result.status).toBe("skipped");
    expect((result as { reason: string }).reason).toBe("empty-content");

    const [row] = await db
      .select()
      .from(newsArticles)
      .where(eq(newsArticles.id, articleId));
    expect(row.contentFetchStatus).toBe("skipped");
  });

  it("is idempotent when status is already done", async () => {
    await db
      .update(newsArticles)
      .set({ content: "existing", contentFetchStatus: "done" })
      .where(eq(newsArticles.id, articleId));

    const result = await fetchAndUpdateArticleContent(articleId);
    expect(result.status).toBe("skipped");
    expect((result as { reason: string }).reason).toBe("already-done");
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it("retries on status=failed (does NOT treat failed as skipped)", async () => {
    await db
      .update(newsArticles)
      .set({ contentFetchStatus: "failed" })
      .where(eq(newsArticles.id, articleId));

    mockedFetch.mockResolvedValue({ title: "t", content: "终于拉到了" });

    const result = await fetchAndUpdateArticleContent(articleId);
    expect(result.status).toBe("done");
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });
});

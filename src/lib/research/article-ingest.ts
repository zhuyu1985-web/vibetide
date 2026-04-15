import { db } from "@/db";
import { newsArticles } from "@/db/schema/research/news-articles";
import { hashUrl } from "./url-hash";
import { matchOutletForUrl } from "./outlet-matcher";
import { eq } from "drizzle-orm";

export type ArticleIngestInput = {
  url: string;
  title: string;
  content?: string;
  publishedAt?: Date | null;
  sourceChannel: "tavily" | "whitelist_crawl" | "manual_url";
  organizationId: string;
  firstSeenResearchTaskId?: string;
  rawMetadata?: Record<string, unknown>;
};

/**
 * Upsert article by url_hash. Returns:
 *   { inserted: true, id }  — newly inserted
 *   { inserted: false, id } — already existed (no overwrite of content or task link)
 */
export async function ingestArticle(
  input: ArticleIngestInput,
): Promise<{ inserted: boolean; id: string }> {
  const urlHash = hashUrl(input.url);
  const match = await matchOutletForUrl(input.url, input.organizationId);

  const [row] = await db
    .insert(newsArticles)
    .values({
      url: input.url,
      urlHash,
      title: input.title,
      content: input.content,
      publishedAt: input.publishedAt ?? null,
      outletId: match?.outletId ?? null,
      outletTierSnapshot: match?.tier ?? null,
      districtIdSnapshot: match?.districtId ?? null,
      sourceChannel: input.sourceChannel,
      firstSeenResearchTaskId: input.firstSeenResearchTaskId ?? null,
      rawMetadata: input.rawMetadata,
    })
    .onConflictDoNothing({ target: newsArticles.urlHash })
    .returning({ id: newsArticles.id });

  if (row) return { inserted: true, id: row.id };

  const existing = await db
    .select({ id: newsArticles.id })
    .from(newsArticles)
    .where(eq(newsArticles.urlHash, urlHash))
    .limit(1);
  return { inserted: false, id: existing[0].id };
}

/**
 * Batch variant — inserts in a loop with per-item error isolation.
 */
export async function ingestArticlesBatch(
  items: ArticleIngestInput[],
): Promise<Array<{ url: string; inserted: boolean; id: string | null; error?: string }>> {
  const results: Array<{ url: string; inserted: boolean; id: string | null; error?: string }> = [];
  for (const item of items) {
    try {
      const r = await ingestArticle(item);
      results.push({ url: item.url, inserted: r.inserted, id: r.id });
    } catch (e) {
      results.push({
        url: item.url,
        inserted: false,
        id: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return results;
}

// A3 Phase 1 stub — research_news_articles table dropped.
// article-ingest.ts is scheduled for deletion in Phase 5.
// All callers (tavily-crawl, manual-url-ingest inngest functions) are also
// scheduled for deletion/rewrite in Phase 5; they remain compilable but no-op.

export type ArticleIngestInput = {
  url: string;
  title: string;
  content?: string | null;
  publishedAt?: Date | null;
  sourceChannel: "tavily" | "whitelist_crawl" | "manual_url" | "hot_topic_crawler";
  organizationId: string;
  firstSeenResearchTaskId?: string;
  rawMetadata?: Record<string, unknown>;
};

// A3 Phase 1 stub — research_news_articles dropped; Phase 5 deletes this file
export async function ingestArticle(
  input: ArticleIngestInput,
): Promise<{ inserted: boolean; id: string }> {
  console.warn("[a3-stub] ingestArticle: research_news_articles dropped, Phase 5 removes this");
  // Return a deterministic fake id derived from url so callers that chain on id don't crash
  return { inserted: false, id: "00000000-0000-0000-0000-000000000000" };
}

// A3 Phase 1 stub — batch variant
export async function ingestArticlesBatch(
  items: ArticleIngestInput[],
): Promise<Array<{ url: string; inserted: boolean; id: string | null; error?: string }>> {
  console.warn("[a3-stub] ingestArticlesBatch: research_news_articles dropped, Phase 5 removes this");
  return items.map((item) => ({ url: item.url, inserted: false, id: null }));
}

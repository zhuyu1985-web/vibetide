// A3 Phase 1 stub — research_news_articles table dropped.
// content-fetch.ts is scheduled for deletion in Phase 5.
// article-content-fetch inngest function remains compilable but events it handles
// will not be fired after A3 Phase 5 cleanup.

export type ContentFetchResult =
  | { status: "done" }
  | { status: "skipped"; reason: string };

// A3 Phase 1 stub — research_news_articles dropped; Phase 5 deletes this file
export async function fetchAndUpdateArticleContent(
  articleId: string,
): Promise<ContentFetchResult> {
  console.warn(
    `[a3-stub] fetchAndUpdateArticleContent(${articleId}): research_news_articles dropped, Phase 5 removes this`,
  );
  return { status: "skipped", reason: "a3-phase1-stub" };
}

// A3 Phase 1 stub — research_news_articles table dropped.
// bridgeCollectedItemToResearch previously wrote to research_news_articles.
// That bridge function needs rewrite in Phase 2 (or removal in Phase 5).
// All tests here are skipped until Phase 2/5 defines new bridge semantics.

import { describe, it } from "vitest";

describe("bridgeCollectedItemToResearch (A3 Phase 1 stub — table dropped)", () => {
  it.skip("inserts research annotation when source flag is true — disabled pending Phase 2 rewrite", () => {});
  it.skip("skips when source flag is false — disabled pending Phase 2 rewrite", () => {});
  it.skip("is idempotent on same url_hash — disabled pending Phase 2 rewrite", () => {});
  it.skip("skips when item has no canonical url — disabled pending Phase 2 rewrite", () => {});
});

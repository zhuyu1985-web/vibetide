// A3 Phase 1 stub — research_news_articles table dropped.
// These tests tested ingestArticle which wrote to research_news_articles.
// The table no longer exists; tests are stubbed to a no-op skip.
// Phase 5 will delete this test file alongside article-ingest.ts.

import { describe, it } from "vitest";

describe("ingestArticle (A3 Phase 1 stub — table dropped)", () => {
  it.skip("inserts on first call — disabled pending Phase 5 cleanup", () => {});
  it.skip("is idempotent on second call — disabled pending Phase 5 cleanup", () => {});
  it.skip("treats normalized-equivalent URLs as same article — disabled pending Phase 5 cleanup", () => {});
});

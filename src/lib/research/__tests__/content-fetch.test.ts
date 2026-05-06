// A3 Phase 1 stub — research_news_articles table dropped.
// These tests tested fetchAndUpdateArticleContent which read/wrote research_news_articles.
// The table no longer exists; tests are stubbed to a no-op skip.
// Phase 5 will delete this test file alongside content-fetch.ts.

import { describe, it } from "vitest";

describe("fetchAndUpdateArticleContent (A3 Phase 1 stub — table dropped)", () => {
  it.skip("updates content and marks status=done — disabled pending Phase 5 cleanup", () => {});
  it.skip("marks status=failed + stores error + throws — disabled pending Phase 5 cleanup", () => {});
  it.skip("marks status=skipped on empty content — disabled pending Phase 5 cleanup", () => {});
  it.skip("is idempotent when status is already done — disabled pending Phase 5 cleanup", () => {});
  it.skip("retries on status=failed — disabled pending Phase 5 cleanup", () => {});
});

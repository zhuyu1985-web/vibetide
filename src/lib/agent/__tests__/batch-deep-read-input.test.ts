import { describe, expect, it } from "vitest";

import { normalizeBatchDeepReadItems } from "../tool-registry";

describe("normalizeBatchDeepReadItems", () => {
  it("accepts web_search result shape by deriving id and sourceUrl", () => {
    expect(
      normalizeBatchDeepReadItems([
        {
          title: "新闻标题",
          url: "https://example.com/news",
          snippet: "摘要",
        },
      ]),
    ).toEqual([
      {
        id: "https://example.com/news",
        title: "新闻标题",
        url: "https://example.com/news",
        sourceUrl: "https://example.com/news",
        snippet: "摘要",
      },
    ]);
  });
});

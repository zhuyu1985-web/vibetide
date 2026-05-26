import { describe, it, expect } from "vitest";
import { extractRewrittenArticles } from "../cross-language-rewrite-renderer";

describe("extractRewrittenArticles", () => {
  it("happy path: 解析 outputData.articles 数组", () => {
    const out = extractRewrittenArticles({
      articles: [
        {
          id: "t1-v0",
          sourceTopicId: "t1",
          variantIndex: 0,
          title_en: "Chengdu's Skewer Queue",
          body_en: "In Chengdu, the spicy-food capital...",
          hashtags: ["#FoodieLife", "#ChinaEats", "#SpicyFood"],
          category: "food",
          sourceUrl: "https://x.com/1",
          cultural_notes: "把'串串香' explained as skewers",
        },
      ],
    });
    expect(out).not.toBeNull();
    expect(out).toHaveLength(1);
    expect(out![0].title_en).toBe("Chengdu's Skewer Queue");
  });

  it("无 articles 字段 → null", () => {
    expect(extractRewrittenArticles({ summary: "..." })).toBeNull();
    expect(extractRewrittenArticles(null)).toBeNull();
    expect(extractRewrittenArticles("string")).toBeNull();
  });

  it("articles 为空数组 → 长度 0", () => {
    const out = extractRewrittenArticles({ articles: [] });
    expect(out).toHaveLength(0);
  });

  it("articles 不是数组 → null", () => {
    expect(extractRewrittenArticles({ articles: "not array" })).toBeNull();
  });

  it("解析多条 variants 不丢字段", () => {
    const out = extractRewrittenArticles({
      articles: [
        { id: "t1-v0", title_en: "Short", body_en: "x", hashtags: ["#A", "#B", "#C"] },
        { id: "t1-v1", title_en: "Long", body_en: "y", hashtags: ["#A", "#B", "#C"] },
      ],
    });
    expect(out).toHaveLength(2);
    expect(out![0].id).toBe("t1-v0");
    expect(out![1].id).toBe("t1-v1");
  });
});

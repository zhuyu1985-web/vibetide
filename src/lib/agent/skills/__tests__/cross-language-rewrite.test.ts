import { describe, it, expect, vi, beforeEach } from "vitest";

const generateTextMock = vi.hoisted(() => vi.fn());
vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return { ...actual, generateText: generateTextMock };
});
vi.mock("../../model-router", () => ({
  getLanguageModel: vi.fn(() => ({})),
  resolveModelConfig: vi.fn(() => ({ temperature: 0.7, maxTokens: 8192, provider: "openai", model: "qwen3-max" })),
}));

import { crossLanguageRewriteArticles } from "../cross-language-rewrite";

describe("cross_language_rewrite categoryHint string", () => {
  beforeEach(() => {
    generateTextMock.mockClear();
  });

  it("categoryHint=auto（不在内置 3 类）也能跑通，prompt 用通用语气兜底", async () => {
    generateTextMock.mockResolvedValueOnce({
      output: {
        articles: [
          {
            id: "t1-v0",
            sourceTopicId: "t1",
            variantIndex: 0,
            title_en: "Xiaomi SU7 EV Review",
            body_en: "Xiaomi's first EV with enough characters here",
            hashtags: ["#XiaomiSU7", "#ChinaEV", "#AutoTech"],
          },
        ],
      },
    });
    const out = await crossLanguageRewriteArticles({
      articles: [{ id: "t1", title: "小米 SU7", body: "..." }],
      targetLanguage: "en",
      categoryHint: "auto",
    });
    expect(out.articles).toHaveLength(1);
    expect(generateTextMock).toHaveBeenCalled();
    const call = generateTextMock.mock.calls[0][0];
    expect(call.system).toContain("**auto**");  // 任意 string 都出现在 prompt
    expect(call.system).toContain("无特定语气倾向");  // fallback 文案
  });

  it("categoryHint=food 命中内置查表，prompt 含 美食 语气", async () => {
    generateTextMock.mockResolvedValueOnce({
      output: { articles: [{ id: "t1-v0", sourceTopicId: "t1", variantIndex: 0, title_en: "X", body_en: "Y body with enough chars", hashtags: ["#A", "#B", "#C"] }] },
    });
    await crossLanguageRewriteArticles({
      articles: [{ id: "t1", title: "成都串串", body: "..." }],
      targetLanguage: "en",
      categoryHint: "food",
    });
    const call = generateTextMock.mock.calls[0][0];
    expect(call.system).toContain("taste");  // 命中内置 food 模板
  });
});

describe("cross_language_rewrite variants & sourceUrl 透传", () => {
  beforeEach(() => {
    generateTextMock.mockClear();
  });

  it("variantsPerTopic=2 输出 2 个 variant，id 是 tX-v0/tX-v1，sourceUrl 透传", async () => {
    generateTextMock.mockResolvedValueOnce({
      output: {
        articles: [
          { id: "t1-v0", sourceTopicId: "t1", variantIndex: 0, sourceUrl: "https://weibo.com/x",
            title_en: "Short headline", body_en: "Body for variant 0 with enough chars", hashtags: ["#A", "#B", "#C"] },
          { id: "t1-v1", sourceTopicId: "t1", variantIndex: 1, sourceUrl: "https://weibo.com/x",
            title_en: "Long story", body_en: "Body for variant 1 with enough chars", hashtags: ["#A", "#B", "#C"] },
        ],
      },
    });
    const out = await crossLanguageRewriteArticles({
      articles: [{ id: "t1", title: "成都串串", body: "...", sourceUrl: "https://weibo.com/x" }],
      targetLanguage: "en",
      variantsPerTopic: 2,
    });
    expect(out.articles).toHaveLength(2);
    expect(out.articles[0].id).toBe("t1-v0");
    expect(out.articles[1].id).toBe("t1-v1");
    expect(out.articles.every((a) => a.sourceUrl === "https://weibo.com/x")).toBe(true);
  });

  it("variantsPerTopic=1 默认值，输出 1 篇", async () => {
    generateTextMock.mockResolvedValueOnce({
      output: { articles: [{ id: "t1-v0", sourceTopicId: "t1", variantIndex: 0, title_en: "X", body_en: "Y body with enough chars", hashtags: ["#A","#B","#C"] }] },
    });
    const out = await crossLanguageRewriteArticles({
      articles: [{ id: "t1", title: "X", body: "Y body" }],
      targetLanguage: "en",
    });
    expect(out.articles).toHaveLength(1);
  });

  it("sourceUrl 兜底 — LLM 漏返时从 input 回填", async () => {
    generateTextMock.mockResolvedValueOnce({
      output: { articles: [{ id: "t1-v0", sourceTopicId: "t1", variantIndex: 0, title_en: "X", body_en: "Y body with enough chars", hashtags: ["#A","#B","#C"] /* no sourceUrl */ }] },
    });
    const out = await crossLanguageRewriteArticles({
      articles: [{ id: "t1", title: "X", body: "Y body", sourceUrl: "https://example.com/orig" }],
      targetLanguage: "en",
    });
    expect(out.articles[0].sourceUrl).toBe("https://example.com/orig");
  });
});

describe("cross_language_rewrite partial failures", () => {
  beforeEach(() => {
    generateTextMock.mockClear();
  });

  it("单条改写失败时不把 NEEDS REVIEW 占位稿放进 articles", async () => {
    generateTextMock.mockImplementation(async ({ prompt }: { prompt: string }) => {
      const payload = JSON.parse(prompt) as { article: { id: string; title: string } };
      if (payload.article.id === "bad") {
        throw new Error("model timeout");
      }
      return {
        output: {
          articles: [
            {
              id: `${payload.article.id}-v0`,
              sourceTopicId: payload.article.id,
              variantIndex: 0,
              sourceUrl: "https://example.com/good",
              category: "food",
              title_en: "Young people are spending more on food than fashion",
              body_en: "A complete English rewrite with enough body text for downstream publishing.",
              hashtags: ["#FoodCulture", "#YouthSpending"],
            },
          ],
        },
      };
    });

    const out = await crossLanguageRewriteArticles({
      articles: [
        {
          id: "good",
          title: "年轻人更愿意为吃花钱",
          body: "中文正文内容足够长，用于生成英文稿。",
          sourceUrl: "https://example.com/good",
          category: "food",
        },
        {
          id: "bad",
          title: "为什么年轻人不愿意买衣服",
          body: "这条会模拟模型超时，不能作为中文占位稿进入下游。",
          sourceUrl: "https://example.com/bad",
          category: "food",
        },
      ],
      targetLanguage: "en",
      categoryHint: "food",
    });

    expect(out.articles).toHaveLength(1);
    expect(out.articles[0].sourceTopicId).toBe("good");
    expect(JSON.stringify(out.articles)).not.toContain("[NEEDS REVIEW]");

    const meta = out as {
      failed?: Array<{ sourceTopicId: string; reason: string; title: string }>;
      warning?: { code: string };
    };
    expect(meta.failed).toEqual([
      {
        sourceTopicId: "bad",
        title: "为什么年轻人不愿意买衣服",
        sourceUrl: "https://example.com/bad",
        category: "food",
        reason: "rewrite_unavailable",
      },
    ]);
    expect(meta.warning?.code).toBe("partial_rewrite_unavailable");
  });
});

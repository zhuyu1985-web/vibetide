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
            id: "t1",
            title_en: "Xiaomi SU7 EV Review",
            body_en: "Xiaomi's first EV...",
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
      output: { articles: [{ id: "t1", title_en: "X", body_en: "Y", hashtags: ["#A", "#B", "#C"] }] },
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

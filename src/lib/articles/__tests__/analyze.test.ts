import { describe, it, expect, vi, beforeEach } from "vitest";

const { generateText, getLanguageModel, resolveModelConfig } = vi.hoisted(() => ({
  generateText: vi.fn(),
  getLanguageModel: vi.fn(() => ({})),
  resolveModelConfig: vi.fn(() => ({
    provider: "openai",
    model: "deepseek-chat",
    temperature: 0.3,
    maxTokens: 1200,
  })),
}));
vi.mock("ai", () => ({
  generateText,
  Output: { object: (x: unknown) => x },
}));
vi.mock("@/lib/agent/model-router", () => ({ getLanguageModel, resolveModelConfig }));

import { analyzeArticleStructured } from "../analyze";

beforeEach(() => {
  generateText.mockReset();
});

describe("analyzeArticleStructured", () => {
  it("返回结构化 digest（summary/category/tags/keyPoints）", async () => {
    generateText.mockResolvedValue({
      output: {
        summary: "这是摘要",
        category: "时政",
        tags: ["标签1", "标签2", "标签3"],
        keyPoints: ["要点一", "要点二", "要点三"],
      },
    });
    const r = await analyzeArticleStructured({
      title: "标题",
      body: "正文内容",
      categories: ["时政", "财经", "民生"],
    });
    expect(r.summary).toBe("这是摘要");
    expect(r.category).toBe("时政");
    expect(r.tags).toHaveLength(3);
    expect(r.keyPoints).toHaveLength(3);
  });

  it("把候选分类名传进 prompt 作为允许值", async () => {
    generateText.mockResolvedValue({
      output: { summary: "s", category: "财经", tags: ["a", "b", "c"], keyPoints: ["x", "y", "z"] },
    });
    await analyzeArticleStructured({
      title: "标题",
      body: "正文",
      categories: ["时政", "财经"],
    });
    const arg = generateText.mock.calls[0][0] as Record<string, unknown>;
    expect(JSON.stringify(arg)).toContain("财经");
  });
});

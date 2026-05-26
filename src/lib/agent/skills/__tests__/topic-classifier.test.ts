import { describe, it, expect, vi } from "vitest";

const generateTextMock = vi.hoisted(() => vi.fn());
vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return { ...actual, generateText: generateTextMock };
});
vi.mock("../../model-router", () => ({
  getLanguageModel: vi.fn(() => ({})),
  resolveModelConfig: vi.fn(() => ({ temperature: 0.2, maxTokens: 4096, provider: "openai", model: "qwen3-max" })),
}));

import { classifyOverseasTopics } from "../topic-classifier";

describe("topic_classifier 动态 enum", () => {
  it("接受用户加的 auto / travel 自定义分类，LLM 输出含 auto 不被 zod 拒", async () => {
    generateTextMock.mockResolvedValueOnce({
      output: {
        results: [
          { id: "t1", category: "auto", confidence: 0.92, reason: "标题含 SU7" },
          { id: "t2", category: "travel", confidence: 0.88, reason: "标题含 北海道" },
        ],
      },
    });
    const out = await classifyOverseasTopics({
      topics: [
        { id: "t1", title: "小米 SU7 续航实测" },
        { id: "t2", title: "北海道滑雪攻略" },
      ],
      enabledCategories: [
        { value: "auto", label: "汽车" },
        { value: "travel", label: "旅游" },
      ],
    });
    expect(out.results).toHaveLength(2);
    expect(out.results[0].category).toBe("auto");
    expect(out.results[1].category).toBe("travel");
  });

  it("默认 3 类 + other 兜底（无 enabledCategories 入参）", async () => {
    generateTextMock.mockResolvedValueOnce({
      output: {
        results: [
          { id: "t1", category: "food", confidence: 0.95, reason: "..." },
        ],
      },
    });
    const out = await classifyOverseasTopics({
      topics: [{ id: "t1", title: "成都串串香" }],
      enabledCategories: [
        { value: "food", label: "美食" },
        { value: "pets", label: "萌宠" },
        { value: "domestic_tech", label: "国内科技" },
      ],
    });
    expect(out.results[0].category).toBe("food");
  });

  it("LLM 漏返时缺失条目兜底归 other", async () => {
    generateTextMock.mockResolvedValueOnce({
      output: { results: [{ id: "t1", category: "food", confidence: 0.9, reason: "..." }] },
    });
    const out = await classifyOverseasTopics({
      topics: [
        { id: "t1", title: "A" },
        { id: "t2", title: "B" },
      ],
      enabledCategories: [{ value: "food", label: "美食" }],
    });
    expect(out.results).toHaveLength(2);
    expect(out.results[1].category).toBe("other");
  });
});

import { beforeEach, describe, it, expect, vi } from "vitest";

const classifyMock = vi.hoisted(() => vi.fn());
const rewriteMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/agent/skills/topic-classifier", () => ({
  classifyOverseasTopics: classifyMock,
}));
vi.mock("@/lib/agent/skills/cross-language-rewrite", () => ({
  crossLanguageRewriteArticles: rewriteMock,
}));

import {
  isLLMSkillRegistered,
  invokeLLMSkillDirectly,
  LLM_SKILL_EXECUTORS,
} from "../llm-skill-dispatch";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("llm-skill-dispatch registration", () => {
  it("topic_classifier + cross_language_rewrite registered", () => {
    expect(isLLMSkillRegistered("topic_classifier")).toBe(true);
    expect(isLLMSkillRegistered("cross_language_rewrite")).toBe(true);
    expect(isLLMSkillRegistered("trending_topics")).toBe(false);
    expect(isLLMSkillRegistered("unknown")).toBe(false);
  });

  it("LLM_SKILL_EXECUTORS exports both executors", () => {
    expect(LLM_SKILL_EXECUTORS.topic_classifier).toBeDefined();
    expect(LLM_SKILL_EXECUTORS.cross_language_rewrite).toBeDefined();
  });
});

describe("invokeLLMSkillDirectly topic_classifier", () => {
  it("happy path：调 classifyOverseasTopics 并 wrap 结果", async () => {
    classifyMock.mockResolvedValueOnce({
      results: [{ id: "t1", category: "food", confidence: 0.9, reason: "..." }],
    });
    const res = await invokeLLMSkillDirectly("topic_classifier", {
      topics: [{ id: "t1", title: "成都串串" }],
      enabledCategories: [{ value: "food", label: "美食" }],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected ok");
    const result = res.result as { results: unknown[] };
    expect(result.results).toHaveLength(1);
  });

  it("classifyOverseasTopics 抛错 → 返回 ok=false 不 throw", async () => {
    classifyMock.mockRejectedValueOnce(new Error("API down"));
    const res = await invokeLLMSkillDirectly("topic_classifier", {
      topics: [{ id: "t1", title: "X" }],
      enabledCategories: [{ value: "food", label: "美食" }],
    });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected error");
    expect(res.error).toContain("API down");
  });
});

describe("invokeLLMSkillDirectly cross_language_rewrite", () => {
  it("入参 builder 从 articles 过滤 other 类并 map 为 ArticleInput", async () => {
    rewriteMock.mockResolvedValueOnce({
      articles: [{ id: "t1-v0", sourceTopicId: "t1", variantIndex: 0, title_en: "X", body_en: "Y", hashtags: ["#A", "#B", "#C"] }],
    });
    const res = await invokeLLMSkillDirectly("cross_language_rewrite", {
      articles: [
        // ClassifiedItem shape (now with title/summary echo)
        { id: "t1", category: "food", confidence: 0.9, reason: "...", sourceUrl: "https://x.com/1", title: "成都串串香排队 3 小时", summary: "成都人民对串串香的热情..." },
        { id: "t2", category: "other", confidence: 0.3, reason: "...", sourceUrl: "https://x.com/2", title: "时政新闻" },
      ],
      targetLanguage: "en",
      variantsPerTopic: 1,
    });
    expect(res.ok).toBe(true);
    // 验证：crossLanguageRewriteArticles 被调时，articles 已过滤掉 other 类
    expect(rewriteMock).toHaveBeenCalledTimes(1);
    const callArgs = rewriteMock.mock.calls[0][0] as { articles: Array<{ title: string; body: string }> };
    expect(callArgs.articles).toHaveLength(1);  // only food, not other
    expect(callArgs.articles[0].title).toBe("成都串串香排队 3 小时");
    expect(callArgs.articles[0].body.length).toBeGreaterThanOrEqual(10);  // summary used or fallback
  });

  it("接受 batch_deep_read 的 bocha 补全正文进入翻译", async () => {
    rewriteMock.mockResolvedValueOnce({
      articles: [
        {
          id: "t1-v0",
          sourceTopicId: "t1",
          variantIndex: 0,
          title_en: "Rocket launch draws attention",
          body_en: "A Chinese tech story rewritten for overseas readers.",
          hashtags: ["#ChinaTech"],
        },
      ],
    });

    const res = await invokeLLMSkillDirectly("cross_language_rewrite", {
      articles: [
        {
          id: "t1",
          category: "domestic_tech",
          confidence: 0.92,
          reason: "科技事件",
          sourceUrl: "https://example.com/tech",
          title: "新格伦火箭发射台爆炸",
          body: "Bocha 搜索补全的多源新闻摘要正文，足够支撑海外改写。",
          fetchStatus: "enriched_via_bocha",
        },
      ],
      targetLanguage: "en",
      variantsPerTopic: 1,
    });

    expect(res.ok).toBe(true);
    expect(rewriteMock).toHaveBeenCalledTimes(1);
    const callArgs = rewriteMock.mock.calls[0][0] as {
      articles: Array<{ title: string; body: string; category?: string }>;
    };
    expect(callArgs.articles).toHaveLength(1);
    expect(callArgs.articles[0]).toMatchObject({
      title: "新格伦火箭发射台爆炸",
      category: "domestic_tech",
    });
  });

  it("未注册的 skill → ok=false", async () => {
    const res = await invokeLLMSkillDirectly("nonexistent_skill", {});
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected error");
    expect(res.error).toContain("not registered");
  });
});

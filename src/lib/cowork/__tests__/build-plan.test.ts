import { describe, it, expect, vi, beforeEach } from "vitest";
const invokeMock = vi.hoisted(() => vi.fn());
const genTextMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/agent/tool-registry", () => ({ invokeToolDirectly: invokeMock }));
vi.mock("ai", () => ({ generateText: genTextMock }));
vi.mock("@/lib/agent/model-router", () => ({ getLanguageModel: vi.fn(), getDefaultModel: () => "m" }));
import { buildCreationPlan } from "../creation-plan";

describe("buildCreationPlan", () => {
  beforeEach(() => { invokeMock.mockReset(); genTextMock.mockReset(); genTextMock.mockResolvedValue({ text: "深度解读：行业影响" }); });

  it("热榜可用：预选 Top1 + 备选 + 角度", async () => {
    invokeMock.mockResolvedValue({ ok: true, result: { topics: [
      { title: "热点A", heat: "100w", platform: "weibo" }, { title: "热点B", heat: "80w", platform: "zhihu" }] } });
    const plan = await buildCreationPlan("o1", "帮我写篇今天的热点稿");
    expect(plan.topic.title).toBe("热点A");
    expect(plan.topicOptions.length).toBeGreaterThanOrEqual(2);
    expect(plan.topicFromHotlist).toBe(true);
    expect(plan.hotlistAvailable).toBe(true);
    expect(plan.angle).toContain("行业影响");
  });

  it("热榜失败：降级 hotlistAvailable=false，topic 空待用户填", async () => {
    invokeMock.mockResolvedValue({ ok: false, error: "x" });
    const plan = await buildCreationPlan("o1", "写篇稿");
    expect(plan.hotlistAvailable).toBe(false);
    expect(plan.topicFromHotlist).toBe(false);
    expect(plan.topic.title).toBe("");
  });
});

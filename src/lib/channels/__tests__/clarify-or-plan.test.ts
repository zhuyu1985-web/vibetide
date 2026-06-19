import { describe, it, expect, vi, beforeEach } from "vitest";

const { recognizeIntent, generateText, loadAvailableEmployees } = vi.hoisted(() => ({
  recognizeIntent: vi.fn(),
  generateText: vi.fn(),
  loadAvailableEmployees: vi.fn(),
}));

vi.mock("@/lib/agent/intent-recognition", () => ({ recognizeIntent }));
vi.mock("ai", () => ({ generateText }));
vi.mock("@/lib/agent/model-router", () => ({ getLanguageModel: () => ({}) }));
vi.mock("@/lib/mission-core", () => ({ loadAvailableEmployees }));

import { clarifyOrPlan } from "../clarify-or-plan";

beforeEach(() => {
  vi.clearAllMocks();
  loadAvailableEmployees.mockResolvedValue([]);
});

describe("clarifyOrPlan", () => {
  it("高置信 + 有 steps → execute", async () => {
    recognizeIntent.mockResolvedValue({
      summary: "抓热点",
      confidence: 0.9,
      intentType: "content_creation",
      steps: [
        {
          employeeSlug: "xiaolei",
          employeeName: "小蕾",
          skills: ["x"],
          taskDescription: "抓热点",
        },
      ],
      reasoning: "",
    });
    const r = await clarifyOrPlan("org1", { contextTurns: [] } as never, "今天抓个科技热点写成稿");
    expect(r.action).toBe("execute");
    if (r.action === "execute") {
      expect(r.steps.length).toBe(1);
      expect(r.summary).toBe("抓热点");
    }
  });

  it("低置信 / 无 steps → clarify，产出问题", async () => {
    recognizeIntent.mockResolvedValue({
      summary: "不明确",
      confidence: 0.3,
      intentType: "general_chat",
      steps: [],
      reasoning: "",
    });
    generateText.mockResolvedValue({ text: "你想针对哪个平台、什么主题？" });
    const r = await clarifyOrPlan("org1", { contextTurns: [] } as never, "帮我搞个东西");
    expect(r.action).toBe("clarify");
    if (r.action === "clarify") expect(r.question).toContain("？");
  });
});

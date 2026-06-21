import { describe, it, expect, vi, beforeEach } from "vitest";

const { generateText, getLanguageModel, loadAvailableEmployees } = vi.hoisted(() => ({
  generateText: vi.fn(),
  getLanguageModel: vi.fn(() => ({})),
  loadAvailableEmployees: vi.fn(),
}));

vi.mock("ai", () => ({ generateText }));
vi.mock("@/lib/agent/model-router", () => ({ getLanguageModel }));
vi.mock("@/lib/mission-core", () => ({ loadAvailableEmployees }));
// 隔离文件系统：getBuiltinSkillSlugs 校验 step.skills；getAllBuiltinSkills 给 buildSkillCatalog 用
vi.mock("@/lib/skill-loader", () => ({
  getBuiltinSkillSlugs: () => new Set(["content_generate"]),
  getAllBuiltinSkills: () => [{ category: "内容创作", slug: "content_generate", name: "内容生成" }],
}));

import { clarifyOrPlan } from "../clarify-or-plan";

const session = { contextTurns: [], clarifyRounds: 0 } as never;
const CATALOG = [
  { slug: "reporter", name: "记者", nickname: "小记", title: "记者", skills: ["content_generate"] },
];
beforeEach(() => {
  generateText.mockReset();
  loadAvailableEmployees.mockReset();
  loadAvailableEmployees.mockResolvedValue(CATALOG);
});
const reply = (obj: unknown) => generateText.mockResolvedValue({ text: JSON.stringify(obj) });

describe("clarifyOrPlan（重建规划器）", () => {
  it("needClarify:true → clarify", async () => {
    reply({ needClarify: true, question: "想写什么主题？" });
    expect(await clarifyOrPlan("org1", session, "帮我写点东西")).toEqual({ action: "clarify", question: "想写什么主题？" });
  });
  it("needClarify:false + 合法 steps → execute", async () => {
    reply({ needClarify: false, summary: "写AI稿", steps: [{ employeeSlug: "reporter", employeeName: "小记", skills: ["content_generate"], taskDescription: "撰写AI深度稿" }] });
    const r = await clarifyOrPlan("org1", session, "写一篇AI深度稿");
    expect(r.action).toBe("execute");
    if (r.action === "execute") { expect(r.summary).toBe("写AI稿"); expect(r.steps).toHaveLength(1); expect(r.steps[0].employeeSlug).toBe("reporter"); }
  });
  it("非法 employeeSlug 全过滤 → 退回 clarify（不 fabricate）", async () => {
    reply({ needClarify: false, summary: "x", steps: [{ employeeSlug: "ghost", employeeName: "鬼", skills: ["content_generate"], taskDescription: "x" }] });
    expect((await clarifyOrPlan("org1", session, "写稿")).action).toBe("clarify");
  });
  it("非法 skill 过滤但 step 保留 → execute", async () => {
    reply({ needClarify: false, summary: "x", steps: [{ employeeSlug: "reporter", employeeName: "小记", skills: ["content_generate", "fake_skill"], taskDescription: "写" }] });
    const r = await clarifyOrPlan("org1", session, "写AI稿");
    expect(r.action).toBe("execute");
    if (r.action === "execute") expect(r.steps[0].skills).toEqual(["content_generate"]);
  });
  it("needClarify:false 但 steps 空 → 退回 clarify", async () => {
    reply({ needClarify: false, summary: "x", steps: [] });
    expect((await clarifyOrPlan("org1", session, "写稿")).action).toBe("clarify");
  });
  it("JSON 解析失败 → clarify 兜底", async () => {
    generateText.mockResolvedValue({ text: "这不是JSON" });
    expect((await clarifyOrPlan("org1", session, "写稿")).action).toBe("clarify");
  });
  it("generateText 抛错 → 向上抛", async () => {
    generateText.mockRejectedValue(new Error("LLM down"));
    await expect(clarifyOrPlan("org1", session, "写稿")).rejects.toThrow();
  });
  it("问候语 → 快路径 clarify，不调 LLM", async () => {
    const r = await clarifyOrPlan("org1", session, "你好");
    expect(r.action).toBe("clarify");
    expect(generateText).not.toHaveBeenCalled();
  });
  it("employeeName 缺失 → 回填 nickname", async () => {
    reply({ needClarify: false, summary: "x", steps: [{ employeeSlug: "reporter", skills: ["content_generate"], taskDescription: "写" }] });
    const r = await clarifyOrPlan("org1", session, "写AI稿");
    if (r.action === "execute") expect(r.steps[0].employeeName).toBe("小记");
  });
});

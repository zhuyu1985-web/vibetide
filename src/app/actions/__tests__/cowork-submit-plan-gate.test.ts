import { describe, it, expect, vi, beforeEach } from "vitest";
const recognizeMock = vi.hoisted(() => vi.fn());
const buildPlanMock = vi.hoisted(() => vi.fn());
const appendMessageMock = vi.hoisted(() => vi.fn());
const startMissionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn(async () => ({ id: "u1" })) }));
vi.mock("@/lib/dal/auth", () => ({ getCurrentUserOrg: vi.fn(async () => "o1") }));
vi.mock("@/lib/dal/cowork-conversations", () => ({
  appendMessage: appendMessageMock, getConversationById: vi.fn(async () => ({ id: "cv1", projectId: null })) }));
vi.mock("@/lib/cowork/intent-routing", () => ({ recognizeIntentForOrg: recognizeMock }));
vi.mock("@/lib/cowork/creation-plan", () => ({ buildCreationPlan: buildPlanMock }));
vi.mock("@/app/actions/ad-hoc-mission", () => ({ startAdHocMission: startMissionMock }));
vi.mock("@/lib/agent/model-router", () => ({
  getLanguageModel: vi.fn(() => {
    throw new Error("流式回复不应在 Server Action 中生成");
  }),
  getDefaultModel: vi.fn(() => "test-model"),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { submitCoworkMessage } from "../cowork-submit";

describe("content_creation → plan_card gate", () => {
  beforeEach(() => { [recognizeMock, buildPlanMock, appendMessageMock, startMissionMock].forEach(m => m.mockReset()); });

  it("写稿意图：落 plan_card，且不起 mission", async () => {
    recognizeMock.mockResolvedValue({ intentType: "content_creation", summary: "写热点稿", confidence: 0.9, steps: [{}] });
    buildPlanMock.mockResolvedValue({ topic: { title: "热点A" }, topicOptions: [] });
    const res = await submitCoworkMessage("cv1", "帮我写篇今天的热点稿");
    expect(res).toMatchObject({ ok: true, kind: "plan" });
    expect(appendMessageMock).toHaveBeenCalledWith("cv1", expect.objectContaining({ kind: "plan_card" }));
    expect(startMissionMock).not.toHaveBeenCalled();
  });

  it("非写稿意图：维持原行为（起 mission）", async () => {
    recognizeMock.mockResolvedValue({ intentType: "information_retrieval", summary: "查", confidence: 0.9, steps: [{}] });
    startMissionMock.mockResolvedValue({ ok: true, missionId: "m1" });
    const res = await submitCoworkMessage("cv1", "查个资料");
    expect(startMissionMock).toHaveBeenCalled();
    expect(buildPlanMock).not.toHaveBeenCalled();
  });

  it("首页已落首条消息时不重复写入用户消息", async () => {
    recognizeMock.mockResolvedValue({
      intentType: "information_retrieval",
      summary: "查",
      confidence: 0.9,
      steps: [{}],
    });
    startMissionMock.mockResolvedValue({ ok: true, missionId: "m1" });
    await submitCoworkMessage("cv1", "查个资料", {
      userMessageAlreadyPersisted: true,
    });
    expect(appendMessageMock).not.toHaveBeenCalledWith(
      "cv1",
      expect.objectContaining({ role: "user" }),
    );
  });

  it("普通对话创建流式占位消息并返回消息 ID", async () => {
    recognizeMock.mockResolvedValue({
      intentType: "general_chat",
      summary: "普通问答",
      confidence: 0.9,
      steps: [],
    });
    appendMessageMock
      .mockResolvedValueOnce({ id: "user-message-1" })
      .mockResolvedValueOnce({ id: "assistant-message-1" });

    const result = await submitCoworkMessage("cv1", "介绍一下你自己");

    expect(result).toEqual({
      ok: true,
      kind: "stream",
      messageId: "assistant-message-1",
    });
    expect(appendMessageMock).toHaveBeenCalledWith(
      "cv1",
      expect.objectContaining({
        role: "assistant",
        content: "",
        kind: "text",
        meta: expect.objectContaining({ streaming: true }),
      }),
    );
  });
});

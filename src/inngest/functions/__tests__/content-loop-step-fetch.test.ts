import { describe, it, expect, vi, beforeEach } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());
const getSessionMock = vi.hoisted(() => vi.fn());
const updateSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/agent/tool-registry", () => ({ invokeToolDirectly: invokeMock }));
vi.mock("@/lib/dal/channel-sessions", () => ({
  getSessionById: getSessionMock, updateSession: updateSessionMock, CONTENT_LOOP_TTL_MS: 604800000,
}));
vi.mock("@/lib/dal/channels", () => ({ getChannelConfig: vi.fn(async () => null) }));
vi.mock("@/lib/channels/outbound", () => ({ sendChannelMessage: vi.fn() }));
// 其余 import 的 DAL/工具按需 mock 成空实现（appendArticleVersion 等本用例不触达）

import { runContentLoopStep, handleContentLoopStepFailure } from "../content-loop-step";

const data = { organizationId: "o1", sessionId: "s1", step: "fetch_topics",
  channelCtx: { organizationId:"o1", configId:"c1", platform:"dingtalk", chatId:"g1", externalUserId:"u1" } } as never;

const failData = (step: string) => ({ organizationId: "o1", sessionId: "s1", step,
  channelCtx: { organizationId:"o1", configId:"c1", platform:"dingtalk", chatId:"g1", externalUserId:"u1" } } as never);

describe("fetch_topics 失败/空 → 回滚 idle", () => {
  beforeEach(() => { invokeMock.mockReset(); updateSessionMock.mockReset();
    getSessionMock.mockResolvedValue({ id:"s1", organizationId:"o1", scenarioPhase:"hot_list", loopContext:{} }); });

  it("抓榜失败 → scenarioPhase 回滚 idle", async () => {
    invokeMock.mockResolvedValue({ ok: false, error: "TRENDING_API_KEY 未配置" });
    await runContentLoopStep(data);
    expect(updateSessionMock).toHaveBeenCalledWith("s1", expect.objectContaining({ scenarioPhase: "idle" }));
  });

  it("抓到 0 条 → 同样回滚 idle", async () => {
    invokeMock.mockResolvedValue({ ok: true, result: { topics: [] } });
    await runContentLoopStep(data);
    expect(updateSessionMock).toHaveBeenCalledWith("s1", expect.objectContaining({ scenarioPhase: "idle" }));
  });
});

describe("terminal failure（retries 用尽）→ fetch_topics 仍卡 hot_list 时回滚 idle", () => {
  beforeEach(() => { getSessionMock.mockReset(); updateSessionMock.mockReset(); });

  it("step=fetch_topics 且仍在 hot_list → 回滚 idle", async () => {
    getSessionMock.mockResolvedValue({ id:"s1", organizationId:"o1", scenarioPhase:"hot_list", loopContext:{} });
    await handleContentLoopStepFailure(failData("fetch_topics"));
    expect(updateSessionMock).toHaveBeenCalledWith("s1", { scenarioPhase: "idle" });
  });

  it("step=fetch_topics 但已不在 hot_list（drafting）→ 不回滚", async () => {
    getSessionMock.mockResolvedValue({ id:"s1", organizationId:"o1", scenarioPhase:"drafting", loopContext:{} });
    await handleContentLoopStepFailure(failData("fetch_topics"));
    expect(updateSessionMock).not.toHaveBeenCalled();
  });

  it("step 非 fetch_topics（gen_draft）→ 不回滚（不读 session）", async () => {
    await handleContentLoopStepFailure(failData("gen_draft"));
    expect(getSessionMock).not.toHaveBeenCalled();
    expect(updateSessionMock).not.toHaveBeenCalled();
  });
});

describe("gen_draft：content_generate 失败哨兵 → 不落库", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    updateSessionMock.mockReset();
    getSessionMock.mockResolvedValue({
      id: "s1", organizationId: "o1", scenarioPhase: "drafting",
      loopContext: { selectedTopic: { title: "热点A" }, selectedAngle: { idx: 1, label: "视角" } },
    });
  });

  it("返回 '[生成失败] …' 哨兵 → 不调 archive_to_drafts（只调一次 content_generate）", async () => {
    invokeMock.mockResolvedValue({ ok: true, result: { content: "[生成失败] 模型超时", wordCount: 0 } });
    await runContentLoopStep(failData("gen_draft"));
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith("content_generate", expect.anything(), expect.anything());
  });
});

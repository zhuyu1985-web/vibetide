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

import { runContentLoopStep } from "../content-loop-step";

const data = { organizationId: "o1", sessionId: "s1", step: "fetch_topics",
  channelCtx: { organizationId:"o1", configId:"c1", platform:"dingtalk", chatId:"g1", externalUserId:"u1" } } as never;

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

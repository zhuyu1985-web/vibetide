import { describe, it, expect, vi, beforeEach } from "vitest";

const updateSessionMock = vi.hoisted(() => vi.fn());
const inngestSendMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/dal/channel-sessions", () => ({
  updateSession: updateSessionMock,
  CONTENT_LOOP_TTL_MS: 604800000,
}));
vi.mock("@/inngest/client", () => ({ inngest: { send: inngestSendMock } }));

import { handleContentLoopMessage } from "../orchestrator";

const baseSession = (loopContext: Record<string, unknown>) =>
  ({ id: "s1", organizationId: "o1", scenarioPhase: "hot_list", loopContext } as never);
const msg = { externalMessageId: "m1" } as never;
const ctx = { organizationId: "o1", configId: "c1", platform: "dingtalk", chatId: "g1", externalUserId: "u1" } as never;

describe("hot_list 空候选：自愈重抓 + 出口提示", () => {
  beforeEach(() => {
    updateSessionMock.mockReset();
    inngestSendMock.mockReset();
  });

  it("首次空候选：把 hotlistWaitCount 记为 1 且主动重抓 fetch_topics", async () => {
    const r = await handleContentLoopMessage("选第1个", msg, baseSession({}), ctx);
    expect(r.reply).toContain("重新获取");
    expect(updateSessionMock).toHaveBeenCalledWith("s1", expect.objectContaining({
      loopContext: expect.objectContaining({ hotlistWaitCount: 1 }),
    }));
    // 自愈：未到阈值时主动重派 fetch_topics 事件（dispatchStep）
    expect(inngestSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "content-loop/step.requested",
        data: expect.objectContaining({ step: "fetch_topics" }),
      }),
    );
  });

  it("边界：waited 恰好等于阈值(2→3)即走文字出口，不再自动重抓", async () => {
    // pin >= HOTLIST_WAIT_THRESHOLD 这条最易 off-by-one 的边界：
    // hotlistWaitCount=2 → waited=3 == 阈值，应只给文字出口、不重派 fetch_topics
    const r = await handleContentLoopMessage("选第1个", msg, baseSession({ hotlistWaitCount: 2 }), ctx);
    expect(r.reply).toContain("重新获取");
    expect(r.reply).toContain("退出");
    expect(inngestSendMock).not.toHaveBeenCalled();
  });

  it("达到阈值(3)：回带'重新获取/退出'出口的提示，不再自动重抓", async () => {
    const r = await handleContentLoopMessage("选第1个", msg, baseSession({ hotlistWaitCount: 3 }), ctx);
    expect(r.reply).toContain("重新获取");
    expect(r.reply).toContain("退出");
    expect(inngestSendMock).not.toHaveBeenCalled();
  });
});

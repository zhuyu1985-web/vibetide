import { describe, it, expect, vi, beforeEach } from "vitest";

const updateSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/dal/channel-sessions", () => ({
  updateSession: updateSessionMock,
  CONTENT_LOOP_TTL_MS: 604800000,
}));
vi.mock("@/inngest/client", () => ({ inngest: { send: vi.fn() } }));

import { handleContentLoopMessage } from "../orchestrator";

const baseSession = (loopContext: Record<string, unknown>) =>
  ({ id: "s1", organizationId: "o1", scenarioPhase: "hot_list", loopContext } as never);
const msg = { externalMessageId: "m1" } as never;
const ctx = { organizationId: "o1", configId: "c1", platform: "dingtalk", chatId: "g1", externalUserId: "u1" } as never;

describe("hot_list 空候选：计数 + 出口提示", () => {
  beforeEach(() => { updateSessionMock.mockReset(); });

  it("首次空候选：回'稍等'且把 hotlistWaitCount 记为 1", async () => {
    const r = await handleContentLoopMessage("选第1个", msg, baseSession({}), ctx);
    expect(r.reply).toContain("还在抓取");
    expect(updateSessionMock).toHaveBeenCalledWith("s1", expect.objectContaining({
      loopContext: expect.objectContaining({ hotlistWaitCount: 1 }),
    }));
  });

  it("达到阈值(3)：回带'重新获取/退出'出口的提示", async () => {
    const r = await handleContentLoopMessage("选第1个", msg, baseSession({ hotlistWaitCount: 3 }), ctx);
    expect(r.reply).toContain("重新获取");
    expect(r.reply).toContain("退出");
  });
});

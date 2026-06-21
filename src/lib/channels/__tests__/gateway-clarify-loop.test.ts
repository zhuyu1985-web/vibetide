import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  getOrCreateSession,
  updateSession,
  resetSession,
  clarifyOrPlan,
  startChannelMission,
  cancelChannelMission,
  recordInboundMessage,
  recordOutboundMessage,
} = vi.hoisted(() => ({
  getOrCreateSession: vi.fn(),
  updateSession: vi.fn(),
  resetSession: vi.fn(),
  clarifyOrPlan: vi.fn(),
  startChannelMission: vi.fn(),
  cancelChannelMission: vi.fn(),
  recordInboundMessage: vi.fn().mockResolvedValue({ messageId: "x" }),
  recordOutboundMessage: vi.fn().mockResolvedValue({ messageId: "y" }),
}));

vi.mock("@/lib/dal/channel-sessions", () => ({
  getOrCreateSession,
  updateSession,
  resetSession,
}));
vi.mock("@/lib/channels/clarify-or-plan", () => ({ clarifyOrPlan }));
vi.mock("@/lib/channels/start-channel-mission", () => ({ startChannelMission }));
vi.mock("@/lib/channels/cancel-channel-mission", () => ({ cancelChannelMission }));
vi.mock("@/app/actions/channels", () => ({ recordInboundMessage, recordOutboundMessage }));

// Mock modules used by other gateway branches (not under test)
vi.mock("@/lib/agent/intent-recognition", () => ({ recognizeIntent: vi.fn() }));
vi.mock("@/lib/constants", () => ({ EMPLOYEE_META: { xiaolei: { name: "小蕾", nickname: "小蕾", title: "热搜猎手" } } }));
vi.mock("@/lib/dal/workflow-templates-listing", () => ({ findTemplateByNameOrSlug: vi.fn() }));
vi.mock("@/inngest/client", () => ({ inngest: { send: vi.fn() } }));
vi.mock("@/lib/channels/link-extract", () => ({ extractUrls: vi.fn().mockReturnValue([]) }));

import { handleInboundMessage } from "../gateway";

const msg = {
  platform: "dingtalk" as const,
  configId: "cfg1",
  organizationId: "org1",
  externalMessageId: "m1",
  externalUserId: "u1",
  chatId: "c1",
  textContent: "帮我搞个东西",
  rawMessage: {},
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("gateway 自由消息澄清循环", () => {
  it("running + 非取消词 → 回'处理中'含取消提示，不调 clarifyOrPlan/cancel/reset", async () => {
    getOrCreateSession.mockResolvedValue({ id: "s1", status: "running", activeMissionId: "m1", contextTurns: [], clarifyRounds: 0 });
    const r = await handleInboundMessage(msg);
    expect(r.reply).toContain("处理中");
    expect(r.reply).toContain("取消");
    expect(clarifyOrPlan).not.toHaveBeenCalled();
    expect(cancelChannelMission).not.toHaveBeenCalled();
    expect(resetSession).not.toHaveBeenCalled();
  });

  it("running + 取消 → cancelChannelMission + resetSession + 回已取消", async () => {
    getOrCreateSession.mockResolvedValue({ id: "s1", status: "running", activeMissionId: "m1", contextTurns: [], clarifyRounds: 0 });
    cancelChannelMission.mockResolvedValue(true);
    const r = await handleInboundMessage({ ...msg, textContent: "取消" });
    expect(cancelChannelMission).toHaveBeenCalledWith("m1", "org1");
    expect(resetSession).toHaveBeenCalled();
    expect(startChannelMission).not.toHaveBeenCalled();
    expect(r.reply).toContain("已取消");
  });

  it("running + 取消 但 cancel 返回 false（已终态）→ 回任务已结束", async () => {
    getOrCreateSession.mockResolvedValue({ id: "s1", status: "running", activeMissionId: "m1", contextTurns: [], clarifyRounds: 0 });
    cancelChannelMission.mockResolvedValue(false);
    const r = await handleInboundMessage({ ...msg, textContent: "取消" });
    expect(resetSession).toHaveBeenCalled();
    expect(r.reply).toContain("已结束");
  });

  it("running + 取消 但 activeMissionId 空 → 仅 resetSession，不调 cancelChannelMission", async () => {
    getOrCreateSession.mockResolvedValue({ id: "s1", status: "running", activeMissionId: null, contextTurns: [], clarifyRounds: 0 });
    const r = await handleInboundMessage({ ...msg, textContent: "取消" });
    expect(cancelChannelMission).not.toHaveBeenCalled();
    expect(resetSession).toHaveBeenCalled();
    expect(r.reply).toContain("已结束");
  });

  it("clarify → 回问题，session=clarifying，轮数+1", async () => {
    getOrCreateSession.mockResolvedValue({
      id: "s1",
      status: "idle",
      contextTurns: [],
      clarifyRounds: 0,
    });
    clarifyOrPlan.mockResolvedValue({ action: "clarify", question: "针对哪个平台？" });
    const r = await handleInboundMessage(msg);
    expect(r.reply).toContain("针对哪个平台");
    expect(updateSession).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ status: "clarifying", clarifyRounds: 1 }),
    );
  });

  it("execute → 进 confirming 发计划卡，不直接起 mission", async () => {
    getOrCreateSession.mockResolvedValue({ id: "s1", status: "idle", contextTurns: [], clarifyRounds: 0 });
    clarifyOrPlan.mockResolvedValue({ action: "execute", summary: "抓热点", steps: [{ employeeSlug: "xiaolei", employeeName: "小蕾", skills: [], taskDescription: "抓热点" }] });
    const r = await handleInboundMessage(msg);
    expect(startChannelMission).not.toHaveBeenCalled();
    expect(updateSession).toHaveBeenCalledWith("s1", expect.objectContaining({ status: "confirming" }));
    expect(r.reply).toContain("开始");
  });

  it("confirming + 开始 → 起 mission，running，清 pendingPlan", async () => {
    getOrCreateSession.mockResolvedValue({ id: "s1", status: "confirming", contextTurns: [], clarifyRounds: 0,
      pendingPlan: { summary: "抓热点", steps: [{ employeeSlug: "xiaolei", employeeName: "小蕾", skills: [], taskDescription: "抓热点" }] } });
    startChannelMission.mockResolvedValue({ missionId: "mis1" });
    const r = await handleInboundMessage({ ...msg, textContent: "开始" });
    expect(startChannelMission).toHaveBeenCalled();
    // 去重 key：必须传当前这条「开始」消息的 externalMessageId，进 missions_source_dedup_uidx 做幂等
    expect(startChannelMission).toHaveBeenCalledWith("org1", expect.objectContaining({ externalMessageId: "m1" }));
    expect(updateSession).toHaveBeenCalledWith("s1", expect.objectContaining({ status: "running", activeMissionId: "mis1", pendingPlan: null }));
    expect(r.reply).toContain("收到");
  });

  it("confirming + 取消 → idle，清 pendingPlan，不起 mission", async () => {
    getOrCreateSession.mockResolvedValue({ id: "s1", status: "confirming", contextTurns: [], clarifyRounds: 0, pendingPlan: { summary: "x", steps: [] } });
    const r = await handleInboundMessage({ ...msg, textContent: "取消" });
    expect(startChannelMission).not.toHaveBeenCalled();
    expect(updateSession).toHaveBeenCalledWith("s1", expect.objectContaining({ status: "idle", pendingPlan: null }));
    expect(r.reply).toContain("取消");
  });

  it("confirming + 编辑 → 重规划更新 pendingPlan 回新卡，留 confirming", async () => {
    getOrCreateSession.mockResolvedValue({ id: "s1", status: "confirming", contextTurns: [], clarifyRounds: 0, pendingPlan: { summary: "科技", steps: [] } });
    clarifyOrPlan.mockResolvedValue({ action: "execute", summary: "财经热点", steps: [{ employeeSlug: "xiaolei", employeeName: "小蕾", skills: [], taskDescription: "抓财经热榜" }] });
    const r = await handleInboundMessage({ ...msg, textContent: "换财经" });
    expect(startChannelMission).not.toHaveBeenCalled();
    expect(updateSession).toHaveBeenCalledWith("s1", expect.objectContaining({ status: "confirming", pendingPlan: expect.objectContaining({ summary: "财经热点" }) }));
    expect(r.reply).toContain("抓财经热榜");
  });
});

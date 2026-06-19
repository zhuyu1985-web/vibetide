import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  getOrCreateSession,
  updateSession,
  clarifyOrPlan,
  startChannelMission,
  recordInboundMessage,
  recordOutboundMessage,
} = vi.hoisted(() => ({
  getOrCreateSession: vi.fn(),
  updateSession: vi.fn(),
  clarifyOrPlan: vi.fn(),
  startChannelMission: vi.fn(),
  recordInboundMessage: vi.fn().mockResolvedValue({ messageId: "x" }),
  recordOutboundMessage: vi.fn().mockResolvedValue({ messageId: "y" }),
}));

vi.mock("@/lib/dal/channel-sessions", () => ({
  getOrCreateSession,
  updateSession,
  resetSession: vi.fn(),
}));
vi.mock("@/lib/channels/clarify-or-plan", () => ({ clarifyOrPlan }));
vi.mock("@/lib/channels/start-channel-mission", () => ({ startChannelMission }));
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
  it("running 中 → 回'处理中'，不调 clarifyOrPlan", async () => {
    getOrCreateSession.mockResolvedValue({
      id: "s1",
      status: "running",
      contextTurns: [],
      clarifyRounds: 0,
    });
    const r = await handleInboundMessage(msg);
    expect(r.reply).toContain("处理中");
    expect(clarifyOrPlan).not.toHaveBeenCalled();
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

  it("execute → 起 mission，session=running，回收到", async () => {
    getOrCreateSession.mockResolvedValue({
      id: "s1",
      status: "idle",
      contextTurns: [],
      clarifyRounds: 0,
    });
    clarifyOrPlan.mockResolvedValue({
      action: "execute",
      summary: "抓热点",
      steps: [
        {
          employeeSlug: "xiaolei",
          employeeName: "小蕾",
          skills: ["x"],
          taskDescription: "抓热点",
        },
      ],
    });
    startChannelMission.mockResolvedValue({ missionId: "mis1" });
    const r = await handleInboundMessage(msg);
    expect(startChannelMission).toHaveBeenCalled();
    expect(updateSession).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ status: "running", activeMissionId: "mis1" }),
    );
    expect(r.reply).toContain("收到");
  });
});

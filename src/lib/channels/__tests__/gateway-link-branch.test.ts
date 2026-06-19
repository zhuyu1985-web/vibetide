import { describe, it, expect, vi, beforeEach } from "vitest";

const { send, recordInboundMessage, recordOutboundMessage, recognizeIntent, getOrCreateSession, updateSession, clarifyOrPlan, startChannelMission } = vi.hoisted(() => ({
  send: vi.fn(),
  recordInboundMessage: vi.fn().mockResolvedValue({ messageId: "x" }),
  recordOutboundMessage: vi.fn().mockResolvedValue({ messageId: "y" }),
  recognizeIntent: vi.fn().mockResolvedValue({ summary: "闲聊", intentType: "general_chat", steps: [] }),
  getOrCreateSession: vi.fn().mockResolvedValue({ id: "s1", status: "idle", contextTurns: [], clarifyRounds: 0 }),
  updateSession: vi.fn().mockResolvedValue(undefined),
  clarifyOrPlan: vi.fn().mockResolvedValue({ action: "clarify", question: "请问是什么需求？" }),
  startChannelMission: vi.fn().mockResolvedValue({ missionId: "mis1" }),
}));
vi.mock("@/inngest/client", () => ({ inngest: { send } }));
vi.mock("@/app/actions/channels", () => ({ recordInboundMessage, recordOutboundMessage }));
vi.mock("@/lib/agent/intent-recognition", () => ({ recognizeIntent }));
vi.mock("@/lib/dal/channel-sessions", () => ({ getOrCreateSession, updateSession, resetSession: vi.fn() }));
vi.mock("@/lib/channels/clarify-or-plan", () => ({ clarifyOrPlan }));
vi.mock("@/lib/channels/start-channel-mission", () => ({ startChannelMission }));

import { handleInboundMessage } from "../gateway";

const msg = {
  platform: "dingtalk" as const,
  configId: "cfg1",
  organizationId: "org1",
  externalMessageId: "m1",
  externalUserId: "u1",
  chatId: "c1",
  textContent: "看看 https://example.com/a 这条",
  rawMessage: {},
  replyWebhook: "https://oapi/session",
};

beforeEach(() => send.mockReset());

describe("handleInboundMessage 链接分支", () => {
  it("含链接 → 派 channel/link-ingest.requested 并秒回 ⏳", async () => {
    const r = await handleInboundMessage(msg);
    expect(send).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const evt = (send.mock.calls[0] as any)[0];
    expect(evt.name).toBe("channel/link-ingest.requested");
    expect(evt.data.url).toBe("https://example.com/a");
    expect(evt.data.replyWebhook).toBe("https://oapi/session");
    expect(evt.id).toContain("m1");
    expect(r.reply).toContain("⏳");
  });

  it("无链接 → 不派事件（落到自由识别分支）", async () => {
    await handleInboundMessage({ ...msg, textContent: "今天天气不错" });
    expect(send).not.toHaveBeenCalled();
  });
});

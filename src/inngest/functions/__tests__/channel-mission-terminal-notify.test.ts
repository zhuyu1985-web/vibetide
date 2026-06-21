import { describe, it, expect, vi, beforeEach } from "vitest";

const { getSessionByActiveMissionId, sendChannelResult } = vi.hoisted(() => ({
  getSessionByActiveMissionId: vi.fn(),
  sendChannelResult: vi.fn(),
}));
vi.mock("@/lib/dal/channel-sessions", () => ({ getSessionByActiveMissionId }));
vi.mock("@/lib/channels/channel-result-notify", () => ({ sendChannelResult }));

import { runTerminalNotify } from "../channel-mission-terminal-notify";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runTerminalNotify", () => {
  it("反查到 session → 调 sendChannelResult（channelCtx 来自 session）", async () => {
    getSessionByActiveMissionId.mockResolvedValue({
      id: "s1",
      organizationId: "org1",
      configId: "cfg1",
      platform: "dingtalk",
      chatId: "c1",
      externalUserId: "u1",
      activeMissionId: "m1",
    });
    await runTerminalNotify("m1");
    expect(sendChannelResult).toHaveBeenCalledWith(
      {
        organizationId: "org1",
        configId: "cfg1",
        platform: "dingtalk",
        chatId: "c1",
        externalUserId: "u1",
      },
      "m1",
    );
  });

  it("反查不到 session（非渠道 mission）→ 不调 sendChannelResult", async () => {
    getSessionByActiveMissionId.mockResolvedValue(null);
    await runTerminalNotify("mx");
    expect(sendChannelResult).not.toHaveBeenCalled();
  });
});

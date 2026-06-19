import { describe, it, expect, vi, beforeEach } from "vitest";

const { findFirst, getChannelConfig, sendChannelMessage, resetSession } =
  vi.hoisted(() => ({
    findFirst: vi.fn(),
    getChannelConfig: vi.fn(),
    sendChannelMessage: vi.fn(),
    resetSession: vi.fn(),
  }));

vi.mock("@/db", () => ({ db: { query: { missions: { findFirst } } } }));
vi.mock("@/lib/dal/channels", () => ({ getChannelConfig }));
vi.mock("@/lib/channels/outbound", () => ({ sendChannelMessage }));
vi.mock("@/lib/dal/channel-sessions", () => ({ resetSession }));

import { sendChannelResult } from "../channel-result-notify";

const ctx = {
  organizationId: "org1",
  configId: "cfg1",
  platform: "dingtalk" as const,
  chatId: "c1",
  externalUserId: "u1",
};

beforeEach(() => {
  vi.clearAllMocks();
  getChannelConfig.mockResolvedValue({
    id: "cfg1",
    platform: "dingtalk",
    appKey: "https://oapi/x",
  });
  sendChannelMessage.mockResolvedValue({ success: true });
  resetSession.mockResolvedValue(undefined);
});

describe("sendChannelResult", () => {
  it("满额完成 → 用 finalOutput.summary 发 markdown + 链接 + 复位", async () => {
    findFirst.mockResolvedValue({
      id: "m1",
      status: "completed",
      title: "T",
      finalOutput: { summary: "完成了X" },
    });
    await sendChannelResult(ctx, "m1");
    const arg = sendChannelMessage.mock.calls[0][0];
    expect(arg.content).toContain("完成了X");
    expect(arg.content).toContain("/missions/m1");
    expect(resetSession).toHaveBeenCalledWith({
      configId: "cfg1",
      chatId: "c1",
      externalUserId: "u1",
    });
  });

  it("降级完成 → 退到 finalOutput.message", async () => {
    findFirst.mockResolvedValue({
      id: "m1",
      status: "completed",
      title: "T",
      finalOutput: { message: "部分完成" },
    });
    await sendChannelResult(ctx, "m1");
    expect(sendChannelMessage.mock.calls[0][0].content).toContain("部分完成");
  });

  it("status=failed（正常 resolve）→ 失败文案", async () => {
    findFirst.mockResolvedValue({
      id: "m1",
      status: "failed",
      title: "T",
      finalOutput: { error: true, message: "炸了" },
    });
    await sendChannelResult(ctx, "m1");
    expect(sendChannelMessage.mock.calls[0][0].content).toContain("失败");
  });
});

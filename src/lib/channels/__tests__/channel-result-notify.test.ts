import { describe, it, expect, vi, beforeEach } from "vitest";

const { findFirst, getChannelConfig, sendChannelMessage, resetSession, recordSessionResult, getLatestArticleByMission } =
  vi.hoisted(() => ({
    findFirst: vi.fn(),
    getChannelConfig: vi.fn(),
    sendChannelMessage: vi.fn(),
    resetSession: vi.fn(),
    recordSessionResult: vi.fn(),
    getLatestArticleByMission: vi.fn(),
  }));

vi.mock("@/db", () => ({ db: { query: { missions: { findFirst } } } }));
vi.mock("@/lib/dal/channels", () => ({ getChannelConfig }));
vi.mock("@/lib/channels/outbound", () => ({ sendChannelMessage }));
vi.mock("@/lib/dal/channel-sessions", () => ({ resetSession, recordSessionResult }));
vi.mock("@/lib/dal/articles", () => ({ getLatestArticleByMission }));

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
  recordSessionResult.mockResolvedValue(undefined);
  getLatestArticleByMission.mockResolvedValue({ id: "art1", title: "T", status: "approved" });
});

describe("sendChannelResult", () => {
  it("满额完成 → 发结果 + 跟进提示 + recordSessionResult（不 resetSession）", async () => {
    findFirst.mockResolvedValue({
      id: "m1",
      status: "completed",
      title: "写AI稿",
      finalOutput: { summary: "完成了X" },
    });
    await sendChannelResult(ctx, "m1");
    const arg = sendChannelMessage.mock.calls[0][0];
    expect(arg.content).toContain("完成了X");
    expect(arg.content).toContain("/missions/m1");
    expect(arg.content).toContain("想继续"); // 跟进提示
    expect(recordSessionResult).toHaveBeenCalledWith(
      { configId: "cfg1", chatId: "c1", externalUserId: "u1" },
      expect.objectContaining({ instruction: "写AI稿", resultSummary: "完成了X", articleId: "art1" }),
    );
    expect(resetSession).not.toHaveBeenCalled();
  });

  it("降级完成 → 退到 finalOutput.message，仍记跟进上下文", async () => {
    findFirst.mockResolvedValue({
      id: "m1",
      status: "completed",
      title: "T",
      finalOutput: { message: "部分完成" },
    });
    await sendChannelResult(ctx, "m1");
    expect(sendChannelMessage.mock.calls[0][0].content).toContain("部分完成");
    expect(recordSessionResult).toHaveBeenCalled();
  });

  it("status=failed → 失败文案 + resetSession（不记跟进、不带提示）", async () => {
    findFirst.mockResolvedValue({
      id: "m1",
      status: "failed",
      title: "T",
      finalOutput: { error: true, message: "炸了" },
    });
    await sendChannelResult(ctx, "m1");
    const content = sendChannelMessage.mock.calls[0][0].content;
    expect(content).toContain("失败");
    expect(content).not.toContain("想继续");
    expect(resetSession).toHaveBeenCalledWith({
      configId: "cfg1",
      chatId: "c1",
      externalUserId: "u1",
    });
    expect(recordSessionResult).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const { handleInboundMessage, postToSessionWebhook } = vi.hoisted(() => ({
  handleInboundMessage: vi.fn(),
  postToSessionWebhook: vi.fn(),
}));
vi.mock("../gateway", () => ({ handleInboundMessage }));
vi.mock("../session-webhook", () => ({ postToSessionWebhook }));

import { handleStreamRobotMessage } from "../dingtalk-stream-handler";

const ctx = { organizationId: "org1", configId: "cfg1" };

beforeEach(() => {
  handleInboundMessage.mockReset();
  postToSessionWebhook.mockReset();
});

describe("handleStreamRobotMessage", () => {
  it("文本消息 → 调 gateway（透传 sessionWebhook）并把 ⏳ 回复发回会话", async () => {
    handleInboundMessage.mockResolvedValue({ reply: "⏳ 已收到链接" });
    await handleStreamRobotMessage(
      {
        msgtype: "text",
        msgId: "m1",
        senderStaffId: "u1",
        conversationId: "c1",
        sessionWebhook: "https://oapi/session",
        text: { content: "看看 https://example.com" },
      },
      ctx,
    );
    expect(handleInboundMessage).toHaveBeenCalledTimes(1);
    const arg = handleInboundMessage.mock.calls[0][0];
    expect(arg).toMatchObject({
      platform: "dingtalk",
      organizationId: "org1",
      configId: "cfg1",
      externalMessageId: "m1",
      externalUserId: "u1",
      chatId: "c1",
      textContent: "看看 https://example.com",
      replyWebhook: "https://oapi/session",
    });
    expect(postToSessionWebhook).toHaveBeenCalledWith("https://oapi/session", {
      type: "text",
      content: "⏳ 已收到链接",
    });
  });

  it("非文本消息 → 回执暂不支持，不调 gateway", async () => {
    await handleStreamRobotMessage(
      { msgtype: "picture", msgId: "m2", sessionWebhook: "https://oapi/s2" },
      ctx,
    );
    expect(handleInboundMessage).not.toHaveBeenCalled();
    expect(postToSessionWebhook).toHaveBeenCalledWith(
      "https://oapi/s2",
      expect.objectContaining({ content: expect.stringContaining("暂不支持") }),
    );
  });

  it("空文本 → 不调 gateway 也不回执", async () => {
    await handleStreamRobotMessage(
      { msgtype: "text", msgId: "m3", sessionWebhook: "https://oapi/s3", text: { content: "   " } },
      ctx,
    );
    expect(handleInboundMessage).not.toHaveBeenCalled();
    expect(postToSessionWebhook).not.toHaveBeenCalled();
  });

  it("无 sessionWebhook → 仍处理但不发同步回复", async () => {
    handleInboundMessage.mockResolvedValue({ reply: "⏳" });
    await handleStreamRobotMessage(
      { msgtype: "text", msgId: "m4", text: { content: "https://example.com" } },
      ctx,
    );
    expect(handleInboundMessage).toHaveBeenCalledTimes(1);
    expect(postToSessionWebhook).not.toHaveBeenCalled();
  });
});

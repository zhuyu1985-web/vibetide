import { handleInboundMessage } from "./gateway";
import { postToSessionWebhook } from "./session-webhook";

/**
 * 钉钉 Stream 推下来的机器人消息（只声明我们用到的字段，比 SDK 的 RobotTextMessage
 * 更宽松，以兼容非文本类型消息）。
 */
export interface IncomingRobotMessage {
  msgtype: string;
  msgId?: string;
  senderStaffId?: string;
  senderNick?: string;
  conversationId?: string;
  sessionWebhook?: string;
  text?: { content?: string };
}

export interface StreamRouteContext {
  organizationId: string;
  configId: string;
}

/**
 * 处理一条 Stream 机器人消息：转成 StandardizedMessage → 走现有 gateway
 * （命令 / 链接收稿 / 自由识别）→ 把同步回复（⏳ 或结果）用 sessionWebhook 发回会话。
 *
 * 异步"✅ 已收录"由 gateway 在链接分支派发的 Inngest 事件经同一个 sessionWebhook
 * 发出，与 HTTP 模式完全一致 —— 本函数只负责"消息进来"和"同步回复出去"这一层。
 */
export async function handleStreamRobotMessage(
  msg: IncomingRobotMessage,
  ctx: StreamRouteContext,
): Promise<void> {
  // 非文本消息：若有会话地址，回执提示
  if (msg.msgtype !== "text") {
    if (msg.sessionWebhook) {
      await postToSessionWebhook(msg.sessionWebhook, {
        type: "text",
        content: "暂不支持此类型的消息，请发送文字消息。",
      });
    }
    return;
  }

  const textContent = msg.text?.content?.trim() ?? "";
  if (!textContent) return;

  const { reply } = await handleInboundMessage({
    platform: "dingtalk",
    configId: ctx.configId,
    organizationId: ctx.organizationId,
    externalMessageId: msg.msgId || `dt_stream_${msg.conversationId ?? "unknown"}`,
    externalUserId: msg.senderStaffId || msg.senderNick || "unknown",
    chatId: msg.conversationId || "unknown",
    textContent,
    rawMessage: msg,
    replyWebhook: msg.sessionWebhook,
  });

  // Stream 模式没有 HTTP 响应可承载回复，同步回复（⏳）也走 sessionWebhook。
  if (msg.sessionWebhook && reply) {
    await postToSessionWebhook(msg.sessionWebhook, { type: "text", content: reply });
  }
}

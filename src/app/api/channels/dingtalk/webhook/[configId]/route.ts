import { NextRequest, NextResponse } from "next/server";
import { getChannelConfig } from "@/lib/dal/channels";
import {
  verifyDingtalkSignature,
  isDingtalkTimestampValid,
} from "@/lib/channels/signature";
import { handleInboundMessage, formatForPlatform } from "@/lib/channels/gateway";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ configId: string }> }
) {
  try {
    const { configId } = await params;

    // 1. Load config
    const config = await getChannelConfig(configId);
    if (!config || config.platform !== "dingtalk" || !config.isEnabled) {
      return NextResponse.json({ errcode: 404, errmsg: "Config not found" }, { status: 404 });
    }

    // 2. Verify signature (if robotSecret is configured)
    if (config.robotSecret) {
      const timestamp = req.headers.get("timestamp");
      const sign = req.headers.get("sign");
      if (!timestamp || !sign) {
        return NextResponse.json({ errcode: 401, errmsg: "Missing signature" }, { status: 401 });
      }
      if (!isDingtalkTimestampValid(timestamp)) {
        return NextResponse.json({ errcode: 401, errmsg: "Timestamp expired" }, { status: 401 });
      }
      if (!verifyDingtalkSignature(timestamp, sign, config.robotSecret)) {
        return NextResponse.json({ errcode: 401, errmsg: "Invalid signature" }, { status: 401 });
      }
    }

    // 3. Parse body
    const body = await req.json();
    const msgtype = body.msgtype as string;

    // Only handle text messages for MVP
    if (msgtype !== "text") {
      return NextResponse.json({
        msgtype: "text",
        text: { content: "暂不支持此类型的消息，请发送文字消息。" },
      });
    }

    const textContent = body.text?.content?.trim() ?? "";
    if (!textContent) {
      return NextResponse.json({
        msgtype: "text",
        text: { content: "请发送有效的消息内容。" },
      });
    }

    // 4. Route through gateway
    const { reply, missionId } = await handleInboundMessage({
      platform: "dingtalk",
      configId: config.id,
      organizationId: config.organizationId,
      externalMessageId: body.msgId ?? `dt_${Date.now()}`,
      externalUserId: body.senderStaffId ?? body.senderNick ?? "unknown",
      chatId: body.conversationId ?? "unknown",
      textContent,
      rawMessage: body,
    });

    // 5. Format response
    let replyPayload;
    if (missionId) {
      replyPayload = formatForPlatform("dingtalk", {
        type: "card",
        title: "任务已启动",
        content: reply,
        actions: [
          {
            label: "查看任务",
            url: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/missions/${missionId}`,
          },
        ],
      });
    } else {
      replyPayload = formatForPlatform("dingtalk", {
        type: "text",
        content: reply,
      });
    }

    return NextResponse.json(replyPayload);
  } catch (err) {
    console.error("[dingtalk/webhook] Error:", err);
    return NextResponse.json({
      msgtype: "text",
      text: { content: "抱歉，处理消息时出现错误，请稍后重试。" },
    });
  }
}

// Optional GET for basic health check
export async function GET() {
  return NextResponse.json({ status: "ok", message: "DingTalk webhook endpoint" });
}

import { NextRequest, NextResponse } from "next/server";
import { getChannelConfig } from "@/lib/dal/channels";
import {
  verifyWechatSignature,
  decryptWechatMessage,
  encryptWechatMessage,
} from "@/lib/channels/signature";
import { handleInboundMessage } from "@/lib/channels/gateway";

/**
 * Extract a tag value from simple XML (no external dep).
 * Matches both CDATA and plain content.
 */
function getXmlTag(xml: string, tag: string): string | null {
  const re = new RegExp(
    `<${tag}>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))\\s*<\\/${tag}>`
  );
  const match = xml.match(re);
  return match ? (match[1] ?? match[2] ?? null) : null;
}

/**
 * Build reply XML from plaintext content.
 * plaintext XML structure: <xml><ToUserName>...</ToUserName>...</xml>
 */
function buildReplyPlaintext(
  fromUserName: string,
  toUserName: string,
  content: string
): string {
  return [
    `<xml>`,
    `<ToUserName><![CDATA[${toUserName}]]></ToUserName>`,
    `<FromUserName><![CDATA[${fromUserName}]]></FromUserName>`,
    `<CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>`,
    `<MsgType><![CDATA[text]]></MsgType>`,
    `<Content><![CDATA[${content}]]></Content>`,
    `</xml>`,
  ].join("");
}

function buildEncryptedEnvelope(
  encrypt: string,
  signature: string,
  timestamp: string,
  nonce: string
): string {
  return [
    `<xml>`,
    `<Encrypt><![CDATA[${encrypt}]]></Encrypt>`,
    `<MsgSignature><![CDATA[${signature}]]></MsgSignature>`,
    `<TimeStamp>${timestamp}</TimeStamp>`,
    `<Nonce><![CDATA[${nonce}]]></Nonce>`,
    `</xml>`,
  ].join("");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ configId: string }> }
) {
  try {
    const { configId } = await params;
    const config = await getChannelConfig(configId);
    if (
      !config ||
      config.platform !== "wechat_work" ||
      !config.token ||
      !config.encodingAesKey
    ) {
      return new NextResponse("Config not found", { status: 404 });
    }

    const searchParams = req.nextUrl.searchParams;
    const msgSignature = searchParams.get("msg_signature");
    const timestamp = searchParams.get("timestamp");
    const nonce = searchParams.get("nonce");
    const echostr = searchParams.get("echostr");

    if (!msgSignature || !timestamp || !nonce || !echostr) {
      return new NextResponse("Missing params", { status: 400 });
    }

    if (
      !verifyWechatSignature(
        config.token,
        timestamp,
        nonce,
        echostr,
        msgSignature
      )
    ) {
      return new NextResponse("Invalid signature", { status: 401 });
    }

    const { content } = decryptWechatMessage(echostr, config.encodingAesKey);
    return new NextResponse(content, {
      headers: { "Content-Type": "text/plain" },
    });
  } catch (err) {
    console.error("[wechat/webhook] GET error:", err);
    return new NextResponse("Error", { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ configId: string }> }
) {
  try {
    const { configId } = await params;
    const config = await getChannelConfig(configId);
    if (
      !config ||
      config.platform !== "wechat_work" ||
      !config.isEnabled ||
      !config.token ||
      !config.encodingAesKey
    ) {
      return new NextResponse("Config not found or disabled", { status: 404 });
    }

    const searchParams = req.nextUrl.searchParams;
    const msgSignature = searchParams.get("msg_signature") ?? "";
    const timestamp = searchParams.get("timestamp") ?? "";
    const nonce = searchParams.get("nonce") ?? "";

    const rawBody = await req.text();
    const encryptedMsg = getXmlTag(rawBody, "Encrypt");
    if (!encryptedMsg) {
      return new NextResponse("Missing Encrypt tag", { status: 400 });
    }

    // Verify signature
    if (
      !verifyWechatSignature(
        config.token,
        timestamp,
        nonce,
        encryptedMsg,
        msgSignature
      )
    ) {
      return new NextResponse("Invalid signature", { status: 401 });
    }

    // Decrypt
    const { content: plaintextXml, receiveId } = decryptWechatMessage(
      encryptedMsg,
      config.encodingAesKey
    );

    // Parse inner XML
    const fromUser = getXmlTag(plaintextXml, "FromUserName") ?? "unknown";
    const toUser = getXmlTag(plaintextXml, "ToUserName") ?? receiveId;
    const msgType = getXmlTag(plaintextXml, "MsgType");
    const textContent = getXmlTag(plaintextXml, "Content") ?? "";
    const msgId = getXmlTag(plaintextXml, "MsgId") ?? `wx_${Date.now()}`;
    const agentId = getXmlTag(plaintextXml, "AgentID") ?? "";

    if (msgType !== "text" || !textContent.trim()) {
      // Reply politely for unsupported message types
      const replyText = "暂不支持此类型的消息，请发送文字消息。";
      const replyPlaintext = buildReplyPlaintext(toUser, fromUser, replyText);
      const { encrypt, signature } = encryptWechatMessage(
        replyPlaintext,
        config.token,
        config.encodingAesKey,
        receiveId,
        timestamp,
        nonce
      );
      return new NextResponse(
        buildEncryptedEnvelope(encrypt, signature, timestamp, nonce),
        { headers: { "Content-Type": "application/xml" } }
      );
    }

    // Route through gateway
    const { reply, missionId } = await handleInboundMessage({
      platform: "wechat_work",
      configId: config.id,
      organizationId: config.organizationId,
      externalMessageId: msgId,
      externalUserId: fromUser,
      chatId: agentId || fromUser,
      textContent: textContent.trim(),
      rawMessage: { fromUser, toUser, msgType, agentId },
    });

    const replyText = missionId
      ? `${reply}\n查看任务：${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/missions/${missionId}`
      : reply;

    const replyPlaintext = buildReplyPlaintext(toUser, fromUser, replyText);
    const { encrypt, signature } = encryptWechatMessage(
      replyPlaintext,
      config.token,
      config.encodingAesKey,
      receiveId,
      timestamp,
      nonce
    );

    return new NextResponse(
      buildEncryptedEnvelope(encrypt, signature, timestamp, nonce),
      { headers: { "Content-Type": "application/xml" } }
    );
  } catch (err) {
    console.error("[wechat/webhook] POST error:", err);
    return new NextResponse("Error", { status: 500 });
  }
}

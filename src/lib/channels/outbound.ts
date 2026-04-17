/**
 * Channel Outbound — Platform API clients for sending messages TO DingTalk / WeChat Work.
 *
 * DingTalk: Robot webhook URL with optional HMAC-SHA256 signing.
 * WeChat Work: Exchange access_token via corpId+secret, then /message/send API.
 */

import crypto from "crypto";
import type { ChannelConfigRow } from "@/lib/dal/channels";
import { recordOutboundMessage, updateMessageStatus } from "@/app/actions/channels";
import { formatForPlatform } from "./gateway";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SendOptions {
  config: ChannelConfigRow;
  chatId: string;
  type: "text" | "markdown" | "card";
  title?: string;
  content: string;
  actions?: { label: string; url: string }[];
  missionId?: string;
}

// ---------------------------------------------------------------------------
// DingTalk
// ---------------------------------------------------------------------------

/**
 * Send a DingTalk message via robot webhook URL.
 * The robot webhook URL is stored in config.appKey field.
 * config.robotSecret is used for HMAC-SHA256 signing when present.
 */
export async function sendDingtalkMessage(
  opts: SendOptions
): Promise<{ success: boolean; error?: string }> {
  const { config } = opts;
  const webhookUrl = config.appKey;
  if (!webhookUrl) {
    return { success: false, error: "缺少钉钉 Webhook URL" };
  }

  // Build signed URL if robotSecret exists
  let finalUrl = webhookUrl;
  if (config.robotSecret) {
    const timestamp = Date.now().toString();
    const stringToSign = `${timestamp}\n${config.robotSecret}`;
    const hmac = crypto.createHmac("sha256", config.robotSecret);
    hmac.update(stringToSign, "utf-8");
    const sign = encodeURIComponent(hmac.digest("base64"));
    const sep = webhookUrl.includes("?") ? "&" : "?";
    finalUrl = `${webhookUrl}${sep}timestamp=${timestamp}&sign=${sign}`;
  }

  const payload = formatForPlatform("dingtalk", {
    type: opts.type,
    title: opts.title,
    content: opts.content,
    actions: opts.actions,
  });

  // Record the outbound message before sending
  const { messageId } = await recordOutboundMessage({
    organizationId: config.organizationId,
    configId: config.id,
    platform: "dingtalk",
    externalUserId: opts.chatId,
    chatId: opts.chatId,
    content: payload as Record<string, unknown>,
    missionId: opts.missionId,
    status: "sent",
  });

  try {
    const res = await fetch(finalUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { errcode?: number; errmsg?: string };
    if (data.errcode !== 0) {
      await updateMessageStatus(messageId, "failed", data.errmsg ?? "未知错误");
      return { success: false, error: data.errmsg };
    }
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "未知错误";
    await updateMessageStatus(messageId, "failed", errorMsg);
    return { success: false, error: errorMsg };
  }
}

// ---------------------------------------------------------------------------
// WeChat Work
// ---------------------------------------------------------------------------

/** In-process access_token cache keyed by "corpId:secret". */
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getWechatAccessToken(config: ChannelConfigRow): Promise<string> {
  const cacheKey = `${config.appKey}:${config.appSecret}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.token;
  }

  const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${config.appKey}&corpsecret=${config.appSecret}`;
  const res = await fetch(url);
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    errcode?: number;
    errmsg?: string;
  };

  if (data.errcode !== 0 || !data.access_token) {
    throw new Error(
      `获取企业微信 access_token 失败: ${data.errmsg ?? "未知错误"}`
    );
  }

  tokenCache.set(cacheKey, {
    token: data.access_token,
    // Refresh 60 seconds before expiry to avoid using a stale token
    expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000 - 60_000,
  });

  return data.access_token;
}

/**
 * Send a WeChat Work message via the official /message/send API.
 * Requires corpId (appKey) + corpsecret (appSecret) + agentId in config.
 */
export async function sendWechatMessage(
  opts: SendOptions
): Promise<{ success: boolean; error?: string }> {
  const { config } = opts;
  if (!config.appKey || !config.appSecret || !config.agentId) {
    return { success: false, error: "缺少企业微信凭证（CorpID / Secret / AgentID）" };
  }

  let token: string;
  try {
    token = await getWechatAccessToken(config);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "获取 access_token 失败",
    };
  }

  const basePayload = formatForPlatform("wechat_work", {
    type: opts.type,
    title: opts.title,
    content: opts.content,
    actions: opts.actions,
  }) as Record<string, unknown>;

  const payload: Record<string, unknown> = {
    touser: opts.chatId,
    agentid: parseInt(config.agentId, 10),
    safe: 0,
    ...basePayload,
  };

  const { messageId } = await recordOutboundMessage({
    organizationId: config.organizationId,
    configId: config.id,
    platform: "wechat_work",
    externalUserId: opts.chatId,
    chatId: opts.chatId,
    content: payload,
    missionId: opts.missionId,
    status: "sent",
  });

  try {
    const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { errcode?: number; errmsg?: string };
    if (data.errcode !== 0) {
      await updateMessageStatus(messageId, "failed", data.errmsg ?? "未知错误");
      return { success: false, error: data.errmsg };
    }
    return { success: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "未知错误";
    await updateMessageStatus(messageId, "failed", errorMsg);
    return { success: false, error: errorMsg };
  }
}

// ---------------------------------------------------------------------------
// Unified router
// ---------------------------------------------------------------------------

/**
 * Route a send request to the correct platform client.
 */
export async function sendChannelMessage(
  opts: SendOptions
): Promise<{ success: boolean; error?: string }> {
  if (opts.config.platform === "dingtalk") {
    return sendDingtalkMessage(opts);
  }
  return sendWechatMessage(opts);
}

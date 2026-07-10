/**
 * Channel media download —— 从钉钉/企微把语音消息的媒体文件下载成 Buffer。
 *
 * 钉钉（企业内部机器人）：v1.0 oauth2/accessToken（clientId=AppKey + inboundSecret=AppSecret）
 *   → robot/messageFiles/download（downloadCode + robotCode）拿临时 downloadUrl → GET 二进制。
 * 企微：corpid(appKey) + corpsecret(appSecret) 换 access_token → media/get?media_id 拿二进制。
 */

import type { ChannelConfigRow } from "@/lib/dal/channels";
import type { AudioFormat } from "@/lib/asr";

/** 语音消息的媒体定位信息（由 webhook 解析后透传给 Inngest）。 */
export interface ChannelMediaRef {
  /** 钉钉新版临时下载码（优先）。 */
  downloadCode?: string;
  /** 钉钉旧版 / 企微 mediaId。 */
  mediaId?: string;
  /** 平台标注的格式（钉钉默认 amr，企微取 Format 字段）。 */
  format: AudioFormat;
  durationMs?: number;
}

function normalizeFormat(raw: string | undefined): AudioFormat {
  const f = (raw ?? "amr").toLowerCase();
  if (f === "amr" || f === "silk" || f === "mp3" || f === "wav" || f === "pcm" || f === "opus") {
    return f;
  }
  return "amr";
}

// ── 钉钉 v1.0 access token 缓存（按 clientId）──
const dingtalkTokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getDingtalkAccessToken(config: ChannelConfigRow): Promise<string> {
  const appKey = config.clientId; // 企业内部机器人 AppKey
  const appSecret = config.inboundSecret; // 企业内部机器人 AppSecret
  if (!appKey || !appSecret) {
    throw new Error("钉钉缺少 clientId/inboundSecret，无法下载语音媒体");
  }
  const cached = dingtalkTokenCache.get(appKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }
  const res = await fetch("https://api.dingtalk.com/v1.0/oauth2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appKey, appSecret }),
  });
  const data = (await res.json()) as {
    accessToken?: string;
    expireIn?: number;
    message?: string;
  };
  if (!data.accessToken) {
    throw new Error(`钉钉换取 accessToken 失败：${data.message ?? "未知错误"}`);
  }
  dingtalkTokenCache.set(appKey, {
    token: data.accessToken,
    expiresAt: Date.now() + (data.expireIn ?? 7200) * 1000 - 60_000,
  });
  return data.accessToken;
}

async function downloadDingtalkAudio(
  config: ChannelConfigRow,
  media: ChannelMediaRef,
): Promise<{ buffer: Buffer; format: AudioFormat }> {
  if (!media.downloadCode) {
    throw new Error("钉钉语音缺少 downloadCode，无法下载");
  }
  const token = await getDingtalkAccessToken(config);
  const robotCode = config.clientId; // 企业内部机器人 robotCode = AppKey
  const res = await fetch(
    "https://api.dingtalk.com/v1.0/robot/messageFiles/download",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-acs-dingtalk-access-token": token,
      },
      body: JSON.stringify({ downloadCode: media.downloadCode, robotCode }),
    },
  );
  const data = (await res.json()) as { downloadUrl?: string; message?: string };
  if (!data.downloadUrl) {
    throw new Error(`钉钉获取语音下载地址失败：${data.message ?? "未知错误"}`);
  }
  const fileRes = await fetch(data.downloadUrl);
  if (!fileRes.ok) {
    throw new Error(`钉钉语音文件下载失败：HTTP ${fileRes.status}`);
  }
  const buffer = Buffer.from(await fileRes.arrayBuffer());
  return { buffer, format: normalizeFormat(media.format) };
}

// ── 企微 access token 缓存（按 corpid:secret）──
const wechatTokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getWechatAccessToken(config: ChannelConfigRow): Promise<string> {
  if (!config.appKey || !config.appSecret) {
    throw new Error("企微缺少 CorpID/Secret，无法下载语音媒体");
  }
  const cacheKey = `${config.appKey}:${config.appSecret}`;
  const cached = wechatTokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }
  const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${config.appKey}&corpsecret=${config.appSecret}`;
  const res = await fetch(url);
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    errmsg?: string;
  };
  if (!data.access_token) {
    throw new Error(`企微换取 access_token 失败：${data.errmsg ?? "未知错误"}`);
  }
  wechatTokenCache.set(cacheKey, {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000 - 60_000,
  });
  return data.access_token;
}

async function downloadWechatAudio(
  config: ChannelConfigRow,
  media: ChannelMediaRef,
): Promise<{ buffer: Buffer; format: AudioFormat }> {
  if (!media.mediaId) {
    throw new Error("企微语音缺少 mediaId，无法下载");
  }
  const token = await getWechatAccessToken(config);
  const url = `https://qyapi.weixin.qq.com/cgi-bin/media/get?access_token=${token}&media_id=${encodeURIComponent(media.mediaId)}`;
  const res = await fetch(url);
  const contentType = res.headers.get("content-type") ?? "";
  // 出错时企微返回 JSON 而非二进制
  if (contentType.includes("application/json")) {
    const data = (await res.json()) as { errmsg?: string };
    throw new Error(`企微语音下载失败：${data.errmsg ?? "未知错误"}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, format: normalizeFormat(media.format) };
}

/** 统一入口：按平台下载语音媒体。 */
export async function downloadChannelAudio(
  config: ChannelConfigRow,
  media: ChannelMediaRef,
): Promise<{ buffer: Buffer; format: AudioFormat }> {
  if (config.platform === "dingtalk") {
    return downloadDingtalkAudio(config, media);
  }
  return downloadWechatAudio(config, media);
}

import crypto from "crypto";
import {
  AsrProviderNotConfiguredError,
  type AsrProvider,
  type AsrResult,
  type AsrTranscribeOptions,
  type AudioFormat,
} from "../types";
import { defaultSampleRate } from "../transcode";

/**
 * 阿里云智能语音交互（NLS）一句话识别 RESTful 实现。
 * 文档：一句话识别 RESTful API（POST /stream/v1/asr）。
 *
 * 鉴权两条路：
 *  1) 直接配 ALIYUN_NLS_TOKEN（开发期快路径，token 约 24h 有效）；
 *  2) 配 AccessKey（ALIYUN_NLS_AK_ID/SECRET）→ CreateToken 自动换 token（带缓存）。
 */

const META_ENDPOINT = "https://nls-meta.cn-shanghai.aliyuncs.com/";

function getGatewayEndpoint(): string {
  return (
    process.env.ALIYUN_NLS_ENDPOINT ??
    "https://nls-gateway-cn-shanghai.aliyuncs.com"
  ).replace(/\/$/, "");
}

// ── token 缓存（按 AppKey 维度）──
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/** 阿里云 RPC v1 percentEncode。 */
function percentEncode(s: string): string {
  return encodeURIComponent(s)
    .replace(/\+/g, "%20")
    .replace(/\*/g, "%2A")
    .replace(/%7E/g, "~");
}

/** 通过 CreateToken（RPC v1 签名）换取临时 token。 */
async function createTokenViaAccessKey(
  akId: string,
  akSecret: string,
): Promise<{ token: string; expiresAtMs: number }> {
  const params: Record<string, string> = {
    AccessKeyId: akId,
    Action: "CreateToken",
    Format: "JSON",
    RegionId: "cn-shanghai",
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: crypto.randomUUID(),
    SignatureVersion: "1.0",
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    Version: "2019-02-28",
  };

  const cqs = Object.keys(params)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join("&");

  const stringToSign = `GET&${percentEncode("/")}&${percentEncode(cqs)}`;
  const signature = crypto
    .createHmac("sha1", `${akSecret}&`)
    .update(stringToSign, "utf8")
    .digest("base64");

  const url = `${META_ENDPOINT}?Signature=${percentEncode(signature)}&${cqs}`;
  const res = await fetch(url);
  const data = (await res.json()) as {
    Token?: { Id?: string; ExpireTime?: number };
    Message?: string;
  };
  if (!data.Token?.Id) {
    throw new AsrProviderNotConfiguredError(
      "aliyun",
      `CreateToken 失败：${data.Message ?? "未知错误"}`,
    );
  }
  // ExpireTime 为 unix 秒
  const expiresAtMs = (data.Token.ExpireTime ?? 0) * 1000;
  return { token: data.Token.Id, expiresAtMs };
}

async function resolveToken(appKey: string): Promise<string> {
  const staticToken = process.env.ALIYUN_NLS_TOKEN;
  if (staticToken) return staticToken;

  const akId = process.env.ALIYUN_NLS_AK_ID;
  const akSecret = process.env.ALIYUN_NLS_AK_SECRET;
  if (!akId || !akSecret) {
    throw new AsrProviderNotConfiguredError(
      "aliyun",
      "缺少 ALIYUN_NLS_TOKEN 或 ALIYUN_NLS_AK_ID/SECRET",
    );
  }

  const cached = tokenCache.get(appKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }
  const { token, expiresAtMs } = await createTokenViaAccessKey(akId, akSecret);
  tokenCache.set(appKey, {
    token,
    expiresAt: expiresAtMs > Date.now() ? expiresAtMs : Date.now() + 60 * 60 * 1000,
  });
  return token;
}

export const aliyunProvider: AsrProvider = {
  id: "aliyun",
  supportedFormats: ["amr", "wav", "pcm", "mp3", "opus"],

  async transcribe(
    buffer: Buffer,
    format: AudioFormat,
    opts?: AsrTranscribeOptions,
  ): Promise<AsrResult> {
    const appKey = process.env.ALIYUN_NLS_APP_KEY;
    if (!appKey) {
      throw new AsrProviderNotConfiguredError("aliyun", "缺少 ALIYUN_NLS_APP_KEY");
    }
    const token = await resolveToken(appKey);
    const sampleRate = opts?.sampleRate ?? defaultSampleRate(format);

    const qs = new URLSearchParams({
      appkey: appKey,
      format,
      sample_rate: String(sampleRate),
      enable_punctuation_prediction: "true",
      enable_inverse_text_normalization: "true",
    });
    const url = `${getGatewayEndpoint()}/stream/v1/asr?${qs.toString()}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "X-NLS-Token": token,
        "Content-Type": "application/octet-stream",
      },
      body: new Uint8Array(buffer),
    });

    const data = (await res.json()) as {
      status?: number;
      message?: string;
      result?: string;
    };
    // 20000000 = 成功
    if (data.status !== 20000000) {
      throw new Error(`阿里云 ASR 识别失败：${data.message ?? data.status ?? "未知"}`);
    }

    return {
      text: (data.result ?? "").trim(),
      // 一句话识别 RESTful 不返回置信度，给经验值
      confidence: data.result ? 0.85 : 0,
      provider: "aliyun",
      raw: data,
    };
  },
};

import type { AsrProviderId } from "./types";

const VALID_PROVIDERS: readonly AsrProviderId[] = ["aliyun", "tencent"] as const;

let warnedFallback = false;

/**
 * 从 env 解析当前 ASR provider。
 * 默认 "aliyun"（国内可直连、中文准、原生吃 amr）。
 * 单次调用可用 transcribeAudio 的 forceProvider 覆盖。
 */
export function getActiveAsrProvider(): AsrProviderId {
  const raw = (process.env.ASR_PROVIDER ?? "").trim().toLowerCase();
  if ((VALID_PROVIDERS as readonly string[]).includes(raw)) {
    return raw as AsrProviderId;
  }
  if (raw && !warnedFallback) {
    warnedFallback = true;
    console.warn(
      `[asr] ASR_PROVIDER="${raw}" 不识别，回退 "aliyun"。可选值：${VALID_PROVIDERS.join(", ")}`,
    );
  }
  return "aliyun";
}

/** 某 provider 所需 env 是否齐全（缺则视为未配置）。 */
export function isAsrProviderConfigured(provider?: AsrProviderId): boolean {
  const id = provider ?? getActiveAsrProvider();
  if (id === "aliyun") {
    // 静态 token 直接可用；否则需 AppKey + AccessKey 一对换 token。
    const hasToken = Boolean(process.env.ALIYUN_NLS_TOKEN);
    const hasAk = Boolean(
      process.env.ALIYUN_NLS_AK_ID && process.env.ALIYUN_NLS_AK_SECRET,
    );
    return Boolean(process.env.ALIYUN_NLS_APP_KEY) && (hasToken || hasAk);
  }
  if (id === "tencent") {
    return Boolean(
      process.env.TENCENT_ASR_SECRET_ID && process.env.TENCENT_ASR_SECRET_KEY,
    );
  }
  return false;
}

/** 低置信回显确认门槛（默认 0.6）。 */
export function getAsrMinConfidence(): number {
  const raw = Number(process.env.ASR_MIN_CONFIDENCE);
  return Number.isFinite(raw) && raw > 0 && raw <= 1 ? raw : 0.6;
}

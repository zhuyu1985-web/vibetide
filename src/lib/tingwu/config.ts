import "server-only";

export class TingwuConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TingwuConfigError";
  }
}

export interface TingwuConfig {
  accessKeyId: string;
  accessKeySecret: string;
  appKey: string;
  /** OpenAPI 接入点（仅 cn-beijing 有公网端点） */
  endpoint: string;
  region: string;
}

/**
 * 通义听悟是否就绪：feature flag 命中 + 三把 key 齐全。
 * 未就绪则上游优雅跳过（不报错）。
 */
export function isTingwuEnabled(): boolean {
  return (
    process.env.VIDEO_ANALYSIS_PROVIDER === "aliyun_tingwu" &&
    !!process.env.ALIBABA_CLOUD_ACCESS_KEY_ID &&
    !!process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET &&
    !!process.env.TINGWU_APP_KEY
  );
}

export function requireTingwuConfig(): TingwuConfig {
  const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;
  const appKey = process.env.TINGWU_APP_KEY;
  if (!accessKeyId || !accessKeySecret || !appKey) {
    throw new TingwuConfigError(
      "通义听悟未配置（需 ALIBABA_CLOUD_ACCESS_KEY_ID / ALIBABA_CLOUD_ACCESS_KEY_SECRET / TINGWU_APP_KEY）",
    );
  }
  return {
    accessKeyId,
    accessKeySecret,
    appKey,
    endpoint: process.env.TINGWU_ENDPOINT || "tingwu.cn-beijing.aliyuncs.com",
    region: "cn-beijing",
  };
}

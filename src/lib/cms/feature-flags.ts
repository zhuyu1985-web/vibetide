/**
 * Feature flag 与配置读取。
 * 所有 CMS 相关代码必须通过此文件读取 env，不得直接访问 process.env.CMS_*。
 */

export interface CmsConfig {
  host: string;
  loginCmcId: string;
  loginCmcTid: string;
  tenantId: string;
  username: string;
  timeoutMs: number;
  maxRetries: number;
  defaultCoverUrl: string;
}

const REQUIRED_ENVS = [
  "CMS_HOST",
  "CMS_LOGIN_CMC_ID",
  "CMS_LOGIN_CMC_TID",
  "CMS_TENANT_ID",
  "CMS_USERNAME",
] as const;

export function isCmsPublishEnabled(): boolean {
  return process.env.VIBETIDE_CMS_PUBLISH_ENABLED === "true";
}

export function isCatalogSyncEnabled(): boolean {
  // 默认开启（同步是只读动作，低风险）
  return process.env.VIBETIDE_CATALOG_SYNC_ENABLED !== "false";
}

export function requireCmsConfig(): CmsConfig {
  const missing = REQUIRED_ENVS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `[cms] Missing required env: ${missing.join(", ")}. 请检查 .env.local`,
    );
  }

  return {
    host: process.env.CMS_HOST!,
    loginCmcId: process.env.CMS_LOGIN_CMC_ID!,
    loginCmcTid: process.env.CMS_LOGIN_CMC_TID!,
    tenantId: process.env.CMS_TENANT_ID!,
    username: process.env.CMS_USERNAME!,
    timeoutMs: parseInt(process.env.CMS_TIMEOUT_MS ?? "15000", 10),
    maxRetries: parseInt(process.env.CMS_MAX_RETRIES ?? "3", 10),
    defaultCoverUrl:
      process.env.CMS_DEFAULT_COVER_URL ??
      "https://media.demo.chinamcloud.cn/image/default-cover.jpg",
  };
}

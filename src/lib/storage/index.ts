/**
 * 对象存储统一入口（barrel）。
 *
 * 按 STORAGE_PROVIDER 环境变量选 provider：
 *   "tencent" → 腾讯云 COS（需配 COS_SECRET_ID / COS_SECRET_KEY / COS_REGION / COS_BUCKET）
 *   其他（默认） → 火山引擎 TOS（向后兼容，原 volc-tos.ts 行为不变）
 *
 * 导出签名与原 volc-tos.ts 完全一致，调用方零改动。
 * provider 在模块加载时选定一次（与 LLM_PROVIDER 同范式；切换靠重启）。
 */
export type { StorageProvider } from "./types";

import { volcStorage } from "./volc";
import { tencentStorage } from "./tencent";
import type { StorageProvider } from "./types";

const providerName = (process.env.STORAGE_PROVIDER || "volc").toLowerCase();
const provider: StorageProvider =
  providerName === "tencent" ? tencentStorage : volcStorage;

export const generateUploadUrl = (
  objectKey: string,
  contentType: string,
  expiresIn?: number
): string => provider.generateUploadUrl(objectKey, contentType, expiresIn);

export const generateDownloadUrl = (
  objectKey: string,
  expiresIn?: number
): string => provider.generateDownloadUrl(objectKey, expiresIn);

export const getPublicUrl = (objectKey: string): string =>
  provider.getPublicUrl(objectKey);

export const putObject = (
  objectKey: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<void> => provider.putObject(objectKey, body, contentType);

export const deleteObject = (objectKey: string): Promise<void> =>
  provider.deleteObject(objectKey);

export const defaultBucket: string = provider.defaultBucket;

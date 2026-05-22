/**
 * Ayrshare 适配层统一出口。
 *
 * 调用方只从此文件 import；不要直接引用 client / publish / webhook 内部文件。
 *
 * 设计文档：/Users/zhuyu/.claude/plans/tophub-x-instagram-twitter-sunny-papert.md §3.1
 */

// —— Client + 配置 ——
export {
  AyrshareClient,
  requireAyrshareConfig,
  type AyrshareClientConfig,
  type AyrshareEnvConfig,
} from "./client";

// —— Publish 主流程 ——
export {
  publishToAyrshare,
  rollupArticleStatus,
  type PublishToAyrshareInput,
  type PublishToAyrshareResult,
  type ExternalPublicationRow,
} from "./publish";

// —— Webhook ——
export {
  handleAyrshareWebhook,
  processAyrshareWebhook,
  verifyAyrshareSignature,
  type AyrshareWebhookHandleResult,
} from "./webhook";

// —— DTO / Schema ——
export {
  SUPPORTED_PLATFORMS,
  AyrsharePlatformSchema,
  AyrsharePostResponseSchema,
  AyrshareWebhookPayloadSchema,
  type AyrsharePlatform,
  type AyrsharePostRequest,
  type AyrsharePostResponse,
  type AyrsharePostIdResult,
  type AyrshareWebhookPayload,
} from "./types";

// —— 错误类型 ——
export {
  AyrshareError,
  AyrshareAuthError,
  AyrshareBusinessError,
  AyrshareNetworkError,
  AyrshareSchemaError,
  AyrshareConfigError,
  classifyAyrshareError,
  isRetriableAyrshareError,
  type AyrshareErrorStage,
} from "./errors";

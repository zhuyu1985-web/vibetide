/**
 * CMS 适配层统一出口。
 *
 * 调用方只从此文件 import；不要直接引用 client/mapper/catalog-sync 等内部文件。
 *
 * 设计文档：docs/superpowers/specs/2026-04-18-newsclaw-cms-aigc-scenario-design.md §3
 */

// —— 配置 & feature flag ——
export {
  isCmsPublishEnabled,
  isCatalogSyncEnabled,
  requireCmsConfig,
  type CmsConfig,
} from "./feature-flags";

// —— 后续 Task 会追加 ——
// export { CmsClient } from "./client";
// export { saveArticle, getArticleDetail, getChannels, getAppList, getCatalogTree } from "./api-endpoints";
// export { CmsAuthError, CmsBusinessError, CmsNetworkError, CmsSchemaError, CmsConfigError } from "./errors";
// export { mapArticleToCms, determineType } from "./article-mapper";
// export { syncCmsCatalogs } from "./catalog-sync";
// export { classifyState, isRetriableError } from "./status-machine";

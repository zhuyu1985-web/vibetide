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

// —— CmsClient ——
export { CmsClient, type CmsClientConfig, type CmsRequestOptions } from "./client";

// —— API endpoints ——
export {
  getChannels,
  getAppList,
  getCatalogTree,
  saveArticle,
  getArticleDetail,
  type GetCatalogTreeOptions,
} from "./api-endpoints";

// —— DTO & schema types ——
export {
  type CmsResponseEnvelope,
  type CmsChannelsData,
  type CmsChannelInfo,
  type CmsApp,
  type CmsCatalogNode,
  type CmsArticleSaveDTO,
  type CmsArticleSaveResponseData,
  type CmsArticleDetail,
  type CmsImageSimpleDTO,
  type CmsArticleContentDto,
  type CmsAppCustomParams,
  type CmsListStyleDto,
} from "./types";

// —— Mapper 入口 ——
export {
  mapArticleToCms,
  loadMapperContext,
  determineType,
  type MapperContext,
  type ArticleForMapper,
  type ArticleForMapping,
} from "./article-mapper";

// —— 栏目同步主流程 ——
export { syncCmsCatalogs, type SyncCmsCatalogsOptions, type SyncResult } from "./catalog-sync";

// —— 后续 Task 会追加 ——
// export { classifyState, isRetriableError } from "./status-machine";

// —— 错误类型 ——
export {
  CmsError,
  CmsAuthError,
  CmsBusinessError,
  CmsNetworkError,
  CmsSchemaError,
  CmsConfigError,
  isRetriableCmsError,
  classifyCmsError,
  type CmsErrorStage,
} from "./errors";

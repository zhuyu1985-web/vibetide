import { z } from "zod";
import type { CmsClient } from "./client";
import {
  CmsChannelsDataSchema,
  CmsAppListSchema,
  CmsCatalogNodeSchema,
  CmsArticleSaveResponseDataSchema,
  CmsArticleDetailSchema,
  type CmsChannelsData,
  type CmsApp,
  type CmsCatalogNode,
  type CmsArticleSaveDTO,
  type CmsArticleSaveResponseData,
  type CmsArticleDetail,
  type CmsResponseEnvelope,
} from "./types";
import { CmsSchemaError } from "./errors";

const CmsCatalogListSchema = z.array(CmsCatalogNodeSchema);

/**
 * 获取渠道列表（/web/catalog/getChannels）
 *
 * @param options.appAndWeb   1=只返 APP 和网站渠道；0=返全部
 * @param options.privilegeFlag 0=走权限查询；1=不走权限
 */
export async function getChannels(
  client: CmsClient,
  options: { appAndWeb?: 0 | 1; privilegeFlag?: 0 | 1 } = {},
): Promise<CmsResponseEnvelope<CmsChannelsData>> {
  const res = await client.post<typeof options, unknown>(
    "/web/catalog/getChannels",
    options,
  );

  const parsed = CmsChannelsDataSchema.safeParse(res.data);
  if (!parsed.success) {
    throw new CmsSchemaError(
      `getChannels 响应 data 结构不符：${parsed.error.message}`,
    );
  }

  return {
    state: res.state,
    success: res.success,
    message: res.message,
    data: parsed.data,
  };
}

/**
 * 获取应用列表（/web/application/getAppList）
 *
 * @param type 渠道类型："1"=APP, "2"=网站, "3"=微信 ...
 */
export async function getAppList(
  client: CmsClient,
  type: "1" | "2" | "3" | "4" | "5" | "6" | "13" | "21",
): Promise<CmsResponseEnvelope<CmsApp[]>> {
  const res = await client.post<{ type: string }, unknown>(
    "/web/application/getAppList",
    { type },
  );

  const parsed = CmsAppListSchema.safeParse(res.data);
  if (!parsed.success) {
    throw new CmsSchemaError(
      `getAppList 响应 data 结构不符：${parsed.error.message}`,
    );
  }

  return {
    state: res.state,
    success: res.success,
    message: res.message,
    data: parsed.data,
  };
}

export interface GetCatalogTreeOptions {
  appId?: string;
  types?: string;               // "1" 新闻 / "4" 图片 / 多个用逗号
  channelCode?: string;
  parentId?: string;
  parentIds?: string;
  catalogName?: string;
  alias?: string;
  isPrivilege?: string;         // "false" 表示不走权限
  isShowBindingCatalog?: string;
  persionalFlag?: string;
  commitFlag?: string;
  startTime?: string;
  endTime?: string;
  isQuote?: boolean;
}

/**
 * 获取栏目树（/web/catalog/getTree）
 */
export async function getCatalogTree(
  client: CmsClient,
  options: GetCatalogTreeOptions = {},
): Promise<CmsResponseEnvelope<CmsCatalogNode[]>> {
  const res = await client.post<GetCatalogTreeOptions, unknown>(
    "/web/catalog/getTree",
    options,
  );

  const parsed = CmsCatalogListSchema.safeParse(res.data);
  if (!parsed.success) {
    throw new CmsSchemaError(
      `getCatalogTree 响应 data 结构不符：${parsed.error.message}`,
    );
  }

  return {
    state: res.state,
    success: res.success,
    message: res.message,
    data: parsed.data,
  };
}

/**
 * 文稿入库（/web/article/save）
 */
export async function saveArticle(
  client: CmsClient,
  dto: CmsArticleSaveDTO,
): Promise<CmsResponseEnvelope<CmsArticleSaveResponseData>> {
  const res = await client.post<CmsArticleSaveDTO, unknown>(
    "/web/article/save",
    dto,
    { timeoutMs: 20000 },
  );

  const parsed = CmsArticleSaveResponseDataSchema.safeParse(res.data);
  if (!parsed.success) {
    throw new CmsSchemaError(
      `saveArticle 响应 data 结构不符：${parsed.error.message}`,
    );
  }

  return {
    state: res.state,
    success: res.success,
    message: res.message,
    data: parsed.data,
  };
}

/**
 * 查询文稿详情（/web/article/getMyArticleDetail）
 */
export async function getArticleDetail(
  client: CmsClient,
  articleId: string,
): Promise<CmsResponseEnvelope<CmsArticleDetail>> {
  const res = await client.get<unknown>(
    "/web/article/getMyArticleDetail",
    { articleId },
  );

  const parsed = CmsArticleDetailSchema.safeParse(res.data);
  if (!parsed.success) {
    throw new CmsSchemaError(
      `getArticleDetail 响应 data 结构不符：${parsed.error.message}`,
    );
  }

  return {
    state: res.state,
    success: res.success,
    message: res.message,
    data: parsed.data,
  };
}

import type { CmsClient } from "./client";
import {
  CmsChannelsDataSchema,
  CmsAppListSchema,
  type CmsChannelsData,
  type CmsApp,
  type CmsResponseEnvelope,
} from "./types";
import { CmsSchemaError } from "./errors";

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

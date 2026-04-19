import type { CmsArticleSaveDTO } from "../types";
import { CmsConfigError, CmsSchemaError } from "../errors";
import { requireCmsConfig } from "../feature-flags";
import { getAppChannelBySlug } from "@/lib/dal/app-channels";
import { listCmsApps } from "@/lib/dal/cms-apps";

import type { MapperContext, ArticleForMapper } from "./common";
import { mapToType1, type Type1Article } from "./type1-article";
import { mapToType2, type Type2Article, type GalleryImage } from "./type2-gallery";
import { mapToType4, type Type4Article } from "./type4-external";
import { determineType, type ArticleForTypeDetection } from "./determine-type";

export { type MapperContext, type ArticleForMapper } from "./common";
export { determineType } from "./determine-type";

/**
 * 统一的 article 输入结构（字段取并集；mapper 按需读取）。
 */
export interface ArticleForMapping extends ArticleForMapper, ArticleForTypeDetection {
  body: string | null;
  externalUrl: string | null;
  galleryImages: GalleryImage[] | null;
}

/**
 * 统一入口：根据 article 字段自动选择 type mapper。
 *
 * P1 仅支持 type 1/2/4。type 5/11 会抛 CmsSchemaError（Phase 2+ 接入）。
 */
export async function mapArticleToCms(
  article: ArticleForMapping,
  ctx: MapperContext,
): Promise<CmsArticleSaveDTO> {
  const type = determineType(article);

  switch (type) {
    case "1":
      return mapToType1(
        { ...article, body: article.body ?? "" } as Type1Article,
        ctx,
      );

    case "2":
      return mapToType2(
        { ...article, galleryImages: article.galleryImages ?? [] } as Type2Article,
        ctx,
      );

    case "4":
      return mapToType4(
        { ...article, externalUrl: article.externalUrl ?? "" } as Type4Article,
        ctx,
      );

    case "5":
      throw new CmsSchemaError(
        "type=5 (视频新闻) 在 P1 不支持；由华栖云 AIGC 侧自行入库（方案 A，见 spec §1.1）",
      );

    case "11":
      throw new CmsSchemaError(
        "type=11 (音频新闻) 在 P1 不支持；Phase 2 接入 TTS 后启用",
      );
  }
}

/**
 * 从 app_channels + cms_apps + env 加载 MapperContext。
 *
 * @param organizationId 组织 id
 * @param appChannelSlug 目标 APP 栏目 slug（app_news / app_politics / ...）
 * @param org             { brandName: string } 组织信息（用于 source 字段）
 */
export async function loadMapperContext(
  organizationId: string,
  appChannelSlug: string,
  org: { brandName: string },
): Promise<MapperContext> {
  const config = requireCmsConfig();

  const appChannel = await getAppChannelBySlug(organizationId, appChannelSlug);
  if (!appChannel) {
    throw new CmsConfigError(
      `app_channel_not_mapped: ${appChannelSlug}（请在 /settings/cms-mapping 配置）`,
    );
  }

  if (!appChannel.defaultCatalog) {
    throw new CmsConfigError(
      `app_channel "${appChannelSlug}" 未绑定 default_catalog；请先运行 cms_catalog_sync 并在 /settings/cms-mapping 设置`,
    );
  }

  const catalog = appChannel.defaultCatalog;
  // 找到对应 siteId 的 app 记录（listCmsApps 默认返回全部 APP）
  const apps = await listCmsApps(organizationId, "CHANNEL_APP");
  const app = apps.find((a) => a.siteId === catalog.siteId);
  if (!app) {
    throw new CmsConfigError(
      `未找到 siteId=${catalog.siteId} 对应的 cms_app；请重新跑 cms_catalog_sync`,
    );
  }

  return {
    siteId: catalog.siteId,
    appId: catalog.appId,
    catalogId: catalog.cmsCatalogId,
    tenantId: config.tenantId,
    loginId: config.loginCmcId,
    loginTid: config.loginCmcTid,
    username: config.username,
    source: org.brandName || "智媒编辑部",
    author: "智媒编辑部",
    listStyleDefault: (appChannel.defaultListStyle as MapperContext["listStyleDefault"]) ?? {
      imageUrlList: [],
      listStyleName: "默认",
      listStyleType: "0",
    },
    coverImageDefault: appChannel.defaultCoverUrl ?? config.defaultCoverUrl,
  };
}

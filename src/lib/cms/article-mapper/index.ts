import type { CmsArticleSaveDTO } from "../types";
import { CmsSchemaError } from "../errors";
import { requireCmsConfig } from "../feature-flags";

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
 * 从 env 加载 MapperContext，可选 target 覆盖推送目标。
 *
 * - `target.{catalogId,appId,siteId}` 任一字段提供则 override
 * - 未提供则走 `requireCmsConfig().default*`（来自 env，缺失时代码内 fallback 81/1768/10210）
 *
 * @param org { brandName: string } 组织信息（作为 source 字段兜底）
 * @param target 可选推送目标 override
 */
export function loadMapperContext(
  org: { brandName: string },
  target?: { catalogId?: number; appId?: number; siteId?: number },
): MapperContext {
  const config = requireCmsConfig();

  return {
    siteId: target?.siteId ?? config.defaultSiteId,
    appId: target?.appId ?? config.defaultAppId,
    catalogId: target?.catalogId ?? config.defaultCatalogId,
    tenantId: config.tenantId,
    loginId: config.loginCmcId,
    loginTid: config.loginCmcTid,
    username: config.username,
    source: org.brandName || "智媒编辑部",
    author: "智媒编辑部",
    listStyleDefault: {
      imageUrlList: [],
      listStyleName: "默认",
      listStyleType: "0",
    },
    coverImageDefault: config.defaultCoverUrl,
  };
}

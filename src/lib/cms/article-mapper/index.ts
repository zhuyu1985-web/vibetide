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
 * 硬编码的 CMS 推送目标（跳过 app_channels ↔ cms_catalogs 绑定）。
 *
 * 阶段 1（保障流程跑通）：所有稿件直推到固定站点/应用/栏目。后续接入
 * categories ↔ cms_catalogs 绑定时改这三个常量来源即可。
 */
const HARDCODED_SITE_ID = 81;
const HARDCODED_APP_ID = 1768;
const HARDCODED_CATALOG_ID = 10210;

/**
 * 从 env 加载 MapperContext。
 *
 * 当前不做 app_channels / category 级路由——推送目标写死在
 * HARDCODED_* 常量；mapper 其它字段仍来自 CMS 配置。
 *
 * @param org { brandName: string } 组织信息（作为 source 字段兜底）
 */
export function loadMapperContext(
  org: { brandName: string },
): MapperContext {
  const config = requireCmsConfig();

  return {
    siteId: HARDCODED_SITE_ID,
    appId: HARDCODED_APP_ID,
    catalogId: HARDCODED_CATALOG_ID,
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

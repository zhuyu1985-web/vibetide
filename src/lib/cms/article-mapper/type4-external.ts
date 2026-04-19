import type { CmsArticleSaveDTO } from "../types";
import { CmsSchemaError } from "../errors";
import { mapCommonFields, type ArticleForMapper, type MapperContext } from "./common";

export interface Type4Article extends ArticleForMapper {
  externalUrl: string;
}

/**
 * 映射到 CMS type=4（外链/标题新闻）。
 *
 * CMS 文章壳只用于列表展示；点击标题后在 App 内跳转到 externalUrl。
 * 内容为空（content="", htmlContent=""），列表样式为「标题无图」（listStyleType="3"）。
 *
 * 必填：externalUrl
 */
export function mapToType4(
  article: Type4Article,
  ctx: MapperContext,
): CmsArticleSaveDTO {
  if (!article.externalUrl || !article.externalUrl.trim()) {
    throw new CmsSchemaError("type=4 mapper: externalUrl 必填", {
      field: "externalUrl",
    });
  }

  const cover = article.coverImageUrl ?? ctx.coverImageDefault;

  return {
    ...(mapCommonFields(article, ctx) as CmsArticleSaveDTO),
    type: "4",
    redirectUrl: article.externalUrl,
    content: "",
    articleContentDto: {
      htmlContent: "",
      imageDtoList: [],
      videoDtoList: [],
    },
    appCustomParams: {
      customStyle: {
        imgPath: [cover],
        type: "3",  // 标题无图
      },
      movie: { AppCustomParams: "默认" },
    },
    listStyleDto: {
      imageUrlList: [],
      listStyleName: "默认",
      listStyleType: "3",
    },
  };
}

import type { CmsArticleSaveDTO } from "../types";
import { CmsSchemaError } from "../errors";
import { mapCommonFields, type ArticleForMapper, type MapperContext } from "./common";

export interface Type1Article extends ArticleForMapper {
  body: string;
}

const EDIT_WRAP_STYLE =
  "font-family:宋体;font-size:16px;letter-spacing:1.75px;line-height: 1.75em;margin-top: 5px;margin-bottom: 15px;color: #000000;text-align: justify;text-indent:2em ";

function ensureEditWrap(body: string): string {
  if (/id="editWrap"/.test(body)) {
    return body;
  }
  return `<div style="${EDIT_WRAP_STYLE}" id="editWrap">${body}</div>`;
}

/**
 * 映射到 CMS type=1（普通图文新闻）。
 *
 * 必填：body（映射为 content + articleContentDto.htmlContent）
 */
export function mapToType1(
  article: Type1Article,
  ctx: MapperContext,
): CmsArticleSaveDTO {
  if (!article.body || !article.body.trim()) {
    throw new CmsSchemaError("type=1 mapper: 缺少 content (article.body)", {
      field: "content",
    });
  }

  const wrapped = ensureEditWrap(article.body);
  const cover = article.coverImageUrl ?? ctx.coverImageDefault;

  return {
    ...(mapCommonFields(article, ctx) as CmsArticleSaveDTO),
    type: "1",
    content: wrapped,
    articleContentDto: {
      htmlContent: wrapped,
      imageDtoList: [],
      videoDtoList: [],
    },
    appCustomParams: {
      customStyle: {
        imgPath: [cover],
        type: "0",  // 0=默认
      },
      movie: { AppCustomParams: "默认" },
    },
    listStyleDto: {
      imageUrlList: [cover],
      listStyleName: "默认",
      listStyleType: "0",
    },
  };
}

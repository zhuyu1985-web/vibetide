import type { CmsArticleSaveDTO, CmsImageDto, CmsImageSimpleDTO } from "../types";
import { CmsSchemaError } from "../errors";
import { mapCommonFields, type ArticleForMapper, type MapperContext } from "./common";

export interface GalleryImage {
  url: string;
  caption: string | null;
  sourceId?: string;
  name?: string;
}

export interface Type2Article extends ArticleForMapper {
  galleryImages: GalleryImage[];
}

const MIN_GALLERY_IMAGES = 3;

function randomId(): string {
  return Math.random().toString(36).slice(2);
}

/**
 * 映射到 CMS type=2（图集）。
 *
 * 必填：galleryImages（至少 3 张）
 * CMS 图集字段会同时写入 articleContentDto.imageDtoList（富内容层）
 * 和 images[]（简化列表层）—— 两者为 CMS 冗余设计，需同步保持一致。
 */
export function mapToType2(
  article: Type2Article,
  ctx: MapperContext,
): CmsArticleSaveDTO {
  if (!article.galleryImages || article.galleryImages.length < MIN_GALLERY_IMAGES) {
    throw new CmsSchemaError(
      `type=2 mapper: galleryImages 至少 ${MIN_GALLERY_IMAGES} 张`,
      { field: "galleryImages" },
    );
  }
  for (let i = 0; i < article.galleryImages.length; i++) {
    if (!article.galleryImages[i].url) {
      throw new CmsSchemaError(
        `type=2 mapper: galleryImages[${i}].url 必须提供`,
        { field: `galleryImages[${i}].url` },
      );
    }
  }

  const images = article.galleryImages;

  const imageDtoList: CmsImageDto[] = images.map((img, i) => ({
    imageUrl: img.url,
    imageName: img.name ?? randomId(),
    description: img.caption ?? `图片说明${i + 1}`,
    sImageUrl: img.url,
    linkText: "",
    linkUrl: "",
  }));

  const imagesSimple: CmsImageSimpleDTO[] = images.map((img, i) => ({
    contentSourceId: img.sourceId ?? randomId(),
    image: img.url,
    imageName: img.name ?? randomId(),
    note: img.caption ?? `图片说明${i + 1}`,
    linkText: "",
    linkUrl: "",
  }));

  const topThree = images.slice(0, 3).map((img) => img.url);

  return {
    ...(mapCommonFields(article, ctx) as CmsArticleSaveDTO),
    type: "2",
    content: "",
    articleContentDto: {
      htmlContent: "",
      imageDtoList,
      videoDtoList: [],
    },
    images: imagesSimple,
    appCustomParams: {
      customStyle: {
        imgPath: topThree,
        type: "2",  // 多图
      },
      movie: { AppCustomParams: "默认" },
    },
    listStyleDto: {
      imageUrlList: topThree,
      listStyleName: "默认",
      listStyleType: "2",
    },
  };
}

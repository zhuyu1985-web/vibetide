import { describe, it, expect } from "vitest";
import { mapToType2, type Type2Article } from "../../article-mapper/type2-gallery";
import type { MapperContext } from "../../article-mapper/common";

const ctx: MapperContext = {
  siteId: 81,
  appId: 10,
  catalogId: 8634,
  tenantId: "t",
  loginId: "id",
  loginTid: "tid",
  username: "admin",
  source: "x",
  author: "y",
  listStyleDefault: { imageUrlList: [], listStyleName: "默认", listStyleType: "0" },
  coverImageDefault: "https://cdn/d.jpg",
};

const base: Type2Article = {
  id: "art-2",
  title: "图集",
  authorName: null,
  summary: null,
  shortTitle: null,
  tags: [],
  coverImageUrl: null,
  publishStatus: "draft",
  publishedAt: null,
  galleryImages: [
    { url: "https://cdn/1.jpg", caption: "说明1" },
    { url: "https://cdn/2.jpg", caption: "说明2" },
    { url: "https://cdn/3.jpg", caption: "说明3" },
  ],
};

describe("mapToType2", () => {
  it("sets type='2' and maps all images into articleContentDto.imageDtoList + images[]", () => {
    const dto = mapToType2(base, ctx);
    expect(dto.type).toBe("2");
    expect(dto.articleContentDto?.imageDtoList).toHaveLength(3);
    expect(dto.images).toHaveLength(3);
    expect(dto.images?.[0].image).toBe("https://cdn/1.jpg");
    expect(dto.images?.[0].note).toBe("说明1");
  });

  it("throws when galleryImages has fewer than 3 entries", () => {
    expect(() =>
      mapToType2({ ...base, galleryImages: [base.galleryImages[0]] }, ctx),
    ).toThrow(/3|gallery|at least/i);
  });

  it("throws when galleryImages missing url", () => {
    expect(() =>
      mapToType2({
        ...base,
        galleryImages: [
          { url: "", caption: "x" },
          base.galleryImages[1],
          base.galleryImages[2],
        ],
      }, ctx),
    ).toThrow(/url|image/i);
  });

  it("uses '图片说明N' fallback when caption absent", () => {
    const dto = mapToType2({
      ...base,
      galleryImages: [
        { url: "https://a", caption: null },
        { url: "https://b", caption: null },
        { url: "https://c", caption: null },
      ],
    }, ctx);
    expect(dto.images?.[0].note).toBe("图片说明1");
    expect(dto.images?.[2].note).toBe("图片说明3");
  });

  it("sets appCustomParams.customStyle.type='2' (multi-image)", () => {
    const dto = mapToType2(base, ctx);
    expect(dto.appCustomParams?.customStyle.type).toBe("2");
    expect(dto.appCustomParams?.customStyle.imgPath).toHaveLength(3);
  });

  it("sets listStyleDto.listStyleType='2'", () => {
    const dto = mapToType2(base, ctx);
    expect(dto.listStyleDto?.listStyleType).toBe("2");
    expect(dto.listStyleDto?.imageUrlList).toHaveLength(3);
  });
});

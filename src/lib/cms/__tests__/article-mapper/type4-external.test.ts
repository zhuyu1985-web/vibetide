import { describe, it, expect } from "vitest";
import { mapToType4, type Type4Article } from "../../article-mapper/type4-external";
import type { MapperContext } from "../../article-mapper/common";

const ctx: MapperContext = {
  siteId: 81, appId: 10, catalogId: 8634,
  tenantId: "t", loginId: "id", loginTid: "tid", username: "admin",
  source: "x", author: "y",
  listStyleDefault: { imageUrlList: [], listStyleName: "默认", listStyleType: "0" },
  coverImageDefault: "https://cdn/d.jpg",
};

const base: Type4Article = {
  id: "art-4",
  title: "外链新闻",
  authorName: null,
  summary: null,
  shortTitle: null,
  tags: [],
  coverImageUrl: null,
  publishStatus: "draft",
  publishedAt: null,
  externalUrl: "https://external-source.com/article/123",
};

describe("mapToType4", () => {
  it("sets type='4' and redirectUrl", () => {
    const dto = mapToType4(base, ctx);
    expect(dto.type).toBe("4");
    expect(dto.redirectUrl).toBe("https://external-source.com/article/123");
  });

  it("leaves content empty (type=4 is a redirect)", () => {
    const dto = mapToType4(base, ctx);
    expect(dto.content).toBe("");
    expect(dto.articleContentDto?.htmlContent).toBe("");
  });

  it("throws when externalUrl missing", () => {
    expect(() => mapToType4({ ...base, externalUrl: "" }, ctx)).toThrow(/externalUrl|redirectUrl/i);
  });

  it("sets listStyleType='3' (title-only)", () => {
    const dto = mapToType4(base, ctx);
    expect(dto.listStyleDto?.listStyleType).toBe("3");
    expect(dto.appCustomParams?.customStyle.type).toBe("3");
  });
});

import { describe, it, expect } from "vitest";
import { mapToType1 } from "../../article-mapper/type1-article";
import type { MapperContext } from "../../article-mapper/common";

const ctx: MapperContext = {
  siteId: 81,
  appId: 10,
  catalogId: 8634,
  tenantId: "t",
  loginId: "id",
  loginTid: "tid",
  username: "admin",
  source: "深圳广电",
  author: "智媒编辑部",
  listStyleDefault: { imageUrlList: [], listStyleName: "默认", listStyleType: "0" },
  coverImageDefault: "https://cdn/default.jpg",
};

const baseArticle = {
  id: "art-1",
  title: "测试新闻",
  authorName: null,
  summary: "摘要",
  shortTitle: null,
  tags: ["AI", "科技"],
  coverImageUrl: "https://cdn/cover.jpg",
  publishStatus: "pending" as const,
  publishedAt: null,
  body: "<p>正文内容</p>",
};

describe("mapToType1", () => {
  it("sets type='1' and populates content + articleContentDto.htmlContent", () => {
    const dto = mapToType1(baseArticle, ctx);
    expect(dto.type).toBe("1");
    expect(dto.content).toContain("正文内容");
    expect(dto.articleContentDto?.htmlContent).toContain("正文内容");
    expect(dto.articleContentDto?.videoDtoList).toEqual([]);
  });

  it("wraps plain body with <div id=\"editWrap\">", () => {
    const dto = mapToType1({ ...baseArticle, body: "<p>正文</p>" }, ctx);
    expect(dto.content).toContain("id=\"editWrap\"");
  });

  it("keeps existing editWrap wrapper (idempotent)", () => {
    const wrapped = '<div style="..." id="editWrap"><p>内容</p></div>';
    const dto = mapToType1({ ...baseArticle, body: wrapped }, ctx);
    // Should still contain editWrap exactly once
    const matches = (dto.content ?? "").match(/id="editWrap"/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it("throws when body is empty", () => {
    expect(() => mapToType1({ ...baseArticle, body: "" }, ctx)).toThrow(/content/i);
    expect(() => mapToType1({ ...baseArticle, body: "   " }, ctx)).toThrow(/content/i);
  });

  it("sets appCustomParams.customStyle with single cover", () => {
    const dto = mapToType1(baseArticle, ctx);
    expect(dto.appCustomParams?.customStyle.type).toBe("0");
    expect(dto.appCustomParams?.customStyle.imgPath).toEqual(["https://cdn/cover.jpg"]);
  });

  it("preserves all common fields (title/author/catalogId/etc.)", () => {
    const dto = mapToType1(baseArticle, ctx);
    expect(dto.title).toBe("测试新闻");
    expect(dto.catalogId).toBe(8634);
    expect(dto.siteId).toBe(81);
    expect(dto.status).toBe("20");
    expect(dto.keyword).toBe("AI,科技");
  });
});

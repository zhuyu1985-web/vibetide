import { describe, it, expect } from "vitest";
import { mapCommonFields, type MapperContext } from "../../article-mapper/common";

const ctx: MapperContext = {
  siteId: 81,
  appId: 10,
  catalogId: 8634,
  tenantId: "tenant-1",
  loginId: "id-1",
  loginTid: "tid-1",
  username: "admin",
  source: "深圳广电",
  author: "智媒编辑部",
  listStyleDefault: {
    imageUrlList: [],
    listStyleName: "默认",
    listStyleType: "0",
  },
  coverImageDefault: "https://cdn/default-cover.jpg",
};

describe("mapCommonFields", () => {
  it("maps basic scalar fields with sane defaults", () => {
    const result = mapCommonFields(
      {
        id: "art-1",
        title: "测试稿件",
        authorName: null,
        summary: null,
        shortTitle: null,
        tags: [],
        coverImageUrl: null,
        publishStatus: "draft",
        publishedAt: null,
      },
      ctx,
    );

    expect(result.title).toBe("测试稿件");
    expect(result.listTitle).toBe("测试稿件");
    expect(result.author).toBe("智媒编辑部");
    expect(result.username).toBe("admin");
    expect(result.source).toBe("深圳广电");
    expect(result.referType).toBe(9);
    expect(result.version).toBe("cms2");
    expect(result.status).toBe("0");
    expect(result.logo).toBe("https://cdn/default-cover.jpg");
    expect(result.catalogId).toBe(8634);
    expect(result.siteId).toBe(81);
    expect(result.tenantId).toBe("tenant-1");
    expect(result.loginId).toBe("id-1");
    expect(result.loginTid).toBe("tid-1");
    expect(result.commentFlag).toBe("1");
    expect(result.tagsFlag).toBe("1");
    expect(result.showReadingCountFlag).toBe("1");
    expect(result.addTime).toBeTypeOf("number");
  });

  it("truncates title longer than 80 chars", () => {
    const long = "超级无敌巨长无比的标题".repeat(20);
    const result = mapCommonFields(
      {
        id: "x",
        title: long,
        authorName: null,
        summary: null,
        shortTitle: null,
        tags: [],
        coverImageUrl: null,
        publishStatus: "draft",
        publishedAt: null,
      },
      ctx,
    );
    expect(result.title!.length).toBeLessThanOrEqual(80);
  });

  it("auto-derives shortTitle from summary or title when missing", () => {
    const result = mapCommonFields(
      {
        id: "x",
        title: "这是完整标题",
        authorName: null,
        summary: "这是摘要。摘要应该用作短标题来源",
        shortTitle: null,
        tags: [],
        coverImageUrl: null,
        publishStatus: "draft",
        publishedAt: null,
      },
      ctx,
    );
    expect(result.shortTitle).toBeTruthy();
    expect(result.shortTitle!.length).toBeLessThanOrEqual(20);
    expect(result.shortTitle).toContain("这是");
  });

  it("maps publishStatus enum to CMS status string", () => {
    const base = {
      id: "x", title: "t", authorName: null, summary: null,
      shortTitle: null, tags: [], coverImageUrl: null, publishedAt: null,
    };
    expect(mapCommonFields({ ...base, publishStatus: "draft" }, ctx).status).toBe("0");
    expect(mapCommonFields({ ...base, publishStatus: "pending" }, ctx).status).toBe("20");
    expect(mapCommonFields({ ...base, publishStatus: "published" }, ctx).status).toBe("30");
    expect(mapCommonFields({ ...base, publishStatus: "rejected" }, ctx).status).toBe("60");
  });

  it("joins tags with comma and limits to 10", () => {
    const result = mapCommonFields(
      {
        id: "x", title: "t", authorName: null, summary: null, shortTitle: null,
        tags: Array.from({ length: 15 }, (_, i) => `tag${i}`),
        coverImageUrl: null, publishStatus: "draft", publishedAt: null,
      },
      ctx,
    );
    expect(result.keyword).toBeDefined();
    expect(result.keyword!.split(",")).toHaveLength(10);
    expect(result.tags).toBe(result.keyword);
  });

  it("uses authorName when provided", () => {
    const result = mapCommonFields(
      {
        id: "x", title: "t", authorName: "张三", summary: null, shortTitle: null,
        tags: [], coverImageUrl: null, publishStatus: "draft", publishedAt: null,
      },
      ctx,
    );
    expect(result.author).toBe("张三");
  });

  it("uses custom cover when article.coverImageUrl present", () => {
    const result = mapCommonFields(
      {
        id: "x", title: "t", authorName: null, summary: null, shortTitle: null,
        tags: [], coverImageUrl: "https://cdn/my.jpg",
        publishStatus: "draft", publishedAt: null,
      },
      ctx,
    );
    expect(result.logo).toBe("https://cdn/my.jpg");
  });

  it("sets publishDate from article.publishedAt", () => {
    const pubDate = new Date("2026-04-18T10:00:00Z");
    const result = mapCommonFields(
      {
        id: "x", title: "t", authorName: null, summary: null, shortTitle: null,
        tags: [], coverImageUrl: null,
        publishStatus: "published", publishedAt: pubDate,
      },
      ctx,
    );
    expect(result.publishDate).toBe(pubDate.getTime());
  });
});

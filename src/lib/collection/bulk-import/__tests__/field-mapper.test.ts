import { describe, expect, it } from "vitest";
import { matchColumns, FIELD_ALIASES } from "../field-mapper";

describe("matchColumns", () => {
  it("中文标题列匹配 title", () => {
    const result = matchColumns(["标题", "正文", "发布时间"]);
    expect(result.title).toBe("标题");
    expect(result.content).toBe("正文");
    expect(result.publishedAt).toBe("发布时间");
  });

  it("英文 Title 列（大小写不敏感）匹配 title", () => {
    const result = matchColumns(["Title", "Content", "Published_At"]);
    expect(result.title).toBe("Title");
    expect(result.content).toBe("Content");
    expect(result.publishedAt).toBe("Published_At");
  });

  it("无映射的字段返回 null", () => {
    const result = matchColumns(["foo", "bar"]);
    expect(result.title).toBeNull();
    expect(result.content).toBeNull();
  });

  it("混合中英文 + URL/媒体名", () => {
    const result = matchColumns(["报道标题", "报道全文", "URL", "来源媒体", "刊发媒体分级"]);
    expect(result.title).toBe("报道标题");
    expect(result.content).toBe("报道全文");
    expect(result.canonicalUrl).toBe("URL");
    expect(result.outletName).toBe("来源媒体");
    expect(result.outletTier).toBe("刊发媒体分级");
  });

  it("publishedAt 多种别名都能命中", () => {
    expect(matchColumns(["发布日期"]).publishedAt).toBe("发布日期");
    expect(matchColumns(["publish_date"]).publishedAt).toBe("publish_date");
    expect(matchColumns(["发表时间"]).publishedAt).toBe("发表时间");
  });

  it("FIELD_ALIASES 字典包含所有 9 个字段", () => {
    const expectedFields = [
      "title",
      "content",
      "summary",
      "canonicalUrl",
      "publishedAt",
      "outletName",
      "outletTier",
      "outletRegion",
      "contentType",
    ];
    for (const field of expectedFields) {
      expect(FIELD_ALIASES).toHaveProperty(field);
      expect(Array.isArray(FIELD_ALIASES[field])).toBe(true);
      expect(FIELD_ALIASES[field]!.length).toBeGreaterThan(0);
    }
  });
});

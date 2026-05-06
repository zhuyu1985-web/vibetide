import { describe, expect, it } from "vitest";
import {
  parseExcelPublishedAt,
  transformRowToRawItem,
  type ImportDefaults,
} from "../transform";

describe("parseExcelPublishedAt", () => {
  it("已是 Date 实例直接返回", () => {
    const d = new Date("2025-06-01T12:00:00.000Z");
    expect(parseExcelPublishedAt(d)).toBe(d);
  });

  it("ISO 字符串", () => {
    const result = parseExcelPublishedAt("2025-06-01");
    expect(result?.getFullYear()).toBe(2025);
  });

  it("中文 X年X月X日", () => {
    const result = parseExcelPublishedAt("2025年6月1日");
    expect(result?.getFullYear()).toBe(2025);
    expect(result?.getMonth()).toBe(5);
    expect(result?.getDate()).toBe(1);
  });

  it("Unix 秒 timestamp", () => {
    const result = parseExcelPublishedAt(1717286400); // 2024-06-02 16:00 UTC
    expect(result?.getFullYear()).toBe(2024);
  });

  it("空 / null / undefined / 非法字符串", () => {
    expect(parseExcelPublishedAt(null)).toBeUndefined();
    expect(parseExcelPublishedAt(undefined)).toBeUndefined();
    expect(parseExcelPublishedAt("")).toBeUndefined();
    expect(parseExcelPublishedAt("not a date")).toBeUndefined();
  });
});

describe("transformRowToRawItem", () => {
  const defaults: ImportDefaults = {
    contentType: "image_text",
    outletTier: null,
    outletRegion: null,
  };

  it("基本映射 — title + content + publishedAt + canonicalUrl", () => {
    const row = {
      标题: "新闻 A",
      正文: "内容 A",
      时间: "2025-06-01",
      链接: "https://a.com/article",
    };
    const mapping = {
      title: "标题",
      content: "正文",
      publishedAt: "时间",
      canonicalUrl: "链接",
    };
    const result = transformRowToRawItem(row, mapping, defaults);

    expect(result?.rawItem.title).toBe("新闻 A");
    expect(result?.rawItem.content).toBe("内容 A");
    expect(result?.rawItem.url).toBe("https://a.com/article");
    expect(result?.rawItem.publishedAt).toBeInstanceOf(Date);
    expect(result?.rawItem.contentType).toBe("image_text");
    expect(result?.rawItem.channel).toBe("excel_import");
    expect(result?.fingerprint).toBeTruthy();
    expect(typeof result?.fingerprint).toBe("string");
  });

  it("title 缺失返回 null（错误行）", () => {
    const row = { 标题: "", 正文: "X" };
    const mapping = { title: "标题", content: "正文" };
    const result = transformRowToRawItem(row, mapping, defaults);
    expect(result).toBeNull();
  });

  it("outletTier 默认值生效", () => {
    const row = { 标题: "X" };
    const mapping = { title: "标题" };
    const defaultsWithTier: ImportDefaults = {
      ...defaults,
      outletTier: "central",
      outletRegion: "全国",
    };
    const result = transformRowToRawItem(row, mapping, defaultsWithTier);
    expect(result?.rawItem.rawMetadata).toMatchObject({
      defaultOutletTier: "central",
      defaultOutletRegion: "全国",
    });
  });

  it("outletName 进入 rawMetadata.publicAccountName 让 recognizer 命中字典", () => {
    const row = { 标题: "X", 媒体: "重庆生态环境" };
    const mapping = { title: "标题", outletName: "媒体" };
    const result = transformRowToRawItem(row, mapping, defaults);
    expect(result?.rawItem.rawMetadata).toMatchObject({
      publicAccountName: "重庆生态环境",
    });
  });

  it("fingerprint 相同 title+date+url 的行结果一致", () => {
    const row = { 标题: "同题新闻", 时间: "2025-01-01", 链接: "https://x.com" };
    const mapping = { title: "标题", publishedAt: "时间", canonicalUrl: "链接" };
    const r1 = transformRowToRawItem(row, mapping, defaults);
    const r2 = transformRowToRawItem(row, mapping, defaults);
    expect(r1?.fingerprint).toBe(r2?.fingerprint);
  });

  it("channel 固定为 excel_import", () => {
    const row = { 标题: "X" };
    const mapping = { title: "标题" };
    const result = transformRowToRawItem(row, mapping, defaults);
    expect(result?.rawItem.channel).toBe("excel_import");
  });

  it("无 publishedAt 映射 → publishedAt 字段为 undefined", () => {
    const row = { 标题: "没有日期" };
    const mapping = { title: "标题" };
    const result = transformRowToRawItem(row, mapping, defaults);
    expect(result?.rawItem.publishedAt).toBeUndefined();
  });

  it("summary 缺失时从 content 截取前 200 字符", () => {
    const longContent = "A".repeat(300);
    const row = { 标题: "X", 正文: longContent };
    const mapping = { title: "标题", content: "正文" };
    const result = transformRowToRawItem(row, mapping, defaults);
    expect(result?.rawItem.summary?.length).toBe(200);
  });

  it("rawMetadata 包含 importedFromExcel: true", () => {
    const row = { 标题: "Y" };
    const mapping = { title: "标题" };
    const result = transformRowToRawItem(row, mapping, defaults);
    expect(result?.rawItem.rawMetadata?.importedFromExcel).toBe(true);
  });

  it("contentType 使用 defaults 中的值", () => {
    const row = { 标题: "Z" };
    const mapping = { title: "标题" };
    const videoDefaults: ImportDefaults = { ...defaults, contentType: "video" };
    const result = transformRowToRawItem(row, mapping, videoDefaults);
    expect(result?.rawItem.contentType).toBe("video");
  });
});

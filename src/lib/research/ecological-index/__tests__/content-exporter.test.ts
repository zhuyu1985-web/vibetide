// 验证 buildContentXlsxForTier / buildAllContentXlsx:
// - 输出真实 xlsx zip(文件头 PK)
// - sheet 名按 tier 切分
// - 32 列标准模板 (序号/标题/完整内容/...)
// - 空 items 也产出有效 xlsx (只含表头)
// - 4 个 tier 批量 API

import { describe, it, expect } from "vitest";
import * as XLSX from "@e965/xlsx";

import type { ExportItemRow } from "@/lib/collection/bulk-export/opinion-export";

import {
  buildContentXlsxForTier,
  buildAllContentXlsx,
  sheetNameForTier,
  storageNameForTier,
} from "../content-exporter";

// ExportItemRow = InferSelectModel<typeof collectedItems> & { content/ocr/asr }
// 构造一个最小 fixture, 用 `as unknown as ExportItemRow` 跳过过严的 Drizzle 推导
function makeItem(id: string, title: string): ExportItemRow {
  return {
    id,
    organizationId: "org-1",
    contentFingerprint: `fp-${id}`,
    canonicalUrl: `https://example.com/${id}`,
    canonicalUrlHash: null,
    title,
    summary: null,
    publishedAt: new Date("2025-06-15T10:00:00Z"),
    firstSeenSourceId: null,
    firstSeenChannel: "manual",
    firstSeenAt: new Date("2025-06-16T10:00:00Z"),
    sourceChannels: [],
    category: [],
    tags: null,
    language: null,
    derivedModules: [],
    rawMetadata: null,
    enrichmentStatus: "done",
    createdAt: new Date(),
    updatedAt: new Date(),
    contentType: "image_text",
    attachments: [],
    outletId: null,
    outletTier: null,
    outletRegion: null,
    externalId: `ext-${id}`,
    platform: "wechat",
    author: "作者",
    accountId: null,
    accountHandle: null,
    authorFollowerCount: 10000,
    sentiment: null,
    infoType: null,
    likeCount: 100,
    commentCount: 10,
    shareCount: 5,
    viewCount: 1000,
    favoriteCount: 50,
    replyCount: 0,
    ipRegion: "重庆",
    postRegion: "重庆",
    mentionedRegions: ["渝中区"],
    matchedKeywords: ["生态文明"],
    matchedRegions: ["重庆"],
    industries: [],
    coverImageUrl: null,
    durationSeconds: null,
    compositeScore: 0,
    // 副表 left join 出来的字段
    content: `正文 ${id}`,
    ocrText: null,
    asrText: null,
  } as unknown as ExportItemRow;
}

describe("content-exporter", () => {
  it("buildContentXlsxForTier 返回 xlsx Buffer (zip 头 PK)", () => {
    const items = [makeItem("1", "测试标题 1"), makeItem("2", "测试标题 2")];
    const buf = buildContentXlsxForTier(items, "central");
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.byteLength).toBeGreaterThan(1000);
    // xlsx 是 zip,文件头是 "PK\x03\x04"
    expect(buf[0]).toBe(0x50); // P
    expect(buf[1]).toBe(0x4b); // K
  });

  it("sheet 名称按 tier 区分", () => {
    expect(sheetNameForTier("central")).toBe("中央媒体内容池");
    expect(sheetNameForTier("industry")).toBe("行业媒体内容池");
    expect(sheetNameForTier("municipal")).toBe("市级媒体内容池");
    expect(sheetNameForTier("district")).toBe("区县媒体内容池");
  });

  it("storage filename prefix 按 tier 区分", () => {
    expect(storageNameForTier("central")).toBe("content-central");
    expect(storageNameForTier("industry")).toBe("content-industry");
    expect(storageNameForTier("municipal")).toBe("content-municipal");
    expect(storageNameForTier("district")).toBe("content-district");
  });

  it("空 items 也能产出有效 xlsx (空表 + 表头)", () => {
    const buf = buildContentXlsxForTier([], "central");
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.byteLength).toBeGreaterThan(500);
    // 验证依然能解析回 workbook
    const wb = XLSX.read(buf, { type: "buffer" });
    expect(wb.SheetNames).toEqual(["中央媒体内容池"]);
  });

  it("生成的 xlsx 含正确 sheet 名 + 32 列标准列", () => {
    const items = [makeItem("1", "test")];
    const buf = buildContentXlsxForTier(items, "central");
    const wb = XLSX.read(buf, { type: "buffer" });
    expect(wb.SheetNames).toEqual(["中央媒体内容池"]);

    const ws = wb.Sheets["中央媒体内容池"]!;
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
    expect(aoa.length).toBeGreaterThan(0);

    const header = aoa[0]!;
    expect(Array.isArray(header)).toBe(true);
    if (Array.isArray(header)) {
      expect(header).toContain("序号");
      expect(header).toContain("帖子ID");
      expect(header).toContain("标题");
      expect(header).toContain("完整内容");
      expect(header).toContain("发布时间");
      expect(header).toContain("采集时间");
      expect(header).toContain("点赞数");
      expect(header).toContain("评论数");
      expect(header).toContain("OCR文本");
      expect(header).toContain("ASR文本");
      // 32 列(不含"查询时段")
      expect(header.length).toBe(32);
    }
  });

  it("buildAllContentXlsx 一次产出 4 个 tier 的 Buffer", () => {
    const items = [makeItem("1", "x")];
    const result = buildAllContentXlsx({
      central: items,
      industry: items,
      municipal: items,
      district: items,
    });
    expect(result.central).toBeInstanceOf(Buffer);
    expect(result.industry).toBeInstanceOf(Buffer);
    expect(result.municipal).toBeInstanceOf(Buffer);
    expect(result.district).toBeInstanceOf(Buffer);

    // 各自 sheet 名称对的上
    const wbInd = XLSX.read(result.industry, { type: "buffer" });
    expect(wbInd.SheetNames).toEqual(["行业媒体内容池"]);
    const wbMun = XLSX.read(result.municipal, { type: "buffer" });
    expect(wbMun.SheetNames).toEqual(["市级媒体内容池"]);
    const wbDis = XLSX.read(result.district, { type: "buffer" });
    expect(wbDis.SheetNames).toEqual(["区县媒体内容池"]);
  });
});

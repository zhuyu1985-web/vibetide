// src/lib/research/ecological-index/__tests__/end-to-end.test.ts
//
// 端到端 fixture 测试: 不连 DB / Inngest / Storage,
// 纯 in-memory 跑 compute → chart → docx → xlsx → content,
// 验证 4 个 lib 串接 OK,产物字节数合理。
//
// 这个测试用于 sanity check P3 整体集成是否能跑通,
// 真实 DB 数据的端到端验证在 P4 UI 集成后通过浏览器实际触发。

import { describe, it, expect } from "vitest";
import * as XLSX from "@e965/xlsx";

import { computeIndicators, type ComputeItem } from "../compute";
import { renderAllCharts } from "../chart-generator";
import { buildRankingReportDocx } from "../docx-builder";
import { buildIndexReportXlsx } from "../xlsx-builder";
import { buildContentXlsxForTier } from "../content-exporter";
import type { ParsedScopeUnit } from "../types";
import type { ActivityDataPoint } from "@/db/schema/research/activity-datasets";
import type { ExportItemRow } from "@/lib/collection/bulk-export/opinion-export";

function makeExportItem(id: string): ExportItemRow {
  return {
    id,
    organizationId: "org-1",
    contentFingerprint: `fp-${id}`,
    canonicalUrl: `https://example.com/${id}`,
    canonicalUrlHash: null,
    title: `稿件 ${id}`,
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
    authorFollowerCount: 0,
    sentiment: null,
    infoType: null,
    likeCount: 0,
    commentCount: 0,
    shareCount: 0,
    viewCount: 0,
    favoriteCount: 0,
    replyCount: 0,
    ipRegion: null,
    postRegion: null,
    mentionedRegions: [],
    matchedKeywords: [],
    matchedRegions: [],
    industries: [],
    coverImageUrl: null,
    durationSeconds: null,
    compositeScore: 0,
    content: `正文 ${id}`,
    ocrText: null,
    asrText: null,
  } as unknown as ExportItemRow;
}

describe("ecological-index 端到端 fixture", () => {
  it("compute → chart → docx → xlsx → content 完整串接", async () => {
    // === Step 1: 准备 fixture ===
    // 3 个区县,跨梯队差异化:
    //   甲区: 中央 5 篇覆盖 4 主题 + 活动 5/365 (均匀) → 高分
    //   乙区: 中央 3 篇集中 1 主题 + 活动 10/30 (集中) → 中分
    //   丙区: 无任何稿件 + 无活动                     → 低分
    const districts = ["甲区", "乙区", "丙区"];
    const items: ComputeItem[] = [
      // 甲区中央 5 篇覆盖 4 主题 (topic 0/1/2/3 各 1 + topic 0 再 1)
      { itemId: "i-jia-c-0", districtName: "甲区", tier: "central", topicIdx: 0, publishedDate: "2025-01-01" },
      { itemId: "i-jia-c-1", districtName: "甲区", tier: "central", topicIdx: 1, publishedDate: "2025-01-02" },
      { itemId: "i-jia-c-2", districtName: "甲区", tier: "central", topicIdx: 2, publishedDate: "2025-01-03" },
      { itemId: "i-jia-c-3", districtName: "甲区", tier: "central", topicIdx: 3, publishedDate: "2025-01-04" },
      { itemId: "i-jia-c-4", districtName: "甲区", tier: "central", topicIdx: 0, publishedDate: "2025-01-05" },
      // 乙区中央 3 篇集中在 topic 5
      { itemId: "i-yi-c-0", districtName: "乙区", tier: "central", topicIdx: 5, publishedDate: "2025-02-01" },
      { itemId: "i-yi-c-1", districtName: "乙区", tier: "central", topicIdx: 5, publishedDate: "2025-02-02" },
      { itemId: "i-yi-c-2", districtName: "乙区", tier: "central", topicIdx: 5, publishedDate: "2025-02-03" },
      // 丙区无稿件
    ];
    const activities: ActivityDataPoint[] = [
      {
        district: "甲区",
        themes: { a: 1, b: 1, c: 1, d: 1, e: 1 },
        total: 5,
        firstDate: "2025-01-01",
        lastDate: "2025-12-31",
        spanDays: 365,
        freq: 5 / 365,
      },
      {
        district: "乙区",
        themes: { a: 10, b: 0, c: 0, d: 0, e: 0 },
        total: 10,
        firstDate: "2025-06-01",
        lastDate: "2025-06-30",
        spanDays: 30,
        freq: 10 / 30,
      },
      {
        district: "丙区",
        themes: { a: 0, b: 0, c: 0, d: 0, e: 0 },
        total: 0,
        firstDate: "2025-01-01",
        lastDate: "2025-01-01",
        spanDays: 1,
        freq: 0,
      },
    ];

    // === Step 2: compute ===
    const result = computeIndicators(districts, items, activities);
    expect(result.ranked).toHaveLength(3);
    // 排名验证: 甲区 (数据多 + 均匀) 应该综合分最高
    expect(result.ranked[0]!.composite).toBeGreaterThan(result.ranked[2]!.composite);
    // stats 应有合理值
    expect(result.stats.max).toBeGreaterThan(result.stats.min);
    expect(result.stats.mean).toBeGreaterThan(0);

    // === Step 3: charts (3 张 PNG) ===
    const charts = await renderAllCharts(result);
    expect(charts.compositeBar.byteLength).toBeGreaterThan(5000);
    expect(charts.tierPie.byteLength).toBeGreaterThan(5000);
    expect(charts.top15Comparison.byteLength).toBeGreaterThan(5000);
    // PNG 文件头 89 50 4E 47
    expect(charts.compositeBar[0]).toBe(0x89);
    expect(charts.compositeBar[1]).toBe(0x50);

    // === Step 4: docx ===
    const docxBuf = await buildRankingReportDocx({
      title: "端到端测试报告",
      year: 2025,
      result,
      charts,
    });
    expect(docxBuf.byteLength).toBeGreaterThan(5000);
    // docx = zip,文件头 PK
    expect(docxBuf[0]).toBe(0x50);
    expect(docxBuf[1]).toBe(0x4b);

    // === Step 5: xlsx 19-sheet ===
    const units: ParsedScopeUnit[] = [
      {
        xlsxRow: 2,
        name: "央视新闻",
        tier: "central",
        districtOrig: null,
        districtNormalized: null,
        websites: ["cctv.com"],
        wechatNames: ["央视新闻"],
        wechatGhid: null,
        weiboUid: null,
        weiboHandle: null,
        douyinUrl: null,
        kuaishouUrl: null,
        notes: null,
      },
    ];
    const xlsxBuf = buildIndexReportXlsx({ result, units, activities });
    expect(xlsxBuf.byteLength).toBeGreaterThan(5000);
    expect(xlsxBuf[0]).toBe(0x50);
    expect(xlsxBuf[1]).toBe(0x4b);
    const wb = XLSX.read(xlsxBuf, { type: "buffer" });
    expect(wb.SheetNames).toHaveLength(19);

    // === Step 6: content xlsx (按 tier 4 文件) ===
    const sampleItems: ExportItemRow[] = [makeExportItem("x1"), makeExportItem("x2")];
    const centralXlsx = buildContentXlsxForTier(sampleItems, "central");
    const industryXlsx = buildContentXlsxForTier(sampleItems, "industry");
    const municipalXlsx = buildContentXlsxForTier(sampleItems, "municipal");
    const districtXlsx = buildContentXlsxForTier(sampleItems, "district");

    expect(centralXlsx.byteLength).toBeGreaterThan(1000);
    expect(industryXlsx.byteLength).toBeGreaterThan(1000);
    expect(municipalXlsx.byteLength).toBeGreaterThan(1000);
    expect(districtXlsx.byteLength).toBeGreaterThan(1000);

    // 验证 4 个 tier 的 sheet 名都各自正确
    expect(XLSX.read(centralXlsx, { type: "buffer" }).SheetNames).toEqual(["中央媒体内容池"]);
    expect(XLSX.read(industryXlsx, { type: "buffer" }).SheetNames).toEqual(["行业媒体内容池"]);
    expect(XLSX.read(municipalXlsx, { type: "buffer" }).SheetNames).toEqual(["市级媒体内容池"]);
    expect(XLSX.read(districtXlsx, { type: "buffer" }).SheetNames).toEqual(["区县媒体内容池"]);
  }, 30_000);

  it("空 items 走完整流程不抛错(防御边界)", async () => {
    // districts 至少 1 个,避免 docx 因 ranked 空抛错(已知行为见 docx-builder.test.ts)
    const districts = ["甲区"];
    const items: ComputeItem[] = [];
    const activities: ActivityDataPoint[] = [
      {
        district: "甲区",
        themes: { a: 0, b: 0, c: 0, d: 0, e: 0 },
        total: 0,
        firstDate: "2025-01-01",
        lastDate: "2025-01-01",
        spanDays: 1,
        freq: 0,
      },
    ];

    const result = computeIndicators(districts, items, activities);
    expect(result.ranked).toHaveLength(1);

    const charts = await renderAllCharts(result);
    expect(charts.compositeBar.byteLength).toBeGreaterThan(1000);

    const docx = await buildRankingReportDocx({
      title: "empty",
      year: 2025,
      result,
      charts,
    });
    expect(docx.byteLength).toBeGreaterThan(1000);

    // content-exporter 空 items 也产出有效 xlsx(只表头)
    const emptyXlsx = buildContentXlsxForTier([], "central");
    expect(emptyXlsx.byteLength).toBeGreaterThan(500);
  }, 30_000);
});

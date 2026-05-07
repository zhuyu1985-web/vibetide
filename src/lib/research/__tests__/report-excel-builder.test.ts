// A5 Phase 7 — report-excel-builder 单测
//
// 3 case：
//  1. 5 sheet 命名正确（顺序：明细 / 分主题透视 / 分区县透视 / 分媒体层级透视 / 图表数据）
//  2. 明细 sheet 列正确（11 列）+ 行数（header + N 行）
//  3. 图表数据 sheet 含 Block A/B/C 标题
//
// Spec ref: §5.3
// Plan ref: Phase 7 Task 7.1.2

import { describe, expect, it } from "vitest";
import * as XLSX from "@e965/xlsx";

import type { AggregatesJson } from "@/db/schema/research/reports";
import {
  buildReportXlsx,
  type ExcelAppendixRow,
  type ExcelBuildInput,
} from "../report-excel-builder";

const baseAggregates: AggregatesJson = {
  hitCount: 2,
  mediaTierDistribution: [
    { tier: "央级", count: 1, percentage: 50, topMediaNames: ["人民网"] },
    { tier: "省级", count: 1, percentage: 50, topMediaNames: ["重庆日报"] },
  ],
  districtDistribution: [
    {
      districtId: "d1",
      districtName: "渝中区",
      count: 1,
      percentage: 50,
      topTopics: ["营商环境"],
    },
    {
      districtId: "d2",
      districtName: "江北区",
      count: 1,
      percentage: 50,
      topTopics: ["营商环境"],
    },
  ],
  topicDistribution: [
    {
      topicId: "t1",
      topicName: "营商环境",
      count: 2,
      percentage: 100,
      topDistricts: ["渝中区", "江北区"],
      topMedia: ["人民网", "重庆日报"],
    },
  ],
  dailyTrend: [
    { date: "2026-04-01", count: 1, cumulative: 1 },
    { date: "2026-04-15", count: 1, cumulative: 2 },
  ],
  isAiFallback: false,
  generatedAt: "2026-05-07T00:00:00.000Z",
};

const sampleAppendix: ExcelAppendixRow[] = [
  {
    title: "重庆营商环境再升级",
    outletName: "人民网",
    outletTier: "央级",
    outletRegion: "全国",
    districtNames: ["渝中区"],
    topicNames: ["营商环境"],
    publishedAt: "2026-04-01",
    firstSeenAt: "2026-04-02",
    url: "https://example.com/a",
    contentType: "image_text",
  },
  {
    title: "江北区招商引资创新高",
    outletName: "重庆日报",
    outletTier: "省级",
    outletRegion: "重庆",
    // 一条命中多区县/多主题（折叠成顿号分隔验证）
    districtNames: ["江北区", "渝北区"],
    topicNames: ["营商环境", "招商引资"],
    publishedAt: "2026-04-15",
    firstSeenAt: "2026-04-16",
    url: "https://example.com/b",
    contentType: "image_text",
  },
];

const baseInput: ExcelBuildInput = {
  aggregates: baseAggregates,
  appendix: sampleAppendix,
};

describe("buildReportXlsx", () => {
  it("returns workbook with 5 sheets in expected order", () => {
    const buf = buildReportXlsx(baseInput);
    const wb = XLSX.read(buf, { type: "buffer" });
    expect(wb.SheetNames).toEqual([
      "明细",
      "分主题透视",
      "分区县透视",
      "分媒体层级透视",
      "图表数据",
    ]);
  });

  it("明细 sheet 含 11 列 header + N 行数据；多区县用顿号分隔", () => {
    const buf = buildReportXlsx(baseInput);
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets["明细"];
    expect(sheet).toBeDefined();
    const rows = XLSX.utils.sheet_to_json(sheet!, {
      header: 1,
    }) as unknown[][];
    // 1 header + 2 data rows
    expect(rows.length).toBe(3);
    // header 11 列
    expect(rows[0]).toEqual([
      "序号",
      "标题",
      "媒体名",
      "媒体分级",
      "区域",
      "命中区县",
      "命中主题",
      "发布时间",
      "采集时间",
      "原文 URL",
      "内容类型",
    ]);
    // 第 1 数据行：单区县/单主题
    expect(rows[1]?.[5]).toBe("渝中区");
    expect(rows[1]?.[6]).toBe("营商环境");
    // 第 2 数据行：多区县/多主题用顿号折叠
    expect(rows[2]?.[5]).toBe("江北区、渝北区");
    expect(rows[2]?.[6]).toBe("营商环境、招商引资");
  });

  it("图表数据 sheet 含 Block A/B/C 三个 block 标题", () => {
    const buf = buildReportXlsx(baseInput);
    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.Sheets["图表数据"];
    expect(sheet).toBeDefined();
    const rows = XLSX.utils.sheet_to_json(sheet!, {
      header: 1,
    }) as unknown[][];
    // 扁平化所有行的所有 cell 拼成全文，验证三 block 标题都在
    const flat = rows.flat().map(String).join("\n");
    expect(flat).toContain("Block A — 时间趋势");
    expect(flat).toContain("Block B — 主题分布");
    expect(flat).toContain("Block C — 区县分布");
  });
});

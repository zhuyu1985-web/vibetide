// src/lib/research/ecological-index/__tests__/xlsx-builder.test.ts
//
// 验证 buildIndexReportXlsx:
// - 输出真实 xlsx zip(文件头 PK)
// - 19 个 sheet 完整且名称/顺序正确
// - 99 综合汇总 sheet 含全部区县
// - 1.2 中央丰富度 sheet 含 16 主题列

import { describe, it, expect } from "vitest";
import * as XLSX from "@e965/xlsx";

import type { ActivityDataPoint } from "@/db/schema/research/activity-datasets";

import type { ComputeResult } from "../compute";
import type { ParsedScopeUnit } from "../types";
import { buildIndexReportXlsx, MEDIA_TOPICS, ACTIVITY_THEMES } from "../xlsx-builder";

const fixture: ComputeResult = {
  ranked: [
    {
      rank: 1,
      name: "两江新区",
      central: 86,
      industry: 91,
      municipal: 95,
      district: 84,
      public: 68,
      composite: 86.0,
    },
    {
      rank: 2,
      name: "渝中区",
      central: 80,
      industry: 84,
      municipal: 82,
      district: 87,
      public: 68,
      composite: 75.0,
    },
  ],
  rawMedia: {
    两江新区: {
      central: {
        count: 100,
        richness: 1.5,
        freq: 0.5,
        topicCounts: Array(16).fill(6) as number[],
        days: 200,
      },
      industry: {
        count: 50,
        richness: 1.0,
        freq: 0.3,
        topicCounts: Array(16).fill(3) as number[],
        days: 100,
      },
      municipal: {
        count: 80,
        richness: 1.2,
        freq: 0.4,
        topicCounts: Array(16).fill(5) as number[],
        days: 150,
      },
      district: {
        count: 60,
        richness: 1.1,
        freq: 0.35,
        topicCounts: Array(16).fill(4) as number[],
        days: 120,
      },
    },
    渝中区: {
      central: {
        count: 80,
        richness: 1.3,
        freq: 0.4,
        topicCounts: Array(16).fill(5) as number[],
        days: 150,
      },
      industry: {
        count: 40,
        richness: 1.0,
        freq: 0.25,
        topicCounts: Array(16).fill(2) as number[],
        days: 80,
      },
      municipal: {
        count: 70,
        richness: 1.1,
        freq: 0.35,
        topicCounts: Array(16).fill(4) as number[],
        days: 120,
      },
      district: {
        count: 50,
        richness: 1.0,
        freq: 0.3,
        topicCounts: Array(16).fill(3) as number[],
        days: 100,
      },
    },
  },
  rawPublic: {
    两江新区: {
      count: 120,
      richness: 3.5,
      freq: 0.47,
      themes: {
        六五环境日: 30,
        "815全国生态日": 20,
        志愿服务活动: 25,
        环保设施向公众开放: 20,
        美丽重庆六进活动: 25,
      },
      firstDate: "2025-01-01",
      lastDate: "2025-12-31",
      spanDays: 255,
    },
    渝中区: {
      count: 50,
      richness: 3.0,
      freq: 0.16,
      themes: {
        六五环境日: 10,
        "815全国生态日": 10,
        志愿服务活动: 10,
        环保设施向公众开放: 10,
        美丽重庆六进活动: 10,
      },
      firstDate: "2025-01-01",
      lastDate: "2025-12-31",
      spanDays: 311,
    },
  },
  scaledMedia: {
    两江新区: {
      central: { count: 95, richness: 90, freq: 85 },
      industry: { count: 95, richness: 90, freq: 85 },
      municipal: { count: 95, richness: 90, freq: 85 },
      district: { count: 95, richness: 90, freq: 85 },
    },
    渝中区: {
      central: { count: 80, richness: 80, freq: 75 },
      industry: { count: 80, richness: 80, freq: 75 },
      municipal: { count: 80, richness: 80, freq: 75 },
      district: { count: 80, richness: 80, freq: 75 },
    },
  },
  scaledPublic: {
    两江新区: { count: 95, richness: 90, freq: 90 },
    渝中区: { count: 75, richness: 75, freq: 75 },
  },
  stats: {
    max: 86,
    min: 75,
    span: 11,
    mean: 80.5,
    median: 80.5,
    stdev: 7.78,
    tier_high: 1,
    tier_mid: 1,
    tier_low: 0,
  },
};

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

const activities: ActivityDataPoint[] = [
  {
    district: "两江新区",
    themes: {
      六五环境日: 30,
      "815全国生态日": 20,
      志愿服务活动: 25,
      环保设施向公众开放: 20,
      美丽重庆六进活动: 25,
    },
    total: 120,
    firstDate: "2025-01-01",
    lastDate: "2025-12-31",
    spanDays: 255,
    freq: 0.47,
  },
];

describe("xlsx-builder", () => {
  it("buildIndexReportXlsx 返回 xlsx Buffer (zip 头 PK)", () => {
    const buf = buildIndexReportXlsx({ result: fixture, units, activities });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.byteLength).toBeGreaterThan(5000);
    expect(buf[0]).toBe(0x50); // P
    expect(buf[1]).toBe(0x4b); // K
  });

  it("19 个 sheet 完整且顺序正确", () => {
    const buf = buildIndexReportXlsx({ result: fixture, units, activities });
    const wb = XLSX.read(buf, { type: "buffer" });
    expect(wb.SheetNames).toHaveLength(19);
    expect(wb.SheetNames[0]).toBe("00 总览说明");
    expect(wb.SheetNames[1]).toBe("01 数据源清单");
    expect(wb.SheetNames[2]).toBe("02 数据范围审计");
    expect(wb.SheetNames[wb.SheetNames.length - 1]).toBe("99 综合汇总");
    // 15 个二级指标 sheet 都在
    const expectedMid = [
      "1.1 中央数量",
      "1.2 中央丰富度",
      "1.3 中央速度",
      "2.1 行业数量",
      "2.2 行业丰富度",
      "2.3 行业速度",
      "3.1 市级数量",
      "3.2 市级丰富度",
      "3.3 市级速度",
      "4.1 区县数量",
      "4.2 区县丰富度",
      "4.3 区县速度",
      "5.1 公众数量",
      "5.2 公众丰富度",
      "5.3 公众速度",
    ];
    for (const name of expectedMid) {
      expect(wb.SheetNames).toContain(name);
    }
  });

  it("99 综合汇总 sheet 含全部排名行", () => {
    const buf = buildIndexReportXlsx({ result: fixture, units, activities });
    const wb = XLSX.read(buf, { type: "buffer" });
    const ws = wb.Sheets["99 综合汇总"]!;
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
    // 找到含 "两江新区" 与 "渝中区" 的行
    const hasTopRow = aoa.some(
      (row) => Array.isArray(row) && row.includes("两江新区"),
    );
    const hasSecondRow = aoa.some(
      (row) => Array.isArray(row) && row.includes("渝中区"),
    );
    expect(hasTopRow).toBe(true);
    expect(hasSecondRow).toBe(true);
  });

  it("1.2 中央丰富度 sheet 含 16 主题列", () => {
    const buf = buildIndexReportXlsx({ result: fixture, units, activities });
    const wb = XLSX.read(buf, { type: "buffer" });
    const ws = wb.Sheets["1.2 中央丰富度"]!;
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
    const headerRow = aoa.find(
      (row) => Array.isArray(row) && row.includes("排名"),
    );
    expect(headerRow).toBeDefined();
    if (headerRow && Array.isArray(headerRow)) {
      // 排名 + 区县 + 16 主题 + 总数 + F + 区间化得分 = 21 列
      expect(headerRow.length).toBeGreaterThanOrEqual(MEDIA_TOPICS.length + 5);
      for (const t of MEDIA_TOPICS) {
        expect(headerRow.includes(t)).toBe(true);
      }
    }
  });

  it("5.2 公众丰富度 sheet 含 5 活动主题列", () => {
    const buf = buildIndexReportXlsx({ result: fixture, units, activities });
    const wb = XLSX.read(buf, { type: "buffer" });
    const ws = wb.Sheets["5.2 公众丰富度"]!;
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
    const headerRow = aoa.find(
      (row) => Array.isArray(row) && row.includes("排名"),
    );
    expect(headerRow).toBeDefined();
    if (headerRow && Array.isArray(headerRow)) {
      for (const t of ACTIVITY_THEMES) {
        expect(headerRow.includes(t)).toBe(true);
      }
    }
  });
});

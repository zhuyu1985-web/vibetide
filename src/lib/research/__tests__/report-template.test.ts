// A5 Phase 3 — report-template 单测 (3 cases)
//
// 纯函数测试，无 DB / LLM 依赖。

import { describe, it, expect } from "vitest";

import type { AggregatesJson } from "@/db/schema/research/reports";
import { renderTemplateBrief } from "../report-template";

const fullAggregates: AggregatesJson = {
  hitCount: 42,
  topicDistribution: [
    {
      topicId: "t1",
      topicName: "营商环境",
      count: 20,
      percentage: 47.6,
      topDistricts: ["渝中区"],
      topMedia: ["人民日报"],
    },
    {
      topicId: "t2",
      topicName: "教育",
      count: 12,
      percentage: 28.6,
      topDistricts: ["江北区"],
      topMedia: [],
    },
  ],
  districtDistribution: [
    {
      districtId: "d1",
      districtName: "渝中区",
      count: 15,
      percentage: 35.7,
      topTopics: ["营商环境"],
    },
    {
      districtId: "d2",
      districtName: "江北区",
      count: 10,
      percentage: 23.8,
      topTopics: ["教育"],
    },
  ],
  mediaTierDistribution: [
    { tier: "央级", count: 10, percentage: 23.8, topMediaNames: ["人民日报"] },
    { tier: "省级", count: 8, percentage: 19.0, topMediaNames: [] },
    { tier: "地市级", count: 5, percentage: 11.9, topMediaNames: [] },
    { tier: "行业", count: 0, percentage: 0, topMediaNames: [] },
    { tier: "自媒体", count: 0, percentage: 0, topMediaNames: [] },
  ],
  dailyTrend: [
    { date: "2026-04-01", count: 3, cumulative: 3 },
    { date: "2026-04-02", count: 8, cumulative: 11 },
    { date: "2026-04-03", count: 5, cumulative: 16 },
  ],
  isAiFallback: false,
  generatedAt: "2026-05-07",
};

describe("renderTemplateBrief", () => {
  it("includes hit count + top topic + top district + top tier + peak day (full data)", () => {
    const out = renderTemplateBrief(fullAggregates, {
      timeRangeStart: "2026-04-01",
      timeRangeEnd: "2026-04-30",
      districtCount: 39,
      topicCount: 16,
      topicDescription: "营商环境与教育议题分析",
    });

    // 必须含具体数字
    expect(out).toContain("42 条");
    // Top topic
    expect(out).toContain("营商环境");
    expect(out).toContain("20 条");
    expect(out).toContain("47.6%");
    // Top district
    expect(out).toContain("渝中区");
    expect(out).toContain("15 条");
    // Top tier (央级 count 最大)
    expect(out).toContain("央级");
    expect(out).toContain("23.8%");
    // 峰值日
    expect(out).toContain("2026-04-02");
    expect(out).toContain("8 条");
    // 主题描述
    expect(out).toContain("营商环境与教育议题分析");
    // 时间窗
    expect(out).toContain("2026-04-01");
    expect(out).toContain("2026-04-30");
  });

  it("survives missing fields (empty distributions, no peak)", () => {
    const empty: AggregatesJson = {
      hitCount: 5,
      topicDistribution: [],
      districtDistribution: [],
      mediaTierDistribution: [], // 全空
      dailyTrend: [], // 全空
      isAiFallback: false,
      generatedAt: "2026-05-07",
    };

    const out = renderTemplateBrief(empty, {
      timeRangeStart: "2026-04-01",
      timeRangeEnd: "2026-04-30",
      districtCount: 0,
      topicCount: 0,
    });

    // hitCount > 0 走主模板
    expect(out).toContain("5 条");
    // 不抛、不含未出现字段的提示
    expect(out).not.toContain("undefined");
    expect(out).not.toContain("NaN");

    // 0 命中走简短无命中模板
    const zero = renderTemplateBrief(
      { ...empty, hitCount: 0 },
      {
        timeRangeStart: "2026-04-01",
        timeRangeEnd: "2026-04-30",
        districtCount: 0,
        topicCount: 0,
      },
    );
    expect(zero).toContain("未采集到");
    expect(zero).toContain("0 个区县");
    expect(zero).not.toContain("undefined");
  });

  it("formats ISO timestamps as YYYY-MM-DD (no T/Z residue)", () => {
    const out = renderTemplateBrief(
      {
        hitCount: 1,
        topicDistribution: [],
        districtDistribution: [],
        mediaTierDistribution: [],
        dailyTrend: [{ date: "2026-04-15", count: 1, cumulative: 1 }],
        isAiFallback: false,
        generatedAt: "",
      },
      {
        timeRangeStart: "2026-04-01T00:00:00Z",
        timeRangeEnd: "2026-04-30T12:00:00Z", // 中午 12:00Z 在 UTC+8 仍是 4-30 当日
        districtCount: 0,
        topicCount: 0,
      },
    );

    // ISO 时间戳被格式化为 YYYY-MM-DD（local timezone-safe 校验）
    // 起：2026-04-01T00:00:00Z 在 UTC+8 是 04-01 8:00（仍 4 月）
    expect(out).toMatch(/2026-04-\d{2}/);
    // 止：2026-04-30T12:00:00Z 在 UTC+8 是 04-30 20:00（仍 4 月）
    // 用 2 个匹配确保起+止两次
    expect((out.match(/2026-04-\d{2}/g) ?? []).length).toBeGreaterThanOrEqual(2);
    // 不含原 ISO 残留
    expect(out).not.toContain("T00:00:00Z");
    expect(out).not.toContain("T12:00:00Z");
    expect(out).not.toContain("Z");
  });
});

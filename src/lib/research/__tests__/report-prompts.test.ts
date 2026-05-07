// A5 Phase 3 — report-prompts 单测 (3 cases)
//
// 纯函数测试，无 LLM / DB 调用。

import { describe, it, expect } from "vitest";

import type { AggregatesJson } from "@/db/schema/research/reports";
import {
  ReportParagraphsSchema,
  buildUserMessage,
  buildFallbackParagraphs,
  type PromptInput,
} from "../report-prompts";

const baseAggregates: AggregatesJson = {
  hitCount: 10,
  topicDistribution: [
    {
      topicId: "t1",
      topicName: "营商环境",
      count: 5,
      percentage: 50,
      topDistricts: ["渝中区"],
      topMedia: [],
    },
  ],
  districtDistribution: [
    {
      districtId: "d1",
      districtName: "渝中区",
      count: 4,
      percentage: 40,
      topTopics: ["营商环境"],
    },
  ],
  mediaTierDistribution: [
    { tier: "央级", count: 5, percentage: 50, topMediaNames: [] },
    { tier: "省级", count: 3, percentage: 30, topMediaNames: [] },
  ],
  dailyTrend: [
    { date: "2026-04-01", count: 1, cumulative: 1 },
    { date: "2026-04-02", count: 5, cumulative: 6 },
  ],
  isAiFallback: false,
  generatedAt: "",
};

const baseInput: PromptInput = {
  title: "重庆营商环境议题报告",
  topicDescription: "重庆营商环境议题",
  timeRangeStart: "2026-04-01",
  timeRangeEnd: "2026-04-30",
  templateBrief:
    "在 2026-04-01 至 2026-04-30 时间窗内，全网共采集到与所选研究范围相关的报道 10 条。" +
    "主题分布上，营商环境最为突出，共 5 条（占 50%）。" +
    "区县分布上，渝中区报道最多，共 4 条（占 40%）。" +
    "媒体层级上，央级报道占比 50%（5 条）。",
  sampleTitles: [],
  aggregates: baseAggregates,
};

describe("ReportParagraphsSchema", () => {
  it("schema accepts a valid 3-paragraph object", () => {
    const valid = {
      background: "x".repeat(300),
      brief_rewrite: "y".repeat(200),
      conclusions: "z".repeat(800),
    };
    expect(() => ReportParagraphsSchema.parse(valid)).not.toThrow();
  });

  it("schema rejects too-short background (< 200 chars)", () => {
    const invalid = {
      background: "x".repeat(100), // < 200 min
      brief_rewrite: "y".repeat(200),
      conclusions: "z".repeat(800),
    };
    expect(() => ReportParagraphsSchema.parse(invalid)).toThrow();
  });

  it("buildFallbackParagraphs produces schema-valid output (含具体数字)", () => {
    const fallback = buildFallbackParagraphs(baseInput);

    // 1) schema 通过
    const out = ReportParagraphsSchema.safeParse(fallback);
    expect(out.success).toBe(true);

    // 2) 三段都有内容
    expect(fallback.background.length).toBeGreaterThanOrEqual(200);
    expect(fallback.brief_rewrite.length).toBeGreaterThanOrEqual(150);
    expect(fallback.conclusions.length).toBeGreaterThanOrEqual(500);

    // 3) 包含具体数字（学术体不允许"大量""很多"）
    expect(fallback.background).toContain("10");
    expect(fallback.background).toContain("2026-04-01");
    expect(fallback.brief_rewrite).toContain("10 条");
    expect(fallback.conclusions).toContain("营商环境");
    expect(fallback.conclusions).toContain("5 条");
    expect(fallback.conclusions).toContain("渝中区");

    // 4) buildUserMessage 序列化合法 JSON 且含核心字段
    const user = buildUserMessage(baseInput);
    const parsed = JSON.parse(user);
    expect(parsed.task_meta.title).toBe(baseInput.title);
    expect(parsed.task_meta.hit_count).toBe(10);
    expect(parsed.template_brief).toBe(baseInput.templateBrief);
    expect(parsed.aggregates.topic_distribution).toHaveLength(1);
  });
});

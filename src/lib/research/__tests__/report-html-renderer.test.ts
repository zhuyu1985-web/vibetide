// A5 Phase 4 — report-html-renderer 单测
//
// 纯函数渲染器，无 DB / LLM / React 依赖。
// 验证：基本结构 / banner / escape / chart placeholder / 空数据兜底。

import { describe, it, expect } from "vitest";

import type { AggregatesJson } from "@/db/schema/research/reports";
import {
  renderReportHtml,
  formatDate,
  escapeHtml,
  type AppendixRow,
  type HtmlRenderInput,
} from "../report-html-renderer";

const baseAggregates: AggregatesJson = {
  hitCount: 42,
  mediaTierDistribution: [
    { tier: "央级", count: 20, percentage: 47.6, topMediaNames: ["人民日报", "新华社"] },
    { tier: "省级", count: 22, percentage: 52.4, topMediaNames: ["重庆日报"] },
  ],
  districtDistribution: [
    { districtId: "d1", districtName: "渝中区", count: 18, percentage: 42.9, topTopics: ["营商环境"] },
    { districtId: "d2", districtName: "江北区", count: 24, percentage: 57.1, topTopics: [] },
  ],
  topicDistribution: [
    {
      topicId: "t1",
      topicName: "营商环境",
      count: 25,
      percentage: 59.5,
      topDistricts: ["渝中区"],
      topMedia: ["人民日报"],
    },
    {
      topicId: "t2",
      topicName: "教育",
      count: 17,
      percentage: 40.5,
      topDistricts: [],
      topMedia: [],
    },
  ],
  dailyTrend: [
    { date: "2025-06-01", count: 10, cumulative: 10 },
    { date: "2025-06-02", count: 32, cumulative: 42 },
  ],
  isAiFallback: false,
  generatedAt: "2025-06-03T00:00:00.000Z",
};

const baseInput: HtmlRenderInput = {
  title: "重庆 39 区县报道分布研究",
  topicDescription: "营商环境与教育议题分布特征",
  timeRangeStart: "2025-06-01T00:00:00.000Z",
  timeRangeEnd: "2025-06-02T23:59:59.999Z",
  completedAt: "2025-06-03T01:23:45.000Z",
  paragraphs: {
    background: "本研究聚焦营商环境议题。\n\n时间窗为 2025 年 6 月。",
    brief_rewrite: "数据简报 200 字润色版示例文本。",
    conclusions: "结论一：营商环境最热。\n\n结论二：渝中区报道密度高。",
  },
  aggregates: baseAggregates,
  appendix: [
    {
      id: "i1",
      title: "营商环境改革",
      outletName: "人民日报",
      outletTier: "央级",
      districtName: "渝中区",
      publishedAt: "2025-06-01",
      url: "https://example.com/a",
    },
  ],
  isAiFallback: false,
};

describe("renderReportHtml", () => {
  it("renders cover + 3 chapters + appendix with anchor ids", () => {
    const html = renderReportHtml(baseInput);

    expect(html).toContain('<article class="research-report">');
    expect(html).toContain('class="report-cover"');
    expect(html).toContain('id="chapter1"');
    expect(html).toContain('id="chapter2"');
    expect(html).toContain('id="chapter2_1"');
    expect(html).toContain('id="chapter2_2"');
    expect(html).toContain('id="chapter2_3"');
    expect(html).toContain('id="chapter2_4"');
    expect(html).toContain('id="chapter2_5"');
    expect(html).toContain('id="chapter3"');
    expect(html).toContain('id="appendix"');

    // anchor 用下划线（不是连字符）
    expect(html).not.toContain('id="chapter2-1"');
  });

  it("escapes user-controlled fields (title / topicDescription)", () => {
    const html = renderReportHtml({
      ...baseInput,
      title: "<script>alert('xss')</script>",
      topicDescription: "A & B \"quoted\"",
    });

    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A &amp; B");
    expect(html).toContain("&quot;quoted&quot;");
  });

  it("emits 4 chart placeholders with data-chart + data-source attributes", () => {
    const html = renderReportHtml(baseInput);

    expect(html).toContain('data-chart="bar"');
    expect(html).toContain('data-source="media_tier"');
    expect(html).toContain('data-chart="hbar"');
    expect(html).toContain('data-source="district"');
    expect(html).toContain('data-chart="donut"');
    expect(html).toContain('data-source="topic"');
    expect(html).toContain('data-chart="line"');
    expect(html).toContain('data-source="trend"');

    // payload 必须有 (escape 过的 JSON 包含 &quot;)
    expect(html).toContain("data-payload=");
    expect(html).toContain("&quot;");
  });

  it("inserts AI fallback banner when isAiFallback=true", () => {
    const html = renderReportHtml({ ...baseInput, isAiFallback: true });
    expect(html).toContain('data-banner="ai-fallback"');
    expect(html).toContain("AI 段落降级");
  });

  it("does NOT insert banners when no fallback / no drift", () => {
    const html = renderReportHtml(baseInput);
    expect(html).not.toContain('data-banner=');
  });

  it("inserts drift banner when drift.original !== drift.alive", () => {
    const html = renderReportHtml({
      ...baseInput,
      drift: { original: 100, alive: 80 },
    });
    expect(html).toContain('data-banner="drift"');
    expect(html).toContain("100 条数据");
    expect(html).toContain("80 条仍存在");
    expect(html).toContain("20 条已删除");
  });

  it("does NOT insert drift banner when original === alive", () => {
    const html = renderReportHtml({
      ...baseInput,
      drift: { original: 42, alive: 42 },
    });
    expect(html).not.toContain('data-banner="drift"');
  });

  it("renders empty hint when no data", () => {
    const emptyAgg: AggregatesJson = {
      ...baseAggregates,
      mediaTierDistribution: [],
      districtDistribution: [],
      topicDistribution: [],
      dailyTrend: [],
      hitCount: 0,
    };
    const html = renderReportHtml({
      ...baseInput,
      aggregates: emptyAgg,
      appendix: [],
    });
    expect(html).toContain("无媒体层级数据");
    expect(html).toContain("无区县分布数据");
    expect(html).toContain("无主题分布数据");
    expect(html).toContain("无时间趋势数据");
  });

  it("renders appendix with hyperlink + escapes outlet/district names", () => {
    const xssRow: AppendixRow = {
      id: "x1",
      title: "<img onerror=alert(1)>",
      outletName: "测试 & 媒体",
      outletTier: "央级",
      districtName: "渝中区",
      publishedAt: "2025-06-01",
      url: "https://example.com/safe",
    };
    const html = renderReportHtml({ ...baseInput, appendix: [xssRow] });

    expect(html).toContain("&lt;img onerror=alert(1)&gt;");
    expect(html).toContain("测试 &amp; 媒体");
    expect(html).toContain('href="https://example.com/safe"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("renders inline **bold** as <strong>", () => {
    const html = renderReportHtml({
      ...baseInput,
      paragraphs: {
        background: "这段包含 **加粗内容** 测试。",
        brief_rewrite: "简报",
        conclusions: "结论",
      },
    });
    expect(html).toContain("<strong>加粗内容</strong>");
  });
});

describe("escapeHtml", () => {
  it("escapes < > & \" '", () => {
    expect(escapeHtml("<a>")).toBe("&lt;a&gt;");
    expect(escapeHtml("a & b")).toBe("a &amp; b");
    expect(escapeHtml("\"x\"")).toBe("&quot;x&quot;");
    expect(escapeHtml("'y'")).toBe("&#39;y&#39;");
  });
});

describe("formatDate (Asia/Shanghai)", () => {
  it("formats UTC midnight as next day in Asia/Shanghai", () => {
    // 2025-06-01T00:00:00Z = 2025-06-01T08:00:00+08:00 → still 2025-06-01
    expect(formatDate("2025-06-01T00:00:00.000Z")).toBe("2025-06-01");
  });

  it("formats UTC 18:00 (which is +08:00 next day 02:00) as next day", () => {
    // 2025-06-01T18:00:00Z = 2025-06-02T02:00:00+08:00
    expect(formatDate("2025-06-01T18:00:00.000Z")).toBe("2025-06-02");
  });

  it("returns yyyy-mm-dd as-is", () => {
    expect(formatDate("2025-06-15")).toBe("2025-06-15");
  });

  it("returns invalid input as-is", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
    expect(formatDate("")).toBe("");
  });
});

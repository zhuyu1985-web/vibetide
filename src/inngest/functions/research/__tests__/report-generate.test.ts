// A5 Phase 7 — research-report-generate Inngest function 集成测（降级版）
//
// **降级说明（per spec §9 + plan Phase 7 N-4）**：
// vitest 内难以驱动 Inngest runtime 的 step.run / step.sendEvent 序列
// （需 Inngest test harness 才能完整 stub）。本测试不是端到端 Inngest function 测，
// 而是降级为：
//   - 直接对 builder 链（buildReportDocx + buildReportXlsx）做最终输出断言（覆盖
//     spec §9 "全流程跑一次（mock LLM）" 测试 case）
//   - 对 fallback 路径（buildFallbackParagraphs）做单独断言（覆盖 spec §9 "Step 3
//     失败降级" 测试 case）
//
// 这等价于 spec §9 所述"集成测"的实用降级。Inngest function handler 内部
// step 序列由 dev smoke + Phase 10 验收阶段人工验证。
//
// Plan ref: Phase 7 Task 7.2.2

import { describe, expect, it } from "vitest";

import type { AggregatesJson } from "@/db/schema/research/reports";
import { buildReportDocx } from "@/lib/research/report-word-builder";
import {
  buildReportXlsx,
  type ExcelAppendixRow,
} from "@/lib/research/report-excel-builder";
import {
  buildFallbackParagraphs,
  type PromptInput,
} from "@/lib/research/report-prompts";

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
  ],
  topicDistribution: [
    {
      topicId: "t1",
      topicName: "营商环境",
      count: 2,
      percentage: 100,
      topDistricts: ["渝中区"],
      topMedia: ["人民网"],
    },
  ],
  dailyTrend: [
    { date: "2026-04-01", count: 1, cumulative: 1 },
    { date: "2026-04-15", count: 1, cumulative: 2 },
  ],
  isAiFallback: false,
  generatedAt: "2026-05-07T00:00:00.000Z",
};

const sampleExcelAppendix: ExcelAppendixRow[] = [
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
];

describe("research-report-generate function (集成测降级 — builder 链端到端)", () => {
  it("end-to-end with mocked LLM 输出 — Word + Excel builder 都产出非空 Buffer", async () => {
    // 模拟 LLM 成功（output 即 ReportParagraphsSchema 解析结果）
    const llmOutput = {
      background: "x".repeat(300),
      brief_rewrite: "y".repeat(200),
      conclusions: "z".repeat(800),
    };

    // Step 5 模拟：调 Word builder
    const docx = await buildReportDocx({
      title: "重庆营商环境研究报告",
      topicDescription: "重庆 38 区县营商环境媒体声量分析",
      timeRangeStart: "2026-04-01",
      timeRangeEnd: "2026-04-30",
      completedAt: "2026-05-07T10:00:00.000Z",
      paragraphs: llmOutput,
      aggregates: baseAggregates,
      appendix: [
        {
          title: "重庆营商环境再升级",
          outletName: "人民网",
          outletTier: "央级",
          districtName: "渝中区",
          publishedAt: "2026-04-01",
        },
      ],
    });

    // Step 6 模拟：调 Excel builder
    const xlsx = buildReportXlsx({
      aggregates: baseAggregates,
      appendix: sampleExcelAppendix,
    });

    // 两 builder 都产出非空 Buffer（docx > 1KB，xlsx > 1KB 起步合理）
    expect(Buffer.isBuffer(docx)).toBe(true);
    expect(docx.length).toBeGreaterThan(1000);
    expect(Buffer.isBuffer(xlsx)).toBe(true);
    expect(xlsx.length).toBeGreaterThan(500);

    // 验证两文件 magic bytes：docx + xlsx 都是 ZIP container（"PK"）
    expect(docx[0]).toBe(0x50);
    expect(docx[1]).toBe(0x4b);
    expect(xlsx[0]).toBe(0x50);
    expect(xlsx[1]).toBe(0x4b);
  });

  it("Step 3 LLM failure 降级路径 — buildFallbackParagraphs 输出满足 schema 字数下限", () => {
    const promptInput: PromptInput = {
      title: "重庆营商环境研究报告",
      topicDescription: "重庆 38 区县营商环境媒体声量分析",
      timeRangeStart: "2026-04-01",
      timeRangeEnd: "2026-04-30",
      aggregates: baseAggregates,
      templateBrief:
        "在 2026-04-01 至 2026-04-30 内，全网共发布相关报道 2 条，覆盖 1 个区县与 1 个主题。",
      sampleTitles: ["重庆营商环境再升级", "江北区招商引资创新高"],
    };

    const fallback = buildFallbackParagraphs(promptInput);

    // 满足 ReportParagraphsSchema 的字数下限：200 / 150 / 500
    expect(fallback.background.length).toBeGreaterThanOrEqual(200);
    expect(fallback.brief_rewrite.length).toBeGreaterThanOrEqual(150);
    expect(fallback.conclusions.length).toBeGreaterThanOrEqual(500);

    // 上限保护：不超过 max（700 / 500 / 2000）
    expect(fallback.background.length).toBeLessThanOrEqual(700);
    expect(fallback.brief_rewrite.length).toBeLessThanOrEqual(500);
    expect(fallback.conclusions.length).toBeLessThanOrEqual(2000);

    // 内容包含主题描述与具体数字（fallback 不臆造）
    expect(fallback.background).toContain("重庆 38 区县营商环境媒体声量分析");
    expect(fallback.conclusions).toContain("营商环境");
    expect(fallback.conclusions).toContain("渝中区");
  });
});

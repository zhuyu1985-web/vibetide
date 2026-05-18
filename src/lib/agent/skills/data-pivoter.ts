/**
 * data_pivoter — chat tool for xiaoyan / xiaoshu.
 *
 * 把用户口语化的数据透视需求 → pivot_config + chart_type JSON.
 *
 * AI SDK v6 — uses `generateText({ output: Output.object({ schema }) })`
 * （v6 移除了 generateObject）。
 *
 * Spec: docs/superpowers/specs/2026-05-07-a6-xiaoyan-design.md §3.5 / §4.3 / §4.4
 *
 * Note on preview field:
 *   V1 不计算 preview（A5 报告页表 researchReports 在 Wave 1 序列里 ship 在
 *   A6 之后）。A5 ship 后再接 `computePivotPreview(orgId, reportId, pivotConfig)`
 *   SQL 聚合层。当前 Phase 4 只输出 `pivot_config + chart_type + reasoning + applyUrl`。
 */

import { tool, generateText, Output } from "ai";
import { z } from "zod/v4";
import { db } from "@/db";
import { aiEmployees } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { assembleAgent } from "../assembly";
import { getLanguageModel } from "../model-router";

// ---------------------------------------------------------------------------
// Zod schema — 严格 5 维度 / 3 measure / 4 chart_type 枚举约束
// ---------------------------------------------------------------------------

const DIMENSION_ENUM = z.enum([
  "topic",
  "district",
  "media_tier",
  "media_name",
  "date",
]);

const PivotConfigSchema = z.object({
  rows: DIMENSION_ENUM,
  cols: DIMENSION_ENUM,
  measure: z.enum(["count", "percentage", "avg_tier"]),
  filter: z.record(z.string(), z.array(z.string())).optional(),
});

const DataPivoterOutputSchema = z.object({
  pivot_config: PivotConfigSchema,
  chart_type: z.enum(["bar", "heatmap", "donut", "line"]),
  reasoning: z.string().min(10).max(300),
});

export type DataPivoterResult = z.infer<typeof DataPivoterOutputSchema> & {
  applyUrl?: string;
};

// ---------------------------------------------------------------------------
// 5 维度白名单 — 注入给 LLM 作为 available_dimensions
// ---------------------------------------------------------------------------

const AVAILABLE_DIMENSIONS = [
  "topic",
  "district",
  "media_tier",
  "media_name",
  "date",
] as const;

// ---------------------------------------------------------------------------
// Tool factory（lazy-injected at chat-stream time，与 createResearchQueryBuilderTool
// 同模式）
// ---------------------------------------------------------------------------

export function createDataPivoterTool(orgId: string) {
  return tool({
    description:
      "把用户口语化的数据透视需求翻译成报告页 pivot_config + 图表类型 JSON。例如 '按主题×区县看分布' / '统计 6 月每个区县的报道数'。适用于学术研究员小研 / 数据分析师小数场景。",
    inputSchema: z.object({
      user_request: z
        .string()
        .min(5)
        .describe("用户口语化的透视需求，至少 5 字"),
      current_report_id: z
        .string()
        .uuid()
        .optional()
        .describe("可选：当前所在报告 ID。存在则给 applyUrl deeplink"),
    }),
    execute: async ({ user_request, current_report_id }) => {
      // 拿 xiaoyan 在当前 org 下的 employee row（id + slug）
      // xiaoyan 是 data_pivoter 的 core skill 持有者；xiaoshu 也可走该 skill，
      // 但 system prompt 还是按 xiaoyan 装配（compatibleRoles 已含 data_analyst）
      const xiaoyan = await db.query.aiEmployees.findFirst({
        where: and(
          eq(aiEmployees.organizationId, orgId),
          eq(aiEmployees.slug, "xiaoyan"),
        ),
      });
      if (!xiaoyan) {
        throw new Error(
          "xiaoyan employee not seeded in this org（依赖 A6 Phase 1 seed）",
        );
      }

      // assembleAgent: (employeeId, modelOverride?, context?) — 3 个位置参数
      const agent = await assembleAgent(xiaoyan.id, undefined, {
        skillOverrides: ["data_pivoter"],
      });

      const userPayload = JSON.stringify({
        user_request,
        available_dimensions: AVAILABLE_DIMENSIONS,
        current_report_id: current_report_id ?? null,
      });

      const { output } = await generateText({
        model: getLanguageModel(agent.modelConfig),
        system: agent.systemPrompt,
        prompt: userPayload,
        output: Output.object({ schema: DataPivoterOutputSchema }),
        temperature: 0.2,
        maxOutputTokens: 1500,
      });

      // 仅在 current_report_id 存在时构造 applyUrl（A5 报告页 deeplink hydrate）
      // A5 ship 后需在 report-client.tsx 加 `apply_pivot` URL hydrate（spec §4.4）
      const applyUrl = current_report_id
        ? `/data-collection/reports/${current_report_id}?apply_pivot=${encodeURIComponent(
            JSON.stringify(output),
          )}`
        : undefined;

      return { ...output, applyUrl } satisfies DataPivoterResult;
    },
  });
}

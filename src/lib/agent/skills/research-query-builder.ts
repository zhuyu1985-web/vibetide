/**
 * research_query_builder — chat tool for xiaoyan / xiaolei.
 *
 * 把用户口语化的研究检索需求 → AdvancedSearchCondition[] + SidebarFilter JSON.
 *
 * AI SDK v6 — uses `generateText({ output: Output.object({ schema }) })`
 * （v6 移除了 generateObject）。
 *
 * Spec: docs/superpowers/specs/2026-05-07-a6-xiaoyan-design.md §3.4 / §4.2
 */

import { tool, generateText, Output } from "ai";
import { z } from "zod/v4";
import { db } from "@/db";
import { aiEmployees } from "@/db/schema";
import { cqDistricts } from "@/db/schema/research/cq-districts";
import { researchTopics } from "@/db/schema/research/research-topics";
import { and, eq } from "drizzle-orm";
import { assembleAgent } from "../assembly";
import { getLanguageModel } from "../model-router";

// ---------------------------------------------------------------------------
// Zod schema (复用 A4 类型 + 严格 11 字段 / 5 operator 约束)
// ---------------------------------------------------------------------------

const AdvancedSearchConditionSchema = z.object({
  field: z.enum([
    "title",
    "content",
    "author",
    "outletName",
    "outletTier",
    "outletRegion",
    "district",
    "topic",
    "contentType",
    "publishedAt",
    "platform",
  ]),
  operator: z.enum([
    "contains",
    "not_contains",
    "equals",
    "not_equals",
    "between",
  ]),
  // value: 单值字符串；between 时为 [start, end] 二元数组
  value: z.union([z.string(), z.array(z.string()).length(2)]),
  logic: z.enum(["and", "or"]).default("and"),
});

const SidebarFilterSchema = z.object({
  districtIds: z.array(z.string()).optional(),
  topicIds: z.array(z.string()).optional(),
});

const ResearchQueryBuilderOutputSchema = z.object({
  conditions: z.array(AdvancedSearchConditionSchema).max(10),
  sidebarFilter: SidebarFilterSchema.nullable(),
  reasoning: z.string().min(10).max(300),
});

export type ResearchQueryBuilderResult = z.infer<
  typeof ResearchQueryBuilderOutputSchema
> & { applyUrl: string };

// ---------------------------------------------------------------------------
// Dictionary loaders
//
// 注意：cqDistricts 是全局字典（schema 无 organization_id 列），所有 org 共用
// 38 项重庆区县；researchTopics 才按 org 隔离。
// ---------------------------------------------------------------------------

async function listDistricts(_orgId: string) {
  // schema: research_cq_districts { id, name, code, sort_order, created_at }
  const rows = await db
    .select({ id: cqDistricts.id, name: cqDistricts.name })
    .from(cqDistricts);
  return rows;
}

async function listTopics(orgId: string) {
  // schema: research_topics { id, organization_id, name, ... }
  const rows = await db
    .select({ id: researchTopics.id, name: researchTopics.name })
    .from(researchTopics)
    .where(eq(researchTopics.organizationId, orgId));
  return rows;
}

// ---------------------------------------------------------------------------
// Tool factory（lazy-injected at chat-stream time，与 createMissionTools /
// createKnowledgeBaseTools 同模式）
// ---------------------------------------------------------------------------

export function createResearchQueryBuilderTool(orgId: string) {
  return tool({
    description:
      "把用户口语化的研究检索需求翻译成 vibetide A4 高级检索的 conditions[] + sidebarFilter JSON。适用于学术研究员小研 / 热点分析师小雷场景。",
    inputSchema: z.object({
      user_intent: z
        .string()
        .min(5)
        .describe("用户口语化的检索需求，至少 5 字"),
    }),
    execute: async ({ user_intent }) => {
      const [districts, topics] = await Promise.all([
        listDistricts(orgId),
        listTopics(orgId),
      ]);

      // 拿 xiaoyan 在当前 org 下的 employee row（id + slug）
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
        skillOverrides: ["research_query_builder"],
      });

      const userPayload = JSON.stringify({
        user_intent,
        available_districts: districts,
        available_topics: topics,
      });

      const { output } = await generateText({
        model: getLanguageModel(agent.modelConfig),
        system: agent.systemPrompt,
        prompt: userPayload,
        output: Output.object({ schema: ResearchQueryBuilderOutputSchema }),
        temperature: 0.2,
        maxOutputTokens: 1500,
      });

      const applyUrl = `/research?mode=advanced&apply_query_builder=${encodeURIComponent(
        JSON.stringify(output),
      )}`;

      return { ...output, applyUrl } satisfies ResearchQueryBuilderResult;
    },
  });
}

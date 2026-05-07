// src/lib/research/report-prompts.ts
//
// A5 Phase 3 — AI 报告段落 prompt + zod schema + 降级模板
//
// Spec ref: docs/superpowers/specs/2026-05-07-a5-report-export-design.md §6 + §6.5
// Plan ref: docs/superpowers/plans/2026-05-07-a5-report-export-plan.md Phase 3 Task 3.2
//
// 使用方式（A5 Inngest Step 3，不在 Phase 3 范围）：
//   const { output } = await generateText({
//     model: getLanguageModel(agent.modelConfig),
//     system: agent.systemPrompt,
//     prompt: buildUserMessage(input),
//     output: Output.object({ schema: ReportParagraphsSchema }),
//   });

import { z } from "zod";

import type { AggregatesJson } from "@/db/schema/research/reports";

/**
 * AI 输出的 3 段结构 zod schema（强约束输出 minimum / maximum 字数）
 *
 * Spec §6.3：
 *   - background       200-700 chars  (1-2 段, 约 300-500 字)
 *   - brief_rewrite    150-500 chars  (1 段, 约 200-300 字)
 *   - conclusions      500-2000 chars (3-5 段, 约 800-1500 字)
 *
 * 注：中文字符在 zod min/max 中按 .length 计（每个汉字 1 length），
 * 200 chars 大致 ≈ 200 个汉字，因此命中"约 300-500 字"目标的下限。
 */
export const ReportParagraphsSchema = z.object({
  background: z
    .string()
    .min(200)
    .max(700)
    .describe(
      "第一章 研究背景，1-2 段，约 300-500 字。围绕主题/时间窗/区域意义",
    ),
  brief_rewrite: z
    .string()
    .min(150)
    .max(500)
    .describe(
      "第二章 2.1 数据简报润色版，1 段，约 200-300 字。基于 template_brief 学术体改写，必须保留所有具体数字",
    ),
  conclusions: z
    .string()
    .min(500)
    .max(2000)
    .describe(
      "第三章 研究发现，3-5 段，约 800-1500 字。基于 aggregates 数据特征写结论",
    ),
});

export type ReportParagraphs = z.infer<typeof ReportParagraphsSchema>;

/** AI 输入 payload（user message） */
export interface PromptInput {
  /** 报告标题 */
  title: string;
  /** 用户填写的主题描述（可选） */
  topicDescription?: string;
  /** ISO 时间窗起 */
  timeRangeStart: string;
  /** ISO 时间窗止 */
  timeRangeEnd: string;
  /** 4 维聚合结果 */
  aggregates: AggregatesJson;
  /** Step 2 模板插值生成的数据简报 plain text（≈200 字） */
  templateBrief: string;
  /** 5 条命中文章标题（给 AI 当样例语料） */
  sampleTitles: string[];
}

/**
 * 把 prompt input 序列化为 user message JSON。
 * system prompt 由 7-layer assembleAgent 生成，本函数只构造 user 段。
 */
export function buildUserMessage(input: PromptInput): string {
  return JSON.stringify({
    task_meta: {
      title: input.title,
      topic_description: input.topicDescription ?? "",
      time_range: { start: input.timeRangeStart, end: input.timeRangeEnd },
      districts: input.aggregates.districtDistribution.map((d) => ({
        name: d.districtName,
        count: d.count,
      })),
      topics: input.aggregates.topicDistribution.map((t) => ({
        name: t.topicName,
        count: t.count,
      })),
      media_tiers: input.aggregates.mediaTierDistribution.map((m) => ({
        tier: m.tier,
        count: m.count,
      })),
      hit_count: input.aggregates.hitCount,
    },
    aggregates: {
      media_tier_distribution: input.aggregates.mediaTierDistribution,
      district_distribution: input.aggregates.districtDistribution,
      topic_distribution: input.aggregates.topicDistribution,
      daily_trend: input.aggregates.dailyTrend,
      cross_pivots: input.aggregates.crossPivots,
    },
    template_brief: input.templateBrief,
    sample_titles: input.sampleTitles.slice(0, 5),
  });
}

/**
 * Alias：A5 Inngest Step 3 可能直接以"buildReportPrompt"语义调用。
 * 与 buildUserMessage 行为一致。
 */
export const buildReportPrompt = buildUserMessage;

/**
 * 降级模板 — LLM 调用 3 次仍失败时使用。
 *
 * Spec §6.5：
 *   - background：默认模板（基于 topic_description / time_range / district_count / hit_count）
 *   - brief_rewrite：直接用 template_brief 原文
 *   - conclusions：默认模板（基于 top_topic / top_district / trend_summary）
 *
 * 必须满足 ReportParagraphsSchema 字数下限（min 200/150/500）。
 */
export function buildFallbackParagraphs(input: PromptInput): ReportParagraphs {
  const desc = (input.topicDescription && input.topicDescription.trim()) || input.title;
  const districtCount = input.aggregates.districtDistribution.length;
  const topicCount = input.aggregates.topicDistribution.length;
  const hit = input.aggregates.hitCount;
  const start = input.timeRangeStart;
  const end = input.timeRangeEnd;

  // ── background：约 300-500 字 ──
  const backgroundParts: string[] = [
    `本研究聚焦${desc}相关报道，基于 ${start} 至 ${end} 时间窗内 ${districtCount} 个区县共 ${hit} 条公开报道，分析其分布特征与传播规律。`,
    `研究采用全网公开数据采集，结合主题与区县多维度交叉分析的方法，旨在为新闻传播学的学术研究提供量化数据支撑。`,
    `所选时间窗覆盖 ${start} 至 ${end}，涉及 ${districtCount} 个区县与 ${topicCount} 个主题维度；样本覆盖央级、省级、地市级、行业及自媒体等多层级媒体来源，具备较好的代表性。`,
    `本研究致力于通过数据驱动的方式还原议题在时间、空间、媒体层级三维度上的传播形态，为后续深度研究与政策建议提供基础参考。`,
  ];
  const background = backgroundParts.join("");

  // ── brief_rewrite：直接用 template_brief；若不足 150 字则补尾段 ──
  let brief = input.templateBrief;
  const briefPad = "以上为基础数据简报，下文将基于聚合结果进一步分析其分布特征与传播规律。";
  while (brief.length < 150) {
    brief = brief + briefPad;
  }
  // 截断至 max 500 防超限
  if (brief.length > 500) brief = brief.slice(0, 500);

  // ── conclusions：约 800-1500 字 ──
  const topTopic = input.aggregates.topicDistribution[0];
  const topDistrict = input.aggregates.districtDistribution[0];
  const sortedTiers = [...input.aggregates.mediaTierDistribution].sort(
    (a, b) => b.count - a.count,
  );
  const topTier = sortedTiers.find((t) => t.count > 0) ?? null;
  const trend = input.aggregates.dailyTrend;
  const trendSummary =
    trend.length > 0
      ? `自 ${trend[0]!.date} 至 ${trend.at(-1)!.date}，单日报道量在 ${Math.min(
          ...trend.map((d) => d.count),
        )} 至 ${Math.max(...trend.map((d) => d.count))} 条之间波动`
      : "时间趋势数据缺失";

  const conclusionParts: string[] = [];

  conclusionParts.push(
    topTopic
      ? `数据显示，主题分布上${topTopic.topicName}最为突出，共 ${topTopic.count} 条（占 ${topTopic.percentage}%），表明该主题在所考察时间窗内具有显著传播热度，是本研究范围内最受关注的议题方向。`
      : `数据显示，所选时间窗内未形成明显的主题集中度，各议题报道密度相对均衡，无显著热点。`,
  );

  conclusionParts.push(
    topDistrict
      ? `区县分布上，${topDistrict.districtName}报道密度最高，共 ${topDistrict.count} 条（占 ${topDistrict.percentage}%），反映出该区域在所选议题中的关注度居于前列，可能与其在所选议题领域的政策动作或事件密度相关。`
      : `区县分布上，本研究范围内未形成明显的区域集中度，各区县报道密度较为均衡。`,
  );

  conclusionParts.push(
    topTier
      ? `媒体层级方面，${topTier.tier}媒体报道量为 ${topTier.count} 条（占 ${topTier.percentage}%），构成本议题主要的报道层级；不同层级媒体的报道分化反映出议题在不同传播圈层的覆盖差异。`
      : `媒体层级方面，本研究范围内各层级媒体报道相对均衡，未形成显著的层级偏向。`,
  );

  conclusionParts.push(
    `时间趋势上，${trendSummary}，呈现出阶段性传播特征；单日报道量的波动反映了议题在所选时间窗内的传播强度起伏。`,
  );

  conclusionParts.push(
    `综上，所采集数据在主题、区县、媒体层级与时间分布上均呈现出较为明显的差异化特征，为后续深度研究提供了可靠的量化基础；建议结合具体议题语境与政策背景进一步开展针对性分析。`,
  );

  let conclusions = conclusionParts.join("\n\n");
  // 兜底：若仍不足 500，重复补充第 5 段
  const concPad =
    "本研究的量化数据可作为新闻传播学相关研究的基础参考，建议结合定性分析方法进一步深入挖掘议题传播机理。";
  while (conclusions.length < 500) {
    conclusions = conclusions + "\n\n" + concPad;
  }
  if (conclusions.length > 2000) conclusions = conclusions.slice(0, 2000);

  return {
    background,
    brief_rewrite: brief,
    conclusions,
  };
}

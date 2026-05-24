/**
 * Viral Attribution AI Skill —— 给单条爆款内容打"为什么爆"标签 + 详细分析。
 *
 * 两个核心函数：
 *   - analyzeViralContent({ item, accountContext, peerItems }) → 单条内容归因
 *   - distillPatternsAndTips({ attributions, accountContext }) → 共性规律 + 运营建议
 *
 * AI SDK v6：generateText + Output.object（v6 已移除 generateObject）。
 * 模型走 model-router 的 content_analysis 类别（默认 DeepSeek，temp 0.4）。
 */

import { generateText, Output } from "ai";
import { z } from "zod/v4";
import { getLanguageModel, resolveModelConfig } from "@/lib/agent/model-router";
import {
  VIRAL_TAGS,
  viralTagsPromptHint,
  type ViralTag,
} from "./viral-tags";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const viralAttributionSchema = z.object({
  /** 一句话核心爆点（用在 RankingCard 黄色 callout） */
  whyViralSummary: z.string().min(15).max(120),
  /** 2-3 个核心标签（必须从字典中选；超出字典的标签会被过滤） */
  primaryTags: z.array(z.string()).min(1).max(3),
  /** 0-3 个辅助标签 */
  secondaryTags: z.array(z.string()).min(0).max(3),
  /** 详细分析（300-700 字，可用 **加粗** *斜体* 与段落 \n\n） */
  attributionMarkdown: z.string().min(200).max(2000),
  /** 5 维度评分 0-100 */
  dimensionBreakdown: z.object({
    topicScore: z.number().min(0).max(100),
    emotionScore: z.number().min(0).max(100),
    structureScore: z.number().min(0).max(100),
    timingScore: z.number().min(0).max(100),
    interactionScore: z.number().min(0).max(100),
  }),
});

export type ViralAttribution = z.infer<typeof viralAttributionSchema>;

export const patternsAndTipsSchema = z.object({
  /** 6 条共性规律 */
  patterns: z
    .array(
      z.object({
        dimension: z.string().min(2).max(20),
        rule: z.string().min(20).max(300),
      }),
    )
    .min(3)
    .max(8),
  /** 5 条运营建议 */
  recommendations: z
    .array(
      z.object({
        title: z.string().min(4).max(40),
        body: z.string().min(20).max(300),
      }),
    )
    .min(3)
    .max(8),
  /** Cover 一句话本期速读 */
  executiveSummary: z.string().min(30).max(200),
});

export type PatternsAndTips = z.infer<typeof patternsAndTipsSchema>;

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface ViralContentInput {
  title: string;
  summary?: string;
  publishedAt?: string | null;
  likes: number;
  comments: number;
  favorites: number;
  shares: number;
  views?: number;
  compositeScore: number;
}

export interface AccountContext {
  name: string;
  platform: string;
  tier?: string;
  region?: string;
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const ATTRIBUTION_SYSTEM_PROMPT = `你是「社交媒体爆款归因分析师」，专门解释一条视频/帖子为什么能成为账号当期的爆款。

输出要求：

1. **whyViralSummary**：一句话核心爆点（15-120 字），用类似 "「身份反差 + 接机仪式感」单条占当日 62% 总互动" 这种风格，要有数据点。

2. **primaryTags** / **secondaryTags**：从下方标签词表中选。每个标签都必须严格匹配词表，禁止生成词表外的新词。primary 2-3 个最核心，secondary 0-3 个辅助。

可用标签词表：
${viralTagsPromptHint()}

3. **attributionMarkdown**：300-700 字，三段结构：
   - 第一段：爆款核心（标题用 **关键词** 加粗，主张用 *斜体* 强调一次）。说清"爆"的本质是什么。
   - 第二段：选一个最突出的指标做切片分析（如"转发 413（全场最高）"），用数据解释为什么这个指标特别突出。
   - 第三段：标题结构 / 发布时间 / 评论质量 / 受众匹配中选 1-2 个维度补充分析。

4. **dimensionBreakdown**：5 维度 0-100 打分，相对账号当期 peerItems 评分：
   - topicScore：选题（话题锚点强度、稀缺性、关注度）
   - emotionScore：情感（情绪触发强度、情感浓度）
   - structureScore：结构（标题反转、悬念、神回复、三段式）
   - timingScore：时机（发布窗口与目标受众活跃高峰的匹配度）
   - interactionScore：互动（评论质量、转发利他性、收藏二次价值）

风格要求：
- 中文。专业冷峻、有数据感，参考"参考媒体的数据分析报告"风格。
- 不要客套，直入分析。`;

const DISTILL_SYSTEM_PROMPT = `你是「账号运营策略师」，根据本期账号 Top N 爆款的归因结果，提炼**共性规律**和**可执行的运营建议**。

输出要求：

1. **executiveSummary**：30-200 字一句话本期速读（cover 区域用）。突出本期最关键的 1-2 条结论，要有数字。
   例："昨日全天 19 条更新，宇树机甲与女骑手遮号牌两条强反转 / 强讨论内容驱动了 60% 以上传播；亲子教育与名人议题持续稳产。"

2. **patterns**：3-8 条共性规律（标准 6 条）。每条：
   - dimension：维度名 2-20 字（如"话题锚点"/"反转结构"/"利他性转发"/"评论区运营"/"发布时间"）
   - rule：20-300 字规律描述。必须引用具体案例数字（如"反转结构比平铺直叙的资讯类内容传播效率高 3 倍以上"）。

3. **recommendations**：3-8 条建议（标准 5 条）。每条：
   - title：4-40 字标题（如"建立科技话题快速响应机制"）
   - body：20-300 字正文。给出具体行动而非空话；可引用本期案例。

风格要求：
- 中文。每条规律 / 建议都要能拍板执行，禁止"加强 / 注重 / 优化"这种空词。
- 直接输出 JSON，禁止前后附加解释。`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * 给单条内容做爆款归因。会限定 LLM 只从 VIRAL_TAGS 字典里选 tag。
 */
export async function analyzeViralContent(input: {
  item: ViralContentInput;
  accountContext: AccountContext;
  peerItems: ViralContentInput[];
}): Promise<ViralAttribution> {
  const { item, accountContext, peerItems } = input;

  const userPayload = JSON.stringify({
    account: accountContext,
    targetItem: {
      title: item.title,
      summary: item.summary ?? "",
      publishedAt: item.publishedAt,
      metrics: {
        likes: item.likes,
        comments: item.comments,
        favorites: item.favorites,
        shares: item.shares,
        views: item.views,
        compositeScore: item.compositeScore,
      },
    },
    peerItemsForBaseline: peerItems.slice(0, 20).map((p) => ({
      title: p.title,
      metrics: {
        likes: p.likes,
        comments: p.comments,
        favorites: p.favorites,
        shares: p.shares,
        compositeScore: p.compositeScore,
      },
    })),
  });

  const modelConfig = resolveModelConfig(["content_analysis"], {
    temperature: 0.4,
    maxTokens: 4096,
  });

  const { output } = await generateText({
    model: getLanguageModel(modelConfig),
    system: ATTRIBUTION_SYSTEM_PROMPT,
    prompt: userPayload,
    output: Output.object({ schema: viralAttributionSchema }),
    temperature: modelConfig.temperature,
    maxOutputTokens: modelConfig.maxTokens,
  });

  return sanitizeTags(output);
}

/**
 * 基于一批 ViralAttribution，蒸馏共性规律 + 运营建议 + 速读摘要。
 */
export async function distillPatternsAndTips(input: {
  attributions: Array<ViralAttribution & { title: string }>;
  accountContext: AccountContext;
  periodLabel: string;
  totalKpis: {
    videos: number;
    likes: number;
    comments: number;
    favorites: number;
    shares: number;
  };
}): Promise<PatternsAndTips> {
  const userPayload = JSON.stringify({
    account: input.accountContext,
    periodLabel: input.periodLabel,
    totalKpis: input.totalKpis,
    topAttributions: input.attributions.map((a) => ({
      title: a.title,
      whyViralSummary: a.whyViralSummary,
      primaryTags: a.primaryTags,
      secondaryTags: a.secondaryTags,
      dimensionBreakdown: a.dimensionBreakdown,
    })),
  });

  const modelConfig = resolveModelConfig(["data_analysis"], {
    temperature: 0.5,
    maxTokens: 4096,
  });

  const { output } = await generateText({
    model: getLanguageModel(modelConfig),
    system: DISTILL_SYSTEM_PROMPT,
    prompt: userPayload,
    output: Output.object({ schema: patternsAndTipsSchema }),
    temperature: modelConfig.temperature,
    maxOutputTokens: modelConfig.maxTokens,
  });

  return output;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VIRAL_TAG_LABELS = new Set<string>(VIRAL_TAGS.map((t: ViralTag) => t.label));

/**
 * 把 LLM 返回的 tags 与字典对齐，过滤掉超出字典的标签。
 * Phase 2 上线后第一周观察 LLM 输出，如果发现高频的有效新标签，再补到 viral-tags.ts。
 */
function sanitizeTags(attr: ViralAttribution): ViralAttribution {
  const primary = attr.primaryTags.filter((t) => VIRAL_TAG_LABELS.has(t));
  const secondary = attr.secondaryTags.filter((t) => VIRAL_TAG_LABELS.has(t));
  // 兜底：如果 primary 被全过滤光，至少保留 LLM 原始第一个未在字典里的标签
  if (primary.length === 0 && attr.primaryTags.length > 0) {
    primary.push(attr.primaryTags[0]);
  }
  return { ...attr, primaryTags: primary, secondaryTags: secondary };
}

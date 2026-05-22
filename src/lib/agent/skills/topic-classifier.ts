/**
 * topic_classifier — 海外热榜分类
 *
 * 把一批 hot_topics 标题/摘要丢给 LLM，返回每条的分类（食/萌宠/国内科技/other）+ 置信度 + 理由。
 * 用于「海外热榜搬运」场景的 step 2: classify_overseas_categories（小雷负责）。
 *
 * AI SDK v6 — uses `generateText({ output: Output.object({ schema }) })`
 * （v6 移除了 generateObject）。
 *
 * Spec: /Users/zhuyu/.claude/plans/tophub-x-instagram-twitter-sunny-papert.md §3.2
 */

import { generateText, Output } from "ai";
import { z } from "zod/v4";
import { getLanguageModel, resolveModelConfig } from "../model-router";

// ---------------------------------------------------------------------------
// Zod schema —— 严格 4 类枚举 + 0~1 confidence + 必填 reason
// ---------------------------------------------------------------------------

export const OVERSEAS_CATEGORY_ENUM = [
  "food",
  "pets",
  "domestic_tech",
  "other",
] as const;

export type OverseasCategory = (typeof OVERSEAS_CATEGORY_ENUM)[number];

const CategoryEnumSchema = z.enum(OVERSEAS_CATEGORY_ENUM);

const ClassifiedItemSchema = z.object({
  id: z.string().min(1),
  category: CategoryEnumSchema,
  confidence: z.number().min(0).max(1),
  reason: z.string().min(2).max(200),
});

const TopicClassifierOutputSchema = z.object({
  results: z.array(ClassifiedItemSchema),
});

export type TopicClassifierResult = z.infer<typeof ClassifiedItemSchema>;

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface TopicInput {
  id: string;
  title: string;
  summary?: string;
}

export interface TopicClassifierInput {
  topics: TopicInput[];
}

export interface TopicClassifierOutput {
  results: TopicClassifierResult[];
}

// ---------------------------------------------------------------------------
// System prompt —— 分类标准明确，与 plan §3.2 / SKILL.md 一致
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `你是「海外热榜分类员」。从中国热榜数据中筛出 3 类对海外读者有吸引力且无政策风险的话题：

**food（美食）**：餐饮、菜谱、食材、零食、饮品、料理、美食 vlog、地方小吃、外卖、饮食文化。
**pets（萌宠）**：猫、狗、鸟、兔、仓鼠等家养宠物，宠物视频、宠物用品、宠物医疗、撸宠互动。
**domestic_tech（国内科技）**：中国大陆的科技公司 / 产品 / 芯片 / AI / 互联网 / 新能源车 / 航天 / 机器人。必须是「国内」（中国大陆），海外科技公司、海外产品归 other。
**other**：以上 3 类都不算的，包括但不限于：时政、社会新闻、娱乐八卦、体育、影视综艺、教育、房产、股市、突发事件、海外动态、健康养生（非餐饮类）。

分类规则：
1. 每条必须给一个 category（4 选 1），不许多选。
2. confidence 是 0~1 浮点数，反映你对分类正确性的把握。
3. 模糊难判（如"网红探店餐厅出事故"既涉及 food 也涉及社会新闻）→ confidence < 0.7 时归 other。
4. reason 简短中文（≤ 100 字）：说出关键判断词，例如"标题含'宠物医院'→ pets"。
5. 输出顺序与输入顺序一致，每条都要给出（不能省略）。
6. 严格按 schema 输出 JSON，不要附加任何解释文字。`;

// ---------------------------------------------------------------------------
// Skill function
// ---------------------------------------------------------------------------

/**
 * 给一批 topic 打海外分类标签。
 *
 * @example
 * const out = await classifyOverseasTopics({
 *   topics: [
 *     { id: "t1", title: "成都串串香夜市排队 3 小时", summary: "..." },
 *     { id: "t2", title: "华为 Mate 70 Pro 卫星通信实测" },
 *   ],
 * });
 * // out.results[0] = { id:"t1", category:"food", confidence:0.95, reason:"..." }
 */
export async function classifyOverseasTopics(
  input: TopicClassifierInput,
): Promise<TopicClassifierOutput> {
  if (!input.topics || input.topics.length === 0) {
    return { results: [] };
  }

  // 序列化 input，让 LLM 看到结构化标题列表
  const userPayload = JSON.stringify({
    topics: input.topics.map((t) => ({
      id: t.id,
      title: t.title,
      summary: t.summary ?? "",
    })),
  });

  const modelConfig = resolveModelConfig(["content_analysis"], {
    temperature: 0.2,
    maxTokens: 4096,
  });

  const { output } = await generateText({
    model: getLanguageModel(modelConfig),
    system: SYSTEM_PROMPT,
    prompt: userPayload,
    output: Output.object({ schema: TopicClassifierOutputSchema }),
    temperature: modelConfig.temperature,
    maxOutputTokens: modelConfig.maxTokens,
  });

  // 兜底：LLM 返回结果数量与输入不一致时，缺失的条目补 other
  const returnedIds = new Set(output.results.map((r) => r.id));
  const missing: TopicClassifierResult[] = input.topics
    .filter((t) => !returnedIds.has(t.id))
    .map((t) => ({
      id: t.id,
      category: "other" as const,
      confidence: 0,
      reason: "LLM 未返回该条分类结果，兜底归为 other",
    }));

  return {
    results: [...output.results, ...missing],
  };
}

/**
 * topic_classifier — 海外热榜分类
 *
 * 把一批 hot_topics 标题/摘要丢给 LLM，返回每条的分类（动态运行时构造 enum）+ 置信度 + 理由。
 * 用于「海外热榜搬运」场景的 step 2: classify_overseas_categories（小雷负责）。
 *
 * AI SDK v6 — uses `generateText({ output: Output.object({ schema }) })`
 * （v6 移除了 generateObject）。
 *
 * M3：schema 改运行时构造，由调用方传入 enabledCategories（用户在工作流编辑器选的分类）。
 * 总是追加 "other" 兜底类。Phase 4 通过 sourceUrl 透传字段保留原文链接。
 *
 * Spec: docs/superpowers/specs/2026-05-26-overseas-hot-trend-end-to-end-design.md §4.3 M3
 */

import { generateText, Output } from "ai";
import { z } from "zod/v4";
import { getLanguageModel, resolveModelConfig } from "../model-router";

// ---------------------------------------------------------------------------
// Zod schema 改运行时构造（M3）
// ---------------------------------------------------------------------------

/**
 * @deprecated 仅保留兼容；新代码用动态 enabledCategories 参数。
 * 历史海外热榜固定 4 类的常量，保留向后兼容（无 live consumer）。
 */
export const OVERSEAS_CATEGORY_ENUM = [
  "food",
  "pets",
  "domestic_tech",
  "other",
] as const;

/** @deprecated 仅保留兼容；新代码用 string（动态 enum） */
export type OverseasCategory = (typeof OVERSEAS_CATEGORY_ENUM)[number];

function buildClassifierSchema(categoryValues: string[]) {
  // 总是追加 "other" 作为兜底类
  const enumValues: [string, ...string[]] = ["other", ...categoryValues];
  return z.object({
    results: z.array(
      z.object({
        id: z.string().min(1),
        category: z.enum(enumValues),
        confidence: z.number().min(0).max(1),
        reason: z.string().min(2).max(200),
        sourceUrl: z.string().optional(), // ← Phase 4 透传字段（本 task 留口）
        title: z.string().optional(),     // ← A.1.1: echo input.title
        summary: z.string().optional(),   // ← A.1.1: echo input.summary
      }),
    ),
  });
}

// ---------------------------------------------------------------------------
// Input / Output types
// ---------------------------------------------------------------------------

export interface TopicInput {
  id: string;
  title: string;
  summary?: string;
  sourceUrl?: string; // ← Phase 4 透传字段
}

export interface CategoryOption {
  value: string;
  label: string;
}

export interface TopicClassifierInput {
  topics: TopicInput[];
  enabledCategories: CategoryOption[]; // ← M3: 必填
}

export interface TopicClassifierResult {
  id: string;
  category: string; // 动态 enum，运行时确定
  confidence: number;
  reason: string;
  sourceUrl?: string;
  title?: string;     // ← A.1.1: echo input.title
  summary?: string;   // ← A.1.1: echo input.summary
}

export interface TopicClassifierOutput {
  results: TopicClassifierResult[];
}

// ---------------------------------------------------------------------------
// System prompt —— 按 enabledCategories 动态拼接
// ---------------------------------------------------------------------------

function buildSystemPrompt(categories: { value: string; label: string }[]): string {
  const lines = categories
    .map(
      (c) =>
        `**${c.value}（${c.label}）**：根据标题/摘要的语义判断；模糊不清归 other。`,
    )
    .join("\n");
  return `你是「话题分类员」。从输入的中文热榜数据中筛出下列类别（不属于则归 other）：

${lines}

分类规则：
1. **id 字段必须 1:1 echo 输入的 id 字段值** —— 这是关联回 topic 的唯一键，**绝对不许编造、缩写、替换或归并**（曾出现把 50 条全部输出 id="crypto" 的事故，导致全部归 missing 兜底）。每条输出的 id 必须严格等于输入数组对应位置的 input.id 字符串。
2. 每条必须给一个 category（n+1 选 1，n 是上面列表条数，+1 是 other），不许多选。
3. confidence 是 0~1 浮点数，反映你对分类正确性的把握。
4. 模糊难判 → confidence < 0.7 时归 other。
5. reason 简短中文（≤ 100 字）：说出关键判断词。
6. 输出顺序与输入顺序一致，每条都要给出（不能省略）。
7. **若输入条目带 sourceUrl 字段，输出必须原样回填，绝对不改 / 不删**。
8. **title / summary 透传**：输入 topic 的 title 必须原样 echo 到输出；summary 若有也一并 echo（让下游翻译时不用反查）。
9. 严格按 schema 输出 JSON，不要附加任何解释文字。

错误示范（禁止）：
- 输入 [{"id":"t1",...},{"id":"t2",...}] → 输出 [{"id":"crypto",...},{"id":"crypto",...}] ❌
- 输入 [{"id":"weibo_1",...}] → 输出 [{"id":"1",...}] ❌（缩写）

正确示范：
- 输入 [{"id":"weibo_1","title":"X",...}] → 输出 [{"id":"weibo_1","title":"X","category":"food",...}] ✅`;
}

// ---------------------------------------------------------------------------
// Skill function
// ---------------------------------------------------------------------------

/**
 * 给一批 topic 打分类标签（运行时确定分类集合）。
 *
 * @example
 * const out = await classifyOverseasTopics({
 *   topics: [
 *     { id: "t1", title: "成都串串香夜市排队 3 小时", summary: "..." },
 *     { id: "t2", title: "小米 SU7 续航实测", sourceUrl: "https://..." },
 *   ],
 *   enabledCategories: [
 *     { value: "food", label: "美食" },
 *     { value: "auto", label: "汽车" },
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
  if (!input.enabledCategories || input.enabledCategories.length === 0) {
    throw new Error("topic_classifier 需要 enabledCategories 至少 1 项");
  }

  const categoryValues = input.enabledCategories.map((c) => c.value);
  const schema = buildClassifierSchema(categoryValues);

  const userPayload = JSON.stringify({
    topics: input.topics.map((t) => ({
      id: t.id,
      title: t.title,
      summary: t.summary ?? "",
      sourceUrl: t.sourceUrl ?? null,
    })),
  });

  const modelConfig = resolveModelConfig(["content_analysis"], {
    temperature: 0.2,
    maxTokens: 4096,
  });

  const { output } = await generateText({
    model: getLanguageModel(modelConfig),
    system: buildSystemPrompt(input.enabledCategories),
    prompt: userPayload,
    output: Output.object({ schema }),
    temperature: modelConfig.temperature,
    maxOutputTokens: modelConfig.maxTokens,
  });

  // 兜底：缺失条目归 other
  const returnedIds = new Set(output.results.map((r) => r.id));
  const missing: TopicClassifierResult[] = input.topics
    .filter((t) => !returnedIds.has(t.id))
    .map((t) => ({
      id: t.id,
      category: "other" as const,
      confidence: 0,
      reason: "LLM 未返回该条分类结果，兜底归为 other",
      sourceUrl: t.sourceUrl,
      title: t.title,     // ← A.1.1: 兜底回填 title
      summary: t.summary, // ← A.1.1: 兜底回填 summary
    }));

  // sourceUrl / title / summary 兜底回填（如果 LLM 漏了字段）
  const filled: TopicClassifierResult[] = output.results.map((r) => {
    const inputTopic = input.topics.find((t) => t.id === r.id);
    return {
      ...r,
      sourceUrl: r.sourceUrl ?? inputTopic?.sourceUrl,
      title: r.title ?? inputTopic?.title,       // ← A.1.1
      summary: r.summary ?? inputTopic?.summary, // ← A.1.1
    };
  });

  return { results: [...filled, ...missing] };
}

// ---------------------------------------------------------------------------
// 别名 export：dispatch / renderer 用 ClassifiedItem 更语义化
// ---------------------------------------------------------------------------
export type ClassifiedItem = TopicClassifierResult;

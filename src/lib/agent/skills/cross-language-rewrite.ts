/**
 * cross_language_rewrite — 中英本地化改写
 *
 * 把中文稿件改写成适合 X / Instagram / Facebook 等海外社交平台的英文版本。
 * 用于「海外热榜搬运」场景的 step 3: deep_read_and_translate（小文负责）。
 *
 * 关键设计：**不是直译，是本地化改写**：
 * - 调整文化引用（中文谚语 → 英文等价表达）
 * - 解释中国地名 / 品牌 / 名人（不假设西方读者认识）
 * - 语气适配海外受众（更直白、更短句、可加 emoji）
 *
 * AI SDK v6 — uses `generateText({ output: Output.object({ schema }) })`.
 *
 * Spec: /Users/zhuyu/.claude/plans/tophub-x-instagram-twitter-sunny-papert.md §3.2
 */

import { generateText, Output } from "ai";
import { z } from "zod/v4";
import { getLanguageModel, resolveModelConfig } from "../model-router";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const TARGET_LANGUAGE_ENUM = ["en"] as const;

export type TargetLanguage = (typeof TARGET_LANGUAGE_ENUM)[number];

// CATEGORY_TONE_DEFAULTS 保留 3 个内置语气模板。新加的分类（用户在工作流
// 编辑器里加的）会走通用语气 fallback。这 3 个 key 必须跟 seed-builtin-workflows
// 里 hot_topics_overseas_en 的默认 categories 保持同步。
const CATEGORY_TONE_DEFAULTS: Record<string, string> = {
  food: "美食内容用感官化语言（taste / aroma / crispy / fluffy），多用 emoji（🍜🥢🌶️），可以幽默",
  pets: "萌宠内容用 wholesome / heartwarming 口吻，emoji 偏温馨（🐱🐶🐾✨），鼓励互动（'Drop a 🐾 if you agree'）",
  domestic_tech:
    "国内科技内容客观直白，避免过度营销词，可以加规格数字，emoji 克制（🚀💡🔋）",
};

const RewrittenArticleSchema = z.object({
  id: z.string().min(1),
  title_en: z.string().min(1).max(140),
  body_en: z.string().min(10),
  hashtags: z.array(z.string().min(2).max(40)).min(3).max(7),
  cultural_notes: z.string().max(400).optional(),
});

const CrossLanguageRewriteOutputSchema = z.object({
  articles: z.array(RewrittenArticleSchema),
});

export type RewrittenArticle = z.infer<typeof RewrittenArticleSchema>;

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface ArticleInput {
  id: string;
  title: string;
  body: string;
  tags?: string[];
}

export interface CrossLanguageRewriteInput {
  articles: ArticleInput[];
  targetLanguage: TargetLanguage;
  categoryHint?: string;       // ← enum 改 string (M3)
}

export interface CrossLanguageRewriteOutput {
  articles: RewrittenArticle[];
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildSystemPrompt(categoryHint?: string): string {
  const toneText = categoryHint
    ? (CATEGORY_TONE_DEFAULTS[categoryHint] ?? "保持简洁直白，无特定语气倾向")
    : "";
  const toneHint = categoryHint
    ? `\n本批稿件属于 **${categoryHint}** 类别。语气定位：${toneText}。`
    : "";

  return `你是「跨语言改写员」，负责把中文稿件改写成发布在 X / Instagram / Facebook 等海外社交平台的英文版本。

**核心原则：本地化改写，不是逐句直译。**

1. **文化适配**：
   - 中文谚语 / 俗语 → 找英文等价表达（如"打铁还需自身硬" → "You can't pour from an empty cup"），找不到就改成直白说法。
   - 中文流行梗 / 网络黑话（如"yyds""绝绝子""破防了"）→ 改成英文流行词或直接说意思。
   - 中文敬语 / 谦辞 → 英文直接平等表达。

2. **解释专有名词**：
   - 中国地名（如"成都""鼓楼""798"）→ 第一次出现时加注（"Chengdu, the spicy-food capital of southwest China"）。
   - 中国品牌（如"华为""比亚迪""泡泡玛特"）→ 第一次出现时加 1 句定位。
   - 中国名人 / 网红 → 加身份描述。
   - 不假设西方读者认识任何中国背景信息。

3. **海外社交语气**：
   - 句子短、直白、有钩子（前 10 词必须抓人）。
   - 适度 emoji（每段 1-3 个，不堆叠）。
   - 标题（title_en）≤ 140 字符，适配 X / IG caption 开头。
   - 正文（body_en）段落短，每段 1-3 句。
   - 避免中式英语（chinglish）。

4. **保留事实**：
   - 不许新增中文原稿没说的事实。
   - 数字 / 时间 / 地点必须保留准确。
   - 模糊的中文表达（如"很多人"）→ 不要瞎写成"millions"。

5. **hashtags**：3-7 个，全英文，常用形式（#FoodieLife / #ChinaTech / #PetTok），不要中文拼音 hashtag。

6. **cultural_notes**（可选）：≤ 400 字，简短记录你做过哪些本地化决策（"把'秋天的第一杯奶茶'改成 'pumpkin-spice-latte moment'"），方便编辑复核。

7. 严格按 schema 输出 JSON，不要附加任何解释文字。${toneHint}`;
}

// ---------------------------------------------------------------------------
// Skill function
// ---------------------------------------------------------------------------

/**
 * 把中文稿件批量改写成海外社交平台用的英文版本。
 *
 * @example
 * const out = await crossLanguageRewriteArticles({
 *   articles: [{ id: "a1", title: "成都串串香排队 3 小时", body: "..." }],
 *   targetLanguage: "en",
 *   categoryHint: "food",
 * });
 * // out.articles[0] = { id:"a1", title_en:"...", body_en:"...", hashtags:[...] }
 */
export async function crossLanguageRewriteArticles(
  input: CrossLanguageRewriteInput,
): Promise<CrossLanguageRewriteOutput> {
  if (!input.articles || input.articles.length === 0) {
    return { articles: [] };
  }

  if (input.targetLanguage !== "en") {
    throw new Error(
      `cross_language_rewrite 当前仅支持 targetLanguage='en'，收到：${input.targetLanguage}`,
    );
  }

  const userPayload = JSON.stringify({
    target_language: input.targetLanguage,
    category_hint: input.categoryHint ?? null,
    articles: input.articles.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      tags: a.tags ?? [],
    })),
  });

  // content_gen 类别（温度高一点，maxTokens 8192）
  const modelConfig = resolveModelConfig(["content_gen"], {
    temperature: 0.7,
    maxTokens: 8192,
  });

  const { output } = await generateText({
    model: getLanguageModel(modelConfig),
    system: buildSystemPrompt(input.categoryHint),
    prompt: userPayload,
    output: Output.object({ schema: CrossLanguageRewriteOutputSchema }),
    temperature: modelConfig.temperature,
    maxOutputTokens: modelConfig.maxTokens,
  });

  // 兜底：缺漏的稿件原样回填（标记需人工处理）
  const returnedIds = new Set(output.articles.map((a) => a.id));
  const missing: RewrittenArticle[] = input.articles
    .filter((a) => !returnedIds.has(a.id))
    .map((a) => ({
      id: a.id,
      title_en: `[NEEDS REVIEW] ${a.title}`,
      body_en: `[NEEDS REVIEW] LLM did not return a rewrite for this article. Original Chinese body preserved:\n\n${a.body}`,
      hashtags: ["#NeedsReview", "#FromChina", "#Draft"],
      cultural_notes: "LLM 未返回该条改写，已兜底标记 NEEDS REVIEW。",
    }));

  return {
    articles: [...output.articles, ...missing],
  };
}

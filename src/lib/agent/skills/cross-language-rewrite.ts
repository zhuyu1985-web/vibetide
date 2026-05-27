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

// schema 边界放宽:实测 qwen3-max 对严格上限不太敏感(经常输出 title_en
// 超 140 / cultural_notes 超 400 / hashtags 少于 3),严格 schema 一拒就
// 整批失败。放宽到合理范围,质量评估交 quality_review 步骤做。
const RewrittenArticleSchema = z.object({
  id: z.string().min(1),
  sourceTopicId: z.string().min(1),
  variantIndex: z.number().int().min(0).max(2),
  sourceUrl: z.string().optional(),
  category: z.string().optional(),
  title_en: z.string().min(1).max(280),               // 140 → 280
  body_en: z.string().min(10),
  hashtags: z.array(z.string().min(1).max(60)).min(0).max(12),  // 3-7 → 0-12,允许 LLM 给 0 个
  cultural_notes: z.string().max(1000).optional(),    // 400 → 1000
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
  sourceUrl?: string;   // ← Phase 4 新
  category?: string;    // ← Phase 4 新（Phase 3 topic_classifier 输出透传）
}

export interface CrossLanguageRewriteInput {
  articles: ArticleInput[];
  targetLanguage: TargetLanguage;
  categoryHint?: string;       // ← enum 改 string (M3)
  variantsPerTopic?: 1 | 2 | 3;  // ← Phase 4 新，默认 1
}

export interface CrossLanguageRewriteOutput {
  articles: RewrittenArticle[];
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildSystemPrompt(categoryHint?: string, variantsPerTopic: number = 1): string {
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

7. 严格按 schema 输出 JSON，不要附加任何解释文字。

8. **variantsPerTopic 引导**：
   - 入参 variants_per_topic = ${variantsPerTopic}。
   - = 1：每条 input 生成 1 篇英文稿，id = "<input_id>-v0"。
   - = 2：每条生成 2 篇明显不同的版本（variant 0 = headline-driven 短版；variant 1 = storytelling 中版）。id = "<input_id>-v0" / "<input_id>-v1"。
   - = 3：再加 variant 2 = analytical 长版，id = "<input_id>-v2"。
   - 同一 source 的 N 篇必须**明显不同**——不同切入角度、不同钩子、不同长度，不是改几个字。

9. **sourceUrl 透传**：
   - 输入每条 article 若带 sourceUrl，输出该 input 对应的所有 variant 都必须原样回填 sourceUrl。
   - **绝对不许编造 / 修改 sourceUrl。** 入参没的也不能填假的。

10. **sourceTopicId / variantIndex**：每条输出必须有这两个字段。sourceTopicId = 原 input.id；variantIndex 从 0 起。${toneHint}`;
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
/** 单条 body 截断字数 —— Jina 抓的全文可能 5000+ 字,塞 8 条进一次 prompt
 *  上下文吃满,qwen3-max 输出 JSON 经常被 maxOutputTokens 截断。2500 字够
 *  LLM 理解上下文,又不挤爆 token 预算。 */
const BODY_TRUNCATE_CHARS = 2500;

/** 一批最多塞这么多 article 给 LLM —— 实测 8 条 × 2500 字 body 输出稳定,
 *  超过会有概率 maxOutputTokens 截断导致 schema 校验失败。 */
const BATCH_SIZE = 8;

/** 并发上限,避免触发 dashscope 频率限制 */
const BATCH_CONCURRENCY = 2;

async function rewriteBatch(
  articles: ArticleInput[],
  targetLanguage: TargetLanguage,
  categoryHint: string | undefined,
  variantsPerTopic: number,
): Promise<RewrittenArticle[]> {
  const userPayload = JSON.stringify({
    target_language: targetLanguage,
    category_hint: categoryHint ?? null,
    variants_per_topic: variantsPerTopic,
    articles: articles.map((a) => ({
      id: a.id,
      title: a.title,
      // body 截断,防止单条全文吃爆 token 预算
      body:
        a.body.length > BODY_TRUNCATE_CHARS
          ? a.body.slice(0, BODY_TRUNCATE_CHARS) + "...(truncated)"
          : a.body,
      tags: a.tags ?? [],
      sourceUrl: a.sourceUrl ?? null,
      category: a.category ?? null,
    })),
  });

  const modelConfig = resolveModelConfig(["content_gen"], {
    temperature: 0.7,
    maxTokens: 8192,
  });

  const { output } = await generateText({
    model: getLanguageModel(modelConfig),
    system: buildSystemPrompt(categoryHint, variantsPerTopic),
    prompt: userPayload,
    output: Output.object({ schema: CrossLanguageRewriteOutputSchema }),
    temperature: modelConfig.temperature,
    maxOutputTokens: modelConfig.maxTokens,
  });

  return output.articles;
}

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

  const variantsPerTopic = input.variantsPerTopic ?? 1;

  // 分批 + 并发 —— 单批最多 8 条 article × 2500 字 body,实测稳定输出 JSON。
  // 单批失败不连累其他批(Promise.allSettled 而非 all)。
  const batches: ArticleInput[][] = [];
  for (let i = 0; i < input.articles.length; i += BATCH_SIZE) {
    batches.push(input.articles.slice(i, i + BATCH_SIZE));
  }

  const allResults: RewrittenArticle[] = [];
  const failedBatchIds = new Set<string>();
  for (let i = 0; i < batches.length; i += BATCH_CONCURRENCY) {
    const slice = batches.slice(i, i + BATCH_CONCURRENCY);
    const settled = await Promise.allSettled(
      slice.map((batch) =>
        rewriteBatch(batch, input.targetLanguage, input.categoryHint, variantsPerTopic),
      ),
    );
    settled.forEach((res, idx) => {
      if (res.status === "fulfilled") {
        allResults.push(...res.value);
      } else {
        console.warn(
          `[cross_language_rewrite] batch failed, will fallback to NEEDS REVIEW:`,
          res.reason,
        );
        for (const a of slice[idx]) failedBatchIds.add(a.id);
      }
    });
  }

  // 兜底:缺漏的稿件 + 整批失败的稿件 → 用 [NEEDS REVIEW] 占位入库,
  // 不让整步失败。编辑可在稿件列表手动改写或删除。
  const returnedSourceIds = new Set(allResults.map((a) => a.sourceTopicId));
  const missing: RewrittenArticle[] = input.articles
    .filter((a) => !returnedSourceIds.has(a.id))
    .map((a) => ({
      id: `${a.id}-v0`,
      sourceTopicId: a.id,
      variantIndex: 0,
      sourceUrl: a.sourceUrl,
      category: a.category,
      title_en: `[NEEDS REVIEW] ${a.title}`,
      body_en: `[NEEDS REVIEW] LLM did not return a rewrite for this article. Original Chinese body preserved:\n\n${a.body.slice(0, BODY_TRUNCATE_CHARS)}`,
      hashtags: ["#NeedsReview", "#FromChina", "#Draft"],
      cultural_notes: failedBatchIds.has(a.id)
        ? "该批 LLM 调用失败(JSON 解析错 / schema 拒绝),已兜底标记 NEEDS REVIEW。"
        : "LLM 未返回该条改写,已兜底标记 NEEDS REVIEW。",
    }));

  // sourceUrl 兜底回填 — LLM 漏返时从 input 找 sourceTopicId 对应的原文
  const filled = allResults.map((a) => ({
    ...a,
    sourceUrl: a.sourceUrl ?? input.articles.find((src) => src.id === a.sourceTopicId)?.sourceUrl,
  }));

  return {
    articles: [...filled, ...missing],
  };
}

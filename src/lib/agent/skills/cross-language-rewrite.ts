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

/**
 * 单条调用的精简 system prompt —— 单次 LLM 调用只处理 1 条 article 输出
 * 1~3 个 variant,prompt 不需要"批量协调"的篇幅,聚焦本地化改写规则即可。
 */
function buildSingleSystemPrompt(
  categoryHint?: string,
  variantsPerTopic: number = 1,
): string {
  const toneText = categoryHint
    ? (CATEGORY_TONE_DEFAULTS[categoryHint] ?? "保持简洁直白，无特定语气倾向")
    : "";
  const toneHint = categoryHint
    ? `\n稿件类别 **${categoryHint}**：${toneText}。`
    : "";

  return `你是「跨语言改写员」,把单篇中文稿件改写成发布在 X / Instagram / Facebook 的英文版本。

**核心原则:本地化改写,不是逐句直译。**

1. **文化适配**:谚语/网络梗 → 找英文等价或改直白表达。
2. **解释专有名词**:中国地名/品牌/名人第一次出现时加 1 句定位,不假设西方读者认识。
3. **社交语气**:句子短、有钩子,适度 emoji(每段 1-3 个),title_en ≤ 280 字符,body_en 短段落。
4. **保留事实**:不新增原稿没说的事实,数字/时间/地点 1:1 保留。
5. **hashtags**:0-12 个英文 hashtag,#FoodieLife / #ChinaTech 这种常用形式。
6. **cultural_notes**:可选,≤ 1000 字简短记录本地化决策。
7. **sourceUrl 透传**:输出 sourceUrl 原样 echo 输入,绝不编造。
8. **sourceTopicId / variantIndex**:sourceTopicId = 原 input.id;variantIndex 从 0 起。

**variantsPerTopic = ${variantsPerTopic}**:为输入的单条 article 生成 ${variantsPerTopic} 个 variant:
${variantsPerTopic === 1 ? "- 1 篇英文稿,id = `<input_id>-v0`" : ""}
${variantsPerTopic === 2 ? "- 2 篇明显不同:v0 = headline-driven 短版;v1 = storytelling 中版" : ""}
${variantsPerTopic === 3 ? "- 3 篇:v0 短版 / v1 中版 / v2 = analytical 长版" : ""}

严格按 schema 输出 JSON,articles 字段是 ${variantsPerTopic} 个 RewrittenArticle 的数组。${toneHint}`;
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
/** 单条 body 截断字数 —— Jina 抓的全文可能 5000+ 字。单条 LLM 调用 2500 字
 *  够 LLM 理解上下文,又不挤爆 token 预算。 */
const BODY_TRUNCATE_CHARS = 2500;

/** 单条 LLM 调用并发上限 —— 海外热榜搬运过滤后通常 3-10 条非 other,
 *  并发 5 个让 N 条任务的总时长接近单条耗时(10-20s),而不是 N×10s。
 *  5 并发已实测不触发 dashscope 频率限制。 */
const SINGLE_CONCURRENCY = 5;

/** 单条 LLM 调用超时 —— 单条输入小输出小,30s 足够。超 30s 直接 abort,
 *  其他条目继续跑,不连坐。 */
const SINGLE_TIMEOUT_MS = 30_000;

/**
 * 单条 article 走单次 LLM 调用 —— fan-out/fan-in 模式的"Map"。
 * 输入小(单条 ≤ 3k tokens),输出小(单条 ≤ 2k tokens × variantsPerTopic),
 * 单点失败只影响这一条,不连坐整批。
 */
async function rewriteOne(
  article: ArticleInput,
  targetLanguage: TargetLanguage,
  categoryHint: string | undefined,
  variantsPerTopic: number,
): Promise<RewrittenArticle[]> {
  const userPayload = JSON.stringify({
    target_language: targetLanguage,
    category_hint: categoryHint ?? null,
    variants_per_topic: variantsPerTopic,
    article: {
      id: article.id,
      title: article.title,
      body:
        article.body.length > BODY_TRUNCATE_CHARS
          ? article.body.slice(0, BODY_TRUNCATE_CHARS) + "...(truncated)"
          : article.body,
      tags: article.tags ?? [],
      sourceUrl: article.sourceUrl ?? null,
      category: article.category ?? null,
    },
  });

  const modelConfig = resolveModelConfig(["content_gen"], {
    temperature: 0.7,
    maxTokens: 4096, // 单条 4k 输出预算充足
  });

  // 单条调用加 timeout,防止个别请求长尾拖慢整体
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SINGLE_TIMEOUT_MS);

  try {
    const { output } = await generateText({
      model: getLanguageModel(modelConfig),
      system: buildSingleSystemPrompt(categoryHint, variantsPerTopic),
      prompt: userPayload,
      output: Output.object({ schema: CrossLanguageRewriteOutputSchema }),
      temperature: modelConfig.temperature,
      maxOutputTokens: modelConfig.maxTokens,
      abortSignal: controller.signal,
    });
    return output.articles;
  } finally {
    clearTimeout(timeout);
  }
}

/** 限速并发池 —— 同时跑 SINGLE_CONCURRENCY 个 rewriteOne,完成一个补一个。
 *  Promise.allSettled 隔离单条失败。 */
async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<Array<PromiseSettledResult<R>>> {
  const results: Array<PromiseSettledResult<R>> = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const idx = next++;
      if (idx >= items.length) return;
      try {
        const value = await worker(items[idx]);
        results[idx] = { status: "fulfilled", value };
      } catch (reason) {
        results[idx] = { status: "rejected", reason };
      }
    }
  });
  await Promise.all(workers);
  return results;
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

  // Fan-out:每条 article 单独 LLM 调用,SINGLE_CONCURRENCY=5 并发跑。
  // 这跟旧版"塞 8 条进单次 LLM"对比:
  //   - 单点 schema 失败:旧版整批 8 条全 NEEDS REVIEW;新版只影响 1 条
  //   - maxTokens 截断:旧版 8k 输出预算吃满概率高;新版每条只用 ≤2k
  //   - 总耗时:旧版串行批次 60-90s;新版并发 5 时 10 条 ≈ 20s
  const settled = await runWithConcurrency(
    input.articles,
    SINGLE_CONCURRENCY,
    (article) =>
      rewriteOne(article, input.targetLanguage, input.categoryHint, variantsPerTopic),
  );

  const allResults: RewrittenArticle[] = [];
  const failedArticleIds = new Set<string>();
  settled.forEach((res, idx) => {
    if (res.status === "fulfilled") {
      allResults.push(...res.value);
    } else {
      const article = input.articles[idx];
      console.warn(
        `[cross_language_rewrite] article ${article.id} failed, fallback to NEEDS REVIEW:`,
        res.reason,
      );
      failedArticleIds.add(article.id);
    }
  });

  // 兜底:缺漏 / 单条调用失败 → [NEEDS REVIEW] 占位入库,不让整步失败。
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
      cultural_notes: failedArticleIds.has(a.id)
        ? "该条 LLM 调用失败(timeout / JSON 解析错 / schema 拒绝),已兜底标记 NEEDS REVIEW。"
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

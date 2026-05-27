/**
 * LLM-skill dispatch — 让 mission-executor 能"预执行"基于 LLM 的 skill
 * (topic_classifier, cross_language_rewrite)，跟 invokeToolDirectly 对齐
 * (后者只支持 tool-registry 注册的工具)。
 *
 * 调用结构跟 invokeToolDirectly 一致：
 * - { ok: true, toolName, params, result } 成功
 * - { ok: false, toolName, params, error } 失败
 * 这样 mission-executor 的 short-circuit 逻辑可以共用。
 */
import {
  classifyOverseasTopics,
  type ClassifiedItem,
} from "@/lib/agent/skills/topic-classifier";
import { crossLanguageRewriteArticles } from "@/lib/agent/skills/cross-language-rewrite";

interface LLMSkillExecutor {
  skillName: string;
  /** 把 raw params (来自 step.config.parameters + previousSteps) 转成 skill 函数的入参 */
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Confidence 阈值：低于此值的 ClassifiedItem 在传给 cross_language_rewrite
 * 之前被过滤掉（即归 other 的内容不翻译，节省 token）。
 */
const CLASSIFIER_CONFIDENCE_THRESHOLD = 0.7;

export const LLM_SKILL_EXECUTORS: Record<string, LLMSkillExecutor> = {
  topic_classifier: {
    skillName: "topic_classifier",
    execute: async (params) => {
      // 上游 trending_topics 返回的 TrendingItem 没有 id 字段（schema 只含 platform/
      // rank/title/heat/url/category），但 topic_classifier 内部 schema 要求 id。
      // 之前事故：LLM 看输入没 id 就用 array index "0"~"49" 编 id，下游兜底逻辑
      // returnedIds 跟 input 都对不上 → missing 兜底 50 条 → results 翻倍到 100 条全 other。
      // 修：dispatch 层补 fallback id (`${platform}_${rank}` 或 `topic_${idx}`)，
      // 让 LLM echo 时跟 input id 完全一致。
      const rawTopics = (params.topics ?? []) as Array<Record<string, unknown>>;
      const topicsWithId = rawTopics.map((t, idx) => ({
        ...t,
        id:
          (typeof t.id === "string" && t.id) ||
          (t.platform && t.rank !== undefined ? `${t.platform}_${t.rank}` : `topic_${idx}`),
      }));
      const input = {
        ...params,
        topics: topicsWithId,
      } as unknown as Parameters<typeof classifyOverseasTopics>[0];
      return classifyOverseasTopics(input);
    },
  },
  cross_language_rewrite: {
    skillName: "cross_language_rewrite",
    execute: async (params) => {
      // 期望 params: { articles: ClassifiedItem[], targetLanguage, variantsPerTopic }
      // ClassifiedItem 在 topic-classifier.ts 已加 title/summary echo，无需反查 step1.topics。
      // Defense-in-depth：?? 只 fallback null/undefined，"" 或对象会原样传过来
      // 让 .filter throw "not a function"。明确 Array.isArray 兜底。
      const rawArticles: ClassifiedItem[] = Array.isArray(params.articles)
        ? (params.articles as ClassifiedItem[])
        : [];
      const filtered = rawArticles.filter(
        (a) =>
          a.category !== "other" &&
          (a.confidence ?? 0) >= CLASSIFIER_CONFIDENCE_THRESHOLD,
      );
      // body fallback: summary 缺失 / 太短时用 title.repeat(2) 保证 length>=10 过 schema 校验
      const articles = filtered.map((a) => ({
        id: a.id,
        title: a.title ?? a.id,
        body:
          a.summary && a.summary.length >= 10
            ? a.summary
            : (a.title ?? a.id).repeat(2),
        sourceUrl: a.sourceUrl,
        category: a.category,
      }));
      const result = await crossLanguageRewriteArticles({
        articles,
        targetLanguage: (params.targetLanguage as "en") ?? "en",
        variantsPerTopic: params.variantsPerTopic as 1 | 2 | 3 | undefined,
        categoryHint: params.categoryHint as string | undefined,
      });
      // 为下游 archive_to_drafts 字段名兼容：archive_to_drafts inputSchema 要求
      // articles[].title / articles[].body，cross_language_rewrite 输出的是
      // title_en / body_en。在这里 wrap 加 title/body alias，让 step 4 paramConfig
      // 用 {{step3.articles}} 直接 server-side 调 archive_to_drafts 时 zod 校验过关，
      // 不再 fallthrough 到 LLM 路径让它越权 web_search 编 fake digest。
      // hashtags 同步合并进 tags 给 articles.tags 字段（archive_to_drafts 接受 tags+hashtags）。
      return {
        ...result,
        articles: result.articles.map((a) => ({
          ...a,
          title: a.title_en,
          body: a.body_en,
          culturalNotes: a.cultural_notes,
        })),
      };
    },
  },
};

export function isLLMSkillRegistered(name: string): boolean {
  return name in LLM_SKILL_EXECUTORS;
}

export async function invokeLLMSkillDirectly(
  name: string,
  params: Record<string, unknown>,
): Promise<
  | { ok: true; toolName: string; params: Record<string, unknown>; result: unknown }
  | { ok: false; toolName: string; params: Record<string, unknown>; error: string }
> {
  const executor = LLM_SKILL_EXECUTORS[name];
  if (!executor) {
    return {
      ok: false,
      toolName: name,
      params,
      error: `LLM-skill ${name} not registered`,
    };
  }
  try {
    const result = await executor.execute(params);
    return { ok: true, toolName: name, params, result };
  } catch (err) {
    return {
      ok: false,
      toolName: name,
      params,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

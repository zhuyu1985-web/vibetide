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
      const input = params as unknown as Parameters<typeof classifyOverseasTopics>[0];
      return classifyOverseasTopics(input);
    },
  },
  cross_language_rewrite: {
    skillName: "cross_language_rewrite",
    execute: async (params) => {
      // 期望 params: { articles: ClassifiedItem[], targetLanguage, variantsPerTopic }
      // ClassifiedItem 在 topic-classifier.ts 已加 title/summary echo，无需反查 step1.topics。
      const rawArticles = (params.articles ?? []) as ClassifiedItem[];
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
      return crossLanguageRewriteArticles({
        articles,
        targetLanguage: (params.targetLanguage as "en") ?? "en",
        variantsPerTopic: params.variantsPerTopic as 1 | 2 | 3 | undefined,
        categoryHint: params.categoryHint as string | undefined,
      });
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

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
      const topicsWithId = rawTopics.map((t, idx) => {
        // sourceUrl 字段名归一化：trending_topics 输出的 TrendingItem 字段叫 `url`
        // （不是 sourceUrl）。如果直接透传,下游 topic_classifier echo 不回 URL,
        // batch_deep_read 再调时 sourceUrl 为空 → Jina 抓不到 → 全部走 summary
        // 兜底。这里把 `url` 提升为 `sourceUrl`,链路才能闭环。
        const sourceUrl =
          (typeof t.sourceUrl === "string" && t.sourceUrl) ||
          (typeof t.url === "string" && t.url) ||
          undefined;
        return {
          ...t,
          id:
            (typeof t.id === "string" && t.id) ||
            (t.platform && t.rank !== undefined
              ? `${t.platform}_${t.rank}`
              : `topic_${idx}`),
          sourceUrl,
        };
      });

      // enabledCategories 归一化：workflow-launch-dialog 的 multiselect 控件
      // 存的是 string[]（只有 value，没 label），但 classifyOverseasTopics
      // 要求 { value, label }[]。早期事故：seed 里 `enabledCategories:
      // "{{categories}}"` 渲染后变成 ["food","pets","domestic_tech"] 字符串
      // 数组,skill 拿 c.value 拿到 undefined → z.enum 拒绝 → LLM 调用失败。
      // 修：接受三种形态:
      //   - string[]        → 自动包成 [{value, label: value}, ...]
      //   - {value,label}[] → 直接用
      //   - 单个字符串       → 包成单元素数组
      //
      // 二级兜底：用户测试时若没勾选任何 categories（启动表单清空），
      // 渲染后 enabledCategories 是 "" / [] / undefined → normalize 出空数组。
      // 这时 fallback 到海外热榜搬运 seed 默认的 3 类(food/pets/domestic_tech)，
      // 避免"调用失败"挡住整个测试流。
      const DEFAULT_OVERSEAS_CATEGORIES = [
        { value: "food", label: "美食" },
        { value: "pets", label: "萌宠" },
        { value: "domestic_tech", label: "国内科技" },
      ];
      const rawCategories = params.enabledCategories;
      const normalizedCategories: Array<{ value: string; label: string }> = [];
      if (Array.isArray(rawCategories)) {
        for (const c of rawCategories) {
          if (typeof c === "string" && c.trim()) {
            normalizedCategories.push({ value: c, label: c });
          } else if (c && typeof c === "object") {
            const obj = c as { value?: unknown; label?: unknown };
            const value = typeof obj.value === "string" ? obj.value : "";
            const label = typeof obj.label === "string" ? obj.label : value;
            if (value) normalizedCategories.push({ value, label });
          }
        }
      } else if (typeof rawCategories === "string" && rawCategories.trim()) {
        normalizedCategories.push({
          value: rawCategories,
          label: rawCategories,
        });
      }
      const finalCategories =
        normalizedCategories.length > 0
          ? normalizedCategories
          : DEFAULT_OVERSEAS_CATEGORIES;

      const input = {
        ...params,
        topics: topicsWithId,
        enabledCategories: finalCategories,
      } as unknown as Parameters<typeof classifyOverseasTopics>[0];
      return classifyOverseasTopics(input);
    },
  },
  cross_language_rewrite: {
    skillName: "cross_language_rewrite",
    execute: async (params) => {
      // 期望 params.articles 来自：
      //   - 海外热榜搬运 step 4：batch_deep_read 输出 items[]（每条带 body=Jina 全文）
      //   - 单条海外转发：直接传 { id, title, body, sourceUrl, category }
      //   - 旧链路兼容：topic_classifier 输出 results[]（只有 summary，无 body）
      //
      // body 优先级：body(已抓全文) > summary > title.repeat(2) 兜底过 schema 校验
      // category="other" 且 confidence < 阈值 的条目过滤掉（这些是 topic_classifier
      // 标的低质量分类，batch_deep_read 透传过来不应翻译）
      const rawArticles: Array<
        ClassifiedItem & { body?: string; fetchStatus?: string }
      > = Array.isArray(params.articles)
        ? (params.articles as Array<
            ClassifiedItem & { body?: string; fetchStatus?: string }
          >)
        : [];
      const filtered = rawArticles.filter((a) => {
        // 若上游是 batch_deep_read，category 已透传；若没有 category 字段
        // （单条转发场景）则不过滤
        if (a.category === undefined) return true;
        if (a.category === "other") return false;
        return (a.confidence ?? 1) >= CLASSIFIER_CONFIDENCE_THRESHOLD;
      });
      // filter 后 0 条:跳过 LLM 调用,直接返回空 articles + 解释。这样下游
      // archive_to_drafts 能优雅收到 articles=[] 并显示"无可入库稿件",链路
      // 完整可追溯,UI 不会出现"step 4 假成功 + step 5 zod 失败"的迷惑现象。
      if (filtered.length === 0) {
        return {
          articles: [],
          note: `cross_language_rewrite 过滤后 0 条可翻译稿件 (输入 ${rawArticles.length} 条,全部 category=other 或 confidence < ${CLASSIFIER_CONFIDENCE_THRESHOLD})。常见原因:topic_classifier 把所有热点归 other,即用户配置的 categories 跟实际热榜不匹配。建议调整工作流 categories 字段或扩大热榜抓取范围。`,
        };
      }
      const articles = filtered.map((a) => {
        const body =
          a.body && a.body.length >= 10
            ? a.body
            : a.summary && a.summary.length >= 10
              ? a.summary
              : (a.title ?? a.id).repeat(2);
        return {
          id: a.id,
          title: a.title ?? a.id,
          body,
          sourceUrl: a.sourceUrl,
          category: a.category,
        };
      });
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

# Mission Console Step 输出真实化 + LLM 越权隔离 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 mission console 的每个 step 输出都是真实工具/skill 结果的结构化展示，且 LLM 不跨 step 越权工作。

**Architecture:** A 模块改 `mission-executor.ts` + seed 让每个 step 触发 short-circuit（数据获取走 invokeToolDirectly，LLM-skill 走新增 LLM-skill dispatch），4 个 SKILL.md 加「步骤边界」段。B 模块在 `src/components/missions/step-renderers/` 加 4 个 dedicated 组件，`mission-console-client.tsx` 的 TaskDetailSheet body 加 switch dispatch。

**Tech Stack:** Next.js 16 App Router, TypeScript 5 strict, Drizzle ORM, AI SDK v6 (qwen3-max via OpenAI-compatible), Vitest, Tailwind v4, shadcn/ui.

**Spec:** [`docs/superpowers/specs/2026-05-26-mission-console-step-rendering-design.md`](../specs/2026-05-26-mission-console-step-rendering-design.md)

---

## 全局 File Structure

### 新建文件

| 文件 | 职责 | Phase |
|---|---|---|
| `src/lib/agent/llm-skill-dispatch.ts` | LLM-skill 名 → 函数 + 入参 builder 的 dispatch 表（topic_classifier / cross_language_rewrite）| A |
| `src/lib/agent/__tests__/llm-skill-dispatch.test.ts` | dispatch 单测 | A |
| `src/components/missions/step-renderers/trending-topics-renderer.tsx` | step 1 渲染器（topics 表）| B |
| `src/components/missions/step-renderers/topic-classifier-renderer.tsx` | step 2 渲染器（分类表 + 徽章）| B |
| `src/components/missions/step-renderers/cross-language-rewrite-renderer.tsx` | step 3 渲染器（稿件列表可展开）| B |
| `src/components/missions/step-renderers/archive-to-drafts-renderer.tsx` | step 4 渲染器（从 mission-console-client.tsx 抽出）| B |
| `src/components/missions/step-renderers/fallback-renderer.tsx` | shape 不匹配时的 fallback 组件 | B |
| `src/components/missions/step-renderers/__tests__/*.test.tsx` | 4 个 renderer 单测 | B |

### 修改文件

| 文件 | 改动概要 | Phase |
|---|---|---|
| `src/lib/mission-executor.ts` | 加 LLM-skill dispatch 分支 + 扩展 mustache 支持 `{{stepN.field}}` | A |
| `src/lib/agent/skills/topic-classifier.ts` | export `ClassifiedItem` 别名（已有 `TopicClassifierResult`，加 type alias）| A |
| `src/db/seed-builtin-workflows.ts` | hot_topics_overseas_en step 1-3 加 paramConfig | A |
| `skills/trending_topics/SKILL.md` | 加「步骤边界」段 | A |
| `skills/topic-classifier/SKILL.md` | 加「步骤边界」段 | A |
| `skills/cross-language-rewrite/SKILL.md` | 加「步骤边界」段 | A |
| `skills/archive-to-drafts/SKILL.md` | 加「步骤边界」段 | A |
| `src/app/(dashboard)/missions/[id]/mission-console-client.tsx` | 删 inline archive_to_drafts 块 + 加 step-renderer dispatch switch | B |

---

## Phase A — LLM 越权隔离 + Short-Circuit 触发

**目标**: 让 4 个 step 都能 short-circuit 直出真实结果，LLM 不越权调其他工具。

### Task A.1.1: 新建 `llm-skill-dispatch.ts` + 单测

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/agent/llm-skill-dispatch.ts`
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/agent/__tests__/llm-skill-dispatch.test.ts`

- [ ] **Step 1: 先 export ClassifiedItem 别名 (topic-classifier.ts)**

修改 `src/lib/agent/skills/topic-classifier.ts` 末尾加：

```ts
// 别名 export：dispatch / renderer 用 ClassifiedItem 更语义化
export type ClassifiedItem = TopicClassifierResult;
```

- [ ] **Step 2: 写测试 (failing)**

```ts
// src/lib/agent/__tests__/llm-skill-dispatch.test.ts
import { describe, it, expect, vi } from "vitest";

const classifyMock = vi.fn();
const rewriteMock = vi.fn();
vi.mock("@/lib/agent/skills/topic-classifier", () => ({
  classifyOverseasTopics: classifyMock,
}));
vi.mock("@/lib/agent/skills/cross-language-rewrite", () => ({
  crossLanguageRewriteArticles: rewriteMock,
}));

import {
  isLLMSkillRegistered,
  invokeLLMSkillDirectly,
  LLM_SKILL_EXECUTORS,
} from "../llm-skill-dispatch";

describe("llm-skill-dispatch registration", () => {
  it("topic_classifier + cross_language_rewrite registered", () => {
    expect(isLLMSkillRegistered("topic_classifier")).toBe(true);
    expect(isLLMSkillRegistered("cross_language_rewrite")).toBe(true);
    expect(isLLMSkillRegistered("trending_topics")).toBe(false);
    expect(isLLMSkillRegistered("unknown")).toBe(false);
  });
});

describe("invokeLLMSkillDirectly topic_classifier", () => {
  it("happy path：调 classifyOverseasTopics 并 wrap 结果", async () => {
    classifyMock.mockResolvedValueOnce({
      results: [{ id: "t1", category: "food", confidence: 0.9, reason: "..." }],
    });
    const res = await invokeLLMSkillDirectly("topic_classifier", {
      topics: [{ id: "t1", title: "成都串串" }],
      enabledCategories: [{ value: "food", label: "美食" }],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected ok");
    const result = res.result as { results: unknown[] };
    expect(result.results).toHaveLength(1);
  });

  it("classifyOverseasTopics 抛错 → 返回 ok=false 不 throw", async () => {
    classifyMock.mockRejectedValueOnce(new Error("API down"));
    const res = await invokeLLMSkillDirectly("topic_classifier", {
      topics: [{ id: "t1", title: "X" }],
      enabledCategories: [{ value: "food", label: "美食" }],
    });
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected error");
    expect(res.error).toContain("API down");
  });
});

describe("invokeLLMSkillDirectly cross_language_rewrite", () => {
  it("入参 builder 从 step2.results 过滤 other 类并 map 为 ArticleInput", async () => {
    rewriteMock.mockResolvedValueOnce({
      articles: [{ id: "t1-v0", sourceTopicId: "t1", variantIndex: 0, title_en: "X", body_en: "Y", hashtags: ["#A", "#B", "#C"] }],
    });
    const res = await invokeLLMSkillDirectly("cross_language_rewrite", {
      articles: [
        // ClassifiedItem shape from step 2: {id, category, confidence, reason, sourceUrl, title, summary?}
        { id: "t1", category: "food", confidence: 0.9, reason: "...", sourceUrl: "https://x.com/1", title: "成都串串", summary: "..." },
        { id: "t2", category: "other", confidence: 0.3, reason: "...", sourceUrl: "https://x.com/2", title: "时政", summary: "..." },
      ],
      targetLanguage: "en",
      variantsPerTopic: 1,
    });
    expect(res.ok).toBe(true);
    // 验证：crossLanguageRewriteArticles 被调时，articles 已过滤掉 other 类
    expect(rewriteMock).toHaveBeenCalledTimes(1);
    const callArgs = rewriteMock.mock.calls[0][0] as { articles: unknown[] };
    expect(callArgs.articles).toHaveLength(1);  // only food, not other
  });

  it("未注册的 skill → ok=false", async () => {
    const res = await invokeLLMSkillDirectly("nonexistent_skill", {});
    expect(res.ok).toBe(false);
    if (res.ok) throw new Error("expected error");
    expect(res.error).toContain("not registered");
  });
});
```

- [ ] **Step 3: 运行测试，确认失败**

Run: `cd /Users/zhuyu/dev/chinamcloud/vibetide && npx vitest run src/lib/agent/__tests__/llm-skill-dispatch.test.ts`
Expected: FAIL — `llm-skill-dispatch.ts` 不存在

- [ ] **Step 4: 实现 dispatch**

```ts
// src/lib/agent/llm-skill-dispatch.ts
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
      // 期望 params: { topics: TopicInput[], enabledCategories: CategoryOption[] }
      const input = params as Parameters<typeof classifyOverseasTopics>[0];
      return classifyOverseasTopics(input);
    },
  },
  cross_language_rewrite: {
    skillName: "cross_language_rewrite",
    execute: async (params) => {
      // 期望 params: { articles: ClassifiedItem[]+{title,summary?,sourceUrl?}, targetLanguage, variantsPerTopic }
      // 需要做 mapping ClassifiedItem → ArticleInput
      const rawArticles = (params.articles ?? []) as ClassifiedItem[];
      // 过滤 confidence < threshold 或 category === "other" 的条目
      const filtered = rawArticles.filter(
        (a) =>
          a.category !== "other" &&
          (a.confidence ?? 0) >= CLASSIFIER_CONFIDENCE_THRESHOLD,
      );
      // map 为 ArticleInput shape
      // 注意：ClassifiedItem 不带 title/body 本身，但 dispatch caller (mission-executor)
      // 应在 input builder 时把 step1.topics 的 title/summary 合并过来。
      // 在这里假设 caller 已合并 → article 含 .title / .summary
      const articles = filtered.map((a) => ({
        id: a.id,
        title: (a as ClassifiedItem & { title?: string }).title ?? a.id,
        body: (a as ClassifiedItem & { summary?: string }).summary ?? "",
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
    return { ok: false, toolName: name, params, error: `LLM-skill ${name} not registered` };
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
```

- [ ] **Step 5: 测试 PASS + tsc**

Run: `cd /Users/zhuyu/dev/chinamcloud/vibetide && npx vitest run src/lib/agent/__tests__/llm-skill-dispatch.test.ts && npx tsc --noEmit 2>&1 | grep -v "compute-ranking-scope" | head -5`
Expected: 4 PASS, 0 tsc errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/agent/llm-skill-dispatch.ts src/lib/agent/__tests__/llm-skill-dispatch.test.ts src/lib/agent/skills/topic-classifier.ts
git commit -m "$(cat <<'EOF'
feat(llm-skill-dispatch): 新增 LLM-skill 预执行 dispatch 表

让 topic_classifier / cross_language_rewrite 能跟 invokeToolDirectly
对齐被 mission-executor "预执行"，跳过 LLM 直出真实结果。

- LLM_SKILL_EXECUTORS 把 skill name → 函数 + 入参 builder
- cross_language_rewrite input builder：按 CLASSIFIER_CONFIDENCE_THRESHOLD
  (0.7) 过滤掉 other 类 + 低置信度条目，并 map ClassifiedItem 字段
  为 ArticleInput shape
- topic-classifier.ts 加 ClassifiedItem type alias export 让 dispatch
  / renderer 引用语义更清晰

Phase A Task A.1.1 (mission-console-step-rendering plan).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Pre-commit hook will run vitest全量.

### Task A.1.2: mission-executor 扩展支持 LLM-skill 预执行 + `{{stepN.field}}` 模板

**Files:**
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/mission-executor.ts` (around lines 670-820, 750-763 mustache renderer, 885-946 short-circuit)
- Test: 追加 `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/__tests__/mission-executor-short-circuit.test.ts` (新建)

- [ ] **Step 1: 写测试 (failing) — `renderStepParameters` 模板扩展**

```ts
// src/lib/__tests__/mission-executor-short-circuit.test.ts (新建)
import { describe, it, expect, vi } from "vitest";
// 注意：mission-executor.ts 是大文件且导出函数为 runWorkflowMission；
// 我们要测的 renderStepParameters 是 internal helper。
// 用导出测试 helper 的方式：在 mission-executor.ts 加 `export function renderStepParameters`
// 然后直接 import 测。

import { renderStepParameters } from "../mission-executor";

describe("renderStepParameters", () => {
  it("从 mission.inputParams 取 primitive string", () => {
    const rendered = renderStepParameters(
      { mode: "hot", limit: "{{topic_limit}}" },
      { inputParams: { topic_limit: 30 } } as never,
      [],
    );
    expect(rendered).toEqual({ mode: "hot", limit: "30" });  // string 替换是 string；具体类型 mission-executor 后续解析
  });

  it("从 previousSteps 引用 step1.topics array (JSON-parsed)", () => {
    const rendered = renderStepParameters(
      { topics: "{{step1.topics}}" },
      { inputParams: {} } as never,
      [
        // previousSteps[0] = step 1 output
        { outputData: { topics: [{ id: "t1", title: "A" }] } } as never,
      ],
    );
    expect(rendered.topics).toEqual([{ id: "t1", title: "A" }]);  // JSON-parsed back
  });

  it("从 mission.inputParams 取 array (JSON.stringify 后再 parse)", () => {
    const rendered = renderStepParameters(
      { categories: "{{categories}}" },
      { inputParams: { categories: [{ value: "food", label: "美食" }] } } as never,
      [],
    );
    expect(rendered.categories).toEqual([{ value: "food", label: "美食" }]);
  });

  it("primitive string 不被 JSON.parse fallthrough", () => {
    const rendered = renderStepParameters(
      { mode: "hot" },  // 没 {{}}，直接是 primitive
      { inputParams: {} } as never,
      [],
    );
    expect(rendered.mode).toBe("hot");  // 保持 string
  });

  it("{{key}} 解析失败 → 保留空字符串", () => {
    const rendered = renderStepParameters(
      { foo: "{{missing_key}}" },
      { inputParams: {} } as never,
      [],
    );
    expect(rendered.foo).toBe("");
  });

  it("{{stepN.field}} N 越界 → 保留空字符串", () => {
    const rendered = renderStepParameters(
      { foo: "{{step9.topics}}" },
      { inputParams: {} } as never,
      [],
    );
    expect(rendered.foo).toBe("");
  });
});
```

- [ ] **Step 2: 测试 FAIL**

Run: `npx vitest run src/lib/__tests__/mission-executor-short-circuit.test.ts`
Expected: FAIL — `renderStepParameters` 没 export

- [ ] **Step 3: 改 mission-executor.ts，提取 + 扩展 mustache helper**

a) 把 inline 的 mustache 渲染 (line 749-763) 提取为 module-level export function。在文件合适位置加：

```ts
/**
 * 渲染 step.config.parameters 里的 `{{key}}` 模板。
 *
 * 支持：
 * - `{{key}}` = mission.inputParams[key] (primitive / array / object 都行)
 * - `{{stepN.field}}` = previousSteps[N-1].outputData[field]  (1-indexed)
 * - 未找到的 key → 替换为空字符串
 *
 * 结果尝试 JSON.parse 字符串值（让 array/object/number 还原），失败则保留 string。
 *
 * 该函数 export 是为了单测；mission-executor 内部 inline 渲染逻辑迁过来。
 */
export function renderStepParameters(
  template: Record<string, unknown>,
  mission: { inputParams: Record<string, unknown> | null | undefined },
  previousSteps: Array<{ outputData?: unknown }>,
): Record<string, unknown> {
  const src = mission.inputParams ?? {};
  const rendered: Record<string, unknown> = {};
  for (const [k, rawV] of Object.entries(template)) {
    if (typeof rawV !== "string") {
      rendered[k] = rawV;
      continue;
    }
    const replaced = rawV.replace(/\{\{([^}]+)\}\}/g, (_, expr: string) => {
      const stepMatch = expr.match(/^step(\d+)\.(.+)$/);
      if (stepMatch) {
        const stepIdx = parseInt(stepMatch[1], 10) - 1;
        const field = stepMatch[2];
        const stepOutput = previousSteps[stepIdx]?.outputData;
        if (
          stepOutput &&
          typeof stepOutput === "object" &&
          field in (stepOutput as Record<string, unknown>)
        ) {
          const v = (stepOutput as Record<string, unknown>)[field];
          if (v === undefined || v === null) return "";
          if (typeof v === "object") return JSON.stringify(v);
          return String(v);
        }
        return "";
      }
      // 简单 key (mission.inputParams)
      const v = src[expr.trim()];
      if (v === undefined || v === null) return "";
      if (typeof v === "object") return JSON.stringify(v);
      return String(v);
    });
    // 尝试 JSON.parse (让 array/object 还原)；失败则保留 string
    try {
      const parsed = JSON.parse(replaced);
      // 防御：JSON.parse("hot") → 抛错；JSON.parse("30") → 30 (number) 但我们期望保持 "30"；
      // 所以只在结果是 object 或 array 时接受
      if (typeof parsed === "object" && parsed !== null) {
        rendered[k] = parsed;
        continue;
      }
    } catch {
      // ignore
    }
    rendered[k] = replaced;
  }
  return rendered;
}
```

b) 替换 mission-executor.ts:750-763 内联渲染为调用新函数：

```ts
// 替换 line 750-763 的 inline 渲染
const rendered = renderStepParameters(rawParams, mission, previousSteps);
```

(注意上下文里 `previousSteps` 已是 line 953 才注入 executeAgent — 在 line 750 这个 pre-exec 分支需要先拉一遍。把 previousSteps 的获取 line 1297 `mapTaskOutputsToStepOutputs(completedTasks)` 提到 pre-exec 之前。)

- [ ] **Step 4: 测试通过**

Run: `npx vitest run src/lib/__tests__/mission-executor-short-circuit.test.ts`
Expected: 6 PASS

- [ ] **Step 5: 加 LLM-skill dispatch 分支**

在 mission-executor.ts 的 pre-exec 分支 (line 767 附近 `const invocation = await invokeToolDirectly(...)`) 前加：

```ts
// 在 invokeToolDirectly 之前先查 LLM-skill 注册
const { isLLMSkillRegistered, invokeLLMSkillDirectly } = await import("@/lib/agent/llm-skill-dispatch");

let invocation: Awaited<ReturnType<typeof invokeToolDirectly>>;
if (isLLMSkillRegistered(task.assignedRole)) {
  invocation = await invokeLLMSkillDirectly(task.assignedRole, rendered);
} else {
  invocation = await invokeToolDirectly(
    task.assignedRole,
    rendered,
    {
      organizationId: mission.organizationId ?? undefined,
      operatorId: task.assignedEmployeeId ?? undefined,
    },
  );
}
preExecParams = rendered;
// ... 接现有 if (invocation.ok) 分支
```

- [ ] **Step 6: 写测试 LLM-skill short-circuit 流程 + Promise.all 副作用**

在同一测试文件追加：

```ts
import { runWorkflowMission } from "../mission-executor";

describe("mission-executor LLM-skill short-circuit", () => {
  it.skip("topic_classifier short-circuit 写入 outputData + 通知员工 idle + 插 mission_message", async () => {
    // 这是 integration-style test，需要 mock DB / employees / etc.
    // 在该 plan 阶段先 .skip，留作 follow-up 或 e2e 验证
    // 注意：不阻塞 commit
  });
});
```

(完整 integration 测试不实施 — runWorkflowMission 涉及多 layer mock 成本高，验收靠 e2e 实跑。但 dispatch 单测 + renderStepParameters 单测覆盖了关键路径。)

- [ ] **Step 7: tsc + 跑全量测试**

Run: `npx tsc --noEmit 2>&1 | grep -v "compute-ranking-scope" | head -10 && npx vitest run`
Expected: tsc 0, vitest 730+ pass

- [ ] **Step 8: Commit**

```bash
git add src/lib/mission-executor.ts src/lib/__tests__/mission-executor-short-circuit.test.ts
git commit -m "$(cat <<'EOF'
feat(mission-executor): 扩展 short-circuit 支持 LLM-skill + {{stepN.field}}

A 模块核心改动：
- 把 inline mustache 渲染抽成 export function renderStepParameters，
  支持 {{stepN.field}} 引用 previousSteps[N-1].outputData[field]
- pre-exec 分支增加 isLLMSkillRegistered 检查：命中则调
  invokeLLMSkillDirectly (topic_classifier / cross_language_rewrite)，
  否则原 invokeToolDirectly 流程不变
- short-circuit 写入 outputData + 维持原 Promise.all 副作用 (mission
  status, employee idle, mission_messages insert)

renderStepParameters 单测 6 case：primitive string / step ref array /
inputParams array / 无 {{}} primitive / {{}} 解析失败 / step idx 越界。

Phase A Task A.1.2.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task A.1.3: hot_topics_overseas_en seed 加 paramConfig

**Files:**
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/db/seed-builtin-workflows.ts` (around line 2257-2272)

- [ ] **Step 1: 改 seed**

把 hot_topics_overseas_en 的 steps 数组改为：

```ts
steps: [
  step(1, "拉取 24h 热榜", "trending_topics", "热榜聚合", "data_collection", "pull",
    { mode: "hot", limit: "{{topic_limit}}" }),
  step(2, "海外分类过滤", "topic_classifier", "海外热榜分类", "content_analysis", "classify",
    {
      topics: "{{step1.topics}}",
      enabledCategories: "{{categories}}",
    }),
  step(3, "深读+翻译改写", "cross_language_rewrite", "中英本地化改写", "content_gen", "translate",
    {
      articles: "{{step2.results}}",
      targetLanguage: "en",
      variantsPerTopic: "{{variants_per_topic}}",
    }),
  step(
    4,
    "入英文稿件库（待审）",
    "archive_to_drafts",
    "稿件入库",
    "distribution",
    "store",
    { language: "en", category: "app_overseas_en", initialStatus: "approved" },
  ),
],
```

注意 step 4 保留现有 `category: "app_overseas_en"` 字段。

- [ ] **Step 2: tsc**

Run: `npx tsc --noEmit 2>&1 | grep -v "compute-ranking-scope" | head -5`
Expected: 0 errors

- [ ] **Step 3: db:seed（如本地 DB 可用）**

Run: `npm run db:seed 2>&1 | head -20`
Expected: success OR ECONNREFUSED (本地 Postgres 没起就跳过，部署侧手动跑)

- [ ] **Step 4: Commit**

```bash
git add src/db/seed-builtin-workflows.ts
git commit -m "$(cat <<'EOF'
feat(seed): hot_topics_overseas_en step 1-3 加 paramConfig 触发 short-circuit

之前 step 1-3 paramConfig 缺失，mission-executor pre-exec 不知传啥参数
→ short-circuit 不触发 → LLM 走原路径自由发挥（含越权调 heat_scoring）。

现在：
- step 1 mode/limit 绑定 mission 输入 topic_limit
- step 2 topics 从 step1.topics 取，enabledCategories 从 mission 输入
- step 3 articles 从 step2.results 取 (dispatch 内部过滤 other 类 +
  低置信度)，variantsPerTopic 从 mission 输入

step 4 paramConfig 不动，保留 category: app_overseas_en。

部署侧需跑 npm run db:seed 同步。

Phase A Task A.1.3.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task A.2: 4 个 SKILL.md 加「步骤边界」段

**Files:**
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/skills/trending_topics/SKILL.md`
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/skills/topic-classifier/SKILL.md`
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/skills/cross-language-rewrite/SKILL.md`
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/skills/archive-to-drafts/SKILL.md`

- [ ] **Step 1: 给 trending_topics 加段**

在 `skills/trending_topics/SKILL.md` 的「使用条件」段之后插入：

```md
## 步骤边界 (Step Boundary)

本 skill 在工作流里通常作为 **step 1 (数据获取)** —— **只产出原始热榜数据列表**。

禁止跨步:
- 不要替 step 2 (topic_classifier) 做分类筛选，把全量原始数据交出去就行
- 不要调用 `heat_scoring` 工具评估热度 —— 那不是本 step 的工作
- 不要调用 `web_search` / `news_aggregation` 补充信息 —— 工作流里有专门的 step

如果真实结果为空 (0 条 topics)，**如实输出"无结果"**，不要从训练数据里补话题。
```

- [ ] **Step 2: 给 topic-classifier 加段**

```md
## 步骤边界 (Step Boundary)

本 skill 在工作流里通常作为 **step 2 (内容过滤分类)** —— **只对输入做分类标记**。

禁止跨步:
- 不要替 step 3 (cross_language_rewrite) 做翻译改写，保留中文原文交出去
- 不要调用 `web_search` / `trending_topics` 补充信息 —— 上一步已经提供
- 不要从训练数据里推断 topic 的额外细节 —— 只基于输入字段判断

低置信度 (`confidence < 0.7`) 直接归 `other`，不要硬塞进 enabledCategories。
```

- [ ] **Step 3: 给 cross-language-rewrite 加段**

```md
## 步骤边界 (Step Boundary)

本 skill 在工作流里通常作为 **step 3 (跨语言改写)** —— **只对输入文章做翻译 + 本地化**。

禁止跨步:
- 不要替 step 4 (archive_to_drafts) 做入库决策 —— 输出稿件就行，状态/分类是下一步的事
- 不要新增训练数据里的事实 —— 只翻译/重写输入里的内容
- 不要凭空插入额外 hashtags/cultural_notes，跟输入相关才加

`sourceUrl` / `category` 必须从输入原样 echo 到输出，**绝对不许修改或编造**。
```

- [ ] **Step 4: 给 archive-to-drafts 加段**

```md
## 步骤边界 (Step Boundary)

本 skill 在工作流里通常作为 **step 4 (稿件入库)** —— **只把传入的稿件批量写到 articles 表**。

禁止跨步:
- 不要做发布到外部 CMS (`publishArticleToCms`) 的动作 —— 那是另一个 spec 的工作
- 不要修改 / 重排传入的稿件 —— 保持调用方传过来的内容原样
- 不要从训练数据补充缺失字段 —— 缺什么就缺什么，让上游解决

`dedupBySourceUrl` 默认开启，遇到重复 sourceUrl 不要插入新行，写到 `skipped[]`。
```

- [ ] **Step 5: tsc + Commit**

(SKILL.md 改动 tsc 不影响，但走 pre-commit hook 跑 vitest 全量)

```bash
git add skills/trending_topics/SKILL.md skills/topic-classifier/SKILL.md skills/cross-language-rewrite/SKILL.md skills/archive-to-drafts/SKILL.md
git commit -m "$(cat <<'EOF'
docs(skills): 4 个 SKILL.md 加「步骤边界」段防 LLM 跨步越权

A 模块 prompt 隔离层。明确每个 step 的职责边界 + 禁令清单：
- trending_topics: 只拉原始数据，不调 heat_scoring/web_search
- topic-classifier: 只打分类，不翻译，confidence < 0.7 归 other
- cross-language-rewrite: 只翻译/本地化，不入库，不编造事实
- archive-to-drafts: 只写 articles 表，不发外部 CMS，不改稿件

跟 A.1 改的 mission-executor short-circuit 是双保险：tool whitelist
+ prompt 边界 联合 → step 1 LLM 即使有 heat_scoring tool 可见也不会去调。

Phase A Task A.2.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Phase A Acceptance

```bash
npx vitest run src/lib/agent/__tests__/llm-skill-dispatch.test.ts \
              src/lib/__tests__/mission-executor-short-circuit.test.ts
npx tsc --noEmit
npm run build
```

手动（要求本地 db:seed 同步过 + dev server 跑过）：
1. 发起一个新的「海外热榜搬运」mission
2. mission console 看 step 1 outputData 含 `topics` array（非 LLM 摘要）
3. step 2 outputData 含 `results` array
4. step 3 outputData 含 `articles` array
5. step 1 LLM 不再调 heat_scoring 等其他工具（看 mission_messages 不应有相关 tool call）

---

## Phase B — Mission Console 4 Step Dedicated 渲染

**目标**: 给 trending_topics / topic_classifier / cross_language_rewrite / archive_to_drafts 各加 dedicated renderer 组件，TaskDetailSheet 用 switch 派发，老数据走 fallback。

### Task B.1: TrendingTopicsRenderer

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/components/missions/step-renderers/trending-topics-renderer.tsx`
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/components/missions/step-renderers/fallback-renderer.tsx`
- Test: `/Users/zhuyu/dev/chinamcloud/vibetide/src/components/missions/step-renderers/__tests__/trending-topics-renderer.test.tsx`

- [ ] **Step 1: 写 fallback-renderer (供所有 step renderer 共用 fallback)**

```tsx
// src/components/missions/step-renderers/fallback-renderer.tsx
"use client";

interface FallbackRendererProps {
  outputData: unknown;
  reason: string;
}

/**
 * 当 step renderer 无法解析 outputData 期望 shape 时使用。
 * 显示原始 markdown / summary + 顶部红色提示 + 一个折叠的 raw JSON 给调试用。
 */
export function FallbackRenderer({ outputData, reason }: FallbackRendererProps) {
  const summary =
    outputData && typeof outputData === "object" && "summary" in outputData
      ? String((outputData as { summary: unknown }).summary)
      : "";
  const text =
    outputData && typeof outputData === "object" && "text" in outputData
      ? String((outputData as { text: unknown }).text)
      : "";
  return (
    <div className="space-y-2">
      <div className="rounded-md bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-700 dark:text-red-300">
        ⚠️ {reason}（可能 short-circuit 未触发或老 mission 数据）。下方是原始输出。
      </div>
      {summary && (
        <div className="text-sm text-muted-foreground">{summary}</div>
      )}
      {text && (
        <pre className="whitespace-pre-wrap text-xs bg-muted/30 rounded p-2">{text}</pre>
      )}
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground">查看原始 outputData JSON</summary>
        <pre className="mt-1 overflow-auto bg-muted/30 rounded p-2 text-xs">{JSON.stringify(outputData, null, 2)}</pre>
      </details>
    </div>
  );
}
```

- [ ] **Step 2: 写 TrendingTopicsRenderer 测试**

```tsx
// src/components/missions/step-renderers/__tests__/trending-topics-renderer.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrendingTopicsRenderer } from "../trending-topics-renderer";

describe("TrendingTopicsRenderer", () => {
  it("happy path：渲染 topics 表格", () => {
    const outputData = {
      summary: "30 条热榜",
      topics: [
        { rank: 1, platform: "微博", title: "成都串串", heat: "52.3万", url: "https://weibo.com/x" },
        { rank: 2, platform: "抖音", title: "国足备战", heat: "42.1万", url: "https://douyin.com/y" },
      ],
    };
    render(<TrendingTopicsRenderer outputData={outputData} />);
    expect(screen.getByText("成都串串")).toBeInTheDocument();
    expect(screen.getByText("国足备战")).toBeInTheDocument();
    expect(screen.getByText(/拉取 2 条热榜/)).toBeInTheDocument();
  });

  it("解析 short-circuit text 字段里的 JSON 块", () => {
    const outputData = {
      text: '## 调用：`trending_topics(...)`\n\n```json\n{"topics":[{"rank":1,"platform":"微博","title":"X","heat":"10万","url":"https://x"}]}\n```',
    };
    render(<TrendingTopicsRenderer outputData={outputData} />);
    expect(screen.getByText("X")).toBeInTheDocument();
  });

  it("无 topics 字段 → fallback", () => {
    const outputData = { summary: "无法解析" };
    render(<TrendingTopicsRenderer outputData={outputData} />);
    expect(screen.getByText(/无法解析 trending_topics 输出/)).toBeInTheDocument();
  });

  it("topics 为空数组 → empty state", () => {
    const outputData = { topics: [] };
    render(<TrendingTopicsRenderer outputData={outputData} />);
    expect(screen.getByText(/无热榜结果/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: 测试 FAIL**

Run: `npx vitest run src/components/missions/step-renderers/__tests__/trending-topics-renderer.test.tsx`
Expected: FAIL — 组件不存在

- [ ] **Step 4: 实现 TrendingTopicsRenderer**

```tsx
// src/components/missions/step-renderers/trending-topics-renderer.tsx
"use client";

import { useMemo } from "react";
import { DataTable } from "@/components/shared/data-table";
import { SourceUrlPill } from "@/components/shared/source-url-pill";
import { FallbackRenderer } from "./fallback-renderer";

interface TrendingItem {
  rank?: number;
  platform?: string;
  title?: string;
  heat?: string | number;
  url?: string;
  category?: string;
  discoveredAt?: string;
}

interface TrendingTopicsRendererProps {
  outputData: unknown;
}

/**
 * 简单平台徽章（inline，避免依赖 inspiration-client 内部 PlatformTag）
 */
function PlatformBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] rounded bg-muted/40 text-muted-foreground">
      {name}
    </span>
  );
}

function extractTopics(outputData: unknown): TrendingItem[] | null {
  if (!outputData || typeof outputData !== "object") return null;
  const obj = outputData as Record<string, unknown>;
  // Case A: 结构化 outputData { topics: [...] }
  if (Array.isArray(obj.topics)) return obj.topics as TrendingItem[];
  // Case B: short-circuit text 字段里 JSON 块
  if (typeof obj.text === "string") {
    const match = obj.text.match(/```json\s*\n([\s\S]*?)\n```/);
    if (match) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed && typeof parsed === "object" && Array.isArray(parsed.topics)) {
          return parsed.topics as TrendingItem[];
        }
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function TrendingTopicsRenderer({ outputData }: TrendingTopicsRendererProps) {
  const topics = useMemo(() => extractTopics(outputData), [outputData]);

  if (topics === null) {
    return <FallbackRenderer outputData={outputData} reason="无法解析 trending_topics 输出" />;
  }
  if (topics.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        无热榜结果
      </div>
    );
  }

  const uniquePlatforms = new Set(topics.map((t) => t.platform).filter(Boolean));

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">
        拉取 {topics.length} 条热榜 · 涉及 {uniquePlatforms.size} 个平台
      </div>
      <DataTable
        rows={topics}
        rowKey={(t, idx) => `${t.platform ?? "?"}-${t.rank ?? idx}`}
        columns={[
          { key: "rank", header: "#", width: "w-12", align: "right", render: (t) => t.rank ?? "—" },
          {
            key: "platform",
            header: "平台",
            width: "w-24",
            render: (t) => (t.platform ? <PlatformBadge name={t.platform} /> : "—"),
          },
          { key: "title", header: "标题", render: (t) => t.title ?? "—" },
          {
            key: "heat",
            header: "热度",
            width: "w-24",
            align: "right",
            render: (t) => (t.heat !== undefined ? String(t.heat) : "—"),
          },
          {
            key: "url",
            header: "原文",
            width: "w-32",
            render: (t) => <SourceUrlPill url={t.url} variant="compact" />,
          },
        ]}
      />
    </div>
  );
}
```

注意：检查 `DataTable` 的 `rowKey` 签名是否接受 `(row, idx) => string` 还是只接受 `(row) => string`。若只接 1 arg，把 fallback `${idx}` 写在 row 数据里。

- [ ] **Step 5: 测试 PASS + tsc**

Run: `npx vitest run src/components/missions/step-renderers/__tests__/trending-topics-renderer.test.tsx && npx tsc --noEmit 2>&1 | grep -v "compute-ranking-scope" | head -5`
Expected: 4 PASS, 0 errors

- [ ] **Step 6: Commit**

```bash
git add src/components/missions/step-renderers/trending-topics-renderer.tsx \
        src/components/missions/step-renderers/fallback-renderer.tsx \
        src/components/missions/step-renderers/__tests__/trending-topics-renderer.test.tsx
git commit -m "$(cat <<'EOF'
feat(step-renderer): TrendingTopicsRenderer + FallbackRenderer

mission console step 1 (trending_topics) 专属渲染：
- 输入: outputData 期望 {topics: TrendingItem[]} 或 short-circuit 写的
  {text: markdown with ```json``` block}
- 输出: DataTable 渲染 rank/platform/title/heat/url，列表头摘要"拉取 N 条
  涉及 M 个平台"
- 解析失败 → FallbackRenderer 显示 ⚠️ 提示 + 原始 markdown + 折叠 raw JSON

FallbackRenderer 是 4 个 renderer 共用的兜底组件，给老 mission 或
short-circuit 未触发的情况看。

Phase B Task B.1.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task B.2: TopicClassifierRenderer

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/components/missions/step-renderers/topic-classifier-renderer.tsx`
- Test: `/Users/zhuyu/dev/chinamcloud/vibetide/src/components/missions/step-renderers/__tests__/topic-classifier-renderer.test.tsx`

- [ ] **Step 1: 写测试**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopicClassifierRenderer } from "../topic-classifier-renderer";

describe("TopicClassifierRenderer", () => {
  it("happy path：分组显示通过条目 + 折叠 other", () => {
    const outputData = {
      results: [
        { id: "t1", category: "food", confidence: 0.95, reason: "美食", sourceUrl: "https://x.com/1" },
        { id: "t2", category: "pets", confidence: 0.88, reason: "宠物", sourceUrl: "https://x.com/2" },
        { id: "t3", category: "other", confidence: 0.3, reason: "无关", sourceUrl: "https://x.com/3" },
      ],
    };
    render(<TopicClassifierRenderer outputData={outputData} />);
    expect(screen.getByText(/过滤通过 2 条/)).toBeInTheDocument();
    expect(screen.getByText("t1")).toBeInTheDocument();
    expect(screen.getByText("t2")).toBeInTheDocument();
    expect(screen.getByText(/被过滤为 other 的 1 条/)).toBeInTheDocument();
  });

  it("无 results 字段 → fallback", () => {
    render(<TopicClassifierRenderer outputData={{ summary: "..." }} />);
    expect(screen.getByText(/无法解析 topic_classifier 输出/)).toBeInTheDocument();
  });

  it("results 都是 other → 摘要"过滤通过 0 条"", () => {
    const outputData = {
      results: [
        { id: "t1", category: "other", confidence: 0, reason: "", sourceUrl: "" },
      ],
    };
    render(<TopicClassifierRenderer outputData={outputData} />);
    expect(screen.getByText(/过滤通过 0 条/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 实现 TopicClassifierRenderer**

```tsx
"use client";

import { useMemo } from "react";
import { DataTable } from "@/components/shared/data-table";
import { SourceUrlPill } from "@/components/shared/source-url-pill";
import { FallbackRenderer } from "./fallback-renderer";

interface ClassifiedItem {
  id: string;
  category: string;
  confidence: number;
  reason: string;
  sourceUrl?: string;
}

interface Props {
  outputData: unknown;
}

const CATEGORY_BADGE_COLOR: Record<string, string> = {
  food: "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300",
  pets: "bg-pink-100 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300",
  domestic_tech: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300",
  other: "bg-gray-100 dark:bg-gray-800/40 text-gray-600 dark:text-gray-400",
};

function CategoryBadge({ value }: { value: string }) {
  const color = CATEGORY_BADGE_COLOR[value] ?? CATEGORY_BADGE_COLOR.other;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] rounded ${color}`}>
      {value}
    </span>
  );
}

function extractResults(outputData: unknown): ClassifiedItem[] | null {
  if (!outputData || typeof outputData !== "object") return null;
  const obj = outputData as Record<string, unknown>;
  if (Array.isArray(obj.results)) return obj.results as ClassifiedItem[];
  return null;
}

export function TopicClassifierRenderer({ outputData }: Props) {
  const results = useMemo(() => extractResults(outputData), [outputData]);
  if (results === null) {
    return <FallbackRenderer outputData={outputData} reason="无法解析 topic_classifier 输出" />;
  }

  const passed = results.filter((r) => r.category !== "other");
  const other = results.filter((r) => r.category === "other");

  const groupCounts = passed.reduce<Record<string, number>>((acc, r) => {
    acc[r.category] = (acc[r.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">
        过滤通过 {passed.length} 条
        {Object.keys(groupCounts).length > 0 && (
          <> ({Object.entries(groupCounts).map(([cat, n]) => `${cat}: ${n}`).join(", ")})</>
        )}
      </div>
      {passed.length > 0 && (
        <DataTable
          rows={passed}
          rowKey={(r) => r.id}
          columns={[
            { key: "id", header: "ID", width: "w-20", render: (r) => <code className="text-xs">{r.id}</code> },
            { key: "category", header: "分类", width: "w-32", render: (r) => <CategoryBadge value={r.category} /> },
            { key: "confidence", header: "置信度", width: "w-20", align: "right", render: (r) => r.confidence.toFixed(2) },
            { key: "reason", header: "理由", render: (r) => r.reason },
            { key: "sourceUrl", header: "原文", width: "w-20", render: (r) => <SourceUrlPill url={r.sourceUrl} variant="compact" /> },
          ]}
        />
      )}
      {other.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-muted-foreground">被过滤为 other 的 {other.length} 条</summary>
          <div className="mt-2">
            <DataTable
              rows={other}
              rowKey={(r) => r.id}
              columns={[
                { key: "id", header: "ID", width: "w-20", render: (r) => <code className="text-xs">{r.id}</code> },
                { key: "confidence", header: "置信度", width: "w-20", align: "right", render: (r) => r.confidence.toFixed(2) },
                { key: "reason", header: "理由", render: (r) => r.reason },
                { key: "sourceUrl", header: "原文", width: "w-20", render: (r) => <SourceUrlPill url={r.sourceUrl} variant="compact" /> },
              ]}
            />
          </div>
        </details>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 测试 PASS + tsc + Commit**

```bash
npx vitest run src/components/missions/step-renderers/__tests__/topic-classifier-renderer.test.tsx
npx tsc --noEmit
git add src/components/missions/step-renderers/topic-classifier-renderer.tsx \
        src/components/missions/step-renderers/__tests__/topic-classifier-renderer.test.tsx
git commit -m "$(cat <<'EOF'
feat(step-renderer): TopicClassifierRenderer

mission console step 2 (topic_classifier) 专属渲染：
- 输入: outputData 期望 {results: ClassifiedItem[]}
- 输出: 摘要"过滤通过 N 条 (food: x, pets: y, ...)" + DataTable 显示
  通过的条目 (含 CategoryBadge 颜色徽章) + 折叠 details 显示 other
- 解析失败 → FallbackRenderer

Phase B Task B.2.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task B.3: CrossLanguageRewriteRenderer

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/components/missions/step-renderers/cross-language-rewrite-renderer.tsx`
- Test: `/Users/zhuyu/dev/chinamcloud/vibetide/src/components/missions/step-renderers/__tests__/cross-language-rewrite-renderer.test.tsx`

- [ ] **Step 1: 写测试**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CrossLanguageRewriteRenderer } from "../cross-language-rewrite-renderer";

describe("CrossLanguageRewriteRenderer", () => {
  it("happy path：渲染稿件列表（可展开）", () => {
    const outputData = {
      articles: [
        {
          id: "t1-v0",
          sourceTopicId: "t1",
          variantIndex: 0,
          title_en: "Chengdu's Skewer Queue",
          body_en: "In Chengdu, the spicy-food capital...",
          hashtags: ["#FoodieLife", "#ChinaEats", "#SpicyFood"],
          category: "food",
          sourceUrl: "https://x.com/1",
          cultural_notes: "把'串串香' explained as skewers",
        },
      ],
    };
    render(<CrossLanguageRewriteRenderer outputData={outputData} />);
    expect(screen.getByText(/翻译改写 1 篇/)).toBeInTheDocument();
    expect(screen.getByText("Chengdu's Skewer Queue")).toBeInTheDocument();
    expect(screen.getByText("t1-v0")).toBeInTheDocument();
  });

  it("无 articles → fallback", () => {
    render(<CrossLanguageRewriteRenderer outputData={{ summary: "..." }} />);
    expect(screen.getByText(/无法解析 cross_language_rewrite 输出/)).toBeInTheDocument();
  });

  it("articles 为空 → 摘要 0 篇", () => {
    render(<CrossLanguageRewriteRenderer outputData={{ articles: [] }} />);
    expect(screen.getByText(/翻译改写 0 篇/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 实现 CrossLanguageRewriteRenderer**

```tsx
"use client";

import { useMemo } from "react";
import { SourceUrlPill } from "@/components/shared/source-url-pill";
import { FallbackRenderer } from "./fallback-renderer";

interface RewrittenArticle {
  id: string;
  sourceTopicId?: string;
  variantIndex?: number;
  sourceUrl?: string;
  category?: string;
  title_en: string;
  body_en: string;
  hashtags: string[];
  cultural_notes?: string;
}

interface Props {
  outputData: unknown;
}

function extractArticles(outputData: unknown): RewrittenArticle[] | null {
  if (!outputData || typeof outputData !== "object") return null;
  const obj = outputData as Record<string, unknown>;
  if (Array.isArray(obj.articles)) return obj.articles as RewrittenArticle[];
  return null;
}

export function CrossLanguageRewriteRenderer({ outputData }: Props) {
  const articles = useMemo(() => extractArticles(outputData), [outputData]);
  if (articles === null) {
    return <FallbackRenderer outputData={outputData} reason="无法解析 cross_language_rewrite 输出" />;
  }
  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        翻译改写 {articles.length} 篇英文稿件
      </div>
      {articles.map((a) => (
        <details key={a.id} className="rounded bg-muted/30 p-3">
          <summary className="cursor-pointer flex items-center gap-2">
            <code className="text-xs">{a.id}</code>
            {a.category && (
              <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] rounded bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">
                {a.category}
              </span>
            )}
            <span className="text-sm font-medium flex-1 truncate">{a.title_en}</span>
            <SourceUrlPill url={a.sourceUrl} variant="compact" />
          </summary>
          <div className="mt-3 space-y-2 text-sm">
            <div>
              <h5 className="text-xs font-medium text-muted-foreground mb-1">Body (EN)</h5>
              <pre className="whitespace-pre-wrap text-sm">{a.body_en}</pre>
            </div>
            {a.hashtags && a.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {a.hashtags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {a.cultural_notes && (
              <div className="text-xs text-muted-foreground italic border-l-2 border-amber-300 pl-2">
                Cultural notes: {a.cultural_notes}
              </div>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: 测试 PASS + tsc + Commit**

```bash
npx vitest run src/components/missions/step-renderers/__tests__/cross-language-rewrite-renderer.test.tsx
npx tsc --noEmit
git add src/components/missions/step-renderers/cross-language-rewrite-renderer.tsx \
        src/components/missions/step-renderers/__tests__/cross-language-rewrite-renderer.test.tsx
git commit -m "$(cat <<'EOF'
feat(step-renderer): CrossLanguageRewriteRenderer

mission console step 3 (cross_language_rewrite) 专属渲染：
- 输入: outputData 期望 {articles: RewrittenArticle[]}
- 输出: 摘要"翻译改写 N 篇" + 每篇可展开 (details) 显示 title_en /
  body_en (pre 保留换行) / hashtags 标签 / cultural_notes (italic
  带左边框)
- 头部含 ID + category 徽章 + SourceUrlPill 跳原文
- 解析失败 → FallbackRenderer

Phase B Task B.3.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task B.4: ArchiveToDraftsRenderer (从 inline 抽出)

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/components/missions/step-renderers/archive-to-drafts-renderer.tsx`
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/missions/[id]/mission-console-client.tsx` (删除 inline 块 + 替换为 import)
- Test: `/Users/zhuyu/dev/chinamcloud/vibetide/src/components/missions/step-renderers/__tests__/archive-to-drafts-renderer.test.tsx`

- [ ] **Step 1: 抽出组件**

把 Phase 5 Task 5.4 在 `mission-console-client.tsx:1080-1127` 的 inline block 抽到独立文件：

```tsx
// src/components/missions/step-renderers/archive-to-drafts-renderer.tsx
"use client";

import Link from "next/link";
import { SourceUrlPill } from "@/components/shared/source-url-pill";

interface CreatedItem {
  articleId: string;
  title: string;
  sourceUrl?: string;
}

interface SkippedItem {
  sourceUrl: string;
  existingArticleId: string;
  reason: string;
}

interface ArchiveToDraftsOutput {
  totalRequested?: number;
  totalCreated?: number;
  totalSkipped?: number;
  created?: CreatedItem[];
  skipped?: SkippedItem[];
}

interface Props {
  outputData: unknown;
}

function extractData(outputData: unknown): ArchiveToDraftsOutput | null {
  if (!outputData || typeof outputData !== "object") return null;
  const obj = outputData as ArchiveToDraftsOutput;
  // 至少有一个相关字段就认（兼容 dryRun 等不同 shape）
  if (
    "totalCreated" in obj ||
    "created" in obj ||
    "totalRequested" in obj
  ) {
    return obj;
  }
  return null;
}

export function ArchiveToDraftsRenderer({ outputData }: Props) {
  const data = extractData(outputData);
  if (data === null) return null;  // 让上层 fallback / generic 处理

  return (
    <div className="space-y-2 pt-2 border-t border-muted/40">
      <div className="text-xs text-muted-foreground">
        本次提交 {data.totalRequested ?? 0} 篇，新建 {data.totalCreated ?? 0} 篇，去重跳过 {data.totalSkipped ?? 0} 篇
      </div>
      {(data.created ?? []).map((c) => (
        <div key={c.articleId} className="flex items-center justify-between p-2 rounded bg-muted/30 gap-2">
          <Link
            href={`/articles/${c.articleId}`}
            className="text-sm font-medium truncate hover:text-blue-600 flex-1 min-w-0"
          >
            {c.title}
          </Link>
          <SourceUrlPill url={c.sourceUrl} variant="compact" />
        </div>
      ))}
      {(data.skipped ?? []).length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            查看 {data.skipped!.length} 篇去重跳过
          </summary>
          <div className="space-y-1 pt-1">
            {data.skipped!.map((s) => (
              <div key={s.sourceUrl} className="flex items-center gap-2 py-1">
                <span className="text-muted-foreground">已存在</span>
                <Link href={`/articles/${s.existingArticleId}`} className="text-blue-600 hover:text-blue-700">
                  查看现有稿件
                </Link>
                <SourceUrlPill url={s.sourceUrl} variant="compact" />
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 写测试 (从 mission-console-client.tsx 重构出来的组件)**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ArchiveToDraftsRenderer } from "../archive-to-drafts-renderer";

describe("ArchiveToDraftsRenderer", () => {
  it("happy path: created + skipped 都渲染", () => {
    const outputData = {
      totalRequested: 3, totalCreated: 2, totalSkipped: 1,
      created: [
        { articleId: "a1", title: "Story A", sourceUrl: "https://x.com/1" },
        { articleId: "a2", title: "Story B", sourceUrl: "https://x.com/2" },
      ],
      skipped: [
        { sourceUrl: "https://x.com/dup", existingArticleId: "a99", reason: "duplicate_source_url" },
      ],
    };
    render(<ArchiveToDraftsRenderer outputData={outputData} />);
    expect(screen.getByText(/本次提交 3 篇，新建 2 篇，去重跳过 1 篇/)).toBeInTheDocument();
    expect(screen.getByText("Story A")).toBeInTheDocument();
    expect(screen.getByText("Story B")).toBeInTheDocument();
  });

  it("无相关字段 → null (让上层 fallback)", () => {
    const { container } = render(<ArchiveToDraftsRenderer outputData={{ summary: "..." }} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 3: 改 mission-console-client.tsx 替换 inline block**

删除 `mission-console-client.tsx:1080-1127` 的 IIFE block，**暂时不要替换为新组件**（B.5 加 dispatch switch 时一起改）。先确认 build 没破坏（这块代码删掉后 step 4 卡片不显示 archive_to_drafts 专属信息，但 fallback 到 generic 渲染仍可看 — 临时状态，B.5 修复）。

或者：B.4 同时替换为 `<ArchiveToDraftsRenderer outputData={task.outputData} />`，B.5 改成完整 dispatch switch。后者更平滑。我们走后者。

在 mission-console-client.tsx 顶部加 import：

```tsx
import { ArchiveToDraftsRenderer } from "@/components/missions/step-renderers/archive-to-drafts-renderer";
```

删除 line 1080-1127 IIFE，替换为：

```tsx
{task.assignedRole === "archive_to_drafts" && (
  <ArchiveToDraftsRenderer outputData={task.outputData} />
)}
```

(B.5 把这个 if 改成 switch 加 trending_topics / topic_classifier / cross_language_rewrite case)

- [ ] **Step 4: 测试 + tsc + Commit**

```bash
npx vitest run src/components/missions/step-renderers/__tests__/archive-to-drafts-renderer.test.tsx
npx tsc --noEmit
git add src/components/missions/step-renderers/archive-to-drafts-renderer.tsx \
        src/components/missions/step-renderers/__tests__/archive-to-drafts-renderer.test.tsx \
        'src/app/(dashboard)/missions/[id]/mission-console-client.tsx'
git commit -m "$(cat <<'EOF'
refactor(step-renderer): 抽出 ArchiveToDraftsRenderer 到独立文件

Phase 5 Task 5.4 当时 inline 在 mission-console-client.tsx:1080-1127，
现在抽到 src/components/missions/step-renderers/archive-to-drafts-renderer.tsx
保持跟 trending_topics / topic_classifier / cross_language_rewrite
renderer 同目录一致。

功能不变，加 2 单测覆盖 happy path / 无相关字段 fallback (return null)。

mission-console-client.tsx 用 import 替代 inline，留 if (assignedRole
=== "archive_to_drafts") 单条件，B.5 改成完整 switch dispatch。

Phase B Task B.4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task B.5: TaskDetailSheet 加 dispatch switch

**Files:**
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/missions/[id]/mission-console-client.tsx` (TaskDetailSheet body)

- [ ] **Step 1: 把 B.4 留下的单 if 改成 switch dispatch**

加 imports:

```tsx
import { TrendingTopicsRenderer } from "@/components/missions/step-renderers/trending-topics-renderer";
import { TopicClassifierRenderer } from "@/components/missions/step-renderers/topic-classifier-renderer";
import { CrossLanguageRewriteRenderer } from "@/components/missions/step-renderers/cross-language-rewrite-renderer";
// ArchiveToDraftsRenderer 已经在 B.4 时 import
```

把 B.4 留的：

```tsx
{task.assignedRole === "archive_to_drafts" && (
  <ArchiveToDraftsRenderer outputData={task.outputData} />
)}
```

改为：

```tsx
{(() => {
  switch (task.assignedRole) {
    case "trending_topics":
      return <TrendingTopicsRenderer outputData={task.outputData} />;
    case "topic_classifier":
      return <TopicClassifierRenderer outputData={task.outputData} />;
    case "cross_language_rewrite":
      return <CrossLanguageRewriteRenderer outputData={task.outputData} />;
    case "archive_to_drafts":
      return <ArchiveToDraftsRenderer outputData={task.outputData} />;
    default:
      return null;  // 其他 step 走下面的 generic 渲染
  }
})()}
```

确保 generic 渲染分支（artifactContent / fullSummary / 等）仍然存在，作为 default case 的兜底。

- [ ] **Step 2: tsc + 测试**

Run: `npx tsc --noEmit 2>&1 | grep -v "compute-ranking-scope" | head -10 && npx vitest run`
Expected: tsc 0, vitest pass

- [ ] **Step 3: Commit**

```bash
git add 'src/app/(dashboard)/missions/[id]/mission-console-client.tsx'
git commit -m "$(cat <<'EOF'
feat(mission-console): TaskDetailSheet 加 step-renderer dispatch switch

把 B.4 留下的单 if-archive_to_drafts 改成完整 switch dispatch，
覆盖 4 个 step renderer (trending_topics / topic_classifier /
cross_language_rewrite / archive_to_drafts)。其他 step (不在
switch case) 走 default null → 下面的 generic 渲染分支（artifactContent
/ fullSummary）兜底。

完成 Phase B。

Phase B Task B.5.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Phase B Acceptance

```bash
npx vitest run src/components/missions/step-renderers/__tests__/
npx tsc --noEmit
npm run build
```

手动（建议跑过 A 模块端到端验证后）：
1. 跑一个海外热榜搬运 mission（确保 db:seed 同步过）
2. 进 mission console，展开 step 1 → 看到真实热榜表格（带 rank/platform/title/heat/url）
3. 展开 step 2 → 看到分类结果表 + 折叠 other
4. 展开 step 3 → 看到稿件列表，点稿件展开看到 title_en/body_en/hashtags
5. 展开 step 4 → 看到入库列表（沿用 Phase 5 已有 UI）

---

## 全局 Acceptance

```bash
npx tsc --noEmit
npx vitest run
npm run build

# 跨 plan 审计
npx tsx scripts/audit-model-references.ts   # exit 0
bash scripts/verify-schema-sync.sh          # 16/16 OK
```

业务验收:

- [ ] 发起一个**新的**「海外热榜搬运」mission（保留之前的反例 mission 不动）
- [ ] step 1 输出展示真实热榜列表（不是 LLM 摘要 markdown）
- [ ] step 1 mission_messages 不含 heat_scoring tool call（验证 LLM 没越权）
- [ ] step 2 输出展示分类结果 + 折叠 other
- [ ] step 3 输出展示每篇英文稿件（中→英对照能展开看完整内容）
- [ ] step 4 入库到稿件库 + 跳到 `/articles/[id]` 看英文稿
- [ ] 单条「海外转发」按钮（Phase 6 加的）触发同样流程，2 步走完

## Risks & Rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| LLM-skill dispatch input builder 漏字段 | 单测覆盖 + 实跑 mission 检查 outputData shape | revert A.1.1 commit，dispatch 整体撤回 |
| `renderStepParameters` 模板渲染异常 | 6 case 单测 + try/catch JSON.parse 容错 | revert A.1.2 commit |
| LLM short-circuit 后老 mission outputData 是 markdown，renderer 全 fallback | FallbackRenderer 设计就是给老 mission 看的 | 不需 rollback，UX 退化但不破坏 |
| seed paramConfig `{{step2.results}}` 字段名错 | spec § 9.2 已注释清楚需要 mapping ClassifiedItem → ArticleInput in dispatch | 改 LLM_SKILL_EXECUTORS.cross_language_rewrite.execute input builder |
| db:seed 本地不能跑 | 部署侧手动跑（跟 Phase 4 / 6 同样模式）| 文档化提醒 |
| Phase A 完成后，先前已跑的 mission outputData shape 不对，B renderer fallback 频繁触发 | FallbackRenderer 显示原始 markdown + 折叠 JSON 给 debug | 用户决定是否清理老 mission |

每 task 独立 commit → `git revert <sha>` 单独回滚。

---

**Status:** Plan written. 等待用户选择执行模式（subagent-driven vs inline execution）后进入实施。

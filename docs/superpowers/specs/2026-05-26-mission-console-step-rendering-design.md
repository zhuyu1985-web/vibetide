# Mission Console Step 输出真实化 + LLM 越权隔离 设计

**日期**: 2026-05-26
**作者**: Zhuyu
**状态**: Brainstorming → Spec
**关联**: 跟进 [2026-05-26-overseas-hot-trend-end-to-end-design.md](2026-05-26-overseas-hot-trend-end-to-end-design.md) 的验收发现

---

## 1. 背景

### 1.1 验收发现的问题

用户跑完海外热榜搬运 mission（plan 完成后）验收发现 mission console 输出不符合预期：

**Step 1 「拉取 24h 热榜」** 期望显示拉到的所有热榜内容（30 条 topics 列表），实际显示了一段 LLM 总结性 markdown：

> 【执行摘要】本步骤旨在拉取最近24小时内全网热榜Top 30话题... 经过对热榜中排名靠前的话题进行 heat_scoring 评估和人工分类审核，发现所有话题均未达到70分的热度阈值...

**Step 2 「海外分类过滤」** 期望显示过滤后剩余哪些热榜（含分类标签），未明确实现。

**Step 3 「深读+翻译改写」** 期望显示每篇翻译结果（中英对照），未明确实现。

**Step 4 「入英文稿件库」** Phase 5 Task 5.4 已有 dedicated 渲染。

### 1.2 根本原因分析

阅读 `src/lib/mission-executor.ts:615-946` 发现：

1. **`agent.tools` 未按 step 过滤**: `mission-executor.ts:623-632` 把 `task.assignedRole` 加进 `agent.tools` 确保工具可用，但**没有限定只能用这一个工具**。LLM 拿到 step 1 时同时看到 `heat_scoring / web_search / topic_classifier` 等其他工具（员工绑定的所有 skill），于是 step 1 LLM 越权调了 `heat_scoring` + 提前做了分类审核。

2. **Short-circuit 机制存在但未触发**: `mission-executor.ts:885-946` 当 `preExecUsedTool === true` 时**直接绕过 LLM**，把工具真实结果写入 `outputData` (line 906-914)。但触发条件 (`mission.workflowTemplateId && task.assignedRole + step.config.parameters`) 要求 step 在 seed 里**绑定参数**。`hot_topics_overseas_en` seed 的 step 1-3 都没绑定参数 (`step(1, "拉取 24h 热榜", "trending_topics", ..., "pull")` 第 7 参 paramConfig 缺失) → preExec 不知道传啥参数 → short-circuit 不触发 → LLM 走原路径 + 自由发挥。

3. **Mission console 渲染机制单一**: Phase 5 Task 5.4 只为 `archive_to_drafts` 加 dedicated render。其他 3 step 走 generic LLM markdown 渲染，即使 outputData 是结构化数据也无法清晰展示。

4. **预执行只支持 `invokeToolDirectly`**: `mission-executor.ts:773-820` 调的是 `invokeToolDirectly` (tool-registry 注册的工具)。但 `topic_classifier` / `cross_language_rewrite` 是 LLM-skill (`src/lib/agent/skills/*.ts` 直接调 `generateText`)，不在 tool-registry 里 → 当前无法 short-circuit。

### 1.3 用户反馈摘要

跟用户 4 个澄清确认（详见会话 brainstorming 记录）：

- **修复路径**: C 推荐 — A+B 都做（修 LLM 越权 + 扩展 mission console 渲染）
- **隔离机制**: Prompt + tool whitelist 联合
- **现 mission 处理**: 保留为反例，修完后重跑一个全新的
- **流程**: 轻量 brainstorming → plan → 实现
- **LLM-skill 处理**: 扩展 mission-executor 支持预执行 LLM-skill（不只是 invokeToolDirectly）

## 2. 目标

让 mission console 的每个 step 输出都是**真实工具结果的结构化展示**，且 LLM 不越权跨 step 工作。

非目标:
- 不做 step 输出导出 CSV/JSON / 不做 step 输出之间跳转 / 不做搜索过滤 UI
- 不做 mission-executor 完整重构（仅扩展支持 LLM-skill 预执行）
- 不做 ProseMirror 等富文本渲染 body_en
- 不动现有跑过的 mission（保留为反例对比）

## 3. 总体架构

### 3.1 模块拆分

**A 模块** (LLM 越权隔离 + short-circuit 触发):
- A.1: hot_topics_overseas_en seed step 1-3 绑定参数 + mission-executor 扩展支持 LLM-skill 预执行
- A.2: 4 个 SKILL.md 同步「本 step 只做 X」边界
- A.3: (可选) strict tool whitelist — 若 A.1+A.2 验证不足

**B 模块** (Mission console 4 step dedicated 渲染):
- B.1: `TrendingTopicsRenderer.tsx` — 解析 preExec markdown → 渲染 topics 表格
- B.2: `TopicClassifierRenderer.tsx` — 渲染 ClassifiedItem 列表 (分类徽章 + 置信度 + 理由)
- B.3: `CrossLanguageRewriteRenderer.tsx` — 渲染 RewrittenArticle 列表 (可展开 title_en / body_en / hashtags / cultural_notes)
- B.4: `ArchiveToDraftsRenderer.tsx` — 从 mission-console-client.tsx 抽出（保持现状）

### 3.2 数据流

**修复后**:

```
Step 1 trending_topics
  ↓ mission-executor 检测 paramConfig 绑定 → invokeToolDirectly(trending_topics, {mode:"hot", limit:30})
  ↓ 拿到真实 30 条 topics → 写入 outputData = { ..., text: preExecResultBlock(JSON序列化) }
  ↓ short-circuit 跳过 LLM
  ↓ B.1 TrendingTopicsRenderer 解析 outputData.text 提取 topics 数组
  ↓ 渲染表格

Step 2 topic_classifier (LLM-skill)
  ↓ mission-executor 检测到 LLM-skill 名命中 dispatch 表 → 调 classifyOverseasTopics({topics, enabledCategories})
  ↓ 拿到 {results: ClassifiedItem[]} → 写入 outputData = { ..., results: [...] }
  ↓ short-circuit 跳过 executeAgent
  ↓ B.2 TopicClassifierRenderer 渲染分类表

Step 3 cross_language_rewrite (LLM-skill)
  ↓ 同 step 2 模式调 crossLanguageRewriteArticles({articles, targetLanguage, variantsPerTopic})
  ↓ outputData = { ..., articles: RewrittenArticle[] }
  ↓ B.3 CrossLanguageRewriteRenderer 渲染稿件列表

Step 4 archive_to_drafts (现已 short-circuit)
  ↓ B.4 ArchiveToDraftsRenderer (从 inline 抽出)
```

### 3.3 LLM-skill 预执行 dispatch

新增 `src/lib/agent/llm-skill-dispatch.ts`:

```typescript
// 把 LLM-skill name → 具体函数 + 入参 builder 的映射集中
interface LLMSkillExecutor {
  skillName: string;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

export const LLM_SKILL_EXECUTORS: Record<string, LLMSkillExecutor> = {
  topic_classifier: {
    skillName: "topic_classifier",
    execute: async (params) => {
      // 从 params 取出 topics + enabledCategories，按 classifyOverseasTopics 签名调
      return classifyOverseasTopics({...});
    },
  },
  cross_language_rewrite: { /* ... */ },
};

export function isLLMSkillRegistered(name: string): boolean {
  return name in LLM_SKILL_EXECUTORS;
}

export async function invokeLLMSkillDirectly(
  name: string,
  params: Record<string, unknown>
): Promise<{ ok: boolean; toolName: string; params: Record<string, unknown>; result?: unknown; error?: string }> {
  const executor = LLM_SKILL_EXECUTORS[name];
  if (!executor) return { ok: false, toolName: name, params, error: "not registered" };
  try {
    const result = await executor.execute(params);
    return { ok: true, toolName: name, params, result };
  } catch (err) {
    return { ok: false, toolName: name, params, error: err instanceof Error ? err.message : String(err) };
  }
}
```

`mission-executor` 的预执行逻辑 (line 670-820 附近) 改为先查 `isLLMSkillRegistered(task.assignedRole)`，命中则调 `invokeLLMSkillDirectly`，否则原 `invokeToolDirectly` 流程。

## 4. 模块详细设计

### 4.1 A.1 — Seed 绑定参数 + mission-executor LLM-skill 预执行

**改动文件**:
- `src/db/seed-builtin-workflows.ts` — hot_topics_overseas_en step 1-3 加 paramConfig
- `src/lib/agent/llm-skill-dispatch.ts` — **新增**
- `src/lib/mission-executor.ts` — 预执行分支加 LLM-skill dispatch

**Seed 改动** (`hot_topics_overseas_en` lines 2257-2272 附近):

```ts
steps: [
  step(1, "拉取 24h 热榜", "trending_topics", "热榜聚合", "data_collection", "pull",
    { mode: "hot", limit: "{{topic_limit}}" }),
  step(2, "海外分类过滤", "topic_classifier", "海外热榜分类", "content_analysis", "classify",
    {
      topics: "{{step1.topics}}",  // 从 step 1 outputData 取
      enabledCategories: "{{categories}}",  // 从 mission inputParams 取
    }),
  step(3, "深读+翻译改写", "cross_language_rewrite", "中英本地化改写", "content_gen", "translate",
    {
      articles: "{{step2.classified_articles}}",  // step 2 输出过滤后的文章
      targetLanguage: "en",
      variantsPerTopic: "{{variants_per_topic}}",
    }),
  step(4, "入英文稿件库（待审）", "archive_to_drafts", "稿件入库", "distribution", "store",
    { language: "en", initialStatus: "approved" }),  // 现状
],
```

**关键约定**: `{{stepN.field}}` 模板从 `previousSteps[N-1].outputData.field` 解析（mission-executor 已有 `previousSteps` 注入机制，line 953-957）。需要在 mission-executor 加 paramConfig 模板渲染时支持这种引用。

**mission-executor 改动** (line 670-820):

```typescript
if (mission.workflowTemplateId && task.assignedRole) {
  try {
    const tpl = await db.query.workflowTemplates.findFirst({...});
    const step = (tpl?.steps as Step[] | undefined)?.find(s => s.config?.skillSlug === task.assignedRole);
    if (step?.config?.parameters && Object.keys(step.config.parameters).length > 0) {
      // 渲染参数（支持 {{step1.topics}} 引用 previousSteps）
      const rendered = renderStepParameters(step.config.parameters, mission, previousSteps);

      // ── 新增：先检查 LLM-skill dispatch
      if (isLLMSkillRegistered(task.assignedRole)) {
        const invocation = await invokeLLMSkillDirectly(task.assignedRole, rendered);
        if (invocation.ok) {
          // 写入 outputData 结构化结果
          await db.update(missionTasks).set({
            status: "completed",
            outputData: {
              stepKey: task.id,
              employeeSlug: agent.slug,
              summary: `${task.assignedRole} LLM-skill 真实调用完成`,
              ...invocation.result,  // {results: [...]} or {articles: [...]}
              metrics: { qualityScore: 90 },
              status: "success",
            },
            progress: 100,
            completedAt: new Date(),
          }).where(eq(missionTasks.id, taskId));
          // 跳过 executeAgent
          return { status: "completed", taskId };
        }
        // 失败 fallthrough 到 LLM 路径（用 prompt 引导）
      }

      // 原 invokeToolDirectly 分支不变
      const invocation = await invokeToolDirectly(task.assignedRole, rendered, {...});
      // ...
    }
  } catch (...) {}
}
```

**`renderStepParameters` 实现** (新增辅助函数):

```typescript
function renderStepParameters(
  template: Record<string, unknown>,
  mission: Mission,
  previousSteps: StepOutput[]
): Record<string, unknown> {
  // 支持 {{key}} = mission.inputParams[key]
  // 支持 {{stepN.field}} = previousSteps[N-1].outputData[field]
  const rendered: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(template)) {
    if (typeof v === "string") {
      rendered[k] = v.replace(/\{\{([^}]+)\}\}/g, (_, expr) => {
        const stepMatch = expr.match(/^step(\d+)\.(.+)$/);
        if (stepMatch) {
          const stepIdx = parseInt(stepMatch[1], 10) - 1;
          const field = stepMatch[2];
          return JSON.stringify(previousSteps[stepIdx]?.outputData?.[field] ?? null);
        }
        return String(mission.inputParams?.[expr] ?? "");
      });
      // 如果整个 v 就是单个 {{...}} 且解析后是 array/object，回 JSON.parse
      // 否则保留 string
      try {
        rendered[k] = JSON.parse(rendered[k] as string);
      } catch { /* 保留 string */ }
    } else {
      rendered[k] = v;
    }
  }
  return rendered;
}
```

**验收**:
1. seed 4 step 都有非空 paramConfig
2. mission-executor.test.ts 加测试: LLM-skill 注册的 skill 走 dispatch，写入 outputData
3. hot_topics_overseas_en 实跑：step 1 outputData 含 topics 数组 + JSON 结构，step 2 outputData 含 results，step 3 outputData 含 articles
4. **不破坏** 其他 workflow（仅 hot_topics_overseas_en 受影响 + LLM-skill dispatch 是新增不是修改）

### 4.2 A.2 — 4 个 SKILL.md 同步「本 step 只做 X」边界

**改动文件**:
- `skills/trending_topics/SKILL.md`
- `skills/topic-classifier/SKILL.md`
- `skills/cross-language-rewrite/SKILL.md`
- `skills/archive-to-drafts/SKILL.md`

**每个 SKILL.md 在「使用条件」之后追加「步骤边界」段** (示例 trending_topics):

```markdown
## 步骤边界 (Step Boundary)

本 skill 在工作流里作为 step 1 (数据获取)，**只产出原始热榜数据列表**。

禁止跨步:
- 不要替 step 2 (topic_classifier) 做分类筛选，把全量原始数据交出去就行
- 不要调用 heat_scoring 工具评估热度 —— 那不是本 step 的工作
- 不要调用 web_search / news_aggregation 补充信息 —— 工作流里有专门的 step

如果真实结果为空 (0 条 topics)，**如实输出"无结果"**，不要从训练数据里补话题。
```

类似边界段写在另外 3 个 SKILL.md。

**验收**: 每个 SKILL.md 包含「步骤边界」段 + 步骤特定的禁令清单。

### 4.3 A.3 — Strict tool whitelist (可选)

只在 A.1 + A.2 验证不足时启用。改动 `mission-executor.ts:623-632`:

```typescript
if (task.assignedRole && !agent.tools.some((t) => t.name === task.assignedRole)) {
  agent.tools = [
    ...agent.tools,
    { name: task.assignedRole, description: `工作流指定的执行技能：${task.title}`, parameters: {} },
  ];
}

// 改成: 强制只保留 assignedRole 工具 (剥离员工其他能力)
if (task.assignedRole) {
  agent.tools = agent.tools.filter(t => t.name === task.assignedRole);
  if (agent.tools.length === 0) {
    agent.tools = [{ name: task.assignedRole, description: ..., parameters: {} }];
  }
}
```

代价: 失去 LLM 临时调用 web_search 等的能力。收益: 越权根治。

**A.3 决策延后**: A.1 + A.2 实施后实跑 hot_topics_overseas_en mission 看 step 1 LLM 是否还越权调 heat_scoring。如果不调了 → 不做 A.3。如果还调 → 做 A.3。

### 4.4 B.1 — `TrendingTopicsRenderer`

**改动文件**:
- 新建 `src/components/missions/step-renderers/trending-topics-renderer.tsx`
- 修改 `src/app/(dashboard)/missions/[id]/mission-console-client.tsx` 加 dispatch

**组件签名**:

```tsx
"use client";

interface TrendingTopicsRendererProps {
  outputData: unknown;  // 期望 shape: { topics: TrendingItem[], crossPlatformTopics?: [...], warnings?: [...] } 
                        // 或 short-circuit 后的 { text: markdown string } 含 JSON 块
}

export function TrendingTopicsRenderer({ outputData }: TrendingTopicsRendererProps) {
  const topics = useMemo(() => extractTopics(outputData), [outputData]);
  
  if (topics === null) return <FallbackLLMRenderer outputData={outputData} reason="无法解析 trending_topics 输出" />;
  if (topics.length === 0) return <EmptyState message="无热榜结果" />;
  
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-3">
        拉取 {topics.length} 条热榜 · 涉及 {uniquePlatforms(topics)} 个平台
      </div>
      <DataTable
        rows={topics}
        rowKey={(t) => `${t.platform}-${t.rank}`}
        columns={[
          { key: "rank", header: "#", width: "w-12", align: "right", render: (t) => t.rank },
          { key: "platform", header: "平台", width: "w-24", render: (t) => <PlatformTag name={t.platform} /> },
          { key: "title", header: "标题", render: (t) => t.title },
          { key: "heat", header: "热度", width: "w-24", align: "right", render: (t) => t.heat },
          { key: "url", header: "链接", width: "w-32", render: (t) => <SourceUrlPill url={t.url} variant="compact" /> },
        ]}
      />
    </div>
  );
}

function extractTopics(outputData: unknown): TrendingItem[] | null {
  if (!outputData) return null;
  // Case A: short-circuit 写入的结构化 outputData { topics: [...] }
  if (typeof outputData === "object" && outputData !== null) {
    const obj = outputData as Record<string, unknown>;
    if (Array.isArray(obj.topics)) return obj.topics as TrendingItem[];
    // Case B: short-circuit text field 含 JSON 块
    if (typeof obj.text === "string") {
      const match = obj.text.match(/```json\s*\n([\s\S]*?)\n```/);
      if (match) {
        try {
          const parsed = JSON.parse(match[1]);
          if (Array.isArray(parsed.topics)) return parsed.topics;
        } catch { return null; }
      }
    }
  }
  return null;
}
```

**Fallback path**: 数据无法解析 → 渲染 generic LLM markdown + 顶部红色提示「本 step 应直出工具结果但实际走了 LLM」。

### 4.5 B.2 — `TopicClassifierRenderer`

**改动文件**:
- 新建 `src/components/missions/step-renderers/topic-classifier-renderer.tsx`

```tsx
interface TopicClassifierRendererProps {
  outputData: unknown;
}

const CATEGORY_BADGES: Record<string, { emoji: string; color: string }> = {
  food: { emoji: "🍜", color: "amber" },
  pets: { emoji: "🐾", color: "pink" },
  domestic_tech: { emoji: "📱", color: "blue" },
  other: { emoji: "📂", color: "gray" },
};

export function TopicClassifierRenderer({ outputData }: TopicClassifierRendererProps) {
  const { passed, other } = useMemo(() => extractClassified(outputData), [outputData]);

  if (passed === null) return <FallbackLLMRenderer ... />;

  return (
    <div>
      <div className="text-xs text-muted-foreground mb-3">
        过滤通过 {passed.length} 条 (
        {Object.entries(groupByCategory(passed)).map(([cat, n]) => `${cat}: ${n}`).join(", ")}
        )
      </div>
      <DataTable
        rows={passed}
        rowKey={(r) => r.id}
        columns={[
          { key: "id", header: "ID", width: "w-20", render: (r) => r.id },
          { key: "category", header: "分类", width: "w-32", render: (r) => <CategoryBadge value={r.category} /> },
          { key: "confidence", header: "置信度", width: "w-20", render: (r) => r.confidence.toFixed(2) },
          { key: "reason", header: "理由", render: (r) => r.reason },
          { key: "sourceUrl", header: "原文", width: "w-20", render: (r) => <SourceUrlPill url={r.sourceUrl} variant="compact" /> },
        ]}
      />
      {other.length > 0 && (
        <details className="mt-3 text-xs">
          <summary>被过滤为 other 的 {other.length} 条 (点击展开)</summary>
          {/* same DataTable but with other rows, less prominently styled */}
        </details>
      )}
    </div>
  );
}
```

### 4.6 B.3 — `CrossLanguageRewriteRenderer`

**改动文件**:
- 新建 `src/components/missions/step-renderers/cross-language-rewrite-renderer.tsx`

```tsx
export function CrossLanguageRewriteRenderer({ outputData }) {
  const articles = useMemo(() => extractArticles(outputData), [outputData]);
  if (articles === null) return <FallbackLLMRenderer ... />;
  
  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        翻译改写 {articles.length} 篇英文稿件
      </div>
      {articles.map(a => (
        <details key={a.id} className="rounded bg-muted/30 p-3">
          <summary className="cursor-pointer flex items-center gap-2">
            <code className="text-xs">{a.id}</code>
            <CategoryBadge value={a.category} compact />
            <span className="text-sm font-medium flex-1">{a.title_en}</span>
            <SourceUrlPill url={a.sourceUrl} variant="compact" />
          </summary>
          <div className="mt-3 space-y-2 text-sm">
            <div>
              <h5 className="text-xs font-medium text-muted-foreground mb-1">Body (EN)</h5>
              <pre className="whitespace-pre-wrap text-sm">{a.body_en}</pre>
            </div>
            <div className="flex flex-wrap gap-1">
              {a.hashtags.map(tag => <span key={tag} className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/20 rounded">{tag}</span>)}
            </div>
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

### 4.7 B.4 — `ArchiveToDraftsRenderer` (抽出)

**改动文件**:
- 新建 `src/components/missions/step-renderers/archive-to-drafts-renderer.tsx` (从 mission-console-client.tsx 抽出)
- 修改 `src/app/(dashboard)/missions/[id]/mission-console-client.tsx` 引用新组件

Phase 5 Task 5.4 已经写过 inline，这次抽到独立文件保持一致性。功能不变。

### 4.8 TaskDetailSheet 加 dispatch switch

**改动文件**:
- `src/app/(dashboard)/missions/[id]/mission-console-client.tsx` — TaskDetailSheet body 加 switch

```tsx
function TaskDetailBody({ task }) {
  // 已有: 上游 inputs 渲染 / artifactContent / fullSummary 等

  // 新增 step-specific dispatch
  const stepRenderer = useMemo(() => {
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
        return null;
    }
  }, [task.assignedRole, task.outputData]);

  return (
    <div>
      {/* existing upstream inputs */}
      {stepRenderer ?? <GenericLLMRenderer summary={...} artifacts={...} />}
      {/* fallback */}
    </div>
  );
}
```

**与 Phase 5 兼容**: 现 archive_to_drafts inline 渲染会被新组件替代，但 fallback path 保持 (`stepRenderer ?? generic`)。

## 5. 执行顺序

```
A.1.1 写 llm-skill-dispatch.ts + 单测
A.1.2 改 mission-executor.ts 加 LLM-skill dispatch + renderStepParameters 单测
A.1.3 改 seed-builtin-workflows.ts 给 hot_topics_overseas_en step 1-3 加 paramConfig
       (db:seed 需用户手动跑同步)
A.2   写 4 个 SKILL.md「步骤边界」段
[A.3  延后决策]
B.1   写 TrendingTopicsRenderer + 单测
B.2   写 TopicClassifierRenderer + 单测
B.3   写 CrossLanguageRewriteRenderer + 单测
B.4   抽出 ArchiveToDraftsRenderer + 单测
B.5   TaskDetailSheet 加 dispatch switch
E2E   端到端实跑 hot_topics_overseas_en 验收
```

每个子任务独立 commit 落 main。共 9-11 commits。

## 6. 测试策略

| 模块 | 测试 |
|---|---|
| A.1.1 llm-skill-dispatch | 单测每个 LLM-skill executor 入参 builder + invokeLLMSkillDirectly 错误处理 |
| A.1.2 mission-executor | 单测 dispatch 命中 LLM-skill 时 short-circuit / 不命中 fallthrough / renderStepParameters 字符串/array/object 各种类型 |
| A.1.3 seed | 单测 hot_topics_overseas_en 4 step 都有非空 paramConfig |
| A.2 SKILL.md | 手动 review |
| B.1-B.4 renderer | 单测各渲染器 (happy path 结构化 outputData / fallback path text/null/不识别 shape) |
| B.5 dispatch | 单测 switch 命中各 case + default fallback |

## 7. 边界与风险

| 风险 | 缓解 |
|---|---|
| LLM-skill 接口签名不统一 | llm-skill-dispatch 加入参 builder layer 抹平差异 |
| 老 mission 没 short-circuit 跑过，outputData 是 LLM markdown | renderer 有 fallback 路径，老 mission 仍可看 |
| Seed 改了需重跑 db:seed | 文档化 + checkpoint 提醒 (跟 Phase 4/6 一致) |
| `{{stepN.field}}` 模板渲染失败 | invocation 失败 fallthrough 到 LLM 路径 (兜底已存在) |
| topic_classifier / cross_language_rewrite 之前在 chat 等场景用，A.1.2 改 mission-executor 不影响 chat | LLM-skill dispatch 只在 mission-executor 调用，chat 场景不受影响 |

## 8. 范围排除

- 不做 step 输出 CSV/JSON 导出
- 不做 step 之间跳转链接
- 不做 step 输出搜索/过滤 UI
- 不做 body_en 富文本编辑器 (plain `<pre>` 即可)
- 不做 mission-executor 完整重构
- 不动 chat 中心调用 LLM-skill 的现有路径
- 不动现已跑过的 mission (保留为反例对比)
- A.3 strict tool whitelist 延后决策

## 9. 后续 spec 候选

- mission console 输出全局搜索 / CSV 导出
- 工作流编辑器的 paramConfig UI (当前 paramConfig 只能改 seed 文件)
- LLM-skill 注册中心化 (`tool-registry` 形式，跨场景统一)

---

**状态**: Brainstorming 完成；进入 writing-plans 阶段。

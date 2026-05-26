# 海外热榜搬运端到端优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 VibeTide 已有的「海外热榜搬运」公共场景从「能跑」升级为「真实数据 + 灵活配置 + 多稿入库 + 闭环可查」端到端能力，并新增单条热点的"海外转发"快捷入口。

**Architecture:** 6 个解耦模块串行 commit 到 main。M1 修 skill 测试入口直调真工具；M2 模型路由统一 qwen3-max；M3 让 topic_classifier 动态接受用户加的分类；M4 sourceUrl 透传 + variants + 新建 `archive_to_drafts` 工具（只落本地 articles 表）；M5 把 sourceUrl 渲染到预览/翻译/mission console 3 处；M6 inspiration 卡片加"海外转发"按钮 + 2 步简化工作流。

**Tech Stack:** Next.js 16 App Router, TypeScript 5 strict, Drizzle ORM, AI SDK v6 (qwen3-max via OpenAI-compatible), Vitest, Tailwind v4, shadcn/ui.

**Spec:** [`docs/superpowers/specs/2026-05-26-overseas-hot-trend-end-to-end-design.md`](../specs/2026-05-26-overseas-hot-trend-end-to-end-design.md)

---

## 全局 File Structure

下面是 6 个 phase 涉及的所有文件清单。每行格式：`<操作> <路径> — <职责>`。

### 新建文件

| 文件 | 职责 | 所属 Phase |
|---|---|---|
| `src/components/shared/source-url-pill.tsx` | 共享原文链接 chip 组件（变体 default/compact） | M5 |
| `skills/archive-to-drafts/SKILL.md` | archive_to_drafts skill 文档 | M4 |
| `scripts/audit-model-references.ts` | grep 全仓 deepseek/glm/zhipu 字符串审计 | M2（可选） |

### 修改文件

| 文件 | 改动概要 | 所属 Phase |
|---|---|---|
| `src/app/actions/employee-advanced.ts` | testSkillExecution 改为优先调真工具；删 `\|\| "deepseek-chat"` fallback | M1, M2 |
| `src/app/(dashboard)/skills/[id]/skill-detail-client.tsx` | 测试 UI 微调（参数示例 + dryRun 横幅 + label 改"真实输出"） | M1 |
| `src/lib/agent/skills/topic-classifier.ts` | schema 改运行时构造 + sourceUrl 透传 | M3, M4 |
| `src/lib/agent/skills/cross-language-rewrite.ts` | categoryHint enum → string；schema 加 sourceUrl/variants/sourceTopicId/variantIndex | M3, M4 |
| `src/lib/agent/tool-registry.ts` | 新增 `archive_to_drafts` 工具定义 | M4 |
| `src/db/seed-builtin-workflows.ts` | hot_topics_overseas_en step 4 切到 archive_to_drafts + 加 variants_per_topic；末尾新增 hot_topic_single_overseas_repost seed | M4, M6 |
| `src/lib/types.ts` | InputFieldDef 加 `hidden?: boolean` | M6 |
| `src/components/workflows/workflow-launch-dialog.tsx` | 渲染时跳过 hidden 字段 | M6 |
| `src/components/workflows/input-fields-editor.tsx` | categories 字段加 helper text + "恢复默认 3 类"按钮 | M3 |
| `src/app/(dashboard)/articles/[id]/features/reader/meta-header.tsx` | 接入 SourceUrlPill | M5 |
| `src/app/(dashboard)/articles/[id]/features/translate/translate-overlay.tsx` | 接入 SourceUrlPill | M5 |
| `src/app/(dashboard)/missions/[id]/mission-console-client.tsx` | step 4 卡片识别 archive_to_drafts → 渲染 created/skipped 列表 + SourceUrlPill | M5 |
| `src/app/actions/hot-topics.ts` | 新增 `startOverseasRepost(topicId)` | M6 |
| `src/app/(dashboard)/inspiration/inspiration-client.tsx` | 卡片加"海外转发"按钮 + handler + 透传 prop | M6 |
| `src/db/schema/missions.ts` | sourceModule 注释加 `hot_topics_overseas` 新值 | M6 |
| 13 个 `skills/*/SKILL.md` | frontmatter `modelDependency: deepseek:*` → `openai:qwen3-max` | M2 |

### 新建测试

| 测试文件 | 覆盖范围 | 所属 Phase |
|---|---|---|
| `src/app/actions/__tests__/test-skill-execution.test.ts` | testSkillExecution 真工具 path + LLM fallback path + dryRun 路径 | M1 |
| `src/lib/agent/skills/__tests__/topic-classifier.test.ts` | 动态 enum / sourceUrl 透传 / 兜底 other | M3, M4 |
| `src/lib/agent/skills/__tests__/cross-language-rewrite.test.ts` | variants 输出 / sourceUrl 透传 / id 格式 / categoryHint string | M3, M4 |
| `src/lib/agent/__tests__/archive-to-drafts.test.ts` | batch 入库 / sourceUrl 去重 / dryRun 短路 | M4 |
| `src/app/actions/__tests__/start-overseas-repost.test.ts` | dedup 复用现有 mission / 不同 sourceModule 与快速追踪共存 | M6 |

---

## Phase 1 (M1) — Skill 测试入口真实化

**目标**: `/skills/[id]` "测试" 按钮检测到 skill.name 在 tool-registry 注册 → 直调真工具 → 显示真实数据；写入型工具自动 dryRun；未注册 skill 沿用 LLM 演示。

**改动文件**:
- `src/app/actions/employee-advanced.ts:196-410`（testSkillExecution）
- `src/app/(dashboard)/skills/[id]/skill-detail-client.tsx`（UI label/示例）
- `src/lib/agent/tool-registry.ts`（写入型工具 dryRun 分支）
- Test: `src/app/actions/__tests__/test-skill-execution.test.ts`

### Task 1.1: 工具映射 & dryRun 写入工具白名单

**Files:**
- Modify: `src/app/actions/employee-advanced.ts:196`
- Test: `src/app/actions/__tests__/test-skill-execution.test.ts`（新建）

- [ ] **Step 1: 新建测试文件骨架，写第一个 fail 测试**

```ts
// src/app/actions/__tests__/test-skill-execution.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock db / auth before importing the action
vi.mock("@/lib/auth/current-user", () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: "user-test" }),
}));
vi.mock("@/db", () => ({
  db: {
    query: {
      skills: {
        findFirst: vi.fn().mockResolvedValue({
          id: "skill-trending",
          name: "trending_topics",
          category: "data_collection",
          version: "3.0",
          description: "热榜聚合",
          content: "## SKILL.md content",
          inputSchema: { mode: "string", limit: "number" },
          outputSchema: { topics: "array" },
          runtimeConfig: null,
          type: "tool",
          pluginConfig: null,
        }),
      },
    },
  },
}));

const invokeToolDirectlyMock = vi.fn();
vi.mock("@/lib/agent/tool-registry", async () => {
  const actual = await vi.importActual<typeof import("@/lib/agent/tool-registry")>(
    "@/lib/agent/tool-registry",
  );
  return {
    ...actual,
    isToolRegistered: (name: string) => name === "trending_topics" || name === "archive_to_drafts",
    invokeToolDirectly: invokeToolDirectlyMock,
  };
});

import { testSkillExecution } from "../employee-advanced";

beforeEach(() => {
  invokeToolDirectlyMock.mockReset();
  process.env.OPENAI_API_KEY = "sk-test";
  process.env.OPENAI_MODEL = "qwen3-max";
  process.env.OPENAI_API_BASE_URL = "https://example/v1";
});

describe("testSkillExecution real-tool path", () => {
  it("调用真工具并返回真实 payload，runtimeInfo.type 标 Tool", async () => {
    invokeToolDirectlyMock.mockResolvedValueOnce({
      ok: true,
      toolName: "trending_topics",
      params: { mode: "hot", limit: 20 },
      result: { topics: [{ title: "成都串串香", url: "https://weibo.com/x" }], fetchedAt: "2026-05-26T12:00:00Z" },
    });
    const res = await testSkillExecution("skill-trending", JSON.stringify({ mode: "hot", limit: 20 }));
    expect(res.runtimeInfo.type).toMatch(/Tool/);
    expect(res.executionResult?.success).toBe(true);
    expect(res.executionResult?.output).toContain("成都串串香");
    expect(res.validationChecks.some(c => c.check === "工具发现" && c.status === "pass")).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/app/actions/__tests__/test-skill-execution.test.ts -t "调用真工具"`
Expected: FAIL — 当前 testSkillExecution 不走 invokeToolDirectly，runtimeInfo.type 是 `LLM (qwen3-max)` 而非 `Tool`。

- [ ] **Step 3: 在 testSkillExecution 加入"真工具优先"分支**

在 `src/app/actions/employee-advanced.ts` 顶部加导入：

```ts
import { invokeToolDirectly, isToolRegistered } from "@/lib/agent/tool-registry";
```

在 `testSkillExecution` 函数体（取完 `skill` 之后、`systemPromptParts` 构造之前，约 215 行附近）插入新分支：

```ts
// ─── 真工具优先路径（M1） ─────────────────────────────────────────────
// 当 skill.name 在 tool-registry 注册（如 trending_topics / topic_classifier
// / archive_to_drafts），直接 server-side 调真工具，不走 LLM 编故事。
const WRITE_TOOLS = new Set([
  "cms_publish",
  "archive_to_drafts",
  "cms_catalog_sync",
  "external_publish",
]);

if (isToolRegistered(skill.name)) {
  // 1. 解析 testInput：JSON 优先，否则尝试默认值
  let parsedInput: Record<string, unknown> = {};
  const trimmed = testInput.trim();
  if (trimmed.startsWith("{")) {
    try {
      parsedInput = JSON.parse(trimmed);
    } catch {
      parsedInput = {};
    }
  }

  // 2. 写入型工具强制 dryRun
  const isWriteTool = WRITE_TOOLS.has(skill.name);
  if (isWriteTool) {
    parsedInput.dryRun = true;
  }

  // 3. 调用真工具，30s 超时
  const startTime = Date.now();
  const invocation = await invokeToolDirectly(skill.name, parsedInput, {
    organizationId: undefined,  // 测试入口当前无 mission 上下文；写入型自带 dryRun 短路
    operatorId: user.id,
  });
  const durationMs = Date.now() - startTime;

  const serialized = invocation.ok
    ? JSON.stringify(invocation.result, null, 2)
    : `Tool 调用失败: ${invocation.error}`;
  const truncated = serialized.length > 8000
    ? serialized.slice(0, 8000) + "\n... (结果过长已截断)"
    : serialized;

  return {
    skillName: skill.name,
    skillCategory: skill.category,
    skillVersion: skill.version,
    description: skill.description,
    testInput,
    inputSchema,
    outputSchema,
    runtimeInfo: {
      type: `Tool (真实接口${isWriteTool ? " · dryRun" : ""})`,
      estimatedLatency: `${durationMs}ms`,
      maxConcurrency: 1,
      modelDependency: skill.name,  // 用工具名展示，UI 知道是哪个真接口
    },
    expectedBehavior: invocation.ok
      ? `[真实调用] ${skill.name} 已成功执行，返回结构化数据见下方 output`
      : `[真实调用失败] ${skill.name}: ${(invocation as { error?: string }).error ?? "unknown"}`,
    executionResult: {
      success: invocation.ok,
      output: truncated,
      error: invocation.ok ? undefined : (invocation as { error?: string }).error,
      durationMs,
    },
    validationChecks: [
      {
        check: "工具发现",
        status: "pass" as const,
        detail: `tool-registry 命中 ${skill.name}${isWriteTool ? "（自动 dryRun 防污染）" : ""}`,
      },
      {
        check: "参数校验",
        status: invocation.ok ? ("pass" as const) : ("fail" as const),
        detail: invocation.ok
          ? `输入参数已传给工具：${JSON.stringify(parsedInput).slice(0, 200)}`
          : `工具拒绝参数: ${(invocation as { error?: string }).error ?? "unknown"}`,
      },
      {
        check: "外部接口",
        status: invocation.ok ? ("pass" as const) : ("fail" as const),
        detail: invocation.ok
          ? `调用成功，耗时 ${durationMs}ms`
          : `调用失败: ${(invocation as { error?: string }).error ?? "unknown"}`,
      },
    ],
  };
}
// ─── 旧 LLM 演示路径保持不变（下方 systemPromptParts 构造继续） ─────
```

注意：`isToolRegistered` 当前 export 在 [tool-registry.ts:1203](src/lib/agent/tool-registry.ts:1203)，直接 import 即可。

- [ ] **Step 4: 运行测试验证通过**

Run: `npx vitest run src/app/actions/__tests__/test-skill-execution.test.ts -t "调用真工具"`
Expected: PASS

- [ ] **Step 5: tsc + commit**

```bash
npx tsc --noEmit
git add src/app/actions/employee-advanced.ts src/app/actions/__tests__/test-skill-execution.test.ts
git commit -m "$(cat <<'EOF'
feat(skill-test): 测试入口检测到注册工具时直调真实接口

把 testSkillExecution 改成"工具优先"——skill.name 命中 tool-registry
时不再让 LLM 编故事，直接 server-side 调 invokeToolDirectly 拿真
数据。写入型工具白名单（cms_publish/archive_to_drafts/...）自动注入
dryRun=true 防止测试污染 DB。未注册的纯文档型 skill 沿用旧 LLM
演示路径。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 1.2: cms_publish 工具加 dryRun 短路（必须在 articles insert 之前）

**Files:**
- Modify: `src/lib/agent/tool-registry.ts:1046-1200`（cms_publish.execute）
- Test: `src/app/actions/__tests__/test-skill-execution.test.ts`（追加测试）

- [ ] **Step 1: 追加测试验证 dryRun 不入库**

在前述测试文件末尾追加：

```ts
describe("testSkillExecution write-tool dryRun", () => {
  it("cms_publish 测试入口自动注入 dryRun=true，工具不写 DB", async () => {
    // mock skill 行为 cms_publish
    const skillsMock = vi.mocked((await import("@/db")).db.query.skills.findFirst);
    skillsMock.mockResolvedValueOnce({
      id: "skill-cms",
      name: "cms_publish",
      category: "distribution",
      version: "1.0",
      description: "发到 CMS",
      content: "",
      inputSchema: {},
      outputSchema: {},
      runtimeConfig: null,
      type: "tool",
      pluginConfig: null,
    } as never);

    invokeToolDirectlyMock.mockResolvedValueOnce({
      ok: true,
      toolName: "cms_publish",
      params: { title: "X", body: "Y", dryRun: true },
      result: { dryRun: true, wouldInsert: { title: "X", body: "Y" }, note: "dry-run, no DB write" },
    });

    await testSkillExecution("skill-cms", JSON.stringify({ title: "X", body: "Y" }));
    expect(invokeToolDirectlyMock).toHaveBeenCalledWith(
      "cms_publish",
      expect.objectContaining({ dryRun: true }),
      expect.anything(),
    );
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/app/actions/__tests__/test-skill-execution.test.ts -t "cms_publish 测试入口自动注入 dryRun"`
Expected: PASS（Task 1.1 的代码里已经自动注入 dryRun；本步只是回归测试，应该过）

如果不过，回去检查 Task 1.1 实现里 WRITE_TOOLS 集合是否含 `cms_publish`。

- [ ] **Step 3: 在 cms_publish 工具内加 dryRun 短路（articles insert 之前）**

修改 `src/lib/agent/tool-registry.ts:1046` 的 cms_publish 工具：

a) inputSchema 加 `dryRun: z.boolean().optional()`：

```ts
inputSchema: z.object({
  title: z.string().describe("稿件标题"),
  body: z.string().describe("稿件正文..."),
  summary: z.string().optional().describe("摘要"),
  authorName: z.string().optional().describe("作者..."),
  coverImageUrl: z.string().optional().describe("封面图 URL"),
  tags: z.array(z.string()).optional().describe("标签数组"),
  dryRun: z.boolean().optional().describe("dry-run 模式，不写 DB 不调 CMS，用于 skill 测试入口"),
  organizationId: z.string().optional(),
  operatorId: z.string().optional(),
}),
```

b) execute 函数体在 organizationId 校验之后、`db.insert(articles)` 之前插入：

```ts
// ─── dryRun 短路（M1 验收：测试入口不污染 DB / 不调 CMS） ────────
if (dryRun) {
  return {
    success: true,
    dryRun: true,
    wouldInsert: { title, body, summary, organizationId, tags: tags ?? [] },
    wouldPublish: { appId: 1768, catalogId: 10210, siteId: 81, authorName: authorName ?? "AI 编辑部" },
    note: "dry-run: 实际跑会先 insert articles 行（status=approved）再调 publishArticleToCms 9 步流程",
  };
}
// ─────────────────────────────────────────────────────────────────
```

同时在 `execute` 的解构里加 `dryRun`：`async ({ title, body, summary, authorName, coverImageUrl, tags, dryRun, organizationId, operatorId }) => {`

- [ ] **Step 4: 运行测试 + 全量回归**

```bash
npx vitest run src/app/actions/__tests__/test-skill-execution.test.ts
npx tsc --noEmit
```
Expected: 所有 PASS, tsc 0 错误

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent/tool-registry.ts src/app/actions/__tests__/test-skill-execution.test.ts
git commit -m "$(cat <<'EOF'
feat(cms-publish): 加 dryRun 短路，articles insert 之前 return mock

测试入口（M1）会对写入型工具自动注入 dryRun=true。cms_publish 的
dryRun 分支必须放在 db.insert(articles) 之前——否则测试仍会污染
articles 表导致 M1 验收（SELECT count(*) 不变）失败。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 1.3: 测试 UI 微调（label + 参数示例 + dryRun 横幅）

**Files:**
- Modify: `src/app/(dashboard)/skills/[id]/skill-detail-client.tsx:712-840`（测试结果区）

- [ ] **Step 1: 加参数示例字典 + dryRun 横幅渲染**

在文件顶部 import 区下方加常量：

```ts
const TEST_INPUT_EXAMPLES: Record<string, string> = {
  trending_topics: JSON.stringify({ mode: "hot", limit: 20 }, null, 2),
  topic_classifier: JSON.stringify({
    topics: [{ id: "t1", title: "成都串串香排队 3 小时" }],
    enabledCategories: [{ value: "food", label: "美食" }],
  }, null, 2),
  cross_language_rewrite: JSON.stringify({
    articles: [{ id: "t1", title: "成都串串香", body: "..." }],
    targetLanguage: "en",
    variantsPerTopic: 1,
  }, null, 2),
  cms_publish: JSON.stringify({ title: "测试稿件", body: "正文 ..." }, null, 2),
  archive_to_drafts: JSON.stringify({
    articles: [{ title: "Test", body: "..." }],
  }, null, 2),
};
```

在测试输入框上方加示例按钮（约 line 738 placeholder 附近）：

```tsx
{TEST_INPUT_EXAMPLES[skill.name] && (
  <button
    type="button"
    onClick={() => setTestInput(TEST_INPUT_EXAMPLES[skill.name])}
    className="text-[11px] text-blue-500 hover:text-blue-600 mb-1"
  >
    填入示例参数
  </button>
)}
```

在测试结果区"预期行为"前（约 line 825 附近）加 dryRun 横幅：

```tsx
{testResult.runtimeInfo.type.includes("dryRun") && (
  <div className="mb-2 rounded-md bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
    ⚠️ 写入型 skill 已自动禁用真实落库 / 外部调用，仅展示参数与映射结果。
  </div>
)}
```

把"预期行为" label 改为"真实输出"（line 830 附近）：

```tsx
<h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
  {testResult.runtimeInfo.type.startsWith("Tool") ? "真实输出" : "预期行为"}
</h4>
```

- [ ] **Step 2: tsc 验证**

Run: `npx tsc --noEmit`
Expected: 0 错误

- [ ] **Step 3: 手动验证（无单元测试，UI 行为）**

启动 dev server 进 `/skills/642122e6-1176-48ef-a9c3-a9a0e6c9f627`（trending_topics）→ 点击"填入示例参数" → "执行测试" → 预期看到真实平台名 + 真热榜条目 + label 显示"真实输出"。

进任一 `cms_publish` skill 同样操作 → 顶部应见黄色"dry-run"横幅。

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/skills/\[id\]/skill-detail-client.tsx
git commit -m "$(cat <<'EOF'
feat(skill-test-ui): 参数示例填入 + dryRun 横幅 + label 真实输出

UI 配合 M1 后端改造：识别 runtimeInfo.type 包含 dryRun 时展示黄色
警示横幅；包含 "Tool" 前缀时把"预期行为"label 改为"真实输出"。
新增 TEST_INPUT_EXAMPLES 字典让 5 个内置 skill 一键填入示例。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Phase 1 Acceptance

跑：

```bash
npx vitest run src/app/actions/__tests__/test-skill-execution.test.ts
npx tsc --noEmit
npm run build
```

手动：
1. 进 `/skills/<trending_topics id>` 点测试 → 看到真实热榜数据，label 显示"真实输出"
2. 进 `/skills/<cms_publish id>` 测试 → 黄色横幅 + `SELECT count(*) FROM articles` 不变（在 supabase studio 检查）
3. 进 `/skills/<无工具的纯文档 skill id>` 测试 → 沿用 LLM 演示，无黄色横幅

---

## Phase 2 (M2) — 模型路由审计 + qwen3-max 统一

**目标**: 全栈 LLM 调用以 `OPENAI_MODEL=qwen3-max` 为唯一真相；fail-fast 不 fallback；13 个 SKILL.md frontmatter 同步。

**改动文件**:
- `src/app/actions/employee-advanced.ts:258`（删 fallback）
- 13 个 `skills/*/SKILL.md` 的 frontmatter
- `scripts/audit-model-references.ts`（新建审计脚本）

### Task 2.1: 审计脚本扫描违规字符串

**Files:**
- Create: `scripts/audit-model-references.ts`

- [ ] **Step 1: 写审计脚本**

```ts
// scripts/audit-model-references.ts
/**
 * Audit script: scan src/ and skills/ for stale model references.
 *
 * Run: npx tsx scripts/audit-model-references.ts
 *
 * Exits 0 if no violations, 1 if violations found.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const VIOLATIONS = [
  /\bdeepseek-chat\b/g,
  /\bdeepseek-coder\b/g,
  /\bdeepseek-reasoner\b/g,
  /\bglm-4\b/gi,
  /\bglm-4\.5\b/gi,
  /provider:\s*["']zhipu["']/g,
  /modelDependency:\s*deepseek/g,
];

const SCAN_DIRS = ["src", "skills"];
const EXTENSIONS = new Set([".ts", ".tsx", ".md"]);
const SKIP = /\.test\.|__tests__|node_modules|\.next/;

interface Violation {
  file: string;
  line: number;
  match: string;
  context: string;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (SKIP.test(p)) continue;
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (EXTENSIONS.has(extname(p))) out.push(p);
  }
  return out;
}

function scan(file: string): Violation[] {
  const text = readFileSync(file, "utf-8");
  const lines = text.split("\n");
  const found: Violation[] = [];
  lines.forEach((line, idx) => {
    for (const rx of VIOLATIONS) {
      const m = line.match(rx);
      if (m) found.push({ file, line: idx + 1, match: m[0], context: line.trim() });
    }
  });
  return found;
}

const allFiles = SCAN_DIRS.flatMap(walk);
const violations = allFiles.flatMap(scan);

if (violations.length === 0) {
  console.log("✅ No stale model references found.");
  process.exit(0);
}

console.log(`❌ Found ${violations.length} stale model references:\n`);
for (const v of violations) {
  console.log(`  ${v.file}:${v.line} — ${v.match}`);
  console.log(`    ${v.context}\n`);
}
process.exit(1);
```

- [ ] **Step 2: 跑脚本看当前违规清单**

Run: `npx tsx scripts/audit-model-references.ts > /tmp/audit-violations.txt 2>&1; cat /tmp/audit-violations.txt`
Expected: 列出所有违规（13 个 SKILL.md + 至少 employee-advanced.ts fallback）

- [ ] **Step 3: Commit 脚本（修复逻辑后续 task 做）**

```bash
git add scripts/audit-model-references.ts
git commit -m "$(cat <<'EOF'
chore(audit): 加 scripts/audit-model-references.ts 扫描旧模型引用

扫描 src/ 和 skills/ 下的 .ts/.tsx/.md，找硬编码的 deepseek-chat /
glm-4 / provider:"zhipu" / modelDependency:deepseek 等旧 provider
字符串。跑过后输出违规清单，exit 1 — CI 后续可加 hook 防回滚。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 2.2: 删 testSkillExecution 的 deepseek-chat fallback

**Files:**
- Modify: `src/app/actions/employee-advanced.ts:258`

- [ ] **Step 1: 写 fail-fast 测试**

在 `src/app/actions/__tests__/test-skill-execution.test.ts` 末尾追加：

```ts
describe("testSkillExecution model env fail-fast", () => {
  it("OPENAI_MODEL 未配置时测试入口直接报错，不静默退化", async () => {
    delete process.env.OPENAI_MODEL;
    // 让 skill 不命中 tool 注册，走 LLM 路径
    const skillsMock = vi.mocked((await import("@/db")).db.query.skills.findFirst);
    skillsMock.mockResolvedValueOnce({
      id: "skill-doc-only",
      name: "纯文档技能",
      category: "creative",
      version: "1.0",
      description: "",
      content: "",
      inputSchema: {},
      outputSchema: {},
      runtimeConfig: null,
      type: "skill",
      pluginConfig: null,
    } as never);
    await expect(
      testSkillExecution("skill-doc-only", "test input")
    ).rejects.toThrow(/OPENAI_MODEL/);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/app/actions/__tests__/test-skill-execution.test.ts -t "fail-fast"`
Expected: FAIL — 当前会 fallback 到 `"deepseek-chat"`

- [ ] **Step 3: 改 `employee-advanced.ts:258`**

```ts
// Before:
const resolvedModel = process.env.OPENAI_MODEL || "deepseek-chat";

// After:
const resolvedModel = process.env.OPENAI_MODEL;
if (!resolvedModel) {
  throw new Error("OPENAI_MODEL 未配置。请在 .env.local 中设置 OPENAI_MODEL=qwen3-max");
}
```

- [ ] **Step 4: 测试 + tsc**

Run: `npx vitest run src/app/actions/__tests__/test-skill-execution.test.ts && npx tsc --noEmit`
Expected: PASS, 0 错误

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/employee-advanced.ts src/app/actions/__tests__/test-skill-execution.test.ts
git commit -m "$(cat <<'EOF'
fix(model-router): testSkillExecution fail-fast 不再 fallback 到 deepseek-chat

OPENAI_MODEL 未配置时直接抛错。fail-fast 比静默用错模型跑出错数据
更可控；用户在 UI 上能立刻看到明确错误并知道去配 env。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 2.3: 13 个 SKILL.md frontmatter modelDependency 改 openai:qwen3-max

**Files:**
- Modify: `skills/*/SKILL.md` (13 个 — 用 audit 脚本输出确认精确清单)

- [ ] **Step 1: 跑 audit 看到具体清单**

Run: `npx tsx scripts/audit-model-references.ts 2>&1 | grep "SKILL.md" | grep modelDependency`
Expected: 列出所有 `modelDependency:` 含 `deepseek` 的文件路径

- [ ] **Step 2: 批量替换（手动，因为每个文件可能略不同）**

对每个文件，把 frontmatter 里的：
```yaml
modelDependency: deepseek:deepseek-chat
```
改为：
```yaml
modelDependency: openai:qwen3-max
```

注意：modelDependency 是文档字段，不会被代码读取（实际运行模型由 `model-router` 读 env 决定）。改动只是同步文档。

- [ ] **Step 3: audit 验证清零**

Run: `npx tsx scripts/audit-model-references.ts`
Expected: `✅ No stale model references found.` 退出码 0

- [ ] **Step 4: tsc + vitest 全量**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 全部 PASS（SKILL.md 改动不影响 TS）

- [ ] **Step 5: Commit**

```bash
git add skills/
git commit -m "$(cat <<'EOF'
docs(skills): 13 个 SKILL.md frontmatter modelDependency 改 openai:qwen3-max

跟运行时实际模型（OPENAI_MODEL=qwen3-max）同步。modelDependency 是
文档字段不影响代码行为；改动只为消除文档/运行时 drift，避免后续
读 SKILL.md 时被 stale "deepseek" 字样误导。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Phase 2 Acceptance

```bash
npx tsx scripts/audit-model-references.ts   # exit 0, "No stale model references"
unset OPENAI_MODEL && npm run dev           # skill 测试入口报"OPENAI_MODEL 未配置"
export OPENAI_MODEL=qwen3-max               # 恢复
npx tsc --noEmit && npx vitest run
```

---

## Phase 3 (M3) — 工作流编辑器主题管理 + 动态分类

**目标**: `topic_classifier` schema 改运行时构造；`cross_language_rewrite.categoryHint` 放宽为 string；input-fields-editor 加 helper + 重置按钮。

**改动文件**:
- `src/lib/agent/skills/topic-classifier.ts`
- `src/lib/agent/skills/cross-language-rewrite.ts`
- `src/components/workflows/input-fields-editor.tsx`
- Test: `src/lib/agent/skills/__tests__/topic-classifier.test.ts`（新建）

### Task 3.1: topic_classifier 改运行时构造 schema + prompt

**Files:**
- Modify: `src/lib/agent/skills/topic-classifier.ts`
- Test: `src/lib/agent/skills/__tests__/topic-classifier.test.ts`（新建）

- [ ] **Step 1: 写测试 — 动态 enum 接受用户加的"汽车"**

```ts
// src/lib/agent/skills/__tests__/topic-classifier.test.ts
import { describe, it, expect, vi } from "vitest";

const generateTextMock = vi.fn();
vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return { ...actual, generateText: generateTextMock };
});
vi.mock("../../model-router", () => ({
  getLanguageModel: vi.fn(() => ({})),
  resolveModelConfig: vi.fn(() => ({ temperature: 0.2, maxTokens: 4096, provider: "openai", model: "qwen3-max" })),
}));

import { classifyOverseasTopics } from "../topic-classifier";

describe("topic_classifier 动态 enum", () => {
  it("接受用户加的 auto / travel 自定义分类，LLM 输出含 auto 不被 zod 拒", async () => {
    generateTextMock.mockResolvedValueOnce({
      output: {
        results: [
          { id: "t1", category: "auto", confidence: 0.92, reason: "标题含 SU7" },
          { id: "t2", category: "travel", confidence: 0.88, reason: "标题含 北海道" },
        ],
      },
    });
    const out = await classifyOverseasTopics({
      topics: [
        { id: "t1", title: "小米 SU7 续航实测" },
        { id: "t2", title: "北海道滑雪攻略" },
      ],
      enabledCategories: [
        { value: "auto", label: "汽车" },
        { value: "travel", label: "旅游" },
      ],
    });
    expect(out.results).toHaveLength(2);
    expect(out.results[0].category).toBe("auto");
    expect(out.results[1].category).toBe("travel");
  });

  it("默认 3 类 + other 兜底（无 enabledCategories 入参）", async () => {
    generateTextMock.mockResolvedValueOnce({
      output: {
        results: [
          { id: "t1", category: "food", confidence: 0.95, reason: "..." },
        ],
      },
    });
    const out = await classifyOverseasTopics({
      topics: [{ id: "t1", title: "成都串串香" }],
      enabledCategories: [
        { value: "food", label: "美食" },
        { value: "pets", label: "萌宠" },
        { value: "domestic_tech", label: "国内科技" },
      ],
    });
    expect(out.results[0].category).toBe("food");
  });

  it("LLM 漏返时缺失条目兜底归 other", async () => {
    generateTextMock.mockResolvedValueOnce({
      output: { results: [{ id: "t1", category: "food", confidence: 0.9, reason: "..." }] },
    });
    const out = await classifyOverseasTopics({
      topics: [
        { id: "t1", title: "A" },
        { id: "t2", title: "B" },
      ],
      enabledCategories: [{ value: "food", label: "美食" }],
    });
    expect(out.results).toHaveLength(2);
    expect(out.results[1].category).toBe("other");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/lib/agent/skills/__tests__/topic-classifier.test.ts`
Expected: FAIL — `classifyOverseasTopics` 当前签名是 `{ topics: TopicInput[] }`，不接 `enabledCategories`

- [ ] **Step 3: 改 topic-classifier.ts**

完整重写 `src/lib/agent/skills/topic-classifier.ts` 核心部分（保留文件顶部注释 + import）：

```ts
// ─── Schema 改运行时构造 ──────────────────────────────────────────
const ClassifiedItemBase = {
  id: z.string().min(1),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(2).max(200),
  sourceUrl: z.string().optional(),  // ← M4 透传字段
};

function buildClassifierSchema(categoryValues: string[]) {
  const enumValues = [...categoryValues, "other"] as [string, ...string[]];
  return z.object({
    results: z.array(
      z.object({
        ...ClassifiedItemBase,
        category: z.enum(enumValues),
      }),
    ),
  });
}

// ─── Prompt builder ──────────────────────────────────────────────
function buildSystemPrompt(categories: { value: string; label: string }[]) {
  const lines = categories
    .map(
      (c) =>
        `**${c.value}（${c.label}）**：根据标题/摘要的语义判断；模糊不清归 other。`,
    )
    .join("\n");
  return `你是「话题分类员」。从输入的中文热榜数据中筛出下列类别（不属于则归 other）：

${lines}

分类规则：
1. 每条必须给一个 category（n+1 选 1，n 是上面列表条数，+1 是 other），不许多选。
2. confidence 是 0~1 浮点数，反映你对分类正确性的把握。
3. 模糊难判 → confidence < 0.7 时归 other。
4. reason 简短中文（≤ 100 字）：说出关键判断词。
5. 输出顺序与输入顺序一致，每条都要给出（不能省略）。
6. **若输入条目带 sourceUrl 字段，输出必须原样回填，绝对不改 / 不删**。
7. 严格按 schema 输出 JSON，不要附加任何解释文字。`;
}

// ─── Types ─────────────────────────────────────────────────────────
export interface TopicInput {
  id: string;
  title: string;
  summary?: string;
  sourceUrl?: string;  // ← M4
}

export interface CategoryOption {
  value: string;
  label: string;
}

export interface TopicClassifierInput {
  topics: TopicInput[];
  enabledCategories: CategoryOption[];  // ← M3: 必填
}

export interface TopicClassifierResult {
  id: string;
  category: string;  // 动态 enum，运行时确定
  confidence: number;
  reason: string;
  sourceUrl?: string;
}

export interface TopicClassifierOutput {
  results: TopicClassifierResult[];
}

// ─── Skill function ────────────────────────────────────────────────
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
      category: "other",
      confidence: 0,
      reason: "LLM 未返回该条分类结果，兜底归为 other",
      sourceUrl: t.sourceUrl,
    }));

  // sourceUrl 兜底回填（如果 LLM 漏了某条的 sourceUrl）
  const filled = output.results.map((r) => ({
    ...r,
    sourceUrl: r.sourceUrl ?? input.topics.find((t) => t.id === r.id)?.sourceUrl,
  }));

  return { results: [...filled, ...missing] };
}

// 保留旧 export 以兼容（@deprecated）
export const OVERSEAS_CATEGORY_ENUM = ["food", "pets", "domestic_tech", "other"] as const;
export type OverseasCategory = (typeof OVERSEAS_CATEGORY_ENUM)[number];
```

- [ ] **Step 4: 测试通过 + tsc**

Run: `npx vitest run src/lib/agent/skills/__tests__/topic-classifier.test.ts && npx tsc --noEmit`
Expected: 3 PASS, 0 错误

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent/skills/topic-classifier.ts src/lib/agent/skills/__tests__/topic-classifier.test.ts
git commit -m "$(cat <<'EOF'
feat(topic-classifier): schema 改运行时构造，接受用户自定义分类

用户在工作流编辑器加的任何分类（如 auto / travel）都能被 LLM 识别
并通过 zod 校验。schema 用 buildClassifierSchema(values) 动态构造
enum（追加 other 兜底）；prompt 用 buildSystemPrompt(categories) 注入
每类的中文 label 引导 LLM 按语义判断。

新增 enabledCategories 必填入参；sourceUrl 透传字段为 M4 留口。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 3.2: cross_language_rewrite categoryHint enum → string

**Files:**
- Modify: `src/lib/agent/skills/cross-language-rewrite.ts:25-30, 70-114`
- Test: `src/lib/agent/skills/__tests__/cross-language-rewrite.test.ts`（新建）

- [ ] **Step 1: 写测试 — categoryHint 任意字符串**

```ts
// src/lib/agent/skills/__tests__/cross-language-rewrite.test.ts
import { describe, it, expect, vi } from "vitest";

const generateTextMock = vi.fn();
vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return { ...actual, generateText: generateTextMock };
});
vi.mock("../../model-router", () => ({
  getLanguageModel: vi.fn(() => ({})),
  resolveModelConfig: vi.fn(() => ({ temperature: 0.7, maxTokens: 8192, provider: "openai", model: "qwen3-max" })),
}));

import { crossLanguageRewriteArticles } from "../cross-language-rewrite";

describe("cross_language_rewrite categoryHint string", () => {
  it("categoryHint=auto（不在内置 3 类）也能跑通，prompt 用通用语气兜底", async () => {
    generateTextMock.mockResolvedValueOnce({
      output: {
        articles: [
          {
            id: "t1-v0",
            sourceTopicId: "t1",
            variantIndex: 0,
            title_en: "Xiaomi SU7 EV Review",
            body_en: "Xiaomi's first EV...",
            hashtags: ["#XiaomiSU7", "#ChinaEV", "#AutoTech"],
          },
        ],
      },
    });
    const out = await crossLanguageRewriteArticles({
      articles: [{ id: "t1", title: "小米 SU7", body: "...", sourceUrl: "https://weibo.com/x" }],
      targetLanguage: "en",
      categoryHint: "auto",
      variantsPerTopic: 1,
    });
    expect(out.articles).toHaveLength(1);
    expect(generateTextMock).toHaveBeenCalled();
    const call = generateTextMock.mock.calls[0][0];
    expect(call.system).toContain("**auto**");  // 任意 string 都出现在 prompt
    expect(call.system).toContain("无特定语气倾向");  // fallback 文案
  });

  it("categoryHint=food 命中内置查表，prompt 含 美食 语气", async () => {
    generateTextMock.mockResolvedValueOnce({
      output: { articles: [{ id: "t1-v0", sourceTopicId: "t1", variantIndex: 0, title_en: "X", body_en: "Y", hashtags: ["#A", "#B", "#C"] }] },
    });
    await crossLanguageRewriteArticles({
      articles: [{ id: "t1", title: "成都串串", body: "..." }],
      targetLanguage: "en",
      categoryHint: "food",
      variantsPerTopic: 1,
    });
    const call = generateTextMock.mock.calls[0][0];
    expect(call.system).toContain("taste");  // 命中内置 food 模板
  });
});
```

- [ ] **Step 2: 测试 FAIL**

Run: `npx vitest run src/lib/agent/skills/__tests__/cross-language-rewrite.test.ts -t "auto"`
Expected: FAIL — `categoryHint: "auto"` 不在 enum，TS 类型报错或运行时拒

- [ ] **Step 3: 改 cross-language-rewrite.ts**

a) 删 enum 定义（约 line 26）：
```ts
// 删除：const CATEGORY_HINT_ENUM = ["food","pets","domestic_tech"] as const;
// 删除：export type CategoryHint = (typeof CATEGORY_HINT_ENUM)[number];
```

b) 加 categoryTone 默认表 + fallback（替换原 buildSystemPrompt 内 categoryTone）：
```ts
const CATEGORY_TONE_DEFAULTS: Record<string, string> = {
  food: "美食内容用感官化语言（taste / aroma / crispy / fluffy），多用 emoji（🍜🥢🌶️），可以幽默",
  pets: "萌宠内容用 wholesome / heartwarming 口吻，emoji 偏温馨（🐱🐶🐾✨），鼓励互动（'Drop a 🐾 if you agree'）",
  domestic_tech: "国内科技内容客观直白，避免过度营销词，可以加规格数字，emoji 克制（🚀💡🔋）",
};

function buildSystemPrompt(categoryHint?: string): string {
  const toneText = categoryHint
    ? (CATEGORY_TONE_DEFAULTS[categoryHint] ?? "保持简洁直白，无特定语气倾向")
    : "";
  const toneHint = categoryHint
    ? `\n本批稿件属于 **${categoryHint}** 类别。语气定位：${toneText}。`
    : "";
  // ... 余下 prompt body 不变
```

c) interface 类型改为 string（约 line 56-60）：
```ts
export interface CrossLanguageRewriteInput {
  articles: ArticleInput[];
  targetLanguage: TargetLanguage;
  categoryHint?: string;       // ← enum 改 string
  variantsPerTopic?: 1 | 2 | 3;  // ← M4 字段，本 task 先加类型，下个 phase 用
}
```

- [ ] **Step 4: 测试通过 + tsc**

Run: `npx vitest run src/lib/agent/skills/__tests__/cross-language-rewrite.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent/skills/cross-language-rewrite.ts src/lib/agent/skills/__tests__/cross-language-rewrite.test.ts
git commit -m "$(cat <<'EOF'
feat(cross-language-rewrite): categoryHint enum → string + 通用语气兜底

用户在工作流编辑器加的新分类（如 auto / travel）现在能传给改写器。
CATEGORY_TONE_DEFAULTS 保留 3 个内置语气（food/pets/domestic_tech），
其他值 fallback 到"保持简洁直白，无特定语气倾向"。

注意：CATEGORY_TONE_DEFAULTS 的 3 个 key 必须跟 seed-builtin-workflows
里 hot_topics_overseas_en 的默认 categories 保持同步。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 3.3: input-fields-editor 加 helper + 重置按钮

**Files:**
- Modify: `src/components/workflows/input-fields-editor.tsx`

- [ ] **Step 1: 找到 categories 字段渲染分支**

读取文件，定位 `field.type === "multiselect"` 渲染（约 line 251）。

- [ ] **Step 2: 加 helper text + 重置按钮**

在 multiselect 字段渲染块里（OptionsEditor 上方），如果 field.name === "categories"，加：

```tsx
{field.name === "categories" && (
  <div className="text-[11px] text-muted-foreground mb-2 space-y-1">
    <p>
      💡 新增的分类会被 AI 分类器按名字语义自由判断；建议 value 用英文 slug（如 auto / travel），label 用中文。
    </p>
    <button
      type="button"
      onClick={() => onPatch({
        options: [
          { value: "food", label: "美食" },
          { value: "pets", label: "萌宠" },
          { value: "domestic_tech", label: "国内科技" },
        ],
      })}
      className="text-blue-500 hover:text-blue-600"
    >
      恢复默认 3 类
    </button>
  </div>
)}
```

- [ ] **Step 3: tsc**

Run: `npx tsc --noEmit`
Expected: 0 错误

- [ ] **Step 4: 手动验证**

dev server → 进 `/workflows/<海外热榜搬运 id>/edit` → 选中 categories 字段 → 应看到 helper text + 重置按钮。

- [ ] **Step 5: Commit**

```bash
git add src/components/workflows/input-fields-editor.tsx
git commit -m "$(cat <<'EOF'
feat(workflow-editor): categories 字段加 helper text + 恢复默认按钮

用户在工作流编辑器修改海外热榜搬运的 categories multiselect 时，
看到提示"value 用英文 slug、label 用中文"+ 一个"恢复默认 3 类"
按钮防误改。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Phase 3 Acceptance

```bash
npx vitest run src/lib/agent/skills/__tests__/topic-classifier.test.ts \
              src/lib/agent/skills/__tests__/cross-language-rewrite.test.ts
npx tsc --noEmit
```

手动：
1. 工作流编辑器加 `{value:"auto",label:"汽车"}` 保存
2. 发起任务运行时表单看到 4 个勾选项
3. 跑通后 mission step 2 输出含 `category:"auto"`
4. "恢复默认 3 类"点击能重置

---

## Phase 4 (M4) — variants + sourceUrl 透传 + archive_to_drafts

**目标**: cross_language_rewrite 加 variants_per_topic + sourceUrl 透传；新建 `archive_to_drafts` 工具批量入库（不调 CMS）+ sourceUrl 去重；workflow seed 切换 step 4。

**改动文件**:
- `src/lib/agent/skills/topic-classifier.ts`（M3 已加 sourceUrl，本 phase 验证）
- `src/lib/agent/skills/cross-language-rewrite.ts`（schema 加 sourceUrl/variants/sourceTopicId/variantIndex）
- `src/lib/agent/tool-registry.ts`（新增 archive_to_drafts）
- `src/db/seed-builtin-workflows.ts:2257`（hot_topics_overseas_en step 4 + inputFields）
- `skills/archive-to-drafts/SKILL.md`（新建）
- Test: `src/lib/agent/__tests__/archive-to-drafts.test.ts`

### Task 4.1: cross_language_rewrite schema 加 sourceUrl/variants

**Files:**
- Modify: `src/lib/agent/skills/cross-language-rewrite.ts`
- Test: `src/lib/agent/skills/__tests__/cross-language-rewrite.test.ts`（追加）

- [ ] **Step 1: 追加测试 — variants 输出 & sourceUrl 透传**

```ts
// 追加到 cross-language-rewrite.test.ts
describe("cross_language_rewrite variants & sourceUrl 透传", () => {
  it("variantsPerTopic=2 输出 2 个 variant，id 是 tX-v0/tX-v1，sourceUrl 透传", async () => {
    generateTextMock.mockResolvedValueOnce({
      output: {
        articles: [
          { id: "t1-v0", sourceTopicId: "t1", variantIndex: 0, sourceUrl: "https://weibo.com/x",
            title_en: "Short headline", body_en: "...", hashtags: ["#A", "#B", "#C"] },
          { id: "t1-v1", sourceTopicId: "t1", variantIndex: 1, sourceUrl: "https://weibo.com/x",
            title_en: "Long story", body_en: "...", hashtags: ["#A", "#B", "#C"] },
        ],
      },
    });
    const out = await crossLanguageRewriteArticles({
      articles: [{ id: "t1", title: "成都串串", body: "...", sourceUrl: "https://weibo.com/x" }],
      targetLanguage: "en",
      variantsPerTopic: 2,
    });
    expect(out.articles).toHaveLength(2);
    expect(out.articles[0].id).toBe("t1-v0");
    expect(out.articles[1].id).toBe("t1-v1");
    expect(out.articles.every(a => a.sourceUrl === "https://weibo.com/x")).toBe(true);
  });

  it("variantsPerTopic=1 默认值，输出 1 篇", async () => {
    generateTextMock.mockResolvedValueOnce({
      output: { articles: [{ id: "t1-v0", sourceTopicId: "t1", variantIndex: 0, title_en: "X", body_en: "Y", hashtags: ["#A","#B","#C"] }] },
    });
    const out = await crossLanguageRewriteArticles({
      articles: [{ id: "t1", title: "X", body: "Y" }],
      targetLanguage: "en",
    });
    expect(out.articles).toHaveLength(1);
  });

  it("sourceUrl 兜底 — LLM 漏返时从 input 回填", async () => {
    generateTextMock.mockResolvedValueOnce({
      output: { articles: [{ id: "t1-v0", sourceTopicId: "t1", variantIndex: 0, title_en: "X", body_en: "Y", hashtags: ["#A","#B","#C"] /* 无 sourceUrl */ }] },
    });
    const out = await crossLanguageRewriteArticles({
      articles: [{ id: "t1", title: "X", body: "Y", sourceUrl: "https://example.com/orig" }],
      targetLanguage: "en",
    });
    expect(out.articles[0].sourceUrl).toBe("https://example.com/orig");
  });
});
```

- [ ] **Step 2: 测试 FAIL**

Run: `npx vitest run src/lib/agent/skills/__tests__/cross-language-rewrite.test.ts -t "variants"`
Expected: FAIL — 当前 schema 无 sourceTopicId / variantIndex / sourceUrl 字段

- [ ] **Step 3: 改 cross-language-rewrite.ts schema + prompt**

a) RewrittenArticleSchema 改造（约 line 31）：
```ts
const RewrittenArticleSchema = z.object({
  id: z.string().min(1),                                          // ← 改：唯一稿件 ID 如 t1-v0
  sourceTopicId: z.string().min(1),                                // ← 新
  variantIndex: z.number().int().min(0).max(2),                    // ← 新
  sourceUrl: z.string().optional(),                                // ← 新
  category: z.string().optional(),                                 // ← 新
  title_en: z.string().min(1).max(140),
  body_en: z.string().min(10),
  hashtags: z.array(z.string().min(2).max(40)).min(3).max(7),
  cultural_notes: z.string().max(400).optional(),
});
```

b) ArticleInput 加 sourceUrl + category（约 line 49）：
```ts
export interface ArticleInput {
  id: string;
  title: string;
  body: string;
  tags?: string[];
  sourceUrl?: string;   // ← 新
  category?: string;    // ← 新
}
```

c) 在 buildSystemPrompt 末尾加 variants/sourceUrl 引导：
```ts
const variantsHint = `

8. **variantsPerTopic 引导**：
   - 入参 variants_per_topic = ${variantsPerTopic ?? 1}。
   - = 1：每条 input 生成 1 篇英文稿，id = "<input_id>-v0"。
   - = 2：每条生成 2 篇明显不同的版本（variant 0 = headline-driven 短版；variant 1 = storytelling 中版）。id = "<input_id>-v0" / "<input_id>-v1"。
   - = 3：再加 variant 2 = analytical 长版，id = "<input_id>-v2"。
   - 同一 source 的 N 篇必须**明显不同**——不同切入角度、不同钩子、不同长度，不是改几个字。

9. **sourceUrl 透传**：
   - 输入每条 article 若带 sourceUrl，输出该 input 对应的所有 variant 都必须原样回填 sourceUrl。
   - **绝对不许编造 / 修改 sourceUrl。** 入参没的也不能填假的。

10. **sourceTopicId / variantIndex**：每条输出必须有这两个字段。sourceTopicId = 原 input.id；variantIndex 从 0 起。`;
```

d) 在 generateText 调用前 update userPayload + system 调用：
```ts
const variantsPerTopic = input.variantsPerTopic ?? 1;
const userPayload = JSON.stringify({
  target_language: input.targetLanguage,
  category_hint: input.categoryHint ?? null,
  variants_per_topic: variantsPerTopic,
  articles: input.articles.map((a) => ({
    id: a.id,
    title: a.title,
    body: a.body,
    tags: a.tags ?? [],
    sourceUrl: a.sourceUrl ?? null,
    category: a.category ?? null,
  })),
});
// ... call generateText with system: buildSystemPrompt(input.categoryHint, variantsPerTopic)
```
让 `buildSystemPrompt(categoryHint, variantsPerTopic)` 接 2 个参数。

e) sourceUrl 兜底 — 在 return 前回填：
```ts
const filled = output.articles.map((a) => ({
  ...a,
  sourceUrl: a.sourceUrl ?? input.articles.find((src) => src.id === a.sourceTopicId)?.sourceUrl,
}));
return { articles: [...filled, ...missing] };
```

f) RewrittenArticle 类型 export：
```ts
export type RewrittenArticle = z.infer<typeof RewrittenArticleSchema>;
```

- [ ] **Step 4: 测试 + tsc**

Run: `npx vitest run src/lib/agent/skills/__tests__/cross-language-rewrite.test.ts && npx tsc --noEmit`
Expected: 5 PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent/skills/cross-language-rewrite.ts src/lib/agent/skills/__tests__/cross-language-rewrite.test.ts
git commit -m "$(cat <<'EOF'
feat(cross-language-rewrite): variants_per_topic + sourceUrl 透传

新增 variantsPerTopic (1-3) 让同一中文 input 生成多个不同切入角度的
英文 variant（id 格式 <source>-vN）。schema 加 sourceTopicId /
variantIndex / sourceUrl / category 透传字段；LLM 漏返 sourceUrl 时
从 input 兜底回填。

为 Phase 4 archive_to_drafts 批量入库 + 去重提供完整数据链路。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 4.2: 新建 archive_to_drafts 工具 + 测试

**Files:**
- Modify: `src/lib/agent/tool-registry.ts`（新增工具定义）
- Test: `src/lib/agent/__tests__/archive-to-drafts.test.ts`（新建）
- Create: `skills/archive-to-drafts/SKILL.md`

- [ ] **Step 1: 写 archive_to_drafts 测试**

```ts
// src/lib/agent/__tests__/archive-to-drafts.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const insertMock = vi.fn();
const findFirstMock = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: { articles: { findFirst: findFirstMock } },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: insertMock,
      })),
    })),
  },
}));
vi.mock("@/db/schema/articles", () => ({ articles: { organizationId: "x", sourceUrl: "y" } }));

import { invokeToolDirectly } from "../tool-registry";

beforeEach(() => {
  insertMock.mockReset();
  findFirstMock.mockReset();
});

describe("archive_to_drafts", () => {
  it("批量入库 N 条 articles，sourceUrl 落库", async () => {
    findFirstMock.mockResolvedValue(null);  // 无重复
    insertMock
      .mockResolvedValueOnce([{ id: "a1", title: "T1" }])
      .mockResolvedValueOnce([{ id: "a2", title: "T2" }]);
    const res = await invokeToolDirectly("archive_to_drafts", {
      articles: [
        { title: "T1", body: "Body 1 with enough chars", sourceUrl: "https://a.com/1" },
        { title: "T2", body: "Body 2 with enough chars", sourceUrl: "https://a.com/2" },
      ],
    }, { organizationId: "org1", operatorId: "u1" });
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("not ok");
    const result = res.result as { totalCreated: number; totalSkipped: number };
    expect(result.totalCreated).toBe(2);
    expect(result.totalSkipped).toBe(0);
  });

  it("sourceUrl 已存在则 skip 不入库", async () => {
    findFirstMock
      .mockResolvedValueOnce({ id: "existing1", title: "Old" })
      .mockResolvedValueOnce(null);
    insertMock.mockResolvedValueOnce([{ id: "a2", title: "T2" }]);
    const res = await invokeToolDirectly("archive_to_drafts", {
      articles: [
        { title: "T1", body: "Body 1 with enough chars", sourceUrl: "https://a.com/dup" },
        { title: "T2", body: "Body 2 with enough chars", sourceUrl: "https://a.com/new" },
      ],
    }, { organizationId: "org1", operatorId: "u1" });
    if (!res.ok) throw new Error("not ok");
    const result = res.result as { totalCreated: number; totalSkipped: number; skipped: unknown[] };
    expect(result.totalCreated).toBe(1);
    expect(result.totalSkipped).toBe(1);
    expect((result.skipped[0] as { existingArticleId: string }).existingArticleId).toBe("existing1");
  });

  it("dryRun=true 直接 return mock，不调 insert", async () => {
    const res = await invokeToolDirectly("archive_to_drafts", {
      articles: [{ title: "T", body: "Body with enough chars" }],
      dryRun: true,
    }, { organizationId: "org1", operatorId: "u1" });
    if (!res.ok) throw new Error("not ok");
    const result = res.result as { dryRun?: boolean };
    expect(result.dryRun).toBe(true);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("缺 organizationId 报错", async () => {
    const res = await invokeToolDirectly("archive_to_drafts", {
      articles: [{ title: "T", body: "Body with enough chars" }],
    }, {});
    if (res.ok) {
      const result = res.result as { success: boolean };
      expect(result.success).toBe(false);
    }
  });
});
```

- [ ] **Step 2: 测试 FAIL**

Run: `npx vitest run src/lib/agent/__tests__/archive-to-drafts.test.ts`
Expected: FAIL — archive_to_drafts 工具不存在

- [ ] **Step 3: 在 tool-registry.ts 加 archive_to_drafts 工具**

找到 cms_publish 工具定义后（约 line 1200），追加：

```ts
archive_to_drafts: tool({
  description:
    "把一批稿件批量写入个人稿件库（articles 表）作为指定状态，等待编辑后续处理。" +
    "**只入本地 DB，不调任何外部 CMS / 发布接口**。" +
    "适合：海外热榜搬运、跨语言改写等需要把生成内容落库待审的场景。" +
    "若同 org 下 sourceUrl 已存在则按 dedupBySourceUrl 决定 skip。",
  inputSchema: z.object({
    articles: z.array(z.object({
      title: z.string().min(1).max(200),
      body: z.string().min(10),
      summary: z.string().optional(),
      sourceUrl: z.string().optional(),
      sourceTopicId: z.string().optional(),
      variantIndex: z.number().int().min(0).max(2).optional(),
      language: z.enum(["zh", "en"]).optional().default("en"),
      category: z.string().optional(),
      tags: z.array(z.string()).optional(),
      hashtags: z.array(z.string()).optional(),
      culturalNotes: z.string().optional(),
    })).min(1).max(20),
    dedupBySourceUrl: z.boolean().optional().default(true),
    initialStatus: z.enum(["draft", "approved"]).optional().default("approved"),
    dryRun: z.boolean().optional(),
    organizationId: z.string().optional(),
    operatorId: z.string().optional(),
  }),
  execute: async ({
    articles: items,
    dedupBySourceUrl,
    initialStatus,
    dryRun,
    organizationId,
    operatorId,
  }) => {
    // dryRun 短路必须在所有 DB 操作之前
    if (dryRun) {
      return {
        success: true,
        dryRun: true,
        wouldInsert: items.length,
        wouldDedupBy: dedupBySourceUrl ? "sourceUrl" : "off",
        note: "dry-run: 实际跑会按 sourceUrl 去重后写入 articles 表",
      };
    }
    if (!organizationId) {
      return {
        success: false,
        error: { code: "missing_context", message: "缺少 organizationId" },
      };
    }

    const { db } = await import("@/db");
    const { articles } = await import("@/db/schema/articles");
    const { and, eq } = await import("drizzle-orm");

    const created: { articleId: string; title: string; sourceUrl?: string }[] = [];
    const skipped: { sourceUrl: string; existingArticleId: string; reason: string }[] = [];

    for (const item of items) {
      if (dedupBySourceUrl && item.sourceUrl) {
        const exists = await db.query.articles.findFirst({
          where: and(
            eq(articles.organizationId, organizationId),
            eq(articles.sourceUrl, item.sourceUrl),
          ),
          columns: { id: true, title: true },
        });
        if (exists) {
          skipped.push({
            sourceUrl: item.sourceUrl,
            existingArticleId: exists.id,
            reason: "duplicate_source_url",
          });
          continue;
        }
      }
      const [row] = await db.insert(articles).values({
        organizationId,
        title: item.title,
        body: item.body,
        summary: item.summary ?? null,
        sourceUrl: item.sourceUrl ?? null,
        status: initialStatus,
        tags: [...(item.tags ?? []), ...(item.hashtags ?? [])],
        mediaType: "article",
        publishedAt: null,
        metadata: {
          sourceTopicId: item.sourceTopicId,
          variantIndex: item.variantIndex,
          language: item.language ?? "en",
          category: item.category,
          culturalNotes: item.culturalNotes,
          createdByWorkflow: true,
        },
      }).returning({ id: articles.id, title: articles.title });

      created.push({ articleId: row.id, title: row.title, sourceUrl: item.sourceUrl });
    }
    void operatorId;
    return {
      success: true,
      totalRequested: items.length,
      totalCreated: created.length,
      totalSkipped: skipped.length,
      created,
      skipped,
    };
  },
}),
```

注意：工具定义放在 `ALL_TOOLS` 对象内（同 cms_publish 同级）。如果当前文件结构是 `const ALL_TOOLS = { ... }`，加在对应位置。

- [ ] **Step 4: 测试 PASS + tsc**

Run: `npx vitest run src/lib/agent/__tests__/archive-to-drafts.test.ts && npx tsc --noEmit`
Expected: 4 PASS

- [ ] **Step 5: 新建 SKILL.md**

```bash
mkdir -p skills/archive-to-drafts
```

写 `skills/archive-to-drafts/SKILL.md`:

```markdown
---
name: archive_to_drafts
displayName: 稿件入库（不发布）
description: 把一批生成稿件批量写入本地 articles 表作为 approved 待审状态。不调任何外部 CMS / 发布接口。支持按 sourceUrl 去重。适合海外热榜搬运、跨语言改写等需要落库待审的场景。
version: "1.0"
category: distribution

metadata:
  skill_kind: distribution
  scenario_tags: [archive, batch, dedupe]
  compatibleEmployees: [xiaowen, xiaofa]
  modelDependency: none
  requires:
    env: [DATABASE_URL]
    knowledgeBases: []
    dependencies: []
  implementation:
    scriptPath: src/lib/agent/tool-registry.ts
    testPath: src/lib/agent/__tests__/
---

# 稿件入库（archive_to_drafts）

把改写好的英文/中文稿件批量入 articles 表，等待编辑后续处理。

## 输入

- `articles[]` (1-20)：每条含 title / body / summary / sourceUrl / sourceTopicId / variantIndex / language / category / tags / hashtags / culturalNotes
- `dedupBySourceUrl` (default true)：sourceUrl 已存在则 skip
- `initialStatus` (default "approved")：入库时的状态

## 输出

- `totalRequested / totalCreated / totalSkipped`
- `created[]`: 新建稿件的 articleId + title + sourceUrl
- `skipped[]`: 去重跳过的 sourceUrl + 现有 articleId + reason

## 与 cms_publish 的区别

`cms_publish` 走完整 9 步发到华栖云 CMS（含 publishArticleToCms）；
`archive_to_drafts` **只入本地 articles 表**，不调任何外部接口。
当稿件库 UI 集成 CMS 发布能力后，可由编辑手动触发 cms_publish。
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/agent/tool-registry.ts src/lib/agent/__tests__/archive-to-drafts.test.ts skills/archive-to-drafts/
git commit -m "$(cat <<'EOF'
feat(archive-to-drafts): 新增工具批量入库 articles 表，不调华栖云 CMS

为海外热榜搬运 / 跨语言改写场景提供"只落本地"的入库能力。
- 接受 articles[] (1-20)，按 sourceUrl 去重
- dryRun 短路在所有 DB 操作前，跟 cms_publish 一致
- metadata 含 sourceTopicId/variantIndex/language/category 便于后续聚合
- 工具新建，cms_publish 行为完全不动（向后兼容）

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 4.3: 切换 hot_topics_overseas_en step 4 + 加 variants_per_topic 字段

**Files:**
- Modify: `src/db/seed-builtin-workflows.ts:2222-2272`

- [ ] **Step 1: 改 seed**

在 hot_topics_overseas_en 的 inputFields 数组末尾追加：

```ts
{
  name: "variants_per_topic",
  label: "每个热点生成稿件数",
  type: "number",
  required: false,
  defaultValue: 1,
  validation: { min: 1, max: 3 },
  helpText: "1=每个热点 1 篇；2-3=同一热点产出多版本（短版/长版/钩子版）",
},
```

把 step 4 改成 archive_to_drafts：

```ts
step(
  4,
  "入英文稿件库（待审）",
  "archive_to_drafts",
  "稿件入库",
  "distribution",
  "store",
  { language: "en", category: "app_overseas_en", initialStatus: "approved" },
),
```

- [ ] **Step 2: 跑 seed 同步到 DB**

Run: `npm run db:seed`
Expected: 输出 "Seeded N builtin workflows"，无错误

- [ ] **Step 3: tsc + vitest 全量**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 全部 PASS

- [ ] **Step 4: 手动验证**

dev server → 进 `/workflows/<海外热榜搬运 id>/edit` → 应看到 4 个 inputField（含 variants_per_topic）+ step 4 显示"入英文稿件库（待审）" / archive_to_drafts。

- [ ] **Step 5: Commit**

```bash
git add src/db/seed-builtin-workflows.ts
git commit -m "$(cat <<'EOF'
feat(seed): hot_topics_overseas_en step 4 切到 archive_to_drafts

step 4 从 cms_publish 改为 archive_to_drafts —— 不调华栖云 CMS，只
入本地 articles 表，因为稿件库 UI 尚未集成 CMS 发布能力。同时新增
variants_per_topic 输入字段（1-3，默认 1）让用户控制同一热点产出
的版本数。

跑 npm run db:seed 同步到当前 DATABASE_URL。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Phase 4 Acceptance

```bash
npx vitest run src/lib/agent/__tests__/archive-to-drafts.test.ts \
              src/lib/agent/skills/__tests__/cross-language-rewrite.test.ts
npx tsc --noEmit
npm run build
```

手动 (dev server)：
1. 发起海外热榜搬运（variants=1）→ mission step 4 看到 "新建 N 篇，跳过 0 篇"
2. `SELECT id, title, source_url, metadata FROM articles ORDER BY published_at DESC LIMIT 10` 每条带 sourceUrl + metadata 含 sourceTopicId/variantIndex
3. 同参数跑两次 → 第二次 totalSkipped=N
4. variants=2 → 入库条数是分类通过条数的 2 倍
5. `SELECT count(*) FROM cms_publications` 不变（确认没调华栖云）

---

## Phase 5 (M5) — 原文链接 UI

**目标**: `SourceUrlPill` 共享组件 + 3 处接入（预览模式 / 翻译模式 / mission console step 4）。

**改动文件**:
- `src/components/shared/source-url-pill.tsx`（新建）
- `src/app/(dashboard)/articles/[id]/features/reader/meta-header.tsx`
- `src/app/(dashboard)/articles/[id]/features/translate/translate-overlay.tsx`
- `src/app/(dashboard)/missions/[id]/mission-console-client.tsx`

### Task 5.1: 新建 SourceUrlPill 组件

**Files:**
- Create: `src/components/shared/source-url-pill.tsx`

- [ ] **Step 1: 写组件**

```tsx
// src/components/shared/source-url-pill.tsx
"use client";

import { ExternalLink } from "lucide-react";

interface SourceUrlPillProps {
  url: string | null | undefined;
  label?: string;
  variant?: "default" | "compact";
  className?: string;
}

export function SourceUrlPill({
  url,
  label = "查看原文",
  variant = "default",
  className = "",
}: SourceUrlPillProps) {
  if (!url) return null;

  let domain = url;
  try {
    domain = new URL(url).host.replace(/^www\./, "");
  } catch {
    // URL parse 失败保留原字符串
  }

  const baseClass =
    "inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors";
  const variantClass =
    variant === "compact"
      ? ""
      : "px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-900/20";

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${baseClass} ${variantClass} ${className}`}
      title={url}
    >
      <ExternalLink size={variant === "compact" ? 10 : 12} />
      <span>{label}</span>
      <span className="text-gray-400 dark:text-gray-500">· {domain}</span>
    </a>
  );
}
```

- [ ] **Step 2: tsc**

Run: `npx tsc --noEmit`
Expected: 0 错误

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/source-url-pill.tsx
git commit -m "$(cat <<'EOF'
feat(shared): 新增 SourceUrlPill 共享组件展示稿件原文链接

供 M5 三个接入点复用：预览模式 / 翻译模式 / mission console。
variant=default 带蓝色 chip 背景，variant=compact 只显示文字 + icon
适合空间紧凑的场景。URL parse 失败兜底保留原字符串，url 为空时
整个组件不渲染（不显示占位）。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 5.2: 预览模式 (meta-header) 接入

**Files:**
- Modify: `src/app/(dashboard)/articles/[id]/features/reader/meta-header.tsx`

- [ ] **Step 1: 阅读现有 meta-header.tsx 结构**

Run: `cat /Users/zhuyu/dev/chinamcloud/vibetide/src/app/\(dashboard\)/articles/\[id\]/features/reader/meta-header.tsx | head -120`
确认 article prop 的结构（应包含 sourceUrl 字段）。

- [ ] **Step 2: 在元信息条加 SourceUrlPill**

import：
```tsx
import { SourceUrlPill } from "@/components/shared/source-url-pill";
```

在 meta-header 主 div 的最后一行（紧贴底部 / 或元信息条最右）加：
```tsx
<SourceUrlPill url={article.sourceUrl} variant="default" />
```

如果现有 meta-header 是 `<div className="flex items-center justify-between">` 布局，把 pill 放进 justify-between 的右侧 div；如果是单列堆叠，加在顶部独立一行。

- [ ] **Step 3: tsc + 手动验证**

Run: `npx tsc --noEmit`
Expected: 0 错误

dev server → 进 `/articles/<带 sourceUrl 的英文稿 id>` → 预览模式顶部看到蓝色 chip "查看原文 · weibo.com"。

进一个 sourceUrl=NULL 的文章 → 不渲染 chip。

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/articles/\[id\]/features/reader/meta-header.tsx
git commit -m "$(cat <<'EOF'
feat(article-detail): 预览模式 meta-header 接入 SourceUrlPill

稿件详情页"稿件预览"view 顶部元信息条加"查看原文"chip 跳回 sourceUrl
（如 tophub 原热榜链接）。sourceUrl 为空时整个 chip 不渲染。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 5.3: 翻译模式 (translate-overlay) 接入

**Files:**
- Modify: `src/app/(dashboard)/articles/[id]/features/translate/translate-overlay.tsx`

- [ ] **Step 1: 阅读现有 translate-overlay.tsx 结构**

Run: `cat /Users/zhuyu/dev/chinamcloud/vibetide/src/app/\(dashboard\)/articles/\[id\]/features/translate/translate-overlay.tsx | head -120`
找到 overlay header 区域（应有标题如"翻译对照"）。

- [ ] **Step 2: 在 overlay header 加 SourceUrlPill compact 变体**

import + 渲染：
```tsx
import { SourceUrlPill } from "@/components/shared/source-url-pill";

// header 区
<div className="flex items-center gap-3 border-b px-4 py-2">
  <h3 className="text-sm font-medium">翻译对照</h3>
  <SourceUrlPill url={article.sourceUrl} variant="compact" />
</div>
```

确认 article prop 在 translate-overlay 范围内可用；若不在则 prop drill 一层。

- [ ] **Step 3: tsc + 手动验证**

Run: `npx tsc --noEmit`
dev server → 进 `/articles/<id>` 切到"翻译模式" view → overlay 顶部看到 compact pill。

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/articles/\[id\]/features/translate/translate-overlay.tsx
git commit -m "$(cat <<'EOF'
feat(article-detail): 翻译模式 overlay 接入 SourceUrlPill compact

翻译对照面板顶部加紧凑型"查看原文"chip。让用户翻译时一眼能跳回
源链接。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 5.4: Mission console step 4 卡片增强

**Files:**
- Modify: `src/app/(dashboard)/missions/[id]/mission-console-client.tsx`

- [ ] **Step 1: 找到 TaskCard 展开区**

读取文件 search `function TaskCard` (约 line 891)，找到展开区渲染部分（约 line 985-1100 渲染 outputData）。

- [ ] **Step 2: 在 outputData 渲染上方加 archive_to_drafts 专属 panel**

import：
```tsx
import { SourceUrlPill } from "@/components/shared/source-url-pill";
import Link from "next/link";
```

在 TaskCard 展开区，找到渲染 outputObj.artifacts 之前，加：

```tsx
{task.assignedRole === "archive_to_drafts" && task.outputData && (() => {
  // outputData 结构：{ totalRequested, totalCreated, totalSkipped, created[], skipped[] }
  const out = task.outputData as {
    totalRequested?: number;
    totalCreated?: number;
    totalSkipped?: number;
    created?: { articleId: string; title: string; sourceUrl?: string }[];
    skipped?: { sourceUrl: string; existingArticleId: string; reason: string }[];
  };
  return (
    <div className="space-y-2 pt-2 border-t border-muted/40">
      <div className="text-xs text-muted-foreground">
        本次提交 {out.totalRequested ?? 0} 篇，新建 {out.totalCreated ?? 0} 篇，去重跳过 {out.totalSkipped ?? 0} 篇
      </div>
      {(out.created ?? []).map((c) => (
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
      {(out.skipped ?? []).length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            查看 {out.skipped!.length} 篇去重跳过
          </summary>
          <div className="space-y-1 pt-1">
            {out.skipped!.map((s) => (
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
})()}
```

- [ ] **Step 3: tsc**

Run: `npx tsc --noEmit`
Expected: 0 错误

- [ ] **Step 4: 手动验证**

dev server → 跑一次海外热榜搬运 mission → 进 `/missions/<id>` → 展开 step 4 卡片 → 应看到"新建 N 篇" + 每条 SourceUrlPill。

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/missions/\[id\]/mission-console-client.tsx
git commit -m "$(cat <<'EOF'
feat(mission-console): step 4 archive_to_drafts 卡片展开显示稿件列表

识别 task.assignedRole === "archive_to_drafts" → 解析 outputData
的 created/skipped → 渲染"新建 N 篇/跳过 M 篇"摘要 + 每条新稿带
Link 跳 /articles/[id] + SourceUrlPill 跳原文链接。skipped 列表
折叠在 <details> 里减少视觉噪点。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Phase 5 Acceptance

```bash
npx tsc --noEmit
npm run build
```

手动：
1. 跑完 Phase 4 后进 `/articles/<en-id>` 预览模式顶部 chip OK
2. 切翻译模式 overlay header 同样 OK
3. 进 mission console 展开 step 4 看新建列表 + chip
4. sourceUrl=NULL 的稿件不渲染 chip
5. 点 chip 在新窗口打开原 tophub 链接

---

## Phase 6 (M6) — inspiration 海外转发 + 单条工作流

**目标**: inspiration 卡片加"海外转发"按钮，启动 2 步简化工作流（cross_language_rewrite + archive_to_drafts）入英文稿到稿件库。

**改动文件**:
- `src/lib/types.ts`（InputFieldDef.hidden）
- `src/components/workflows/workflow-launch-dialog.tsx`
- `src/db/seed-builtin-workflows.ts`（新模板）
- `src/db/schema/missions.ts`（注释更新）
- `src/app/actions/hot-topics.ts`（startOverseasRepost）
- `src/app/(dashboard)/inspiration/inspiration-client.tsx`（按钮 + handler）

### Task 6.1: InputFieldDef.hidden 支持

**Files:**
- Modify: `src/lib/types.ts:340-365`
- Modify: `src/components/workflows/workflow-launch-dialog.tsx`

- [ ] **Step 1: 给 InputFieldDef 加 hidden 字段**

`src/lib/types.ts:340` 的 InputFieldDef interface 加：
```ts
export interface InputFieldDef {
  name: string;
  label: string;
  type: "text" | "textarea" | "select" | "multiselect" | "date" | "daterange" | "url" | "number" | "toggle";
  required?: boolean;
  placeholder?: string;
  defaultValue?: unknown;
  options?: InputFieldOption[];
  helpText?: string;
  validation?: { ... };
  hidden?: boolean;  // ← 新增：系统注入字段，发起任务表单不渲染
}
```

- [ ] **Step 2: workflow-launch-dialog 渲染时跳过**

找到 workflow-launch-dialog.tsx 渲染 inputFields 的 .map 循环（约 line 180-210），在循环顶部加 guard：

```tsx
{inputFields
  .filter((field) => !field.hidden)
  .map((field) => (
    // 现有渲染逻辑
  ))}
```

- [ ] **Step 3: tsc**

Run: `npx tsc --noEmit`
Expected: 0 错误

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts src/components/workflows/workflow-launch-dialog.tsx
git commit -m "$(cat <<'EOF'
feat(workflow): InputFieldDef 加 hidden 字段，发起表单跳过

为 M6 海外转发预留：source_topic_id / source_title / source_url
等系统注入字段标 hidden:true，启动对话框不渲染给用户看，但 mission
执行器接收 inputs 时仍能消费。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 6.2: 新建 hot_topic_single_overseas_repost 模板 seed

**Files:**
- Modify: `src/db/seed-builtin-workflows.ts`（在 BUILTIN_WORKFLOWS 末尾追加）
- Modify: `src/db/schema/missions.ts`（注释更新）

- [ ] **Step 1: 在 seed-builtin-workflows.ts 末尾（line 2273 `];` 之前）追加**

```ts
  // ════════════════════════════════════════════════════════════════════════
  // 公共场景 · 海外转发（单条）（M6 / 2026-05-26）
  // inspiration 卡片 "海外转发" 按钮调用，单条 topic 简化版海外热榜搬运
  // ════════════════════════════════════════════════════════════════════════
  {
    slug: "hot_topic_single_overseas_repost",
    name: "海外转发（单条）",
    description: "把单条选定热点翻译改写成英文稿件入库。海外热榜搬运的简化版，不经分类过滤、不通知审核。",
    icon: "send",
    category: "social",
    ownerEmployeeId: null,
    defaultTeam: ["xiaowen"],
    inputFields: [
      { name: "source_topic_id", label: "热点 ID（系统注入）", type: "text", required: true, hidden: true },
      { name: "source_title", label: "原标题（系统注入）", type: "text", required: true, hidden: true },
      { name: "source_body", label: "原正文（系统注入）", type: "textarea", required: false, hidden: true },
      { name: "source_url", label: "原文链接（系统注入）", type: "url", required: false, hidden: true },
      {
        name: "variants_per_topic",
        label: "生成稿件版本数",
        type: "number",
        required: false,
        defaultValue: 1,
        validation: { min: 1, max: 3 },
        helpText: "1=单稿；2-3=多版本（短/长/钩子）",
      },
    ],
    systemInstruction:
      "把这条选定热点改写成 {{variants_per_topic}} 篇适合 X / Instagram 海外读者的英文稿件并入本地稿件库等审核。",
    promptTemplate:
      "原标题：{{source_title}}\n原文：{{source_body}}\n原文链接：{{source_url}}\n请翻译改写成英文，生成 {{variants_per_topic}} 个版本。",
    isFeatured: false,
    steps: [
      step(1, "翻译改写", "cross_language_rewrite", "中英本地化改写", "content_gen", "translate"),
      step(2, "入英文稿件库（待审）", "archive_to_drafts", "稿件入库", "distribution", "store",
        { language: "en", initialStatus: "approved" }),
    ],
  },
```

- [ ] **Step 2: 更新 missions.ts 注释**

`src/db/schema/missions.ts:55` 的 sourceModule 注释加新值：

```ts
sourceModule: text("source_module"),
// 'hot_topics' | 'hot_topics_overseas' | 'publishing' | 'benchmarking' | ...
```

- [ ] **Step 3: 跑 seed**

Run: `npm run db:seed`
Expected: 新增 1 个 builtin workflow，无错

- [ ] **Step 4: tsc + vitest**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 全 PASS

- [ ] **Step 5: Commit**

```bash
git add src/db/seed-builtin-workflows.ts src/db/schema/missions.ts
git commit -m "$(cat <<'EOF'
feat(seed): 新增 hot_topic_single_overseas_repost 简化工作流模板

只 2 步：cross_language_rewrite + archive_to_drafts，复用 M4 改造
后的 skill。inputFields 4 个 hidden 字段（source_topic_id / title
/ body / url）由 server action 注入，1 个用户可见字段（versions
per topic）。isFeatured: false 不出现在首页卡片网格，仅供 M6
inspiration 按钮触发。

跑 npm run db:seed 同步。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 6.3: 新建 startOverseasRepost server action

**Files:**
- Modify: `src/app/actions/hot-topics.ts`
- Test: `src/app/actions/__tests__/start-overseas-repost.test.ts`（新建）

- [ ] **Step 1: 写测试**

```ts
// src/app/actions/__tests__/start-overseas-repost.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/current-user", () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: "u1" }),
}));

const findFirstUserProfile = vi.fn();
const findFirstHotTopic = vi.fn();
const findFirstMission = vi.fn();
const findFirstTemplate = vi.fn();
const updateMissionMock = vi.fn();
const startMissionFromTemplateMock = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      userProfiles: { findFirst: findFirstUserProfile },
      hotTopics: { findFirst: findFirstHotTopic },
      missions: { findFirst: findFirstMission },
      workflowTemplates: { findFirst: findFirstTemplate },
    },
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ catch: vi.fn() })) })) })),
  },
}));
vi.mock("@/db/schema/missions", () => ({ missions: {} as never }));
vi.mock("@/db/schema/hot-topics", () => ({ hotTopics: {} as never }));
vi.mock("@/db/schema/user-profiles", () => ({ userProfiles: {} as never }));
vi.mock("@/db/schema/workflow-templates", () => ({ workflowTemplates: {} as never }));
vi.mock("@/app/actions/workflow-launch", () => ({ startMissionFromTemplate: startMissionFromTemplateMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { startOverseasRepost } from "../hot-topics";

beforeEach(() => {
  findFirstUserProfile.mockReset();
  findFirstHotTopic.mockReset();
  findFirstMission.mockReset();
  findFirstTemplate.mockReset();
  startMissionFromTemplateMock.mockReset();
  findFirstUserProfile.mockResolvedValue({ id: "u1", organizationId: "org1" });
});

describe("startOverseasRepost", () => {
  it("正常路径：拉 topic + 启 mission + 回填 sourceModule", async () => {
    findFirstHotTopic.mockResolvedValue({
      id: "topic1", title: "T", summary: "S", url: "https://weibo.com/x",
    });
    findFirstMission.mockResolvedValue(null);
    findFirstTemplate.mockResolvedValue({ id: "tpl1" });
    startMissionFromTemplateMock.mockResolvedValue({ ok: true, missionId: "m1" });

    const res = await startOverseasRepost("topic1");

    expect(res.id).toBe("m1");
    expect(startMissionFromTemplateMock).toHaveBeenCalledWith("tpl1", expect.objectContaining({
      source_topic_id: "topic1",
      source_title: "T",
      source_url: "https://weibo.com/x",
    }));
  });

  it("同 topic 已有 mission 复用", async () => {
    findFirstHotTopic.mockResolvedValue({ id: "topic1", title: "T", url: "" });
    findFirstMission.mockResolvedValue({ id: "existing-m" });
    const res = await startOverseasRepost("topic1");
    expect(res.id).toBe("existing-m");
    expect(startMissionFromTemplateMock).not.toHaveBeenCalled();
  });

  it("模板未 seed 抛错", async () => {
    findFirstHotTopic.mockResolvedValue({ id: "topic1", title: "T" });
    findFirstMission.mockResolvedValue(null);
    findFirstTemplate.mockResolvedValue(null);
    await expect(startOverseasRepost("topic1")).rejects.toThrow(/模板未 seed/);
  });
});
```

- [ ] **Step 2: 测试 FAIL**

Run: `npx vitest run src/app/actions/__tests__/start-overseas-repost.test.ts`
Expected: FAIL — startOverseasRepost 不存在

- [ ] **Step 3: 在 hot-topics.ts 末尾加 startOverseasRepost**

读取 `src/app/actions/hot-topics.ts:1-40` 看现有 import，然后在文件末尾追加：

```ts
import { workflowTemplates } from "@/db/schema/workflow-templates";

/**
 * Start an "Overseas Repost" mission from a single hot topic.
 * 跟 startTopicMission（快速追踪）共存：sourceModule 不同（hot_topics_overseas）
 * 避免 missions_source_dedup_uidx 唯一索引冲突。
 */
export async function startOverseasRepost(topicId: string): Promise<{ id: string }> {
  const user = await requireAuth();
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });
  if (!profile?.organizationId) throw new Error("No organization found");

  const topic = await db.query.hotTopics.findFirst({
    where: eq(hotTopics.id, topicId),
  });
  if (!topic) throw new Error("Topic not found");

  // 同 topic 已转发则复用现有 mission（区别于快速追踪：sourceModule="hot_topics_overseas"）
  const existing = await db.query.missions.findFirst({
    where: and(
      eq(missions.organizationId, profile.organizationId),
      eq(missions.sourceModule, "hot_topics_overseas"),
      eq(missions.sourceEntityId, topicId),
      ne(missions.status, "failed"),
    ),
    columns: { id: true },
  });
  if (existing) return { id: existing.id };

  const template = await db.query.workflowTemplates.findFirst({
    where: and(
      eq(workflowTemplates.organizationId, profile.organizationId),
      eq(workflowTemplates.legacyScenarioKey, "hot_topic_single_overseas_repost"),
    ),
  });
  if (!template) {
    throw new Error("海外转发模板未 seed，请联系管理员同步 builtin workflows");
  }

  const inputs = {
    source_topic_id: topicId,
    source_title: topic.title,
    source_body: topic.summary ?? topic.title,
    source_url: topic.url ?? "",
    variants_per_topic: 1,
  };

  const res = await startMissionFromTemplate(template.id, inputs);
  if (!res.ok) {
    throw new Error(`启动海外转发失败：${Object.values(res.errors).join("; ")}`);
  }

  // 回填 source 关联 + mission 标题
  await db.update(missions).set({
    title: `海外转发：${topic.title}`,
    sourceModule: "hot_topics_overseas",
    sourceEntityId: topicId,
    sourceEntityType: "hot_topic",
  }).where(eq(missions.id, res.missionId)).catch((err) => {
    console.warn("[overseas-repost] backfill source failed:", err);
  });

  revalidatePath("/missions");
  return { id: res.missionId };
}
```

- [ ] **Step 4: 测试 PASS + tsc**

Run: `npx vitest run src/app/actions/__tests__/start-overseas-repost.test.ts && npx tsc --noEmit`
Expected: 3 PASS, 0 错误

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/hot-topics.ts src/app/actions/__tests__/start-overseas-repost.test.ts
git commit -m "$(cat <<'EOF'
feat(hot-topics): 新增 startOverseasRepost server action

镜像 startTopicMission（快速追踪）的 pattern，但 sourceModule
固定为 "hot_topics_overseas"，跟快速追踪共存不冲突
missions_source_dedup_uidx。注入选定 topic 的 title/summary/url
到 hot_topic_single_overseas_repost 模板，启动 2 步简化工作流。
同 topic 已转发则复用现有 mission。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 6.4: inspiration UI 加按钮

**Files:**
- Modify: `src/app/(dashboard)/inspiration/inspiration-client.tsx`

- [ ] **Step 1: 找到 topic 卡片 action 区**

读取 `src/app/(dashboard)/inspiration/inspiration-client.tsx` line 1482-1515（HotTopicList 内 topic 卡片底部）。

- [ ] **Step 2: 加 onStartOverseasRepost prop + 按钮**

a) import：
```tsx
import { Globe } from "lucide-react";
import { startOverseasRepost } from "@/app/actions/hot-topics";
import { toast } from "sonner"; // 如果项目用 sonner
```

b) HotTopicList props interface 加（约 line 1333 附近）：
```tsx
onStartOverseasRepost: (id: string) => void;
isRepostPending: boolean;
```

c) 父组件（约 line 837 渲染 HotTopicList 处）加 handler + state：
```tsx
const [isRepostPending, startRepostTransition] = useTransition();
const handleStartOverseasRepost = (topicId: string) => {
  startRepostTransition(async () => {
    try {
      const res = await startOverseasRepost(topicId);
      router.push(`/missions/${res.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "海外转发启动失败");
    }
  });
};
// ... pass props
<HotTopicList
  // ... existing
  onStartOverseasRepost={handleStartOverseasRepost}
  isRepostPending={isRepostPending}
/>
```

d) 在 topic 卡片 action 区（约 line 1482 的 `<div className="ml-auto flex items-center gap-1">` 内）的最前面加按钮：

```tsx
{!isTracked && (
  <button
    onClick={() => onStartOverseasRepost(topic.id)}
    disabled={isRepostPending}
    title="把本条热点翻译改写成英文稿件入稿件库"
    className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-0.5 transition-colors"
  >
    <Globe size={10} />
    {isRepostPending ? "转发中..." : "海外转发"}
  </button>
)}
```

放在"快速追踪"按钮左侧（即整个 action 区第一个）。

- [ ] **Step 3: tsc + 手动验证**

Run: `npx tsc --noEmit`
Expected: 0 错误

dev server → 进 `/inspiration` → 任一卡片右下应有 4 个按钮（海外转发 / 快速追踪 / 深度追踪 / 收藏）。点海外转发 → 转圈"转发中..." → 跳 `/missions/<new-id>`。

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/inspiration/inspiration-client.tsx
git commit -m "$(cat <<'EOF'
feat(inspiration): topic 卡片加"海外转发"按钮（emerald + Globe）

新按钮放在"快速追踪"左侧（action 区第一个），点击调
startOverseasRepost(topic.id) 启动单条 topic 海外转发 mission，
然后 router.push 跳 /missions/[id]。同 topic 已转发则复用现有
mission（dedupe）。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Phase 6 Acceptance

```bash
npx vitest run src/app/actions/__tests__/start-overseas-repost.test.ts
npx tsc --noEmit
npm run build
```

手动 (dev server)：
1. 进 `/inspiration` 任一卡片右下能看到 4 个按钮（海外转发/快速追踪/深度追踪/收藏）
2. 点海外转发 → 跳 mission console
3. 2 个 task 跑完后进 step 2 看到"新建 1 篇"，跳 `/articles/<id>` 看英文稿
4. 英文稿预览模式顶部看到"查看原文" pill（M5）
5. 同 topic 再点 → 跳已创建 mission（dedupe）
6. 同时点快速追踪 + 海外转发 → 两 mission 都能创建
7. `SELECT title, source_url, status, metadata FROM articles WHERE metadata->>'createdByWorkflow' = 'true' ORDER BY id DESC LIMIT 5` 完整

---

## 全局 Acceptance

完成全部 6 phase 后：

```bash
# 全量回归
npx tsc --noEmit
npx vitest run
npm run build

# 审计
npx tsx scripts/audit-model-references.ts  # exit 0

# Schema 同步
bash scripts/verify-schema-sync.sh  # 0 MISSING / 0 STALE
```

业务验证清单：

- [ ] `/skills/<trending_topics id>` 测试看到真实热榜
- [ ] `/skills/<cms_publish id>` 测试有黄色 dryRun 横幅，articles 表不变
- [ ] 工作流编辑器加新分类（如"汽车"）能保存
- [ ] 发起海外热榜搬运（variants=2）→ articles 表多入 2N 条，每条带 sourceUrl
- [ ] 同参数二次跑 → totalSkipped=N，无重复
- [ ] 英文稿 `/articles/[id]` 预览/翻译模式顶部都有"查看原文" pill
- [ ] mission console step 4 卡片展开看到 created/skipped 列表 + 跳转
- [ ] `/inspiration` 卡片点"海外转发" → 跑通 → 进稿件库看到新英文稿

## Risks & Rollback

| Risk | 已设计的缓解 | Rollback |
|---|---|---|
| qwen3-max 对动态 enum 输出不稳定 | M3 测试覆盖；missing 兜底归 other | revert M3 commit，临时回硬编码 enum |
| LLM 不按 prompt 透传 sourceUrl | M4 ServerSide 兜底（findById 回填）| 已自动兜底 |
| variants 生成内容雷同 | prompt 引导明确"明显不同" | 跑出来雷同 → 加调编辑手动删 |
| seed 同步漏跑导致 M4/M6 模板对不上 | 每个 phase 末尾要求跑 `npm run db:seed` | 重跑 db:seed |
| Phase 6 race window 双击 → 双 mission | startMissionFromTemplate 前置 findFirst | 已自动复用 existing |
| archive_to_drafts dedup 性能（20×40 queries）| M4 实测如果 >2s 改 IN(...) 批量 | 优化在 follow-up，不阻塞 |

每 phase 独立 commit → `git revert <sha>` 单独回滚不影响其他 phase。

---

**Status:** Plan written. 等待用户选择执行模式（subagent-driven vs inline execution）后进入实施。

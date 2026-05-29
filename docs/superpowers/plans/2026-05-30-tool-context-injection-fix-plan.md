# Tool Context Injection + Step Failure Detection — Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to execute. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 让所有 LLM agent 路径调用的工具（cms_publish / archive_to_drafts 等需要 organizationId 的写入型工具）能正确收到 organizationId / operatorId 注入；同时让工具返回 `success: false` 的失败被正确反映到 step status 上（不再误报"通过"）。

**Architecture:**
- 给 `toVercelTools` 加可选 `context: { organizationId?, operatorId? }` 参数，内部包装每个 tool 的 `execute`，把 context 自动填进 args（与 `invokeToolDirectly` 既有的注入模式一致）。
- 给 `executeAgent` 加可选 `context` 参数透传给 toVercelTools。
- 改 5 个 toVercelTools 调用点 + 6 个 executeAgent 调用点，从各自的 session/mission 上下文拿 org 传进去。
- 在 `executeAgent` 的 `onStepFinish` 回调里追踪 tool result 中 `result.success === false` 的失败，结束后 override 整步骤 status。

**Tech Stack:** TypeScript / AI SDK v6 (`generateText` + `tool` + `stepCountIs`) / Vitest

**Background reading:**
- 根因分析见 chat session 上下文（2026-05-30）
- Bug 历史对照：`src/lib/mission-executor.ts:1093-1131` 的 `toolFailure` 检测逻辑（已经存在但只对预执行短路路径生效；本次要让 LLM agent 路径也生效）

---

## File Structure

**修改的文件（共 ~11 个）：**

| 文件 | 责任 | 改动量 |
|------|------|--------|
| `src/lib/agent/tool-registry.ts` | `toVercelTools` 加 context + 包装 wrapper；export 一个 `wrapToolWithContext` helper | +25 行 |
| `src/lib/agent/execution.ts` | `executeAgent` 加 context 参数；onStepFinish 追踪 tool 失败；结束后 override status | +35 行 |
| `src/lib/agent/types.ts` | `AgentExecutionInput` 加 `context?` 字段（或独立参数） | +5 行 |
| `src/lib/mission-executor.ts` | 3 处 executeAgent 调用传 `{organizationId: mission.organizationId, operatorId: task.assignedEmployeeId}` | +10 行 |
| `src/app/api/workflows/test-run/route.ts` | executeAgent 传 `{organizationId: orgId, operatorId: user.id}` | +3 行 |
| `src/inngest/functions/leader-plan.ts` | executeAgent 传 mission context | +3 行 |
| `src/inngest/functions/leader-consolidate.ts` | executeAgent 传 mission context | +3 行 |
| `src/app/actions/employee-advanced.ts` | toVercelTools 传 context | +2 行 |
| `src/app/api/chat/stream/route.ts` | toVercelTools 传 context | +2 行 |
| `src/app/api/chat/intent-execute/route.ts` | toVercelTools 传 context | +2 行 |
| `src/app/api/scenarios/execute/route.ts` | toVercelTools 传 context | +2 行 |

**新建测试文件（共 1 个，其余追加）：**

| 文件 | 测试责任 |
|------|---------|
| `src/lib/agent/__tests__/to-vercel-tools-context.test.ts` | `toVercelTools(tools, ..., context)` 注入 organizationId/operatorId；不传 context 退化为透传；显式参数不被覆盖 |
| `src/lib/agent/__tests__/execute-agent-tool-failure.test.ts` | executeAgent 检测 toolResult.success=false 时 output.status = failed + errorMessage |

---

## Phase 1: toVercelTools 加 context 包装

**Scope:** 改 `tool-registry.ts:2295` 的 `toVercelTools` 签名，对 `ALL_TOOLS[t.name]` 在返回前做 wrapper 注入；零行为变化（不传 context 时仍是历史行为）。

### Task 1.1: 写 toVercelTools context 单测（TDD）

**Files:**
- Create: `src/lib/agent/__tests__/to-vercel-tools-context.test.ts`

**关键测试 case：**
1. `toVercelTools(agentTools, undefined, undefined, undefined, undefined)` 不传 context → 工具行为完全等同改造前（透传 args）
2. `toVercelTools(agentTools, undefined, undefined, undefined, { organizationId: "org-1" })` → cms_publish tool wrapped；execute 收到 `organizationId: "org-1"`
3. 显式 `args.organizationId = "explicit"` → wrapper 不覆盖（用户传的优先）
4. context 同时提供 organizationId + operatorId → 都注入

Mock 一个简单 tool（带 `inputSchema` + `execute`），用 `vi.spyOn` 检查 execute 收到的 args。

### Task 1.2: 改 toVercelTools

**Files:**
- Modify: `src/lib/agent/tool-registry.ts`

(a) `toVercelTools` 签名加第 5 个参数：

```ts
export interface ToolContext {
  organizationId?: string;
  operatorId?: string;
}

export function toVercelTools(
  agentTools: AgentTool[],
  pluginConfigs?: Map<string, { description: string; config: PluginConfig }>,
  missionTools?: ToolSet,
  knowledgeBaseTools?: ToolSet,
  context?: ToolContext,  // ← 新增
): ToolSet {
```

(b) 内部 helper（不 export，文件内私有）：

```ts
function wrapToolExecuteWithContext<T extends { execute?: (args: Record<string, unknown>, ...rest: unknown[]) => unknown }>(
  toolDef: T,
  context?: ToolContext,
): T {
  if (!context || (!context.organizationId && !context.operatorId)) {
    return toolDef;
  }
  const orig = toolDef.execute;
  if (typeof orig !== "function") return toolDef;
  return {
    ...toolDef,
    execute: async (args: Record<string, unknown>, ...rest: unknown[]) => {
      const merged = { ...args };
      if (context.organizationId && merged.organizationId === undefined) {
        merged.organizationId = context.organizationId;
      }
      if (context.operatorId && merged.operatorId === undefined) {
        merged.operatorId = context.operatorId;
      }
      return orig(merged, ...rest);
    },
  };
}
```

(c) 把 `ALL_TOOLS[t.name]` 用 wrapper 处理：

```ts
result[t.name] = wrapToolExecuteWithContext(ALL_TOOLS[t.name], context);
```

`missionTools` 和 `knowledgeBaseTools` 也用同样的 wrapper：在 `Object.assign(result, missionTools)` 之前用 `for ... entries` 逐个 wrap；同理 KB tools。

### Task 1.3: tsc + commit

```bash
npx tsc --noEmit
npx vitest run src/lib/agent/__tests__/to-vercel-tools-context.test.ts
git add src/lib/agent/tool-registry.ts \
        src/lib/agent/__tests__/to-vercel-tools-context.test.ts
git commit -m "feat(agent): toVercelTools 支持 context 注入 organizationId/operatorId"
```

---

## Phase 2: executeAgent 接受 context + 追踪 tool 失败 + status override

**Scope:** `execution.ts` 改造。`executeAgent` 新增 context 参数透传给 toVercelTools；用 `onStepFinish` 追踪 tool result 里 `success === false` 的失败；结束后 override `output.status = "failed"`。

### Task 2.1: 写 executeAgent 失败追踪单测（TDD）

**Files:**
- Create: `src/lib/agent/__tests__/execute-agent-tool-failure.test.ts`

Mock `generateText` 让它的 `onStepFinish` 回调接收一个含 `{toolCalls: [...], toolResults: [{result: {success: false, error: {...}}}]}` 的 step；然后断言 `output.status === "failed"` 且 `output.errorMessage` 包含错误内容。

### Task 2.2: 改 executeAgent

**Files:**
- Modify: `src/lib/agent/execution.ts`
- Modify (optional): `src/lib/agent/types.ts`

(a) 加参数：

```ts
export async function executeAgent(
  agent: AssembledAgent,
  input: AgentExecutionInput,
  onProgress?: ProgressCallback,
  missionTools?: ToolSet,
  context?: ToolContext,  // ← 新增（从 tool-registry 导入或同文件 re-declare）
): Promise<AgentExecutionResult> {
```

(b) 透传给 toVercelTools：

```ts
const vercelTools = toVercelTools(agent.tools, agent.pluginConfigs, missionTools, kbTools, context);
```

(c) 追踪 tool 失败：在 `generateText({ ..., onStepFinish: ({ toolCalls, toolResults }) => { ... } })` 里收集失败：

```ts
const toolFailures: Array<{ toolName: string; code: string; message: string }> = [];

const result = await generateText({
  ...
  onStepFinish: ({ toolCalls, toolResults }) => {
    if (toolCalls && toolCalls.length > 0) {
      toolCallCount += toolCalls.length;
      onProgress?.({ percent: Math.min(30 + toolCallCount * 10, 80), message: `已执行 ${toolCallCount} 个工具调用...` });
    }
    if (toolResults) {
      for (const tr of toolResults) {
        const r = (tr as { result?: { success?: unknown; error?: unknown } }).result;
        if (r && typeof r === "object" && r.success === false) {
          const err = r.error as { code?: unknown; message?: unknown } | undefined;
          toolFailures.push({
            toolName: (tr as { toolName?: string }).toolName ?? "unknown",
            code: typeof err?.code === "string" ? err.code : "tool_error",
            message: typeof err?.message === "string" ? err.message : "工具返回 success=false",
          });
        }
      }
    }
  },
});
```

(d) override status：在 `parseStepOutput` 之后追加：

```ts
const output = parseStepOutput(result.text, input.stepKey, agent.slug);

if (toolFailures.length > 0) {
  output.status = "failed";
  const first = toolFailures[0];
  output.errorMessage = `工具 ${first.toolName} 失败：${first.code} — ${first.message}` +
    (toolFailures.length > 1 ? `（共 ${toolFailures.length} 个工具失败）` : "");
  output.errorCode = first.code;
}
```

如果 `parseStepOutput` 返回的 `StepOutput` 类型上没有 `errorMessage` / `errorCode` 字段，去 `src/lib/agent/types.ts` 或 step-io.ts 补上（optional）。

### Task 2.3: tsc + commit

```bash
npx tsc --noEmit
npx vitest run src/lib/agent/__tests__/execute-agent-tool-failure.test.ts
git add src/lib/agent/execution.ts src/lib/agent/__tests__/execute-agent-tool-failure.test.ts src/lib/agent/types.ts
git commit -m "feat(agent): executeAgent 透传 context 并追踪工具失败、override step status"
```

---

## Phase 3: 更新所有调用点

**Scope:** 5 个 toVercelTools 调用点 + 6 个 executeAgent 调用点，从各自的 session/mission/auth 取 org 传进去。

### Task 3.1: 更新 4 个 toVercelTools 直接调用点

**Files:**
- Modify: `src/app/actions/employee-advanced.ts:432` — 从 `requireUserAndOrg()` 获取 org
- Modify: `src/app/api/chat/stream/route.ts:160` — 从 `getCurrentUserOrg()` / session 获取 org
- Modify: `src/app/api/chat/intent-execute/route.ts:214` — 同上
- Modify: `src/app/api/scenarios/execute/route.ts:161` — 同上

每处加 `{ organizationId: orgId, operatorId: userId }` 作为第 5 个参数。

```ts
const vercelTools = toVercelTools(
  agent.tools,
  agent.pluginConfigs,
  undefined,  // missionTools (this caller doesn't have)
  undefined,  // kbTools (this caller doesn't have)
  { organizationId: orgId, operatorId: userId },
);
```

### Task 3.2: 更新 6 个 executeAgent 调用点

**Files:**
- Modify: `src/lib/mission-executor.ts:388 / 1252 / 1636` — 3 处都从 `mission.organizationId` + `task.assignedEmployeeId` (或 mission.leaderEmployeeId) 拿
- Modify: `src/app/api/workflows/test-run/route.ts:478` — 从 `{orgId, user.id}` 拿
- Modify: `src/inngest/functions/leader-plan.ts` — 从 mission 拿
- Modify: `src/inngest/functions/leader-consolidate.ts:133` — 从 mission 拿

每处加第 5 个参数 `context`。

### Task 3.3: 验证 + commit

```bash
npx tsc --noEmit
npx vitest run                  # 全套
git add -p                       # 选择性 stage（避免误带工作树 dirty 文件）
git commit -m "feat(agent): 所有 executeAgent/toVercelTools 调用点透传 organizationId/operatorId 上下文"
```

注意：working tree 有大量 unrelated dirty 文件，Phase 3 改动跨多个目录，**手动 `git add` 每个文件**，绝不 `git add -A`。

---

## Phase 4: 端到端集成 + 手动验收

**Scope:** 全套测试 + 走一次"真跑"验证 cms_publish 在 LLM agent 路径下能成功入库。

### Task 4.1: 全量回归

```bash
npm run test         # 期待 ≥ 897 passing（含 2 新增测试 case）
npx tsc --noEmit
npm run build
```

### Task 4.2: 手动 dev 验收 checklist

1. 启 `npm run dev`
2. 找一个 workflow_template 含 cms_publish step（修复后的 `ai_daily` 或新建一个简化测试模板）
3. 启动 mission，跑到 cms_publish step
4. **期望**：step 状态显示"已完成"且产出含真实 cmsArticleId / publishedUrl；CMS 后台能查到稿件
5. 制造失败场景（catalogId 填错 / VIBETIDE_CMS_PUBLISH_ENABLED 暂时设 false）→ **期望**：step 状态显示 "X 失败"，errorMessage 含具体 stage / code

### Task 4.3: 可选 commit（如有 doc 更新）

无代码改动，无需 commit。如果验收发现新 issue，单独开 follow-up。

---

## 收尾 checklist

- [ ] Phase 1 完成：`toVercelTools` context 包装 + 单测通过
- [ ] Phase 2 完成：`executeAgent` context 透传 + tool 失败追踪 + status override
- [ ] Phase 3 完成：5 + 6 = 11 个调用点全更新
- [ ] Phase 4 完成：测试 + 构建 + 手动验收
- [ ] 全部 phase 合计 commit 数 ≈ 4
- [ ] `npm run test` / `tsc` / `build` 三件套绿

## 风险与回退

- **回退点**：每个 phase 独立 commit，单独 revert 不影响其他 phase
- **向后兼容**：toVercelTools 和 executeAgent 的 context 参数都是 optional；未传时行为完全等同改造前；不会破坏未更新的调用点
- **测试覆盖**：Phase 1 + 2 各有单测锁住"传 context"与"不传 context"两条路径

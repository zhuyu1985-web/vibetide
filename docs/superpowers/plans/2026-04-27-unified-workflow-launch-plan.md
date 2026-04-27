# 统一工作流启动 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 employee/home/chat 三处启动 workflow_template 的行为完全对齐，并让 chat 入口启动后能在对话流里实时显示 mission 步骤进度。

**Architecture:**
- 删 `workflow_templates.launchMode` 字段，统一由 `inputFields.length` 决定是否弹表单
- `WorkflowLaunchDialog` 升级为唯一启动组件（新增 `onLaunched` 可选回调），三入口共用
- chat 入口启动后插入 `mission_card` 消息（仅存 missionId 引用），订阅 `/api/missions/[id]/progress` SSE 渲染步骤时间线

**Tech Stack:** Next.js 16 / React 19 / TypeScript / Drizzle ORM / Supabase / SSE / Tailwind / shadcn

**Spec：** `docs/superpowers/specs/2026-04-27-unified-workflow-launch-design.md`

**Phase 范围：**
- Phase 1（Task 1–13）+ Phase 2（Task 14–20）必须**同 PR 上线**（spec §7 约束，避免 chat 体验过夜降级）
- Phase 3（Task 21–24）可独立 PR

---

## File Structure

**Modify：**
- `src/db/schema/workflows.ts` — 删 `launchMode` 字段（line 88）
- `src/db/seed-builtin-workflows.ts` — 删所有 `launchMode` 字段引用（~50 处）
- `src/db/schema/saved-conversations.ts` — 扩展 `messages` jsonb 元素 TS 类型（加 `kind` / `missionId` / `templateId` / `templateName` 可选字段）
- `src/components/workflows/workflow-launch-dialog.tsx` — 加 `onLaunched` 可选回调；空 `inputFields` 极简模式
- `src/components/workflows/workflow-editor.tsx` — 删 `launchMode` 状态 + UI dropdown
- `src/components/workflows/input-fields-editor.tsx` — 删 launchMode 注释
- `src/components/home/scenario-grid.tsx` — 删 `launchMode === 'direct'` 分支
- `src/app/(dashboard)/workflows/workflows-client.tsx` — 删 launchMode 直启分支
- `src/app/(dashboard)/workflows/[id]/edit/page.tsx` — 删 launchMode 字段映射
- `src/app/(dashboard)/employee/[id]/employee-profile-client.tsx` — `EmployeeWorkflowsSection` 弹 dialog 替代 `handleStart` 直调 startMission
- `src/app/(dashboard)/chat/chat-panel.tsx` — Phase 1 删除内联 scenario 表单（line 974-1075）；Phase 2 加 `mission_card` 消息渲染
- `src/app/(dashboard)/chat/chat-center-client.tsx` — `handleSelectScenario` 改为弹 `WorkflowLaunchDialog`，回调插入 mission_card
- `src/app/(dashboard)/chat/page.tsx` — 直接传 `WorkflowTemplateRow[]` 给 chat client（不再 map 到 `ScenarioCardData`）
- `src/lib/dal/workflow-templates.ts` — 删 select 中的 `launchMode`，删 seed helper 中的 launchMode 写入
- `src/lib/dal/workflow-templates-listing.ts`（如有引用）
- `src/app/actions/workflow-engine.ts` — 删 createWorkflow / updateWorkflow 接受 launchMode 字段
- `src/lib/dal/__tests__/workflow-templates-listing.test.ts` — 删 launchMode fixture

**Create：**
- `supabase/migrations/<ts>_drop_workflow_launch_mode.sql` — 由 `npm run db:generate` 自动生成
- `src/lib/hooks/use-mission-progress.ts` — SSE 订阅 hook
- `src/components/chat/mission-card-message.tsx` — 任务卡片消息组件
- `src/lib/hooks/__tests__/use-mission-progress.test.ts` — hook 单元测试
- `src/components/workflows/workflow-card-menu.tsx` — Phase 3 "⋯" 菜单

**Delete：**
- `src/app/(dashboard)/chat/scenario-form-sheet.tsx` — orphan dead code

---

## Phase 1 — 统一启动

### Task 1: Drop `launchMode` 字段（schema + 迁移文件）

**Files:**
- Modify: `src/db/schema/workflows.ts:88`
- Generate: `supabase/migrations/<auto-timestamp>_drop_workflow_launch_mode.sql`

- [ ] **Step 1.1：从 schema 删字段**

编辑 `src/db/schema/workflows.ts`，删掉 line 88：
```ts
launchMode: text("launch_mode").notNull().default("form"),
```

- [ ] **Step 1.2：生成迁移**

```bash
npm run db:generate
```

预期：`supabase/migrations/` 下新增一个 `<ts>_drop_workflow_launch_mode.sql`，内容是 `ALTER TABLE workflow_templates DROP COLUMN launch_mode`。

- [ ] **Step 1.3：检查 migration 内容**

打开新生成的 sql 文件，确认它只包含 DROP COLUMN，没有意外的其它变更。如果 drizzle 顺手把别的字段也改了，停下来排查，因为代表 schema 漂移已经发生。

- [ ] **Step 1.4：把 migration 应用到本地 DB**

```bash
npm run db:push
```

预期：drizzle 提示一次 destructive change 确认（手动 y），完成后无报错。

- [ ] **Step 1.5：Commit**

```bash
git add src/db/schema/workflows.ts supabase/migrations/<ts>_drop_workflow_launch_mode.sql
git commit -m "feat(schema): drop workflow_templates.launch_mode column"
```

---

### Task 2: 清理 seed 文件中的 launchMode

**Files:**
- Modify: `src/db/seed-builtin-workflows.ts`（~50 处）

- [ ] **Step 2.1：删类型定义里的 launchMode**

在 `src/db/seed-builtin-workflows.ts:43`，把 `launchMode: "form" | "direct";` 这行从 `BuiltinScenarioSeed` interface 删掉。

- [ ] **Step 2.2：批量删所有 `launchMode: "form" | "direct"` 字段**

每个 builtin scenario 对象里的 `launchMode: "form",` 或 `launchMode: "direct",` 一行整行删掉。预计约 50 处。

最快做法：
```bash
sed -i '' '/^    launchMode: "form",$/d' src/db/seed-builtin-workflows.ts
sed -i '' '/^    launchMode: "direct",$/d' src/db/seed-builtin-workflows.ts
```

然后人工 grep 确认无残留：
```bash
grep -n 'launchMode' src/db/seed-builtin-workflows.ts
```

- [ ] **Step 2.3：删 line 2284 把 launchMode 写入 DB 的代码**

打开 `seed-builtin-workflows.ts:2284`，找到 `launchMode: w.launchMode,` 这行，整行删掉。同时检查 line 2261 / 2265 的注释，把 launchMode 提及一并清理。

- [ ] **Step 2.4：删头部文档注释 line 13**

把 `*  - launchMode："form" 需表单输入；"direct" 一键启动` 这行从顶部 doc-comment 删掉。

- [ ] **Step 2.5：tsc 验证**

```bash
npx tsc --noEmit 2>&1 | grep -E "seed-builtin-workflows|workflow_templates" | head -20
```

预期：seed 文件无错误（其它消费者错误下一步 task 修）。

- [ ] **Step 2.6：Commit**

```bash
git add src/db/seed-builtin-workflows.ts
git commit -m "refactor(seed): remove launchMode from builtin scenarios"
```

---

### Task 3: 清理 DAL 中的 launchMode

**Files:**
- Modify: `src/lib/dal/workflow-templates.ts`（line 141 / 360 / 397 / 406-419）
- Modify: `src/lib/dal/__tests__/workflow-templates-listing.test.ts`（line 33）

- [ ] **Step 3.1：删 DAL 中的 select / type / seed 写入**

打开 `src/lib/dal/workflow-templates.ts`，删除：
- line 141：`launchMode: "form",`（如是 hardcode default）
- line 360：`launchMode?: "form" | "direct";`（type 字段）
- line 397：`launchMode: seed.launchMode ?? "form",`（写入）
- line 406-419：注释和 baseValues 中的 launchMode（按上下文调整）

每处删除后运行 `npx tsc --noEmit | grep workflow-templates.ts` 确认无 type 错。

- [ ] **Step 3.2：删 listing test 的 fixture**

`src/lib/dal/__tests__/workflow-templates-listing.test.ts:33` 删 `launchMode: "form",`。

- [ ] **Step 3.3：跑 DAL 单元测试**

```bash
npx vitest run src/lib/dal/__tests__/workflow-templates-listing.test.ts
```

预期：全过。

- [ ] **Step 3.4：Commit**

```bash
git add src/lib/dal/workflow-templates.ts src/lib/dal/__tests__/workflow-templates-listing.test.ts
git commit -m "refactor(dal): remove launchMode from workflow-templates"
```

---

### Task 4: 清理 server actions 中的 launchMode

**Files:**
- Modify: `src/app/actions/workflow-engine.ts`（line 150 / 270 / 295-296 / 321）

- [ ] **Step 4.1：删 createWorkflow + updateWorkflow input 的 launchMode 字段**

每处看上下文删除 `launchMode?: "form" | "direct";` 类型字段以及对应的 conditional spread 逻辑。

- [ ] **Step 4.2：tsc 验证**

```bash
npx tsc --noEmit | grep workflow-engine
```

预期：无错。

- [ ] **Step 4.3：Commit**

```bash
git add src/app/actions/workflow-engine.ts
git commit -m "refactor(actions): remove launchMode from workflow-engine"
```

---

### Task 5: 清理 workflow-editor UI（删 launchMode dropdown）

**Files:**
- Modify: `src/components/workflows/workflow-editor.tsx`（line 44 / 105-106 / 195 / 210 / 238 / 368）
- Modify: `src/components/workflows/input-fields-editor.tsx`（line 106）
- Modify: `src/app/(dashboard)/workflows/[id]/edit/page.tsx`（line 41-42）

- [ ] **Step 5.1：从 workflow-editor.tsx 删 launchMode**

逐处删除：
- line 44：`launchMode?: "form" | "direct";` 类型字段
- line 105-106：`useState` 声明
- line 195 / 210：保存载荷里的 launchMode
- line 238：依赖数组里的 launchMode
- line 368：表单中"启动方式"select 控件整段（含 label + Select）

- [ ] **Step 5.2：清理 input-fields-editor 注释**

`src/components/workflows/input-fields-editor.tsx:106` 把"暂无字段（launchMode=direct 时可留空）"改为"暂无字段"。

- [ ] **Step 5.3：清理 edit page 字段映射**

`src/app/(dashboard)/workflows/[id]/edit/page.tsx:41-42` 删 launchMode 映射。

- [ ] **Step 5.4：tsc 验证**

```bash
npx tsc --noEmit | grep -E "workflow-editor|input-fields-editor|workflows/.*edit"
```

预期：无错。

- [ ] **Step 5.5：Commit**

```bash
git add src/components/workflows/workflow-editor.tsx src/components/workflows/input-fields-editor.tsx "src/app/(dashboard)/workflows/[id]/edit/page.tsx"
git commit -m "refactor(workflows): remove launchMode UI from editor"
```

---

### Task 6: 清理 workflows-client.tsx（admin list 页直启分支）

**Files:**
- Modify: `src/app/(dashboard)/workflows/workflows-client.tsx`（line 138 / 160）

- [ ] **Step 6.1：找到并阅读 launchMode === "direct" 的整段**

打开 `workflows-client.tsx` 138 行附近，看清楚整个 if/else 结构（`if launchMode === "direct" && fields.length === 0 && !hasPrompt → 直启 / else → 弹 dialog`）。

- [ ] **Step 6.2：移除 if 分支，统一弹 dialog**

把整个 `if (wf.launchMode === "direct" && fields.length === 0 && !hasPrompt) { ... } else { ... }` 简化为只保留 else 分支（统一弹 dialog）。

line 160 的注释（"有字段 / promptTemplate / launchMode=form → 弹 dialog"）改成"统一弹 dialog 让用户填参数 / 确认启动"。

- [ ] **Step 6.3：tsc 验证**

```bash
npx tsc --noEmit | grep workflows-client
```

预期：无错。

- [ ] **Step 6.4：Commit**

```bash
git add "src/app/(dashboard)/workflows/workflows-client.tsx"
git commit -m "refactor(workflows): always show dialog, remove launchMode direct branch"
```

---

### Task 7: 升级 `WorkflowLaunchDialog` — 加 onLaunched 回调 + 空字段极简模式

**Files:**
- Modify: `src/components/workflows/workflow-launch-dialog.tsx`

- [ ] **Step 7.1：扩展 Props**

把 `WorkflowLaunchDialogProps`（line 293）改为：
```ts
export interface WorkflowLaunchDialogProps {
  template: WorkflowTemplateRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * 启动成功回调。如果未传，沿用旧行为（router.push 到 mission console）。
   * Chat 入口必须传这个：拿到 missionId 后向对话流插入 mission_card 消息。
   */
  onLaunched?: (result: { missionId: string; template: WorkflowTemplateRow }) => void;
}
```

- [ ] **Step 7.2：修改 handleSubmit 按 onLaunched 分流**

把 line 352-353 的：
```ts
onOpenChange(false);
router.push(`/missions/${res.missionId}`);
```

改为：
```ts
onOpenChange(false);
if (onLaunched) {
  onLaunched({ missionId: res.missionId, template });
} else {
  router.push(`/missions/${res.missionId}`);
}
```

- [ ] **Step 7.3：空 inputFields 极简渲染**

在 dialog body 里，如果 `fields.length === 0`，只显示 `<DialogDescription>{template.description ?? "确认启动该工作流"}</DialogDescription>`，不渲染 form fields，不渲染错误条（_global 仍可显示）。

具体：找到现有 form 渲染分支，加一个早返回：
```tsx
{fields.length === 0 ? (
  <p className="text-sm text-muted-foreground py-2">
    {template.description ?? "点击「启动」立即创建任务。"}
  </p>
) : (
  /* 现有的字段渲染 */
)}
```

- [ ] **Step 7.4：tsc 验证**

```bash
npx tsc --noEmit | grep workflow-launch-dialog
```

预期：无错。

- [ ] **Step 7.5：Commit**

```bash
git add src/components/workflows/workflow-launch-dialog.tsx
git commit -m "feat(launch-dialog): add onLaunched callback + empty fields minimal mode"
```

---

### Task 8: ScenarioGrid 删 launchMode 分支

**Files:**
- Modify: `src/components/home/scenario-grid.tsx`（line 272-294）

- [ ] **Step 8.1：把 handleCardClick 简化为统一弹 dialog**

当前 handleCardClick 有 `if (tpl.launchMode === "direct")` 分支直调 `startMissionFromTemplate` 然后 push。删除这个分支，无脑 `setLaunching(tpl)` 弹 dialog。

简化后：
```ts
const handleCardClick = React.useCallback(
  (tpl: WorkflowTemplateRow) => {
    setDirectError(null);
    setLaunching(tpl);
  },
  [],
);
```

- [ ] **Step 8.2：删除 directStartingId 相关 state 和 disable 逻辑**

`directStartingId` state、`directError` state、`isDirectStarting` prop 都不再需要（dialog 自己管 loading）。

逐处清理：
- line 259-262 的 useState
- 传给 TemplateCard 的 isDirectStarting prop
- TemplateCard 接收 isDirectStarting 和 startMissionFromTemplate import

如不确定哪些可删，搜一下：
```bash
grep -n 'directStarting\|directError\|isDirectStarting' src/components/home/scenario-grid.tsx
```

- [ ] **Step 8.3：tsc 验证 + 视觉验证**

```bash
npx tsc --noEmit | grep scenario-grid
```

启动 dev：
```bash
npm run dev
```

打开 `/home`，点任意场景卡片，应该弹出 `WorkflowLaunchDialog`（不再有"启动中…"的 button text）。

- [ ] **Step 8.4：Commit**

```bash
git add src/components/home/scenario-grid.tsx
git commit -m "refactor(home): always show launch dialog, remove direct branch"
```

---

### Task 9: EmployeeWorkflowsSection 改用 dialog

**Files:**
- Modify: `src/app/(dashboard)/employee/[id]/employee-profile-client.tsx`（line 1351-1461）

- [ ] **Step 9.1：在文件顶部 import WorkflowLaunchDialog**

```tsx
import { WorkflowLaunchDialog } from "@/components/workflows/workflow-launch-dialog";
```

- [ ] **Step 9.2：替换 handleStart 逻辑**

把 `EmployeeWorkflowsSection` 中：
- 删除 `handleStart` 函数
- 删除 `useTransition`、`pendingId`、`isPending` state
- 新增 `const [launching, setLaunching] = useState<WorkflowTemplateRow | null>(null);`

button onClick 改为 `() => setLaunching(wf)`。

button 不再需要 `disabled={isPending}` 和 "启动中..."（dialog 接管）。

- [ ] **Step 9.3：在 GlassCard 后渲染 dialog**

在 `EmployeeWorkflowsSection` return 的 `</GlassCard>` 之后加：
```tsx
{launching && (
  <WorkflowLaunchDialog
    template={launching}
    open={!!launching}
    onOpenChange={(o) => !o && setLaunching(null)}
  />
)}
```

不传 `onLaunched` → 默认 push 到 mission console，与现状一致。

- [ ] **Step 9.4：清理孤立 import**

如果 `startMission` / `templateToScenarioSlug` 这两个 import 不再被该文件其它地方用到，删掉它们：
```bash
grep -n 'startMission\|templateToScenarioSlug' "src/app/(dashboard)/employee/[id]/employee-profile-client.tsx"
```

- [ ] **Step 9.5：tsc 验证 + 视觉验证**

```bash
npx tsc --noEmit | grep employee-profile-client
```

启动 dev，打开 `/employee/xiaolei`，点"日常工作流"任意卡片，应该弹 dialog 而不是直接启动。

- [ ] **Step 9.6：Commit**

```bash
git add "src/app/(dashboard)/employee/[id]/employee-profile-client.tsx"
git commit -m "refactor(employee): use WorkflowLaunchDialog for daily workflows"
```

---

### Task 10: Chat page — 直接传 WorkflowTemplateRow（不映射 ScenarioCardData）

**Files:**
- Modify: `src/app/(dashboard)/chat/page.tsx`
- Modify: `src/app/(dashboard)/chat/chat-center-client.tsx`

**为什么这样改：** 当前 chat page 把 `WorkflowTemplateRow` map 到 `ScenarioCardData` 丢失了 `defaultTeam` / `promptTemplate` 等字段，使得 `WorkflowLaunchDialog` 无法直接使用。最干净的办法是 chat 也用 `WorkflowTemplateRow`。

- [ ] **Step 10.1：page.tsx 改为传 WorkflowTemplateRow**

打开 `src/app/(dashboard)/chat/page.tsx`，把 `scenarioMap` 的类型从 `Record<string, ScenarioCardData[]>` 改为 `Record<string, WorkflowTemplateRow[]>`，去掉 `t.map` 转换，直接：
```ts
slugs.forEach((slug, i) => {
  scenarioMap[slug] = results[i];  // 已经是 WorkflowTemplateRow[]
});
```

- [ ] **Step 10.2：chat-center-client.tsx 接收 WorkflowTemplateRow[]**

把 props 类型 `scenarioMap: Record<string, ScenarioCardData[]>` 改为 `Record<string, WorkflowTemplateRow[]>`。

调用 `handleSelectScenario(scenario: ScenarioCardData)` 改为 `(scenario: WorkflowTemplateRow)`。

- [ ] **Step 10.3：tsc 看哪里坏了**

```bash
npx tsc --noEmit 2>&1 | grep -E "chat/" | head -30
```

预期：会有不少 type error，因为 ScenarioCardData 字段名（如 `description`、`icon`）和 WorkflowTemplateRow 一致或差异需要 case-by-case 修。`welcomeMessage` 在 WorkflowTemplateRow 中**不存在** — 删除相关引用（chat-center-client.tsx line 409-417 那一段，包括 renderScenarioTemplate）。

- [ ] **Step 10.4：清理 ScenarioCardData 的 import**

```bash
grep -rn 'ScenarioCardData' src --include="*.ts" --include="*.tsx"
```

如果 chat 模块外还有消费者（home/page.tsx 也用），保留；否则可删。本任务只把 chat 模块内迁完即可。

- [ ] **Step 10.5：Commit**

```bash
git add "src/app/(dashboard)/chat/page.tsx" "src/app/(dashboard)/chat/chat-center-client.tsx"
git commit -m "refactor(chat): pass WorkflowTemplateRow directly to chat client"
```

---

### Task 11: Chat — 删除内联 scenario 表单 + 用 dialog

**Files:**
- Modify: `src/app/(dashboard)/chat/chat-panel.tsx`（line 974-1075 内联表单整段）
- Modify: `src/app/(dashboard)/chat/chat-center-client.tsx`（`handleSelectScenario` + dialog state）

- [ ] **Step 11.1：chat-center-client.tsx — handleSelectScenario 改为弹 dialog**

替换 line 404-431：
```tsx
const [launching, setLaunching] = useState<WorkflowTemplateRow | null>(null);

const handleSelectScenario = useCallback(
  (scenario: WorkflowTemplateRow) => {
    setLaunching(scenario);
  },
  [],
);
```

删除 `inlineScenario` state + `handleScenarioSubmit` 中"插入 user message + intent bubble"的逻辑（这套行为下个 Phase 改为插 mission_card 消息）。

- [ ] **Step 11.2：渲染 dialog**

在 ChatCenterClient return 的最外层加：
```tsx
{launching && (
  <WorkflowLaunchDialog
    template={launching}
    open={!!launching}
    onOpenChange={(o) => !o && setLaunching(null)}
    onLaunched={({ missionId }) => {
      // Phase 1 暂行：跳到 mission console（与 home/employee 一致）
      // Phase 2 改为：插入 mission_card 消息到对话流
      router.push(`/missions/${missionId}`);
    }}
  />
)}
```

需要 `import { useRouter } from "next/navigation"`。

- [ ] **Step 11.3：chat-panel.tsx 删除内联表单**

打开 `chat-panel.tsx`，line 974-1075（`{inlineScenario && !loading && (...)}` 整段）删除。同时把 `inlineScenario` 相关 props 从该组件接口中删除。

- [ ] **Step 11.4：tsc + 视觉验证**

```bash
npx tsc --noEmit | grep -E "chat-panel|chat-center"
```

启动 dev → `/chat`，选员工 → 选场景 → 应该弹 `WorkflowLaunchDialog` 而不是内联表单。提交后跳到 `/missions/[id]`。

- [ ] **Step 11.5：Commit**

```bash
git add "src/app/(dashboard)/chat/chat-panel.tsx" "src/app/(dashboard)/chat/chat-center-client.tsx"
git commit -m "refactor(chat): replace inline scenario form with WorkflowLaunchDialog"
```

---

### Task 12: 删除 orphan ScenarioFormSheet

**Files:**
- Delete: `src/app/(dashboard)/chat/scenario-form-sheet.tsx`

- [ ] **Step 12.1：再 grep 一次确认无 importer**

```bash
grep -rn 'ScenarioFormSheet\|scenario-form-sheet' src --include="*.ts" --include="*.tsx"
```

预期：仅 `scenario-form-sheet.tsx` 本身命中。

- [ ] **Step 12.2：删文件**

```bash
rm "src/app/(dashboard)/chat/scenario-form-sheet.tsx"
```

- [ ] **Step 12.3：Commit**

```bash
git add "src/app/(dashboard)/chat/scenario-form-sheet.tsx"
git commit -m "chore: delete orphan ScenarioFormSheet component"
```

---

### Task 13: Phase 1 完整性验证

- [ ] **Step 13.1：全量 tsc**

```bash
npx tsc --noEmit
```

预期：无错（除 spec/test 文件预存在错误外）。

- [ ] **Step 13.2：build**

```bash
npm run build
```

预期：build 通过。

- [ ] **Step 13.3：跑全部测试**

```bash
npm test
```

预期：全过。

- [ ] **Step 13.4：手动三入口回归**

启动 dev：
```bash
npm run dev
```

依次测试：
- `/home` → 选任意场景卡片 → 弹 dialog → 填表单或确认 → 跳 `/missions/[id]`
- `/employee/xiaolei` → 选任意"日常工作流"卡片 → 弹 dialog → 启动 → 跳 `/missions/[id]`
- `/chat` → 选员工 → 选场景 → 弹 dialog → 启动 → 跳 `/missions/[id]`

三处行为一致即 Phase 1 完成。

---

## Phase 2 — Chat-Mission 投影

### Task 14: 扩展 saved_conversations message TS 类型

**Files:**
- Modify: `src/db/schema/saved-conversations.ts`

- [ ] **Step 14.1：扩展 messages jsonb 元素类型**

打开 `src/db/schema/saved-conversations.ts`，把 `messages: jsonb("messages").$type<...>()` 中的元素类型扩展为：

```ts
{
  role: "user" | "assistant" | "system",
  content: string,
  durationMs?: number,
  thinkingSteps?: { tool: string; label: string; skillName?: string }[],
  skillsUsed?: { tool: string; skillName: string }[],
  sources?: string[],
  referenceCount?: number,
  // 新增（mission_card 消息用）
  kind?: "text" | "mission_card",
  missionId?: string,
  templateId?: string,
  templateName?: string,
}[]
```

**注意：** 仅 TS 类型扩展，**不需要** schema migration（jsonb 字段本身不变）。

- [ ] **Step 14.2：tsc 验证**

```bash
npx tsc --noEmit | grep saved-conversations
```

预期：无错。

- [ ] **Step 14.3：Commit**

```bash
git add src/db/schema/saved-conversations.ts
git commit -m "feat(chat-schema): extend message type with mission_card fields"
```

---

### Task 15: 创建 useMissionProgress hook

**Files:**
- Create: `src/lib/hooks/use-mission-progress.ts`
- Create: `src/lib/hooks/__tests__/use-mission-progress.test.ts`

- [ ] **Step 15.1：先调研 SSE 端点的事件结构**

读 `src/app/api/missions/[id]/progress/route.ts` 完整文件，记下：
- 发送的 event name 列表（如 `progress`、`tasks_changed`、`status_changed`、`done` 等）
- 每个 event 的 data 形态

- [ ] **Step 15.2：写失败测试**

`src/lib/hooks/__tests__/use-mission-progress.test.ts`：

```ts
import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMissionProgress } from "../use-mission-progress";

describe("useMissionProgress", () => {
  beforeEach(() => {
    // mock EventSource
  });

  it("returns initial loading state then transitions to running", async () => {
    const { result } = renderHook(() => useMissionProgress("mission-id-1"));
    expect(result.current.status).toBe("loading");
    // simulate SSE event
    // ...
    await waitFor(() => expect(result.current.status).toBe("running"));
  });

  it("handles 404 (mission deleted) by returning notFound state", async () => {
    // mock fetch to return 404
    // ...
    const { result } = renderHook(() => useMissionProgress("missing-id"));
    await waitFor(() => expect(result.current.status).toBe("not_found"));
  });

  it("self-closes on terminal status", async () => {
    // ...
  });
});
```

注：本项目目前**没有**使用 React Testing Library，需要确认是否引入。如不引入，把测试改为纯 logic test（提取 SSE 消息解析为纯函数测）。

- [ ] **Step 15.3：实现 hook**

`src/lib/hooks/use-mission-progress.ts`：

```ts
"use client";

import { useEffect, useState } from "react";

export type MissionProgressState =
  | { status: "loading" }
  | { status: "not_found" }
  | { status: "error"; error: string }
  | {
      status: "pending" | "running" | "completed" | "failed";
      progress: number;
      tasks: Array<{
        id: string;
        title: string;
        status: "pending" | "running" | "completed" | "failed" | "skipped";
        employeeId?: string;
      }>;
    };

export function useMissionProgress(missionId: string): MissionProgressState {
  const [state, setState] = useState<MissionProgressState>({ status: "loading" });

  useEffect(() => {
    if (!missionId) return;
    let cancelled = false;

    // 1. 拉初始状态
    (async () => {
      try {
        const res = await fetch(`/api/missions/${missionId}`);
        if (cancelled) return;
        if (res.status === 404) {
          setState({ status: "not_found" });
          return;
        }
        if (!res.ok) {
          setState({ status: "error", error: `HTTP ${res.status}` });
          return;
        }
        const data = await res.json();
        setState({
          status: data.status,
          progress: data.progress ?? 0,
          tasks: data.tasks ?? [],
        });
      } catch (e) {
        if (cancelled) return;
        setState({ status: "error", error: e instanceof Error ? e.message : "fetch failed" });
      }
    })();

    // 2. 订阅 SSE
    const es = new EventSource(`/api/missions/${missionId}/progress`);
    es.addEventListener("progress", (ev) => {
      if (cancelled) return;
      try {
        const data = JSON.parse((ev as MessageEvent).data);
        setState((prev) => {
          if (prev.status === "loading" || prev.status === "not_found" || prev.status === "error") {
            return prev;
          }
          return { ...prev, ...data };
        });
      } catch {
        // ignore malformed
      }
    });
    es.addEventListener("done", () => es.close());
    es.onerror = () => {
      // SSE 自关闭场景下不算 error；持续失败不抛
    };

    return () => {
      cancelled = true;
      es.close();
    };
  }, [missionId]);

  return state;
}
```

- [ ] **Step 15.4：跑测试**

```bash
npx vitest run src/lib/hooks/__tests__/use-mission-progress.test.ts
```

预期：通过（如果决定不写 RTL 测试，跳过）。

- [ ] **Step 15.5：检查 mission 详情 API 是否存在**

```bash
ls src/app/api/missions/\[id\]/route.ts 2>/dev/null
```

如果没有 GET 路由返回 mission 完整字段，本 hook 的初始 fetch 会 404。两种处理：
1. 创建一个 GET `/api/missions/[id]` 端点返回 `{ status, progress, tasks }`
2. 或者直接通过 SSE 拿首个 event 当初始状态（去掉初始 fetch）

倾向方案 2 — 简化 hook，等 SSE 第一个 event。如果 SSE 5s 内无 event，显示 loading/timeout。

调整 hook：删除初始 fetch 块，纯靠 SSE。404 fallback 改为：SSE 连接失败（如端点直接返回 404 关闭）→ 设 `not_found`。

- [ ] **Step 15.6：Commit**

```bash
git add src/lib/hooks/use-mission-progress.ts src/lib/hooks/__tests__/use-mission-progress.test.ts
git commit -m "feat(hooks): add useMissionProgress for SSE subscription"
```

---

### Task 16: 创建 MissionCardMessage 组件

**Files:**
- Create: `src/components/chat/mission-card-message.tsx`

- [ ] **Step 16.1：写组件**

```tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { useMissionProgress } from "@/lib/hooks/use-mission-progress";
import { GlassCard } from "@/components/shared/glass-card";

interface MissionCardMessageProps {
  missionId: string;
  templateName: string;
}

export function MissionCardMessage({ missionId, templateName }: MissionCardMessageProps) {
  const state = useMissionProgress(missionId);

  if (state.status === "loading") {
    return (
      <GlassCard padding="sm" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 size={14} className="animate-spin" />
        正在启动「{templateName}」…
      </GlassCard>
    );
  }

  if (state.status === "not_found") {
    return (
      <GlassCard padding="sm" className="flex items-center gap-2 text-sm text-muted-foreground opacity-60">
        <AlertCircle size={14} />
        任务「{templateName}」已被删除
      </GlassCard>
    );
  }

  if (state.status === "error") {
    return (
      <GlassCard padding="sm" className="flex items-center gap-2 text-sm text-red-500">
        <XCircle size={14} />
        加载任务失败：{state.error}
      </GlassCard>
    );
  }

  // pending / running / completed / failed
  return (
    <GlassCard padding="md" className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon status={state.status} />
          <span className="font-medium text-sm">{templateName}</span>
        </div>
        <Link
          href={`/missions/${missionId}`}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          查看完整任务
          <ExternalLink size={12} />
        </Link>
      </div>
      <div className="space-y-1.5">
        {state.tasks.map((t) => (
          <TaskRow key={t.id} task={t} />
        ))}
      </div>
      <div className="text-xs text-muted-foreground">
        进度 {state.progress}%
      </div>
    </GlassCard>
  );
}

function StatusIcon({ status }: { status: "pending" | "running" | "completed" | "failed" }) {
  if (status === "completed") return <CheckCircle2 size={16} className="text-green-500" />;
  if (status === "failed") return <XCircle size={16} className="text-red-500" />;
  return <Loader2 size={16} className="text-sky-500 animate-spin" />;
}

function TaskRow({ task }: { task: { title: string; status: string } }) {
  const icon =
    task.status === "completed" ? "✅" :
    task.status === "failed" ? "❌" :
    task.status === "running" ? "🔄" :
    task.status === "skipped" ? "⏭️" :
    "⏳";
  return (
    <div className="text-xs text-muted-foreground flex items-center gap-2">
      <span>{icon}</span>
      <span>{task.title}</span>
    </div>
  );
}
```

- [ ] **Step 16.2：tsc 验证**

```bash
npx tsc --noEmit | grep mission-card-message
```

- [ ] **Step 16.3：Commit**

```bash
git add src/components/chat/mission-card-message.tsx
git commit -m "feat(chat): add MissionCardMessage component"
```

---

### Task 17: chat-panel 渲染 mission_card 消息

**Files:**
- Modify: `src/app/(dashboard)/chat/chat-panel.tsx`

- [ ] **Step 17.1：在消息渲染循环中加 kind 判断**

找到 chat-panel 渲染 messages 的地方（搜 `messages.map`），加上：
```tsx
{messages.map((m, i) => {
  if (m.kind === "mission_card" && m.missionId) {
    return (
      <MissionCardMessage
        key={i}
        missionId={m.missionId}
        templateName={m.templateName ?? "任务"}
      />
    );
  }
  return <MessageBubble key={i} message={m} ... />;  // 现有渲染保持
})}
```

import：
```tsx
import { MissionCardMessage } from "@/components/chat/mission-card-message";
```

- [ ] **Step 17.2：tsc 验证**

```bash
npx tsc --noEmit | grep chat-panel
```

- [ ] **Step 17.3：Commit**

```bash
git add "src/app/(dashboard)/chat/chat-panel.tsx"
git commit -m "feat(chat): render mission_card messages in chat-panel"
```

---

### Task 18: chat-center onLaunched 改为插 mission_card 消息

**Files:**
- Modify: `src/app/(dashboard)/chat/chat-center-client.tsx`

- [ ] **Step 18.1：替换 onLaunched 回调**

把 Task 11 写的：
```tsx
onLaunched={({ missionId }) => {
  router.push(`/missions/${missionId}`);
}}
```

改为：
```tsx
onLaunched={({ missionId, template }) => {
  setMessages((prev) => [
    ...prev,
    {
      role: "system",
      content: "",
      kind: "mission_card",
      missionId,
      templateId: template.id,
      templateName: template.name,
    },
  ]);
  setActiveScenario(null);  // 或对应的清理逻辑
}}
```

可以删 `useRouter` 如果别处不再用。

- [ ] **Step 18.2：保存会话时确保 mission_card 字段持久化**

找 `saveCurrentConversation`（约在 line 380-401），确认 `setMessages` 后 `messages` 数组里的 mission_card 条目能完整 stringify 到 jsonb（理论上自动，但 TS 类型已扩展所以编译期检查会过）。

- [ ] **Step 18.3：tsc + 视觉验证**

```bash
npx tsc --noEmit | grep chat-center
```

启动 dev → `/chat` → 选员工 → 选场景 → 启动后**留在 chat 页**，对话流出现 mission_card 消息，显示步骤进度。

- [ ] **Step 18.4：Commit**

```bash
git add "src/app/(dashboard)/chat/chat-center-client.tsx"
git commit -m "feat(chat): insert mission_card on launch instead of router.push"
```

---

### Task 19: 验证 mission API 提供详情端点（如果 hook 用 fetch）

**Files:**
- Conditional create: `src/app/api/missions/[id]/route.ts`

- [ ] **Step 19.1：检查 GET /api/missions/[id] 是否存在**

```bash
ls src/app/api/missions/\[id\]/ 2>/dev/null
```

如果只有 `progress/route.ts` 没有 `route.ts`，需要新建。

- [ ] **Step 19.2（条件）：创建 GET 端点**

如 hook 仍依赖初始 fetch（Task 15 Step 15.5 决定不删的话），创建 `src/app/api/missions/[id]/route.ts`：

```ts
import { NextRequest } from "next/server";
import { db } from "@/db";
import { missions, missionTasks } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const mission = await db.query.missions.findFirst({ where: eq(missions.id, id) });
  if (!mission) return new Response("Not Found", { status: 404 });

  const tasks = await db.query.missionTasks.findMany({
    where: eq(missionTasks.missionId, id),
    orderBy: (t, { asc }) => [asc(t.sortOrder)],
  });

  return Response.json({
    status: mission.status,
    progress: mission.progress ?? 0,
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      employeeId: t.assigneeEmployeeId,
    })),
  });
}
```

字段名以实际 schema 为准 — 如 `missions.progress` 不存在，从 mission_tasks 计算。

- [ ] **Step 19.3：Commit**

如果新建了端点：
```bash
git add "src/app/api/missions/[id]/route.ts"
git commit -m "feat(api): add GET /api/missions/[id] for initial state fetch"
```

---

### Task 20: Phase 2 完整性验证

- [ ] **Step 20.1：tsc + build + test**

```bash
npx tsc --noEmit
npm run build
npm test
```

全过。

- [ ] **Step 20.2：手动三入口 + 投影回归**

- `/home` 选场景 → dialog → 跳 mission console（不变）
- `/employee/xiaolei` 选场景 → dialog → 跳 mission console（不变）
- `/chat` 选员工 → 选场景 → dialog → **不跳转**，对话流出现 mission_card 消息
- mission_card 显示进度，每完成一步有变化
- 刷新 `/chat` 页 → 卡片重新订阅，仍显示当前进度
- 卡片底部"查看完整任务"链接 → 跳到 `/missions/[id]`

- [ ] **Step 20.3：边缘 case 测试**

- 启动 mission 后立即把它从 mission console 删了 → chat 卡片显示"任务已被删除"灰态
- chat 内连续启动 2 个场景 → 两条卡片都正确订阅各自 SSE

---

## Phase 3 — 配置入口可见化（可独立 PR）

### Task 21: WorkflowCardMenu 组件

**Files:**
- Create: `src/components/workflows/workflow-card-menu.tsx`

- [ ] **Step 21.1：写组件**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Copy, Pin, PinOff } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface WorkflowCardMenuProps {
  templateId: string;
  isPinned?: boolean;
  onTogglePin?: () => void;
}

export function WorkflowCardMenu({ templateId, isPinned, onTogglePin }: WorkflowCardMenuProps) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal size={14} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => router.push(`/workflows/${templateId}`)}>
          <Pencil size={14} className="mr-2" />
          编辑工作流
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(`/scenarios/customize?from=${templateId}`)}>
          <Copy size={14} className="mr-2" />
          复制为我的工作流
        </DropdownMenuItem>
        {onTogglePin && (
          <DropdownMenuItem onClick={onTogglePin}>
            {isPinned ? <PinOff size={14} className="mr-2" /> : <Pin size={14} className="mr-2" />}
            {isPinned ? "取消置顶" : "置顶"}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 21.2：Commit**

```bash
git add src/components/workflows/workflow-card-menu.tsx
git commit -m "feat(workflows): add WorkflowCardMenu component"
```

---

### Task 22: ScenarioGrid 接入菜单

**Files:**
- Modify: `src/components/home/scenario-grid.tsx`

- [ ] **Step 22.1：把现有 pin/unpin 按钮替换为 WorkflowCardMenu**

把 `TemplateCard` 中的 Pin button（line 206-219）替换为：
```tsx
{canManage && (
  <div className="absolute right-2 top-2">
    <WorkflowCardMenu
      templateId={tpl.id}
      isPinned={pinned}
      onTogglePin={onTogglePin}
    />
  </div>
)}
```

import：
```tsx
import { WorkflowCardMenu } from "@/components/workflows/workflow-card-menu";
```

- [ ] **Step 22.2：tsc + 视觉验证**

启动 dev → 用 admin 账号 → `/home` → 卡片右上角应有"⋯"菜单，含 编辑 / 复制 / 置顶 三项。普通用户看不到菜单。

- [ ] **Step 22.3：Commit**

```bash
git add src/components/home/scenario-grid.tsx
git commit -m "feat(home): use WorkflowCardMenu for admin actions"
```

---

### Task 23: EmployeeWorkflowsSection 接入菜单

**Files:**
- Modify: `src/app/(dashboard)/employee/[id]/employee-profile-client.tsx`

- [ ] **Step 23.1：传 canManage prop 到 EmployeeWorkflowsSection**

页面顶层判定 admin/owner（参考 home/page.tsx 第 145-157 行的 `canManageHomepage` 模式），传给 `EmployeeWorkflowsSection`。

- [ ] **Step 23.2：在每个 workflow 卡片右上角加菜单**

button 的 className 加 `relative`，里面加：
```tsx
{canManage && (
  <div className="absolute right-1 top-1" onClick={(e) => e.stopPropagation()}>
    <WorkflowCardMenu templateId={wf.id} />
  </div>
)}
```

注意 employee 页的卡片用的是 `<button>` 元素 — 嵌套 button 是不合法的。需要把外层 button 改成 div + onClick + role="button" + tabIndex=0，或者菜单触发器用 onClick stopPropagation 即可（chrome 容忍嵌套 button）。**推荐方案**：外层改 div。

- [ ] **Step 23.3：tsc + 视觉验证**

- [ ] **Step 23.4：Commit**

```bash
git add "src/app/(dashboard)/employee/[id]/employee-profile-client.tsx"
git commit -m "feat(employee): add admin menu to daily workflow cards"
```

---

### Task 24: Phase 3 完整性验证

- [ ] **Step 24.1：tsc + build + test**

```bash
npx tsc --noEmit && npm run build && npm test
```

- [ ] **Step 24.2：admin / 普通用户分别测试**

- admin 在 home/employee 卡片上看到菜单，编辑跳 `/workflows/[id]`，复制跳 `/scenarios/customize?from=[id]`，置顶切换正常
- 普通用户看不到菜单，行为与现状一致

- [ ] **Step 24.3：手动检查 chat 入口**

chat 中场景选择列表如果也展示卡片化 UI，按需在 Phase 3 范围内同步加菜单（如 chat 用的是简单 chip 列表则跳过此项）。

---

## 完整性最终检查（PR 提交前）

- [ ] `npx tsc --noEmit` 零新错误
- [ ] `npm run build` 通过
- [ ] `npm test` 全过
- [ ] grep 验证无 launchMode 残留：
  ```bash
  grep -rn 'launchMode\|launch_mode' src --include="*.ts" --include="*.tsx"
  ```
  预期：仅命中本 plan 文档自身（如有）和 spec 文档；src 内零命中。
- [ ] 三入口手动回归通过（home/employee 跳 mission console；chat 投影 mission_card）
- [ ] 浏览器无 console 错误
- [ ] DB 列已 DROP（`npm run db:studio` 检查 `workflow_templates` 表无 `launch_mode` 列）

---

## 风险与回滚

| 风险 | 检测 | 回滚 |
|---|---|---|
| Task 1 schema push 后 in-flight mission 创建失败 | dev 期间 startMissionFromTemplate 不读 launchMode；如生产报错 → 检查 DAL 是否漏改 | git revert + 重新 push schema |
| Phase 1 上线但 Phase 2 没跟上 | 强制要求同 PR；CI 卡 build 即可 | 同 PR 一起 revert |
| SSE 端点高频订阅压垮 | 监控；目前 2s 轮询；可调间隔或转 polling | 卡片改为 30s 轮询替代 SSE |
| chat 内 mission_card 一个会话多次启动刷屏 | 用户反馈 | 后续加折叠/上限提示 |

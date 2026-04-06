# Phase 3b: 工作流线性编辑器 实施计划

> **For agentic workers:** Use superpowers:subagent-driven-development to implement.

**Goal:** 创建工作流可视化编辑器（三栏布局），支持线性步骤编排、步骤配置、AI 自动规划，以及从模板创建和保存工作流。

**Architecture:** 新建 `/workflows/[id]/edit` 和 `/workflows/new` 路由。编辑器三栏：左侧 AI 对话面板、中间步骤序列可视化、右侧添加步骤面板。数据结构使用已有的 `WorkflowStepDef`，保存时调用 `saveWorkflow`/`updateWorkflow` server action。

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Tailwind CSS v4, dnd-kit (拖拽排序)

---

## File Structure

### New Files
```
src/app/(dashboard)/workflows/new/page.tsx                  — 新建工作流页面
src/app/(dashboard)/workflows/[id]/edit/page.tsx             — 编辑工作流页面
src/components/workflows/workflow-editor.tsx                 — 编辑器主组件（三栏）
src/components/workflows/step-list.tsx                       — 中间栏：步骤序列可视化
src/components/workflows/step-config-panel.tsx               — 步骤配置弹窗/面板
src/components/workflows/add-step-panel.tsx                  — 右侧栏：添加步骤面板
```

---

## Task 1: 步骤序列可视化组件

**Files:** Create `src/components/workflows/step-list.tsx`

线性步骤列表，每步显示：序号、步骤名、负责员工图标、操作菜单（编辑/删除/上移/下移）。步骤之间用竖线连接。

**Props:**
```typescript
interface StepListProps {
  steps: WorkflowStepDef[];
  onReorder: (fromIndex: number, toIndex: number) => void;
  onEdit: (stepId: string) => void;
  onDelete: (stepId: string) => void;
  onAddStep: () => void;
}
```

---

## Task 2: 添加步骤面板

**Files:** Create `src/components/workflows/add-step-panel.tsx`

右侧面板，按分类展示可选的员工和输出动作。

**分类：**
- AI 员工：8 个员工，点击添加一个员工步骤
- 输出动作：保存到媒资库、发布到渠道、生成报告

---

## Task 3: 步骤配置面板

**Files:** Create `src/components/workflows/step-config-panel.tsx`

点击步骤"编辑"时弹出的配置面板，可修改步骤名称、选择员工、选择技能。

---

## Task 4: 编辑器主组件

**Files:** Create `src/components/workflows/workflow-editor.tsx`

三栏布局组件，整合步骤列表、添加面板、配置面板，管理工作流编辑状态。

**Props:**
```typescript
interface WorkflowEditorProps {
  initialData?: {
    id?: string;
    name: string;
    description: string;
    category: string;
    triggerType: string;
    triggerConfig?: any;
    steps: WorkflowStepDef[];
  };
  mode: "create" | "edit";
}
```

**功能：**
- 顶部：工作流名称输入 + 触发类型选择 + 分类选择
- 左侧（可选）：AI 对话面板（描述需求 → 生成步骤，标记 coming soon）
- 中间：步骤序列
- 右侧：添加步骤面板
- 底部操作栏：保存 / 取消

---

## Task 5: 路由页面

**Files:**
- Create `src/app/(dashboard)/workflows/new/page.tsx`
- Create `src/app/(dashboard)/workflows/[id]/edit/page.tsx`

`/workflows/new` — 空白编辑器
`/workflows/[id]/edit` — 加载现有工作流数据

---

## Task 6: 集成验证

TypeScript + Build + 功能验证。

---

## Dependency Graph

```
Task 1 (step list) ──┐
Task 2 (add panel) ──┼── Task 4 (editor) → Task 5 (routes) → Task 6 (test)
Task 3 (config)    ──┘
```

Tasks 1, 2, 3 可并行，但因 subagent 限制按顺序执行。

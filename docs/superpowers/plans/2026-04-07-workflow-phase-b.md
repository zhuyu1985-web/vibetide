# Phase B: 工作流编辑器三栏布局重构

> **For agentic workers:** Use superpowers:subagent-driven-development

**Goal:** 重写工作流编辑器为 Genspark 风格三栏布局：左侧 AI 对话、中间步骤画布（触发器+操作分区）、右侧添加步骤/步骤详情切换面板。底部操作栏含测试运行/开启/保存。

**Spec:** `docs/superpowers/specs/2026-04-07-workflow-redesign.md`

---

## Task 1: 步骤画布组件（中间栏核心）

**Files:** Create `src/components/workflows/workflow-canvas.tsx`, `src/components/workflows/trigger-card.tsx`, `src/components/workflows/step-card.tsx`

三个组件：
- `trigger-card` — 触发器卡片（入门区域），手动/定时，点击可编辑
- `step-card` — 单步卡片，显示技能图标+步骤名+三点菜单，支持选中态和执行状态
- `workflow-canvas` — 组合触发器+步骤序列+连接线+添加按钮

## Task 2: 右侧面板（添加步骤 / 步骤详情切换）

**Files:** Create `src/components/workflows/right-panel.tsx`, rewrite `src/components/workflows/skill-step-panel.tsx` (from add-step-panel), create `src/components/workflows/step-detail-panel.tsx`

- `right-panel` — 切换容器，根据模式显示添加面板或详情面板
- `skill-step-panel` — 技能列表，按分类展示，含 AI 自定义步骤入口
- `step-detail-panel` — 步骤配置（名称、说明、技能选择、参数）

## Task 3: 底部操作栏

**Files:** Create `src/components/workflows/bottom-action-bar.tsx`

操作栏：测试运行 / 添加步骤 / 开启(定时) / 保存更改

## Task 4: 编辑器主组件重写

**Files:** Rewrite `src/components/workflows/workflow-editor.tsx`

三栏布局整合，管理所有状态（步骤、选中、右侧面板模式、编辑/测试模式等）。

## Task 5: 路由页面更新 + 构建验证

更新 new/page.tsx 和 [id]/edit/page.tsx 适配新编辑器接口。验证 tsc + build。

---

## Dependency

Task 1 + Task 2 + Task 3 → Task 4 → Task 5

# Phase 3a: 工作流列表页 + 数据层 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 创建工作流列表页（我的工作流 + 从模板开始），扩展 workflow_templates 表 Schema，实现工作流 CRUD 和内置场景模板，打通工作流执行到 Mission 引擎。

**Architecture:** 扩展现有 `workflow_templates` 表增加 category/trigger/is_builtin 等字段，新建工作流列表页展示"我的工作流"和"从模板开始"两个区域，支持从模板复制创建自定义工作流，工作流执行时调用现有 `startMission()` 创建 Mission。

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Drizzle ORM, Supabase PostgreSQL, Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-04-06-genspark-style-redesign.md` Section 2.4

---

## File Structure

### New Files
```
src/lib/workflow-templates.ts                              — 内置模板定义（代码中维护）
src/app/(dashboard)/workflows/page.tsx                     — 服务端组件
src/app/(dashboard)/workflows/workflows-client.tsx          — 客户端组件
src/components/workflows/workflow-template-card.tsx         — 模板卡片
src/components/workflows/my-workflow-card.tsx               — 我的工作流卡片
src/app/actions/workflows.ts                               — 工作流 CRUD server actions
src/lib/dal/workflow-templates.ts                          — 工作流 DAL 查询函数
```

### Modified Files
```
src/db/schema/workflows.ts                                 — 扩展 workflow_templates 表字段
src/db/seed.ts                                             — 添加内置模板种子数据
```

---

## Task 1: 扩展 workflow_templates Schema

**Files:**
- Modify: `src/db/schema/workflows.ts`
- Modify: `src/db/schema/enums.ts` (添加新 enum)

- [ ] **Step 1: 添加 enum 类型**

在 `src/db/schema/enums.ts` 添加：
```typescript
export const workflowCategoryEnum = pgEnum("workflow_category", [
  "news", "video", "analytics", "distribution", "custom"
]);

export const workflowTriggerTypeEnum = pgEnum("workflow_trigger_type", [
  "manual", "scheduled"
]);
```

注意：不做 event 触发器（spec 明确排除在本期范围外）。

- [ ] **Step 2: 扩展 workflow_templates 表**

在 `src/db/schema/workflows.ts` 的 `workflowTemplates` 表添加新字段：

```typescript
// 在现有字段后添加
category: workflowCategoryEnum("category").default("custom"),
triggerType: workflowTriggerTypeEnum("trigger_type").default("manual"),
triggerConfig: jsonb("trigger_config").$type<{
  cron?: string;        // cron 表达式，如 "0 8 * * *"
  timezone?: string;    // 时区，如 "Asia/Shanghai"
} | null>(),
isBuiltin: boolean("is_builtin").notNull().default(false),
isEnabled: boolean("is_enabled").notNull().default(false),
createdBy: uuid("created_by"),  // 不加 FK 避免循环依赖
lastRunAt: timestamp("last_run_at", { withTimezone: true }),
runCount: integer("run_count").notNull().default(0),
```

同时升级 `steps` jsonb 类型定义以支持新格式（保持向后兼容）：

```typescript
steps: jsonb("steps")
  .$type<WorkflowStepDef[]>()
  .notNull(),

// 新增导出类型
export interface WorkflowStepDef {
  id: string;              // 步骤唯一 ID
  order: number;           // 线性排序
  dependsOn: string[];     // DAG 预留
  name: string;            // 步骤显示名
  type: "employee" | "tool" | "output";
  config: {
    employeeSlug?: string;
    skillSlug?: string;
    toolId?: string;
    outputAction?: string;
    parameters: Record<string, any>;
  };
  // 向后兼容旧格式
  key?: string;
  label?: string;
  employeeSlug?: string;
}
```

- [ ] **Step 3: 生成迁移**

Run: `npm run db:generate`

注意：如果报错（enum 已存在等），需要手动调整迁移文件。如果生成顺利，运行 `npm run db:push` 推送到 Supabase。

实际操作：由于 Supabase 连接可能不稳定，先确保 schema 文件正确编译：

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: extend workflow_templates schema with category, trigger, builtin fields"
```

---

## Task 2: 内置场景模板定义

**Files:**
- Create: `src/lib/workflow-templates.ts`

- [ ] **Step 1: 定义内置模板**

```typescript
// src/lib/workflow-templates.ts
import type { WorkflowStepDef } from "@/db/schema/workflows";
import { v4 as uuid } from "uuid"; // 如果没有 uuid，用 crypto.randomUUID()

interface BuiltinTemplate {
  name: string;
  description: string;
  category: "news" | "video" | "analytics" | "distribution" | "custom";
  triggerType: "manual" | "scheduled";
  triggerConfig?: { cron?: string; timezone?: string } | null;
  steps: WorkflowStepDef[];
}

function step(
  order: number,
  name: string,
  employeeSlug: string,
  skillSlug?: string
): WorkflowStepDef {
  return {
    id: `step-${order}`,
    order,
    dependsOn: order > 1 ? [`step-${order - 1}`] : [],
    name,
    type: "employee" as const,
    config: {
      employeeSlug,
      skillSlug,
      parameters: {},
    },
  };
}

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    name: "突发新闻快速报道",
    description: "从热点发现到稿件发布的全流程自动化，适用于突发新闻的快速响应",
    category: "news",
    triggerType: "manual",
    steps: [
      step(1, "热点确认与信息采集", "xiaolei"),
      step(2, "快速选题策划", "xiaoce"),
      step(3, "稿件快速撰写", "xiaowen"),
      step(4, "质量审核", "xiaoshen"),
      step(5, "多渠道发布", "xiaofa"),
    ],
  },
  {
    name: "发布会追踪报道",
    description: "实时追踪发布会要点，自动生成报道并分发到各渠道",
    category: "news",
    triggerType: "manual",
    steps: [
      step(1, "发布会信息采集", "xiaolei"),
      step(2, "要点提取与稿件生成", "xiaowen"),
      step(3, "内容审核", "xiaoshen"),
      step(4, "全渠道分发", "xiaofa"),
    ],
  },
  {
    name: "每日热点早报",
    description: "每天早上自动聚合热点新闻，生成摘要早报",
    category: "news",
    triggerType: "scheduled",
    triggerConfig: { cron: "0 8 * * *", timezone: "Asia/Shanghai" },
    steps: [
      step(1, "全网热点聚合", "xiaolei"),
      step(2, "热点摘要生成", "xiaowen"),
    ],
  },
  {
    name: "短视频批量生产",
    description: "从选题到脚本到剪辑方案的短视频批量生产流程",
    category: "video",
    triggerType: "manual",
    steps: [
      step(1, "选题策划", "xiaoce"),
      step(2, "脚本生成", "xiaowen"),
      step(3, "剪辑计划", "xiaojian"),
      step(4, "质量审核", "xiaoshen"),
    ],
  },
  {
    name: "竞品监测周报",
    description: "每周自动抓取竞品动态，生成对比分析报告",
    category: "analytics",
    triggerType: "scheduled",
    triggerConfig: { cron: "0 9 * * 1", timezone: "Asia/Shanghai" },
    steps: [
      step(1, "竞品信息抓取", "xiaolei"),
      step(2, "数据对比分析", "xiaoshu"),
    ],
  },
  {
    name: "全渠道内容分发",
    description: "内容审核通过后，自动适配各渠道并分发，回收数据",
    category: "distribution",
    triggerType: "manual",
    steps: [
      step(1, "质量审核", "xiaoshen"),
      step(2, "渠道适配与发布", "xiaofa"),
      step(3, "数据回收分析", "xiaoshu"),
    ],
  },
  {
    name: "深度专题制作",
    description: "从调研到策划到写作到视频的完整深度专题制作流程",
    category: "news",
    triggerType: "manual",
    steps: [
      step(1, "深度调研", "xiaolei"),
      step(2, "专题策划", "xiaoce"),
      step(3, "长文写作", "xiaowen"),
      step(4, "视频制作方案", "xiaojian"),
      step(5, "质量审核", "xiaoshen"),
    ],
  },
];
```

- [ ] **Step 2: 验证编译**
- [ ] **Step 3: Commit**

---

## Task 3: 工作流 DAL + Server Actions

**Files:**
- Create: `src/lib/dal/workflow-templates.ts`
- Create: `src/app/actions/workflows.ts`

- [ ] **Step 1: 创建 DAL 查询函数**

```typescript
// src/lib/dal/workflow-templates.ts
// 功能：
// - getWorkflowTemplates(orgId) — 获取所有模板（内置 + 自定义）
// - getMyWorkflows(orgId, userId) — 获取用户创建的工作流
// - getBuiltinTemplates(orgId) — 获取内置模板
// - getWorkflowTemplate(id) — 获取单个模板详情
```

- [ ] **Step 2: 创建 Server Actions**

```typescript
// src/app/actions/workflows.ts
// 功能：
// - createWorkflowFromTemplate(templateId) — 从模板复制创建自定义工作流
// - createWorkflow(data) — 从零创建自定义工作流
// - updateWorkflow(id, data) — 更新工作流
// - deleteWorkflow(id) — 删除工作流（仅自定义）
// - toggleWorkflow(id, enabled) — 启用/禁用定时工作流
// - executeWorkflow(id) — 手动执行工作流（创建 Mission）
```

`executeWorkflow` 的核心逻辑：
1. 加载 workflow template
2. 将步骤转换为 userInstruction
3. 调用 `startMission()` 创建 Mission
4. 更新 `lastRunAt` 和 `runCount`

- [ ] **Step 3: 验证编译**
- [ ] **Step 4: Commit**

---

## Task 4: 工作流列表页组件

**Files:**
- Create: `src/components/workflows/workflow-template-card.tsx`
- Create: `src/components/workflows/my-workflow-card.tsx`
- Create: `src/app/(dashboard)/workflows/page.tsx`
- Create: `src/app/(dashboard)/workflows/workflows-client.tsx`

- [ ] **Step 1: 模板卡片组件**

显示内置模板，带名称、描述、涉及员工头像、"使用模板"按钮。

- [ ] **Step 2: 我的工作流卡片**

显示用户创建的工作流，带名称、触发类型、运行次数、启用/禁用开关、"编辑"/"运行"/"删除"按钮。

- [ ] **Step 3: 列表页服务端 + 客户端组件**

页面结构：
```
工作流                             [+ 新建工作流]
创建和管理自动化工作流程

── 我的工作流 ──────────── 查看全部 >
[卡片1] [卡片2] [卡片3]

── 从模板开始 ──────────────
[全部] [新闻报道] [视频生产] [数据分析] [渠道运营]
[模板卡片1] [模板卡片2] [模板卡片3]
```

- [ ] **Step 4: 验证编译和构建**

Run: `npx tsc --noEmit && npm run build`

- [ ] **Step 5: Commit**

---

## Task 5: 集成验证

- [ ] TypeScript + Build 通过
- [ ] `/workflows` 页面加载正常
- [ ] 内置模板正确显示 7 个场景
- [ ] 分类筛选正常
- [ ] "使用模板"创建自定义工作流
- [ ] "运行"按钮创建 Mission

---

## Dependency Graph

```
Task 1 (schema) → Task 2 (templates) → Task 3 (DAL + actions) → Task 4 (UI) → Task 5 (test)
```

All tasks are sequential — each depends on the previous.

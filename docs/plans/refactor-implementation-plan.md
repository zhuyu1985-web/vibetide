# VibeTide 核心模块重构实施计划

> **版本：** v1.0 | **日期：** 2026-03-22
> **基于文档：** `vibetide-unified-technical-spec.md` (目标方案) + `core-modules-function-list.md` (功能清单) + `core-modules-technical-analysis.md` (技术分析)
> **目标：** 将现有代码对齐统一技术方案，补齐缺失功能，加固安全与健壮性

---

## 概述

本计划分 4 个 Phase 共 30 个步骤。每个步骤标注依赖关系、修改文件、关键代码逻辑和验证方法。按顺序执行时不会破坏现有功能。

### Phase 依赖关系

```
Phase 1 (数据层对齐) → Phase 2 (核心引擎重构) → Phase 3 (缺失功能补齐) → Phase 4 (安全加固)
```

Phase 内各步骤的依赖关系在步骤描述中标注。

---

## Phase 1：数据层对齐（Schema + Migration + Types）

**目标：** 让数据库 Schema 完全匹配统一技术方案中的表设计，同时保持向后兼容。

### 步骤 1.1：扩展 Mission 状态枚举

**修改文件：** `src/db/schema/enums.ts`

**当前状态：**
```typescript
// missionStatusEnum: ["planning", "executing", "consolidating", "completed", "failed", "cancelled"]
// missionTaskStatusEnum: ["pending", "ready", "claimed", "in_progress", "completed", "failed"]
// missionMessageTypeEnum: ["question", "answer", "status_update", "result", "coordination"]
```

**目标状态（统一方案）：**

```typescript
// missionStatusEnum 新增 "queued" 和 "coordinating"
export const missionStatusEnum = pgEnum("mission_status", [
  "queued",          // 新增：排队等待
  "planning",        // 保留：Phase 1+2
  "executing",       // 保留：Phase 3
  "coordinating",    // 新增：Phase 4 协调收口
  "consolidating",   // 保留：Phase 5
  "completed",       // 保留
  "failed",          // 保留
  "cancelled",       // 保留
]);

// missionTaskStatusEnum 新增 "in_review", "cancelled", "blocked"
export const missionTaskStatusEnum = pgEnum("mission_task_status", [
  "pending",
  "ready",
  "claimed",
  "in_progress",
  "in_review",       // 新增：Leader审核中
  "completed",
  "failed",
  "cancelled",       // 新增：Mission取消时级联
  "blocked",         // 新增：上游失败导致阻塞
]);

// missionMessageTypeEnum 新增 "chat", "data_handoff", "progress_update",
// "task_completed", "task_failed", "help_request"
export const missionMessageTypeEnum = pgEnum("mission_message_type", [
  "chat",            // 新增
  "question",
  "answer",
  "data_handoff",    // 新增
  "progress_update", // 新增
  "task_completed",  // 新增
  "task_failed",     // 新增
  "help_request",    // 新增
  "status_update",
  "result",
  "coordination",
]);

// 新增 missionPhaseEnum
export const missionPhaseEnum = pgEnum("mission_phase", [
  "assembling",
  "decomposing",
  "executing",
  "coordinating",
  "delivering",
]);
```

**兼容性处理：**
- pgEnum 的 ALTER TYPE ... ADD VALUE 是非破坏性的，现有记录保持原枚举值不变
- 新增枚举值追加在列表中（PostgreSQL 要求 ADD VALUE 逐个执行）

**验证方法：**
```bash
npx tsc --noEmit  # 编译通过
npm run db:generate  # 生成 migration SQL
# 检查生成的 SQL 包含 ALTER TYPE ... ADD VALUE 而非 DROP/CREATE
```

---

### 步骤 1.2：扩展 missions 表字段

**修改文件：** `src/db/schema/missions.ts`

**新增字段：**

```typescript
export const missions = pgTable("missions", {
  // ... 现有字段保留 ...

  // 新增字段
  description: text("description"),                         // 用户需求描述（可选）
  phase: missionPhaseEnum("phase"),                         // 当前生命周期阶段
  progress: integer("progress").notNull().default(0),       // 综合进度 0-100
  config: jsonb("config").$type<{
    max_retries: number;
    task_timeout: number;
    max_agents: number;
  }>().default({ max_retries: 3, task_timeout: 300, max_agents: 8 }),
  startedAt: timestamp("started_at", { withTimezone: true }),   // 执行开始时间
});
```

**兼容性：** 所有新字段均 nullable 或有 default，不影响现有记录。

---

### 步骤 1.3：扩展 mission_tasks 表字段

**修改文件：** `src/db/schema/missions.ts`

**新增字段：**

```typescript
export const missionTasks = pgTable("mission_tasks", {
  // ... 现有字段保留 ...

  // 新增字段
  acceptanceCriteria: text("acceptance_criteria"),    // 验收标准
  assignedRole: text("assigned_role"),                // 期望角色类型（slug）
  outputSummary: text("output_summary"),              // 完成摘要（Leader可读）
  errorRecoverable: integer("error_recoverable").notNull().default(1), // 1=可恢复
  phase: integer("phase"),                            // 所属阶段号
  progress: integer("progress").notNull().default(0), // 任务进度 0-100
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

**注意：** `priority` 字段当前是 `integer`，目标方案要求是 `text` (P0/P1/P2/P3)。为避免数据迁移问题，**保持 integer 不变**，在应用层做映射（0→P3, 1→P2, 2→P1, 3→P0）。

---

### 步骤 1.4：扩展 mission_messages 表字段

**修改文件：** `src/db/schema/missions.ts`

**新增字段：**

```typescript
export const missionMessages = pgTable("mission_messages", {
  // ... 现有字段保留 ...

  // 新增字段
  channel: text("channel").notNull().default("direct"),     // direct/broadcast/system
  structuredData: jsonb("structured_data"),                  // 结构化数据附件
  priority: text("priority").notNull().default("normal"),   // normal/urgent
  replyTo: uuid("reply_to"),                                // 回复消息ID
});
```

---

### 步骤 1.5：新增 mission_artifacts 表

**修改文件：** `src/db/schema/missions.ts`

**新增定义：**

```typescript
export const missionArtifacts = pgTable("mission_artifacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  missionId: uuid("mission_id")
    .references(() => missions.id, { onDelete: "cascade" })
    .notNull(),
  taskId: uuid("task_id").references(() => missionTasks.id, { onDelete: "set null" }),
  producedBy: uuid("produced_by")
    .references(() => aiEmployees.id)
    .notNull(),
  type: text("type").notNull(),  // text/data_table/chart/image/video_script/report/publish_plan
  title: text("title").notNull(),
  content: text("content"),
  fileUrl: text("file_url"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// 补充 relations
export const missionArtifactsRelations = relations(missionArtifacts, ({ one }) => ({
  mission: one(missions, {
    fields: [missionArtifacts.missionId],
    references: [missions.id],
  }),
  task: one(missionTasks, {
    fields: [missionArtifacts.taskId],
    references: [missionTasks.id],
  }),
  producer: one(aiEmployees, {
    fields: [missionArtifacts.producedBy],
    references: [aiEmployees.id],
  }),
}));
```

**同时更新 missions 的 relations 添加 artifacts：**

```typescript
export const missionsRelations = relations(missions, ({ one, many }) => ({
  // ... 现有 relations ...
  artifacts: many(missionArtifacts),
}));
```

---

### 步骤 1.6：更新 schema/index.ts 导出

**修改文件：** `src/db/schema/index.ts`

mission_artifacts 定义在 missions.ts 内，无需新增导出行。确认现有 `export * from "./missions"` 能导出新增的 `missionArtifacts`。

---

### 步骤 1.7：更新 DB 类型推导

**修改文件：** `src/db/types.ts`

**新增：**

```typescript
import type { missionArtifacts } from "./schema";

// 新增 Select/Insert 类型
export type MissionArtifactRow = InferSelectModel<typeof missionArtifacts>;
export type NewMissionArtifact = InferInsertModel<typeof missionArtifacts>;
```

---

### 步骤 1.8：更新 UI 类型定义

**修改文件：** `src/lib/types.ts`

**变更点：**

```typescript
// 1. MissionStatus 新增 "queued" 和 "coordinating"
export type MissionStatus =
  | "queued"
  | "planning"
  | "executing"
  | "coordinating"
  | "consolidating"
  | "completed"
  | "failed"
  | "cancelled";

// 2. MissionTaskStatus 新增 "in_review", "cancelled", "blocked"
export type MissionTaskStatus =
  | "pending"
  | "ready"
  | "claimed"
  | "in_progress"
  | "in_review"
  | "completed"
  | "failed"
  | "cancelled"
  | "blocked";

// 3. MissionPhase 类型新增
export type MissionPhase =
  | "assembling"
  | "decomposing"
  | "executing"
  | "coordinating"
  | "delivering";

// 4. Mission 接口新增字段
export interface Mission {
  // ... 现有字段 ...
  description?: string;
  phase?: MissionPhase;
  progress: number;
  config?: { max_retries: number; task_timeout: number; max_agents: number };
  startedAt: string | null;
}

// 5. MissionTask 接口新增字段
export interface MissionTask {
  // ... 现有字段 ...
  acceptanceCriteria?: string;
  assignedRole?: string;
  outputSummary?: string;
  errorRecoverable: boolean;
  phase?: number;
  progress: number;
  createdAt: string;
}

// 6. MissionMessage 接口扩展
export interface MissionMessage {
  // ... 现有字段 ...
  channel: string;
  structuredData?: unknown;
  priority: string;
  replyTo?: string;
}

// 7. MissionArtifact 新增
export interface MissionArtifact {
  id: string;
  missionId: string;
  taskId: string | null;
  producedBy: string;
  type: string;
  title: string;
  content: string | null;
  fileUrl: string | null;
  metadata: Record<string, unknown>;
  version: number;
  createdAt: string;
}

// 8. MissionWithDetails 扩展
export interface MissionWithDetails extends Mission {
  tasks: MissionTask[];
  messages: MissionMessage[];
  artifacts: MissionArtifact[];
  leader: AIEmployee;
  team: AIEmployee[];
}
```

---

### 步骤 1.9：生成并应用 Migration

**执行命令：**

```bash
npm run db:generate   # drizzle-kit generate → 输出到 supabase/migrations/
```

**手动检查生成的 SQL 确认：**
1. 枚举变更使用 `ALTER TYPE ... ADD VALUE` 而非重建
2. 新字段全部带 `DEFAULT` 或 `NULL`
3. mission_artifacts 表创建语句正确
4. 无 DROP 语句

```bash
npm run db:push       # 开发环境推送
```

**验证方法：**
```bash
npx tsc --noEmit          # 类型检查通过
npm run db:studio          # 打开 Drizzle Studio 确认新表和新字段存在
```

---

### 步骤 1.10：更新 DAL 以适配新字段

**修改文件：** `src/lib/dal/missions.ts`

**变更点：**

1. `getMissions()` 返回中增加 `description`, `phase`, `progress`, `config`, `startedAt` 字段映射
2. `getMissionById()` 增加 artifacts 查询和返回
3. `getMissionTasks()` / `getReadyTasks()` 增加新字段映射
4. `getMissionMessages()` 增加 `channel`, `structuredData`, `priority`, `replyTo` 映射

**关键代码（getMissionById 新增 artifacts 查询）：**

```typescript
// 在 getMissionById 中新增
import { missionArtifacts } from "@/db/schema";

// 查询 artifacts
const artifactRows = await db
  .select()
  .from(missionArtifacts)
  .where(eq(missionArtifacts.missionId, missionId))
  .orderBy(asc(missionArtifacts.createdAt));

const artifacts: MissionArtifact[] = artifactRows.map((a) => ({
  id: a.id,
  missionId: a.missionId,
  taskId: a.taskId,
  producedBy: a.producedBy,
  type: a.type,
  title: a.title,
  content: a.content,
  fileUrl: a.fileUrl,
  metadata: (a.metadata as Record<string, unknown>) ?? {},
  version: a.version,
  createdAt: a.createdAt.toISOString(),
}));

// 返回值中添加 artifacts
return {
  // ... 现有字段 ...
  description: row.description ?? undefined,
  phase: row.phase ?? undefined,
  progress: row.progress,
  config: row.config as Mission["config"],
  startedAt: row.startedAt?.toISOString() ?? null,
  artifacts,
};
```

**验证方法：**
```bash
npx tsc --noEmit  # 类型检查通过
```

---

## Phase 2：核心引擎重构

**目标：** 消除代码重复，提升可靠性，增加安全校验。

**前置依赖：** Phase 1 全部完成。

### 步骤 2.1：提取共享核心逻辑

**新建文件：** `src/lib/mission-core.ts`

**目的：** Inngest 函数（leader-plan.ts, execute-mission-task.ts 等）与直连执行器（mission-executor.ts）存在约 150 行重复代码。提取为纯函数，两端调用。

**核心提取内容：**

```typescript
// src/lib/mission-core.ts

import { db } from "@/db";
import {
  missions, missionTasks, missionMessages, missionArtifacts,
  aiEmployees, employeeSkills, skills,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { assembleAgent, executeAgent } from "@/lib/agent";
import type { StepOutput } from "@/lib/agent";
import type { EmployeeId } from "@/lib/constants";

// ──────────────────────────────────────────────────────────────────
// 1. 加载可用员工（含技能）
// ──────────────────────────────────────────────────────────────────
export async function loadAvailableEmployees(organizationId: string) {
  const employees = await db
    .select({
      id: aiEmployees.id,
      slug: aiEmployees.slug,
      name: aiEmployees.name,
      title: aiEmployees.title,
      nickname: aiEmployees.nickname,
    })
    .from(aiEmployees)
    .where(
      and(
        eq(aiEmployees.organizationId, organizationId),
        eq(aiEmployees.disabled, 0)
      )
    );

  return Promise.all(
    employees.map(async (emp) => {
      const empSkills = await db
        .select({ skillName: skills.name })
        .from(employeeSkills)
        .innerJoin(skills, eq(employeeSkills.skillId, skills.id))
        .where(eq(employeeSkills.employeeId, emp.id));
      return { ...emp, skills: empSkills.map((s) => s.skillName) };
    })
  );
}

// ──────────────────────────────────────────────────────────────────
// 2. 构建 Leader 拆解 Prompt
// ──────────────────────────────────────────────────────────────────
export function buildLeaderDecomposePrompt(
  mission: { userInstruction: string; scenario: string; title: string },
  employeesWithSkills: Array<{ slug: string; name: string; nickname: string; title: string; skills: string[] }>
): string {
  const employeeListText = employeesWithSkills
    .map(
      (emp) =>
        `- slug: ${emp.slug} | 名称: ${emp.name}（${emp.nickname}） | 职位: ${emp.title} | 技能: ${emp.skills.join("、") || "无"}`
    )
    .join("\n");

  return `你是任务总监，需要将用户的指令分解为多个子任务，并分配给合适的团队成员。

## 用户指令
${mission.userInstruction}

## 任务场景
${mission.scenario}

## 任务标题
${mission.title}

## 可用团队成员
${employeeListText}

## 要求
1. 分析用户指令，拆解为具体的子任务
2. 为每个子任务选择最合适的执行人（基于其技能）
3. 确定子任务之间的依赖关系（哪些任务必须在其他任务完成后才能开始）
4. 每个子任务需要有清晰的标题、详细描述和期望输出

## 输出格式
请严格按照以下 JSON 格式输出，不要包含任何其他文本：

\`\`\`json
{
  "tasks": [
    {
      "title": "子任务标题",
      "description": "详细描述，包括具体要求和注意事项",
      "expectedOutput": "期望的输出内容描述",
      "assignedEmployeeSlug": "employee_slug",
      "priority": 1,
      "dependsOn": []
    }
  ]
}
\`\`\`

注意：
- dependsOn 使用任务在数组中的索引（从 0 开始），表示依赖哪些前置任务
- priority 数值越大越重要
- 确保不要产生循环依赖`;
}

// ──────────────────────────────────────────────────────────────────
// 3. 解析 Leader 输出的 JSON
// ──────────────────────────────────────────────────────────────────
export interface ParsedTaskDef {
  title: string;
  description: string;
  expectedOutput?: string;
  assignedEmployeeSlug: string;
  priority?: number;
  dependsOn?: number[];
}

export function parseLeaderOutput(
  outputText: string,
  fallbackMission: { title: string; userInstruction: string },
  fallbackSlug: string
): { tasks: ParsedTaskDef[] } {
  let jsonStr = outputText;
  const jsonMatch = outputText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  } else {
    const rawJsonMatch = outputText.match(/\{[\s\S]*"tasks"[\s\S]*\}/);
    if (rawJsonMatch) jsonStr = rawJsonMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed.tasks && parsed.tasks.length > 0) return parsed;
  } catch {
    // fallback
  }

  return {
    tasks: [
      {
        title: fallbackMission.title,
        description: fallbackMission.userInstruction,
        assignedEmployeeSlug: fallbackSlug,
        priority: 1,
        dependsOn: [],
      },
    ],
  };
}

// ──────────────────────────────────────────────────────────────────
// 4. DAG 校验（拓扑排序）— 见步骤 2.3
// ──────────────────────────────────────────────────────────────────
export function validateDAG(tasks: ParsedTaskDef[]): {
  valid: boolean;
  error?: string;
  sortedIndices?: number[];
} {
  // 详见步骤 2.3
  const n = tasks.length;
  const inDegree = new Array(n).fill(0);
  const adj = Array.from({ length: n }, () => [] as number[]);

  for (let i = 0; i < n; i++) {
    for (const dep of tasks[i].dependsOn ?? []) {
      if (dep < 0 || dep >= n) {
        return { valid: false, error: `Task ${i} 引用了无效的依赖索引 ${dep}` };
      }
      adj[dep].push(i);
      inDegree[i]++;
    }
  }

  const queue: number[] = [];
  for (let i = 0; i < n; i++) {
    if (inDegree[i] === 0) queue.push(i);
  }

  const sorted: number[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);
    for (const next of adj[node]) {
      inDegree[next]--;
      if (inDegree[next] === 0) queue.push(next);
    }
  }

  if (sorted.length !== n) {
    return { valid: false, error: "任务依赖存在循环" };
  }

  return { valid: true, sortedIndices: sorted };
}

// ──────────────────────────────────────────────────────────────────
// 5. 创建任务记录
// ──────────────────────────────────────────────────────────────────
export async function createTaskRecords(
  missionId: string,
  tasks: ParsedTaskDef[],
  employeesWithSkills: Array<{ id: string; slug: string }>
): Promise<{ taskIds: string[]; selectedEmployeeIds: string[] }> {
  const taskIds: string[] = [];
  const selectedEmployeeIds = new Set<string>();

  for (let i = 0; i < tasks.length; i++) {
    const taskDef = tasks[i];
    const employee = employeesWithSkills.find(
      (e) => e.slug === taskDef.assignedEmployeeSlug
    );
    const employeeId = employee?.id || employeesWithSkills[0]?.id || null;
    if (employeeId) selectedEmployeeIds.add(employeeId);

    const depTaskIds = (taskDef.dependsOn || [])
      .filter((idx) => idx >= 0 && idx < taskIds.length)
      .map((idx) => taskIds[idx]);

    const [created] = await db
      .insert(missionTasks)
      .values({
        missionId,
        title: taskDef.title,
        description: taskDef.description,
        expectedOutput: taskDef.expectedOutput || null,
        assignedEmployeeId: employeeId,
        assignedRole: taskDef.assignedEmployeeSlug,
        dependencies: depTaskIds,
        priority: taskDef.priority ?? 0,
        status: "pending",
      })
      .returning({ id: missionTasks.id });

    taskIds.push(created.id);
  }

  return { taskIds, selectedEmployeeIds: [...selectedEmployeeIds] };
}

// ──────────────────────────────────────────────────────────────────
// 6. 构建任务执行上下文
// ──────────────────────────────────────────────────────────────────
export async function loadDependencyOutputs(
  taskDependencies: string[]
): Promise<StepOutput[]> {
  if (taskDependencies.length === 0) return [];

  const depTasks = await Promise.all(
    taskDependencies.map((depId) =>
      db.query.missionTasks.findFirst({ where: eq(missionTasks.id, depId) })
    )
  );

  return depTasks
    .filter((t) => t && t.outputData)
    .map((t) => {
      const output = t!.outputData as StepOutput;
      return {
        stepKey: t!.id,
        employeeSlug: (output.employeeSlug || "xiaolei") as EmployeeId,
        summary: output.summary || "",
        artifacts: output.artifacts || [],
        metrics: output.metrics,
        status: output.status || "success",
      } satisfies StepOutput;
    });
}

// ──────────────────────────────────────────────────────────────────
// 7. 检查 Token 预算
// ──────────────────────────────────────────────────────────────────
export async function checkTokenBudget(
  missionId: string
): Promise<{ withinBudget: boolean; remaining: number }> {
  const mission = await db.query.missions.findFirst({
    where: eq(missions.id, missionId),
  });
  if (!mission) return { withinBudget: false, remaining: 0 };

  const remaining = mission.tokenBudget - mission.tokensUsed;
  return { withinBudget: remaining > 0, remaining };
}

// ──────────────────────────────────────────────────────────────────
// 8. 进度计算
// ──────────────────────────────────────────────────────────────────
export function calculateMissionProgress(
  tasks: Array<{ status: string; priority: number; progress: number }>
): number {
  if (tasks.length === 0) return 0;

  // priority mapping: 0→P3(1), 1→P2(2), 2→P1(3), 3→P0(4)
  const weightMap: Record<number, number> = { 0: 1, 1: 2, 2: 3, 3: 4 };

  let totalWeightedProgress = 0;
  let totalWeight = 0;

  for (const task of tasks) {
    const weight = weightMap[task.priority] ?? 1;
    totalWeight += weight;

    let taskProgress = task.progress;
    if (task.status === "completed") taskProgress = 100;
    else if (task.status === "failed" || task.status === "cancelled" || task.status === "blocked") taskProgress = 0;

    totalWeightedProgress += taskProgress * weight;
  }

  return totalWeight > 0 ? Math.round(totalWeightedProgress / totalWeight) : 0;
}
```

**修改文件：** `src/lib/mission-executor.ts` — 将 `leaderPlanDirect`, `executeTaskDirect`, `leaderConsolidateDirect` 重构为调用 `mission-core.ts` 中的共享函数。

**修改文件：** `src/inngest/functions/leader-plan.ts` — 同上，从 mission-core 导入共享逻辑。

**验证方法：**
```bash
npx tsc --noEmit
# 手动创建一个 Mission 验证端到端执行
```

---

### 步骤 2.2：结构化输出替代正则解析

**修改文件：** `src/lib/mission-core.ts`（或重构后的共享模块）

**当前问题：** Leader 输出通过正则 `match(/```(?:json)?\s*([\s\S]*?)```/)` 提取 JSON，解析失败时 fallback 到单任务。

**目标方案：** 使用 AI SDK v6 的结构化输出确保 Leader 输出格式可靠。

**关键代码：**

```typescript
import { z } from "zod/v4";

// Zod schema for leader task decomposition output
const LeaderPlanSchema = z.object({
  tasks: z.array(z.object({
    title: z.string().describe("子任务标题"),
    description: z.string().describe("详细描述"),
    expectedOutput: z.string().optional().describe("期望输出"),
    assignedEmployeeSlug: z.string().describe("执行员工的slug"),
    priority: z.number().int().min(0).max(3).default(1).describe("优先级，越大越重要"),
    dependsOn: z.array(z.number().int().min(0)).default([]).describe("依赖的任务索引"),
  })).min(1).describe("子任务列表"),
});

// 在 executeAgent 调用时使用 output schema
// 注意：AI SDK v6 使用 Output.object() 配合 generateText
import { Output } from "ai";

const result = await generateText({
  model: resolvedModel,
  system: agent.systemPrompt,
  prompt: prompt,
  output: Output.object({ schema: LeaderPlanSchema }),
  maxOutputTokens: 4096,
});

// result.object 直接就是解析后的 TypeScript 对象，无需正则
const parsed = result.object;
```

**实施注意：**
- 需要在 `executeAgent` 中增加一个可选的 `outputSchema` 参数
- `assembleAgent` 返回的 `AssembledAgent` 类型保持不变
- 仅 Leader 拆解步骤使用结构化输出，Worker 执行仍用自由文本

**修改文件：**
- `src/lib/agent/types.ts` — AgentExecuteOptions 增加 `outputSchema?: z.ZodType`
- `src/lib/agent/index.ts` — `executeAgent` 增加结构化输出分支
- `src/lib/mission-core.ts` — Leader 调用时传入 schema
- `src/lib/mission-executor.ts` — 同上
- `src/inngest/functions/leader-plan.ts` — 同上

**验证方法：**
```bash
npx tsc --noEmit
# 创建一个 Mission 验证 Leader 输出结构正确
```

---

### 步骤 2.3：DAG 循环校验

**修改文件：** `src/lib/mission-core.ts`（已在步骤 2.1 中包含 `validateDAG` 函数）

**调用位置：** 在 `leaderPlanDirect` 和 `leader-plan.ts` 的 "create-tasks" 步骤中，`parseLeaderOutput` 之后、`createTaskRecords` 之前调用：

```typescript
const dagResult = validateDAG(parsed.tasks);
if (!dagResult.valid) {
  // 记录错误消息
  await db.insert(missionMessages).values({
    missionId,
    fromEmployeeId: mission.leaderEmployeeId,
    messageType: "status_update",
    content: `任务拆解失败：${dagResult.error}。将使用简化任务结构。`,
  });
  // 降级为线性无依赖的任务列表
  parsed.tasks = parsed.tasks.map((t) => ({ ...t, dependsOn: [] }));
}
```

**验证方法：**
```bash
npx tsc --noEmit
# 单元测试 validateDAG
# 测试场景：正常 DAG、含环 DAG、无效索引
```

---

### 步骤 2.4：Token 预算强校验

**修改文件：**
- `src/lib/mission-core.ts` — 已在步骤 2.1 中包含 `checkTokenBudget`
- `src/lib/mission-executor.ts` — `executeTaskDirect` 开头增加预算检查
- `src/inngest/functions/execute-mission-task.ts` — 同上

**关键代码（在任务执行前添加）：**

```typescript
// 在 "execute-agent" 步骤之前
const budgetCheck = await checkTokenBudget(missionId);
if (!budgetCheck.withinBudget) {
  // Token 预算耗尽，触发降级交付
  await db
    .update(missionTasks)
    .set({ status: "cancelled", errorMessage: "Token 预算耗尽" })
    .where(eq(missionTasks.id, taskId));

  // 触发 all-tasks-done 让 Leader 用已有产出汇总
  // (实际需要检查是否还有其他运行中任务)
  return { status: "budget_exceeded" };
}
```

**验证方法：** 创建一个 tokenBudget=1000 的 Mission 验证执行时被拦截。

---

### 步骤 2.5：4 级降级交付策略

**修改文件：**
- `src/lib/mission-core.ts` — 新增 `determineDegradationLevel` 函数
- `src/lib/mission-executor.ts` — `leaderConsolidateDirect` 中使用
- `src/inngest/functions/leader-consolidate.ts` — 同上

**关键代码：**

```typescript
export type DegradationLevel = 1 | 2 | 3 | 4;

export function determineDegradationLevel(
  tasks: Array<{ status: string; outputData: unknown }>
): DegradationLevel {
  const completed = tasks.filter((t) => t.status === "completed" && t.outputData);
  const failed = tasks.filter((t) => t.status === "failed");
  const total = tasks.length;

  if (completed.length === total) return 1; // Level 1: 全部完成
  if (completed.length > 0 && completed.length >= total / 2) return 2; // Level 2: 部分完成
  if (completed.length > 0) return 3; // Level 3: 少量完成
  return 4; // Level 4: 全部失败
}

export async function degradedConsolidate(
  missionId: string,
  level: DegradationLevel,
  completedTasks: Array<{ title: string; outputData: unknown }>,
  failedTasks: Array<{ title: string; errorMessage: string | null }>
): Promise<unknown> {
  switch (level) {
    case 1:
      // 正常交付 — 不在此处理
      return null;
    case 2:
      // 部分交付：Leader 汇总已有产出 + 标注缺失
      // 调用 Leader Agent 汇总，注明哪些任务失败
      return { type: "partial", completed: completedTasks.length, total: completedTasks.length + failedTasks.length };
    case 3:
      // 原始交付：直接打包各子任务 Artifact
      return {
        type: "raw",
        artifacts: completedTasks.map((t) => ({
          title: t.title,
          output: t.outputData,
        })),
      };
    case 4:
      // 失败报告
      return {
        type: "failure_report",
        failedTasks: failedTasks.map((t) => ({
          title: t.title,
          error: t.errorMessage,
        })),
      };
  }
}
```

**在 leader-consolidate 中集成：**

```typescript
// 在汇总之前判断降级等级
const allTasks = await db.select().from(missionTasks).where(eq(missionTasks.missionId, missionId));
const level = determineDegradationLevel(allTasks);

if (level >= 3) {
  // 跳过 Leader Agent 汇总，直接使用降级方案
  const result = await degradedConsolidate(missionId, level, completedTasks, failedTasks);
  await db.update(missions).set({
    status: level === 4 ? "failed" : "completed",
    finalOutput: result,
    completedAt: new Date(),
  }).where(eq(missions.id, missionId));
  return;
}
// Level 1/2: 正常调用 Leader Agent 汇总
```

**验证方法：**
```bash
npx tsc --noEmit
# 模拟不同失败场景验证降级等级判定正确
```

---

### 步骤 2.6：进程保活 — 使用 Next.js after() API

**修改文件：** `src/app/actions/missions.ts`

**当前问题：**

```typescript
// 当前代码 — 使用 .then() 异步，Next.js 可能提前终止
executeMissionDirect(mission.id, organizationId)
  .then(() => { ... })
  .catch((err) => { ... });
```

**目标方案：**

```typescript
import { after } from "next/server";

export async function startMission(data: { ... }) {
  // ... 创建 mission 记录 ...

  // 使用 after() 确保后台执行不被 Next.js 提前终止
  after(async () => {
    try {
      await executeMissionDirect(mission.id, organizationId);
      console.log(`[mission] ${mission.id} completed successfully`);
    } catch (err) {
      console.error(`[mission] ${mission.id} failed:`, err);
      await db.update(missions)
        .set({ status: "failed" })
        .where(eq(missions.id, mission.id))
        .catch(() => {});
    }
  });

  revalidatePath("/missions");
  return mission;
}
```

**注意：** `after()` 是 Next.js 15+ 中的 API，从 `next/server` 导入。需确认 Next.js 16.1.6 支持此 API。若不支持，备选方案为完全切回 Inngest 事件驱动。

**验证方法：**
```bash
npx tsc --noEmit
npm run build        # 确认 after() 可正常编译
# 创建 Mission 确认执行不被中断
```

---

### 步骤 2.7：跨组织校验

**修改文件：** `src/app/actions/missions.ts`

**当前问题：** `cancelMission` 未校验 missionId 是否属于当前用户的组织。

**修改：**

```typescript
export async function cancelMission(missionId: string) {
  const user = await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("无法获取组织信息");

  // 校验 mission 归属
  const mission = await db.query.missions.findFirst({
    where: and(
      eq(missions.id, missionId),
      eq(missions.organizationId, orgId)
    ),
  });
  if (!mission) throw new Error("任务不存在或无权操作");

  await db
    .update(missions)
    .set({ status: "cancelled", completedAt: new Date() })
    .where(eq(missions.id, missionId));

  // ... 其余逻辑不变 ...
}
```

**验证方法：** 手动测试跨组织 cancelMission 被拒绝。

---

### 步骤 2.8：技能绑定去重

**修改文件：** `src/app/actions/employees.ts`

**当前问题：** `bindSkillToEmployee` 没有检查是否已绑定，重复调用会创建重复记录。

**修改（在兼容性检查后、insert 前添加）：**

```typescript
export async function bindSkillToEmployee(
  employeeId: string,
  skillId: string,
  level: number = 50,
  bindingType: "core" | "extended" | "knowledge" = "extended"
) {
  await requireAuth();

  // ... 现有的 employee 和 skill 加载 + 兼容性检查 ...

  // 新增：检查是否已绑定
  const existing = await db.query.employeeSkills.findFirst({
    where: and(
      eq(employeeSkills.employeeId, employeeId),
      eq(employeeSkills.skillId, skillId)
    ),
  });
  if (existing) {
    // 已绑定，更新 level 和 bindingType 而非重复插入
    await db
      .update(employeeSkills)
      .set({ level, bindingType, createdAt: new Date() })
      .where(eq(employeeSkills.id, existing.id));

    revalidatePath(`/employee/${employeeId}`);
    return existing;
  }

  // ... 现有的 insert 逻辑 ...
}
```

**验证方法：**
```bash
npx tsc --noEmit
# 两次绑定同一技能不产生重复记录
```

---

## Phase 3：缺失功能补齐

**目标：** 补齐功能清单中标记为"未实现"和"部分实现"的功能点。

**前置依赖：** Phase 1 完成（新字段和类型已可用）。Phase 2 的部分步骤可并行。

### 步骤 3.1：任务归档与删除

**修改文件：** `src/app/actions/missions.ts`

**新增函数：**

```typescript
/**
 * 归档已完成/失败的任务（软删除概念 — 标记为 archived 状态或从列表隐藏）
 * 由于未新增 archived 状态枚举，使用 JSON config 标记
 */
export async function archiveMission(missionId: string) {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("无法获取组织信息");

  const mission = await db.query.missions.findFirst({
    where: and(
      eq(missions.id, missionId),
      eq(missions.organizationId, orgId)
    ),
  });
  if (!mission) throw new Error("任务不存在或无权操作");

  // 仅允许归档已终止的任务
  if (!["completed", "failed", "cancelled"].includes(mission.status)) {
    throw new Error("只能归档已完成、失败或已取消的任务");
  }

  // 使用 config JSON 字段标记归档
  const currentConfig = (mission.config as Record<string, unknown>) ?? {};
  await db
    .update(missions)
    .set({
      config: { ...currentConfig, archived: true, archivedAt: new Date().toISOString() },
    })
    .where(eq(missions.id, missionId));

  revalidatePath("/missions");
}

/**
 * 永久删除任务（级联删除 tasks, messages, artifacts）
 */
export async function deleteMission(missionId: string) {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("无法获取组织信息");

  const mission = await db.query.missions.findFirst({
    where: and(
      eq(missions.id, missionId),
      eq(missions.organizationId, orgId)
    ),
  });
  if (!mission) throw new Error("任务不存在或无权操作");

  // 不允许删除运行中的任务
  if (["planning", "executing", "consolidating", "coordinating"].includes(mission.status)) {
    throw new Error("不能删除运行中的任务，请先取消");
  }

  // CASCADE 会自动清理 tasks, messages, artifacts
  await db.delete(missions).where(eq(missions.id, missionId));

  revalidatePath("/missions");
}
```

**前端集成：**

在 `missions-client.tsx` 的任务行展开区域或操作菜单中添加"归档"和"删除"按钮，仅对已终止的任务显示。

**验证方法：**
```bash
npx tsc --noEmit
# 手动测试归档和删除操作
```

---

### 步骤 3.2：任务重新执行

**修改文件：** `src/app/actions/missions.ts`

**新增函数：**

```typescript
/**
 * 重新执行一个已完成或失败的任务（创建新 Mission，复制原始参数）
 */
export async function retryMission(missionId: string) {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("无法获取组织信息");

  const original = await db.query.missions.findFirst({
    where: and(
      eq(missions.id, missionId),
      eq(missions.organizationId, orgId)
    ),
  });
  if (!original) throw new Error("任务不存在或无权操作");

  if (!["completed", "failed", "cancelled"].includes(original.status)) {
    throw new Error("只能重新执行已终止的任务");
  }

  // 创建新 Mission，参数复制自原始任务
  return startMission({
    title: `${original.title}（重新执行）`,
    scenario: original.scenario,
    userInstruction: original.userInstruction,
  });
}
```

**前端集成：** 在 `mission-console-client.tsx` 的顶栏操作区域，为已终止任务显示"重新执行"按钮。

**验证方法：**
```bash
npx tsc --noEmit
# 重新执行一个已完成的 Mission
```

---

### 步骤 3.3：子任务输出详情完善

**修改文件：** `src/app/(dashboard)/missions/[id]/mission-console-client.tsx`

**当前状态：** 看板卡片仅显示 `outputSummary` 的前几行。

**目标：** 点击卡片可展开查看完整 `outputData`。

**实现方案：** 在看板卡片上添加 Sheet/Dialog，点击后显示完整输出。

```tsx
// 在 MissionConsoleClient 中新增状态
const [selectedTask, setSelectedTask] = useState<MissionTask | null>(null);

// 看板卡片添加点击事件
<Card
  className="cursor-pointer"
  onClick={() => setSelectedTask(task)}
>
  {/* 现有卡片内容 */}
</Card>

// 新增 Sheet 组件
<Sheet open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
  <SheetContent className="w-[600px] sm:w-[800px]">
    <SheetHeader>
      <SheetTitle>{selectedTask?.title}</SheetTitle>
    </SheetHeader>
    <div className="mt-4 space-y-4">
      <div>
        <h4 className="text-sm font-medium text-muted-foreground mb-1">任务描述</h4>
        <p className="text-sm">{selectedTask?.description}</p>
      </div>
      {selectedTask?.expectedOutput && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-1">期望输出</h4>
          <p className="text-sm">{selectedTask.expectedOutput}</p>
        </div>
      )}
      {selectedTask?.outputData && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-1">执行结果</h4>
          <CollapsibleMarkdown
            content={(selectedTask.outputData as { summary?: string })?.summary || JSON.stringify(selectedTask.outputData, null, 2)}
          />
        </div>
      )}
      {selectedTask?.errorMessage && (
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-1">错误信息</h4>
          <p className="text-sm text-red-500">{selectedTask.errorMessage}</p>
        </div>
      )}
    </div>
  </SheetContent>
</Sheet>
```

**验证方法：** 在浏览器中打开任务详情页，点击看板卡片查看完整输出。

---

### 步骤 3.4：员工搜索 + 排序

**修改文件：** `src/app/(dashboard)/employee-marketplace/employee-marketplace-client.tsx`

**新增功能：** 在状态筛选条旁边增加搜索框和排序选择器。

```tsx
// 新增 state
const [searchText, setSearchText] = useState("");
const [sortBy, setSortBy] = useState<"default" | "performance" | "name" | "status">("default");

// 筛选 + 搜索 + 排序逻辑
const filteredEmployees = useMemo(() => {
  let result = employees;

  // 状态筛选（保持现有逻辑）
  if (statusFilter !== "all") {
    result = result.filter((e) => e.status === statusFilter);
  }

  // 文本搜索
  if (searchText.trim()) {
    const q = searchText.toLowerCase();
    result = result.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.nickname.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q)
    );
  }

  // 排序
  switch (sortBy) {
    case "performance":
      result = [...result].sort((a, b) => b.stats.tasksCompleted - a.stats.tasksCompleted);
      break;
    case "name":
      result = [...result].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
      break;
    case "status":
      const statusOrder = { working: 0, learning: 1, reviewing: 2, idle: 3 };
      result = [...result].sort(
        (a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9)
      );
      break;
    default:
      break;
  }

  return result;
}, [employees, statusFilter, searchText, sortBy]);

// UI 部分 — 在筛选条区域新增
<div className="flex items-center gap-3">
  <Input
    placeholder="搜索员工名称、昵称..."
    value={searchText}
    onChange={(e) => setSearchText(e.target.value)}
    className="w-64"
  />
  <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
    <SelectTrigger className="w-36">
      <SelectValue placeholder="排序方式" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="default">默认排序</SelectItem>
      <SelectItem value="performance">按绩效</SelectItem>
      <SelectItem value="name">按名称</SelectItem>
      <SelectItem value="status">按状态</SelectItem>
    </SelectContent>
  </Select>
</div>
```

**验证方法：** 在员工市场页面输入搜索关键字和切换排序方式。

---

### 步骤 3.5：员工信息编辑 UI

**修改文件：** `src/app/(dashboard)/employee/[id]/employee-profile-client.tsx`

**当前状态：** `updateEmployeeProfile` Server Action 已存在，但前端无编辑入口。

**新增组件：** 在员工详情页头部区域添加"编辑"按钮，点击弹出编辑 Dialog。

```tsx
// 新建组件或在 employee-profile-client.tsx 内联
function EditProfileDialog({
  employee,
  open,
  onOpenChange,
}: {
  employee: EmployeeFullProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState(employee.name);
  const [nickname, setNickname] = useState(employee.nickname);
  const [title, setTitle] = useState(employee.title);
  const [motto, setMotto] = useState(employee.motto);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await updateEmployeeProfile(employee.dbId, { name, nickname, title, motto });
      onOpenChange(false);
      // router.refresh() 或 revalidate
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑员工信息</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>名称</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>昵称</Label>
            <Input value={nickname} onChange={(e) => setNickname(e.target.value)} />
          </div>
          <div>
            <Label>职位</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>座右铭</Label>
            <Textarea value={motto} onChange={(e) => setMotto(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**在员工详情页头部添加编辑按钮：**

```tsx
// 在头部 nickname/title 旁边
{!employee.isPreset && (
  <Button
    variant="ghost"
    size="icon"
    onClick={() => setEditOpen(true)}
  >
    <Pencil className="h-4 w-4" />
  </Button>
)}
```

**验证方法：** 打开自定义员工的详情页，点击编辑，修改名称后保存。

---

### 步骤 3.6：技能库浏览页

**新建文件：**
- `src/app/(dashboard)/skills/page.tsx` — Server Component
- `src/app/(dashboard)/skills/skills-client.tsx` — Client Component

**page.tsx（Server Component）：**

```typescript
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { getSkills } from "@/lib/dal/skills";
import { redirect } from "next/navigation";
import { SkillsClient } from "./skills-client";

export const dynamic = "force-dynamic";

export default async function SkillsPage() {
  const orgId = await getCurrentUserOrg();
  if (!orgId) redirect("/login");

  const skills = await getSkills(orgId);

  return <SkillsClient skills={skills} />;
}
```

**skills-client.tsx（Client Component）：**

```tsx
"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/shared/glass-card";
import Link from "next/link";
import type { SkillCategory } from "@/lib/types";

interface SkillItem {
  id: string;
  name: string;
  category: SkillCategory;
  type: "builtin" | "custom" | "plugin";
  description: string;
  version: string;
}

interface SkillsClientProps {
  skills: SkillItem[];
}

const CATEGORY_LABELS: Record<SkillCategory, string> = {
  perception: "感知",
  analysis: "分析",
  generation: "生成",
  production: "制作",
  management: "管理",
  knowledge: "知识",
};

export function SkillsClient({ skills }: SkillsClientProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    let result = skills;
    if (categoryFilter !== "all") {
      result = result.filter((s) => s.category === categoryFilter);
    }
    if (typeFilter !== "all") {
      result = result.filter((s) => s.type === typeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q)
      );
    }
    return result;
  }, [skills, categoryFilter, typeFilter, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">技能库</h1>
        <p className="text-muted-foreground">管理所有 AI 技能</p>
      </div>

      {/* 筛选栏 */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="搜索技能..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="分类" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部分类</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="builtin">内置</SelectItem>
            <SelectItem value="custom">自定义</SelectItem>
            <SelectItem value="plugin">插件</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary">{filtered.length} 个技能</Badge>
      </div>

      {/* 技能网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((skill) => (
          <Link key={skill.id} href={`/skills/${skill.id}`}>
            <GlassCard className="p-4 cursor-pointer hover:scale-[1.02] transition-transform">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold">{skill.name}</h3>
                <Badge variant="outline">{CATEGORY_LABELS[skill.category]}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                {skill.description}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Badge variant="secondary">
                  {skill.type === "builtin" ? "内置" : skill.type === "plugin" ? "插件" : "自定义"}
                </Badge>
                <span className="text-xs text-muted-foreground">v{skill.version}</span>
              </div>
            </GlassCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

**侧栏更新：** 在 `src/components/layout/app-sidebar.tsx` 中添加"技能库"菜单项，指向 `/skills`。

**验证方法：**
```bash
npx tsc --noEmit
npm run build
# 浏览器访问 /skills 查看技能列表
```

---

### 步骤 3.7：技能详情页

**新建文件：**
- `src/app/(dashboard)/skills/[id]/page.tsx`
- `src/app/(dashboard)/skills/[id]/skill-detail-client.tsx`

**page.tsx：**

```typescript
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { getSkillDetailPageData } from "@/lib/dal/skills";
import { redirect, notFound } from "next/navigation";
import { SkillDetailClient } from "./skill-detail-client";

export const dynamic = "force-dynamic";

export default async function SkillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orgId = await getCurrentUserOrg();
  if (!orgId) redirect("/login");

  const data = await getSkillDetailPageData(id, orgId);
  if (!data) notFound();

  return <SkillDetailClient data={data} />;
}
```

**skill-detail-client.tsx：**

包含以下 Tab/Section：
1. **概览** — 名称、分类、类型、版本、描述、兼容角色
2. **技能文档** — SKILL.md 内容（Markdown 渲染）
3. **Schema** — inputSchema / outputSchema 展示
4. **绑定员工** — 已绑定此技能的员工列表（含熟练度）
5. **版本历史** — 版本列表 + 回滚按钮
6. **使用统计** — 图表可视化（见步骤 3.8）

**验证方法：**
```bash
npx tsc --noEmit
npm run build
# 浏览器访问 /skills/{id} 查看详情
```

---

### 步骤 3.8：使用统计可视化

**修改文件：** `src/app/(dashboard)/skills/[id]/skill-detail-client.tsx`

**新增组件：** 在技能详情页的"使用统计" Tab 中添加图表。

**数据来源：** 调用已有的 `getSkillUsageStats` Server Action 获取聚合数据。

```tsx
// 使用统计区域
import { AreaChartWrapper } from "@/components/charts/area-chart";
import { DonutChartWrapper } from "@/components/charts/donut-chart";

function UsageStatsTab({ skillId }: { skillId: string }) {
  const [stats, setStats] = useState<SkillUsageStats | null>(null);

  useEffect(() => {
    getSkillUsageStats(skillId).then(setStats);
  }, [skillId]);

  if (!stats) return <div>加载中...</div>;

  return (
    <div className="space-y-6">
      {/* 统计指标卡片 */}
      <div className="grid grid-cols-4 gap-4">
        <GlassCard className="p-4 text-center">
          <p className="text-sm text-muted-foreground">总调用次数</p>
          <p className="text-2xl font-bold">{stats.totalCalls}</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-sm text-muted-foreground">成功率</p>
          <p className="text-2xl font-bold">{stats.successRate}%</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-sm text-muted-foreground">平均质量分</p>
          <p className="text-2xl font-bold">{stats.avgQuality}</p>
        </GlassCard>
        <GlassCard className="p-4 text-center">
          <p className="text-sm text-muted-foreground">平均耗时</p>
          <p className="text-2xl font-bold">{stats.avgLatencyMs}ms</p>
        </GlassCard>
      </div>

      {/* 趋势图 */}
      <GlassCard className="p-4">
        <h3 className="font-semibold mb-4">使用趋势（近30天）</h3>
        <AreaChartWrapper
          data={stats.dailyUsage}
          xKey="date"
          yKeys={["calls"]}
          colors={["#4f46e5"]}
        />
      </GlassCard>

      {/* 员工维度使用分布 */}
      <GlassCard className="p-4">
        <h3 className="font-semibold mb-4">员工使用分布</h3>
        <DonutChartWrapper
          data={stats.byEmployee}
          nameKey="employeeName"
          valueKey="calls"
        />
      </GlassCard>
    </div>
  );
}
```

**注意：** `getSkillUsageStats` 需要返回 `dailyUsage` 和 `byEmployee` 结构。如果当前 Action 返回结构不匹配，需要在 DAL 层补充聚合查询：

**修改文件（可能需要）：** `src/lib/dal/skills.ts` — 新增 `getSkillUsageChartData` 函数

```typescript
export async function getSkillUsageChartData(
  skillId: string,
  orgId: string
): Promise<{
  dailyUsage: Array<{ date: string; calls: number; successRate: number }>;
  byEmployee: Array<{ employeeName: string; calls: number }>;
}> {
  // 按日聚合
  const daily = await db
    .select({
      date: sql<string>`date_trunc('day', ${skillUsageRecords.createdAt})::text`,
      calls: sql<number>`count(*)::int`,
      successRate: sql<number>`round(avg(${skillUsageRecords.success}) * 100)::int`,
    })
    .from(skillUsageRecords)
    .where(
      and(
        eq(skillUsageRecords.skillId, skillId),
        eq(skillUsageRecords.organizationId, orgId)
      )
    )
    .groupBy(sql`date_trunc('day', ${skillUsageRecords.createdAt})`)
    .orderBy(sql`date_trunc('day', ${skillUsageRecords.createdAt})`);

  // 按员工聚合
  const byEmp = await db
    .select({
      employeeName: aiEmployees.nickname,
      calls: sql<number>`count(*)::int`,
    })
    .from(skillUsageRecords)
    .innerJoin(aiEmployees, eq(skillUsageRecords.employeeId, aiEmployees.id))
    .where(
      and(
        eq(skillUsageRecords.skillId, skillId),
        eq(skillUsageRecords.organizationId, orgId)
      )
    )
    .groupBy(aiEmployees.nickname);

  return { dailyUsage: daily, byEmployee: byEmp };
}
```

**验证方法：**
```bash
npx tsc --noEmit
# 浏览器查看技能详情页的使用统计 Tab
```

---

### 步骤 3.9：技能执行自动记录

**修改文件：**
- `src/lib/mission-executor.ts` — `executeTaskDirect` 完成后调用记录函数
- `src/inngest/functions/execute-mission-task.ts` — 同上

**当前问题：** `recordSkillUsage` 是 Server Action，需要用户 session，但 Agent 执行时无 session。

**解决方案：** 将技能使用记录逻辑提取为内部 DAL 函数（不依赖 session），在任务执行完成后自动调用。

**新增文件或修改文件：** `src/lib/dal/skills.ts`

```typescript
/**
 * 内部函数：记录技能使用，不需要用户 session
 * 在 Mission 任务执行完成后自动调用
 */
export async function recordSkillUsageInternal(data: {
  skillId: string;
  employeeId: string;
  organizationId: string;
  missionId?: string;
  missionTaskId?: string;
  success: boolean;
  qualityScore?: number;
  executionTimeMs?: number;
  tokenUsage?: number;
  inputSummary?: string;
  outputSummary?: string;
}) {
  await db.insert(skillUsageRecords).values({
    skillId: data.skillId,
    employeeId: data.employeeId,
    organizationId: data.organizationId,
    missionId: data.missionId || null,
    missionTaskId: data.missionTaskId || null,
    success: data.success ? 1 : 0,
    qualityScore: data.qualityScore ?? null,
    executionTimeMs: data.executionTimeMs ?? null,
    tokenUsage: data.tokenUsage ?? null,
    inputSummary: data.inputSummary ?? null,
    outputSummary: data.outputSummary ?? null,
  });
}
```

**在任务执行后调用（mission-executor.ts 和 execute-mission-task.ts）：**

```typescript
// 在任务完成后，获取员工的技能列表，为每个技能记录使用
import { recordSkillUsageInternal } from "@/lib/dal/skills";

// 获取员工绑定的技能
const empSkillRows = await db
  .select({ skillId: employeeSkills.skillId })
  .from(employeeSkills)
  .where(eq(employeeSkills.employeeId, task.assignedEmployeeId));

// 为每个技能记录使用
for (const { skillId } of empSkillRows) {
  await recordSkillUsageInternal({
    skillId,
    employeeId: task.assignedEmployeeId,
    organizationId,
    missionId,
    missionTaskId: taskId,
    success: true,
    executionTimeMs: result.durationMs,
    tokenUsage: result.tokensUsed.input + result.tokensUsed.output,
    outputSummary: result.output.summary?.slice(0, 200),
  });
}
```

**验证方法：**
```bash
npx tsc --noEmit
# 执行一个 Mission，查看 skill_usage_records 表中有新记录
```

---

## Phase 4：安全加固

**前置依赖：** Phase 1 完成。可与 Phase 2/3 并行。

### 步骤 4.1：组织归属全面审计

**修改文件：** 以下 Server Action 文件需要增加 orgId 校验：

| 文件 | 函数 | 当前状态 | 修改 |
|------|------|---------|------|
| `actions/missions.ts` | `cancelMission` | 无 orgId 校验 | 已在步骤 2.7 修复 |
| `actions/employees.ts` | `updateEmployeeStatus` | 无 orgId 校验 | 需加 |
| `actions/employees.ts` | `bindSkillToEmployee` | 无 orgId 校验 | 需加 |
| `actions/employees.ts` | `unbindSkillFromEmployee` | 无 orgId 校验 | 需加 |
| `actions/employees.ts` | `updateSkillLevel` | 无 orgId 校验 | 需加 |
| `actions/employees.ts` | `updateEmployeeProfile` | 无 orgId 校验 | 需加 |
| `actions/employees.ts` | `updateWorkPreferences` | 无 orgId 校验 | 需加 |
| `actions/employees.ts` | `updateAuthorityLevel` | 无 orgId 校验 | 需加 |
| `actions/employees.ts` | `toggleEmployeeDisabled` | 无 orgId 校验 | 需加 |
| `actions/employees.ts` | `deleteEmployee` | 无 orgId 校验 | 需加 |
| `actions/employees.ts` | `cloneEmployee` | 无 orgId 校验 | 需加 |

**统一修改模式：**

```typescript
// 在每个需要操作 employee 的函数开头添加
async function requireOwnedEmployee(employeeId: string) {
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("无法获取组织信息");

  const employee = await db.query.aiEmployees.findFirst({
    where: and(
      eq(aiEmployees.id, employeeId),
      eq(aiEmployees.organizationId, orgId)
    ),
  });
  if (!employee) throw new Error("员工不存在或无权操作");
  return { employee, orgId };
}

// 示例：updateEmployeeStatus
export async function updateEmployeeStatus(
  employeeId: string,
  status: "working" | "idle" | "learning" | "reviewing",
  currentTask?: string
) {
  await requireAuth();
  await requireOwnedEmployee(employeeId); // 新增

  await db
    .update(aiEmployees)
    .set({ status, currentTask: currentTask || null, updatedAt: new Date() })
    .where(eq(aiEmployees.id, employeeId));

  revalidatePath("/missions");
}
```

**对 Scenario API Route 同样添加：**

**修改文件：** `src/app/api/scenarios/execute/route.ts`

```typescript
// 在处理请求时校验 employeeDbId 归属
const orgId = await getCurrentUserOrg();
const employee = await db.query.aiEmployees.findFirst({
  where: and(
    eq(aiEmployees.id, employeeDbId),
    eq(aiEmployees.organizationId, orgId!)
  ),
});
if (!employee) {
  return new Response("Forbidden", { status: 403 });
}
```

**验证方法：**
```bash
npx tsc --noEmit
# 尝试操作不属于当前组织的员工 ID，验证返回错误
```

---

### 步骤 4.2：插件安全加固

**修改文件：** `src/db/schema/skills.ts`, `src/app/actions/skills.ts`, `src/lib/agent/tool-registry.ts`

**4.2.1 authKey 加密存储：**

**新建文件：** `src/lib/crypto.ts`

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ENCRYPTION_KEY = process.env.PLUGIN_ENCRYPTION_KEY || "default-32-byte-key-for-dev-000";
const ALGORITHM = "aes-256-cbc";

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, "utf8").subarray(0, 32), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decrypt(encryptedText: string): string {
  const [ivHex, encrypted] = encryptedText.split(":");
  if (!ivHex || !encrypted) return encryptedText; // 未加密的旧数据
  const iv = Buffer.from(ivHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, "utf8").subarray(0, 32), iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
```

**在 `actions/skills.ts` 中：**
- `registerPluginSkill` — 写入前加密 `authKey`
- `updatePluginConfig` — 写入前加密 `authKey`

**在 `tool-registry.ts` 中：**
- `createPluginTool` — 使用前解密 `authKey`

**4.2.2 URL 白名单：**

在 `registerPluginSkill` 和 `updatePluginConfig` 中添加 URL 校验：

```typescript
const ALLOWED_DOMAINS = [
  "api.", // 允许 api. 开头的域名
  ".com",
  ".cn",
  ".io",
];

const BLOCKED_DOMAINS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "169.254.", // link-local
  "10.", // 内网
  "192.168.",
  "172.16.",
];

function validatePluginUrl(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    // 阻止内网地址
    for (const blocked of BLOCKED_DOMAINS) {
      if (url.hostname.includes(blocked)) return false;
    }
    // 仅允许 HTTPS
    if (url.protocol !== "https:") return false;
    return true;
  } catch {
    return false;
  }
}
```

**验证方法：**
```bash
npx tsc --noEmit
# 测试注册指向 localhost 的插件被拒绝
```

---

### 步骤 4.3：员工状态守护

**新建文件：** `src/inngest/functions/employee-status-guard.ts`

**功能：** 定时扫描长时间处于 `working` 状态的员工并重置为 `idle`（防止执行异常导致员工永久卡在 working 状态）。

```typescript
import { inngest } from "../client";
import { db } from "@/db";
import { aiEmployees } from "@/db/schema";
import { eq, and, lt, sql } from "drizzle-orm";

export const employeeStatusGuard = inngest.createFunction(
  { id: "employee-status-guard" },
  { cron: "*/30 * * * *" },  // 每30分钟执行一次
  async ({ step }) => {
    // 查找超过 30 分钟仍处于 working 的员工
    const staleThreshold = new Date(Date.now() - 30 * 60 * 1000);

    const staleEmployees = await step.run("find-stale-workers", async () => {
      return db
        .select({ id: aiEmployees.id, slug: aiEmployees.slug })
        .from(aiEmployees)
        .where(
          and(
            eq(aiEmployees.status, "working"),
            lt(aiEmployees.updatedAt, staleThreshold)
          )
        );
    });

    if (staleEmployees.length === 0) {
      return { status: "ok", resetCount: 0 };
    }

    await step.run("reset-stale-workers", async () => {
      for (const emp of staleEmployees) {
        await db
          .update(aiEmployees)
          .set({
            status: "idle",
            currentTask: null,
            updatedAt: new Date(),
          })
          .where(eq(aiEmployees.id, emp.id));
        console.log(`[status-guard] Reset stale worker ${emp.slug} to idle`);
      }
    });

    return { status: "reset", resetCount: staleEmployees.length };
  }
);
```

**注册：** `src/inngest/functions/index.ts` 新增导入和导出。

```typescript
import { employeeStatusGuard } from "./employee-status-guard";

export const functions = [
  // ... 现有函数 ...
  employeeStatusGuard,
];
```

**注册事件类型：** `src/inngest/events.ts` 无需变更（cron 不需要事件类型）。

**验证方法：**
```bash
npx tsc --noEmit
# Inngest dev server 中查看 cron 函数注册
```

---

### 步骤 4.4：数据库唯一约束与索引

**通过 Migration 添加以下约束：**

手动创建 migration SQL 文件 或使用 Drizzle 的 `.unique()` + `index()`。

**需要添加的约束：**

| 表 | 约束类型 | 字段 | 目的 |
|---|---------|------|------|
| `ai_employees` | UNIQUE INDEX | `(organization_id, slug)` | 防止同组织重复 slug |
| `employee_skills` | UNIQUE INDEX | `(employee_id, skill_id)` | 防止重复绑定（配合步骤 2.8）|
| `employee_knowledge_bases` | UNIQUE INDEX | `(employee_id, knowledge_base_id)` | 防止重复绑定 |
| `missions` | INDEX | `(organization_id, status)` | 加速列表查询 |
| `mission_tasks` | INDEX | `(mission_id, status)` | 加速任务查询 |
| `skill_usage_records` | INDEX | `(skill_id, created_at)` | 加速使用统计 |

**实现方式（Drizzle Schema）：**

在对应的 schema 文件中使用 Drizzle 的 `uniqueIndex` / `index`：

```typescript
// src/db/schema/skills.ts — employeeSkills 表添加唯一索引
import { uniqueIndex } from "drizzle-orm/pg-core";

// 在 employeeSkills 定义后添加
// 注意：Drizzle 0.45 中需要使用 pgTable 的第二个参数（table callback）
export const employeeSkills = pgTable("employee_skills", {
  // ... 现有字段 ...
}, (table) => [
  uniqueIndex("employee_skills_employee_skill_unique")
    .on(table.employeeId, table.skillId),
]);
```

**由于修改表定义可能影响现有导出，也可以在 migration SQL 中直接编写：**

```sql
-- 唯一约束
CREATE UNIQUE INDEX IF NOT EXISTS ai_employees_org_slug_unique
  ON ai_employees (organization_id, slug);

CREATE UNIQUE INDEX IF NOT EXISTS employee_skills_employee_skill_unique
  ON employee_skills (employee_id, skill_id);

CREATE UNIQUE INDEX IF NOT EXISTS employee_kbs_employee_kb_unique
  ON employee_knowledge_bases (employee_id, knowledge_base_id);

-- 查询性能索引
CREATE INDEX IF NOT EXISTS missions_org_status_idx
  ON missions (organization_id, status);

CREATE INDEX IF NOT EXISTS mission_tasks_mission_status_idx
  ON mission_tasks (mission_id, status);

CREATE INDEX IF NOT EXISTS skill_usage_records_skill_created_idx
  ON skill_usage_records (skill_id, created_at);
```

**验证方法：**
```bash
npm run db:push  # 或手动执行 SQL
# 尝试插入重复的 (employee_id, skill_id) 记录，验证被拒绝
```

---

## 执行顺序总结

```
Phase 1（约 2-3 天）：
  1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.7 → 1.8 → 1.9 → 1.10
  (严格顺序，因为后续步骤依赖前面的 schema/type 变更)

Phase 2（约 3-4 天）：
  2.1 ──→ 2.2（依赖 2.1）
    ├──→ 2.3（依赖 2.1）
    ├──→ 2.4（依赖 2.1）
    └──→ 2.5（依赖 2.1）
  2.6（独立）
  2.7（独立）
  2.8（独立）
  可并行：2.6, 2.7, 2.8 可与 2.1-2.5 同时进行

Phase 3（约 4-5 天）：
  3.1, 3.2（独立，依赖 Phase 1）
  3.3（独立，依赖 Phase 1）
  3.4, 3.5（独立，仅依赖 Phase 1）
  3.6 → 3.7 → 3.8（顺序，技能页面依赖前一个）
  3.9（依赖 Phase 2.1 的 mission-core.ts）
  可并行：3.1-3.5 可并行，3.6-3.8 顺序执行

Phase 4（约 2-3 天）：
  4.1（独立，仅需 Phase 1）
  4.2（独立）
  4.3（独立）
  4.4（独立，建议最后执行避免 migration 冲突）
  全部可并行

总计预估：11-15 个工作日
```

---

## 每阶段完成后的验证检查清单

### Phase 1 完成后
- [ ] `npx tsc --noEmit` 通过
- [ ] `npm run build` 通过
- [ ] Drizzle Studio 中可见新表 `mission_artifacts`
- [ ] 现有 Mission 数据未丢失，新字段默认值正确
- [ ] DAL 返回的类型包含新字段

### Phase 2 完成后
- [ ] `npx tsc --noEmit` 通过
- [ ] 创建 Mission 全流程正常（leader plan → execute → consolidate）
- [ ] 含循环依赖的 DAG 被拒绝并降级
- [ ] Token 预算耗尽时执行中止并降级交付
- [ ] `cancelMission` 验证组织归属
- [ ] 重复绑定技能不产生重复记录

### Phase 3 完成后
- [ ] `npm run build` 通过
- [ ] `/skills` 页面可正常浏览
- [ ] `/skills/[id]` 页面显示详情和使用统计
- [ ] 员工市场搜索和排序正常工作
- [ ] 任务归档、删除、重新执行正常
- [ ] 看板卡片可展开查看完整输出
- [ ] Mission 执行后 skill_usage_records 有新记录

### Phase 4 完成后
- [ ] 所有 Server Action 跨组织操作被拒绝
- [ ] 插件注册内网 URL 被拒绝
- [ ] authKey 在数据库中以加密形式存储
- [ ] 唯一约束生效（重复插入报错）
- [ ] 员工状态守护定时任务注册成功

---

*文档结束*

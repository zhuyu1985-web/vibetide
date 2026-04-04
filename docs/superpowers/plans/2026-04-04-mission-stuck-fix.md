# Mission 任务卡住修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复任务中心中卡住的任务，添加超时机制和清理守护逻辑。

**Architecture:** 三层防护——Agent 调用级超时（3min）、Mission 流程级超时（15min）、外部清理守护（页面加载触发）。不改变执行架构，仅增强现有 Direct Execution 路径的健壮性。

**Tech Stack:** Next.js Server Actions, Drizzle ORM, AI SDK `generateText` AbortSignal, `next/server` `after()`

**Spec:** `docs/superpowers/specs/2026-04-04-mission-stuck-fix-design.md`

---

### Task 1: Agent 调用超时

**Files:**
- Modify: `src/lib/agent/execution.ts:72-89`

- [ ] **Step 1: 添加超时常量和 AbortSignal**

在 `executeAgent` 函数中，`generateText()` 调用处添加 `abortSignal`：

```typescript
// 在文件顶部，import 之后
const AGENT_TIMEOUT_MS = 3 * 60 * 1000; // 3 分钟（整个 agent 多步执行上限）
```

在 `generateText()` 调用中添加参数：

```typescript
const result = await generateText({
  model,
  system: agent.systemPrompt,
  messages: [{ role: "user", content: userMessage }],
  tools: vercelTools,
  stopWhen: stepCountIs(20),
  temperature: agent.modelConfig.temperature,
  maxOutputTokens: agent.modelConfig.maxTokens,
  abortSignal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
  onStepFinish: ({ toolCalls }) => {
    // ... 保持不变
  },
});
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/lib/agent/execution.ts
git commit -m "fix: add 3-minute AbortSignal timeout to agent execution"
```

---

### Task 2: Mission 级超时

**Files:**
- Modify: `src/lib/mission-executor.ts:337-493` (`executeAllTasksDirect`)
- Modify: `src/lib/mission-executor.ts:574-674` (`executeMissionDirect`)

- [ ] **Step 1: 添加超时常量**

在文件顶部（import 之后）添加：

```typescript
const MISSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 分钟
```

- [ ] **Step 2: 修改 `executeAllTasksDirect` 签名和超时检查**

添加 `missionStartTime` 参数，在 while 循环内（cancellation + budget 检查之后）添加超时检查：

```typescript
export async function executeAllTasksDirect(missionId: string, missionStartTime: number = Date.now()) {
```

在 `while (rounds < maxRounds) {` 循环内，budget 检查之后添加：

```typescript
    // Mission-level timeout check
    if (Date.now() - missionStartTime > MISSION_TIMEOUT_MS) {
      console.warn(`[mission-executor] Mission timeout after ${Math.round((Date.now() - missionStartTime) / 1000)}s`);
      await db.update(missionTasks)
        .set({ status: "failed", errorMessage: "任务整体执行超时（超过 15 分钟）" })
        .where(and(
          eq(missionTasks.missionId, missionId),
          inArray(missionTasks.status, ["pending", "ready"]),
        ));
      break;
    }
```

- [ ] **Step 3: 修改 `executeMissionDirect` 添加三阶段超时检查**

改写 `executeMissionDirect` 函数，记录开始时间并在各阶段前检查：

```typescript
export async function executeMissionDirect(
  missionId: string,
  organizationId: string
) {
  const missionStartTime = Date.now();

  function isMissionTimedOut() {
    return Date.now() - missionStartTime > MISSION_TIMEOUT_MS;
  }

  // Transition from queued → planning
  await db
    .update(missions)
    .set({ status: "planning", startedAt: new Date() })
    .where(eq(missions.id, missionId));

  // Phase 1: Leader planning
  const plan = await leaderPlanDirect(missionId, organizationId);

  // Phase 2: Execute all tasks (pass start time for timeout check)
  if (!isMissionTimedOut()) {
    await executeAllTasksDirect(missionId, missionStartTime);
  } else {
    console.warn(`[mission-executor] Mission ${missionId} timed out before task execution`);
    await db.update(missionTasks)
      .set({ status: "failed", errorMessage: "任务整体执行超时（超过 15 分钟）" })
      .where(and(
        eq(missionTasks.missionId, missionId),
        inArray(missionTasks.status, ["pending", "ready"]),
      ));
  }

  // Phase 3: 4-level degradation strategy
  const allTasks = await db
    .select({ id: missionTasks.id, status: missionTasks.status })
    .from(missionTasks)
    .where(eq(missionTasks.missionId, missionId));

  const totalCount = allTasks.length;
  const completedCount = allTasks.filter((t) => t.status === "completed").length;
  const failedCount = allTasks.filter((t) => t.status === "failed").length;
  const completionRate = totalCount > 0 ? completedCount / totalCount : 0;

  if (completionRate === 1) {
    // Level 1: 全部完成，正常汇总
    await leaderConsolidateDirect(missionId, organizationId);
    return { status: "completed", taskCount: plan.taskCount };
  } else if (completionRate >= 0.7) {
    // Level 2: 70%+ 完成，降级汇总
    if (!isMissionTimedOut()) {
      await leaderConsolidateDirect(missionId, organizationId);
    } else {
      // Timeout — use fallback consolidation
      const completedTaskTitles = await db
        .select({ title: missionTasks.title })
        .from(missionTasks)
        .where(and(eq(missionTasks.missionId, missionId), eq(missionTasks.status, "completed")));
      await db
        .update(missions)
        .set({
          status: "completed",
          completedAt: new Date(),
          finalOutput: {
            degradation_level: 2,
            message: `${completedCount}/${totalCount} 个子任务完成（汇总因超时跳过）`,
            completedTasks: completedTaskTitles.map((t) => t.title),
          },
        })
        .where(eq(missions.id, missionId));
    }
    await db
      .update(missions)
      .set({
        config: sql`jsonb_set(COALESCE(${missions.config}, '{}'::jsonb), '{degradation_level}', '2')`,
      })
      .where(eq(missions.id, missionId));
    return { status: "completed", taskCount: plan.taskCount, degradationLevel: 2, failedCount };
  } else if (completionRate >= 0.3) {
    // Level 3: 30%+ 完成，降级汇总 + 部分交付
    try {
      if (isMissionTimedOut()) throw new Error("任务整体超时，跳过汇总");
      await leaderConsolidateDirect(missionId, organizationId);
    } catch (err) {
      const completedTaskTitles = await db
        .select({ title: missionTasks.title })
        .from(missionTasks)
        .where(and(eq(missionTasks.missionId, missionId), eq(missionTasks.status, "completed")));
      await db
        .update(missions)
        .set({
          status: "completed",
          completedAt: new Date(),
          finalOutput: {
            degradation_level: 3,
            message: `${completedCount}/${totalCount} 个子任务完成，部分交付（${err instanceof Error ? err.message : String(err)}）`,
            completedTasks: completedTaskTitles.map((t) => t.title),
          },
        })
        .where(eq(missions.id, missionId));
    }
    await db
      .update(missions)
      .set({
        config: sql`jsonb_set(COALESCE(${missions.config}, '{}'::jsonb), '{degradation_level}', '3')`,
      })
      .where(eq(missions.id, missionId));
    return { status: "completed", taskCount: plan.taskCount, degradationLevel: 3, failedCount };
  } else {
    // Level 4: <30% 完成，标记失败（不变）
    const failedTasks = await db
      .select({ title: missionTasks.title, errorMessage: missionTasks.errorMessage })
      .from(missionTasks)
      .where(and(eq(missionTasks.missionId, missionId), eq(missionTasks.status, "failed")));

    const failureReasons = failedTasks
      .filter((t) => t.errorMessage)
      .map((t) => `${t.title}: ${t.errorMessage}`)
      .slice(0, 5);

    await db
      .update(missions)
      .set({
        status: "failed",
        completedAt: new Date(),
        finalOutput: {
          error: true,
          message: `任务完成率过低（${completedCount}/${totalCount}），${failedCount} 个子任务失败`,
          degradation_level: 4,
          failedAt: new Date().toISOString(),
          failureReasons,
        },
      })
      .where(eq(missions.id, missionId));
    return { status: "failed", taskCount: plan.taskCount, failedCount };
  }
}
```

- [ ] **Step 4: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add src/lib/mission-executor.ts
git commit -m "fix: add 15-minute mission-level timeout across all execution phases"
```

---

### Task 3: 清理 API + 员工守护

**Files:**
- Modify: `src/app/actions/missions.ts:277-291` (删除 `retryStuckMissions`，新增 `cleanupStuckMissions` 和 `resetStaleEmployees`)

- [ ] **Step 1: 删除 `retryStuckMissions` 函数**

删除 `src/app/actions/missions.ts` 中的 `retryStuckMissions` 函数（约行 277-291）。

- [ ] **Step 2: 添加 `resetStaleEmployees` 函数**

在 `src/app/actions/missions.ts` 文件末尾添加：

```typescript
/**
 * 重置卡在 working 状态超过 10 分钟的员工，并将其 in_progress 任务标记为失败。
 */
async function resetStaleEmployees(orgId: string) {
  const staleThreshold = new Date(Date.now() - 10 * 60 * 1000); // 10 分钟

  const staleEmployees = await db
    .select({ id: aiEmployees.id })
    .from(aiEmployees)
    .where(
      and(
        eq(aiEmployees.organizationId, orgId),
        eq(aiEmployees.status, "working"),
        lt(aiEmployees.updatedAt, staleThreshold)
      )
    );

  if (staleEmployees.length === 0) return 0;

  const staleEmpIds = staleEmployees.map((e) => e.id);

  // 将 in_progress 的子任务标记为失败
  await db
    .update(missionTasks)
    .set({
      status: "failed",
      errorMessage: "任务执行超时，已被系统自动终止",
    })
    .where(
      and(
        inArray(missionTasks.assignedEmployeeId, staleEmpIds),
        eq(missionTasks.status, "in_progress")
      )
    );

  // 重置员工状态
  for (const emp of staleEmployees) {
    await db
      .update(aiEmployees)
      .set({ status: "idle", currentTask: null, updatedAt: new Date() })
      .where(eq(aiEmployees.id, emp.id));
  }

  return staleEmployees.length;
}
```

注意：需要在文件顶部的 import 中添加 `missionTasks` 和 `lt`、`inArray`：

```typescript
import { missions, aiEmployees, missionTasks } from "@/db/schema";
import { eq, and, lt, inArray, sql } from "drizzle-orm";
```

- [ ] **Step 3: 添加 `cleanupStuckMissions` 函数**

在 `resetStaleEmployees` 之后添加：

```typescript
/**
 * 检测并恢复卡住的任务（页面加载时自动调用）。
 * 执行顺序：先清理员工 → 再清理 mission。
 */
export async function cleanupStuckMissions() {
  const orgId = await getCurrentUserOrg();
  if (!orgId) return;

  // Step 1: 清理卡住的员工和子任务
  await resetStaleEmployees(orgId);

  const now = new Date();

  // Step 2: Planning 卡住 — status=planning, 无子任务, 创建超过 3 分钟
  const planningThreshold = new Date(now.getTime() - 3 * 60 * 1000);
  const stuckPlanning = await db
    .select({ id: missions.id })
    .from(missions)
    .where(
      and(
        eq(missions.organizationId, orgId),
        eq(missions.status, "planning"),
        lt(missions.createdAt, planningThreshold)
      )
    );

  for (const m of stuckPlanning) {
    const taskCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(missionTasks)
      .where(eq(missionTasks.missionId, m.id));

    if (Number(taskCount[0]?.count ?? 0) === 0) {
      await db
        .update(missions)
        .set({
          status: "failed",
          completedAt: now,
          finalOutput: { error: true, message: "任务规划超时，未能生成子任务", failedAt: now.toISOString() },
        })
        .where(eq(missions.id, m.id));
    }
  }

  // Step 3: Executing 卡住 — 子任务最后活动超过 18 分钟
  const executingThreshold = new Date(now.getTime() - 18 * 60 * 1000);
  const stuckExecuting = await db
    .select({ id: missions.id })
    .from(missions)
    .where(
      and(
        eq(missions.organizationId, orgId),
        eq(missions.status, "executing")
      )
    );

  for (const m of stuckExecuting) {
    // 取子任务的最后活动时间
    const lastActivity = await db
      .select({
        lastTime: sql<Date>`MAX(COALESCE(${missionTasks.completedAt}, ${missionTasks.startedAt}))`,
      })
      .from(missionTasks)
      .where(eq(missionTasks.missionId, m.id));

    const lastTime = lastActivity[0]?.lastTime;
    if (!lastTime || new Date(lastTime) < executingThreshold) {
      // 将剩余活跃子任务标记失败
      await db
        .update(missionTasks)
        .set({ status: "failed", errorMessage: "任务执行超时，已被系统清理终止" })
        .where(
          and(
            eq(missionTasks.missionId, m.id),
            inArray(missionTasks.status, ["pending", "ready", "in_progress"])
          )
        );

      // 走降级汇总
      const allTasks = await db
        .select({ status: missionTasks.status, title: missionTasks.title })
        .from(missionTasks)
        .where(eq(missionTasks.missionId, m.id));

      const completedCount = allTasks.filter((t) => t.status === "completed").length;
      const totalCount = allTasks.length;

      await db
        .update(missions)
        .set({
          status: completedCount > 0 ? "completed" : "failed",
          completedAt: now,
          finalOutput: completedCount > 0
            ? {
                degradation_level: completedCount / totalCount >= 0.3 ? 3 : 4,
                message: `${completedCount}/${totalCount} 个子任务完成（执行超时，系统自动清理）`,
                completedTasks: allTasks.filter((t) => t.status === "completed").map((t) => t.title),
              }
            : {
                error: true,
                message: `所有子任务均未完成（执行超时，系统自动清理）`,
                failedAt: now.toISOString(),
              },
        })
        .where(eq(missions.id, m.id));
    }
  }

  // Step 4: Consolidating 卡住 — startedAt 超过 5 分钟（近似用 mission 的 startedAt 无法精确判断，
  // 但 consolidating 阶段通常在 executing 完成后立即开始，所以用 createdAt + 宽裕时间兜底）
  const consolidatingThreshold = new Date(now.getTime() - 5 * 60 * 1000);
  const stuckConsolidating = await db
    .select({ id: missions.id })
    .from(missions)
    .where(
      and(
        eq(missions.organizationId, orgId),
        eq(missions.status, "consolidating")
      )
    );

  for (const m of stuckConsolidating) {
    // 检查最后子任务完成时间是否超过 5 分钟（即进入 consolidating 已超过 5 分钟）
    const lastCompletion = await db
      .select({ lastTime: sql<Date>`MAX(${missionTasks.completedAt})` })
      .from(missionTasks)
      .where(eq(missionTasks.missionId, m.id));

    const lastTime = lastCompletion[0]?.lastTime;
    if (!lastTime || new Date(lastTime) < consolidatingThreshold) {
      const completedTasks = await db
        .select({ title: missionTasks.title })
        .from(missionTasks)
        .where(and(eq(missionTasks.missionId, m.id), eq(missionTasks.status, "completed")));

      await db
        .update(missions)
        .set({
          status: "completed",
          completedAt: now,
          finalOutput: {
            degradation_level: 3,
            message: `${completedTasks.length} 个子任务完成（汇总超时，系统自动生成摘要）`,
            completedTasks: completedTasks.map((t) => t.title),
          },
        })
        .where(eq(missions.id, m.id));
    }
  }

  // Step 5: 也处理 queued 卡住 — status=queued, 创建超过 3 分钟
  const stuckQueued = await db
    .select({ id: missions.id })
    .from(missions)
    .where(
      and(
        eq(missions.organizationId, orgId),
        eq(missions.status, "queued"),
        lt(missions.createdAt, planningThreshold)
      )
    );

  for (const m of stuckQueued) {
    await db
      .update(missions)
      .set({
        status: "failed",
        completedAt: now,
        finalOutput: { error: true, message: "任务排队超时，未能启动执行", failedAt: now.toISOString() },
      })
      .where(eq(missions.id, m.id));
  }
}
```

- [ ] **Step 4: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/missions.ts
git commit -m "fix: add cleanupStuckMissions and resetStaleEmployees, remove retryStuckMissions"
```

---

### Task 4: 页面集成清理调用

**Files:**
- Modify: `src/app/(dashboard)/missions/page.tsx`

- [ ] **Step 1: 替换 retryStuckMissions 调用为 cleanupStuckMissions**

将 `page.tsx` 完整改写为：

```typescript
import { getMissionsWithActiveTasks } from "@/lib/dal/missions";
import { MissionsClient } from "./missions-client";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { cleanupStuckMissions } from "@/app/actions/missions";
import { after } from "next/server";

export const dynamic = "force-dynamic";

export default async function MissionsPage() {
  const orgId = await getCurrentUserOrg();

  const missions = orgId ? await getMissionsWithActiveTasks(orgId) : [];

  // 异步清理卡住的任务和员工（不阻塞页面渲染）
  after(async () => {
    await cleanupStuckMissions().catch((err) => {
      console.error("[missions:cleanup]", err);
    });
  });

  return (
    <MissionsClient missions={missions} />
  );
}
```

- [ ] **Step 2: 类型检查**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 构建验证**

Run: `npm run build`
Expected: 构建成功

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/missions/page.tsx
git commit -m "fix: wire cleanupStuckMissions into missions page via after()"
```

---

### Task 5: 最终验证

- [ ] **Step 1: 完整类型检查**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 2: 生产构建**

Run: `npm run build`
Expected: 构建成功无错误

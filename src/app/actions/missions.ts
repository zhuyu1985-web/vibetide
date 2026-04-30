"use server";

import { db } from "@/db";
import {
  missions,
  aiEmployees,
  missionTasks,
  executionLogs,
  articles,
  verificationRecords,
  auditRecords,
  channelMessages,
  skillUsageRecords,
} from "@/db/schema";
import { eq, and, lt, inArray, sql, gte } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { executeMissionDirect } from "@/lib/mission-executor";
import { getWorkflowTemplateByLegacyKey } from "@/lib/dal/workflow-templates";
import { inngest } from "@/inngest/client";

// Soft dedup window for direct user-submitted missions. Two inserts with the
// same org + title + instruction within this window return the existing row
// instead of creating a second one. Guards against double-click / keyboard-
// Enter races that slip past the UI `disabled` guard.
const USER_DEDUP_WINDOW_MS = 8_000;
/**
 * Resolve (or auto-provision) the dedicated "任务总监" employee (slug="leader")
 * for a given organization.
 *
 * Leader identity must be STABLE — the leader coordinates the mission, so it
 * has to be a singleton per org regardless of which workflow template the
 * user runs. Prior code in `workflow-launch.ts` conflated this with the
 * template's `ownerEmployeeId`, which caused the leader badge to land on
 * whichever employee happened to "own" the template (e.g. 内容创作师 for
 * 科技周报, 热点猎手 for 每日时政热点) — i.e. "whoever is first up to do
 * work", exactly the regression the user reported.
 *
 * Exported so every mission-creating entrypoint uses the same source of truth.
 */
export async function getOrProvisionLeader(
  organizationId: string,
): Promise<typeof aiEmployees.$inferSelect> {
  const existing = await db.query.aiEmployees.findFirst({
    where: and(
      eq(aiEmployees.slug, "leader"),
      eq(aiEmployees.organizationId, organizationId),
    ),
  });
  if (existing) return existing;

  // Race-safe provisioning via the unique index (organization_id, slug).
  const [created] = await db
    .insert(aiEmployees)
    .values({
      organizationId,
      slug: "leader",
      name: "任务总监",
      nickname: "小领",
      title: "智能项目管理与任务调度",
      motto: "统筹全局，高效协作",
      roleType: "manager",
      authorityLevel: "coordinator",
      status: "idle",
      isPreset: 1,
    })
    .onConflictDoNothing({
      target: [aiEmployees.organizationId, aiEmployees.slug],
    })
    .returning();
  if (created) return created;

  // Lost the insert race — another caller just provisioned. Re-read.
  const afterRace = await db.query.aiEmployees.findFirst({
    where: and(
      eq(aiEmployees.slug, "leader"),
      eq(aiEmployees.organizationId, organizationId),
    ),
  });
  if (!afterRace) throw new Error("Failed to provision leader employee");
  return afterRace;
}

/**
 * B.1 Unified Scenario Workflow — resolve the `workflow_template_id` for a mission.
 *
 * Priority:
 *   1. If caller passes `explicitId`, use it directly.
 *   2. Otherwise, if `scenarioSlug` matches a row via `legacy_scenario_key`, return that template.id.
 *   3. Otherwise return null (custom scenarios / unmapped legacy keys).
 *
 * This helper is pure (no auth dependency) so it can be unit-tested in isolation and
 * reused by both `startMission` and `startMissionFromModule`.
 */
export async function resolveWorkflowTemplateId(
  organizationId: string,
  scenarioSlug: string | undefined,
  explicitId: string | undefined,
): Promise<string | null> {
  if (explicitId) return explicitId;
  if (!scenarioSlug) return null;
  const tmpl = await getWorkflowTemplateByLegacyKey(organizationId, scenarioSlug);
  return tmpl?.id ?? null;
}

/**
 * Start a new Mission: creates DB record then executes directly.
 *
 * Uses direct execution by default (does not depend on Inngest dev server).
 * Falls back gracefully if AI execution fails.
 */
export async function startMission(data: {
  title: string;
  scenario: string;
  userInstruction: string;
  /**
   * B.1 Unified Scenario Workflow: optional explicit template id. If omitted,
   * we try to resolve it from `scenario` via `legacy_scenario_key`. Falls back
   * to null for custom scenarios that have no matching template.
   */
  workflowTemplateId?: string;
}) {
  await requireAuth();

  const organizationId = await getCurrentUserOrg();
  if (!organizationId) {
    throw new Error("User has no organization. Please complete setup first.");
  }

  const leader = await getOrProvisionLeader(organizationId);

  // Soft dedup: if the same user submitted an identical mission in the last
  // USER_DEDUP_WINDOW_MS ms, return that one instead of creating a second.
  const windowStart = new Date(Date.now() - USER_DEDUP_WINDOW_MS);
  const recentDuplicate = await db.query.missions.findFirst({
    where: and(
      eq(missions.organizationId, organizationId),
      eq(missions.title, data.title),
      eq(missions.userInstruction, data.userInstruction),
      gte(missions.createdAt, windowStart),
    ),
  });
  if (recentDuplicate) {
    return recentDuplicate;
  }

  // Resolve workflow template id (explicit wins; else look up by legacy key).
  const resolvedTemplateId = await resolveWorkflowTemplateId(
    organizationId,
    data.scenario,
    data.workflowTemplateId,
  );

  // Create mission record (queued → planning → executing lifecycle)
  const [mission] = await db
    .insert(missions)
    .values({
      organizationId,
      title: data.title,
      scenario: data.scenario,
      userInstruction: data.userInstruction,
      leaderEmployeeId: leader.id,
      status: "queued",
      workflowTemplateId: resolvedTemplateId,
    })
    .returning();

  revalidatePath("/missions");

  // Fire-and-forget: start execution without blocking the response.
  // Using a detached promise instead of after() — after() is unreliable for
  // long-running work (LLM calls can take minutes, exceeding callback limits).
  executeMissionDirect(mission.id, organizationId)
    .then(() => console.log(`[mission] ${mission.id} completed successfully`))
    .catch(async (err) => {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[mission] ${mission.id} failed:`, err);
      await db.update(missions).set({
        status: "failed",
        completedAt: new Date(),
        finalOutput: { error: true, message: errorMsg, failedAt: new Date().toISOString() },
      }).where(eq(missions.id, mission.id)).catch(() => {});
    });

  return mission;
}

/**
 * Start a mission triggered from another module (hot topics, publishing, benchmarking, etc.).
 * Does NOT require user auth — can be called from Inngest background jobs.
 */
export async function startMissionFromModule(data: {
  organizationId: string;
  title: string;
  scenario: string;
  userInstruction: string;
  sourceModule: string;
  sourceEntityId?: string;
  sourceEntityType?: string;
  sourceContext?: Record<string, unknown>;
  /**
   * B.1 Unified Scenario Workflow: optional explicit template id. If omitted,
   * we try to resolve it from `scenario` via `legacy_scenario_key`.
   */
  workflowTemplateId?: string;
}) {
  const leader = await getOrProvisionLeader(data.organizationId);

  const instruction = data.sourceContext
    ? `${data.userInstruction}\n\n来源上下文：\n${JSON.stringify(data.sourceContext, null, 2)}`
    : data.userInstruction;

  // Resolve workflow template id (explicit wins; else look up by legacy key).
  const resolvedTemplateId = await resolveWorkflowTemplateId(
    data.organizationId,
    data.scenario,
    data.workflowTemplateId,
  );

  const [mission] = await db
    .insert(missions)
    .values({
      organizationId: data.organizationId,
      title: data.title,
      scenario: data.scenario,
      userInstruction: instruction,
      leaderEmployeeId: leader.id,
      status: "queued",
      sourceModule: data.sourceModule,
      sourceEntityId: data.sourceEntityId,
      sourceEntityType: data.sourceEntityType,
      workflowTemplateId: resolvedTemplateId,
    })
    .returning();

  revalidatePath("/missions");

  executeMissionDirect(mission.id, data.organizationId)
    .then(() => console.log(`[mission:${data.sourceModule}] ${mission.id} completed`))
    .catch(async (err) => {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[mission:${data.sourceModule}] ${mission.id} failed:`, err);
      await db.update(missions).set({
        status: "failed",
        completedAt: new Date(),
        finalOutput: { error: true, message: errorMsg, failedAt: new Date().toISOString() },
      }).where(eq(missions.id, mission.id)).catch(() => {});
    });

  return mission;
}

/**
 * 归档已完成/失败的任务（使用 config JSON 标记）
 */
export async function archiveMission(missionId: string) {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("无法获取组织信息");

  const mission = await db.query.missions.findFirst({
    where: and(eq(missions.id, missionId), eq(missions.organizationId, orgId)),
  });
  if (!mission) throw new Error("任务不存在或无权操作");
  if (!["completed", "failed", "cancelled"].includes(mission.status)) {
    throw new Error("只能归档已完成、失败或已取消的任务");
  }

  const currentConfig = mission.config ?? { max_retries: 3, task_timeout: 300, max_agents: 8 };
  await db
    .update(missions)
    .set({
      config: { ...currentConfig, archived: true, archivedAt: new Date().toISOString() },
    })
    .where(eq(missions.id, missionId));

  revalidatePath("/missions");
}

/**
 * 永久删除任务（CASCADE 自动清理 tasks, messages, artifacts）
 */
export async function deleteMission(missionId: string) {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("无法获取组织信息");

  const mission = await db.query.missions.findFirst({
    where: and(eq(missions.id, missionId), eq(missions.organizationId, orgId)),
  });
  if (!mission) throw new Error("任务不存在或无权操作");
  if (["executing", "consolidating", "coordinating"].includes(mission.status)) {
    throw new Error("不能删除运行中的任务，请先取消");
  }

  // Null out FK references from non-cascading tables first (see
  // deleteMissions for full rationale).
  const taskIdRows = await db
    .select({ id: missionTasks.id })
    .from(missionTasks)
    .where(eq(missionTasks.missionId, missionId));
  const taskIds = taskIdRows.map((r) => r.id);

  await db.update(executionLogs).set({ missionId: null }).where(eq(executionLogs.missionId, missionId));
  await db.update(articles).set({ missionId: null }).where(eq(articles.missionId, missionId));
  await db.update(verificationRecords).set({ missionId: null }).where(eq(verificationRecords.missionId, missionId));
  await db.update(auditRecords).set({ missionId: null }).where(eq(auditRecords.missionId, missionId));
  if (taskIds.length > 0) {
    await db.update(verificationRecords).set({ taskId: null }).where(inArray(verificationRecords.taskId, taskIds));
    await db.update(executionLogs).set({ missionTaskId: null }).where(inArray(executionLogs.missionTaskId, taskIds));
  }

  await db.delete(missions).where(eq(missions.id, missionId));
  revalidatePath("/missions");
}

/**
 * 批量永久删除任务。只有当前组织的、处于终态（非运行中）的任务会被删除；
 * 运行中的任务会被跳过并在返回值里汇总。CASCADE 自动清理子表。
 */
// `queued` / `planning` are included because these missions often get stuck
// (leader plan step times out, API call fails) without progressing to a
// terminal state. Actively running statuses remain blocked to avoid deleting
// missions mid-execution.
const DELETABLE_STATUSES = [
  "completed",
  "failed",
  "cancelled",
  "queued",
  "planning",
] as const;

export async function deleteMissions(missionIds: string[]): Promise<{
  deletedCount: number;
  skipped: { id: string; reason: string }[];
}> {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("无法获取组织信息");
  if (missionIds.length === 0) return { deletedCount: 0, skipped: [] };

  // Scope to the current org and pull current status in one round-trip.
  const rows = await db
    .select({ id: missions.id, status: missions.status })
    .from(missions)
    .where(
      and(
        inArray(missions.id, missionIds),
        eq(missions.organizationId, orgId),
      ),
    );

  const foundIds = new Set(rows.map((r) => r.id));
  const skipped: { id: string; reason: string }[] = [];
  const deletableIds: string[] = [];

  for (const id of missionIds) {
    if (!foundIds.has(id)) {
      skipped.push({ id, reason: "不存在或无权操作" });
      continue;
    }
  }
  for (const r of rows) {
    if (DELETABLE_STATUSES.includes(r.status as (typeof DELETABLE_STATUSES)[number])) {
      deletableIds.push(r.id);
    } else {
      skipped.push({ id: r.id, reason: "运行中任务不能删除" });
    }
  }

  if (deletableIds.length > 0) {
    // Null out every table that might FK to missions.id without ON DELETE
    // CASCADE. Defensive: we include tables that have ON DELETE SET NULL or
    // no FK at all (skill_usage_records) so orphaned references don't leak
    // stale UUIDs. Wrapped in a transaction so a failure on any step rolls
    // back everything.
    try {
      await db.transaction(async (tx) => {
        // Collect task IDs belonging to the missions we're about to delete so
        // we can null out non-cascading FKs from verification_records and
        // execution_logs. Without this, CASCADE delete of mission_tasks fails
        // because verification_records.task_id and execution_logs.mission_task_id
        // have no ON DELETE action.
        const taskIdRows = await tx
          .select({ id: missionTasks.id })
          .from(missionTasks)
          .where(inArray(missionTasks.missionId, deletableIds));
        const taskIds = taskIdRows.map((r) => r.id);

        await tx.update(executionLogs).set({ missionId: null }).where(inArray(executionLogs.missionId, deletableIds));
        await tx.update(articles).set({ missionId: null }).where(inArray(articles.missionId, deletableIds));
        await tx.update(verificationRecords).set({ missionId: null }).where(inArray(verificationRecords.missionId, deletableIds));
        await tx.update(auditRecords).set({ missionId: null }).where(inArray(auditRecords.missionId, deletableIds));
        await tx.update(channelMessages).set({ missionId: null }).where(inArray(channelMessages.missionId, deletableIds));
        await tx.update(skillUsageRecords).set({ missionId: null }).where(inArray(skillUsageRecords.missionId, deletableIds));
        if (taskIds.length > 0) {
          await tx.update(verificationRecords).set({ taskId: null }).where(inArray(verificationRecords.taskId, taskIds));
          await tx.update(executionLogs).set({ missionTaskId: null }).where(inArray(executionLogs.missionTaskId, taskIds));
        }

        await tx.delete(missions).where(inArray(missions.id, deletableIds));
      });
    } catch (err) {
      // Surface the ACTUAL postgres error (not Drizzle's opaque wrapper) so
      // we can see which FK constraint is blocking. Drizzle's DrizzleQueryError
      // stores the underlying pg error on `.cause`.
      const cause = (err as { cause?: { message?: string; detail?: string; constraint?: string } }).cause;
      const detail = cause?.detail || cause?.message || (err instanceof Error ? err.message : String(err));
      console.error("[deleteMissions] DB error:", detail, "constraint:", cause?.constraint);
      throw new Error(`删除失败：${cause?.constraint ?? ""} ${detail}`.trim());
    }
    revalidatePath("/missions");
  }

  return { deletedCount: deletableIds.length, skipped };
}

/**
 * Pre-flight check for "new mission" UX: returns the most-recent in-flight
 * mission (queued / planning / executing) that uses the same workflow template
 * for the current user's org. UI uses this to warn the user before launching
 * a duplicate run, while still letting them proceed intentionally (e.g. same
 * template with different input parameters).
 *
 * Returns null when there is no active run.
 */
export async function findActiveMissionByTemplate(
  workflowTemplateId: string,
): Promise<{ id: string; title: string; status: string; createdAt: string } | null> {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) return null;

  const row = await db.query.missions.findFirst({
    where: and(
      eq(missions.organizationId, orgId),
      eq(missions.workflowTemplateId, workflowTemplateId),
      inArray(missions.status, ["queued", "planning", "executing"]),
    ),
    orderBy: (m, { desc }) => [desc(m.createdAt)],
    columns: { id: true, title: true, status: true, createdAt: true },
  });
  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * 重新执行已终止的任务（创建新 Mission，复制原始参数）
 */
export async function retryMission(missionId: string) {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("无法获取组织信息");

  const original = await db.query.missions.findFirst({
    where: and(eq(missions.id, missionId), eq(missions.organizationId, orgId)),
  });
  if (!original) throw new Error("任务不存在或无权操作");
  if (!["completed", "failed", "cancelled"].includes(original.status)) {
    throw new Error("只能重新执行已终止的任务");
  }

  return startMission({
    title: `${original.title}（重新执行）`,
    scenario: original.scenario,
    userInstruction: original.userInstruction,
    // 关键：保留原 mission 的工作流模板，否则重试会丢模板，
    // 走 LLM 分解或派工兜底（5 步全砸 leader），跟首次执行体验完全不一致。
    workflowTemplateId: original.workflowTemplateId ?? undefined,
  });
}

/**
 * Cancel a running mission.
 */
export async function cancelMission(missionId: string) {
  const user = await requireAuth();

  const organizationId = await getCurrentUserOrg();
  if (!organizationId) throw new Error("用户未关联组织");

  // 验证 mission 属于当前组织
  const mission = await db.query.missions.findFirst({
    where: and(eq(missions.id, missionId), eq(missions.organizationId, organizationId)),
  });
  if (!mission) throw new Error("任务不存在或无权操作");

  await db
    .update(missions)
    .set({
      status: "cancelled",
      completedAt: new Date(),
    })
    .where(eq(missions.id, missionId));

  revalidatePath("/missions");
  revalidatePath(`/missions/${missionId}`);
}

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
          status: "failed",
          completedAt: now,
          finalOutput: completedCount > 0
            ? {
                error: true,
                degradation_level: completedCount / totalCount >= 0.3 ? 3 : 4,
                message: `${completedCount}/${totalCount} 个子任务完成（执行超时，系统自动清理）`,
                completedTasks: allTasks.filter((t) => t.status === "completed").map((t) => t.title),
                failedAt: now.toISOString(),
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

  // Step 4: Consolidating 卡住 — 子任务最后完成超过 5 分钟
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
          status: "failed",
          completedAt: now,
          finalOutput: {
            error: true,
            degradation_level: 3,
            message: `${completedTasks.length} 个子任务完成（汇总超时，系统自动生成摘要）`,
            completedTasks: completedTasks.map((t) => t.title),
            failedAt: now.toISOString(),
          },
        })
        .where(eq(missions.id, m.id));
    }
  }

  // Step 5: Queued 卡住 — status=queued, 创建超过 3 分钟
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

/**
 * 重试单个失败的子任务（chat-center 内联重试入口）。
 *
 * 仅 status=failed 的子任务可重试。重置为 ready → 清错误 → retryCount++ →
 * emit `mission/task-ready`，由 `executeMissionTask` Inngest 函数消费。
 *
 * 注：手动重试上限 = MAX_MANUAL_RETRIES（3 次）。配合 handle-task-failure
 * 的 MAX_RETRIES=2 自动重试，单子任务最多累积 5 次尝试，足够覆盖瞬时
 * 故障，又避免无界重试形成死循环。
 */
const MAX_MANUAL_RETRIES = 3;

export async function retryMissionTask(taskId: string) {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("无法获取组织信息");

  const task = await db.query.missionTasks.findFirst({
    where: eq(missionTasks.id, taskId),
  });
  // 任务不存在 / 不属于当前组织 都返回同一句模糊错误，避免向未授权调用者
  // 泄露 task 是否存在的信号（与同文件 archiveMission/deleteMission 对齐）。
  if (!task) throw new Error("任务不存在或无权操作");

  const mission = await db.query.missions.findFirst({
    where: and(
      eq(missions.id, task.missionId),
      eq(missions.organizationId, orgId),
    ),
  });
  if (!mission) throw new Error("任务不存在或无权操作");

  if (task.status !== "failed") {
    throw new Error("只能重试失败的任务");
  }

  // I1: 手动重试上限。复用现有 retryCount 字段（含自动重试与手动重试），
  // 简单可控；超出时给用户清晰指引而不是静默吞掉。
  if ((task.retryCount ?? 0) >= MAX_MANUAL_RETRIES) {
    throw new Error(
      `已达到最大重试次数（${MAX_MANUAL_RETRIES} 次），请联系管理员或查看错误日志`,
    );
  }

  await db
    .update(missionTasks)
    .set({
      status: "ready",
      errorMessage: null,
      retryCount: (task.retryCount ?? 0) + 1,
      startedAt: null,
      completedAt: null,
    })
    .where(eq(missionTasks.id, taskId));

  // I2: Inngest 投递失败回滚 status=failed，避免任务卡在 ready 永不被消费。
  // 注意 retryCount 不回滚 —— 保留递增可阻止 Inngest 真正不可用时的紧密重试循环。
  try {
    await inngest.send({
      name: "mission/task-ready",
      data: {
        missionId: task.missionId,
        taskId: task.id,
        organizationId: orgId,
      },
    });
  } catch (err) {
    console.error("[retryMissionTask] inngest.send failed, rolling back:", err);
    await db
      .update(missionTasks)
      .set({ status: "failed", errorMessage: "重试事件投递失败，请稍后再试" })
      .where(eq(missionTasks.id, taskId));
    throw new Error("重试请求投递失败，请稍后再试");
  }

  // I3: 不再调 revalidatePath('/missions/[id]') —— chat-center 内联重试不导航，
  // SSE 推送即可刷新气泡；详情页再次进入时会自然 re-fetch，多余的失效只是
  // copy-paste 自 cancelMission 的旧惯性。
}

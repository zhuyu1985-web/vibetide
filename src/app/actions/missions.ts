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
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { executeMissionDirect } from "@/lib/mission-executor";

// Soft dedup window for direct user-submitted missions. Two inserts with the
// same org + title + instruction within this window return the existing row
// instead of creating a second one. Guards against double-click / keyboard-
// Enter races that slip past the UI `disabled` guard.
const USER_DEDUP_WINDOW_MS = 30_000;

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
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
}) {
  await requireAuth();

  const organizationId = await getCurrentUserOrg();
  if (!organizationId) {
    throw new Error("User has no organization. Please complete setup first.");
  }

  // Find the leader employee in the user's organization
  let leader = await db.query.aiEmployees.findFirst({
    where: and(
      eq(aiEmployees.slug, "leader"),
      eq(aiEmployees.organizationId, organizationId)
    ),
  });

  // Auto-provision leader if missing in this organization. Use onConflict to
  // win any race against concurrent provisioning requests — the unique index
  // `ai_employees_org_slug_uidx` guarantees we never create two leaders.
  if (!leader) {
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
    if (created) {
      leader = created;
    } else {
      // Lost the race — another request just created the leader. Re-read.
      leader = await db.query.aiEmployees.findFirst({
        where: and(
          eq(aiEmployees.slug, "leader"),
          eq(aiEmployees.organizationId, organizationId),
        ),
      });
      if (!leader) {
        throw new Error("Failed to provision leader employee");
      }
    }
  }

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
}) {
  // Find leader
  let leader = await db.query.aiEmployees.findFirst({
    where: and(
      eq(aiEmployees.slug, "leader"),
      eq(aiEmployees.organizationId, data.organizationId)
    ),
  });

  if (!leader) {
    const [created] = await db
      .insert(aiEmployees)
      .values({
        organizationId: data.organizationId,
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
    if (created) {
      leader = created;
    } else {
      leader = await db.query.aiEmployees.findFirst({
        where: and(
          eq(aiEmployees.slug, "leader"),
          eq(aiEmployees.organizationId, data.organizationId),
        ),
      });
      if (!leader) {
        throw new Error("Failed to provision leader employee");
      }
    }
  }

  const instruction = data.sourceContext
    ? `${data.userInstruction}\n\n来源上下文：\n${JSON.stringify(data.sourceContext, null, 2)}`
    : data.userInstruction;

  // Idempotency check: if a mission for the same (org, module, entity) already
  // exists, return it instead of creating a duplicate. This handles at-least-
  // once delivery from IM webhooks, Inngest event retries, etc. The partial
  // unique index `missions_source_dedup_uidx` provides belt-and-suspenders.
  if (data.sourceEntityId) {
    const existing = await db.query.missions.findFirst({
      where: and(
        eq(missions.organizationId, data.organizationId),
        eq(missions.sourceModule, data.sourceModule),
        eq(missions.sourceEntityId, data.sourceEntityId),
      ),
    });
    if (existing) {
      return existing;
    }
  }

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
  if (["queued", "planning", "executing", "consolidating", "coordinating"].includes(mission.status)) {
    throw new Error("不能删除运行中的任务，请先取消");
  }

  // Null out FK references from non-cascading tables first (see
  // deleteMissions for full rationale).
  await db.update(executionLogs).set({ missionId: null }).where(eq(executionLogs.missionId, missionId));
  await db.update(articles).set({ missionId: null }).where(eq(articles.missionId, missionId));
  await db.update(verificationRecords).set({ missionId: null }).where(eq(verificationRecords.missionId, missionId));
  await db.update(auditRecords).set({ missionId: null }).where(eq(auditRecords.missionId, missionId));

  await db.delete(missions).where(eq(missions.id, missionId));
  revalidatePath("/missions");
}

/**
 * 批量永久删除任务。只有当前组织的、处于终态（非运行中）的任务会被删除；
 * 运行中的任务会被跳过并在返回值里汇总。CASCADE 自动清理子表。
 */
const DELETABLE_STATUSES = [
  "completed",
  "failed",
  "cancelled",
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
        await tx.update(executionLogs).set({ missionId: null }).where(inArray(executionLogs.missionId, deletableIds));
        await tx.update(articles).set({ missionId: null }).where(inArray(articles.missionId, deletableIds));
        await tx.update(verificationRecords).set({ missionId: null }).where(inArray(verificationRecords.missionId, deletableIds));
        await tx.update(auditRecords).set({ missionId: null }).where(inArray(auditRecords.missionId, deletableIds));
        await tx.update(channelMessages).set({ missionId: null }).where(inArray(channelMessages.missionId, deletableIds));
        await tx.update(skillUsageRecords).set({ missionId: null }).where(inArray(skillUsageRecords.missionId, deletableIds));

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

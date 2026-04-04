"use server";

import { db } from "@/db";
import { missions, aiEmployees, missionTasks } from "@/db/schema";
import { eq, and, lt, inArray, sql } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { executeMissionDirect } from "@/lib/mission-executor";

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

  // Auto-provision leader if missing in this organization
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
      .returning();
    leader = created;
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
      .returning();
    leader = created;
  }

  const instruction = data.sourceContext
    ? `${data.userInstruction}\n\n来源上下文：\n${JSON.stringify(data.sourceContext, null, 2)}`
    : data.userInstruction;

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

  await db.delete(missions).where(eq(missions.id, missionId));
  revalidatePath("/missions");
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

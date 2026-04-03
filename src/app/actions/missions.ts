"use server";

import { db } from "@/db";
import { missions, aiEmployees } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { inngest } from "@/inngest/client";
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

  // Dual execution strategy: try Inngest (event-driven, with retries) first,
  // fall back to direct execution if Inngest is unavailable.
  after(async () => {
    try {
      await inngest.send({
        name: "mission/created",
        data: { missionId: mission.id, organizationId },
      });
      console.log(`[mission] ${mission.id} dispatched to Inngest`);
    } catch {
      // Inngest not available — fall back to direct execution
      console.log(`[mission] ${mission.id} Inngest unavailable, using direct execution`);
      try {
        await executeMissionDirect(mission.id, organizationId);
        console.log(`[mission] ${mission.id} completed successfully`);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[mission] ${mission.id} failed:`, err);
        await db.update(missions).set({
          status: "failed",
          completedAt: new Date(),
          finalOutput: { error: true, message: errorMsg, failedAt: new Date().toISOString() },
        }).where(eq(missions.id, mission.id)).catch(() => {});
      }
    }
  });

  revalidatePath("/missions");
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

  after(async () => {
    try {
      await inngest.send({
        name: "mission/created",
        data: { missionId: mission.id, organizationId: data.organizationId },
      });
    } catch {
      try {
        await executeMissionDirect(mission.id, data.organizationId);
        console.log(`[mission:${data.sourceModule}] ${mission.id} completed`);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[mission:${data.sourceModule}] ${mission.id} failed:`, err);
        await db.update(missions).set({
          status: "failed",
          completedAt: new Date(),
          finalOutput: { error: true, message: errorMsg, failedAt: new Date().toISOString() },
        }).where(eq(missions.id, mission.id)).catch(() => {});
      }
    }
  });

  revalidatePath("/missions");
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

  // Also fire Inngest event in case Inngest is running
  try {
    await inngest.send({
      name: "mission/cancelled",
      data: {
        missionId,
        cancelledBy: user.id,
      },
    });
  } catch {
    // Inngest not available, cancellation is handled by DB status update
  }

  revalidatePath("/missions");
  revalidatePath(`/missions/${missionId}`);
}

/**
 * Auto-retry a stuck mission (planning with 0 tasks for > 2 min).
 * Called from the missions list page on load as a self-healing mechanism.
 */
export async function retryStuckMissions(missionId: string) {
  const mission = await db.query.missions.findFirst({
    where: eq(missions.id, missionId),
  });
  if (!mission || !["queued", "planning"].includes(mission.status)) return;
  if (mission.tokensUsed > 0) return; // Already running

  console.log(`[mission:auto-retry] ${missionId} retrying stuck mission`);
  try {
    await executeMissionDirect(missionId, mission.organizationId);
  } catch (err) {
    console.error(`[mission:auto-retry] ${missionId} failed:`, err);
    await db.update(missions).set({ status: "failed" }).where(eq(missions.id, missionId)).catch(() => {});
  }
}

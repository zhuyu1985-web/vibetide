"use server";

/**
 * startAdHocMission —— cowork 化执行模型统一的核心新入口。
 *
 * 当意图识别判定 executionMode='skill'(单/多技能、无匹配 workflow 模板)时,
 * 把 `intent.steps` 直接物化成 mission + mission_tasks DAG,再 fire-and-forget
 * `executeMissionDirect`。`leaderPlanDirect` 检测到 mission 已有 tasks 会走
 * "pre-populated fast-path"(mission-executor.ts:139),跳过 LLM 分解 / 模板
 * materialize,信任这里构造的 DAG —— 与 hot-topics 的 startTopicMissionMulti 同款。
 *
 * 注意:此路径只 `executeMissionDirect`、不发 `mission/created` Inngest 事件,
 * 因此不会触发 Inngest leaderPlan 的 LLM 分解分支(那条没有 pre-populated 检测,
 * 会重复建 task)。
 */
import { db } from "@/db";
import { missions, missionTasks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { getOrProvisionLeader } from "@/app/actions/missions";
import { loadAvailableEmployees } from "@/lib/mission-core";
import { executeMissionDirect } from "@/lib/mission-executor";
import { buildAdHocTasks } from "@/lib/agent/intent-to-tasks";
import type { IntentStep } from "@/lib/agent/types";
import type { StartMissionResult } from "@/app/actions/workflow-launch";

export interface StartAdHocMissionInput {
  /** 用户原话 → mission.userInstruction(也是默认 title 来源) */
  message: string;
  /** 意图识别产出的步骤(空数组应在上游路由到自由聊天,不会进这里) */
  steps: IntentStep[];
  /** 显式标题;缺省取 message 截断 */
  title?: string;
  /** 意图摘要,落 inputParams.intentSummary 供展示 */
  summary?: string;
  /** 关联的 cowork 会话 / 项目 */
  conversationId?: string | null;
  projectId?: string | null;
}

export async function startAdHocMission(
  input: StartAdHocMissionInput,
): Promise<StartMissionResult> {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) return { ok: false, errors: { _global: "用户未关联组织" } };

  const steps = input.steps ?? [];
  if (steps.length === 0) {
    return { ok: false, errors: { _global: "无可执行步骤(应走自由聊天)" } };
  }

  const leader = await getOrProvisionLeader(orgId);
  const employees = await loadAvailableEmployees(orgId);
  const { tasks, teamMemberIds } = buildAdHocTasks(steps, employees, leader.id);

  const title =
    (input.title?.trim() || input.message.trim()).slice(0, 60) || "新任务";

  // 1. 插 mission(无 workflowTemplateId;ad-hoc 用 scenario="custom")
  const [mission] = await db
    .insert(missions)
    .values({
      organizationId: orgId,
      title,
      scenario: "custom",
      userInstruction: input.message,
      leaderEmployeeId: leader.id,
      status: "queued",
      teamMembers: teamMemberIds,
      inputParams: input.summary ? { intentSummary: input.summary } : {},
      projectId: input.projectId ?? null,
      conversationId: input.conversationId ?? null,
    })
    .returning({ id: missions.id });
  const missionId = mission.id;

  // 2. 手动物化 task DAG(dependsOnIndices → 已插入的 task id)
  const taskIds: string[] = [];
  for (const def of tasks) {
    const depIds = def.dependsOnIndices
      .map((i) => taskIds[i])
      .filter((v): v is string => Boolean(v));
    const [created] = await db
      .insert(missionTasks)
      .values({
        missionId,
        title: def.title,
        description: def.description,
        assignedEmployeeId: def.assignedEmployeeId,
        assignedRole: def.assignedRole,
        dependencies: depIds,
        priority: def.priority,
        status: "pending",
      })
      .returning({ id: missionTasks.id });
    taskIds.push(created.id);
  }

  revalidatePath("/missions");
  if (input.conversationId) revalidatePath(`/cowork/${input.conversationId}`);

  // 3. 触发 executor(fire-and-forget;走 leaderPlanDirect 的 pre-populated fast-path)
  executeMissionDirect(missionId, orgId)
    .then(() => console.log(`[ad-hoc] mission ${missionId} completed`))
    .catch(async (err) => {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[ad-hoc] mission ${missionId} failed:`, err);
      await db
        .update(missions)
        .set({
          status: "failed",
          completedAt: new Date(),
          finalOutput: {
            error: true,
            message: errorMsg,
            failedAt: new Date().toISOString(),
          },
        })
        .where(eq(missions.id, missionId))
        .catch(() => {});
    });

  return { ok: true, missionId };
}

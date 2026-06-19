/**
 * materializeAdHocMission —— 把 intent.steps 物化成 mission + task DAG，返回 missionId。
 *
 * 不含 requireAuth / getCurrentUserOrg（无登录态的渠道路径可直接传 orgId 调用）。
 * 不执行 executeMissionDirect（由调用方按需触发）。
 *
 * 抽自 startAdHocMission（src/app/actions/ad-hoc-mission.ts），去掉 "use server"
 * 约束后可从非 server action 文件（如渠道 Inngest 函数）复用。
 */
import { db } from "@/db";
import { missions, missionTasks } from "@/db/schema";
import { getOrProvisionLeader } from "@/app/actions/missions";
import { loadAvailableEmployees } from "@/lib/mission-core";
import { buildAdHocTasks } from "@/lib/agent/intent-to-tasks";
import type { IntentStep } from "@/lib/agent/types";

export interface MaterializeAdHocInput {
  /** 用户原话 → mission.userInstruction（也是默认 title 来源） */
  message: string;
  /** 意图识别产出的步骤 */
  steps: IntentStep[];
  /** 显式标题；缺省取 message 截断 */
  title?: string;
  /** 意图摘要，落 inputParams.intentSummary 供展示 */
  summary?: string;
  /** 关联的 cowork 会话 / 项目 */
  conversationId?: string | null;
  projectId?: string | null;
  /** 来源标识（如 "channel:dingtalk"），供 mission 溯源 */
  sourceModule?: string;
  /** 来源实体 id（如消息 id），配合 missions_source_dedup_uidx 去重 */
  sourceEntityId?: string;
}

/** 把 intent.steps 物化成 mission + task DAG，返回 missionId。不执行、不要 auth。 */
export async function materializeAdHocMission(
  orgId: string,
  input: MaterializeAdHocInput,
): Promise<{ missionId: string }> {
  const leader = await getOrProvisionLeader(orgId);
  const employees = await loadAvailableEmployees(orgId);
  const { tasks, teamMemberIds } = buildAdHocTasks(
    input.steps,
    employees,
    leader.id,
  );

  const title =
    (input.title?.trim() || input.message.trim()).slice(0, 60) || "新任务";

  // 1. 插 mission（无 workflowTemplateId；ad-hoc 用 scenario="custom"）
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
      ...(input.sourceModule ? { sourceModule: input.sourceModule } : {}),
      ...(input.sourceEntityId
        ? { sourceEntityId: input.sourceEntityId }
        : {}),
    })
    .returning({ id: missions.id });
  const missionId = mission.id;

  // 2. 手动物化 task DAG（dependsOnIndices → 已插入的 task id）
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

  return { missionId };
}

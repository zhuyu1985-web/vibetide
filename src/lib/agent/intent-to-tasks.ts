/**
 * intent-to-tasks —— 把意图识别产出的 `IntentStep[]` 物化成 ad-hoc mission 的
 * task 定义(纯函数,无 DB),供 `startAdHocMission` 写库前调用,也便于单测。
 *
 * 设计对齐 leader-plan 的"模板快路径 materialize"思路,但来源是 intent.steps:
 *   - employeeSlug → employee id(查不到回退 leader,保证 task 一定有 assignee)
 *   - skills[0] → assignedRole:执行期 `executeTaskDirect` 据此加载 SKILL.md +
 *     预执行工具(server 端真调,防 LLM 幻觉)
 *   - dependsOn(单个前置 step 下标)→ dependsOnIndices:仅保留合法后向依赖,
 *     前向 / 越界丢弃以防环;写库时由调用方映射成已插入的 task id
 */
import type { IntentStep } from "./types";

export interface AdHocTaskDef {
  title: string;
  description: string;
  /** 解析后的员工 id(一定非空:slug 命中或回退 leader) */
  assignedEmployeeId: string;
  /** 主技能 slug;执行期加载 SKILL.md + 预执行工具。无技能为 null(纯 LLM 步骤) */
  assignedRole: string | null;
  /** 依赖的前置 task 在本数组中的下标(写库时映射为 task id) */
  dependsOnIndices: number[];
  /**
   * 步骤序(1 起,越小越早)。与 mission 体系唯一语义对齐:模板路径写
   * step.order、leader 伪任务 pinned 0,执行器 `{{stepN}}` 渲染与所有
   * UI(mission console / cowork 面板)都按 priority **升序** = 执行顺序。
   * 曾按 hot-topics 习惯写"数值大=先",导致 cowork 步骤清单整体倒序。
   */
  priority: number;
}

export interface BuildAdHocTasksResult {
  tasks: AdHocTaskDef[];
  /** 去重后的 assignee id 集合,写入 mission.teamMembers */
  teamMemberIds: string[];
}

/** 单行化 + 截断,用作 task.title(完整文本仍进 description) */
function truncateTitle(s: string, max = 40): string {
  const oneLine = s.replace(/\s+/g, " ").trim();
  return oneLine.length <= max ? oneLine : oneLine.slice(0, max - 1) + "…";
}

export function buildAdHocTasks(
  steps: IntentStep[],
  employees: Array<{ id: string; slug: string }>,
  leaderEmployeeId: string,
): BuildAdHocTasksResult {
  const slugToId = new Map(employees.map((e) => [e.slug, e.id]));
  const teamMemberIds = new Set<string>();

  const tasks: AdHocTaskDef[] = steps.map((step, index) => {
    const assignedEmployeeId = slugToId.get(step.employeeSlug) ?? leaderEmployeeId;
    teamMemberIds.add(assignedEmployeeId);

    const assignedRole =
      step.skills?.map((s) => s.trim()).find((s) => s.length > 0) ?? null;

    // dependsOn 是单个前置 step 下标;只接受 [0, index) 的后向依赖,防止环 / 前向引用
    const dep = step.dependsOn;
    const dependsOnIndices =
      typeof dep === "number" && Number.isInteger(dep) && dep >= 0 && dep < index
        ? [dep]
        : [];

    const description =
      step.taskDescription?.trim() || step.employeeName || "执行任务";

    return {
      title: truncateTitle(description),
      description,
      assignedEmployeeId,
      assignedRole,
      dependsOnIndices,
      priority: index + 1,
    };
  });

  return { tasks, teamMemberIds: [...teamMemberIds] };
}

export type MissionEventName =
  | "task-update"
  | "mission-progress"
  | "mission-completed"
  | "mission-init"
  | "error";

export interface MissionTask {
  id: string;
  title: string;
  status: "pending" | "ready" | "claimed" | "in_progress" | "in_review" | "completed" | "failed" | "cancelled" | "blocked";
  progress?: number;
  assignedEmployeeId?: string | null;
  outputSummary?: string | null;
  errorMessage?: string | null;
  errorRecoverable?: boolean;
  retryCount?: number;
  phase?: number | null;
}

export interface MissionInitStep {
  phase: number;
  name: string;
  skillName?: string;
  assignedEmployeeIdHint?: string;
}

export interface MissionInitData {
  templateId: string;
  templateName: string;
  steps: MissionInitStep[];
}

export interface MissionProgressData {
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  tasksById: Record<string, MissionTask>;
  notFound: boolean;
  init: MissionInitData | null;
}

export function emptyMissionProgress(): MissionProgressData {
  return { status: "pending", progress: 0, tasksById: {}, notFound: false, init: null };
}

/**
 * 把单条 SSE 事件 merge 进当前 state。纯函数，便于 vitest 单测。
 * 未知事件名直接返回 prev。
 */
export function applyMissionEvent(
  prev: MissionProgressData,
  event: MissionEventName,
  raw: string,
): MissionProgressData {
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return prev; }
  if (typeof data !== "object" || data === null) return prev;
  const d = data as Record<string, unknown>;

  if (event === "error" && d.message === "Mission not found") {
    return { ...prev, notFound: true };
  }
  if (event === "mission-init") {
    if (typeof d.templateId !== "string" || !Array.isArray(d.steps)) return prev;
    return {
      ...prev,
      init: {
        templateId: d.templateId,
        templateName: String(d.templateName ?? ""),
        steps: (d.steps as unknown[]).map((s) => {
          const r = s as Record<string, unknown>;
          return {
            phase: typeof r.phase === "number" ? r.phase : 0,
            name: String(r.name ?? ""),
            skillName: typeof r.skillName === "string" ? r.skillName : undefined,
            assignedEmployeeIdHint: typeof r.assignedEmployeeIdHint === "string"
              ? r.assignedEmployeeIdHint : undefined,
          };
        }),
      },
    };
  }
  if (event === "task-update" && typeof d.taskId === "string") {
    return {
      ...prev,
      tasksById: {
        ...prev.tasksById,
        [d.taskId]: {
          id: d.taskId,
          title: String(d.title ?? ""),
          status: (d.status as MissionTask["status"]) ?? "pending",
          progress: typeof d.progress === "number" ? d.progress : undefined,
          assignedEmployeeId: (d.assignedEmployeeId as string | null) ?? null,
          outputSummary: typeof d.outputSummary === "string" ? d.outputSummary : null,
          errorMessage: typeof d.errorMessage === "string" ? d.errorMessage : null,
          errorRecoverable: typeof d.errorRecoverable === "boolean" ? d.errorRecoverable : undefined,
          retryCount: typeof d.retryCount === "number" ? d.retryCount : 0,
          phase: typeof d.phase === "number" ? d.phase : null,
        },
      },
    };
  }
  if (event === "mission-progress" || event === "mission-completed") {
    return {
      ...prev,
      status: (d.status as MissionProgressData["status"]) ?? prev.status,
      progress: typeof d.progress === "number" ? d.progress : prev.progress,
    };
  }
  return prev;
}

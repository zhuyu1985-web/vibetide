export type MissionEventName =
  | "task-update"
  | "mission-progress"
  | "mission-completed"
  | "error";

export interface MissionTask {
  id: string;
  title: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  progress?: number;
  assignedEmployeeId?: string | null;
}

export interface MissionProgressData {
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  tasksByid: Record<string, MissionTask>;
  notFound: boolean;
}

export function emptyMissionProgress(): MissionProgressData {
  return { status: "pending", progress: 0, tasksByid: {}, notFound: false };
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
  if (event === "task-update" && typeof d.taskId === "string") {
    return {
      ...prev,
      tasksByid: {
        ...prev.tasksByid,
        [d.taskId]: {
          id: d.taskId,
          title: String(d.title ?? ""),
          status: (d.status as MissionTask["status"]) ?? "pending",
          progress: typeof d.progress === "number" ? d.progress : undefined,
          assignedEmployeeId: (d.assignedEmployeeId as string | null) ?? null,
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

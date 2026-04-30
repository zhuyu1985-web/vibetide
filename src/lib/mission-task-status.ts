import type { MissionTask } from "@/lib/chat/parse-mission-event";

export type UiTaskState =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

/**
 * Map DB task status (9-value union from `missionTaskStatusEnum`) to the
 * compact 5-state UI projection used by mission stream bubbles.
 */
export function mapTaskStatusToUiState(s: MissionTask["status"]): UiTaskState {
  switch (s) {
    case "pending":
    case "ready":
    case "claimed":
    case "blocked":
      return "pending";
    case "in_progress":
    case "in_review":
      return "running";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return "pending";
  }
}

"use client";

import { mapTaskStatusToUiState } from "@/lib/mission-task-status";
import type { MissionProgressData } from "@/lib/chat/parse-mission-event";
import { cn } from "@/lib/utils";

interface MissionProgressChipProps {
  state: MissionProgressData;
  /** 用于把 querySelector 限定到当前 mission 容器；多 mission 在页面时不跨任务跳转。 */
  missionId: string;
}

/**
 * Floating mini progress indicator for a long mission stream. Click jumps to
 * the currently running step bubble (scoped to this mission's container).
 */
export function MissionProgressChip({ state, missionId }: MissionProgressChipProps) {
  const tasks = Object.values(state.tasksById).sort(
    (a, b) => (a.phase ?? 0) - (b.phase ?? 0),
  );
  if (tasks.length === 0) return null;

  const total = tasks.length;
  const completed = tasks.filter(
    (t) => mapTaskStatusToUiState(t.status) === "completed",
  ).length;

  const handleClick = () => {
    if (typeof document === "undefined") return;
    // 限定在当前 mission 容器里查 running 步骤，避免页面有多个 mission 时跨任务跳转
    const el = document.querySelector(
      `[data-mission-id="${missionId}"] [data-status="running"]`,
    );
    if (el && "scrollIntoView" in el) {
      (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="border-0 fixed top-20 right-6 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/85 dark:bg-gray-900/85 backdrop-blur-sm shadow-md ring-1 ring-gray-200/60 dark:ring-gray-700/60 hover:bg-white dark:hover:bg-gray-900 transition-colors"
      aria-label={`任务进度 ${completed}/${total}，点击定位到当前步骤`}
    >
      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
        {completed}/{total}
      </span>
      <span className="flex items-center gap-1">
        {tasks.map((t) => {
          const ui = mapTaskStatusToUiState(t.status);
          return (
            <span
              key={t.id}
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                ui === "completed" && "bg-blue-500",
                ui === "running" && "bg-blue-300 animate-pulse",
                ui === "failed" && "bg-red-500",
                ui === "cancelled" && "bg-gray-400",
                ui === "pending" && "bg-gray-200 dark:bg-gray-600",
              )}
            />
          );
        })}
      </span>
    </button>
  );
}

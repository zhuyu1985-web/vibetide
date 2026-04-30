"use client";

import { Loader2, AlertCircle } from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { useMissionProgress } from "@/lib/hooks/use-mission-progress";
import { mapTaskStatusToUiState } from "@/lib/mission-task-status";
import type { AIEmployee } from "@/lib/types";
import { retryMissionTask } from "@/app/actions/missions";
import { MissionPlanningBubble } from "./mission-planning-bubble";
import { MissionStepBubble } from "./mission-step-bubble";
import { MissionProgressChip } from "./mission-progress-chip";
import { MissionSummaryBubble } from "./mission-summary-bubble";

interface MissionStreamProps {
  missionId: string;
  templateName: string;
  ownerEmployee: AIEmployee | null;
  employees: AIEmployee[];
}

/**
 * 顶层 mission 流：用 SSE 状态分别渲染规划气泡、各步骤气泡、收尾气泡，
 * 并固定一个全局进度小芯片。失败步骤的"重试本步"按钮直接调
 * `retryMissionTask` server action，不再跳详情页。
 */
export function MissionStream({
  missionId,
  templateName,
  ownerEmployee,
  employees,
}: MissionStreamProps) {
  const state = useMissionProgress(missionId);

  if (state.isLoading) {
    return (
      <GlassCard
        padding="sm"
        className="flex items-center gap-2 text-sm text-muted-foreground"
      >
        <Loader2 size={14} className="animate-spin" />
        正在启动「{templateName}」…
      </GlassCard>
    );
  }

  if (state.notFound) {
    return (
      <GlassCard
        padding="sm"
        className="flex items-center gap-2 text-sm text-muted-foreground opacity-60"
      >
        <AlertCircle size={14} />
        任务「{templateName}」已被删除
      </GlassCard>
    );
  }

  // 步骤排序：按 phase 升序（同 phase 保留出现顺序）
  const orderedTasks = Object.values(state.tasksById).sort(
    (a, b) => (a.phase ?? 0) - (b.phase ?? 0),
  );

  // mission 已取消时，过滤掉还未开始（pending/ready/blocked）的任务
  const visibleTasks =
    state.status === "cancelled"
      ? orderedTasks.filter((t) => {
          const ui = mapTaskStatusToUiState(t.status);
          return ui !== "pending";
        })
      : orderedTasks;

  return (
    <div data-mission-id={missionId} className="relative space-y-3">
      <MissionProgressChip state={state} missionId={missionId} />

      {state.init && (
        <MissionPlanningBubble
          init={state.init}
          ownerEmployee={ownerEmployee}
          employees={employees}
        />
      )}

      {visibleTasks.map((task, idx) => (
        <MissionStepBubble
          key={task.id}
          task={task}
          stepNumber={idx + 1}
          totalSteps={visibleTasks.length}
          // 按 phase 而不是数组 index 反查 skillName，规避取消场景下 index 错位
          skillName={state.init?.steps.find((s) => s.phase === task.phase)?.skillName}
          ownerEmployee={ownerEmployee}
          employees={employees}
          missionId={missionId}
          onRetry={async () => {
            try {
              await retryMissionTask(task.id);
            } catch (e) {
              console.error("重试失败:", e);
              alert(e instanceof Error ? e.message : "重试失败");
            }
          }}
        />
      ))}

      <MissionSummaryBubble
        state={state}
        ownerEmployee={ownerEmployee}
        templateName={templateName}
      />
    </div>
  );
}

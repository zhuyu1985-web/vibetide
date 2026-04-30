"use client";

import { Loader2, AlertCircle } from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { useMissionProgress } from "@/lib/hooks/use-mission-progress";
import { mapTaskStatusToUiState } from "@/lib/mission-task-status";
import type { AIEmployee } from "@/lib/types";
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
 * 并固定一个全局进度小芯片。Commit 2 不接 onRetry，留给 Commit 3。
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
    <div className="space-y-3">
      <MissionProgressChip state={state} />

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
          skillName={state.init?.steps[idx]?.skillName}
          ownerEmployee={ownerEmployee}
          employees={employees}
          missionId={missionId}
          // Commit 3 will wire onRetry; intentionally omitted here.
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

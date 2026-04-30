"use client";

import { CheckCircle2, AlertTriangle } from "lucide-react";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import { mapTaskStatusToUiState } from "@/lib/mission-task-status";
import type { MissionProgressData } from "@/lib/chat/parse-mission-event";
import type { AIEmployee } from "@/lib/types";

interface MissionSummaryBubbleProps {
  state: MissionProgressData;
  ownerEmployee: AIEmployee | null;
  templateName: string;
}

/**
 * 任务收尾气泡。仅在 mission 完成 / 失败 / 取消时渲染。
 */
export function MissionSummaryBubble({
  state,
  ownerEmployee,
  templateName,
}: MissionSummaryBubbleProps) {
  if (
    state.status !== "completed"
    && state.status !== "failed"
    && state.status !== "cancelled"
  ) {
    return null;
  }

  const ownerId = (ownerEmployee?.id ?? "leader") as EmployeeId;
  const ownerMeta = EMPLOYEE_META[ownerId];
  const ownerName = ownerEmployee?.name ?? ownerMeta?.name ?? "队长";

  const tasks = Object.values(state.tasksById);
  const total = tasks.length;
  const completed = tasks.filter(
    (t) => mapTaskStatusToUiState(t.status) === "completed",
  ).length;
  const failed = tasks.filter(
    (t) => mapTaskStatusToUiState(t.status) === "failed",
  ).length;

  const isOk = state.status === "completed";
  const summary = isOk
    ? `「${templateName}」已完成，共 ${completed}/${total} 个步骤成功执行。`
    : state.status === "failed"
      ? `「${templateName}」未能完成，${failed} 个步骤执行失败。`
      : `「${templateName}」已取消。`;

  return (
    <div className="flex items-start gap-3">
      <EmployeeAvatar employeeId={ownerId} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="bg-gradient-to-br from-white/90 to-gray-50/70 dark:from-gray-800/60 dark:to-gray-800/40 backdrop-blur-sm rounded-2xl shadow-[0_1px_6px_rgba(0,0,0,0.06)] ring-1 ring-gray-200/30 px-4 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            {isOk ? (
              <CheckCircle2 size={14} className="text-blue-500 shrink-0" />
            ) : (
              <AlertTriangle size={14} className="text-orange-500 shrink-0" />
            )}
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {ownerName} · 任务收尾
            </span>
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {summary}
          </p>
        </div>
      </div>
    </div>
  );
}

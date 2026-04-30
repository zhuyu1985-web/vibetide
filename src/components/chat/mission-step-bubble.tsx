"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import {
  CheckCircle2,
  Loader2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import { useTypewriter } from "@/lib/hooks/use-typewriter";
import { mapTaskStatusToUiState } from "@/lib/mission-task-status";
import type { MissionTask } from "@/lib/chat/parse-mission-event";
import type { AIEmployee } from "@/lib/types";
import {
  markdownComponents,
  remarkPlugins,
} from "@/app/(dashboard)/employee/[id]/collapsible-markdown";
import { cn } from "@/lib/utils";

interface MissionStepBubbleProps {
  task: MissionTask;
  stepNumber: number;
  totalSteps: number;
  skillName?: string;
  ownerEmployee: AIEmployee | null;
  employees: AIEmployee[];
  missionId: string;
  /** Commit 3 wires this in; Commit 2 leaves undefined. */
  onRetry?: () => void;
}

/**
 * Single conversational bubble for one mission task. Avatar/name follow the
 * EXECUTING employee (task.assignedEmployeeId) — falls back to ownerEmployee
 * only when no assignee is set yet.
 */
export function MissionStepBubble({
  task,
  stepNumber,
  totalSteps,
  skillName,
  ownerEmployee,
  employees,
  missionId,
  onRetry,
}: MissionStepBubbleProps) {
  const uiState = mapTaskStatusToUiState(task.status);

  // Avatar/name resolution: assignee first, owner fallback.
  const assignedId = task.assignedEmployeeId ?? null;
  const assignedFromList = assignedId
    ? employees.find((e) => e.id === assignedId) ?? null
    : null;
  const fallbackEmpId = (assignedId ?? ownerEmployee?.id ?? "leader") as EmployeeId;
  const empMeta = EMPLOYEE_META[fallbackEmpId];
  const empName =
    assignedFromList?.name
    ?? empMeta?.name
    ?? ownerEmployee?.name
    ?? "AI 员工";

  const summary = task.outputSummary ?? "";
  const revealed = useTypewriter(
    summary,
    30,
    uiState === "completed" ? task.id : null,
  );

  const opacityClass =
    uiState === "pending" ? "opacity-50" :
    uiState === "cancelled" ? "opacity-60" :
    "";

  return (
    <div
      data-status={uiState}
      className={cn("flex items-start gap-3", opacityClass)}
    >
      <EmployeeAvatar employeeId={fallbackEmpId} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="bg-gradient-to-br from-white/90 to-gray-50/70 dark:from-gray-800/60 dark:to-gray-800/40 backdrop-blur-sm rounded-2xl shadow-[0_1px_6px_rgba(0,0,0,0.06)] ring-1 ring-gray-200/30 px-4 py-3">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <StepStatusIcon uiState={uiState} />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {empName}
            </span>
            <span className="text-xs text-muted-foreground">
              步骤 {stepNumber}/{totalSteps}
            </span>
            <StepStatusLabel uiState={uiState} />
            {skillName && (
              <span
                className={cn(
                  "text-xs px-1.5 py-0.5 rounded",
                  uiState === "pending" || uiState === "cancelled"
                    ? "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                    : "bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300",
                )}
              >
                {skillName}
              </span>
            )}
            {uiState === "failed" && (task.retryCount ?? 0) > 0 && (
              <span className="text-xs text-orange-600 bg-orange-50 dark:bg-orange-950/40 px-1.5 py-0.5 rounded">
                已重试 {task.retryCount} 次
              </span>
            )}
          </div>

          <StepBody
            uiState={uiState}
            task={task}
            revealedSummary={revealed}
            missionId={missionId}
            onRetry={onRetry}
          />
        </div>
      </div>
    </div>
  );
}

function StepStatusIcon({ uiState }: { uiState: ReturnType<typeof mapTaskStatusToUiState> }) {
  if (uiState === "completed") {
    return <CheckCircle2 size={14} className="text-blue-500 shrink-0" />;
  }
  if (uiState === "running") {
    return <Loader2 size={14} className="text-blue-500 animate-spin shrink-0" />;
  }
  if (uiState === "failed") {
    return <AlertTriangle size={14} className="text-red-500 shrink-0" />;
  }
  if (uiState === "cancelled") {
    return <XCircle size={14} className="text-gray-400 shrink-0" />;
  }
  // pending
  return <span className="w-3.5 h-3.5 rounded-full border border-gray-300 shrink-0" />;
}

function StepStatusLabel({ uiState }: { uiState: ReturnType<typeof mapTaskStatusToUiState> }) {
  const text =
    uiState === "completed" ? "已完成" :
    uiState === "running" ? "进行中…" :
    uiState === "failed" ? "执行失败" :
    uiState === "cancelled" ? "已取消" :
    "等待中";
  return <span className="text-xs text-muted-foreground">· {text}</span>;
}

function StepBody({
  uiState,
  task,
  revealedSummary,
  missionId,
  onRetry,
}: {
  uiState: ReturnType<typeof mapTaskStatusToUiState>;
  task: MissionTask;
  revealedSummary: string;
  missionId: string;
  onRetry?: () => void;
}) {
  if (uiState === "pending") {
    return (
      <div className="text-xs text-muted-foreground truncate">
        等待依赖：{task.title}
      </div>
    );
  }
  if (uiState === "cancelled") {
    return (
      <div className="text-xs text-muted-foreground truncate">
        已取消：{task.title}
      </div>
    );
  }
  if (uiState === "running") {
    return (
      <div className="flex items-center gap-1 text-sm text-muted-foreground py-1">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "120ms" }} />
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "240ms" }} />
      </div>
    );
  }
  if (uiState === "completed") {
    return (
      <div className="space-y-2">
        <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
          <ReactMarkdown
            remarkPlugins={remarkPlugins}
            components={markdownComponents}
          >
            {revealedSummary || task.title}
          </ReactMarkdown>
        </div>
        <Link
          href={`/missions/${missionId}`}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          查看完整结果 →
        </Link>
      </div>
    );
  }
  // failed
  const recoverable = task.errorRecoverable !== false;
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-red-200 bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/30 px-3 py-2">
        <div className="text-sm text-red-700 dark:text-red-300 leading-relaxed">
          {task.errorMessage ?? "执行失败"}
        </div>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              disabled={!recoverable}
              className="border-0 text-xs px-2.5 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed dark:disabled:bg-gray-700"
            >
              {recoverable ? "重试此步骤" : "无法重试"}
            </button>
          ) : (
            <Link
              href={`/missions/${missionId}`}
              className="text-xs px-2.5 py-1 rounded bg-blue-500 text-white hover:bg-blue-600"
            >
              在任务页处理
            </Link>
          )}
          <Link
            href={`/missions/${missionId}`}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            查看完整错误日志 →
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import type { WorkflowStepDef } from "@/db/schema/workflows";
import { X, Maximize2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { formatDuration } from "./step-card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TestResultData {
  status: "idle" | "pending" | "running" | "completed" | "failed";
  summary?: string;
  fullResult?: string;
  durationMs?: number;
  employeeName?: string;
}

interface TestResultPanelProps {
  step: WorkflowStepDef;
  stepIndex: number;
  result: TestResultData;
  onClose: () => void;
  onExpand?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TestResultPanel({
  step,
  stepIndex,
  result,
  onClose,
  onExpand,
}: TestResultPanelProps) {
  const status = result.status;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-muted-foreground shrink-0">
            步骤 {stepIndex + 1}
          </span>
          <h3 className="text-sm font-semibold text-foreground truncate">
            {step.name}
          </h3>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onExpand && (
            <button
              onClick={onExpand}
              className="p-1.5 rounded-lg bg-transparent text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
              title="全屏查看"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-transparent text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Status row */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-2 shrink-0">
        <StatusBadge status={status} />
        {result.durationMs != null && status !== "running" && (
          <span className="text-[11px] text-muted-foreground">
            耗时 {formatDuration(result.durationMs)}
          </span>
        )}
        {result.employeeName && (
          <span className="text-[11px] text-muted-foreground">
            · 执行人 {result.employeeName}
          </span>
        )}
      </div>

      {/* Summary */}
      {result.summary && (
        <div className="px-4 pb-2 shrink-0">
          <div className="rounded-lg bg-black/[0.03] dark:bg-white/[0.04] px-3 py-2 text-xs text-foreground">
            {result.summary}
          </div>
        </div>
      )}

      {/* Full output */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="text-[11px] font-medium text-muted-foreground mb-1.5">
          执行输出
        </div>
        {status === "running" && !result.fullResult ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-8 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            正在执行…
          </div>
        ) : result.fullResult ? (
          <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground font-mono rounded-lg bg-black/[0.02] dark:bg-white/[0.03] p-3">
            {result.fullResult}
          </pre>
        ) : (
          <div className="text-xs text-muted-foreground py-8 text-center">
            暂无输出
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: TestResultData["status"] }) {
  switch (status) {
    case "running":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-[11px] font-medium text-blue-600 dark:text-blue-400">
          <Loader2 className="w-3 h-3 animate-spin" />
          执行中
        </span>
      );
    case "completed":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 text-[11px] font-medium text-green-600 dark:text-green-400">
          <CheckCircle2 className="w-3 h-3" />
          已完成
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-[11px] font-medium text-red-600 dark:text-red-400">
          <AlertCircle className="w-3 h-3" />
          失败
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-[11px] text-muted-foreground">
          等待中
        </span>
      );
  }
}

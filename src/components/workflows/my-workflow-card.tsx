"use client";

import type { WorkflowStepDef } from "@/db/schema/workflows";
import { Play, Pencil, Trash2, Clock, Zap, AlertCircle } from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { describeCronExpression } from "@/lib/cron";

export interface WorkflowScheduleSummary {
  cronExpression: string;
  enabled: boolean;
}

interface MyWorkflowCardProps {
  workflow: {
    id: string;
    name: string;
    description: string | null;
    runCount: number;
    lastRunAt: string | null;
    isEnabled: boolean;
    steps: WorkflowStepDef[];
  };
  /** 来自 scheduled_jobs；无记录表示手动触发 */
  schedule?: WorkflowScheduleSummary | null;
  onRun: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

function getTriggerLabel(schedule: WorkflowScheduleSummary | null | undefined): {
  label: string;
  isScheduled: boolean;
} {
  if (!schedule) {
    return { label: "手动触发", isScheduled: false };
  }
  const timeLabel = describeCronExpression(schedule.cronExpression);
  if (schedule.enabled) {
    return { label: `定时 · ${timeLabel}`, isScheduled: true };
  }
  return { label: `定时已停用 · ${timeLabel}`, isScheduled: true };
}

export function MyWorkflowCard({
  workflow,
  schedule = null,
  onRun,
  onEdit,
  onDelete,
}: MyWorkflowCardProps) {
  const { label: triggerLabel, isScheduled } = getTriggerLabel(schedule);
  const TriggerIcon = isScheduled ? Clock : Zap;
  const stepCount = Array.isArray(workflow.steps) ? workflow.steps.length : 0;
  const isEmpty = stepCount === 0;

  return (
    <GlassCard hover className="group flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white/90 flex-1 truncate">
          {workflow.name}
        </h3>
        <span className="shrink-0 text-[11px] text-gray-400 dark:text-white/40">
          {stepCount} 步
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-white/45 mb-1">
        <TriggerIcon className="w-3.5 h-3.5" />
        <span>{triggerLabel}</span>
      </div>

      {isEmpty ? (
        <p className="inline-flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400 mb-4">
          <AlertCircle className="w-3.5 h-3.5" />
          未配置步骤，请编辑补全
        </p>
      ) : (
        <p className="text-sm text-gray-400 dark:text-white/35 mb-4">
          已运行 {workflow.runCount} 次
        </p>
      )}

      <div className="flex items-center gap-2 mt-auto opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => !isEmpty && onRun(workflow.id)}
          disabled={isEmpty}
          title={isEmpty ? "未配置步骤，无法运行" : undefined}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl backdrop-blur-sm text-sm border-0 transition-all ${
            isEmpty
              ? "bg-gray-100/60 dark:bg-white/[0.04] text-gray-400 dark:text-white/30 cursor-not-allowed"
              : "bg-blue-50/80 dark:bg-blue-500/[0.08] text-blue-600 dark:text-blue-400 cursor-pointer hover:bg-blue-100/90 dark:hover:bg-blue-500/[0.15] hover:text-blue-700 dark:hover:text-blue-300"
          }`}
        >
          <Play className="w-3.5 h-3.5" />
          运行
        </button>
        <button
          onClick={() => onEdit(workflow.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50/80 dark:bg-blue-500/[0.08] backdrop-blur-sm text-sm text-blue-600 dark:text-blue-400 border-0 cursor-pointer transition-all hover:bg-blue-100/90 dark:hover:bg-blue-500/[0.15] hover:text-blue-700 dark:hover:text-blue-300"
        >
          <Pencil className="w-3.5 h-3.5" />
          编辑
        </button>
        <button
          onClick={() => onDelete(workflow.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 text-sm text-red-400/70 border-0 cursor-pointer transition-all hover:bg-red-500/20 hover:text-red-400"
        >
          <Trash2 className="w-3.5 h-3.5" />
          删除
        </button>
      </div>
    </GlassCard>
  );
}

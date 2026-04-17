"use client";

import type { WorkflowStepDef } from "@/db/schema/workflows";
import { Play, Pencil, Trash2, Clock, Zap } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MyWorkflowCardProps {
  workflow: {
    id: string;
    name: string;
    description: string | null;
    triggerType: string;
    triggerConfig: { cron?: string; timezone?: string } | null;
    runCount: number;
    lastRunAt: string | null;
    isEnabled: boolean;
    steps: WorkflowStepDef[];
  };
  onRun: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Cron helper
// ---------------------------------------------------------------------------

function describeCron(cron: string): string {
  // Simple patterns: "minute hour * * *" or "minute hour * * dayOfWeek"
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return cron;

  const [minute, hour, , , dayOfWeek] = parts;
  const timeStr = `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;

  const dayNames: Record<string, string> = {
    "0": "日",
    "1": "一",
    "2": "二",
    "3": "三",
    "4": "四",
    "5": "五",
    "6": "六",
  };

  if (dayOfWeek === "*") {
    return `每日 ${timeStr}`;
  }

  const dayLabel = dayNames[dayOfWeek] ?? dayOfWeek;
  return `每周${dayLabel} ${timeStr}`;
}

function getTriggerLabel(
  triggerType: string,
  triggerConfig: { cron?: string } | null
): string {
  if (triggerType === "scheduled" && triggerConfig?.cron) {
    return `定时 · ${describeCron(triggerConfig.cron)}`;
  }
  return "手动触发";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MyWorkflowCard({
  workflow,
  onRun,
  onEdit,
  onDelete,
}: MyWorkflowCardProps) {
  const triggerLabel = getTriggerLabel(
    workflow.triggerType,
    workflow.triggerConfig
  );

  const TriggerIcon = workflow.triggerType === "scheduled" ? Clock : Zap;

  return (
    <div className="group bg-slate-50/80 dark:bg-white/[0.05] rounded-2xl p-5 transition-all hover:bg-slate-100 dark:hover:bg-white/[0.08] shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex flex-col">
      {/* Name */}
      <h3 className="text-base font-semibold text-gray-900 dark:text-white/90 mb-2">
        {workflow.name}
      </h3>

      {/* Trigger info */}
      <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-white/45 mb-1">
        <TriggerIcon className="w-3.5 h-3.5" />
        <span>{triggerLabel}</span>
      </div>

      {/* Run count */}
      <p className="text-sm text-gray-400 dark:text-white/35 mb-4">
        已运行 {workflow.runCount} 次
      </p>

      {/* Action buttons (visible on hover) */}
      <div className="flex items-center gap-2 mt-auto opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onRun(workflow.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50/80 dark:bg-blue-500/[0.08] backdrop-blur-sm text-sm text-blue-600 dark:text-blue-400 border-0 cursor-pointer transition-all hover:bg-blue-100/90 dark:hover:bg-blue-500/[0.15] hover:text-blue-700 dark:hover:text-blue-300"
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
    </div>
  );
}

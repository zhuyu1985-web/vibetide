"use client";

import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import type { WorkflowStepDef } from "@/db/schema/workflows";
import {
  MoreVertical,
  Plus,
  Pencil,
  ArrowUp,
  ArrowDown,
  Trash2,
  Cog,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StepListProps {
  steps: WorkflowStepDef[];
  onEdit: (stepId: string) => void;
  onDelete: (stepId: string) => void;
  onMoveUp: (stepId: string) => void;
  onMoveDown: (stepId: string) => void;
  onAddStep: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEmployeeMeta(step: WorkflowStepDef) {
  const slug = (step.config?.employeeSlug ?? step.employeeSlug) as
    | EmployeeId
    | undefined;
  if (!slug) return null;
  return EMPLOYEE_META[slug] ?? null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StepList({
  steps,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  onAddStep,
}: StepListProps) {
  const sortedSteps = [...steps].sort((a, b) => a.order - b.order);

  return (
    <div className="flex flex-col items-center w-full">
      {sortedSteps.map((step, idx) => {
        const meta = getEmployeeMeta(step);
        const isFirst = idx === 0;
        const isLast = idx === sortedSteps.length - 1;
        const StepIcon = meta?.icon ?? Cog;

        return (
          <div key={step.id} className="flex flex-col items-center w-full">
            {/* Connector line between steps */}
            {idx > 0 && (
              <div className="h-6 w-px bg-border" />
            )}

            {/* Step card */}
            <div className="bg-card rounded-xl p-4 border border-border shadow-sm w-full flex items-center gap-3">
              {/* Step number */}
              <div
                className="flex items-center justify-center w-7 h-7 rounded-lg text-xs font-semibold shrink-0"
                style={{
                  backgroundColor: meta?.bgColor ?? "rgba(107,114,128,0.12)",
                  color: meta?.color ?? "#6b7280",
                }}
              >
                {idx + 1}
              </div>

              {/* Employee icon + info */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
                  style={{
                    backgroundColor: meta?.bgColor ?? "rgba(107,114,128,0.12)",
                  }}
                >
                  <StepIcon
                    className="w-4 h-4"
                    style={{ color: meta?.color ?? "#6b7280" }}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {step.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {meta ? `${meta.nickname} · ${meta.title}` : (step.type === "output" ? "输出动作" : "未分配")}
                  </p>
                </div>
              </div>

              {/* Three-dot menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1.5 rounded-lg border-0 bg-transparent text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => onEdit(step.id)}>
                    <Pencil className="w-4 h-4" />
                    编辑
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => onMoveUp(step.id)}
                    disabled={isFirst}
                  >
                    <ArrowUp className="w-4 h-4" />
                    上移
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => onMoveDown(step.id)}
                    disabled={isLast}
                  >
                    <ArrowDown className="w-4 h-4" />
                    下移
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => onDelete(step.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                    删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        );
      })}

      {/* Connector to add button */}
      {sortedSteps.length > 0 && (
        <div className="h-6 w-px bg-border" />
      )}

      {/* Add step button */}
      <button
        onClick={onAddStep}
        className="w-full rounded-xl border border-dashed border-border bg-transparent p-4 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-black/[0.02] dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        添加步骤
      </button>
    </div>
  );
}

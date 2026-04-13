"use client";

import { Plus, AlertCircle } from "lucide-react";
import type { WorkflowStepDef } from "@/db/schema/workflows";
import { TriggerCard } from "./trigger-card";
import { StepCard } from "./step-card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StepStatus {
  status: "idle" | "pending" | "running" | "completed" | "failed";
  message?: string;
  fullResult?: string;
  durationMs?: number;
  employeeName?: string;
}

interface WorkflowCanvasProps {
  triggerType: "manual" | "scheduled";
  triggerConfig?: { cron?: string; timezone?: string } | null;
  steps: WorkflowStepDef[];
  selectedStepId: string | null;
  testResultStepId?: string | null;
  testRunning: boolean;
  triggerStatus?: "idle" | "running" | "completed";
  stepStatuses?: Record<string, StepStatus>;
  onTriggerClick: () => void;
  onStepClick: (stepId: string) => void;
  onStepEdit: (stepId: string) => void;
  onStepDelete: (stepId: string) => void;
  onStepMoveUp: (stepId: string) => void;
  onStepMoveDown: (stepId: string) => void;
  onAddStep: () => void;
  onViewStepResult?: (stepId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkflowCanvas({
  triggerType,
  triggerConfig,
  steps,
  selectedStepId,
  testResultStepId = null,
  testRunning,
  triggerStatus = "idle",
  stepStatuses = {},
  onTriggerClick,
  onStepClick,
  onStepEdit,
  onStepDelete,
  onStepMoveUp,
  onStepMoveDown,
  onAddStep,
  onViewStepResult,
}: WorkflowCanvasProps) {
  const sortedSteps = [...steps].sort((a, b) => a.order - b.order);

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto py-6 px-4">
      {/* Test run banner */}
      {testRunning && (
        <div className="w-full mb-6 rounded-xl bg-amber-500/10 p-3 flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="text-xs font-medium">
            预览模式 - 编辑或启用后将保存为您的工作流
          </span>
        </div>
      )}

      {/* ── 入门 section ── */}
      <p className="text-sm text-muted-foreground mb-3 self-start">入门</p>
      <TriggerCard
        triggerType={triggerType}
        triggerConfig={triggerConfig}
        onClick={onTriggerClick}
        status={triggerStatus}
      />

      {/* Connector */}
      <div className="w-px h-8 bg-border" />

      {/* ── 操作 section ── */}
      <p className="text-sm text-muted-foreground mb-3 self-start">操作</p>

      {sortedSteps.map((step, idx) => {
        const stepStatus = stepStatuses[step.id];
        return (
          <div key={step.id} className="flex flex-col items-center w-full">
            {/* Connector between steps */}
            {idx > 0 && <div className="w-px h-8 bg-border" />}

            <StepCard
              step={step}
              index={idx}
              selected={selectedStepId === step.id}
              status={stepStatus?.status ?? "idle"}
              statusMessage={stepStatus?.message}
              durationMs={stepStatus?.durationMs}
              hasResult={!!stepStatus?.fullResult}
              resultSelected={testResultStepId === step.id}
              onClick={() => onStepClick(step.id)}
              onEdit={() => onStepEdit(step.id)}
              onDelete={() => onStepDelete(step.id)}
              onMoveUp={() => onStepMoveUp(step.id)}
              onMoveDown={() => onStepMoveDown(step.id)}
              onViewResult={
                onViewStepResult ? () => onViewStepResult(step.id) : undefined
              }
              isFirst={idx === 0}
              isLast={idx === sortedSteps.length - 1}
            />
          </div>
        );
      })}

      {/* Connector to add button */}
      <div className="w-px h-8 bg-border" />

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

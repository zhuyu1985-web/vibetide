"use client";

import { EmployeeAvatar } from "./employee-avatar";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import type { WorkflowStepState } from "@/lib/types";
import type { EmployeeId } from "@/lib/constants";

interface WorkflowPipelineProps {
  steps: WorkflowStepState[];
  className?: string;
}

export function WorkflowPipeline({ steps, className }: WorkflowPipelineProps) {
  return (
    <div className={cn("flex items-center gap-1 overflow-x-auto pb-2", className)}>
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center">
          <WorkflowStep step={step} />
          {i < steps.length - 1 && (
            <div
              className={cn(
                "w-6 h-0.5 mx-0.5 shrink-0",
                step.status === "completed"
                  ? "bg-green-400"
                  : step.status === "active"
                  ? "bg-blue-300"
                  : "bg-gray-200 dark:bg-gray-700"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function WorkflowStep({ step }: { step: WorkflowStepState }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1.5 px-2 py-2 rounded-xl min-w-[72px] transition-colors",
        step.status === "completed" && "bg-green-50 dark:bg-green-950/50",
        step.status === "active" && "bg-blue-50 dark:bg-blue-950/50 ring-1 ring-blue-200 dark:ring-blue-700/50",
        step.status === "pending" && "bg-gray-50 dark:bg-gray-800/50",
        step.status === "skipped" && "bg-gray-50 dark:bg-gray-800/50 opacity-50"
      )}
    >
      <div className="relative">
        <EmployeeAvatar employeeId={step.employeeId as EmployeeId} size="sm" />
        {step.status === "completed" && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
            <Check size={10} className="text-white" strokeWidth={3} />
          </div>
        )}
        {step.status === "active" && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          </div>
        )}
      </div>
      <span className="text-[10px] font-medium text-gray-600 dark:text-gray-400 text-center leading-tight">
        {step.label}
      </span>
      {step.status === "active" && step.progress > 0 && (
        <div className="w-full h-1 bg-blue-100 dark:bg-blue-900/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all"
            style={{ width: `${step.progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

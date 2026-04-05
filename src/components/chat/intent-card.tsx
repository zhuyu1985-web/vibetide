"use client";

import { useState } from "react";
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import { ChevronRight, Play, X, GripVertical, Trash2 } from "lucide-react";
import type { IntentResult, IntentStep } from "@/lib/agent/types";
import { INTENT_TYPE_LABELS } from "@/lib/agent/types";

interface IntentCardProps {
  intent: IntentResult;
  onConfirm: (editedIntent: IntentResult) => void;
  onCancel: () => void;
}

export function IntentCard({ intent, onConfirm, onCancel }: IntentCardProps) {
  const [steps, setSteps] = useState<IntentStep[]>([...intent.steps]);

  const handleRemoveStep = (index: number) => {
    if (steps.length <= 1) return;
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    onConfirm({
      ...intent,
      steps,
    });
  };

  return (
    <div className="w-full max-w-lg rounded-xl bg-white/80 dark:bg-gray-800/60 backdrop-blur-sm p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
            {INTENT_TYPE_LABELS[intent.intentType] || intent.intentType}
          </span>
          <span className="text-xs text-gray-400">
            置信度 {Math.round(intent.confidence * 100)}%
          </span>
        </div>
      </div>

      {/* Summary */}
      <p className="text-sm text-gray-600 dark:text-gray-300">
        {intent.summary}
      </p>

      {/* Steps */}
      <div className="space-y-1.5">
        <p className="text-xs text-gray-400 font-medium">执行步骤</p>
        {steps.map((step, i) => {
          const meta = EMPLOYEE_META[step.employeeSlug as EmployeeId];
          return (
            <div
              key={i}
              className="flex items-center gap-2 p-2 rounded-lg bg-gray-50/80 dark:bg-gray-700/30 group"
            >
              <GripVertical
                size={14}
                className="text-gray-300 flex-shrink-0"
              />

              {/* Step number */}
              <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                {i + 1}
              </span>

              {/* Employee badge */}
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0"
                style={{
                  backgroundColor: meta?.bgColor ?? "rgba(59,130,246,0.12)",
                  color: meta?.color ?? "#3b82f6",
                }}
              >
                {step.employeeName}
              </span>

              {i > 0 && i < steps.length && (
                <ChevronRight
                  size={10}
                  className="text-gray-300 flex-shrink-0 -ml-1"
                />
              )}

              {/* Task description */}
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate flex-1 min-w-0">
                {step.taskDescription}
              </span>

              {/* Skills tags */}
              <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
                {step.skills.slice(0, 2).map((skill) => (
                  <span
                    key={skill}
                    className="text-[10px] px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-600/40 text-gray-400"
                  >
                    {skill}
                  </span>
                ))}
              </div>

              {/* Remove button */}
              {steps.length > 1 && (
                <button
                  className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-opacity border-0 flex-shrink-0"
                  onClick={() => handleRemoveStep(i)}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Reasoning (collapsible) */}
      {intent.reasoning && (
        <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
          {intent.reasoning}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors border-0"
          onClick={onCancel}
        >
          取消
        </button>
        <button
          className="text-xs text-white bg-blue-500 hover:bg-blue-600 px-4 py-1.5 rounded-lg transition-colors border-0 font-medium"
          onClick={handleConfirm}
        >
          <Play size={12} className="inline mr-1" />
          执行
        </button>
      </div>
    </div>
  );
}

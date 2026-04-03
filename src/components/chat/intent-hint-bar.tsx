"use client";

import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import { Loader2, X, ChevronRight } from "lucide-react";
import type { IntentResult } from "@/lib/agent/intent-recognition";
import { INTENT_TYPE_LABELS } from "@/lib/agent/intent-recognition";

interface IntentHintBarProps {
  intent: IntentResult;
  executing: boolean;
  onCancel: () => void;
  onEdit: () => void;
}

export function IntentHintBar({
  intent,
  executing,
  onCancel,
  onEdit,
}: IntentHintBarProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50/80 dark:bg-blue-950/30 backdrop-blur-sm text-sm animate-in slide-in-from-top-2 duration-300">
      {executing && (
        <Loader2 size={14} className="text-blue-500 animate-spin flex-shrink-0" />
      )}

      <span className="text-blue-600 dark:text-blue-400 font-medium flex-shrink-0">
        {INTENT_TYPE_LABELS[intent.intentType] || intent.intentType}
      </span>

      <span className="text-gray-400 flex-shrink-0">·</span>

      <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
        {intent.steps.map((step, i) => {
          const meta = EMPLOYEE_META[step.employeeSlug as EmployeeId];
          return (
            <span key={i} className="flex items-center gap-1 flex-shrink-0">
              {i > 0 && (
                <ChevronRight size={12} className="text-gray-300" />
              )}
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium"
                style={{
                  backgroundColor: meta?.bgColor ?? "rgba(59,130,246,0.12)",
                  color: meta?.color ?? "#3b82f6",
                }}
              >
                {step.employeeName}
              </span>
            </span>
          );
        })}
      </div>

      {!executing && (
        <button
          className="text-xs text-blue-500 hover:text-blue-700 flex-shrink-0 border-0"
          onClick={onEdit}
        >
          编辑
        </button>
      )}

      <button
        className="text-gray-400 hover:text-gray-600 flex-shrink-0 border-0"
        onClick={onCancel}
      >
        <X size={14} />
      </button>
    </div>
  );
}

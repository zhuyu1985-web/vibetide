"use client";

import { useState } from "react";
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import {
  Brain,
  ChevronRight,
  Play,
  X,
  Trash2,
  Loader2,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import type { IntentResult, IntentStep } from "@/lib/agent/types";
import { INTENT_TYPE_LABELS } from "@/lib/agent/types";
import type { StepInfo } from "@/lib/chat-utils";

// ---------------------------------------------------------------------------
// Intent analysis progress (shown while calling /api/chat/intent)
// ---------------------------------------------------------------------------

export interface IntentProgress {
  phase: string;
  label: string;
}

interface IntentAnalyzingProps {
  steps: IntentProgress[];
}

export function IntentAnalyzing({ steps }: IntentAnalyzingProps) {
  return (
    <div className="flex gap-3 max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center flex-shrink-0 shadow-sm">
        <Brain size={14} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-violet-600 dark:text-violet-400 mb-1.5">
          意图分析
        </p>
        <div className="rounded-xl bg-gradient-to-r from-violet-50 to-blue-50 dark:from-violet-950/30 dark:to-blue-950/30 p-2.5 space-y-1">
          {steps.map((step, i) => {
            const isLast = i === steps.length - 1;
            return (
              <div key={i} className="flex items-center gap-2">
                {isLast ? (
                  <Loader2
                    size={13}
                    className="text-violet-500 animate-spin flex-shrink-0"
                  />
                ) : (
                  <CheckCircle2
                    size={13}
                    className="text-violet-400 flex-shrink-0"
                  />
                )}
                <span
                  className={`text-xs ${
                    isLast
                      ? "text-violet-700 dark:text-violet-300 font-medium"
                      : "text-violet-500 dark:text-violet-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
          {steps.length === 0 && (
            <div className="flex items-center gap-2">
              <Loader2
                size={13}
                className="text-violet-500 animate-spin"
              />
              <span className="text-xs text-violet-700 dark:text-violet-300 font-medium">
                正在分析您的意图...
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Intent result display (high confidence — auto-executing)
// ---------------------------------------------------------------------------

interface IntentResultBubbleProps {
  intent: IntentResult;
  executing: boolean;
  currentStep?: StepInfo | null;
  onCancel: () => void;
}

export function IntentResultBubble({
  intent,
  executing,
  currentStep,
  onCancel,
}: IntentResultBubbleProps) {
  return (
    <div className="flex gap-3 max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center flex-shrink-0 shadow-sm">
        <Brain size={14} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <p className="text-xs font-medium text-violet-600 dark:text-violet-400">
            意图识别
          </p>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 font-medium">
            {INTENT_TYPE_LABELS[intent.intentType]}
          </span>
          <span className="text-[10px] text-gray-400">
            置信度 {Math.round(intent.confidence * 100)}%
          </span>
        </div>

        <div className="rounded-xl bg-white/80 dark:bg-gray-800/60 backdrop-blur-sm p-2.5 space-y-2 shadow-sm ring-1 ring-violet-100 dark:ring-violet-900/30">
          {/* Summary */}
          <p className="text-xs text-gray-700 dark:text-gray-200 font-medium">
            {intent.summary}
          </p>

          {/* Step chain */}
          <div className="space-y-1">
            {intent.steps.map((step, i) => {
              const meta =
                EMPLOYEE_META[step.employeeSlug as EmployeeId];
              const isActive =
                currentStep?.stepIndex === i && executing;
              const isDone =
                currentStep
                  ? currentStep.stepIndex > i
                  : !executing;

              return (
                <div
                  key={i}
                  className={`flex items-center gap-1.5 p-1.5 rounded-lg transition-all duration-300 ${
                    isActive
                      ? "bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-200 dark:ring-blue-800"
                      : isDone
                        ? "bg-green-50/50 dark:bg-green-950/20"
                        : "bg-gray-50/50 dark:bg-gray-700/20"
                  }`}
                >
                  {/* Status icon */}
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    {isActive ? (
                      <Loader2
                        size={14}
                        className="text-blue-500 animate-spin"
                      />
                    ) : isDone ? (
                      <CheckCircle2
                        size={14}
                        className="text-green-500"
                      />
                    ) : (
                      <span className="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-600 text-[10px] font-bold text-gray-500 dark:text-gray-300 flex items-center justify-center">
                        {i + 1}
                      </span>
                    )}
                  </div>

                  {/* Employee badge */}
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium flex-shrink-0"
                    style={{
                      backgroundColor:
                        meta?.bgColor ?? "rgba(59,130,246,0.12)",
                      color: meta?.color ?? "#3b82f6",
                    }}
                  >
                    {step.employeeName}
                  </span>

                  {i < intent.steps.length - 1 && (
                    <ChevronRight
                      size={10}
                      className="text-gray-300 flex-shrink-0"
                    />
                  )}

                  {/* Task description */}
                  <span
                    className={`text-[11px] truncate flex-1 min-w-0 ${
                      isActive
                        ? "text-blue-700 dark:text-blue-300 font-medium"
                        : isDone
                          ? "text-green-700 dark:text-green-400"
                          : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {step.taskDescription}
                  </span>

                  {/* Skill tags */}
                  <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
                    {step.skills.slice(0, 2).map((skill) => (
                      <span
                        key={skill}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-600/40 text-gray-400"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reasoning */}
          {intent.reasoning && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
              {intent.reasoning}
            </p>
          )}

          {/* Executing indicator or cancel */}
          <div className="flex items-center justify-between pt-0.5">
            {executing ? (
              <div className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400">
                <Sparkles size={12} />
                执行中...
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                <CheckCircle2 size={12} />
                执行完成
              </div>
            )}
            {executing && (
              <button
                className="text-[11px] text-gray-400 hover:text-red-500 transition-colors border-0"
                onClick={onCancel}
              >
                取消
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Intent confirmation card (low confidence — needs user approval)
// ---------------------------------------------------------------------------

interface IntentConfirmCardProps {
  intent: IntentResult;
  onConfirm: (editedIntent: IntentResult) => void;
  onCancel: () => void;
}

export function IntentConfirmCard({
  intent,
  onConfirm,
  onCancel,
}: IntentConfirmCardProps) {
  const [steps, setSteps] = useState<IntentStep[]>([...intent.steps]);

  const handleRemoveStep = (index: number) => {
    if (steps.length <= 1) return;
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConfirm = () => {
    onConfirm({ ...intent, steps });
  };

  return (
    <div className="flex gap-3 max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-sm">
        <Brain size={14} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
            意图识别（需确认）
          </p>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 font-medium">
            {INTENT_TYPE_LABELS[intent.intentType]}
          </span>
          <span className="text-[10px] text-gray-400">
            置信度 {Math.round(intent.confidence * 100)}%
          </span>
        </div>

        <div className="rounded-xl bg-white/80 dark:bg-gray-800/60 backdrop-blur-sm p-2.5 space-y-2 shadow-sm ring-1 ring-amber-100 dark:ring-amber-900/30">
          {/* Summary */}
          <p className="text-xs text-gray-700 dark:text-gray-200 font-medium">
            {intent.summary}
          </p>

          {/* Editable steps */}
          <div className="space-y-1">
            <p className="text-[11px] text-gray-400 font-medium">
              执行步骤（可删除调整）
            </p>
            {steps.map((step, i) => {
              const meta =
                EMPLOYEE_META[step.employeeSlug as EmployeeId];
              return (
                <div
                  key={i}
                  className="flex items-center gap-1.5 p-1.5 rounded-lg bg-gray-50/80 dark:bg-gray-700/30 group"
                >
                  <span className="w-4 h-4 rounded-full bg-amber-100 dark:bg-amber-900/40 text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>

                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium flex-shrink-0"
                    style={{
                      backgroundColor:
                        meta?.bgColor ?? "rgba(59,130,246,0.12)",
                      color: meta?.color ?? "#3b82f6",
                    }}
                  >
                    {step.employeeName}
                  </span>

                  <span className="text-[11px] text-gray-600 dark:text-gray-300 truncate flex-1 min-w-0">
                    {step.taskDescription}
                  </span>

                  {steps.length > 1 && (
                    <button
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all border-0 flex-shrink-0"
                      onClick={() => handleRemoveStep(i)}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Reasoning */}
          {intent.reasoning && (
            <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">
              {intent.reasoning}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-0.5">
            <button
              className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors border-0"
              onClick={onCancel}
            >
              <X size={12} className="inline mr-1" />
              取消
            </button>
            <button
              className="text-xs text-white bg-gradient-to-r from-violet-500 to-blue-500 hover:from-violet-600 hover:to-blue-600 px-4 py-1.5 rounded-lg transition-all border-0 font-medium shadow-sm"
              onClick={handleConfirm}
            >
              <Play size={12} className="inline mr-1" />
              确认执行
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

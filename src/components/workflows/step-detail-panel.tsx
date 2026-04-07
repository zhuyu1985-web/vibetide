"use client";

import { useState } from "react";
import type { WorkflowStepDef } from "@/db/schema/workflows";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SKILL_CATEGORY_CONFIG } from "./step-card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StepDetailPanelProps {
  step: WorkflowStepDef;
  onSave: (updated: WorkflowStepDef) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StepDetailPanel({
  step,
  onSave,
  onClose,
}: StepDetailPanelProps) {
  const [name, setName] = useState(step.name);
  const [description, setDescription] = useState(
    step.config?.description ?? ""
  );

  const catConfig = step.config?.skillCategory
    ? SKILL_CATEGORY_CONFIG[step.config.skillCategory]
    : null;

  function handleSave() {
    onSave({
      ...step,
      name,
      config: {
        ...step.config,
        parameters: step.config?.parameters ?? {},
        description: description || undefined,
      },
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <h3 className="text-sm font-semibold text-foreground">
          步骤 {step.order}
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg bg-transparent text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Step name */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="detail-step-name">步骤名称</Label>
          <Input
            id="detail-step-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="输入步骤名称"
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="detail-step-desc">步骤说明</Label>
          <Textarea
            id="detail-step-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="输入步骤说明"
            className="min-h-[80px] resize-none"
          />
        </div>

        {/* Current skill display */}
        {step.type === "skill" && step.config?.skillName && (
          <div className="flex flex-col gap-2">
            <Label>当前技能</Label>
            <div className="flex items-center gap-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] p-3">
              {catConfig && (
                <div
                  className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0"
                  style={{ backgroundColor: catConfig.bgColor }}
                >
                  <catConfig.icon
                    className="w-3.5 h-3.5"
                    style={{ color: catConfig.color }}
                  />
                </div>
              )}
              <span className="text-sm text-foreground flex-1">
                {step.config.skillName}
              </span>
              {catConfig && (
                <span
                  className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{
                    backgroundColor: catConfig.bgColor,
                    color: catConfig.color,
                  }}
                >
                  {catConfig.label}
                </span>
              )}
            </div>
            <button
              onClick={() => {
                // placeholder: would open skill selector
              }}
              className="self-start px-3 py-1.5 rounded-lg bg-black/[0.05] dark:bg-white/[0.08] text-xs text-muted-foreground hover:text-foreground hover:bg-black/[0.08] dark:hover:bg-white/[0.12] transition-colors cursor-pointer"
            >
              更换技能
            </button>
          </div>
        )}

        {/* Output action display */}
        {step.type === "output" && step.config?.outputAction && (
          <div className="flex flex-col gap-2">
            <Label>输出动作</Label>
            <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.04] p-3">
              <span className="text-sm text-foreground">
                {step.config.outputAction}
              </span>
            </div>
          </div>
        )}

        {/* Parameters placeholder */}
        <div className="flex flex-col gap-2">
          <Label>参数配置</Label>
          <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.04] p-4 text-center">
            <span className="text-xs text-muted-foreground">暂无参数配置</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 px-4 py-3 border-t border-border shrink-0">
        <button
          onClick={onClose}
          className="flex-1 py-2 rounded-xl bg-black/[0.05] dark:bg-white/[0.08] text-sm text-muted-foreground cursor-pointer transition-colors hover:bg-black/[0.08] dark:hover:bg-white/[0.12]"
        >
          取消
        </button>
        <button
          onClick={handleSave}
          className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm cursor-pointer transition-colors hover:bg-primary/90"
        >
          保存
        </button>
      </div>
    </div>
  );
}

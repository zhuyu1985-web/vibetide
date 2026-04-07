"use client";

import { X } from "lucide-react";
import type { WorkflowStepDef } from "@/db/schema/workflows";
import { AddStepPanel } from "./add-step-panel";
import { StepDetailPanel } from "./step-detail-panel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RightPanelProps {
  mode: "add" | "detail";
  // Add mode
  onAddSkillStep: (
    skillSlug: string,
    skillName: string,
    category: string
  ) => void;
  onAddOutputStep: (action: string, label: string) => void;
  onAddAIStep: (description: string) => void;
  // Detail mode
  selectedStep: WorkflowStepDef | null;
  onSaveStep: (step: WorkflowStepDef) => void;
  onCloseDetail: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RightPanel({
  mode,
  onAddSkillStep,
  onAddOutputStep,
  selectedStep,
  onSaveStep,
  onCloseDetail,
}: RightPanelProps) {
  if (mode === "detail" && selectedStep) {
    return (
      <StepDetailPanel
        step={selectedStep}
        onSave={(updated) => {
          onSaveStep(updated);
          onCloseDetail();
        }}
        onClose={onCloseDetail}
      />
    );
  }

  // "add" mode
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <h3 className="text-sm font-semibold text-foreground">添加步骤</h3>
        {mode === "detail" && (
          <button
            onClick={onCloseDetail}
            className="p-1.5 rounded-lg bg-transparent text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        <AddStepPanel
          onAddSkillStep={onAddSkillStep}
          onAddOutputStep={onAddOutputStep}
        />
      </div>
    </div>
  );
}

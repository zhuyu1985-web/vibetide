"use client";

import type { WorkflowStepDef } from "@/db/schema/workflows";
import { AddStepPanel } from "./add-step-panel";
import { StepDetailPanel } from "./step-detail-panel";
import {
  TestResultPanel,
  type TestResultData,
} from "./test-result-panel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RightPanelProps {
  mode: "add" | "detail" | "testResult";
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
  // Test result mode
  testResultStep?: WorkflowStepDef | null;
  testResultStepIndex?: number;
  testResult?: TestResultData | null;
  onCloseTestResult?: () => void;
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
  testResultStep,
  testResultStepIndex,
  testResult,
  onCloseTestResult,
}: RightPanelProps) {
  if (
    mode === "testResult" &&
    testResultStep &&
    testResult &&
    onCloseTestResult
  ) {
    return (
      <TestResultPanel
        step={testResultStep}
        stepIndex={testResultStepIndex ?? 0}
        result={testResult}
        onClose={onCloseTestResult}
      />
    );
  }

  if (mode === "detail" && selectedStep) {
    return (
      <StepDetailPanel
        step={selectedStep}
        onSave={onSaveStep}
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

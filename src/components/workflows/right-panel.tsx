"use client";

import type { WorkflowStepDef } from "@/db/schema/workflows";
import type { WorkflowPickerSkill } from "@/lib/dal/skills";
import type { InputFieldDef } from "@/lib/types";
import { AddStepPanel } from "./add-step-panel";
import { StepDetailPanel, type ToolParamSpec } from "./step-detail-panel";
import {
  TestResultPanel,
  type TestResultData,
} from "./test-result-panel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RightPanelProps {
  mode: "add" | "detail" | "testResult";
  /** Live skills pool for the add-step picker. */
  skills: WorkflowPickerSkill[];
  /**
   * Workflow-level input fields defined by the editor. Surfaced to the step
   * detail panel so users can pick field bindings (e.g. query ={{topic_title}})
   * from a dropdown instead of hand-typing Mustache placeholders.
   */
  inputFields: InputFieldDef[];
  /**
   * Pre-computed tool parameter specs keyed by skillSlug. Populates the
   * "参数名" dropdown with each tool's real input schema so users don't have
   * to guess parameter names like `query` / `maxResults` / `timeRange`.
   */
  toolParamSpecs?: Record<string, ToolParamSpec[]>;
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
  skills,
  inputFields,
  toolParamSpecs,
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
        skills={skills}
        inputFields={inputFields}
        toolParamSpecs={toolParamSpecs}
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
          skills={skills}
          onAddSkillStep={onAddSkillStep}
          onAddOutputStep={onAddOutputStep}
        />
      </div>
    </div>
  );
}

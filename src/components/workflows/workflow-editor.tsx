"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WorkflowCanvas } from "./workflow-canvas";
import { RightPanel } from "./right-panel";
import { BottomActionBar } from "./bottom-action-bar";
import { ChatPanel } from "./chat-panel";
import { useWorkflowSteps } from "./use-workflow-steps";
import { useTestRun } from "./use-test-run";
import { saveWorkflow, updateWorkflow } from "@/app/actions/workflow-engine";
import type { WorkflowStepDef } from "@/db/schema/workflows";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkflowEditorProps {
  initialData?: {
    id?: string;
    name: string;
    description: string;
    category: string;
    triggerType: string;
    triggerConfig?: { cron?: string; timezone?: string } | null;
    steps: WorkflowStepDef[];
  };
  mode: "create" | "edit";
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { value: "news", label: "新闻报道" },
  { value: "video", label: "视频生产" },
  { value: "analytics", label: "数据分析" },
  { value: "distribution", label: "渠道运营" },
  { value: "custom", label: "自定义" },
] as const;

type Category = "news" | "video" | "analytics" | "distribution" | "custom";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkflowEditor({ initialData, mode }: WorkflowEditorProps) {
  const router = useRouter();

  // ── Workflow metadata ──
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(
    initialData?.description ?? ""
  );
  const [category, setCategory] = useState<Category>(
    (initialData?.category as Category) ?? "custom"
  );
  const [triggerType, setTriggerType] = useState<"manual" | "scheduled">(
    (initialData?.triggerType as "manual" | "scheduled") ?? "manual"
  );
  const [triggerConfig, setTriggerConfig] = useState(
    initialData?.triggerConfig ?? null
  );
  const [isEnabled, setIsEnabled] = useState(false);

  // ── Steps (custom hook) ──
  const stepsHook = useWorkflowSteps(initialData?.steps ?? []);

  // ── Test run (custom hook) ──
  const testRun = useTestRun();

  // ── Right panel ──
  const [rightPanelMode, setRightPanelMode] = useState<
    "add" | "detail" | "testResult"
  >("add");
  const [testResultStepId, setTestResultStepId] = useState<string | null>(
    null
  );

  // ── UI state ──
  const [saving, setSaving] = useState(false);

  // ── Step interaction handlers ──

  const handleStepClick = useCallback(
    (stepId: string) => {
      stepsHook.setSelectedStepId(stepId);
      setRightPanelMode("detail");
    },
    [stepsHook]
  );

  const handleViewStepResult = useCallback((stepId: string) => {
    setTestResultStepId(stepId);
    setRightPanelMode("testResult");
  }, []);

  const handleCloseTestResult = useCallback(() => {
    setTestResultStepId(null);
    setRightPanelMode("add");
  }, []);

  const handleCloseDetail = useCallback(() => {
    stepsHook.setSelectedStepId(null);
    setRightPanelMode("add");
  }, [stepsHook]);

  const handleAddStepFromBar = useCallback(() => {
    setRightPanelMode("add");
    stepsHook.setSelectedStepId(null);
    setTestResultStepId(null);
  }, [stepsHook]);

  const handleDeleteStep = useCallback(
    (stepId: string) => {
      stepsHook.deleteStep(stepId);
      if (stepsHook.selectedStepId === stepId) {
        setRightPanelMode("add");
      }
    },
    [stepsHook]
  );

  const handleTriggerClick = useCallback(() => {
    setTriggerType((prev) =>
      prev === "manual" ? "scheduled" : "manual"
    );
    stepsHook.setHasChanges(true);
  }, [stepsHook]);

  // ── Workflow actions ──

  const handleSave = useCallback(async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (mode === "edit" && initialData?.id) {
        await updateWorkflow(initialData.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          category,
          triggerType,
          triggerConfig,
          steps: stepsHook.steps,
        });
      } else {
        await saveWorkflow({
          name: name.trim(),
          description: description.trim() || undefined,
          category,
          triggerType,
          triggerConfig,
          steps: stepsHook.steps,
        });
      }
      router.push("/workflows");
    } catch (err) {
      console.error("Failed to save workflow:", err);
    } finally {
      setSaving(false);
    }
  }, [
    mode,
    initialData?.id,
    name,
    description,
    category,
    triggerType,
    triggerConfig,
    stepsHook.steps,
    router,
  ]);

  const handleTestRun = useCallback(async () => {
    setTestResultStepId(null);
    if (rightPanelMode === "testResult") {
      setRightPanelMode("add");
    }
    await testRun.startTestRun(stepsHook.steps, triggerType, triggerConfig);
  }, [testRun, stepsHook.steps, triggerType, triggerConfig, rightPanelMode]);

  const handleToggleEnabled = useCallback(() => {
    setIsEnabled((prev) => !prev);
    stepsHook.setHasChanges(true);
  }, [stepsHook]);

  // ── AI chat callback ──

  const handleWorkflowGenerated = useCallback(
    (data: {
      name: string;
      description: string;
      category: Category;
      triggerType: "manual" | "scheduled";
      triggerConfig: { cron?: string; timezone?: string } | null;
      steps: WorkflowStepDef[];
    }) => {
      setName(data.name);
      setDescription(data.description);
      setCategory(data.category);
      setTriggerType(data.triggerType);
      if (data.triggerConfig) setTriggerConfig(data.triggerConfig);
      stepsHook.replaceSteps(data.steps);
    },
    [stepsHook]
  );

  // ── Derived ──

  const sortedStepsForLookup = [...stepsHook.steps].sort(
    (a, b) => a.order - b.order
  );
  const testResultStepIdx = sortedStepsForLookup.findIndex(
    (s) => s.id === testResultStepId
  );
  const testResultStep =
    testResultStepIdx >= 0 ? sortedStepsForLookup[testResultStepIdx] : null;
  const testResultStepIndex =
    testResultStepIdx >= 0 ? testResultStepIdx : 0;
  const testResultData = testResultStepId
    ? testRun.stepStatuses[testResultStepId] ?? null
    : null;

  // ── Render ──

  return (
    <div className="flex flex-col h-full">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background shrink-0">
        <button
          onClick={() => router.push("/workflows")}
          className="p-2 rounded-lg bg-transparent text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer border-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <Input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            stepsHook.setHasChanges(true);
          }}
          placeholder="输入工作流名称"
          className="max-w-sm text-base font-medium border-transparent bg-transparent hover:bg-black/[0.03] dark:hover:bg-white/[0.04] focus:bg-background focus:border-border transition-colors"
        />

        <Select
          value={category}
          onValueChange={(v) => {
            setCategory(v as Category);
            stepsHook.setHasChanges(true);
          }}
        >
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />
      </div>

      {/* ── Three-column body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── Left: AI Chat Panel ── */}
        <ChatPanel
          mode={mode}
          onWorkflowGenerated={handleWorkflowGenerated}
        />

        {/* ── Center: Canvas + Bottom Bar ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
          <div className="flex-1 overflow-y-auto p-6">
            <WorkflowCanvas
              triggerType={triggerType}
              triggerConfig={triggerConfig}
              steps={stepsHook.steps}
              selectedStepId={stepsHook.selectedStepId}
              testResultStepId={testResultStepId}
              testRunning={testRun.testRunning}
              triggerStatus={testRun.triggerStatus}
              stepStatuses={testRun.stepStatuses}
              onTriggerClick={handleTriggerClick}
              onStepClick={handleStepClick}
              onStepEdit={handleStepClick}
              onStepDelete={handleDeleteStep}
              onStepMoveUp={stepsHook.moveUp}
              onStepMoveDown={stepsHook.moveDown}
              onAddStep={handleAddStepFromBar}
              onViewStepResult={handleViewStepResult}
            />
          </div>
          <BottomActionBar
            onTestRun={handleTestRun}
            onToggleEnabled={handleToggleEnabled}
            onSave={handleSave}
            isEnabled={isEnabled}
            triggerType={triggerType}
            saving={saving}
            testRunning={testRun.testRunning}
            hasChanges={stepsHook.hasChanges}
          />
        </div>

        {/* ── Right: Add/Detail Panel ── */}
        <div className="w-[380px] border-l border-border shrink-0 overflow-y-auto bg-background">
          <RightPanel
            mode={rightPanelMode}
            onAddSkillStep={stepsHook.addSkillStep}
            onAddOutputStep={stepsHook.addOutputStep}
            onAddAIStep={stepsHook.addAIStep}
            selectedStep={stepsHook.selectedStep}
            onSaveStep={stepsHook.saveStep}
            onCloseDetail={handleCloseDetail}
            testResultStep={testResultStep}
            testResultStepIndex={testResultStepIndex}
            testResult={testResultData}
            onCloseTestResult={handleCloseTestResult}
          />
        </div>
      </div>
    </div>
  );
}

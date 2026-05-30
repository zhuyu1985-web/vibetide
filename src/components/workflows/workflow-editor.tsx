"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { InputFieldsEditor } from "./input-fields-editor";
import { useWorkflowSteps } from "./use-workflow-steps";
import { useTestRun } from "./use-test-run";
import { TestRunInputsDialog } from "./test-run-inputs-dialog";
import { ScheduleSheet } from "./schedule-sheet";
import { saveWorkflow, updateWorkflow } from "@/app/actions/workflow-engine";
import type { WorkflowStepDef } from "@/db/schema/workflows";
import type { InputFieldDef } from "@/lib/types";
import type { WorkflowPickerSkill } from "@/lib/dal/skills";
import type { ToolParamSpec } from "./step-detail-panel";
import type { ScheduledJob } from "@/db/schema/scheduled-jobs";
import type { WorkflowTemplateRow } from "@/db/types";

/** 把 cron 翻成简短的中文摘要,如 "每天 09:00";解析失败 fallback 显示原始 cron */
function summarizeCron(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return cron;
  const [minute, hour] = parts;
  // 仅支持最常见的 "分 时 * * *" / "分 时 * * X" 模式,其他直接 fallback
  if (/^\d+$/.test(minute) && /^\d+$/.test(hour)) {
    return `每天 ${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
  }
  return cron;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkflowEditorProps {
  initialData?: {
    id?: string;
    name: string;
    description: string;
    category: string;
    /** @deprecated 2026-05-29 — schedule 已迁到 scheduled_jobs;保留 prop 仅为不破坏旧调用方 */
    triggerType: string;
    /** @deprecated 2026-05-29 — 同上 */
    triggerConfig?: { cron?: string; timezone?: string } | null;
    steps: WorkflowStepDef[];
    inputFields?: InputFieldDef[];
    promptTemplate?: string;
  };
  mode: "create" | "edit";
  /** Live skills pool loaded server-side; drives the add-step picker. */
  skills: WorkflowPickerSkill[];
  /**
   * Server-pre-computed tool parameter specs (skillSlug → spec list) for the
   * step detail panel's "参数名" dropdown. Pre-computed on the server because
   * `tool-registry.ts` (where specs live) pulls in server-only deps (db,
   * drizzle) that can't reach the client bundle.
   */
  toolParamSpecs?: Record<string, ToolParamSpec[]>;
  /**
   * 2026-05-29 — 该模板已挂载的 schedule 列表(只在 edit mode 有值)。
   * 用于 TriggerCard 显示当前调度数 + Sheet 打开时作为初始 state。
   */
  initialSchedules?: ScheduledJob[];
  /**
   * 2026-05-29 — schedule Sheet 嵌入 ScheduleListClient 需要的"模板元数据"。
   * 在 create mode 下未保存前为 undefined,Sheet 入口将禁用提示先保存。
   */
  workflowMeta?: {
    id: string;
    name: string;
    inputFields: InputFieldDef[];
  };
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

export function WorkflowEditor({
  initialData,
  mode,
  skills,
  toolParamSpecs,
  initialSchedules = [],
  workflowMeta,
}: WorkflowEditorProps) {
  const router = useRouter();

  // ── Workflow metadata ──
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(
    initialData?.description ?? ""
  );
  const [category, setCategory] = useState<Category>(
    (initialData?.category as Category) ?? "custom"
  );

  // 2026-05-29 移除 triggerType / triggerConfig / isEnabled 三个 state ——
  // 现在 schedule 由独立的 scheduled_jobs 系统管理,编辑器只编辑模板定义本身。

  // ── Schedule state (lifted from Sheet so TriggerCard 可以显示实时数量) ──
  const [schedules, setSchedules] = useState<ScheduledJob[]>(initialSchedules);
  const [scheduleSheetOpen, setScheduleSheetOpen] = useState(false);

  const enabledScheduleCount = useMemo(
    () => schedules.filter((s) => s.enabled).length,
    [schedules],
  );
  const nextScheduleSummary = useMemo(() => {
    const firstEnabled = schedules.find((s) => s.enabled) ?? schedules[0];
    return firstEnabled ? summarizeCron(firstEnabled.cronExpression) : null;
  }, [schedules]);

  // ── Input fields / prompt template ──
  const [inputFields, setInputFields] = useState<InputFieldDef[]>(
    initialData?.inputFields ?? []
  );
  const [promptTemplate, setPromptTemplate] = useState<string>(
    initialData?.promptTemplate ?? ""
  );

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
    // 2026-05-29 — TriggerCard 现在是 schedule Sheet 入口,不再切换 triggerType。
    // 在 create mode 下模板尚未持久化,先提示保存。
    if (!workflowMeta) {
      toast.info("请先保存工作流,然后再配置定时任务");
      return;
    }
    setScheduleSheetOpen(true);
  }, [workflowMeta]);

  // ── Workflow actions ──

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      toast.error("请先填写工作流名称");
      return;
    }
    setSaving(true);
    try {
      if (mode === "edit" && initialData?.id) {
        const result = await updateWorkflow(initialData.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          category,
          // triggerType / triggerConfig 已 deprecated(ADR-0002),传固定 default
          // 保持 server action 签名兼容。真正的调度在 scheduled_jobs 表上,
          // 由 /workflows/[id] 详情页或本编辑器 TriggerCard 打开的 Sheet 管理。
          triggerType: "manual",
          triggerConfig: null,
          steps: stepsHook.steps,
          inputFields,
          promptTemplate: promptTemplate.trim() || undefined,
        });
        // 2026-05-30:builtin + 非 super admin 的编辑会被 server action 自动
        // fork 成新副本(避免改动丢失)。此时 result.forked=true,跳到新副本 url。
        if (result.forked) {
          stepsHook.setHasChanges(false);
          toast.success("已自动复制为我的工作流（原内置模板不可修改）");
          router.push(`/workflows/${result.id}/edit`);
        } else {
          // 保存后停留在当前页 —— 清掉"未保存改动"标记，给一个 toast 反馈。
          stepsHook.setHasChanges(false);
          toast.success("保存成功");
        }
      } else {
        const created = await saveWorkflow({
          name: name.trim(),
          description: description.trim() || undefined,
          category,
          triggerType: "manual",
          triggerConfig: null,
          steps: stepsHook.steps,
          inputFields,
          promptTemplate: promptTemplate.trim() || undefined,
        });
        // 创建成功 → 跳到该工作流的 edit 页（mode=edit），用户继续在同一个工作流上
        // 调整不会产生副本；同时让 toast 在新页面上展示（sonner 是全局 Toaster）。
        toast.success("保存成功");
        if (created?.id) {
          router.push(`/workflows/${created.id}/edit`);
        }
      }
    } catch (err) {
      console.error("Failed to save workflow:", err);
      toast.error(
        err instanceof Error ? `保存失败：${err.message}` : "保存失败",
      );
    } finally {
      setSaving(false);
    }
  }, [
    mode,
    initialData?.id,
    name,
    description,
    category,
    stepsHook,
    inputFields,
    promptTemplate,
    router,
  ]);

  const [testInputsOpen, setTestInputsOpen] = useState(false);

  const runTestWithInputs = useCallback(
    async (userInputs: Record<string, unknown>) => {
      setTestResultStepId(null);
      if (rightPanelMode === "testResult") {
        setRightPanelMode("add");
      }
      await testRun.startTestRun(
        stepsHook.steps,
        // 测试运行始终以 "手动触发" 模拟;定时触发不需要测试模拟
        "manual",
        null,
        {
          userInputs,
          promptTemplate,
          inputFields,
        },
      );
    },
    [
      testRun,
      stepsHook.steps,
      rightPanelMode,
      promptTemplate,
      inputFields,
    ],
  );

  const handleTestRun = useCallback(async () => {
    // If the workflow declares input fields, collect them first so the
    // simulated run has concrete context. Otherwise kick off immediately.
    if (inputFields.length > 0) {
      setTestInputsOpen(true);
      return;
    }
    await runTestWithInputs({});
  }, [inputFields, runTestWithInputs]);

  // ── AI chat callback ──

  const handleWorkflowGenerated = useCallback(
    (data: {
      name: string;
      description: string;
      category: Category;
      /** @deprecated 仍在 payload 里以兼容旧 AI 输出,但本编辑器不再消费 */
      triggerType?: "manual" | "scheduled";
      /** @deprecated 同上 */
      triggerConfig?: { cron?: string; timezone?: string } | null;
      steps: WorkflowStepDef[];
    }) => {
      setName(data.name);
      setDescription(data.description);
      setCategory(data.category);
      // 2026-05-29 — AI 生成 payload 里的 triggerType/triggerConfig 直接丢弃,
      // 用户应在保存后通过 TriggerCard 进 Sheet 自助配置 schedule
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
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="space-y-4 rounded-2xl border border-sky-100 bg-sky-50/40 p-4">
              <InputFieldsEditor
                value={inputFields}
                onChange={(fields) => {
                  setInputFields(fields);
                  stepsHook.setHasChanges(true);
                }}
              />
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Prompt 模板</h3>
                <Textarea
                  value={promptTemplate}
                  onChange={(e) => {
                    setPromptTemplate(e.target.value);
                    stepsHook.setHasChanges(true);
                  }}
                  placeholder="例：请追踪{{topic_title}}的最新进展……（Mustache 模板，占位符对应上方字段名）"
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  支持 Mustache 占位符：使用上方字段名包在双大括号内，例如 {"{{topic_title}}"}。
                </p>
              </div>
            </div>
            <WorkflowCanvas
              scheduleCount={schedules.length}
              enabledScheduleCount={enabledScheduleCount}
              nextScheduleSummary={nextScheduleSummary}
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
            onSave={handleSave}
            saving={saving}
            testRunning={testRun.testRunning}
            hasChanges={stepsHook.hasChanges}
          />
        </div>

        {/* ── Right: Add/Detail Panel ── */}
        <div className="w-[440px] border-l border-border shrink-0 overflow-y-auto bg-background">
          <RightPanel
            mode={rightPanelMode}
            skills={skills}
            inputFields={inputFields}
            toolParamSpecs={toolParamSpecs}
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

      <TestRunInputsDialog
        open={testInputsOpen}
        onOpenChange={setTestInputsOpen}
        fields={inputFields}
        onConfirm={(values) => {
          void runTestWithInputs(values);
        }}
      />

      {/* 2026-05-29 — schedule 管理 Sheet,由 TriggerCard 触发 */}
      {workflowMeta ? (
        <ScheduleSheet
          open={scheduleSheetOpen}
          onOpenChange={setScheduleSheetOpen}
          workflow={
            {
              id: workflowMeta.id,
              name: workflowMeta.name,
              inputFields: workflowMeta.inputFields,
            } as unknown as WorkflowTemplateRow
          }
          schedules={schedules}
          onSchedulesChange={setSchedules}
        />
      ) : null}
    </div>
  );
}

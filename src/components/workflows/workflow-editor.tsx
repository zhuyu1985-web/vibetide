"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  MessageSquare,
  Plus,
  Wrench,
  Sparkles,
  X,
} from "lucide-react";
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

  // ── Steps ──
  const [steps, setSteps] = useState<WorkflowStepDef[]>(
    initialData?.steps ?? []
  );
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  // ── Right panel mode ──
  const [rightPanelMode, setRightPanelMode] = useState<"add" | "detail">(
    "add"
  );

  // ── UI state ──
  const [saving, setSaving] = useState(false);
  const [testRunning, setTestRunning] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // ── Test run simulation state ──
  const [triggerStatus, setTriggerStatus] = useState<
    "idle" | "running" | "completed"
  >("idle");
  const [stepStatuses, setStepStatuses] = useState<
    Record<string, { status: string; message?: string }>
  >({});

  // ── AI chat (left panel) ──
  const [chatInput, setChatInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [showGuide, setShowGuide] = useState(mode === "create");

  // ── Step management handlers ──

  const handleAddSkillStep = useCallback(
    (skillSlug: string, skillName: string, skillCategory: string) => {
      const newStep: WorkflowStepDef = {
        id: crypto.randomUUID(),
        order: steps.length + 1,
        dependsOn: steps.length > 0 ? [steps[steps.length - 1].id] : [],
        name: skillName,
        type: "skill",
        config: {
          skillSlug,
          skillName,
          skillCategory,
          parameters: {},
        },
      };
      setSteps((prev) => [...prev, newStep]);
      setHasChanges(true);
    },
    [steps]
  );

  const handleAddOutputStep = useCallback(
    (action: string, actionLabel: string) => {
      const newStep: WorkflowStepDef = {
        id: crypto.randomUUID(),
        order: steps.length + 1,
        dependsOn: steps.length > 0 ? [steps[steps.length - 1].id] : [],
        name: actionLabel,
        type: "output",
        config: {
          outputAction: action,
          parameters: {},
        },
      };
      setSteps((prev) => [...prev, newStep]);
      setHasChanges(true);
    },
    [steps]
  );

  const handleAddAIStep = useCallback(
    (aiDescription: string) => {
      const newStep: WorkflowStepDef = {
        id: crypto.randomUUID(),
        order: steps.length + 1,
        dependsOn: steps.length > 0 ? [steps[steps.length - 1].id] : [],
        name: "AI 自定义",
        type: "skill",
        config: {
          skillSlug: "ai_custom",
          skillName: "AI 自定义",
          skillCategory: "generation",
          description: aiDescription,
          parameters: {},
        },
      };
      setSteps((prev) => [...prev, newStep]);
      setHasChanges(true);
    },
    [steps]
  );

  const handleStepClick = useCallback(
    (stepId: string) => {
      setSelectedStepId(stepId);
      setRightPanelMode("detail");
    },
    []
  );

  const handleSaveStep = useCallback((updatedStep: WorkflowStepDef) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === updatedStep.id ? updatedStep : s))
    );
    setHasChanges(true);
  }, []);

  const handleDeleteStep = useCallback(
    (stepId: string) => {
      setSteps((prev) => {
        const filtered = prev.filter((s) => s.id !== stepId);
        return filtered.map((s, idx) => ({ ...s, order: idx + 1 }));
      });
      if (selectedStepId === stepId) {
        setSelectedStepId(null);
        setRightPanelMode("add");
      }
      setHasChanges(true);
    },
    [selectedStepId]
  );

  const handleMoveUp = useCallback((stepId: string) => {
    setSteps((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((s) => s.id === stepId);
      if (idx <= 0) return prev;
      const newSteps = [...sorted];
      const temp = newSteps[idx].order;
      newSteps[idx] = { ...newSteps[idx], order: newSteps[idx - 1].order };
      newSteps[idx - 1] = { ...newSteps[idx - 1], order: temp };
      return newSteps;
    });
    setHasChanges(true);
  }, []);

  const handleMoveDown = useCallback((stepId: string) => {
    setSteps((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((s) => s.id === stepId);
      if (idx < 0 || idx >= sorted.length - 1) return prev;
      const newSteps = [...sorted];
      const temp = newSteps[idx].order;
      newSteps[idx] = { ...newSteps[idx], order: newSteps[idx + 1].order };
      newSteps[idx + 1] = { ...newSteps[idx + 1], order: temp };
      return newSteps;
    });
    setHasChanges(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedStepId(null);
    setRightPanelMode("add");
  }, []);

  const handleAddStepFromBar = useCallback(() => {
    setRightPanelMode("add");
    setSelectedStepId(null);
  }, []);

  const handleTriggerClick = useCallback(() => {
    // Toggle trigger type
    setTriggerType((prev) =>
      prev === "manual" ? "scheduled" : "manual"
    );
    setHasChanges(true);
  }, []);

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
          steps,
        });
      } else {
        await saveWorkflow({
          name: name.trim(),
          description: description.trim() || undefined,
          category,
          triggerType,
          triggerConfig,
          steps,
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
    steps,
    router,
  ]);

  const handleTestRun = useCallback(() => {
    if (testRunning) return;
    setTestRunning(true);
    setTriggerStatus("running");
    setStepStatuses({});

    // Simulate: trigger completes after 1s
    setTimeout(() => {
      setTriggerStatus("completed");

      // Then each step completes after 2s delay each
      const sortedSteps = [...steps].sort((a, b) => a.order - b.order);
      sortedSteps.forEach((step, idx) => {
        // Mark as running
        setTimeout(() => {
          setStepStatuses((prev) => ({
            ...prev,
            [step.id]: { status: "running" },
          }));
        }, idx * 2000);

        // Mark as completed
        setTimeout(() => {
          setStepStatuses((prev) => ({
            ...prev,
            [step.id]: { status: "completed", message: "模拟完成" },
          }));

          // If last step, end test
          if (idx === sortedSteps.length - 1) {
            setTimeout(() => {
              setTestRunning(false);
            }, 500);
          }
        }, (idx + 1) * 2000);
      });

      // If no steps, end test immediately
      if (sortedSteps.length === 0) {
        setTimeout(() => {
          setTestRunning(false);
        }, 500);
      }
    }, 1000);
  }, [testRunning, steps]);

  const handleToggleEnabled = useCallback(() => {
    setIsEnabled((prev) => !prev);
    setHasChanges(true);
  }, []);

  // ── AI chat ──

  const handleChatSend = useCallback(() => {
    if (!chatInput.trim()) return;
    setChatInput("");
    // Placeholder: show a message saying AI generation coming soon
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
    }, 1000);
  }, [chatInput]);

  // ── Derived ──

  const selectedStep = steps.find((s) => s.id === selectedStepId) ?? null;

  // ── Render ──

  return (
    <div className="flex flex-col h-full">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background shrink-0">
        <button
          onClick={() => router.push("/workflows")}
          className="p-2 rounded-lg bg-transparent text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <Input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setHasChanges(true);
          }}
          placeholder="输入工作流名称"
          className="max-w-sm text-base font-medium border-transparent bg-transparent hover:bg-black/[0.03] dark:hover:bg-white/[0.04] focus:bg-background focus:border-border transition-colors"
        />

        <Select
          value={category}
          onValueChange={(v) => {
            setCategory(v as Category);
            setHasChanges(true);
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
        <div className="w-[280px] border-r border-border flex flex-col shrink-0 bg-muted/30">
          {/* Header */}
          <div className="px-4 pt-5 pb-3">
            <h2 className="text-sm font-semibold text-foreground">
              创建您的自定义工作流
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              描述您的任务，让 AI 自动完成
            </p>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto px-4 py-2">
            {/* Guide bubble */}
            {showGuide && (
              <div className="relative mt-4 mb-4">
                <div className="rounded-xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 p-4">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        从这里开始！
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        描述要自动化的内容，AI 将为您构建
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowGuide(false)}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-purple-500/10 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition-colors cursor-pointer"
                  >
                    知道了
                  </button>
                </div>
                {/* Arrow pointing down to input */}
                <div className="flex justify-center mt-2">
                  <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-purple-500/20" />
                </div>
              </div>
            )}

            {/* AI generation status */}
            {generating && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>AI 工作流生成即将推出</span>
              </div>
            )}
          </div>

          {/* Input area at bottom */}
          <div className="px-4 py-3 border-t border-border shrink-0">
            <div className="relative">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleChatSend();
                  }
                }}
                placeholder="描述要自动化的内容..."
                rows={2}
                className="w-full rounded-xl bg-black/[0.03] dark:bg-white/[0.04] px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring transition-colors border-0"
              />
            </div>
            <div className="flex items-center gap-1 mt-2">
              <button className="p-1.5 rounded-lg bg-transparent text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer">
                <Plus className="w-4 h-4" />
              </button>
              <button className="p-1.5 rounded-lg bg-transparent text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer">
                <Wrench className="w-4 h-4" />
              </button>
              <button className="p-1.5 rounded-lg bg-transparent text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer">
                <MessageSquare className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Center: Canvas + Bottom Bar ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
          <div className="flex-1 overflow-y-auto p-6">
            <WorkflowCanvas
              triggerType={triggerType}
              triggerConfig={triggerConfig}
              steps={steps}
              selectedStepId={selectedStepId}
              testRunning={testRunning}
              triggerStatus={triggerStatus}
              stepStatuses={stepStatuses}
              onTriggerClick={handleTriggerClick}
              onStepClick={handleStepClick}
              onStepEdit={handleStepClick}
              onStepDelete={handleDeleteStep}
              onStepMoveUp={handleMoveUp}
              onStepMoveDown={handleMoveDown}
              onAddStep={handleAddStepFromBar}
            />
          </div>
          <BottomActionBar
            onTestRun={handleTestRun}
            onToggleEnabled={handleToggleEnabled}
            onSave={handleSave}
            isEnabled={isEnabled}
            triggerType={triggerType}
            saving={saving}
            testRunning={testRunning}
            hasChanges={hasChanges}
          />
        </div>

        {/* ── Right: Add/Detail Panel ── */}
        <div className="w-[300px] border-l border-border shrink-0 overflow-y-auto bg-background">
          <RightPanel
            mode={rightPanelMode}
            onAddSkillStep={handleAddSkillStep}
            onAddOutputStep={handleAddOutputStep}
            onAddAIStep={handleAddAIStep}
            selectedStep={selectedStep}
            onSaveStep={handleSaveStep}
            onCloseDetail={handleCloseDetail}
          />
        </div>
      </div>
    </div>
  );
}

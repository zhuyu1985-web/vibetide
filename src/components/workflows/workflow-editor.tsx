"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StepList } from "./step-list";
import { AddStepPanel } from "./add-step-panel";
import { StepConfigPanel } from "./step-config-panel";
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

const TRIGGER_TYPES = [
  { value: "manual", label: "手动触发" },
  { value: "scheduled", label: "定时触发" },
] as const;

type Category = "news" | "video" | "analytics" | "distribution" | "custom";
type TriggerType = "manual" | "scheduled";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkflowEditor({ initialData, mode }: WorkflowEditorProps) {
  const router = useRouter();

  // ── State ──
  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(
    initialData?.description ?? ""
  );
  const [category, setCategory] = useState<Category>(
    (initialData?.category as Category) ?? "custom"
  );
  const [triggerType, setTriggerType] = useState<TriggerType>(
    (initialData?.triggerType as TriggerType) ?? "manual"
  );
  const [steps, setSteps] = useState<WorkflowStepDef[]>(
    initialData?.steps ?? []
  );
  const [editingStep, setEditingStep] = useState<WorkflowStepDef | null>(null);
  const [configPanelOpen, setConfigPanelOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Step handlers ──

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
    },
    [steps]
  );

  const handleEditStep = useCallback(
    (stepId: string) => {
      const step = steps.find((s) => s.id === stepId);
      if (step) {
        setEditingStep(step);
        setConfigPanelOpen(true);
      }
    },
    [steps]
  );

  const handleSaveStep = useCallback((updatedStep: WorkflowStepDef) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === updatedStep.id ? updatedStep : s))
    );
  }, []);

  const handleDeleteStep = useCallback((stepId: string) => {
    setSteps((prev) => {
      const filtered = prev.filter((s) => s.id !== stepId);
      // Re-number order
      return filtered.map((s, idx) => ({ ...s, order: idx + 1 }));
    });
  }, []);

  const handleMoveUp = useCallback((stepId: string) => {
    setSteps((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((s) => s.id === stepId);
      if (idx <= 0) return prev;
      // Swap order values
      const newSteps = [...sorted];
      const temp = newSteps[idx].order;
      newSteps[idx] = { ...newSteps[idx], order: newSteps[idx - 1].order };
      newSteps[idx - 1] = { ...newSteps[idx - 1], order: temp };
      return newSteps;
    });
  }, []);

  const handleMoveDown = useCallback((stepId: string) => {
    setSteps((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((s) => s.id === stepId);
      if (idx < 0 || idx >= sorted.length - 1) return prev;
      // Swap order values
      const newSteps = [...sorted];
      const temp = newSteps[idx].order;
      newSteps[idx] = { ...newSteps[idx], order: newSteps[idx + 1].order };
      newSteps[idx + 1] = { ...newSteps[idx + 1], order: temp };
      return newSteps;
    });
  }, []);

  const handleOpenAddPanel = useCallback(() => {
    // The add panel is always visible on the right, this is a no-op placeholder
    // for the StepList onAddStep callback — scrolls right panel into view on mobile
  }, []);

  // ── Save ──

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
          steps,
        });
      } else {
        await saveWorkflow({
          name: name.trim(),
          description: description.trim() || undefined,
          category,
          triggerType,
          steps,
        });
      }
      router.push("/workflows");
    } catch (err) {
      console.error("Failed to save workflow:", err);
    } finally {
      setSaving(false);
    }
  }, [mode, initialData?.id, name, description, category, triggerType, steps, router]);

  // ── Render ──

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-background shrink-0">
        <button
          onClick={() => router.push("/workflows")}
          className="p-2 rounded-lg bg-transparent border-0 text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="输入工作流名称"
          className="max-w-sm text-base font-medium"
        />

        <div className="flex-1" />

        <button
          onClick={() => router.push("/workflows")}
          className="px-4 py-2 rounded-xl bg-transparent border-0 text-sm text-muted-foreground hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
        >
          取消
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm border-0 cursor-pointer transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          {saving ? "保存中..." : "保存"}
        </button>
      </div>

      {/* ── Body: Two-column layout ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left column: meta fields + step list */}
        <div className="flex-1 overflow-y-auto p-6 border-r border-border">
          {/* Meta fields */}
          <div className="mb-8 space-y-4 max-w-lg">
            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                工作流描述
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="简要描述工作流的目的和用途"
                className="min-h-[60px] resize-none"
              />
            </div>

            <div className="flex gap-4">
              {/* Trigger type */}
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-xs font-medium text-muted-foreground">
                  触发方式
                </label>
                <Select
                  value={triggerType}
                  onValueChange={(v) => setTriggerType(v as TriggerType)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Category */}
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-xs font-medium text-muted-foreground">
                  分类
                </label>
                <Select
                  value={category}
                  onValueChange={(v) => setCategory(v as Category)}
                >
                  <SelectTrigger className="w-full">
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
              </div>
            </div>
          </div>

          {/* Step list */}
          <div className="max-w-lg">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              工作流步骤
            </h3>
            <StepList
              steps={steps}
              onEdit={handleEditStep}
              onDelete={handleDeleteStep}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
              onAddStep={handleOpenAddPanel}
            />
          </div>

          {/* AI Auto-plan banner */}
          <div className="mt-8 max-w-lg">
            <div className="rounded-xl bg-black/[0.02] dark:bg-white/[0.03] p-4 flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-500/10">
                <Sparkles className="w-4 h-4 text-purple-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  AI 自动规划
                </p>
                <p className="text-xs text-muted-foreground">
                  基于目标自动生成工作流步骤
                </p>
              </div>
              <span className="shrink-0 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500 text-[10px] font-medium">
                即将推出
              </span>
            </div>
          </div>
        </div>

        {/* Right column: add step panel */}
        <div className="w-80 shrink-0 overflow-y-auto p-6 bg-black/[0.01] dark:bg-white/[0.01]">
          <AddStepPanel
            onAddSkillStep={handleAddSkillStep}
            onAddOutputStep={handleAddOutputStep}
          />
        </div>
      </div>

      {/* Step config panel (Sheet overlay) */}
      <StepConfigPanel
        step={editingStep}
        open={configPanelOpen}
        onClose={() => {
          setConfigPanelOpen(false);
          setEditingStep(null);
        }}
        onSave={handleSaveStep}
      />
    </div>
  );
}

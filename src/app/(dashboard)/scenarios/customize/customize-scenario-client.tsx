"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Check,
  Plus,
  X,
  Save,
  Settings2,
  Users,
  Workflow,
  FormInput,
} from "lucide-react";
import {
  ADVANCED_SCENARIO_CONFIG,
  ADVANCED_SCENARIO_KEYS,
  EMPLOYEE_META,
  type AdvancedScenarioKey,
  type EmployeeId,
} from "@/lib/constants";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CustomInputField {
  name: string;
  label: string;
  type: "text" | "textarea" | "select";
  required: boolean;
  placeholder?: string;
  options?: string[];
}

interface CustomWorkflowStep {
  id: string;
  employeeSlug: EmployeeId;
  title: string;
  skills: string[];
  description: string;
  enabled: boolean;
}

interface CustomScenario {
  id: string;
  name: string;
  baseKey: AdvancedScenarioKey;
  teamMembers: EmployeeId[];
  workflowSteps: CustomWorkflowStep[];
  inputFields: CustomInputField[];
  createdAt: string;
}

const STORAGE_KEY = "vibetide_custom_scenarios";

function loadCustomScenarios(): CustomScenario[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CustomScenario[]) : [];
  } catch {
    return [];
  }
}

function saveCustomScenarios(scenarios: CustomScenario[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
  } catch {
    // silently ignore storage errors
  }
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const STEPS = [
  { id: "base", label: "选基础场景", icon: Settings2 },
  { id: "team", label: "调整团队", icon: Users },
  { id: "workflow", label: "调整步骤", icon: Workflow },
  { id: "fields", label: "输入字段", icon: FormInput },
  { id: "save", label: "保存", icon: Save },
] as const;

type StepId = (typeof STEPS)[number]["id"];

// ---------------------------------------------------------------------------
// All available employees for adding to team
// ---------------------------------------------------------------------------

const ALL_EMPLOYEE_IDS = Object.keys(EMPLOYEE_META).filter(
  (id) => id !== "leader" && id !== "advisor"
) as EmployeeId[];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CustomizeScenarioClient() {
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState<StepId>("base");
  const [selectedBase, setSelectedBase] = useState<AdvancedScenarioKey | null>(null);
  const [teamMembers, setTeamMembers] = useState<EmployeeId[]>([]);
  const [workflowSteps, setWorkflowSteps] = useState<CustomWorkflowStep[]>([]);
  const [inputFields, setInputFields] = useState<CustomInputField[]>([]);
  const [scenarioName, setScenarioName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // When a base scenario is chosen, populate defaults
  const handleSelectBase = useCallback((key: AdvancedScenarioKey) => {
    const sc = ADVANCED_SCENARIO_CONFIG[key];
    setSelectedBase(key);
    setTeamMembers([...sc.teamMembers]);
    setWorkflowSteps(
      sc.workflowSteps.map((step, idx) => ({
        id: `step_${idx}`,
        employeeSlug: step.employeeSlug,
        title: step.title,
        skills: [...step.skills],
        description: step.description,
        enabled: true,
      }))
    );
    setInputFields(
      sc.inputFields.map((f) => ({
        name: f.name,
        label: f.label,
        type: f.type,
        required: f.required,
        placeholder: f.placeholder,
        options: f.options ? [...f.options] : undefined,
      }))
    );
    setScenarioName(`${sc.label} · 自定义`);
  }, []);

  const stepIndex = STEPS.findIndex((s) => s.id === currentStep);

  const canAdvance =
    currentStep === "base"
      ? selectedBase !== null
      : currentStep === "save"
      ? scenarioName.trim().length > 0
      : true;

  const handleNext = useCallback(() => {
    if (stepIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[stepIndex + 1].id);
    }
  }, [stepIndex]);

  const handleBack = useCallback(() => {
    if (stepIndex > 0) {
      setCurrentStep(STEPS[stepIndex - 1].id);
    } else {
      router.back();
    }
  }, [stepIndex, router]);

  // ── Team member handlers ──

  const handleAddMember = useCallback((id: EmployeeId) => {
    setTeamMembers((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const handleRemoveMember = useCallback((id: EmployeeId) => {
    setTeamMembers((prev) => prev.filter((m) => m !== id));
  }, []);

  // ── Workflow step handlers ──

  const handleToggleStep = useCallback((stepId: string) => {
    setWorkflowSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, enabled: !s.enabled } : s))
    );
  }, []);

  const handleMoveStepUp = useCallback((idx: number) => {
    if (idx === 0) return;
    setWorkflowSteps((prev) => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  }, []);

  const handleMoveStepDown = useCallback((idx: number) => {
    setWorkflowSteps((prev) => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  }, []);

  // ── Input field handlers ──

  const handleFieldLabelChange = useCallback((idx: number, value: string) => {
    setInputFields((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, label: value } : f))
    );
  }, []);

  const handleFieldPlaceholderChange = useCallback((idx: number, value: string) => {
    setInputFields((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, placeholder: value } : f))
    );
  }, []);

  const handleRemoveField = useCallback((idx: number) => {
    setInputFields((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleAddTextField = useCallback(() => {
    setInputFields((prev) => [
      ...prev,
      {
        name: `field_${Date.now()}`,
        label: "新字段",
        type: "text" as const,
        required: false,
        placeholder: "",
      },
    ]);
  }, []);

  // ── Save ──

  const handleSave = useCallback(() => {
    if (!selectedBase || !scenarioName.trim()) return;
    setIsSaving(true);
    try {
      const newScenario: CustomScenario = {
        id: `custom_${Date.now()}`,
        name: scenarioName.trim(),
        baseKey: selectedBase,
        teamMembers,
        workflowSteps,
        inputFields,
        createdAt: new Date().toISOString(),
      };
      const existing = loadCustomScenarios();
      saveCustomScenarios([...existing, newScenario]);
      toast.success(`「${newScenario.name}」已保存到我的场景`);
      router.push("/home");
    } catch {
      toast.error("保存失败，请重试");
    } finally {
      setIsSaving(false);
    }
  }, [selectedBase, scenarioName, teamMembers, workflowSteps, inputFields, router]);

  // ---------------------------------------------------------------------------
  // Render step content
  // ---------------------------------------------------------------------------

  const renderStepContent = () => {
    switch (currentStep) {
      case "base":
        return <StepSelectBase selected={selectedBase} onSelect={handleSelectBase} />;
      case "team":
        return (
          <StepAdjustTeam
            teamMembers={teamMembers}
            onAdd={handleAddMember}
            onRemove={handleRemoveMember}
          />
        );
      case "workflow":
        return (
          <StepAdjustWorkflow
            steps={workflowSteps}
            onToggle={handleToggleStep}
            onMoveUp={handleMoveStepUp}
            onMoveDown={handleMoveStepDown}
          />
        );
      case "fields":
        return (
          <StepAdjustFields
            fields={inputFields}
            onLabelChange={handleFieldLabelChange}
            onPlaceholderChange={handleFieldPlaceholderChange}
            onRemove={handleRemoveField}
            onAddTextField={handleAddTextField}
          />
        );
      case "save":
        return (
          <StepSave
            scenarioName={scenarioName}
            onChange={setScenarioName}
            baseKey={selectedBase}
            teamMembers={teamMembers}
            workflowSteps={workflowSteps}
            inputFields={inputFields}
          />
        );
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 pt-5 pb-3 border-b border-border/40 shrink-0">
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ChevronLeft size={16} />
          {stepIndex === 0 ? "返回" : "上一步"}
        </button>
        <div className="flex-1" />
        <span className="text-sm font-medium text-foreground">自定义场景</span>
        <div className="flex-1" />
        {/* Empty right space for balance */}
        <div className="w-16" />
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-center gap-1 px-6 py-3 shrink-0">
        {STEPS.map((step, idx) => {
          const isCompleted = idx < stepIndex;
          const isCurrent = idx === stepIndex;
          return (
            <div key={step.id} className="flex items-center gap-1">
              <button
                onClick={() => {
                  // Allow clicking back to completed steps
                  if (idx <= stepIndex) {
                    setCurrentStep(step.id);
                  }
                }}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all duration-200",
                  isCurrent
                    ? "bg-indigo-500/15 text-indigo-500 font-medium"
                    : isCompleted
                    ? "text-foreground/60 cursor-pointer hover:text-foreground"
                    : "text-foreground/30 cursor-default"
                )}
              >
                {isCompleted ? (
                  <Check size={10} />
                ) : (
                  <step.icon size={10} />
                )}
                <span className="hidden sm:inline">{step.label}</span>
              </button>
              {idx < STEPS.length - 1 && (
                <div
                  className={cn(
                    "w-4 h-px transition-colors duration-200",
                    idx < stepIndex ? "bg-indigo-500/40" : "bg-border/40"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-6 pb-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="max-w-2xl mx-auto pt-4"
          >
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom action bar */}
      <div className="shrink-0 border-t border-border/40 px-6 py-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          步骤 {stepIndex + 1} / {STEPS.length}
        </span>
        {currentStep === "save" ? (
          <button
            onClick={handleSave}
            disabled={!canAdvance || isSaving}
            className={cn(
              "flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer",
              canAdvance && !isSaving
                ? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-[0_2px_12px_rgba(99,102,241,0.3)] hover:shadow-[0_4px_20px_rgba(99,102,241,0.4)]"
                : "bg-muted text-muted-foreground/40 cursor-not-allowed"
            )}
          >
            <Save size={14} />
            {isSaving ? "保存中…" : "保存到我的场景"}
          </button>
        ) : (
          <button
            onClick={handleNext}
            disabled={!canAdvance}
            className={cn(
              "flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer",
              canAdvance
                ? "bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20"
                : "bg-muted text-muted-foreground/40 cursor-not-allowed"
            )}
          >
            下一步
            <ChevronDown size={14} className="rotate-[-90deg]" />
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-step: Select Base Scenario
// ---------------------------------------------------------------------------

interface StepSelectBaseProps {
  selected: AdvancedScenarioKey | null;
  onSelect: (key: AdvancedScenarioKey) => void;
}

function StepSelectBase({ selected, onSelect }: StepSelectBaseProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">选择基础场景</h2>
        <p className="text-sm text-muted-foreground mt-1">选一个预设场景作为出发点，再按需调整</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {ADVANCED_SCENARIO_KEYS.map((key) => {
          const sc = ADVANCED_SCENARIO_CONFIG[key];
          const isSelected = selected === key;
          return (
            <motion.button
              key={key}
              onClick={() => onSelect(key)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "text-left rounded-xl px-4 py-3.5 transition-all duration-200 cursor-pointer",
                "border-0",
                isSelected
                  ? "ring-2 ring-indigo-500/60 shadow-[0_4px_20px_rgba(99,102,241,0.2)]"
                  : "hover:shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
              )}
              style={{
                background: `linear-gradient(135deg, ${sc.bgColor}, ${sc.bgColor.replace(/[\d.]+\)$/, "0.04)")})`,
              }}
            >
              <div className="flex items-start justify-between mb-2">
                <sc.icon size={20} style={{ color: sc.color }} />
                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                    <Check size={11} className="text-white" />
                  </div>
                )}
              </div>
              <div className="text-sm font-semibold mb-0.5" style={{ color: sc.color }}>
                {sc.emoji} {sc.label}
              </div>
              <div className="text-xs text-muted-foreground/70 line-clamp-2">{sc.description}</div>
              <div className="flex items-center gap-1 mt-2">
                {sc.teamMembers.slice(0, 4).map((id) => (
                  <EmployeeAvatar key={id} employeeId={id} size="xs" />
                ))}
                {sc.teamMembers.length > 4 && (
                  <span className="text-[10px] text-muted-foreground ml-0.5">
                    +{sc.teamMembers.length - 4}
                  </span>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-step: Adjust Team Members
// ---------------------------------------------------------------------------

interface StepAdjustTeamProps {
  teamMembers: EmployeeId[];
  onAdd: (id: EmployeeId) => void;
  onRemove: (id: EmployeeId) => void;
}

function StepAdjustTeam({ teamMembers, onAdd, onRemove }: StepAdjustTeamProps) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">调整团队成员</h2>
        <p className="text-sm text-muted-foreground mt-1">当前团队 {teamMembers.length} 人，点击添加或移除</p>
      </div>

      {/* Current team */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">当前成员</p>
        {teamMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground/60 py-3">暂无成员，请从下方添加</p>
        ) : (
          <div className="space-y-2">
            {teamMembers.map((id) => {
              const meta = EMPLOYEE_META[id];
              return (
                <div
                  key={id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{ background: meta.bgColor }}
                >
                  <EmployeeAvatar employeeId={id} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{meta.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{meta.description}</p>
                  </div>
                  <button
                    onClick={() => onRemove(id)}
                    className="p-1 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Available employees to add */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">添加成员</p>
        <div className="grid grid-cols-2 gap-2">
          {ALL_EMPLOYEE_IDS
            .filter((id) => !teamMembers.includes(id))
            .map((id) => {
              const meta = EMPLOYEE_META[id];
              return (
                <button
                  key={id}
                  onClick={() => onAdd(id)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all duration-150 cursor-pointer hover:shadow-sm text-left"
                  style={{ background: meta.bgColor }}
                >
                  <EmployeeAvatar employeeId={id} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">{meta.name}</p>
                  </div>
                  <Plus size={13} className="text-muted-foreground shrink-0" />
                </button>
              );
            })}
        </div>
        {ALL_EMPLOYEE_IDS.filter((id) => !teamMembers.includes(id)).length === 0 && (
          <p className="text-xs text-muted-foreground/60 py-2">所有员工已加入团队</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-step: Adjust Workflow Steps
// ---------------------------------------------------------------------------

interface StepAdjustWorkflowProps {
  steps: CustomWorkflowStep[];
  onToggle: (stepId: string) => void;
  onMoveUp: (idx: number) => void;
  onMoveDown: (idx: number) => void;
}

function StepAdjustWorkflow({ steps, onToggle, onMoveUp, onMoveDown }: StepAdjustWorkflowProps) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">调整工作流步骤</h2>
        <p className="text-sm text-muted-foreground mt-1">开启/关闭步骤，或拖动调整顺序</p>
      </div>
      <div className="space-y-2">
        {steps.map((step, idx) => {
          const meta = EMPLOYEE_META[step.employeeSlug];
          return (
            <motion.div
              key={step.id}
              layout
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                step.enabled
                  ? "bg-white/60 dark:bg-white/[0.06] shadow-sm"
                  : "bg-muted/30 opacity-50"
              )}
            >
              {/* Order buttons */}
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => onMoveUp(idx)}
                  disabled={idx === 0}
                  className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <ChevronUp size={12} />
                </button>
                <button
                  onClick={() => onMoveDown(idx)}
                  disabled={idx === steps.length - 1}
                  className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <ChevronDown size={12} />
                </button>
              </div>

              {/* Index badge */}
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                style={{ background: meta?.bgColor, color: meta?.color }}
              >
                {idx + 1}
              </div>

              <EmployeeAvatar employeeId={step.employeeSlug} size="sm" />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{step.title}</p>
                <p className="text-xs text-muted-foreground truncate">{step.description}</p>
              </div>

              {/* Toggle */}
              <button
                onClick={() => onToggle(step.id)}
                className={cn(
                  "relative w-9 h-5 rounded-full transition-colors duration-200 cursor-pointer shrink-0",
                  step.enabled ? "bg-indigo-500" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200",
                    step.enabled ? "translate-x-4" : "translate-x-0"
                  )}
                />
              </button>
            </motion.div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground/60">
        已启用 {steps.filter((s) => s.enabled).length} / {steps.length} 个步骤
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-step: Adjust Input Fields
// ---------------------------------------------------------------------------

interface StepAdjustFieldsProps {
  fields: CustomInputField[];
  onLabelChange: (idx: number, value: string) => void;
  onPlaceholderChange: (idx: number, value: string) => void;
  onRemove: (idx: number) => void;
  onAddTextField: () => void;
}

function StepAdjustFields({
  fields,
  onLabelChange,
  onPlaceholderChange,
  onRemove,
  onAddTextField,
}: StepAdjustFieldsProps) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">修改输入字段</h2>
        <p className="text-sm text-muted-foreground mt-1">自定义启动场景时需要填写的内容</p>
      </div>

      <div className="space-y-3">
        {fields.map((field, idx) => (
          <div
            key={field.name}
            className="rounded-xl border border-border/40 bg-white/40 dark:bg-white/[0.04] p-3 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {field.type === "select" ? "下拉选择" : field.type === "textarea" ? "多行文本" : "单行文本"}
                {field.required && <span className="ml-1 text-red-400">*必填</span>}
              </span>
              <button
                onClick={() => onRemove(idx)}
                className="p-1 text-muted-foreground hover:text-red-500 transition-colors cursor-pointer"
              >
                <X size={13} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">字段名称</label>
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => onLabelChange(idx, e.target.value)}
                  className="w-full text-sm px-2.5 py-1.5 rounded-lg bg-background border border-border/40 outline-none focus:border-indigo-400 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">占位提示</label>
                <input
                  type="text"
                  value={field.placeholder ?? ""}
                  onChange={(e) => onPlaceholderChange(idx, e.target.value)}
                  className="w-full text-sm px-2.5 py-1.5 rounded-lg bg-background border border-border/40 outline-none focus:border-indigo-400 transition-colors"
                  placeholder="可选"
                />
              </div>
            </div>
            {field.options && field.options.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {field.options.map((opt) => (
                  <span
                    key={opt}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-accent text-muted-foreground"
                  >
                    {opt}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={onAddTextField}
        className="flex items-center gap-2 text-sm text-indigo-500 hover:text-indigo-600 transition-colors cursor-pointer py-1"
      >
        <Plus size={15} />
        添加文本字段
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-step: Save / Name
// ---------------------------------------------------------------------------

interface StepSaveProps {
  scenarioName: string;
  onChange: (name: string) => void;
  baseKey: AdvancedScenarioKey | null;
  teamMembers: EmployeeId[];
  workflowSteps: CustomWorkflowStep[];
  inputFields: CustomInputField[];
}

function StepSave({ scenarioName, onChange, baseKey, teamMembers, workflowSteps, inputFields }: StepSaveProps) {
  const baseConfig = baseKey ? ADVANCED_SCENARIO_CONFIG[baseKey] : null;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">命名并保存</h2>
        <p className="text-sm text-muted-foreground mt-1">给你的场景起个名字，保存到"我的场景"</p>
      </div>

      {/* Name input */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">场景名称</label>
        <input
          type="text"
          value={scenarioName}
          onChange={(e) => onChange(e.target.value)}
          placeholder="例：两会报道 · 精简版"
          className="w-full text-sm px-3.5 py-2.5 rounded-xl bg-background border border-border/60 outline-none focus:border-indigo-400 transition-colors"
          autoFocus
          maxLength={40}
        />
        <p className="text-xs text-muted-foreground mt-1 text-right">{scenarioName.length}/40</p>
      </div>

      {/* Summary card */}
      <div className="rounded-xl bg-white/40 dark:bg-white/[0.04] border border-border/40 p-4 space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">场景预览</p>

        {baseConfig && (
          <div className="flex items-center gap-2">
            <baseConfig.icon size={16} style={{ color: baseConfig.color }} />
            <span className="text-sm text-foreground/80">基于「{baseConfig.label}」</span>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">团队成员：</span>
          <div className="flex items-center -space-x-1">
            {teamMembers.map((id) => (
              <EmployeeAvatar key={id} employeeId={id} size="xs" />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">{teamMembers.length} 人</span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>工作流：</span>
          <span className="font-medium text-foreground/80">
            {workflowSteps.filter((s) => s.enabled).length} 个步骤已启用
          </span>
          {workflowSteps.some((s) => !s.enabled) && (
            <span>（{workflowSteps.filter((s) => !s.enabled).length} 个已关闭）</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>输入字段：</span>
          <span className="font-medium text-foreground/80">{inputFields.length} 个</span>
        </div>
      </div>
    </div>
  );
}

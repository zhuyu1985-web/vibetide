"use client";

import { useState, useMemo, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  EMPLOYEE_META,
  EMPLOYEE_CORE_SKILLS,
  type EmployeeId,
} from "@/lib/constants";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { createCustomEmployee } from "@/app/actions/custom-employees";
import type { Skill } from "@/lib/types";
import type { KnowledgeBaseInfo } from "@/lib/types";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  BookOpen,
  Wrench,
  Eye,
  Database,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateEmployeeClientProps {
  skills: Skill[];
  knowledgeBases: KnowledgeBaseInfo[];
}

// 8 base templates (exclude advisor & leader)
const BASE_TEMPLATE_IDS: EmployeeId[] = [
  "xiaolei",
  "xiaoce",
  "xiaozi",
  "xiaowen",
  "xiaojian",
  "xiaoshen",
  "xiaofa",
  "xiaoshu",
];

const STEPS = [
  { label: "基础信息", icon: BookOpen },
  { label: "能力配置", icon: Wrench },
  { label: "预览发布", icon: Eye },
] as const;

// ---------------------------------------------------------------------------
// Step Indicator
// ---------------------------------------------------------------------------

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-10">
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const done = i < current;
        const active = i === current;
        return (
          <div key={step.label} className="flex items-center">
            {/* dot / circle */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                  done
                    ? "bg-blue-500/15 text-blue-500"
                    : active
                      ? "bg-blue-500/10 text-blue-500 ring-2 ring-blue-500/30"
                      : "bg-black/[0.04] dark:bg-white/[0.06] text-gray-300 dark:text-white/25"
                }`}
              >
                {done ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
              </div>
              <span
                className={`text-xs font-medium transition-colors ${
                  done || active
                    ? "text-gray-700 dark:text-white/80"
                    : "text-gray-300 dark:text-white/25"
                }`}
              >
                {step.label}
              </span>
            </div>
            {/* line between dots */}
            {i < STEPS.length - 1 && (
              <div
                className={`w-16 h-[2px] mx-3 mb-5 rounded-full transition-colors ${
                  i < current
                    ? "bg-blue-500/30"
                    : "bg-black/[0.06] dark:bg-white/[0.06]"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CreateEmployeeClient({
  skills,
  knowledgeBases,
}: CreateEmployeeClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Wizard state
  const [step, setStep] = useState(0);

  // Step 1 state
  const [selectedTemplate, setSelectedTemplate] = useState<EmployeeId | null>(
    null,
  );
  const [customName, setCustomName] = useState("");
  const [customDesc, setCustomDesc] = useState("");

  // Step 2 state
  const [instructions, setInstructions] = useState("");
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedKBIds, setSelectedKBIds] = useState<Set<string>>(new Set());

  // Step 3 state
  const [visibility, setVisibility] = useState<"org" | "private">("org");
  const [error, setError] = useState<string | null>(null);

  // ── Derived: core skill slugs for selected template ──
  const templateCoreSkillSlugs = useMemo(() => {
    if (!selectedTemplate) return new Set<string>();
    return new Set(EMPLOYEE_CORE_SKILLS[selectedTemplate] || []);
  }, [selectedTemplate]);

  // Map skill slugs to actual DB skill IDs
  const slugToSkillId = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of skills) {
      // Skills may not have a slug field in the Skill type, use name as fallback
      // The name in BUILTIN_SKILL_NAMES is the Chinese display name,
      // but EMPLOYEE_CORE_SKILLS uses slug-like keys (e.g. "web_search").
      // The skills DAL returns id, name, category etc. The slug is in the DB
      // but not exposed in the Skill type. We can match by iterating.
      // For now, we'll match by checking if the skill ID or name matches.
      map.set(s.name, s.id);
    }
    return map;
  }, [skills]);

  // ── When template changes, pre-select core skills ──
  const handleTemplateSelect = useCallback(
    (templateId: EmployeeId) => {
      setSelectedTemplate(templateId);
      const meta = EMPLOYEE_META[templateId];

      // Pre-fill instructions
      setInstructions(
        `你是一位${meta.name}，擅长${meta.description}。请按照以下规则工作：`,
      );

      // Pre-select core skills for this template
      const coreSlugs = EMPLOYEE_CORE_SKILLS[templateId] || [];
      const preSelected = new Set<string>();
      for (const slug of coreSlugs) {
        // Try to find matching skill by checking if any skill name/id relates
        for (const s of skills) {
          if (s.id === slug || s.name === slug) {
            preSelected.add(s.id);
          }
        }
      }
      setSelectedSkillIds(preSelected);
    },
    [skills],
  );

  // ── Skill toggle ──
  const toggleSkill = useCallback((skillId: string) => {
    setSelectedSkillIds((prev) => {
      const next = new Set(prev);
      if (next.has(skillId)) {
        next.delete(skillId);
      } else {
        next.add(skillId);
      }
      return next;
    });
  }, []);

  // ── KB toggle ──
  const toggleKB = useCallback((kbId: string) => {
    setSelectedKBIds((prev) => {
      const next = new Set(prev);
      if (next.has(kbId)) {
        next.delete(kbId);
      } else {
        next.add(kbId);
      }
      return next;
    });
  }, []);

  // ── Navigation validation ──
  const canGoNext = useMemo(() => {
    if (step === 0) return selectedTemplate !== null && customName.trim() !== "";
    if (step === 1) return true; // instructions optional
    return true;
  }, [step, selectedTemplate, customName]);

  // ── Submit ──
  const handlePublish = useCallback(() => {
    if (!selectedTemplate || !customName.trim()) return;
    setError(null);

    startTransition(async () => {
      try {
        await createCustomEmployee({
          baseTemplateSlug: selectedTemplate,
          name: customName.trim(),
          description: customDesc.trim(),
          instructions: instructions.trim() || undefined,
          skillIds: Array.from(selectedSkillIds),
          knowledgeBaseIds: Array.from(selectedKBIds),
          visibility,
        });
        router.push("/ai-employees");
      } catch (e) {
        setError(e instanceof Error ? e.message : "创建失败，请重试");
      }
    });
  }, [
    selectedTemplate,
    customName,
    customDesc,
    instructions,
    selectedSkillIds,
    selectedKBIds,
    visibility,
    router,
    startTransition,
  ]);

  // ── Template meta for preview ──
  const templateMeta = selectedTemplate
    ? EMPLOYEE_META[selectedTemplate]
    : null;

  return (
    <div className="max-w-[800px] mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white/90 mb-1">
          创建自定义员工
        </h1>
        <p className="text-sm text-gray-400 dark:text-white/40">
          基于预设角色模板，创建属于你的 AI 数字员工
        </p>
      </div>

      {/* Step Indicator */}
      <StepIndicator current={step} />

      {/* Step Content */}
      <div className="min-h-[400px]">
        {step === 0 && (
          <Step1BaseInfo
            selectedTemplate={selectedTemplate}
            onSelectTemplate={handleTemplateSelect}
            customName={customName}
            onNameChange={setCustomName}
            customDesc={customDesc}
            onDescChange={setCustomDesc}
          />
        )}
        {step === 1 && (
          <Step2Skills
            instructions={instructions}
            onInstructionsChange={setInstructions}
            skills={skills}
            selectedSkillIds={selectedSkillIds}
            onToggleSkill={toggleSkill}
            knowledgeBases={knowledgeBases}
            selectedKBIds={selectedKBIds}
            onToggleKB={toggleKB}
          />
        )}
        {step === 2 && (
          <Step3Preview
            templateMeta={templateMeta}
            selectedTemplate={selectedTemplate}
            customName={customName}
            customDesc={customDesc}
            instructions={instructions}
            selectedSkillCount={selectedSkillIds.size}
            selectedKBCount={selectedKBIds.size}
            visibility={visibility}
            onVisibilityChange={setVisibility}
            error={error}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-black/[0.06] dark:border-white/[0.06]">
        <button
          onClick={() => {
            if (step === 0) {
              router.push("/ai-employees");
            } else {
              setStep((s) => s - 1);
            }
          }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] text-sm text-gray-600 dark:text-white/60 hover:bg-black/[0.07] dark:hover:bg-white/[0.1] transition-all cursor-pointer border-0"
        >
          <ChevronLeft className="w-4 h-4" />
          {step === 0 ? "返回" : "上一步"}
        </button>

        {step < 2 ? (
          <button
            disabled={!canGoNext}
            onClick={() => setStep((s) => s + 1)}
            className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-medium transition-all border-0 ${
              canGoNext
                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 cursor-pointer"
                : "bg-black/[0.03] dark:bg-white/[0.04] text-gray-300 dark:text-white/20 cursor-not-allowed"
            }`}
          >
            下一步
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            disabled={isPending}
            onClick={handlePublish}
            className="flex items-center gap-1.5 px-6 py-2 rounded-xl bg-sky-300/10 text-blue-900 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_2px_rgba(14,165,233,0.08)] ring-1 ring-inset ring-sky-300/25 text-sm font-medium hover:bg-sky-300/18 hover:ring-sky-300/40 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                创建中...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                发布
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: 基础信息
// ---------------------------------------------------------------------------

function Step1BaseInfo({
  selectedTemplate,
  onSelectTemplate,
  customName,
  onNameChange,
  customDesc,
  onDescChange,
}: {
  selectedTemplate: EmployeeId | null;
  onSelectTemplate: (id: EmployeeId) => void;
  customName: string;
  onNameChange: (v: string) => void;
  customDesc: string;
  onDescChange: (v: string) => void;
}) {
  return (
    <div className="space-y-8">
      {/* Template grid */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-3">
          选择基础角色模板
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {BASE_TEMPLATE_IDS.map((id) => {
            const meta = EMPLOYEE_META[id];
            const selected = selectedTemplate === id;
            return (
              <button
                key={id}
                onClick={() => onSelectTemplate(id)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-all cursor-pointer border-0 ${
                  selected
                    ? "bg-blue-500/10 ring-2 ring-blue-500/30"
                    : "bg-black/[0.03] dark:bg-white/[0.04] hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
                }`}
              >
                <EmployeeAvatar employeeId={id} size="lg" />
                <span
                  className={`text-sm font-medium ${
                    selected
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-gray-700 dark:text-white/70"
                  }`}
                >
                  {meta.title}
                </span>
                <span className="text-xs text-gray-400 dark:text-white/35 text-center leading-tight line-clamp-2">
                  {meta.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-2">
          自定义名称 <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={customName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="为你的 AI 员工取个名字"
          maxLength={50}
          className="w-full px-4 py-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.08] text-sm text-gray-800 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/25 outline-none focus:border-blue-500/40 transition-colors"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-2">
          一句话描述
        </label>
        <input
          type="text"
          value={customDesc}
          onChange={(e) => onDescChange(e.target.value)}
          placeholder="简要描述员工的核心职能（可选）"
          maxLength={100}
          className="w-full px-4 py-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.08] text-sm text-gray-800 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/25 outline-none focus:border-blue-500/40 transition-colors"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: 能力配置
// ---------------------------------------------------------------------------

function Step2Skills({
  instructions,
  onInstructionsChange,
  skills,
  selectedSkillIds,
  onToggleSkill,
  knowledgeBases,
  selectedKBIds,
  onToggleKB,
}: {
  instructions: string;
  onInstructionsChange: (v: string) => void;
  skills: Skill[];
  selectedSkillIds: Set<string>;
  onToggleSkill: (id: string) => void;
  knowledgeBases: KnowledgeBaseInfo[];
  selectedKBIds: Set<string>;
  onToggleKB: (id: string) => void;
}) {
  // Group skills by category
  const groupedSkills = useMemo(() => {
    const map = new Map<string, Skill[]>();
    for (const s of skills) {
      const group = map.get(s.category) || [];
      group.push(s);
      map.set(s.category, group);
    }
    return map;
  }, [skills]);

  const categoryLabel: Record<string, string> = {
    perception: "感知",
    analysis: "分析",
    generation: "生成",
    production: "制作",
    management: "管理",
  };

  return (
    <div className="space-y-8">
      {/* Instructions */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-2">
          指令设定
        </label>
        <textarea
          value={instructions}
          onChange={(e) => onInstructionsChange(e.target.value)}
          rows={4}
          placeholder="设定员工的工作指令和行为规则..."
          className="w-full px-4 py-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.08] text-sm text-gray-800 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/25 outline-none focus:border-blue-500/40 transition-colors resize-none"
        />
      </div>

      {/* Skills */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-3">
          技能选择
          <span className="ml-2 text-xs text-gray-400 dark:text-white/30 font-normal">
            已选 {selectedSkillIds.size} 项
          </span>
        </label>

        {skills.length > 0 ? (
          <div className="space-y-4">
            {Array.from(groupedSkills.entries()).map(
              ([category, categorySkills]) => (
                <div key={category}>
                  <div className="text-xs text-gray-400 dark:text-white/30 mb-2 uppercase tracking-wider">
                    {categoryLabel[category] || category}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {categorySkills.map((s) => {
                      const checked = selectedSkillIds.has(s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => onToggleSkill(s.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border-0 ${
                            checked
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                              : "bg-black/[0.03] dark:bg-white/[0.05] text-gray-500 dark:text-white/45 hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
                          }`}
                          title={s.description}
                        >
                          {checked && <Check className="w-3 h-3" />}
                          {s.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ),
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-300 dark:text-white/25">
            暂无可用技能
          </p>
        )}
      </div>

      {/* Knowledge Bases */}
      <div>
        <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-white/70 mb-3">
          <Database className="w-4 h-4" />
          知识库绑定
          <span className="text-xs text-gray-400 dark:text-white/30 font-normal">
            （可选）
          </span>
        </label>

        {knowledgeBases.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {knowledgeBases.map((kb) => {
              const checked = selectedKBIds.has(kb.id);
              return (
                <button
                  key={kb.id}
                  onClick={() => onToggleKB(kb.id)}
                  className={`flex items-start gap-3 p-3 rounded-xl text-left transition-all cursor-pointer border-0 ${
                    checked
                      ? "bg-blue-500/10 ring-1 ring-blue-500/20"
                      : "bg-black/[0.03] dark:bg-white/[0.04] hover:bg-black/[0.06] dark:hover:bg-white/[0.07]"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 ${
                      checked
                        ? "bg-blue-500 text-white"
                        : "bg-black/[0.06] dark:bg-white/[0.08]"
                    }`}
                  >
                    {checked && <Check className="w-3 h-3" />}
                  </div>
                  <div className="min-w-0">
                    <div
                      className={`text-sm font-medium truncate ${
                        checked
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-gray-700 dark:text-white/70"
                      }`}
                    >
                      {kb.name}
                    </div>
                    {kb.description && (
                      <div className="text-xs text-gray-400 dark:text-white/30 mt-0.5 line-clamp-1">
                        {kb.description}
                      </div>
                    )}
                    <div className="text-xs text-gray-300 dark:text-white/20 mt-0.5">
                      {kb.documentCount} 篇文档
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-300 dark:text-white/25">
            暂无可用知识库
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: 预览 & 发布
// ---------------------------------------------------------------------------

function Step3Preview({
  templateMeta,
  selectedTemplate,
  customName,
  customDesc,
  instructions,
  selectedSkillCount,
  selectedKBCount,
  visibility,
  onVisibilityChange,
  error,
}: {
  templateMeta: (typeof EMPLOYEE_META)[EmployeeId] | null;
  selectedTemplate: EmployeeId | null;
  customName: string;
  customDesc: string;
  instructions: string;
  selectedSkillCount: number;
  selectedKBCount: number;
  visibility: "org" | "private";
  onVisibilityChange: (v: "org" | "private") => void;
  error: string | null;
}) {
  return (
    <div className="space-y-8">
      {/* Preview Card */}
      <div className="rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] p-6">
        <div className="flex items-start gap-4 mb-6">
          {selectedTemplate && (
            <EmployeeAvatar employeeId={selectedTemplate} size="xl" />
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white/90 mb-1">
              {customName || "未命名员工"}
            </h3>
            {customDesc && (
              <p className="text-sm text-gray-500 dark:text-white/50 mb-2">
                {customDesc}
              </p>
            )}
            <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-white/30">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: templateMeta?.color ?? "#6b7280" }}
              />
              基于{templateMeta?.title ?? "未知"}模板
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.04] p-3 text-center">
            <div className="text-lg font-semibold text-gray-800 dark:text-white/80">
              {selectedSkillCount}
            </div>
            <div className="text-xs text-gray-400 dark:text-white/30">
              已选技能
            </div>
          </div>
          <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.04] p-3 text-center">
            <div className="text-lg font-semibold text-gray-800 dark:text-white/80">
              {selectedKBCount}
            </div>
            <div className="text-xs text-gray-400 dark:text-white/30">
              知识库
            </div>
          </div>
          <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.04] p-3 text-center">
            <div className="text-lg font-semibold text-gray-800 dark:text-white/80">
              {instructions.trim().length > 0 ? "已设" : "默认"}
            </div>
            <div className="text-xs text-gray-400 dark:text-white/30">
              指令
            </div>
          </div>
        </div>

        {/* Instructions preview */}
        {instructions.trim() && (
          <div className="mt-4 p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.02]">
            <div className="text-xs text-gray-400 dark:text-white/30 mb-1">
              工作指令
            </div>
            <p className="text-sm text-gray-600 dark:text-white/55 line-clamp-3 whitespace-pre-wrap">
              {instructions}
            </p>
          </div>
        )}
      </div>

      {/* Visibility */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-3">
          可见性
        </label>
        <div className="flex gap-3">
          {(
            [
              { value: "org", label: "团队可见", desc: "团队所有成员可使用" },
              { value: "private", label: "仅自己可见", desc: "仅创建者可使用" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              onClick={() => onVisibilityChange(opt.value)}
              className={`flex-1 p-4 rounded-xl text-left transition-all cursor-pointer border-0 ${
                visibility === opt.value
                  ? "bg-blue-500/10 ring-2 ring-blue-500/30"
                  : "bg-black/[0.03] dark:bg-white/[0.04] hover:bg-black/[0.06] dark:hover:bg-white/[0.07]"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center ${
                    visibility === opt.value
                      ? "bg-blue-500"
                      : "bg-black/[0.08] dark:bg-white/[0.1]"
                  }`}
                >
                  {visibility === opt.value && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>
                <span
                  className={`text-sm font-medium ${
                    visibility === opt.value
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-gray-700 dark:text-white/60"
                  }`}
                >
                  {opt.label}
                </span>
              </div>
              <p className="text-xs text-gray-400 dark:text-white/30 ml-6">
                {opt.desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}

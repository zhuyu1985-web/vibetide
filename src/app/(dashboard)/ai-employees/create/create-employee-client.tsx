"use client";

import { useState, useMemo, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CRAFT_META,
  ORDERED_CRAFTS,
  type CraftType,
} from "@/lib/constants";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { createCustomEmployee } from "@/app/actions/custom-employees";
import type { Skill, DomainRecord } from "@/lib/types";
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
// Types & constants
// ---------------------------------------------------------------------------

interface CreateEmployeeClientProps {
  skills: Skill[];
  knowledgeBases: KnowledgeBaseInfo[];
  domains: DomainRecord[];
}

// 9 个内容工种作为基础模板(编排器 producer 是幕后总编,不在此创建实例)。
const TEMPLATE_CRAFTS: CraftType[] = ORDERED_CRAFTS.filter(
  (c) => c !== "producer",
);

// 媒体形态(形态维度)+ 层级(authority)。领域改用 domains 字典单选(P2)。
const MEDIA_FORMS: { value: "news" | "newmedia" | "convergence"; label: string }[] = [
  { value: "news", label: "新闻 · 规范书面" },
  { value: "newmedia", label: "新媒体 · 口语短" },
  { value: "convergence", label: "融媒体 · 多平台" },
];
const AUTHORITY_OPTIONS: {
  value: "observer" | "advisor" | "executor" | "coordinator";
  label: string;
  desc: string;
}[] = [
  { value: "observer", label: "观察", desc: "只读 / 仅建议" },
  { value: "advisor", label: "建议", desc: "可起草,不可定稿" },
  { value: "executor", label: "执行", desc: "可定稿 / 发布" },
  { value: "coordinator", label: "统筹", desc: "可派单 / 终审" },
];

const STEPS = [
  { label: "工种与定位", icon: BookOpen },
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
                {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
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
  domains,
}: CreateEmployeeClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [step, setStep] = useState(0);

  // Step 1 — 工种与定位
  const [selectedCraft, setSelectedCraft] = useState<CraftType | null>(null);
  const [customName, setCustomName] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [domainId, setDomainId] = useState<string | null>(null);
  const [mediaForm, setMediaForm] = useState<
    "news" | "newmedia" | "convergence" | ""
  >("");
  const [authority, setAuthority] = useState<
    "observer" | "advisor" | "executor" | "coordinator"
  >("advisor");

  // Step 2 — 能力配置
  const [instructions, setInstructions] = useState("");
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedKBIds, setSelectedKBIds] = useState<Set<string>>(new Set());

  // Step 3 — 发布
  const [visibility, setVisibility] = useState<"org" | "private">("org");
  const [error, setError] = useState<string | null>(null);

  // 选工种:预填指令 + 默认层级(核心技能由服务端按工种自动绑定,无需客户端预选)。
  const handleCraftSelect = useCallback((craft: CraftType) => {
    setSelectedCraft(craft);
    const meta = CRAFT_META[craft];
    setInstructions(`你是一位${meta.name}。${meta.description}。请按以下规则工作:`);
    setAuthority(meta.defaultAuthority);
  }, []);

  const toggleSkill = useCallback((skillId: string) => {
    setSelectedSkillIds((prev) => {
      const next = new Set(prev);
      if (next.has(skillId)) next.delete(skillId);
      else next.add(skillId);
      return next;
    });
  }, []);

  const toggleKB = useCallback((kbId: string) => {
    setSelectedKBIds((prev) => {
      const next = new Set(prev);
      if (next.has(kbId)) next.delete(kbId);
      else next.add(kbId);
      return next;
    });
  }, []);

  const canGoNext = useMemo(() => {
    if (step === 0) return selectedCraft !== null && customName.trim() !== "";
    return true;
  }, [step, selectedCraft, customName]);

  const handlePublish = useCallback(() => {
    if (!selectedCraft || !customName.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await createCustomEmployee({
          baseTemplateSlug: selectedCraft,
          name: customName.trim(),
          description: customDesc.trim(),
          instructions: instructions.trim() || undefined,
          skillIds: Array.from(selectedSkillIds),
          knowledgeBaseIds: Array.from(selectedKBIds),
          visibility,
          authorityLevel: authority,
          domainId,
          instanceConfig: {
            mediaForm: mediaForm || undefined,
            platformSpecs: undefined,
          },
        });
        router.push("/ai-employees");
      } catch (e) {
        setError(e instanceof Error ? e.message : "创建失败,请重试");
      }
    });
  }, [
    selectedCraft,
    customName,
    customDesc,
    instructions,
    selectedSkillIds,
    selectedKBIds,
    visibility,
    authority,
    domainId,
    mediaForm,
    router,
    startTransition,
  ]);

  const craftMeta = selectedCraft ? CRAFT_META[selectedCraft] : null;

  return (
    <div className="max-w-[800px] mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white/90 mb-1">
          创建工种实例
        </h1>
        <p className="text-sm text-gray-400 dark:text-white/40">
          选一个工种(如「记者」),配上领域 / 媒体形态 / 层级,生成一个具体岗位(如「财经记者」)
        </p>
      </div>

      <StepIndicator current={step} />

      <div className="min-h-[400px]">
        {step === 0 && (
          <Step1Positioning
            selectedCraft={selectedCraft}
            onSelectCraft={handleCraftSelect}
            customName={customName}
            onNameChange={setCustomName}
            customDesc={customDesc}
            onDescChange={setCustomDesc}
            domains={domains}
            domainId={domainId}
            onDomainIdChange={setDomainId}
            mediaForm={mediaForm}
            onMediaFormChange={setMediaForm}
            authority={authority}
            onAuthorityChange={setAuthority}
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
            craftMeta={craftMeta}
            selectedCraft={selectedCraft}
            customName={customName}
            customDesc={customDesc}
            domainLabel={
              domainId
                ? domains.find((d) => d.id === domainId)?.name ?? "通用"
                : "通用"
            }
            mediaForm={mediaForm}
            authority={authority}
            selectedSkillCount={selectedSkillIds.size}
            selectedKBCount={selectedKBIds.size}
            visibility={visibility}
            onVisibilityChange={setVisibility}
            error={error}
          />
        )}
      </div>

      <div className="flex items-center justify-between mt-8 pt-6 border-t border-black/[0.06] dark:border-white/[0.06]">
        <button
          onClick={() => {
            if (step === 0) router.push("/ai-employees");
            else setStep((s) => s - 1);
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
// Step 1: 工种与定位(工种 + 命名 + 领域/形态/层级三维)
// ---------------------------------------------------------------------------

function Step1Positioning({
  selectedCraft,
  onSelectCraft,
  customName,
  onNameChange,
  customDesc,
  onDescChange,
  domains,
  domainId,
  onDomainIdChange,
  mediaForm,
  onMediaFormChange,
  authority,
  onAuthorityChange,
}: {
  selectedCraft: CraftType | null;
  onSelectCraft: (c: CraftType) => void;
  customName: string;
  onNameChange: (v: string) => void;
  customDesc: string;
  onDescChange: (v: string) => void;
  domains: DomainRecord[];
  domainId: string | null;
  onDomainIdChange: (v: string | null) => void;
  mediaForm: "news" | "newmedia" | "convergence" | "";
  onMediaFormChange: (v: "news" | "newmedia" | "convergence" | "") => void;
  authority: "observer" | "advisor" | "executor" | "coordinator";
  onAuthorityChange: (
    v: "observer" | "advisor" | "executor" | "coordinator",
  ) => void;
}) {
  const inputCls =
    "w-full px-4 py-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.08] text-sm text-gray-800 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/25 outline-none focus:border-blue-500/40 transition-colors";
  const labelCls =
    "block text-sm font-medium text-gray-700 dark:text-white/70 mb-3";

  return (
    <div className="space-y-8">
      {/* 工种 grid */}
      <div>
        <label className={labelCls}>选择工种</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {TEMPLATE_CRAFTS.map((craft) => {
            const meta = CRAFT_META[craft];
            const selected = selectedCraft === craft;
            return (
              <button
                key={craft}
                onClick={() => onSelectCraft(craft)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-all cursor-pointer border-0 ${
                  selected
                    ? "bg-blue-500/10 ring-2 ring-blue-500/30"
                    : "bg-black/[0.03] dark:bg-white/[0.04] hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
                }`}
              >
                <EmployeeAvatar employeeId={craft} size="lg" />
                <span
                  className={`text-sm font-medium ${
                    selected
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-gray-700 dark:text-white/70"
                  }`}
                >
                  {meta.name}
                </span>
                <span className="text-xs text-gray-400 dark:text-white/35 text-center leading-tight line-clamp-2">
                  {meta.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 命名 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-2">
          岗位名称 <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={customName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="如「财经记者」「时政记者」"
          maxLength={50}
          className={inputCls}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-2">
          一句话描述
        </label>
        <input
          type="text"
          value={customDesc}
          onChange={(e) => onDescChange(e.target.value)}
          placeholder="简要描述该岗位的核心职能(可选)"
          maxLength={100}
          className={inputCls}
        />
      </div>

      {/* 领域(领域维度)*/}
      <div>
        <label className={labelCls}>
          领域专精
          <span className="ml-2 text-xs text-gray-400 dark:text-white/30 font-normal">
            决定内容 / 术语 / 口径(配合知识库)
          </span>
        </label>
        {domains.length === 0 ? (
          <p className="text-xs text-amber-500">
            尚无领域字典，去{" "}
            <a className="underline" href="/settings/domains">
              领域管理
            </a>{" "}
            创建或导入默认领域。
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => onDomainIdChange(null)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border-0 ${
                domainId === null
                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  : "bg-black/[0.03] dark:bg-white/[0.05] text-gray-500 dark:text-white/45 hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
              }`}
            >
              {domainId === null && <Check className="w-3 h-3" />}
              不限领域
            </button>
            {domains.map((d) => {
              const on = domainId === d.id;
              return (
                <button
                  key={d.id}
                  onClick={() => onDomainIdChange(d.id)}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border-0 ${
                    on
                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      : "bg-black/[0.03] dark:bg-white/[0.05] text-gray-500 dark:text-white/45 hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
                  }`}
                >
                  {on && <Check className="w-3 h-3" />}
                  {d.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 媒体形态(形态维度)*/}
      <div>
        <label className={labelCls}>
          媒体形态
          <span className="ml-2 text-xs text-gray-400 dark:text-white/30 font-normal">
            决定形式 / 语态 / 平台
          </span>
        </label>
        <div className="flex flex-wrap gap-2">
          {[{ value: "" as const, label: "不限 · 通用" }, ...MEDIA_FORMS].map(
            (f) => {
              const on = mediaForm === f.value;
              return (
                <button
                  key={f.value || "none"}
                  onClick={() => onMediaFormChange(f.value)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer border-0 ${
                    on
                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20"
                      : "bg-black/[0.03] dark:bg-white/[0.04] text-gray-600 dark:text-white/55 hover:bg-black/[0.06] dark:hover:bg-white/[0.07]"
                  }`}
                >
                  {f.label}
                </button>
              );
            },
          )}
        </div>
      </div>

      {/* 层级(authority 维度)*/}
      <div>
        <label className={labelCls}>
          层级权限
          <span className="ml-2 text-xs text-gray-400 dark:text-white/30 font-normal">
            决定能否定稿 / 发布
          </span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {AUTHORITY_OPTIONS.map((opt) => {
            const on = authority === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onAuthorityChange(opt.value)}
                className={`p-3 rounded-xl text-left transition-all cursor-pointer border-0 ${
                  on
                    ? "bg-blue-500/10 ring-2 ring-blue-500/30"
                    : "bg-black/[0.03] dark:bg-white/[0.04] hover:bg-black/[0.06] dark:hover:bg-white/[0.07]"
                }`}
              >
                <p
                  className={`text-sm font-medium ${
                    on
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-gray-700 dark:text-white/70"
                  }`}
                >
                  {opt.label}
                </p>
                <p className="text-[10px] text-gray-400 dark:text-white/35 mt-0.5">
                  {opt.desc}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: 能力配置(指令 + 技能 + 知识库)
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
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-2">
          指令设定
        </label>
        <textarea
          value={instructions}
          onChange={(e) => onInstructionsChange(e.target.value)}
          rows={4}
          placeholder="设定岗位的工作指令和行为规则..."
          className="w-full px-4 py-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.08] text-sm text-gray-800 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/25 outline-none focus:border-blue-500/40 transition-colors resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-white/70 mb-3">
          附加技能
          <span className="ml-2 text-xs text-gray-400 dark:text-white/30 font-normal">
            工种核心技能会自动绑定;这里选额外技能,已选 {selectedSkillIds.size} 项
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
          <p className="text-sm text-gray-300 dark:text-white/25">暂无可用技能</p>
        )}
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-white/70 mb-3">
          <Database className="w-4 h-4" />
          知识库绑定
          <span className="text-xs text-gray-400 dark:text-white/30 font-normal">
            (领域内容来源,可选)
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
          <p className="text-sm text-gray-300 dark:text-white/25">暂无可用知识库</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: 预览 & 发布
// ---------------------------------------------------------------------------

function Step3Preview({
  craftMeta,
  selectedCraft,
  customName,
  customDesc,
  domainLabel,
  mediaForm,
  authority,
  selectedSkillCount,
  selectedKBCount,
  visibility,
  onVisibilityChange,
  error,
}: {
  craftMeta: (typeof CRAFT_META)[CraftType] | null;
  selectedCraft: CraftType | null;
  customName: string;
  customDesc: string;
  domainLabel: string;
  mediaForm: "news" | "newmedia" | "convergence" | "";
  authority: "observer" | "advisor" | "executor" | "coordinator";
  selectedSkillCount: number;
  selectedKBCount: number;
  visibility: "org" | "private";
  onVisibilityChange: (v: "org" | "private") => void;
  error: string | null;
}) {
  const mediaFormLabel =
    MEDIA_FORMS.find((f) => f.value === mediaForm)?.label ?? "不限";
  const authorityLabel =
    AUTHORITY_OPTIONS.find((a) => a.value === authority)?.label ?? authority;

  return (
    <div className="space-y-8">
      <div className="rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] p-6">
        <div className="flex items-start gap-4 mb-6">
          {selectedCraft && (
            <EmployeeAvatar employeeId={selectedCraft} size="xl" />
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white/90 mb-1">
              {customName || "未命名岗位"}
            </h3>
            {customDesc && (
              <p className="text-sm text-gray-500 dark:text-white/50 mb-2">
                {customDesc}
              </p>
            )}
            <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-white/30">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: craftMeta?.color ?? "#6b7280" }}
              />
              工种:{craftMeta?.name ?? "未知"}
            </div>
          </div>
        </div>

        {/* 三维定位概览 */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.04] p-3">
            <div className="text-xs text-gray-400 dark:text-white/30 mb-1">
              领域
            </div>
            <div className="text-sm font-medium text-gray-800 dark:text-white/80 line-clamp-1">
              {domainLabel}
            </div>
          </div>
          <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.04] p-3">
            <div className="text-xs text-gray-400 dark:text-white/30 mb-1">
              媒体形态
            </div>
            <div className="text-sm font-medium text-gray-800 dark:text-white/80 line-clamp-1">
              {mediaFormLabel}
            </div>
          </div>
          <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.04] p-3">
            <div className="text-xs text-gray-400 dark:text-white/30 mb-1">
              层级
            </div>
            <div className="text-sm font-medium text-gray-800 dark:text-white/80 line-clamp-1">
              {authorityLabel}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.04] p-3 text-center">
            <div className="text-lg font-semibold text-gray-800 dark:text-white/80">
              {selectedSkillCount}
            </div>
            <div className="text-xs text-gray-400 dark:text-white/30">
              附加技能(核心自动绑定)
            </div>
          </div>
          <div className="rounded-xl bg-black/[0.03] dark:bg-white/[0.04] p-3 text-center">
            <div className="text-lg font-semibold text-gray-800 dark:text-white/80">
              {selectedKBCount}
            </div>
            <div className="text-xs text-gray-400 dark:text-white/30">知识库</div>
          </div>
        </div>
      </div>

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

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}

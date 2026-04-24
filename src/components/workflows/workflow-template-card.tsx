"use client";

import type { WorkflowStepDef } from "@/db/schema/workflows";
import { ArrowRight, AlertCircle, Package, Pencil } from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { SKILL_CATEGORY_CONFIG } from "./step-card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkflowTemplateCardProps {
  template: {
    id: string;
    name: string;
    description: string | null;
    category: string;
    triggerType: string;
    steps: WorkflowStepDef[];
  };
  onUseTemplate: (templateId: string) => void;
  /**
   * Admin-only hook. When provided, renders an "Edit" button on the card so
   * super admins can hotfix builtin templates without a code release.
   */
  onEdit?: (templateId: string) => void;
}

// Fallback (unrecognized category) — matches the `other` bucket's vibe.
const FALLBACK_CATEGORY = {
  icon: Package,
  color: "#6b7280",
  bgColor: "rgba(107,114,128,0.12)",
  label: "其他",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkflowTemplateCard({
  template,
  onUseTemplate,
  onEdit,
}: WorkflowTemplateCardProps) {
  const steps = Array.isArray(template.steps) ? template.steps : [];

  // Build the skill chain from steps (sorted by order)
  const sortedSteps = [...steps].sort((a, b) => a.order - b.order);

  const chain = sortedSteps
    .map((step) => {
      const skillName = step.config?.skillName;
      const category = step.config?.skillCategory ?? "";
      if (!skillName) return null;
      const cfg = SKILL_CATEGORY_CONFIG[category] ?? FALLBACK_CATEGORY;
      return {
        name: skillName,
        color: cfg.color,
        bgColor: cfg.bgColor,
        Icon: cfg.icon,
      };
    })
    .filter(Boolean) as {
      name: string;
      color: string;
      bgColor: string;
      Icon: typeof Package;
    }[];

  // 0 步或虽有 step 但没有一个 step 有有效 skill → 视为空模板（不可用）
  const isEmpty = steps.length === 0 || chain.length === 0;

  return (
    <GlassCard hover className="group flex flex-col">
      {/* Name + step count */}
      <div className="flex items-center gap-2 mb-1">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white/90 flex-1 truncate">
          {template.name}
        </h3>
        <span className="shrink-0 text-[11px] text-gray-400 dark:text-white/40">
          {steps.length} 步
        </span>
      </div>

      {/* Description (2 lines max) */}
      {template.description && (
        <p className="text-sm text-gray-500 dark:text-white/45 line-clamp-2 mb-4">
          {template.description}
        </p>
      )}

      {/* Skill chain — or empty warning */}
      <div className="flex flex-wrap items-center gap-1 mt-auto mb-4 min-h-[22px]">
        {isEmpty ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle className="w-3.5 h-3.5" />
            模板未配置步骤，暂不可用
          </span>
        ) : (
          chain.map((item, idx) => {
            const Icon = item.Icon;
            return (
              <span key={`${item.name}-${idx}`} className="flex items-center gap-1">
                {idx > 0 && (
                  <ArrowRight
                    className="w-3 h-3 mx-0.5 shrink-0"
                    style={{ color: `${item.color}55` }}
                  />
                )}
                <span
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ring-1 ring-inset font-medium"
                  style={{
                    backgroundColor: item.bgColor,
                    color: item.color,
                    borderColor: "transparent",
                    boxShadow: `inset 0 0 0 1px ${item.color}26`,
                  }}
                >
                  <Icon className="w-3 h-3" aria-hidden />
                  {item.name}
                </span>
              </span>
            );
          })
        )}
      </div>

      {/* Action row — primary "Use template" + optional admin "Edit" */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => !isEmpty && onUseTemplate(template.id)}
          disabled={isEmpty}
          className={`flex-1 py-2 rounded-xl backdrop-blur-sm text-sm border-0 transition-all ${
            isEmpty
              ? "bg-gray-100/60 dark:bg-white/[0.04] text-gray-400 dark:text-white/30 cursor-not-allowed"
              : "bg-blue-50/80 dark:bg-blue-500/[0.08] text-blue-600 dark:text-blue-400 cursor-pointer hover:bg-blue-100/90 dark:hover:bg-blue-500/[0.15] hover:text-blue-700 dark:hover:text-blue-300"
          }`}
        >
          {isEmpty ? "暂不可用" : "使用模板"}
        </button>
        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(template.id)}
            title="管理员：编辑内置模板"
            className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl border-0 bg-black/[0.04] dark:bg-white/[0.06] text-gray-500 dark:text-white/55 cursor-pointer transition-all hover:bg-black/[0.08] dark:hover:bg-white/[0.12] hover:text-gray-800 dark:hover:text-white/85"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
      </div>
    </GlassCard>
  );
}

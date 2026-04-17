"use client";

import type { WorkflowStepDef } from "@/db/schema/workflows";
import { ArrowRight, Cog, type LucideIcon } from "lucide-react";

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
}

// ---------------------------------------------------------------------------
// Skill category colors
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, { color: string; bgColor: string }> = {
  perception: { color: "#f59e0b", bgColor: "rgba(245,158,11,0.12)" },
  analysis: { color: "#8b5cf6", bgColor: "rgba(139,92,246,0.12)" },
  generation: { color: "#3b82f6", bgColor: "rgba(59,130,246,0.12)" },
  production: { color: "#ef4444", bgColor: "rgba(239,68,68,0.12)" },
  management: { color: "#6366f1", bgColor: "rgba(99,102,241,0.12)" },
  knowledge: { color: "#14b8a6", bgColor: "rgba(20,184,166,0.12)" },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkflowTemplateCard({
  template,
  onUseTemplate,
}: WorkflowTemplateCardProps) {
  // Build the skill chain from steps (sorted by order)
  const sortedSteps = [...template.steps].sort((a, b) => a.order - b.order);

  const chain = sortedSteps
    .map((step) => {
      const skillName = step.config?.skillName;
      const category = step.config?.skillCategory ?? "";
      if (!skillName) return null;
      const colors = CATEGORY_COLORS[category] ?? { color: "#6b7280", bgColor: "rgba(107,114,128,0.12)" };
      return { name: skillName, ...colors };
    })
    .filter(Boolean) as { name: string; color: string; bgColor: string }[];

  return (
    <div className="group bg-slate-50/80 dark:bg-white/[0.05] rounded-2xl p-5 transition-all hover:bg-slate-100 dark:hover:bg-white/[0.08] shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)] flex flex-col">
      {/* Name */}
      <h3 className="text-base font-semibold text-gray-900 dark:text-white/90 mb-1">
        {template.name}
      </h3>

      {/* Description (2 lines max) */}
      {template.description && (
        <p className="text-sm text-gray-500 dark:text-white/45 line-clamp-2 mb-4">
          {template.description}
        </p>
      )}

      {/* Skill chain */}
      <div className="flex flex-wrap items-center gap-1 mt-auto mb-4">
        {chain.map((item, idx) => (
          <span key={`${item.name}-${idx}`} className="flex items-center gap-1">
            {idx > 0 && (
              <ArrowRight className="w-3 h-3 text-gray-200 dark:text-white/20 mx-0.5 shrink-0" />
            )}
            <span
              className="text-xs px-1.5 py-0.5 rounded-lg"
              style={{ backgroundColor: item.bgColor, color: item.color }}
            >
              {item.name}
            </span>
          </span>
        ))}
      </div>

      {/* Action button */}
      <button
        onClick={() => onUseTemplate(template.id)}
        className="w-full py-2 rounded-xl bg-blue-50/80 dark:bg-blue-500/[0.08] backdrop-blur-sm text-sm text-blue-600 dark:text-blue-400 border-0 cursor-pointer transition-all hover:bg-blue-100/90 dark:hover:bg-blue-500/[0.15] hover:text-blue-700 dark:hover:text-blue-300"
      >
        使用模板
      </button>
    </div>
  );
}

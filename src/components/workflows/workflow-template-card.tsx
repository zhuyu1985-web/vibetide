"use client";

import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import type { WorkflowStepDef } from "@/db/schema/workflows";
import { ArrowRight } from "lucide-react";

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
// Component
// ---------------------------------------------------------------------------

export function WorkflowTemplateCard({
  template,
  onUseTemplate,
}: WorkflowTemplateCardProps) {
  // Build the employee chain from steps (sorted by order)
  const sortedSteps = [...template.steps].sort((a, b) => a.order - b.order);

  const chain = sortedSteps
    .map((step) => {
      const slug = (step.config?.employeeSlug ?? step.employeeSlug) as
        | EmployeeId
        | undefined;
      if (!slug) return null;
      const meta = EMPLOYEE_META[slug];
      if (!meta) return null;
      return meta;
    })
    .filter(Boolean) as (typeof EMPLOYEE_META)[EmployeeId][];

  return (
    <div className="group bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5 transition-all hover:border-white/[0.15] hover:bg-white/[0.06] flex flex-col">
      {/* Name */}
      <h3 className="text-base font-semibold text-white/90 mb-1">
        {template.name}
      </h3>

      {/* Description (2 lines max) */}
      {template.description && (
        <p className="text-sm text-white/45 line-clamp-2 mb-4">
          {template.description}
        </p>
      )}

      {/* Employee chain */}
      <div className="flex flex-wrap items-center gap-1 mt-auto mb-4">
        {chain.map((meta, idx) => {
          const Icon = meta.icon;
          return (
            <span key={`${meta.id}-${idx}`} className="flex items-center gap-1">
              {idx > 0 && (
                <ArrowRight className="w-3 h-3 text-white/20 mx-0.5 shrink-0" />
              )}
              <span
                className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-lg"
                style={{ backgroundColor: meta.bgColor, color: meta.color }}
              >
                <Icon className="w-3 h-3" />
                {meta.nickname}
              </span>
            </span>
          );
        })}
      </div>

      {/* Action button */}
      <button
        onClick={() => onUseTemplate(template.id)}
        className="w-full py-2 rounded-xl bg-white/[0.08] text-sm text-white/70 border-0 cursor-pointer transition-all hover:bg-white/[0.14] hover:text-white/90"
      >
        使用模板
      </button>
    </div>
  );
}

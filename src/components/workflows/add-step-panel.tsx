"use client";

import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import { FolderOpen, Radio, FileText, Bell } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AddStepPanelProps {
  onAddEmployeeStep: (employeeSlug: string, employeeName: string) => void;
  onAddOutputStep: (action: string, actionLabel: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OUTPUT_ACTIONS = [
  { id: "save_to_assets", label: "保存到媒资库", icon: FolderOpen },
  { id: "publish", label: "发布到渠道", icon: Radio },
  { id: "generate_report", label: "生成报告", icon: FileText },
  { id: "send_notification", label: "发送通知", icon: Bell },
] as const;

/** Only show the 8 functional employees (exclude advisor + leader). */
const EMPLOYEE_SLUGS: EmployeeId[] = [
  "xiaolei",
  "xiaoce",
  "xiaozi",
  "xiaowen",
  "xiaojian",
  "xiaoshen",
  "xiaofa",
  "xiaoshu",
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AddStepPanel({
  onAddEmployeeStep,
  onAddOutputStep,
}: AddStepPanelProps) {
  return (
    <div className="flex flex-col gap-6">
      <h3 className="text-base font-semibold text-foreground">添加步骤</h3>

      {/* ── AI Employees ── */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">
          AI 员工
        </p>
        <div className="grid grid-cols-2 gap-2">
          {EMPLOYEE_SLUGS.map((slug) => {
            const meta = EMPLOYEE_META[slug];
            const Icon = meta.icon;
            return (
              <button
                key={slug}
                onClick={() =>
                  onAddEmployeeStep(slug, `${meta.nickname} · ${meta.title}`)
                }
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 bg-black/[0.03] dark:bg-white/[0.04] border-0 text-sm text-foreground hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <span
                  className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0"
                  style={{ backgroundColor: meta.bgColor }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                </span>
                <span className="truncate">
                  {meta.nickname} · {meta.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Output Actions ── */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">
          输出动作
        </p>
        <div className="grid grid-cols-2 gap-2">
          {OUTPUT_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => onAddOutputStep(action.id, action.label)}
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 bg-black/[0.03] dark:bg-white/[0.04] border-0 text-sm text-foreground hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <span className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0 bg-black/[0.05] dark:bg-white/[0.08]">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                </span>
                <span className="truncate">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

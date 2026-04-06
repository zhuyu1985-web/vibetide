"use client";

import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import { cn } from "@/lib/utils";

const DISPLAY_EMPLOYEES: EmployeeId[] = [
  "xiaolei",
  "xiaoce",
  "xiaozi",
  "xiaowen",
  "xiaojian",
  "xiaoshen",
  "xiaofa",
  "xiaoshu",
];

interface EmployeeQuickPanelProps {
  onSelectEmployee: (slug: EmployeeId) => void;
}

export function EmployeeQuickPanel({ onSelectEmployee }: EmployeeQuickPanelProps) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap gap-3">
      {DISPLAY_EMPLOYEES.map((id) => {
        const emp = EMPLOYEE_META[id];
        const Icon = emp.icon;

        return (
          <button
            key={id}
            onClick={() => onSelectEmployee(id)}
            className={cn(
              "flex flex-col items-center gap-1.5 p-2 rounded-xl cursor-pointer",
              "transition-all duration-300 ease-out",
              "hover:scale-[1.08] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:backdrop-blur-sm"
            )}
          >
            {/* Icon square */}
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
              style={{ backgroundColor: emp.bgColor }}
            >
              <Icon size={24} style={{ color: emp.color }} />
            </div>

            {/* Nickname */}
            <span className="text-xs text-gray-800 dark:text-white/80 leading-none">{emp.nickname}</span>

            {/* Title */}
            <span className="text-[10px] text-gray-400 dark:text-white/40 leading-none">{emp.title}</span>
          </button>
        );
      })}

      {/* 全部员工 entry */}
      <button
        onClick={() => router.push("/ai-employees")}
        className={cn(
          "flex flex-col items-center gap-1.5 p-2 rounded-xl cursor-pointer",
          "transition-all duration-300 ease-out",
          "hover:scale-[1.08] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] hover:backdrop-blur-sm"
        )}
      >
        {/* Icon square */}
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-black/5 dark:from-white/10 to-black/[0.03] dark:to-white/5 border border-black/[0.08] dark:border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
          <Sparkles size={24} className="text-gray-600 dark:text-white/60" />
        </div>

        {/* Label lines */}
        <span className="text-xs text-gray-800 dark:text-white/80 leading-none">全部</span>
        <span className="text-[10px] text-gray-400 dark:text-white/40 leading-none">员工</span>
      </button>
    </div>
  );
}

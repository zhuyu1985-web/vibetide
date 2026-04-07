"use client";

import { useState } from "react";
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import type { AIEmployee } from "@/lib/types";
import type { HotTask } from "@/lib/employee-tasks";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Plus, UserCog } from "lucide-react";

const STATUS_CONFIG = {
  working: { label: "工作中", dotColor: "bg-emerald-400", textColor: "text-emerald-400/80" },
  idle: { label: "空闲", dotColor: "bg-gray-300 dark:bg-white/30", textColor: "text-gray-400 dark:text-white/40" },
  learning: { label: "学习中", dotColor: "bg-blue-400", textColor: "text-blue-400/80" },
  reviewing: { label: "审核中", dotColor: "bg-amber-400", textColor: "text-amber-400/80" },
};

interface EmployeeAgentCardProps {
  employee: AIEmployee;
  hotTasks: HotTask[];
  onDispatchTask: (employeeSlug: string) => void;
  onHotTaskClick: (employeeSlug: string, prompt: string) => void;
}

export function EmployeeAgentCard({
  employee,
  hotTasks,
  onDispatchTask,
  onHotTaskClick,
}: EmployeeAgentCardProps) {
  const router = useRouter();
  const [hoveredTask, setHoveredTask] = useState<number | null>(null);
  const meta = EMPLOYEE_META[employee.id as EmployeeId] as typeof EMPLOYEE_META[EmployeeId] | undefined;
  const statusCfg = STATUS_CONFIG[employee.status];
  const Icon = meta?.icon ?? UserCog;

  const iconBg = meta?.bgColor ?? "rgba(107,114,128,0.15)";
  const iconColor = meta?.color ?? "#6b7280";
  const nickname = meta?.nickname ?? employee.nickname;
  const name = meta?.name ?? employee.name;

  return (
    <div className="bg-card border border-border rounded-xl p-3 shadow-sm hover:shadow-md hover:border-border/80 transition-all duration-200">
      {/* Header: icon + name + status — clickable to detail */}
      <div
        className="flex items-center gap-2.5 cursor-pointer"
        onClick={() => router.push(`/employee/${employee.id}`)}
      >
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: iconBg }}
        >
          <Icon className="w-4.5 h-4.5" style={{ color: iconColor }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-foreground truncate">{nickname}</span>
            <span className="text-[11px] text-muted-foreground truncate">{name}</span>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotColor}`} />
            <span className={`text-[10px] ${statusCfg.textColor}`}>{statusCfg.label}</span>
            {employee.skills.length > 0 && (
              <span className="text-[10px] text-muted-foreground/50 ml-1">{employee.skills.length} 项技能</span>
            )}
          </div>
        </div>
      </div>

      {/* Hot Tasks — compact, inline */}
      {hotTasks.length > 0 && (
        <div className="mt-2 flex flex-col gap-0.5">
          {hotTasks.slice(0, 2).map((task, idx) => (
            <button
              key={idx}
              className="flex items-center justify-between text-left text-[12px] text-muted-foreground hover:text-foreground px-1.5 py-1 rounded-md hover:bg-accent transition-colors border-0 bg-transparent cursor-pointer w-full"
              onMouseEnter={() => setHoveredTask(idx)}
              onMouseLeave={() => setHoveredTask(null)}
              onClick={() => onHotTaskClick(employee.id, task.prompt)}
            >
              <span className="truncate">{task.label}</span>
              <ArrowUpRight
                className={`w-3 h-3 shrink-0 ml-1 transition-opacity ${
                  hoveredTask === idx ? "opacity-100" : "opacity-0"
                }`}
              />
            </button>
          ))}
        </div>
      )}

      {/* Dispatch button — subtle bottom link */}
      <div className="mt-2 pt-2 border-t border-border/50 flex justify-center">
        <button
          className="text-[12px] text-muted-foreground hover:text-primary transition-colors border-0 bg-transparent cursor-pointer flex items-center gap-1"
          onClick={() => onDispatchTask(employee.id)}
        >
          <Plus className="w-3.5 h-3.5" />
          派发任务
        </button>
      </div>
    </div>
  );
}

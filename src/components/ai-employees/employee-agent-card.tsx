"use client";

import { useState } from "react";
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import type { AIEmployee } from "@/lib/types";
import type { HotTask } from "@/lib/employee-tasks";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Plus, UserCog } from "lucide-react";
import { EMPLOYEE_AVATAR_MAP } from "@/components/shared/employee-svg-avatars";

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
  const SvgAvatar = EMPLOYEE_AVATAR_MAP[employee.id as EmployeeId];
  const isWorking = employee.status === "working";

  const iconBg = meta?.bgColor ?? "rgba(107,114,128,0.15)";
  const iconColor = meta?.color ?? "#6b7280";
  const nickname = meta?.nickname ?? employee.nickname;
  const name = meta?.name ?? employee.name;
  const description = meta?.description ?? employee.title;

  return (
    <div
      className={`relative bg-card border rounded-xl p-3 shadow-sm hover:shadow-md transition-all duration-200 ${
        isWorking
          ? "border-emerald-400/50 hover:border-emerald-400/70 shadow-emerald-400/10 employee-card-working"
          : "border-border hover:border-border/80"
      }`}
    >
      {/* Header: icon + name + status — clickable to detail */}
      <div
        className="flex items-center gap-2.5 cursor-pointer"
        onClick={() => router.push(`/employee/${employee.id}`)}
      >
        <div
          className="relative w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center shrink-0"
          style={SvgAvatar ? undefined : { backgroundColor: iconBg }}
        >
          {isWorking && (
            <span
              className="absolute inset-0 rounded-lg animate-ping opacity-60 z-10 pointer-events-none"
              style={{ backgroundColor: iconBg }}
            />
          )}
          {SvgAvatar ? (
            <SvgAvatar className="relative w-full h-full" />
          ) : (
            <Icon className="relative w-4.5 h-4.5" style={{ color: iconColor }} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-foreground truncate">{nickname}</span>
            <span className="text-[11px] text-muted-foreground truncate">{name}</span>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="relative flex w-1.5 h-1.5">
              {isWorking && (
                <span className={`absolute inline-flex h-full w-full rounded-full ${statusCfg.dotColor} opacity-75 animate-ping`} />
              )}
              <span className={`relative inline-flex w-1.5 h-1.5 rounded-full ${statusCfg.dotColor} ${isWorking ? "animate-pulse" : ""}`} />
            </span>
            <span className={`text-[10px] ${statusCfg.textColor}`}>
              {statusCfg.label}
              {isWorking && employee.currentTask && (
                <span className="ml-1 text-emerald-400/60">· 执行中</span>
              )}
            </span>
            {employee.skills.length > 0 && (
              <span className="text-[10px] text-muted-foreground/50 ml-1">{employee.skills.length} 项技能</span>
            )}
          </div>
        </div>
      </div>

      {/* Description: one-line core capability */}
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/80 line-clamp-2">
        {description}
      </p>

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

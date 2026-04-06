"use client";

import { useState } from "react";
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import type { AIEmployee } from "@/lib/types";
import type { HotTask } from "@/lib/employee-tasks";
import { ArrowUpRight, Plus } from "lucide-react";

const STATUS_CONFIG = {
  working: { label: "工作中", dotColor: "bg-emerald-400", textColor: "text-emerald-400/80" },
  idle: { label: "空闲", dotColor: "bg-white/30", textColor: "text-white/40" },
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
  const [hoveredTask, setHoveredTask] = useState<number | null>(null);
  const meta = EMPLOYEE_META[employee.id];
  const statusCfg = STATUS_CONFIG[employee.status];
  const Icon = meta.icon;
  const displaySkills = employee.skills.slice(0, 5);

  return (
    <div
      className="bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-white/[0.15] hover:scale-[1.01] transition-all duration-300"
    >
      {/* Header: icon + name + status */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: meta.bgColor }}
          >
            <Icon className="w-5 h-5" style={{ color: meta.color }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white/90">
                {meta.nickname}
              </span>
              <span className="text-xs text-white/40">·</span>
              <span className="text-xs text-white/50">{meta.name}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotColor}`} />
              <span className={`text-[11px] ${statusCfg.textColor}`}>
                {statusCfg.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Motto */}
      <p className="text-xs text-white/40 mb-4 leading-relaxed">
        &ldquo;{employee.motto}&rdquo;
      </p>

      {/* Hot Tasks */}
      {hotTasks.length > 0 && (
        <div className="mb-4">
          <div className="text-[11px] text-white/30 mb-2">热门任务:</div>
          <div className="flex flex-col gap-1">
            {hotTasks.map((task, idx) => (
              <button
                key={idx}
                className="flex items-center justify-between text-left text-sm text-white/60 hover:text-white/90 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] transition-all border-0 bg-transparent cursor-pointer w-full"
                onMouseEnter={() => setHoveredTask(idx)}
                onMouseLeave={() => setHoveredTask(null)}
                onClick={() => onHotTaskClick(employee.id, task.prompt)}
              >
                <span className="flex items-center gap-2">
                  <span className="text-white/20">·</span>
                  {task.label}
                </span>
                <ArrowUpRight
                  className={`w-3.5 h-3.5 transition-opacity ${
                    hoveredTask === idx ? "opacity-100" : "opacity-0"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Skill Tags */}
      {displaySkills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {displaySkills.map((skill) => (
            <span
              key={skill.id}
              className="px-2.5 py-1 rounded-full bg-white/[0.06] text-[11px] text-white/50"
            >
              {skill.name}
            </span>
          ))}
          {employee.skills.length > 5 && (
            <span className="px-2.5 py-1 rounded-full bg-white/[0.06] text-[11px] text-white/30">
              +{employee.skills.length - 5}
            </span>
          )}
        </div>
      )}

      {/* Dispatch Button */}
      <div className="flex justify-center">
        <button
          className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 hover:bg-white/10 rounded-xl px-4 py-2 transition-all border-0 bg-transparent cursor-pointer"
          onClick={() => onDispatchTask(employee.id)}
        >
          <Plus className="w-4 h-4" />
          派发任务
        </button>
      </div>
    </div>
  );
}

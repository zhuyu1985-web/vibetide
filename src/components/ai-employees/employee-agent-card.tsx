"use client";

import { useState } from "react";
import type { AIEmployee } from "@/lib/types";
import type { HotTask } from "@/lib/employee-tasks";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Plus } from "lucide-react";
import { resolveEmployeeVisual } from "@/components/shared/employee-visual";
import { GlassCard } from "@/components/shared/glass-card";

const STATUS_CONFIG = {
  working: { label: "工作中", dotColor: "bg-emerald-400", textColor: "text-emerald-400/80" },
  idle: { label: "空闲", dotColor: "bg-gray-300 dark:bg-white/30", textColor: "text-gray-400 dark:text-white/40" },
  learning: { label: "学习中", dotColor: "bg-blue-400", textColor: "text-blue-400/80" },
  reviewing: { label: "审核中", dotColor: "bg-amber-400", textColor: "text-amber-400/80" },
};

// 三维徽章标签(层级 / 媒体形态)。领域直接显示 domainTags。
const CARD_AUTHORITY_LABEL: Record<string, string> = {
  observer: "观察",
  advisor: "建议",
  executor: "执行",
  coordinator: "统筹",
};
const CARD_MEDIA_LABEL: Record<string, string> = {
  news: "新闻",
  newmedia: "新媒体",
  convergence: "融媒体",
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
  // 头像/视觉走单一真相源(工种实例继承被取代旧员工的 SVG 头像,见 employee-visual)。
  const visual = resolveEmployeeVisual(employee.id);
  const statusCfg = STATUS_CONFIG[employee.status];
  const Icon = visual.Icon;
  const SvgAvatar = visual.SvgAvatar;
  const isWorking = employee.status === "working";

  const iconBg = visual.bgColor;
  const iconColor = visual.color;
  const nickname = visual.nickname ?? employee.nickname;
  const name = visual.name ?? employee.name;
  const description = visual.description ?? employee.title;

  return (
    <GlassCard
      variant="interactive"
      padding="none"
      className={`relative p-4 ${
        isWorking
          ? "ring-2 ring-emerald-400/40 shadow-emerald-400/10 employee-card-working"
          : ""
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

      {/* 三维徽章:领域(domainTags) / 媒体形态 / 层级(authority) */}
      <div className="mt-2 flex flex-wrap gap-1">
        {(employee.instanceConfig?.domainTags ?? []).slice(0, 3).map((t) => (
          <span
            key={t}
            className="rounded bg-indigo-500/10 px-1.5 py-px text-[10px] text-indigo-600 dark:text-indigo-400"
          >
            {t}
          </span>
        ))}
        {employee.instanceConfig?.mediaForm && (
          <span className="rounded bg-teal-500/10 px-1.5 py-px text-[10px] text-teal-600 dark:text-teal-400">
            {CARD_MEDIA_LABEL[employee.instanceConfig.mediaForm] ??
              employee.instanceConfig.mediaForm}
          </span>
        )}
        {employee.authorityLevel && (
          <span className="rounded bg-amber-500/10 px-1.5 py-px text-[10px] text-amber-700 dark:text-amber-400">
            {CARD_AUTHORITY_LABEL[employee.authorityLevel] ??
              employee.authorityLevel}
          </span>
        )}
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
      <div className="mt-2 pt-2 border-t border-white/40 dark:border-white/5 flex justify-center">
        <button
          className="text-[12px] text-muted-foreground hover:text-primary transition-colors border-0 bg-transparent cursor-pointer flex items-center gap-1"
          onClick={() => onDispatchTask(employee.id)}
        >
          <Plus className="w-3.5 h-3.5" />
          派发任务
        </button>
      </div>
    </GlassCard>
  );
}

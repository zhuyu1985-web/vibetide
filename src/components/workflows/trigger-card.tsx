"use client";

import { Calendar, Loader2, Check, ChevronRight } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TriggerCardProps {
  /** 当前模板挂载的 schedule 总数(包含 enabled + disabled) */
  scheduleCount: number;
  /** 启用中的 schedule 数 */
  enabledCount: number;
  /** 最近一条 schedule 的简短摘要,如 "每天 09:00" 或 "每周一 18:00" */
  nextSummary?: string | null;
  /** 点击卡片 → 打开 schedule 管理 Sheet */
  onClick: () => void;
  /** test run 状态,沿用既有 idle / running / completed */
  status?: "idle" | "running" | "completed";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * 编辑器入门 section 的"触发器"卡片。
 *
 * 2026-05-29 重构(ADR-0002):
 *   - 旧版读 workflow_templates.triggerConfig(已 deprecated)且点击只切换
 *     triggerType,完全没法编辑 cron —— 严重误导
 *   - 新版直接展示该模板挂载的 schedule 数(数据来自 scheduled_jobs 表)
 *     + 点击打开 Sheet(嵌入 ScheduleListClient)做完整 CRUD
 *   - 手动启动入口始终保留,无需通过本卡片切换
 */
export function TriggerCard({
  scheduleCount,
  enabledCount,
  nextSummary,
  onClick,
  status = "idle",
}: TriggerCardProps) {
  const label =
    scheduleCount === 0
      ? "手动触发(尚未配置定时任务)"
      : `定时任务 ${enabledCount}/${scheduleCount} 启用中${
          nextSummary ? ` · ${nextSummary}` : ""
        }`;

  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl bg-card border border-border shadow-sm p-4 flex items-center gap-3 transition-colors hover:border-blue-500/50 cursor-pointer border-0-btn"
      style={{ border: "1px solid var(--border)" }}
    >
      {/* Left icon */}
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10 shrink-0">
        {status === "running" ? (
          <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
        ) : status === "completed" ? (
          <Check className="w-4 h-4 text-green-500" />
        ) : (
          <Calendar className="w-4 h-4 text-blue-500" />
        )}
      </div>

      {/* Label */}
      <span className="text-sm font-medium text-foreground flex-1 text-left truncate">
        {label}
      </span>

      {/* Right side: badge or status */}
      {status === "completed" ? (
        <span className="shrink-0 text-xs text-green-600 dark:text-green-400">
          模拟触发器已完成
        </span>
      ) : (
        <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[11px] font-medium">
          {scheduleCount === 0 ? "添加定时" : "管理定时"}
          <ChevronRight className="w-3 h-3" />
        </span>
      )}
    </button>
  );
}

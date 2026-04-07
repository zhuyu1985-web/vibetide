"use client";

import { Calendar, Loader2, Check } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TriggerCardProps {
  triggerType: "manual" | "scheduled";
  triggerConfig?: { cron?: string; timezone?: string } | null;
  onClick: () => void;
  status?: "idle" | "running" | "completed";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCron(cron?: string): string {
  if (!cron) return "";
  // Simple cron display: "0 9 * * *" => "每天 09:00"
  const parts = cron.split(" ");
  if (parts.length >= 5) {
    const minute = parts[0].padStart(2, "0");
    const hour = parts[1].padStart(2, "0");
    return `每天 ${hour}:${minute}`;
  }
  return cron;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TriggerCard({
  triggerType,
  triggerConfig,
  onClick,
  status = "idle",
}: TriggerCardProps) {
  const label =
    triggerType === "scheduled" && triggerConfig?.cron
      ? `定时触发：${formatCron(triggerConfig.cron)}`
      : "手动触发";

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
      <span className="text-sm font-medium text-foreground flex-1 text-left">
        {label}
      </span>

      {/* Right side: badge or status */}
      {status === "completed" ? (
        <span className="shrink-0 text-xs text-green-600 dark:text-green-400">
          模拟触发器已完成
        </span>
      ) : (
        <span className="shrink-0 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 text-[11px] font-medium">
          触发器
        </span>
      )}
    </button>
  );
}

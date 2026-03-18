"use client";

import { Activity } from "lucide-react";

export function RealTimeIndicator({
  label,
  count,
}: {
  label: string;
  count?: number;
}) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-950/50 border border-green-100 dark:border-green-800/30">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
      </span>
      <Activity size={12} className="text-green-600 dark:text-green-400" />
      <span className="text-xs font-medium text-green-700 dark:text-green-400">
        实时监控中{count ? ` · ${count}+ ${label}` : ""}
      </span>
    </div>
  );
}

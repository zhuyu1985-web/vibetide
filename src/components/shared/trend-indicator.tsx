import { TrendingUp, ArrowUpRight, Minus, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TopicTrend } from "@/lib/types";

const trendConfig: Record<TopicTrend, { icon: React.ElementType; label: string; className: string }> = {
  surging: { icon: ArrowUpRight, label: "急升", className: "text-red-500" },
  rising: { icon: TrendingUp, label: "上升", className: "text-orange-500" },
  plateau: { icon: Minus, label: "平台", className: "text-gray-400 dark:text-gray-500" },
  declining: { icon: TrendingDown, label: "下降", className: "text-blue-400" },
};

export function TrendIndicator({ trend }: { trend: TopicTrend }) {
  const config = trendConfig[trend];
  const Icon = config.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", config.className)}>
      <Icon size={14} />
      {config.label}
    </span>
  );
}

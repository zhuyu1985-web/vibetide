"use client";

import { GlassCard } from "@/components/shared/glass-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { MonitoredPlatformUI, PlatformCategory } from "@/lib/types";

interface PlatformStatusTreeProps {
  platforms: MonitoredPlatformUI[];
  selectedFilter: string;
  onFilterChange: (filter: string) => void;
}

const categoryLabels: Record<PlatformCategory, string> = {
  central: "央级",
  provincial: "省级",
  municipal: "市级",
  industry: "行业",
};

const categoryOrder: PlatformCategory[] = [
  "central",
  "provincial",
  "municipal",
  "industry",
];

const statusColors = {
  active: "bg-green-500",
  paused: "bg-yellow-500",
  error: "bg-red-500",
};

const LEVEL_BADGE: Record<string, { label: string; className: string }> = {
  central: { label: "央媒", className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
  provincial: { label: "省媒", className: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" },
  municipal: { label: "市媒", className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  industry: { label: "行业", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return "待抓取";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

export function PlatformStatusTree({
  platforms,
  selectedFilter,
  onFilterChange,
}: PlatformStatusTreeProps) {
  const grouped = categoryOrder.reduce<
    Record<PlatformCategory, MonitoredPlatformUI[]>
  >(
    (acc, cat) => {
      acc[cat] = platforms.filter((p) => p.category === cat);
      return acc;
    },
    { central: [], provincial: [], municipal: [], industry: [] }
  );

  const activeCount = platforms.filter((p) => p.status === "active").length;

  return (
    <GlassCard padding="none">
      <div
        className={cn(
          "px-4 pt-4 pb-3 cursor-pointer rounded-t-xl transition-colors",
          selectedFilter === "all"
            ? "bg-blue-50/80 dark:bg-blue-950/30"
            : "hover:bg-gray-50 dark:hover:bg-white/5"
        )}
        onClick={() => onFilterChange("all")}
      >
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          平台状态
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {platforms.length} 个监控源 · {activeCount} 个运行中
        </p>
      </div>
      <ScrollArea className="h-[480px]">
        <div className="space-y-3 px-4 pb-4 pt-1">
          {categoryOrder.map((cat) => {
            const items = grouped[cat];
            if (items.length === 0) return null;
            const catFilter = `cat:${cat}`;
            const isCatSelected = selectedFilter === catFilter;

            return (
              <div key={cat}>
                <div
                  className={cn(
                    "flex items-center gap-2 mb-1.5 px-2 py-1 -mx-2 rounded-md cursor-pointer transition-colors",
                    isCatSelected
                      ? "bg-blue-50/80 dark:bg-blue-950/30"
                      : "hover:bg-gray-100/80 dark:hover:bg-white/5"
                  )}
                  onClick={() =>
                    onFilterChange(isCatSelected ? "all" : catFilter)
                  }
                >
                  <span
                    className={cn(
                      "text-xs font-medium tracking-wide",
                      isCatSelected
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-500 dark:text-gray-400"
                    )}
                  >
                    {categoryLabels[cat]}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    ({items.length})
                  </span>
                </div>
                <div className="space-y-0.5 pl-2">
                  {items.map((platform) => {
                    const isSelected = selectedFilter === platform.id;
                    return (
                      <div
                        key={platform.id}
                        className={cn(
                          "flex items-center justify-between py-1.5 px-2 -mx-2 rounded-md cursor-pointer transition-colors",
                          isSelected
                            ? "bg-blue-50/80 dark:bg-blue-950/30"
                            : "hover:bg-gray-100/80 dark:hover:bg-white/5"
                        )}
                        onClick={() =>
                          onFilterChange(isSelected ? "all" : platform.id)
                        }
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`size-2 rounded-full shrink-0 ${statusColors[platform.status]}`}
                          />
                          <span
                            className={cn(
                              "text-sm truncate",
                              isSelected
                                ? "text-blue-600 dark:text-blue-400 font-medium"
                                : "text-gray-800 dark:text-gray-200"
                            )}
                          >
                            {platform.name}
                          </span>
                          {LEVEL_BADGE[platform.category] && (
                            <span
                              className={cn(
                                "inline-flex items-center px-1.5 py-0 rounded text-[9px] font-medium shrink-0",
                                LEVEL_BADGE[platform.category].className
                              )}
                            >
                              {LEVEL_BADGE[platform.category].label}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 ml-2">
                          {formatRelativeTime(platform.lastCrawledAt)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {platforms.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              暂无监控平台
            </p>
          )}
        </div>
      </ScrollArea>
    </GlassCard>
  );
}

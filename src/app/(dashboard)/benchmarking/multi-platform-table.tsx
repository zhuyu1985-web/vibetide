"use client";

import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlatformComparisonRow } from "@/lib/types";

interface MultiPlatformTableProps {
  data: PlatformComparisonRow[];
}

const categoryConfig: Record<string, { label: string; className: string }> = {
  central: {
    label: "央媒",
    className: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  },
  provincial: {
    label: "省媒",
    className: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  },
  municipal: {
    label: "市媒",
    className: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  },
  industry: {
    label: "行业",
    className: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
  },
};

function getCoverageColor(rate: number): string {
  if (rate >= 80) return "text-green-600 dark:text-green-400";
  if (rate >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function MultiPlatformTable({ data }: MultiPlatformTableProps) {
  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 size={16} className="text-blue-500" />
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          多平台对比
        </h3>
        <Badge variant="secondary" className="text-[10px] ml-auto">
          共 {data.length} 个平台
        </Badge>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/25">
              <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                平台
              </th>
              <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                类别
              </th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                总内容
              </th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                已覆盖
              </th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                未覆盖
              </th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                覆盖率
              </th>
              <th className="text-right py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                平均重要性
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => {
              const category = categoryConfig[row.category] ?? {
                label: row.category,
                className: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
              };
              return (
                <tr
                  key={index}
                  className="border-b border-gray-50 dark:border-gray-800 hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-colors"
                >
                  <td className="py-2.5 px-3 font-medium text-gray-800 dark:text-gray-100">
                    {row.platformName}
                  </td>
                  <td className="py-2.5 px-3">
                    <Badge variant="secondary" className={cn("text-[10px]", category.className)}>
                      {category.label}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-3 text-right text-gray-600 dark:text-gray-400">
                    {row.totalContent}
                  </td>
                  <td className="py-2.5 px-3 text-right text-green-600 dark:text-green-400">
                    {row.coveredCount}
                  </td>
                  <td className="py-2.5 px-3 text-right text-red-500 dark:text-red-400">
                    {row.missedCount}
                  </td>
                  <td className={cn("py-2.5 px-3 text-right font-semibold", getCoverageColor(row.coverageRate))}>
                    {row.coverageRate.toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-3 text-right text-gray-600 dark:text-gray-400">
                    {row.avgImportance.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}

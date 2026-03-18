"use client";

import { GlassCard } from "./glass-card";
import { ArrowRight, TrendingUp } from "lucide-react";

export interface KPIItem {
  label: string;
  before: string;
  after: string;
  improvement?: string;
}

export function KPIComparisonBar({ items }: { items: KPIItem[] }) {
  return (
    <GlassCard variant="blue" padding="sm" className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp size={14} className="text-blue-500" />
        <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">AI 赋能前后对比</span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((item, i) => (
          <div key={i} className="flex flex-col gap-1">
            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{item.label}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400 dark:text-gray-500 line-through">{item.before}</span>
              <ArrowRight size={10} className="text-blue-400" />
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{item.after}</span>
              {item.improvement && (
                <span className="text-[9px] text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50 px-1 py-0.5 rounded">
                  {item.improvement}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

"use client";

import { GlassCard } from "./glass-card";
import { Badge } from "@/components/ui/badge";

export interface ChannelAdaption {
  channel: string;
  icon: string;
  format: string;
  ratio: string;
  duration?: string;
  style: string;
  status: "done" | "processing" | "pending";
}

const statusBadge = {
  done: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  processing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  pending: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const statusLabel = {
  done: "已完成",
  processing: "生成中",
  pending: "待处理",
};

export function ChannelAdaptGrid({ items }: { items: ChannelAdaption[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item, i) => (
        <GlassCard key={i} padding="sm" variant="interactive">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">{item.icon}</span>
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{item.channel}</span>
            <Badge className={`text-[9px] ml-auto ${statusBadge[item.status]}`}>
              {statusLabel[item.status]}
            </Badge>
          </div>
          <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-400">
            <div className="flex justify-between">
              <span className="text-gray-400 dark:text-gray-500">格式</span>
              <span className="font-medium">{item.format}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 dark:text-gray-500">比例</span>
              <span className="font-medium">{item.ratio}</span>
            </div>
            {item.duration && (
              <div className="flex justify-between">
                <span className="text-gray-400 dark:text-gray-500">时长</span>
                <span className="font-medium">{item.duration}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400 dark:text-gray-500">风格</span>
              <span className="font-medium">{item.style}</span>
            </div>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

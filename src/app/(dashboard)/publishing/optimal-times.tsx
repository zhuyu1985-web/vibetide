"use client";

import { useState } from "react";
import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ChannelConfig } from "@/lib/types";
import {
  Clock,
  TrendingUp,
  Zap,
  Star,
  Filter,
} from "lucide-react";

interface TimeSlotRecommendation {
  hour: number;
  label: string;
  avgEngagement: number;
  confidence: number;
}

interface HourlyEngagement {
  hour: number;
  label: string;
  avgEngagement: number;
  count: number;
}

interface OptimalTimesProps {
  recommendations: TimeSlotRecommendation[];
  hourlyData: HourlyEngagement[];
  channels: ChannelConfig[];
  onChannelFilter?: (channelId: string | undefined) => void;
}

const rankStyles = [
  { bg: "bg-gradient-to-r from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/30", border: "border-amber-300 dark:border-amber-700/50", text: "text-amber-700 dark:text-amber-400", badge: "bg-amber-500" },
  { bg: "bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-800", border: "border-gray-300 dark:border-gray-600", text: "text-gray-600 dark:text-gray-400", badge: "bg-gray-400" },
  { bg: "bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-950/50 dark:to-orange-900/30", border: "border-orange-300 dark:border-orange-700/50", text: "text-orange-700 dark:text-orange-400", badge: "bg-orange-400" },
];

const timeLabels: Record<number, string> = {
  7: "早间",
  8: "上午通勤",
  9: "上班时段",
  10: "上午",
  11: "午前",
  12: "午间",
  14: "下午早段",
  15: "下午",
  16: "下午晚段",
  17: "下班前",
  18: "晚间黄金",
  19: "晚间",
  20: "晚间高峰",
  21: "深夜前",
  22: "夜间",
};

export function OptimalTimes({
  recommendations,
  hourlyData,
  channels,
  onChannelFilter,
}: OptimalTimesProps) {
  const [selectedChannel, setSelectedChannel] = useState<string | undefined>(undefined);

  const maxEngagement = Math.max(...hourlyData.map((d) => d.avgEngagement), 1);
  const recommendedHours = new Set(recommendations.map((r) => r.hour));

  const handleChannelSelect = (channelId: string | undefined) => {
    setSelectedChannel(channelId);
    onChannelFilter?.(channelId);
  };

  return (
    <div className="space-y-6">
      {/* Channel Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={14} className="text-gray-400 dark:text-gray-500" />
        <span className="text-xs text-gray-500 dark:text-gray-400">筛选渠道：</span>
        <Badge
          variant={!selectedChannel ? "default" : "outline"}
          className="text-xs cursor-pointer"
          onClick={() => handleChannelSelect(undefined)}
        >
          全部渠道
        </Badge>
        {channels.map((ch) => (
          <Badge
            key={ch.id}
            variant={selectedChannel === ch.id ? "default" : "outline"}
            className="text-xs cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20"
            onClick={() => handleChannelSelect(ch.id)}
          >
            {ch.name}
          </Badge>
        ))}
      </div>

      {/* Top 3 Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {recommendations.map((rec, idx) => {
          const style = rankStyles[idx] || rankStyles[2];
          return (
            <GlassCard
              key={rec.hour}
              variant="interactive"
              padding="md"
              className={cn(
                "relative overflow-hidden",
                style.bg,
                `border ${style.border}`
              )}
            >
              {/* Rank Badge */}
              <div
                className={cn(
                  "absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold",
                  style.badge
                )}
              >
                {idx + 1}
              </div>

              <div className="flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-lg bg-white/60 dark:bg-gray-900/60 flex items-center justify-center">
                  {idx === 0 ? (
                    <Star size={20} className="text-amber-500" />
                  ) : idx === 1 ? (
                    <Zap size={20} className="text-gray-500" />
                  ) : (
                    <TrendingUp size={20} className="text-orange-500" />
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {idx === 0 ? "最佳时段" : idx === 1 ? "次优时段" : "推荐时段"}
                  </p>
                  <p className={cn("text-lg font-bold", style.text)}>
                    {rec.label}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">时段名称</p>
                  <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {timeLabels[rec.hour] || `${rec.hour}时段`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">置信度</p>
                  <p className={cn("text-sm font-bold", style.text)}>
                    {rec.confidence}%
                  </p>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* Hourly Engagement Bar Chart (custom CSS bars) */}
      <GlassCard padding="md">
        <div className="flex items-center gap-2 mb-4">
          <Clock size={16} className="text-blue-600 dark:text-blue-400" />
          <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            各时段互动率分布
          </h4>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-auto">
            基于历史数据分析
          </span>
        </div>

        <div className="flex items-end gap-1 h-48 px-2">
          {hourlyData.map((slot) => {
            const height = (slot.avgEngagement / maxEngagement) * 100;
            const isRecommended = recommendedHours.has(slot.hour);

            return (
              <div
                key={slot.hour}
                className="flex-1 flex flex-col items-center justify-end group"
              >
                {/* Tooltip */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity mb-1 text-center">
                  <div className="bg-gray-800 text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap">
                    {slot.avgEngagement.toFixed(1)}
                  </div>
                </div>

                {/* Bar */}
                <div
                  className={cn(
                    "w-full rounded-t-sm transition-all duration-200 min-h-[2px]",
                    isRecommended
                      ? "bg-gradient-to-t from-blue-500 to-blue-400 ring-1 ring-blue-300"
                      : "bg-gradient-to-t from-gray-300 to-gray-200 group-hover:from-blue-300 group-hover:to-blue-200"
                  )}
                  style={{ height: `${Math.max(height, 2)}%` }}
                />

                {/* Label */}
                <span
                  className={cn(
                    "text-[9px] mt-1",
                    isRecommended
                      ? "text-blue-600 dark:text-blue-400 font-bold"
                      : "text-gray-400 dark:text-gray-500"
                  )}
                >
                  {slot.hour}
                </span>
              </div>
            );
          })}
        </div>

        {/* X-axis label */}
        <div className="text-center mt-2">
          <span className="text-[10px] text-gray-400 dark:text-gray-500">时间 (小时)</span>
        </div>
      </GlassCard>

      {/* Tips */}
      <GlassCard variant="blue" padding="sm">
        <div className="flex items-start gap-2">
          <TrendingUp size={14} className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <p className="font-medium text-gray-700 dark:text-gray-300">发布建议</p>
            <p>
              根据历史数据分析，建议在
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {recommendations.map((r) => r.label).join("、")}
              </span>
              时段发布内容，可获得更高的互动率和曝光量。
            </p>
            <p className="text-gray-400 dark:text-gray-500">
              数据每日更新，建议结合渠道特性和目标受众作息调整。
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Filter } from "lucide-react";
import type { MonitoredPlatformUI } from "@/lib/types";

interface ComparisonFilterBarProps {
  platforms: MonitoredPlatformUI[];
  selectedPlatform: string;
  onPlatformChange: (id: string) => void;
  timeRange: string;
  onTimeRangeChange: (range: string) => void;
}

const timeRangeOptions = [
  { value: "today", label: "今日" },
  { value: "3days", label: "3天" },
  { value: "week", label: "本周" },
  { value: "month", label: "本月" },
];

export function ComparisonFilterBar({
  platforms,
  selectedPlatform,
  onPlatformChange,
  timeRange,
  onTimeRangeChange,
}: ComparisonFilterBarProps) {
  return (
    <div className="flex items-center gap-3">
      <Filter size={14} className="text-gray-400 dark:text-gray-500 shrink-0" />

      <Select value={selectedPlatform} onValueChange={onPlatformChange}>
        <SelectTrigger size="sm" className="w-[160px]">
          <SelectValue placeholder="选择平台" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部</SelectItem>
          {platforms.map((platform) => (
            <SelectItem key={platform.id} value={platform.id}>
              {platform.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1">
        {timeRangeOptions.map((option) => (
          <Button
            key={option.value}
            variant="ghost"
            size="sm"
            className={cn(
              "text-xs",
              timeRange === option.value &&
                "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400"
            )}
            onClick={() => onTimeRangeChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

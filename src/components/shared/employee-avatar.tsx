"use client";

import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { User } from "lucide-react";

const MICRO_ANIMATION: Record<string, string> = {
  xiaolei: "animate-radar-pulse",
  xiaoce: "animate-bulb-flicker",
  xiaozi: "animate-page-flip",
  xiaowen: "animate-pen-write",
  xiaojian: "animate-film-rotate",
  xiaoshen: "animate-magnify-scan",
  xiaofa: "animate-signal-wave",
  xiaoshu: "animate-chart-bounce",
};

interface EmployeeAvatarProps {
  employeeId: EmployeeId | string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showStatus?: boolean;
  status?: "working" | "idle" | "learning" | "reviewing";
  className?: string;
  animated?: boolean;
}

const sizeMap = {
  xs: { container: "w-6 h-6", icon: 12 },
  sm: { container: "w-8 h-8", icon: 14 },
  md: { container: "w-10 h-10", icon: 18 },
  lg: { container: "w-12 h-12", icon: 22 },
  xl: { container: "w-16 h-16", icon: 28 },
};

const statusColors: Record<string, string> = {
  working: "bg-green-500",
  idle: "bg-gray-400",
  learning: "bg-blue-500",
  reviewing: "bg-amber-500",
};

export function EmployeeAvatar({
  employeeId,
  size = "md",
  showStatus = false,
  status,
  className,
  animated = false,
}: EmployeeAvatarProps) {
  const meta = EMPLOYEE_META[employeeId as EmployeeId];
  const Icon = meta?.icon ?? User;
  const color = meta?.color ?? "#6b7280";
  const bgColor = meta?.bgColor ?? "rgba(107,114,128,0.12)";
  const s = sizeMap[size];

  return (
    <div className={cn("relative inline-flex shrink-0", className)}>
      <div
        className={cn(
          s.container,
          "rounded-full flex items-center justify-center"
        )}
        style={{ backgroundColor: bgColor }}
      >
        <Icon size={s.icon} style={{ color }} strokeWidth={2} />
      </div>
      {animated && MICRO_ANIMATION[employeeId as string] && (
        <span
          className={cn(
            "absolute inset-[-3px] rounded-full opacity-40",
            MICRO_ANIMATION[employeeId as string]
          )}
          style={{ borderColor: meta.color, borderWidth: 2, borderStyle: "solid" }}
        />
      )}
      {showStatus && status && (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white dark:border-gray-900",
            statusColors[status],
            size === "xs" || size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3"
          )}
        />
      )}
    </div>
  );
}

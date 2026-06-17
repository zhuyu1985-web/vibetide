"use client";

import { type EmployeeId } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { resolveEmployeeVisual } from "./employee-visual";

const MICRO_ANIMATION: Record<string, string> = {
  xiaolei: "animate-radar-pulse",
  xiaoce: "animate-bulb-flicker",
  xiaozi: "animate-page-flip",
  xiaowen: "animate-pen-write",
  xiaojian: "animate-film-rotate",
  xiaoshen: "animate-magnify-scan",
  xiaofa: "animate-signal-wave",
  xiaoshu: "animate-chart-rotate",
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
  // 工种/员工视觉走单一真相源:工种实例继承被取代旧员工的 SVG 头像(见 employee-visual)。
  const { avatarSlug, SvgAvatar, Icon, color, bgColor } =
    resolveEmployeeVisual(employeeId);
  const s = sizeMap[size];
  // 小尺寸(xs/sm)默认静态 — 它们出现在 TemplateCard 团队成员等密集场景,
  // 35+ 个 × 5 个 SVG 内部 infinite 动画是 home 页 CPU 大头。32px 看不到细节。
  // animated=true 时显式覆盖,强制激活动画。
  const isSmall = size === "xs" || size === "sm";
  const useStatic = isSmall && !animated;

  return (
    <div className={cn("relative inline-flex shrink-0", className)}>
      <div
        className={cn(
          s.container,
          "rounded-full overflow-hidden flex items-center justify-center",
          useStatic && "avatar-static"
        )}
        style={SvgAvatar ? undefined : { backgroundColor: bgColor }}
      >
        {SvgAvatar ? (
          <SvgAvatar className="w-full h-full" />
        ) : (
          <Icon size={s.icon} style={{ color }} strokeWidth={2} />
        )}
      </div>
      {animated && MICRO_ANIMATION[avatarSlug as string] && (
        <span
          className={cn(
            "absolute inset-[-3px] rounded-full opacity-40",
            MICRO_ANIMATION[avatarSlug as string]
          )}
          style={{ borderColor: color, borderWidth: 2, borderStyle: "solid" }}
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

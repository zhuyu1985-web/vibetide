import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  variant?: "default" | "blue" | "interactive" | "panel" | "elevated";
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingMap = {
  none: "",
  sm: "p-3",
  md: "p-5",
  lg: "p-6",
};

export function GlassCard({
  children,
  variant = "default",
  className,
  padding = "md",
}: GlassCardProps) {
  return (
    <div
      className={cn(
        paddingMap[padding],
        variant === "default" && "glass-card",
        variant === "blue" && "glass-card glass-blue",
        variant === "interactive" && "glass-card-interactive",
        variant === "panel" && "glass-panel",
        variant === "elevated" && "glass-elevated",
        className
      )}
    >
      {children}
    </div>
  );
}

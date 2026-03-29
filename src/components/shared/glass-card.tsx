import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type GlassVariant =
  | "default"
  | "blue"
  | "interactive"
  | "panel"
  | "elevated"
  | "primary"
  | "secondary"
  | "tertiary"
  | "accent"
  | "float";

interface GlassCardProps {
  children: ReactNode;
  variant?: GlassVariant;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
  onClick?: () => void;
}

const variantClass: Record<GlassVariant, string> = {
  default: "glass-card",
  blue: "glass-accent",
  interactive: "glass-card-interactive",
  panel: "glass-primary",
  elevated: "glass-float",
  primary: "glass-primary",
  secondary: "glass-secondary",
  tertiary: "glass-tertiary",
  accent: "glass-accent",
  float: "glass-float",
};

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
  hover = false,
  onClick,
}: GlassCardProps) {
  return (
    <div
      className={cn(
        variantClass[variant],
        paddingMap[padding],
        hover && "transition-transform duration-250 ease-out hover:-translate-y-0.5",
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

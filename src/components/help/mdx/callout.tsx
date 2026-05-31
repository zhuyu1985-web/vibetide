import type { ReactNode } from "react";
import { Lightbulb, AlertTriangle, Pencil, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type CalloutType = "tip" | "warn" | "note" | "info";

interface CalloutProps {
  type?: CalloutType;
  title?: string;
  children: ReactNode;
}

const VARIANTS: Record<
  CalloutType,
  {
    icon: typeof Lightbulb;
    bar: string;
    bg: string;
    iconColor: string;
    label: string;
  }
> = {
  tip: {
    icon: Lightbulb,
    bar: "border-l-sky-500",
    bg: "bg-sky-50 dark:bg-sky-950/40",
    iconColor: "text-sky-600 dark:text-sky-400",
    label: "提示",
  },
  warn: {
    icon: AlertTriangle,
    bar: "border-l-amber-500",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    iconColor: "text-amber-600 dark:text-amber-400",
    label: "注意",
  },
  note: {
    icon: Pencil,
    bar: "border-l-slate-500",
    bg: "bg-slate-50 dark:bg-slate-900/60",
    iconColor: "text-slate-600 dark:text-slate-300",
    label: "备注",
  },
  info: {
    icon: Info,
    bar: "border-l-violet-500",
    bg: "bg-violet-50 dark:bg-violet-950/40",
    iconColor: "text-violet-600 dark:text-violet-400",
    label: "说明",
  },
};

export function Callout({ type = "note", title, children }: CalloutProps) {
  const variant = VARIANTS[type];
  const Icon = variant.icon;
  return (
    <div
      className={cn(
        "my-5 flex gap-3 rounded-r-lg border-l-4 px-4 py-3",
        variant.bar,
        variant.bg,
      )}
      role="note"
    >
      <Icon
        className={cn("mt-0.5 size-4 shrink-0", variant.iconColor)}
        aria-hidden
      />
      <div className="min-w-0 flex-1 text-sm leading-7 text-foreground/90">
        <div
          className={cn(
            "mb-0.5 text-xs font-semibold",
            variant.iconColor,
          )}
        >
          {title ?? variant.label}
        </div>
        <div className="[&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
          {children}
        </div>
      </div>
    </div>
  );
}

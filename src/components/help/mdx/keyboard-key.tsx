import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface KeyboardKeyProps {
  children: ReactNode;
  className?: string;
}

/**
 * 行内 <kbd>,等宽字体 + 灰底 + 圆角,模拟按键徽章。
 * 用法:`按 <KeyboardKey>Cmd+K</KeyboardKey> 打开搜索`。
 */
export function KeyboardKey({ children, className }: KeyboardKeyProps) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center rounded-md border border-border bg-muted px-1.5 py-0.5",
        "font-mono text-[0.85em] font-medium text-foreground/90",
        "shadow-[0_1px_0_rgba(0,0,0,0.06)]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

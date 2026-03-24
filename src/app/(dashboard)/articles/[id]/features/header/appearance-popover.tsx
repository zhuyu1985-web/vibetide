"use client";

import { useEffect, useRef } from "react";
import type { AppearanceSettings } from "../../types";
import { cn } from "@/lib/utils";

interface AppearancePopoverProps {
  appearance: AppearanceSettings;
  onUpdate: (updates: Partial<AppearanceSettings>) => void;
  onClose: () => void;
}

const LINE_HEIGHT_OPTIONS: { value: AppearanceSettings["lineHeight"]; label: string }[] = [
  { value: "compact", label: "紧凑" },
  { value: "comfortable", label: "舒适" },
  { value: "loose", label: "宽松" },
];

const MARGIN_OPTIONS: { value: AppearanceSettings["margins"]; label: string }[] = [
  { value: "narrow", label: "窄" },
  { value: "standard", label: "标准" },
  { value: "wide", label: "宽" },
];

const THEME_OPTIONS: { value: AppearanceSettings["theme"]; label: string; icon: string }[] = [
  { value: "light", label: "亮", icon: "☀️" },
  { value: "dark", label: "暗", icon: "🌙" },
  { value: "sepia", label: "护眼", icon: "📖" },
  { value: "system", label: "系统", icon: "🔄" },
];

const FONT_OPTIONS: { value: AppearanceSettings["fontFamily"]; label: string }[] = [
  { value: "system", label: "系统" },
  { value: "serif", label: "衬线" },
  { value: "sans", label: "无衬线" },
  { value: "mono", label: "等宽" },
];

const MIN_FONT = 14;
const MAX_FONT = 22;

export function AppearancePopover({ appearance, onUpdate, onClose }: AppearancePopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute top-full right-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-xl p-4 w-[280px]"
    >
      {/* 字号 */}
      <div className="mb-4">
        <div className="text-[10px] text-muted-foreground uppercase mb-2 tracking-wide">字号</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onUpdate({ fontSize: Math.max(MIN_FONT, appearance.fontSize - 1) })}
            disabled={appearance.fontSize <= MIN_FONT}
            className={cn(
              "w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors",
              appearance.fontSize <= MIN_FONT
                ? "text-muted-foreground/40"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            A-
          </button>
          <div className="flex-1 text-center text-sm font-medium tabular-nums">
            {appearance.fontSize}px
          </div>
          <button
            onClick={() => onUpdate({ fontSize: Math.min(MAX_FONT, appearance.fontSize + 1) })}
            disabled={appearance.fontSize >= MAX_FONT}
            className={cn(
              "w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors",
              appearance.fontSize >= MAX_FONT
                ? "text-muted-foreground/40"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            A+
          </button>
        </div>
      </div>

      {/* 行高 */}
      <div className="mb-4">
        <div className="text-[10px] text-muted-foreground uppercase mb-2 tracking-wide">行高</div>
        <div className="flex gap-1">
          {LINE_HEIGHT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onUpdate({ lineHeight: opt.value })}
              className={cn(
                "flex-1 py-1.5 rounded-md text-xs font-medium transition-colors",
                appearance.lineHeight === opt.value
                  ? "bg-blue-500/10 text-blue-500"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 页边距 */}
      <div className="mb-4">
        <div className="text-[10px] text-muted-foreground uppercase mb-2 tracking-wide">页边距</div>
        <div className="flex gap-1">
          {MARGIN_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onUpdate({ margins: opt.value })}
              className={cn(
                "flex-1 py-1.5 rounded-md text-xs font-medium transition-colors",
                appearance.margins === opt.value
                  ? "bg-blue-500/10 text-blue-500"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 主题 */}
      <div className="mb-4">
        <div className="text-[10px] text-muted-foreground uppercase mb-2 tracking-wide">主题</div>
        <div className="flex gap-1">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onUpdate({ theme: opt.value })}
              className={cn(
                "flex-1 py-1.5 rounded-md text-xs font-medium transition-colors flex flex-col items-center gap-0.5",
                appearance.theme === opt.value
                  ? "bg-blue-500/10 text-blue-500"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <span>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 字体 */}
      <div>
        <div className="text-[10px] text-muted-foreground uppercase mb-2 tracking-wide">字体</div>
        <div className="grid grid-cols-4 gap-1">
          {FONT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onUpdate({ fontFamily: opt.value })}
              className={cn(
                "py-1.5 rounded-md text-xs font-medium transition-colors",
                appearance.fontFamily === opt.value
                  ? "bg-blue-500/10 text-blue-500"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

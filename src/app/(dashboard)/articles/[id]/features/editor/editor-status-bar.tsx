"use client";

import { cn } from "@/lib/utils";

interface EditorStatusBarProps {
  characterCount: number;
  wordCount: number;
  saveStatus: "saved" | "saving" | "unsaved" | "error";
}

const statusLabels: Record<EditorStatusBarProps["saveStatus"], string> = {
  saved: "已保存",
  saving: "保存中…",
  unsaved: "未保存",
  error: "保存失败",
};

const statusColors: Record<EditorStatusBarProps["saveStatus"], string> = {
  saved: "text-green-500",
  saving: "text-blue-500",
  unsaved: "text-amber-500",
  error: "text-red-500",
};

export function EditorStatusBar({
  characterCount,
  wordCount,
  saveStatus,
}: EditorStatusBarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-1.5 border-t border-[var(--glass-border)] bg-[var(--glass-panel-bg)] backdrop-blur-xl text-xs text-muted-foreground shrink-0">
      <div className="flex items-center gap-3">
        <span>{characterCount.toLocaleString()} 字符</span>
        <span>{wordCount.toLocaleString()} 字</span>
      </div>
      <div className={cn("font-medium", statusColors[saveStatus])}>
        {statusLabels[saveStatus]}
      </div>
    </div>
  );
}

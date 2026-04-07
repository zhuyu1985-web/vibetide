"use client";

import { Play, Clock, Loader2, Save } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BottomActionBarProps {
  onTestRun: () => void;
  onToggleEnabled: () => void;
  onSave: () => void;
  isEnabled: boolean;
  triggerType: "manual" | "scheduled";
  saving: boolean;
  testRunning: boolean;
  hasChanges: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BottomActionBar({
  onTestRun,
  onToggleEnabled,
  onSave,
  isEnabled,
  triggerType,
  saving,
  testRunning,
  hasChanges,
}: BottomActionBarProps) {
  return (
    <div className="flex items-center justify-center gap-3 px-6 py-3 border-t border-border bg-background shrink-0">
      {/* 测试运行 */}
      <button
        onClick={onTestRun}
        disabled={testRunning}
        className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-sm text-foreground hover:bg-black/[0.08] dark:hover:bg-white/[0.12] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {testRunning ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Play className="w-4 h-4" />
        )}
        {testRunning ? "运行中..." : "测试运行"}
      </button>

      {/* 开启/关闭 — only for scheduled */}
      {triggerType === "scheduled" && (
        <button
          onClick={onToggleEnabled}
          className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm transition-colors cursor-pointer ${
            isEnabled
              ? "bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20"
              : "bg-black/[0.05] dark:bg-white/[0.08] text-muted-foreground hover:bg-black/[0.08] dark:hover:bg-white/[0.12]"
          }`}
        >
          <Clock className="w-4 h-4" />
          {isEnabled ? "已开启" : "开启"}
        </button>
      )}

      {/* 保存更改 */}
      <button
        onClick={onSave}
        disabled={saving || !hasChanges}
        className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        {saving ? "保存中..." : "保存更改"}
      </button>
    </div>
  );
}

"use client";

import { Play, Loader2, Save } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BottomActionBarProps {
  onTestRun: () => void;
  onSave: () => void;
  saving: boolean;
  testRunning: boolean;
  hasChanges: boolean;
}

// ---------------------------------------------------------------------------
// Component
//
// 2026-05-29 重构(ADR-0002):
//   - 移除"开启/已开启"按钮 —— 旧版只翻 React 内存 state,根本不写 DB,
//     真正的定时控制在每条 schedule 行的 enabled toggle 上(TriggerCard
//     打开的 Sheet 里)
//   - 移除 triggerType / isEnabled / onToggleEnabled 三个 prop
// ---------------------------------------------------------------------------

export function BottomActionBar({
  onTestRun,
  onSave,
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

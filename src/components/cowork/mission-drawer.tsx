"use client";

import { ChevronLeft, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CoworkMissionPanel } from "./cowork-mission-panel";

/**
 * 会话页右侧 mission 抽屉:有 mission 时关闭态折叠为窄栏,保留再次展开入口。
 * - 发送瞬间 open=true 但 missionId 仍为空 → 显 loading「正在解析意图…」(立即反馈)。
 * - mission 解析好(focus)→ 渲染 CoworkMissionPanel(含具名 SSE 实时打勾)。
 * - 也可点对话里 mission 卡片直接 focus 打开。关闭按钮回调 onClose。
 */
export function MissionDrawer({
  missionId,
  open,
  onOpen,
  onClose,
}: {
  missionId: string | null;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  if (!open) {
    if (!missionId) return null;
    return (
      <aside className="flex w-11 flex-none flex-col items-center border-l border-border/60 bg-muted/20 py-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onOpen}
          aria-label="展开执行过程"
          title="展开执行过程"
          className="size-8"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div className="mt-2 flex flex-1 items-start justify-center">
          <span className="[writing-mode:vertical-rl] text-[11px] font-medium text-muted-foreground">
            执行过程
          </span>
        </div>
      </aside>
    );
  }

  return (
    <div className="flex-none animate-in fade-in slide-in-from-right-4 duration-200">
      {missionId ? (
        <CoworkMissionPanel missionId={missionId} onClose={onClose} />
      ) : (
        <aside className="flex w-72 flex-none flex-col border-l border-border/60 bg-muted/20">
          <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
            <span className="text-xs font-medium">任务执行</span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="关闭任务面板"
              className="size-6 text-muted-foreground"
            >
              <X className="size-4" />
            </Button>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-2.5 px-6 text-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin text-primary" />
            <p className="text-xs">正在解析意图、安排任务…</p>
          </div>
        </aside>
      )}
    </div>
  );
}

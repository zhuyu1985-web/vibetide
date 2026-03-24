"use client";

import { cn } from "@/lib/utils";
import type { ViewMode, ContentType } from "../../types";

interface QuickCommandsProps {
  viewMode: ViewMode;
  contentType: ContentType;
  onCommand: (command: string) => void;
}

const READ_COMMANDS = ["总结全文", "提取金句", "分析立场", "生成时间线", "翻译全文", "事实核查"];
const EDIT_COMMANDS = ["润色选中", "续写下文", "生成标题", "缩写摘要", "扩写详述", "改为正式语体"];
const VIDEO_COMMANDS = ["总结视频", "提取关键帧描述", "生成文字稿", "识别说话人"];

function getCommands(viewMode: ViewMode, contentType: ContentType): string[] {
  if (contentType === "video") return VIDEO_COMMANDS;
  if (viewMode === "edit") return EDIT_COMMANDS;
  return READ_COMMANDS;
}

export function QuickCommands({ viewMode, contentType, onCommand }: QuickCommandsProps) {
  const commands = getCommands(viewMode, contentType);

  return (
    <div className="flex gap-1.5 overflow-x-auto px-3 py-2 scrollbar-hide shrink-0">
      {commands.map((cmd) => (
        <button
          key={cmd}
          onClick={() => onCommand(cmd)}
          className={cn(
            "text-[9px] px-2 py-1 bg-muted/50 rounded-full whitespace-nowrap",
            "text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
          )}
        >
          {cmd}
        </button>
      ))}
    </div>
  );
}

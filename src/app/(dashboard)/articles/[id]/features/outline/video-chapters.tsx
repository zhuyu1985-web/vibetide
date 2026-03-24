"use client";

import type { VideoChapter } from "../../types";
import { cn } from "@/lib/utils";

interface VideoChaptersProps {
  chapters: VideoChapter[];
  currentTime: number;
  onChapterClick: (startTime: number) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function VideoChapters({
  chapters,
  currentTime,
  onChapterClick,
}: VideoChaptersProps) {
  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
      {chapters.map((chapter, i) => {
        const isActive =
          currentTime >= chapter.startTime && currentTime < chapter.endTime;
        return (
          <button
            key={i}
            className={cn(
              "w-full px-2 py-1.5 rounded text-xs flex gap-2 items-center cursor-pointer transition-colors",
              isActive
                ? "bg-blue-500/10 text-blue-500"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
            onClick={() => onChapterClick(chapter.startTime)}
          >
            <span className="font-mono shrink-0 text-[11px]">
              {formatTime(chapter.startTime)}
            </span>
            <span className="truncate">{chapter.title}</span>
          </button>
        );
      })}
    </div>
  );
}

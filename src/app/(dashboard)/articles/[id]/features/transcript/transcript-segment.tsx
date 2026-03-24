"use client";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { TranscriptSegment } from "../../types";

const SPEAKER_COLORS = [
  "text-blue-400",
  "text-green-400",
  "text-orange-400",
  "text-purple-400",
  "text-pink-400",
  "text-cyan-400",
];

function getSpeakerColor(speaker: string): string {
  let hash = 0;
  for (const c of speaker) hash = (hash * 31 + c.charCodeAt(0)) | 0;
  return SPEAKER_COLORS[Math.abs(hash) % SPEAKER_COLORS.length];
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

interface TranscriptSegmentProps {
  segment: TranscriptSegment;
  displayText: string;
  speakerName: string;
  isActive: boolean;
  onClickTimestamp: (time: number) => void;
  onCorrectText?: (text: string) => void;
}

export function TranscriptSegmentItem({
  segment,
  displayText,
  speakerName,
  isActive,
  onClickTimestamp,
  onCorrectText,
}: TranscriptSegmentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(displayText);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Keep edit value in sync when displayText changes externally
  useEffect(() => {
    if (!isEditing) setEditValue(displayText);
  }, [displayText, isEditing]);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  function handleDoubleClick() {
    setEditValue(displayText);
    setIsEditing(true);
  }

  function handleBlur() {
    setIsEditing(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== displayText) {
      onCorrectText?.(trimmed);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      inputRef.current?.blur();
    }
    if (e.key === "Escape") {
      setEditValue(displayText);
      setIsEditing(false);
    }
  }

  const speakerColor = getSpeakerColor(segment.speaker);

  return (
    <div
      className={cn(
        "flex gap-2 px-2 py-1.5 rounded-sm transition-colors",
        isActive
          ? "bg-blue-500/5 border-l-2 border-blue-500"
          : "border-l-2 border-transparent",
      )}
    >
      {/* Timestamp */}
      <button
        type="button"
        onClick={() => onClickTimestamp(segment.startTime)}
        className={cn(
          "font-mono text-[9px] min-w-[36px] shrink-0 pt-0.5 leading-none",
          "text-white/30 hover:text-blue-400 transition-colors cursor-pointer",
        )}
        title="跳转到此处"
      >
        {formatTime(segment.startTime)}
      </button>

      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        {/* Speaker name */}
        <span className={cn("text-[9px] font-medium leading-none", speakerColor)}>
          {speakerName}
        </span>

        {/* Text — editable on double-click */}
        {isEditing ? (
          <textarea
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            rows={2}
            className={cn(
              "text-xs w-full resize-none rounded px-1 py-0.5",
              "bg-white/5 text-white/90 outline-none ring-1 ring-blue-500/50",
              "leading-relaxed",
            )}
          />
        ) : (
          <p
            onDoubleClick={handleDoubleClick}
            title="双击编辑"
            className={cn(
              "text-xs leading-relaxed cursor-text select-text",
              isActive ? "text-white/90" : "text-white/50",
            )}
          >
            {displayText}
          </p>
        )}
      </div>
    </div>
  );
}

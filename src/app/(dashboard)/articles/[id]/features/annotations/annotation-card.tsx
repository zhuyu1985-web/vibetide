"use client";

import { cn } from "@/lib/utils";
import type { Annotation, AnnotationColor } from "../../types";

const COLOR_MAP: Record<
  AnnotationColor,
  { border: string; text: string; dot: string }
> = {
  red: { border: "border-l-red-500", text: "text-red-400", dot: "bg-red-500" },
  yellow: {
    border: "border-l-yellow-500",
    text: "text-yellow-400",
    dot: "bg-yellow-500",
  },
  green: {
    border: "border-l-green-500",
    text: "text-green-400",
    dot: "bg-green-500",
  },
  blue: {
    border: "border-l-blue-500",
    text: "text-blue-400",
    dot: "bg-blue-500",
  },
  purple: {
    border: "border-l-purple-500",
    text: "text-purple-400",
    dot: "bg-purple-500",
  },
};

const ALL_COLORS: AnnotationColor[] = ["red", "yellow", "green", "blue", "purple"];

interface AnnotationCardProps {
  annotation: Annotation;
  isHighlighted?: boolean;
  onChangeColor: (color: AnnotationColor) => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onCopy: () => void;
  onClick: () => void;
}

export function AnnotationCard({
  annotation,
  isHighlighted,
  onChangeColor,
  onDelete,
  onTogglePin,
  onCopy,
  onClick,
}: AnnotationCardProps) {
  const colors = COLOR_MAP[annotation.color];

  return (
    <div
      className={cn(
        "border-l-[3px] rounded-r-md px-3 py-2.5 cursor-pointer transition-all duration-200",
        "bg-[var(--glass-panel-bg)] hover:bg-white/5",
        colors.border,
        isHighlighted && "ring-2 ring-blue-500/30 bg-blue-500/5"
      )}
      onClick={onClick}
    >
      {/* Pinned badge */}
      {annotation.isPinned && (
        <div className="flex items-center gap-1 mb-1">
          <span className="text-[10px] text-amber-400/80">📌 已浮顶</span>
        </div>
      )}

      {/* Quote */}
      <p className={cn("text-[10px] leading-relaxed line-clamp-2", colors.text)}>
        &ldquo;{annotation.quote}&rdquo;
      </p>

      {/* Note or placeholder */}
      {annotation.note ? (
        <p className="text-xs text-foreground mt-1.5 leading-relaxed">
          {annotation.note}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground/60 mt-1.5 italic">
          仅高亮，无批注
        </p>
      )}

      {/* Action row */}
      <div
        className="flex items-center mt-2.5 gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Color dots */}
        {ALL_COLORS.map((c) => (
          <button
            key={c}
            className={cn(
              "w-3 h-3 rounded-full transition-transform hover:scale-125",
              COLOR_MAP[c].dot,
              annotation.color === c && "ring-2 ring-white/50 ring-offset-1 ring-offset-transparent"
            )}
            onClick={() => onChangeColor(c)}
            title={c}
          />
        ))}

        {/* Spacer */}
        <span className="flex-1" />

        {/* Copy */}
        <button
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors px-1"
          onClick={onCopy}
          title="复制"
        >
          📋
        </button>

        {/* Pin */}
        <button
          className={cn(
            "text-[11px] transition-colors px-1",
            annotation.isPinned
              ? "text-amber-400 hover:text-amber-300"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={onTogglePin}
          title={annotation.isPinned ? "取消浮顶" : "浮顶"}
        >
          📌
        </button>

        {/* Delete */}
        <button
          className="text-[11px] text-muted-foreground hover:text-red-400 transition-colors px-1"
          onClick={onDelete}
          title="删除"
        >
          🗑
        </button>
      </div>
    </div>
  );
}

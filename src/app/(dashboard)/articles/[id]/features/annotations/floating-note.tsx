"use client";

import { useState, useCallback, useRef } from "react";
import type { Annotation, AnnotationColor } from "../../types";
import { cn } from "@/lib/utils";

const BORDER_COLORS: Record<AnnotationColor, string> = {
  red: "border-l-red-500",
  yellow: "border-l-yellow-500",
  green: "border-l-green-500",
  blue: "border-l-blue-500",
  purple: "border-l-purple-500",
};

const TEXT_COLORS: Record<AnnotationColor, string> = {
  red: "text-red-400",
  yellow: "text-yellow-400",
  green: "text-green-400",
  blue: "text-blue-400",
  purple: "text-purple-400",
};

interface FloatingNoteProps {
  annotation: Annotation;
  onUnpin: () => void;
  onClose: () => void;
  onPositionChange: (position: { x: number; y: number }) => void;
}

export function FloatingNote({
  annotation,
  onUnpin,
  onClose,
  onPositionChange,
}: FloatingNoteProps) {
  const NOTE_WIDTH = 260;
  const NOTE_HEIGHT = 160; // approximate height for clamping

  // Compute initial position: use pinnedPosition if available, else center of viewport
  const getInitialPos = () => {
    if (annotation.pinnedPosition) {
      return annotation.pinnedPosition;
    }
    return {
      x: Math.max(0, (window.innerWidth - NOTE_WIDTH) / 2),
      y: Math.max(0, (window.innerHeight - NOTE_HEIGHT) / 2),
    };
  };

  const [pos, setPos] = useState<{ x: number; y: number }>(() => getInitialPos());
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  // Mutable ref so mousemove closure always has the latest position without stale state
  const latestPos = useRef(pos);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      isDragging.current = true;
      dragOffset.current = {
        x: e.clientX - latestPos.current.x,
        y: e.clientY - latestPos.current.y,
      };

      const handleMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const newX = Math.max(
          0,
          Math.min(ev.clientX - dragOffset.current.x, window.innerWidth - NOTE_WIDTH)
        );
        const newY = Math.max(
          0,
          Math.min(ev.clientY - dragOffset.current.y, window.innerHeight - NOTE_HEIGHT)
        );
        latestPos.current = { x: newX, y: newY };
        setPos({ x: newX, y: newY });
      };

      const handleMouseUp = () => {
        if (!isDragging.current) return;
        isDragging.current = false;
        onPositionChange(latestPos.current);
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    },
    [onPositionChange]
  );

  const borderColor = BORDER_COLORS[annotation.color];
  const textColor = TEXT_COLORS[annotation.color];

  return (
    <div
      className={cn(
        "fixed z-50 opacity-[0.92] backdrop-blur-sm",
        "bg-popover border border-border rounded-xl shadow-2xl",
        "flex flex-col overflow-hidden select-none"
      )}
      style={{
        width: NOTE_WIDTH,
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        top: 0,
        left: 0,
      }}
    >
      {/* Drag handle header */}
      <div
        className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-muted/40 cursor-grab active:cursor-grabbing shrink-0"
        onMouseDown={handleMouseDown}
      >
        <span className="text-muted-foreground text-sm leading-none select-none">⠿</span>
        <span className="text-xs text-muted-foreground flex-1 select-none">浮顶笔记</span>
        <button
          className="text-[11px] text-amber-400/80 hover:text-amber-300 transition-colors px-1"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onUnpin}
          title="归位到批注栏"
        >
          归位
        </button>
        <button
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors px-1"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={onClose}
          title="关闭"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div className={cn("border-l-[3px] mx-3 my-2.5 pl-2.5", borderColor)}>
        {/* Quote */}
        <p className={cn("text-[10px] leading-relaxed line-clamp-2", textColor)}>
          &ldquo;{annotation.quote}&rdquo;
        </p>

        {/* Note or placeholder */}
        {annotation.note ? (
          <p className="text-xs text-foreground mt-1.5 leading-relaxed line-clamp-3">
            {annotation.note}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground/60 mt-1.5 italic">仅高亮，无批注</p>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useRef, useEffect, useCallback, useTransition } from "react";
import { Pen, Sparkles, Search, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { createAnnotation } from "@/app/actions/annotations";
import { useArticlePageStore } from "../../store";
import type { AnnotationColor } from "../../types";

interface TextSelectionMenuProps {
  articleId: string;
  organizationId: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const COLORS: { color: AnnotationColor; bg: string; label: string }[] = [
  { color: "red",    bg: "bg-red-400",    label: "红色高亮" },
  { color: "yellow", bg: "bg-yellow-400", label: "黄色高亮" },
  { color: "green",  bg: "bg-green-400",  label: "绿色高亮" },
  { color: "blue",   bg: "bg-blue-400",   label: "蓝色高亮" },
  { color: "purple", bg: "bg-purple-400", label: "紫色高亮" },
];

export function TextSelectionMenu({
  articleId,
  organizationId,
  containerRef,
}: TextSelectionMenuProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedTextLocal] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { setSelectedText: setStoreText, setLeftTab } = useArticlePageStore();
  const [, startTransition] = useTransition();

  const dismiss = useCallback(() => {
    setVisible(false);
    setSelectedTextLocal("");
  }, []);

  const handleMouseUp = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        return;
      }

      const container = containerRef.current;
      if (!container) return;

      // Check that at least one range endpoint is within our container
      const range = selection.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) return;

      const text = selection.toString().trim();
      const rect = range.getBoundingClientRect();

      // Position above selection, centered
      const menuWidth = 220;
      const menuHeight = 40;
      const margin = 8;

      let x = rect.left + rect.width / 2 - menuWidth / 2;
      let y = rect.top - menuHeight - margin;

      // If near the top of the viewport, show below instead
      if (y < margin) {
        y = rect.bottom + margin;
      }

      // Clamp horizontally within viewport
      x = Math.max(margin, Math.min(x, window.innerWidth - menuWidth - margin));

      setSelectedTextLocal(text);
      setPosition({ x, y });
      setVisible(true);
    }, 100);
  }, [containerRef]);

  // Dismiss on click outside
  useEffect(() => {
    if (!visible) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        dismiss();
      }
    };

    const handleScroll = () => dismiss();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("scroll", handleScroll, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("scroll", handleScroll, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [visible, dismiss]);

  // Attach mouseup to container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("mouseup", handleMouseUp);
    return () => container.removeEventListener("mouseup", handleMouseUp);
  }, [containerRef, handleMouseUp]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleColorClick = (color: AnnotationColor) => {
    const quote = selectedText;
    dismiss();
    startTransition(async () => {
      try {
        await createAnnotation(articleId, {
          organizationId,
          quote,
          color,
          position: 0,
        });
      } catch (err) {
        console.error("[TextSelectionMenu] createAnnotation failed", err);
      }
    });
  };

  const handleAIClick = () => {
    setStoreText(selectedText);
    setLeftTab("chat");
    dismiss();
  };

  const handleCopyClick = () => {
    navigator.clipboard.writeText(selectedText).catch(() => {});
    dismiss();
  };

  if (!visible) return null;

  return (
    <div
      ref={menuRef}
      className={cn(
        "bg-popover border border-border rounded-lg shadow-lg p-1 flex items-center gap-0.5",
        "select-none"
      )}
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        zIndex: 50,
      }}
      // Prevent mousedown from dismissing via the "click outside" handler
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Color dots */}
      {COLORS.map(({ color, bg, label }) => (
        <button
          key={color}
          title={label}
          className={cn(
            "w-4 h-4 rounded-full cursor-pointer hover:scale-110 transition-transform shrink-0"
          )}
          style={{ background: undefined }}
          onClick={() => handleColorClick(color)}
        >
          <span
            className={cn("block w-full h-full rounded-full", bg)}
            aria-label={label}
          />
        </button>
      ))}

      {/* Divider */}
      <div className="w-px h-4 bg-border mx-0.5 shrink-0" />

      {/* Action: Open annotation note */}
      <button
        title="添加批注"
        className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
        onClick={() => {
          // Switch to annotations tab on the right panel
          useArticlePageStore.getState().setRightTab("annotations");
          dismiss();
        }}
      >
        <Pen className="h-3.5 w-3.5" />
      </button>

      {/* Action: AI Analysis */}
      <button
        title="AI 分析"
        className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
        onClick={handleAIClick}
      >
        <Sparkles className="h-3.5 w-3.5" />
      </button>

      {/* Action: Search (placeholder) */}
      <button
        title="搜索"
        className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
        onClick={dismiss}
      >
        <Search className="h-3.5 w-3.5" />
      </button>

      {/* Action: Copy */}
      <button
        title="复制"
        className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
        onClick={handleCopyClick}
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

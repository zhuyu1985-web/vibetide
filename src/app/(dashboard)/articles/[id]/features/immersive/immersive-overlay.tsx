"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, X } from "lucide-react";
import { ArticleReader } from "../reader/article-reader";
import type { ArticleDetail } from "@/lib/types";
import type { AppearanceSettings } from "../../types";

interface ImmersiveOverlayProps {
  article: ArticleDetail;
  appearance: AppearanceSettings;
  organizationId?: string;
  onClose: () => void;
}

// 沉浸阅读：fixed inset-0 全屏遮罩，只渲染正文，隐藏所有侧栏 / nav。
// ESC 或右上角关闭按钮退出，由父组件把 activeView 切回 preview。
export function ImmersiveOverlay({
  article,
  appearance,
  organizationId,
  onClose,
}: ImmersiveOverlayProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // 锁定 body 滚动，避免背景跟随滚
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  if (!mounted) return null;

  // Portal 到 body 根节点，避免被 dashboard layout 的 sticky header / topbar 压住
  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-xl overflow-y-auto animate-in fade-in-0 zoom-in-[0.98] duration-300 ease-out">
      {/* 左上「返回」按钮 */}
      <button
        onClick={onClose}
        className="fixed top-5 left-6 z-10 h-9 flex items-center gap-1.5 pl-2 pr-3 rounded-full bg-background/80 hover:bg-background shadow-md ring-1 ring-border text-sm font-medium text-foreground transition-colors backdrop-blur"
      >
        <ArrowLeft className="h-4 w-4" />
        返回
      </button>
      {/* 右上「关闭」图标按钮（ESC 同效） */}
      <button
        onClick={onClose}
        aria-label="退出沉浸阅读（Esc）"
        title="退出沉浸阅读（Esc）"
        className="fixed top-5 right-6 z-10 h-10 w-10 flex items-center justify-center rounded-full bg-background/80 hover:bg-background shadow-md ring-1 ring-border text-foreground transition-colors backdrop-blur"
      >
        <X className="h-5 w-5" />
      </button>
      <div className="min-h-full py-10 animate-in slide-in-from-bottom-4 fade-in-0 duration-500 ease-out">
        <ArticleReader
          article={article}
          appearance={appearance}
          organizationId={organizationId}
        />
      </div>
    </div>,
    document.body,
  );
}

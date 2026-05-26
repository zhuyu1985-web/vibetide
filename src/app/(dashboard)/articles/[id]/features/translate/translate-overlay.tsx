"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowLeftRight, Loader2, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SourceUrlPill } from "@/components/shared/source-url-pill";
import type { ArticleDetail } from "@/lib/types";

interface TranslateOverlayProps {
  article: ArticleDetail;
  onClose: () => void;
}

type Direction = "zh2en" | "en2zh";

// 全屏翻译视图：左右双栏，原文 ↔ 译文。
// AI 翻译复用 /api/ai/edit（流式输出），支持中英互译切换。
export function TranslateOverlay({ article, onClose }: TranslateOverlayProps) {
  const [direction, setDirection] = useState<Direction>("zh2en");
  const [translated, setTranslated] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const autoTriggeredRef = useRef(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ESC 关闭 + 锁定背景滚动
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = originalOverflow;
    };
  }, [onClose]);

  const sourceHtml = article.body ?? "";
  const sourceTitle = article.title;

  const handleTranslate = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsTranslating(true);
    setTranslated("");
    try {
      const targetLang = direction === "zh2en" ? "英文" : "中文";
      const instruction = `请将以下 HTML 文章翻译为${targetLang}，保留 HTML 结构与排版标签，仅翻译文字内容。`;
      const response = await fetch("/api/ai/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "translate",
          instruction,
          fullContent: sourceHtml,
        }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setTranslated(acc);
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setTranslated(
          `[翻译失败] ${err instanceof Error ? err.message : "请稍后重试"}`,
        );
      }
    } finally {
      setIsTranslating(false);
    }
  };

  // 进入翻译模式时自动触发一次（默认中→英）
  useEffect(() => {
    if (autoTriggeredRef.current) return;
    if (!sourceHtml.trim()) return;
    autoTriggeredRef.current = true;
    void handleTranslate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted) return null;

  // Portal 到 body 根节点，避免被 dashboard layout 的 sticky header / topbar 压住
  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-xl flex flex-col animate-in fade-in-0 zoom-in-[0.98] duration-300 ease-out">
      {/* 顶栏 */}
      <div className="h-14 flex items-center justify-between px-6 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="h-9 flex items-center gap-1.5 pl-2 pr-3 rounded-full bg-background/80 hover:bg-background shadow-sm ring-1 ring-border text-sm font-medium text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </button>
          <SourceUrlPill url={article.sourceUrl} variant="compact" />
        </div>

        <div className="flex items-center gap-3">
          {/* 方向切换 */}
          <button
            onClick={() =>
              setDirection((d) => (d === "zh2en" ? "en2zh" : "zh2en"))
            }
            className="h-9 flex items-center gap-2 px-3 rounded-full bg-muted/40 hover:bg-muted/70 text-sm transition-colors"
            title="切换翻译方向"
          >
            <span className="font-medium">
              {direction === "zh2en" ? "中文" : "英文"}
            </span>
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">
              {direction === "zh2en" ? "英文" : "中文"}
            </span>
          </button>

          <button
            onClick={handleTranslate}
            disabled={isTranslating}
            className={cn(
              "h-10 flex items-center gap-1.5 px-5 rounded-full text-sm font-semibold transition-colors shadow-md ring-1",
              isTranslating
                ? "bg-blue-500/50 text-white ring-blue-400/40 cursor-not-allowed"
                : "bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 text-white ring-blue-400/30",
            )}
          >
            {isTranslating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {isTranslating ? "翻译中…" : "AI 翻译"}
          </button>
        </div>

        <button
          onClick={onClose}
          aria-label="退出翻译（Esc）"
          title="退出翻译（Esc）"
          className="h-10 w-10 flex items-center justify-center rounded-full bg-background/80 hover:bg-background shadow-sm ring-1 ring-border text-foreground transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* 左右双栏 */}
      <div className="flex-1 overflow-hidden grid grid-cols-2 divide-x divide-border">
        {/* 左：原文 —— 从左侧滑入 */}
        <div className="overflow-y-auto animate-in slide-in-from-left-6 fade-in-0 duration-500 ease-out">
          <div className="mx-auto px-10 py-10" style={{ maxWidth: 720 }}>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">
              原文
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-6">
              {sourceTitle}
            </h1>
            <div
              className="prose dark:prose-invert max-w-none leading-loose"
              dangerouslySetInnerHTML={{ __html: sourceHtml }}
            />
          </div>
        </div>

        {/* 右：译文 —— 从右侧滑入 */}
        <div className="overflow-y-auto bg-violet-50/20 dark:bg-violet-500/[0.03] animate-in slide-in-from-right-6 fade-in-0 duration-500 ease-out">
          <div className="mx-auto px-10 py-10" style={{ maxWidth: 720 }}>
            <div className="text-[11px] uppercase tracking-wider text-violet-600 dark:text-violet-300 mb-3">
              译文
            </div>
            {translated ? (
              <div
                className="prose dark:prose-invert max-w-none leading-loose"
                dangerouslySetInnerHTML={{ __html: translated }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-20 gap-4">
                <Sparkles className="h-10 w-10 text-violet-400 opacity-50" />
                <p className="text-sm text-muted-foreground">
                  当前方向：{direction === "zh2en" ? "中 → 英" : "英 → 中"}
                </p>
                <button
                  onClick={handleTranslate}
                  disabled={isTranslating}
                  className={cn(
                    "h-11 flex items-center gap-2 px-6 rounded-full text-base font-medium transition-colors shadow-md",
                    isTranslating
                      ? "bg-blue-500/40 text-white cursor-not-allowed"
                      : "bg-blue-500 text-white hover:bg-blue-600",
                  )}
                >
                  {isTranslating ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Sparkles className="h-5 w-5" />
                  )}
                  {isTranslating ? "翻译中…" : "开始 AI 翻译"}
                </button>
                <p className="text-xs text-muted-foreground/70">
                  也可使用顶部按钮切换语言方向
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

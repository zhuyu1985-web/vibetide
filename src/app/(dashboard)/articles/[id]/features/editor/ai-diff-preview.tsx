"use client";

/**
 * AI 改写结果 diff 预览对话框。
 *
 * 用法：bubble menu 点「润色 / 简写 / 扩写 / 总结」→ 弹此 dialog → 流式响应填到右侧
 * → 用户点「接受替换」回调 onApply(newText)，调用方在 editor 里用
 * setTextSelection(range).insertContent(newText) 替换原选区。
 */

import { useEffect, useRef, useState } from "react";
import { Loader2, Check, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export type AiEditMode = "polish" | "rewrite-condense" | "rewrite-expand" | "summarize";

interface AiEditConfig {
  apiMode: "polish" | "rewrite" | "summarize";
  instruction: string;
  label: string;
}

const MODE_CONFIG: Record<AiEditMode, AiEditConfig> = {
  polish: {
    apiMode: "polish",
    instruction: "",
    label: "AI 润色",
  },
  "rewrite-condense": {
    apiMode: "rewrite",
    instruction: "请把选中内容缩短为更精炼的版本，保留核心信息，控制在原长度的 50% 左右。",
    label: "AI 简写",
  },
  "rewrite-expand": {
    apiMode: "rewrite",
    instruction: "请把选中内容扩展为更详细的版本，加入背景、例子或解释，控制在原长度的 200% 左右。",
    label: "AI 扩写",
  },
  summarize: {
    apiMode: "summarize",
    instruction: "",
    label: "AI 总结",
  },
};

interface AiDiffPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: AiEditMode;
  originalText: string;
  fullContext: string;
  onApply: (newText: string) => void;
}

export function AiDiffPreview({
  open,
  onOpenChange,
  mode,
  originalText,
  fullContext,
  onApply,
}: AiDiffPreviewProps) {
  const [streaming, setStreaming] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const config = MODE_CONFIG[mode];

  const runEdit = async () => {
    const ctrl = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ctrl;
    setStreaming(true);
    setError(null);
    setResult("");

    try {
      const res = await fetch("/api/ai/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullContent: fullContext,
          selectedText: originalText,
          instruction: config.instruction,
          mode: config.apiMode,
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        throw new Error(`AI 服务返回 ${res.status}`);
      }
      if (!res.body) {
        throw new Error("AI 服务无响应体");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        setResult(buffer);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError((err as Error).message ?? "AI 改写失败");
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  // 打开时自动跑一次
  useEffect(() => {
    if (open) {
      runEdit();
    }
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  const canApply = !streaming && result.trim().length > 0 && !error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {config.label}
            {streaming && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
          </DialogTitle>
          <DialogDescription>
            对比原文与 AI 改写结果。可编辑右侧文本后点「接受替换」插回编辑器。
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 h-[400px]">
          <div className="flex flex-col">
            <div className="text-xs font-medium text-muted-foreground px-2 py-1.5">
              原文
            </div>
            <div className="flex-1 overflow-y-auto rounded-lg bg-muted/40 px-3 py-2 text-sm whitespace-pre-wrap">
              {originalText}
            </div>
          </div>
          <div className="flex flex-col">
            <div className="text-xs font-medium text-muted-foreground px-2 py-1.5">
              {config.label}结果（可编辑）
            </div>
            <textarea
              value={error ? "" : result}
              onChange={(e) => setResult(e.target.value)}
              disabled={streaming}
              placeholder={streaming ? "AI 正在改写…" : "等待 AI 响应"}
              className={cn(
                "flex-1 resize-none rounded-lg bg-blue-50/40 dark:bg-blue-500/[0.05] px-3 py-2 text-sm whitespace-pre-wrap outline-none focus:ring-2 focus:ring-blue-400/30",
                error && "text-red-600 dark:text-red-400",
              )}
            />
            {error && (
              <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex items-center gap-2">
          <button
            onClick={() => onOpenChange(false)}
            className="h-8 flex items-center gap-1 px-3 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            取消
          </button>
          <button
            onClick={runEdit}
            disabled={streaming}
            className="h-8 flex items-center gap-1 px-3 rounded-md text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", streaming && "animate-spin")} />
            重试
          </button>
          <button
            onClick={() => {
              if (canApply) {
                onApply(result.trim());
                onOpenChange(false);
              }
            }}
            disabled={!canApply}
            className={cn(
              "h-8 flex items-center gap-1 px-3 rounded-md text-xs font-medium transition-colors",
              canApply
                ? "bg-blue-500 text-white hover:bg-blue-600"
                : "bg-muted/40 text-muted-foreground opacity-50",
            )}
          >
            <Check className="h-3.5 w-3.5" />
            接受替换
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

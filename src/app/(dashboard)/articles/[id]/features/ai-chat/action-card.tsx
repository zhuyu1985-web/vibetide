"use client";

import { cn } from "@/lib/utils";

type EditMode = "polish" | "continue" | "rewrite" | "summarize" | "translate" | "extract";

const TYPE_LABELS: Record<EditMode, string> = {
  polish: "润色",
  continue: "续写",
  rewrite: "改写",
  summarize: "摘要",
  translate: "翻译",
  extract: "提取",
};

interface ActionCardProps {
  type: EditMode;
  originalText?: string;
  generatedText: string;
  isStreaming?: boolean;
  onApply: () => void;
  onCopy: () => void;
  onRegenerate: () => void;
}

export function ActionCard({
  type,
  originalText,
  generatedText,
  isStreaming,
  onApply,
  onCopy,
  onRegenerate,
}: ActionCardProps) {
  const showDiff = (type === "polish" || type === "rewrite") && !!originalText;
  const label = TYPE_LABELS[type] ?? type;

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-muted/30 text-sm w-full">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-purple-500/10 border-b border-border">
        <span className="text-purple-400 text-xs">✦</span>
        <span className="text-purple-400 font-medium text-xs">
          AI {label} 结果
        </span>
      </div>

      {/* Content */}
      <div className="px-3 py-2.5 space-y-2">
        {showDiff ? (
          <div className="space-y-1.5">
            <div
              className={cn(
                "rounded px-2 py-1.5 text-xs leading-relaxed whitespace-pre-wrap break-words",
                "bg-red-500/10 text-red-400 line-through"
              )}
            >
              {originalText}
            </div>
            <div
              className={cn(
                "rounded px-2 py-1.5 text-xs leading-relaxed whitespace-pre-wrap break-words",
                "bg-green-500/10 text-green-400"
              )}
            >
              {generatedText || "..."}
              {isStreaming && (
                <span className="inline-block w-0.5 h-3 bg-green-400 ml-0.5 animate-pulse align-middle" />
              )}
            </div>
          </div>
        ) : (
          <div className="text-xs leading-relaxed whitespace-pre-wrap break-words text-foreground/90">
            {generatedText || "..."}
            {isStreaming && (
              <span className="inline-block w-0.5 h-3 bg-foreground/60 ml-0.5 animate-pulse align-middle" />
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-1 px-3 py-2 border-t border-border">
        <button
          onClick={onApply}
          disabled={isStreaming}
          className={cn(
            "px-2.5 py-1 rounded text-xs font-medium transition-colors",
            "bg-green-500/15 text-green-400 hover:bg-green-500/25",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          应用到编辑器
        </button>
        <button
          onClick={onCopy}
          disabled={isStreaming}
          className={cn(
            "px-2.5 py-1 rounded text-xs transition-colors",
            "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          复制
        </button>
        <button
          onClick={onRegenerate}
          disabled={isStreaming}
          className={cn(
            "px-2.5 py-1 rounded text-xs transition-colors",
            "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          重新生成
        </button>
      </div>
    </div>
  );
}

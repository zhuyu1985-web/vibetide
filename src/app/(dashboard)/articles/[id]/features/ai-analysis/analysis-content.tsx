"use client";

import { cn } from "@/lib/utils";
import type { AIAnalysisCacheItem, AISentiment } from "../../types";

interface AnalysisContentProps {
  item: AIAnalysisCacheItem | null;
  isGenerating: boolean;
  streamingText: string | null;
}

const SENTIMENT_MAP: Record<
  AISentiment,
  { label: string; className: string }
> = {
  neutral: {
    label: "客观中立",
    className: "bg-muted/40 text-muted-foreground",
  },
  bullish: {
    label: "看涨",
    className: "bg-green-500/15 text-green-400",
  },
  critical: {
    label: "批判性",
    className: "bg-amber-500/15 text-amber-400",
  },
  advertorial: {
    label: "软广嫌疑",
    className: "bg-red-500/15 text-red-400",
  },
};

function LoadingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      <span
        className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce"
        style={{ animationDelay: "300ms" }}
      />
    </div>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function AnalysisContent({
  item,
  isGenerating,
  streamingText,
}: AnalysisContentProps) {
  // While streaming: show the in-progress text
  const displayText = isGenerating ? streamingText : item?.analysisText ?? null;
  const sentiment = !isGenerating ? item?.sentiment : undefined;
  const generatedAt = !isGenerating ? item?.generatedAt : undefined;

  if (!displayText && !isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
        <span className="text-2xl opacity-30">✦</span>
        <p className="text-xs text-muted-foreground">
          选择分析视角后，AI 将自动生成解读
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sentiment badge + timestamp */}
      {(sentiment || generatedAt) && (
        <div className="flex items-center gap-2 px-3 pt-2 shrink-0 flex-wrap">
          {sentiment && (
            <span
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-full font-medium",
                SENTIMENT_MAP[sentiment].className
              )}
            >
              {SENTIMENT_MAP[sentiment].label}
            </span>
          )}
          {generatedAt && (
            <span className="text-[10px] text-muted-foreground/60 ml-auto">
              {formatDate(generatedAt)}
            </span>
          )}
        </div>
      )}

      {/* Content area */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {isGenerating && !displayText && <LoadingDots />}
        {displayText && (
          <p className="text-xs leading-relaxed whitespace-pre-wrap text-foreground/90">
            {displayText}
          </p>
        )}
        {isGenerating && displayText && (
          <span className="inline-block w-0.5 h-3 bg-blue-400 animate-pulse ml-0.5 align-middle" />
        )}
      </div>
    </div>
  );
}

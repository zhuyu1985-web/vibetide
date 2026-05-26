"use client";

import { useEffect } from "react";
import { Sparkles } from "lucide-react";
import { useAIAnalysis } from "../ai-analysis/use-ai-analysis";
import type { AIAnalysisCacheItem } from "../../types";

interface BriefViewProps {
  articleId: string;
  articleContent: string;
  initialCache: AIAnalysisCacheItem[];
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-1.5 py-2">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}

// 中央「AI 速览」视图：挂载后自动用 summary perspective 总结整篇文章。
// 复用 ai-analysis 的 hook 和缓存层，避免重复请求。
// 字号比侧栏 AnalysisContent 大一档，适配中央阅读区。
export function BriefView({
  articleId,
  articleContent,
  initialCache,
}: BriefViewProps) {
  const {
    setCurrentPerspective,
    currentItem,
    isGenerating,
    streamingText,
  } = useAIAnalysis(articleId, articleContent, initialCache);

  useEffect(() => {
    setCurrentPerspective("summary");
  }, [setCurrentPerspective]);

  const displayText = isGenerating ? streamingText : currentItem?.analysisText;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[760px] mx-auto px-8 py-10">
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="w-5 h-5 text-blue-500" />
          <h2 className="text-xl font-semibold text-foreground">AI 速览</h2>
          <span className="text-sm text-muted-foreground">
            · 整篇文章结构化摘要
          </span>
        </div>
        <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-panel-bg)] backdrop-blur-xl min-h-[280px] px-6 py-5">
          {isGenerating && !displayText && <LoadingDots />}
          {displayText && (
            <div className="text-base leading-[1.85] whitespace-pre-wrap text-foreground/90">
              {displayText}
              {isGenerating && (
                <span className="inline-block w-0.5 h-4 bg-blue-400 animate-pulse ml-0.5 align-middle" />
              )}
            </div>
          )}
          {!displayText && !isGenerating && (
            <div className="flex flex-col items-center justify-center h-[200px] gap-2 text-center">
              <span className="text-3xl opacity-30">✦</span>
              <p className="text-sm text-muted-foreground">
                正在为您生成整篇文章的 AI 速览…
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

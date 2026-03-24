"use client";

import { useEffect } from "react";
import { useAIAnalysis } from "./use-ai-analysis";
import { PerspectiveSelector } from "./perspective-selector";
import { AnalysisContent } from "./analysis-content";
import { ChatInput } from "../ai-chat/chat-input";
import type { AIAnalysisCacheItem } from "../../types";

interface AIAnalysisPanelProps {
  articleId: string;
  articleContent: string;
  initialCache: AIAnalysisCacheItem[];
}

export function AIAnalysisPanel({
  articleId,
  articleContent,
  initialCache,
}: AIAnalysisPanelProps) {
  const {
    currentPerspective,
    setCurrentPerspective,
    currentItem,
    isGenerating,
    streamingText,
  } = useAIAnalysis(articleId, articleContent, initialCache);

  // Auto-generate summary on first mount if not cached
  useEffect(() => {
    if (!currentItem && !isGenerating) {
      setCurrentPerspective("summary");
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFollowUp(text: string) {
    // Follow-up questions use the current perspective as context
    // The question is forwarded to the analysis generator with additional user instruction
    void setCurrentPerspective(currentPerspective);
    // For now, follow-up input is a no-op stub until the chat panel is wired in Phase 2
    void text;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Perspective selector */}
      <PerspectiveSelector
        value={currentPerspective}
        onChange={setCurrentPerspective}
        disabled={isGenerating}
      />

      {/* Scrollable analysis area */}
      <div className="flex-1 overflow-hidden">
        <AnalysisContent
          item={currentItem}
          isGenerating={isGenerating}
          streamingText={streamingText}
        />
      </div>

      {/* Follow-up input */}
      <ChatInput
        onSend={handleFollowUp}
        disabled={isGenerating}
        placeholder="就当前解读追问 AI…"
      />
    </div>
  );
}

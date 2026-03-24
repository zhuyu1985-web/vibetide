"use client";

import { useState, useCallback, useRef } from "react";
import type {
  AIAnalysisPerspective,
  AIAnalysisCacheItem,
} from "../../types";

export function useAIAnalysis(
  articleId: string,
  articleContent: string,
  initialCache: AIAnalysisCacheItem[]
) {
  const [currentPerspective, setCurrentPerspective] =
    useState<AIAnalysisPerspective>("summary");
  const [cache, setCache] = useState<
    Partial<Record<AIAnalysisPerspective, AIAnalysisCacheItem>>
  >(() => {
    const map: Partial<Record<AIAnalysisPerspective, AIAnalysisCacheItem>> = {};
    for (const item of initialCache) {
      map[item.perspective] = item;
    }
    return map;
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const getCachedOrGenerate = useCallback(
    async (perspective: AIAnalysisPerspective) => {
      setCurrentPerspective(perspective);

      // Return cached result immediately
      if (cache[perspective]) return;

      // Cancel any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsGenerating(true);
      setStreamingText("");

      try {
        const response = await fetch("/api/ai/analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            articleId,
            articleContent,
            perspective,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: "请求失败" }));
          throw new Error((err as { error?: string }).error ?? `HTTP ${response.status}`);
        }

        const body = response.body;
        if (!body) throw new Error("响应体为空");

        const reader = body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          setStreamingText(fullText);
        }

        // Save to local cache on completion
        const newItem: AIAnalysisCacheItem = {
          id: crypto.randomUUID(),
          articleId,
          perspective,
          analysisText: fullText,
          generatedAt: new Date().toISOString(),
        };
        setCache((prev) => ({ ...prev, [perspective]: newItem }));
        setStreamingText(null);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        const errorText =
          err instanceof Error ? err.message : "发生未知错误，请重试";
        setStreamingText(`[错误] ${errorText}`);
      } finally {
        setIsGenerating(false);
      }
    },
    [articleId, articleContent, cache]
  );

  const currentCached = cache[currentPerspective];

  return {
    currentPerspective,
    setCurrentPerspective: getCachedOrGenerate,
    currentItem: currentCached ?? null,
    isGenerating,
    streamingText,
  };
}

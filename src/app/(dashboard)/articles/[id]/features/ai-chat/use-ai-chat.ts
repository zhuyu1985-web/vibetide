"use client";

import { useState, useCallback, useRef } from "react";

export type EditActionType = "polish" | "continue" | "rewrite" | "summarize" | "translate" | "extract";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  actionType?: EditActionType;
  originalText?: string;
  selectionRange?: { from: number; to: number };
}

export function useAIChat(articleContent: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (userMessage: string, selectedText?: string) => {
      // Cancel any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: userMessage,
        timestamp: Date.now(),
      };

      const assistantId = crypto.randomUUID();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      // Build the messages array for the API (history + new user message)
      const apiMessages = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: userMessage },
      ];

      try {
        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: apiMessages,
            articleContent,
            selectedText,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: "请求失败" }));
          throw new Error(err.error ?? `HTTP ${response.status}`);
        }

        const body = response.body;
        if (!body) throw new Error("响应体为空");

        const reader = body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content + chunk }
                : m
            )
          );
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;

        const errorText =
          err instanceof Error ? err.message : "发生未知错误，请重试";

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `[错误] ${errorText}` }
              : m
          )
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [messages, articleContent]
  );

  const sendEditCommand = useCallback(
    async (params: {
      instruction: string;
      mode: EditActionType;
      selectedText?: string;
      selectionRange?: { from: number; to: number };
    }) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const { instruction, mode, selectedText, selectionRange } = params;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: instruction,
        timestamp: Date.now(),
      };

      const assistantId = crypto.randomUUID();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        actionType: mode,
        originalText: selectedText,
        selectionRange,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      try {
        const response = await fetch("/api/ai/edit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullContent: articleContent,
            selectedText,
            instruction,
            mode,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: "AI 编辑请求失败" }));
          throw new Error(err.error ?? `HTTP ${response.status}`);
        }

        const body = response.body;
        if (!body) throw new Error("响应体为空");

        const reader = body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content + chunk }
                : m
            )
          );
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;

        const errorText =
          err instanceof Error ? err.message : "发生未知错误，请重试";

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `[错误] ${errorText}` }
              : m
          )
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [articleContent]
  );

  const clearMessages = useCallback(() => setMessages([]), []);

  return { messages, isStreaming, sendMessage, sendEditCommand, clearMessages };
}

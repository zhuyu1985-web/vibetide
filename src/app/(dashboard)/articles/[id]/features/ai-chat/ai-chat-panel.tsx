"use client";

import { useEffect, useRef } from "react";
import { useAIChat } from "./use-ai-chat";
import { ChatMessage } from "./chat-message";
import { QuickCommands } from "./quick-commands";
import { ChatInput } from "./chat-input";
import { useArticlePageStore } from "../../store";
import type { ViewMode, ContentType } from "../../types";

interface AIChatPanelProps {
  articleContent: string;
  viewMode: ViewMode;
  contentType: ContentType;
}

export function AIChatPanel({ articleContent, viewMode, contentType }: AIChatPanelProps) {
  const { messages, isStreaming, sendMessage } = useAIChat(articleContent);
  const selectedText = useArticlePageStore((s) => s.selectedText);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  function handleSend(text: string) {
    sendMessage(text, selectedText ?? undefined);
  }

  function handleCommand(command: string) {
    let prompt = command;
    if (selectedText) {
      prompt = `${command}：\n\n"${selectedText}"`;
    }
    sendMessage(prompt, selectedText ?? undefined);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
            <span className="text-2xl">✦</span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              你好！我是 AI 助手，可以帮你总结文章、提取金句、分析立场，或回答任何关于本文的问题。
            </p>
            {selectedText && (
              <p className="text-[10px] text-blue-400/80 bg-blue-500/10 rounded-lg px-2 py-1 line-clamp-2">
                已选中：{selectedText}
              </p>
            )}
          </div>
        ) : (
          messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
        )}
      </div>

      {/* Quick commands */}
      <QuickCommands
        viewMode={viewMode}
        contentType={contentType}
        onCommand={handleCommand}
      />

      {/* Input bar */}
      <ChatInput
        onSend={handleSend}
        disabled={isStreaming}
        placeholder={selectedText ? `针对选中文字提问…` : `向 AI 助手提问…`}
      />
    </div>
  );
}

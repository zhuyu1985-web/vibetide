"use client";

import { useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import { useAIChat, type EditActionType } from "./use-ai-chat";
import { ChatMessage } from "./chat-message";
import { ActionCard } from "./action-card";
import { QuickCommands } from "./quick-commands";
import { ChatInput } from "./chat-input";
import { useArticlePageStore } from "../../store";
import type { ViewMode, ContentType } from "../../types";

interface AIChatPanelProps {
  articleId: string;
  articleContent: string;
  viewMode: ViewMode;
  contentType: ContentType;
}

/** Map quick command labels to edit modes */
const EDIT_COMMAND_MAP: Record<string, EditActionType> = {
  "润色选中": "polish",
  "续写下文": "continue",
  "缩写摘要": "summarize",
  "扩写详述": "rewrite",
  "改为正式语体": "rewrite",
  "生成标题": "rewrite",
};

export function AIChatPanel({ articleId, articleContent, viewMode, contentType }: AIChatPanelProps) {
  const { messages, isStreaming, sendMessage, sendEditCommand } = useAIChat(articleId, articleContent);
  const selectedText = useArticlePageStore((s) => s.selectedText);
  const selectedRange = useArticlePageStore((s) => s.selectedRange);
  const setSelectedText = useArticlePageStore((s) => s.setSelectedText);
  const editorInstance = useArticlePageStore((s) => s.editorInstance);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  function handleSend(text: string) {
    if (selectedText) {
      sendMessage(`${text}\n\n「${selectedText}」`, selectedText);
      setSelectedText(null);
    } else {
      sendMessage(text);
    }
  }

  function handleCommand(command: string) {
    const editMode = EDIT_COMMAND_MAP[command];

    if (editMode && viewMode === "edit") {
      // Route edit-mode quick commands through /api/ai/edit
      const instruction = selectedText
        ? `${command}：\n\n"${selectedText}"`
        : `${command}`;

      sendEditCommand({
        instruction,
        mode: editMode,
        selectedText: selectedText ?? undefined,
        selectionRange: selectedRange ?? undefined,
      });
      setSelectedText(null);
    } else {
      // Regular chat command
      let prompt = command;
      if (selectedText) {
        prompt = `${command}：\n\n"${selectedText}"`;
      }
      sendMessage(prompt, selectedText ?? undefined);
      setSelectedText(null);
    }
  }

  function handleDismissContext() {
    setSelectedText(null);
  }

  const handleApply = useCallback(
    (msgId: string) => {
      const msg = messages.find((m) => m.id === msgId);
      if (!msg || !editorInstance) return;

      const editor = editorInstance;
      const content = msg.content;

      if (msg.actionType === "continue") {
        // Insert at current cursor position
        editor.chain().focus().insertContent(content).run();
      } else if (
        (msg.actionType === "polish" || msg.actionType === "rewrite") &&
        msg.selectionRange
      ) {
        // Replace the original selection range
        const { from, to } = msg.selectionRange;
        editor
          .chain()
          .focus()
          .deleteRange({ from, to })
          .insertContentAt(from, content)
          .run();
      } else {
        // Fallback: insert at cursor
        editor.chain().focus().insertContent(content).run();
      }

      // Apply brief AI highlight for visual feedback
      try {
        const { from } = editor.state.selection;
        const insertedLength = content.length;
        const highlightFrom = Math.max(0, from - insertedLength);
        editor
          .chain()
          .setTextSelection({ from: highlightFrom, to: from })
          .setMark("aiHighlight")
          .run();

        // Remove highlight after animation completes
        setTimeout(() => {
          if (!editor.isDestroyed) {
            editor.chain().selectAll().unsetMark("aiHighlight").run();
            // Restore cursor to end of inserted content
            editor.commands.setTextSelection(from);
          }
        }, 2200);
      } catch {
        // Highlight is optional - don't break on failure
      }
    },
    [messages, editorInstance]
  );

  const handleCopy = useCallback(
    (msgId: string) => {
      const msg = messages.find((m) => m.id === msgId);
      if (msg) {
        navigator.clipboard.writeText(msg.content);
      }
    },
    [messages]
  );

  const handleRegenerate = useCallback(
    (msgId: string) => {
      const msg = messages.find((m) => m.id === msgId);
      if (!msg) return;

      // Find the preceding user message
      const msgIndex = messages.findIndex((m) => m.id === msgId);
      if (msgIndex < 1) return;
      const userMsg = messages[msgIndex - 1];
      if (userMsg.role !== "user") return;

      if (msg.actionType) {
        // Re-send as edit command
        sendEditCommand({
          instruction: userMsg.content,
          mode: msg.actionType,
          selectedText: msg.originalText,
          selectionRange: msg.selectionRange,
        });
      } else {
        sendMessage(userMsg.content);
      }
    },
    [messages, sendEditCommand, sendMessage]
  );

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
          messages.map((msg) =>
            msg.role === "assistant" && msg.actionType ? (
              <ActionCard
                key={msg.id}
                type={msg.actionType}
                originalText={msg.originalText}
                generatedText={msg.content}
                isStreaming={isStreaming && msg === messages[messages.length - 1]}
                onApply={() => handleApply(msg.id)}
                onCopy={() => handleCopy(msg.id)}
                onRegenerate={() => handleRegenerate(msg.id)}
              />
            ) : (
              <ChatMessage key={msg.id} message={msg} />
            )
          )
        )}
      </div>

      {/* Selected text context preview */}
      {selectedText && messages.length > 0 && (
        <div className="mx-3 mb-1 flex items-start gap-1.5 bg-blue-500/10 rounded-lg px-2.5 py-1.5">
          <span className="text-[10px] text-blue-400/80 leading-relaxed flex-1 line-clamp-2">
            「{selectedText}」
          </span>
          <button
            onClick={handleDismissContext}
            className="shrink-0 text-muted-foreground hover:text-foreground mt-0.5 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      )}

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

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import type { UseChatStreamReturn } from "@/hooks/use-chat-stream";
import {
  IntentAnalyzing,
  IntentResultBubble,
  IntentConfirmCard,
} from "@/components/chat/intent-bubble";
import { saveConversation } from "@/app/actions/conversations";
import { Maximize2, X, Loader2, Wrench, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmbeddedChatPanelProps {
  activeEmployee: EmployeeId;
  chat: UseChatStreamReturn;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EmbeddedChatPanel({
  activeEmployee,
  chat,
  onClose,
}: EmbeddedChatPanelProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const savingRef = useRef(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const meta = EMPLOYEE_META[activeEmployee] as typeof EMPLOYEE_META[EmployeeId] | undefined;
  const Icon = meta?.icon ?? UserCog;

  // ── Auto-scroll on new content ──
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [chat.messages, chat.currentThinking, chat.isStreaming]);

  // ── Save conversation after first complete assistant response ──
  useEffect(() => {
    if (
      !conversationId &&
      !savingRef.current &&
      chat.messages.length >= 2 &&
      !chat.isStreaming &&
      !chat.loading
    ) {
      const lastMsg = chat.messages[chat.messages.length - 1];
      if (lastMsg?.role === "assistant" && lastMsg.content.trim().length > 0) {
        savingRef.current = true;

        const title =
          chat.messages.find((m) => m.role === "user")?.content.slice(0, 50) ??
          "新对话";

        saveConversation({
          employeeSlug: activeEmployee,
          title,
          messages: chat.messages.map((m) => ({
            role: m.role,
            content: m.content,
            durationMs: m.durationMs,
            thinkingSteps: m.thinkingSteps,
            skillsUsed: m.skillsUsed,
            sources: m.sources,
            referenceCount: m.referenceCount,
          })),
        })
          .then((row) => {
            if (row?.id) setConversationId(row.id);
          })
          .catch((err) => {
            console.error("[embedded-chat] save failed:", err);
          })
          .finally(() => {
            savingRef.current = false;
          });
      }
    }
  }, [
    chat.messages,
    chat.isStreaming,
    chat.loading,
    conversationId,
    activeEmployee,
  ]);

  // ── Navigate to full chat page ──
  const handleExpand = () => {
    if (conversationId) {
      router.push(`/chat/${conversationId}`);
    } else {
      router.push(`/chat?employee=${activeEmployee}`);
    }
  };

  return (
    <div className="max-w-3xl mx-auto mt-6 animate-in slide-in-from-bottom-4 fade-in duration-500">
      <div className="bg-white/70 dark:bg-black/30 backdrop-blur-2xl border border-black/[0.08] dark:border-white/[0.08] rounded-2xl overflow-hidden shadow-[0_16px_48px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.08)]">
        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-black/5 dark:border-white/5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: meta?.bgColor ?? "rgba(107,114,128,0.15)" }}
          >
            <Icon size={16} style={{ color: meta?.color ?? "#6b7280" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white/90">
                {meta?.nickname ?? "AI 助手"}
              </span>
              <span className="text-xs text-gray-400 dark:text-white/40">{meta?.title ?? ""}</span>
              {(chat.isStreaming || chat.loading) && (
                <Loader2
                  size={14}
                  className="text-blue-400 animate-spin flex-shrink-0"
                />
              )}
            </div>
          </div>

          <button
            className="p-1.5 rounded-lg text-gray-400 dark:text-white/40 hover:text-gray-900 dark:hover:text-white/80 hover:bg-black/5 dark:hover:bg-white/5 transition-colors border-0"
            onClick={handleExpand}
            title="展开到独立页面"
          >
            <Maximize2 size={16} />
          </button>
          <button
            className="p-1.5 rounded-lg text-gray-400 dark:text-white/40 hover:text-gray-900 dark:hover:text-white/80 hover:bg-black/5 dark:hover:bg-white/5 transition-colors border-0"
            onClick={onClose}
            title="关闭"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Messages area ── */}
        <div
          ref={scrollRef}
          className="max-h-96 overflow-y-auto px-4 py-3 space-y-3 scroll-smooth"
        >
          {chat.messages.map((msg, i) => {
            const isUser = msg.role === "user";
            const isLastAssistant =
              msg.role === "assistant" && i === chat.messages.length - 1;

            return (
              <div
                key={i}
                className={cn(
                  "flex",
                  isUser ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                    isUser
                      ? "bg-blue-500/80 text-white shadow-[0_2px_12px_rgba(59,130,246,0.2)]"
                      : "bg-black/[0.03] dark:bg-white/[0.05] text-gray-800 dark:text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  )}
                >
                  {/* Message content */}
                  {msg.content ? (
                    <div className="whitespace-pre-wrap break-words">
                      {msg.content}
                    </div>
                  ) : isLastAssistant && (chat.isStreaming || chat.loading) ? (
                    <Loader2
                      size={14}
                      className="text-gray-400 dark:text-white/40 animate-spin"
                    />
                  ) : null}

                  {/* Thinking steps (only for the last assistant message while streaming) */}
                  {isLastAssistant &&
                    (chat.isStreaming || chat.loading) &&
                    chat.currentThinking.length > 0 && (
                      <div className="mt-2 space-y-1 border-t border-black/5 dark:border-white/5 pt-2">
                        {chat.currentThinking.map((step, si) => (
                          <div
                            key={si}
                            className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-white/40"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400/60 animate-pulse flex-shrink-0" />
                            <span>{step.label}</span>
                          </div>
                        ))}
                      </div>
                    )}

                  {/* Skills used badges */}
                  {msg.skillsUsed && msg.skillsUsed.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {msg.skillsUsed.map((skill) => (
                        <span
                          key={skill.tool}
                          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/5 text-gray-400 dark:text-white/40"
                        >
                          <Wrench size={9} className="flex-shrink-0" />
                          {skill.skillName}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* ── Intent indicators ── */}
          {chat.intentLoading && (
            <IntentAnalyzing steps={chat.intentProgress} />
          )}

          {chat.pendingIntent &&
            chat.pendingIntent.confidence < 0.8 &&
            !chat.isStreaming &&
            !chat.loading && (
              <IntentConfirmCard
                intent={chat.pendingIntent}
                onConfirm={(editedIntent) => {
                  chat.executeIntent(
                    chat.pendingMessage,
                    editedIntent,
                    true
                  );
                }}
                onCancel={chat.cancelIntent}
              />
            )}

          {chat.pendingIntent &&
            (chat.isStreaming || chat.loading) && (
              <IntentResultBubble
                intent={chat.pendingIntent}
                executing={chat.isStreaming || chat.loading}
                currentStep={chat.currentStep}
                onCancel={chat.cancelIntent}
              />
            )}
        </div>
      </div>
    </div>
  );
}

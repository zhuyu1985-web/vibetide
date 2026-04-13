"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import {
  markdownComponents,
  remarkPlugins,
} from "@/app/(dashboard)/employee/[id]/collapsible-markdown";
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import type { UseChatStreamReturn } from "@/hooks/use-chat-stream";
import type { ScenarioCardData } from "@/lib/types";
import {
  IntentAnalyzing,
  IntentResultBubble,
  IntentConfirmCard,
} from "@/components/chat/intent-bubble";
import { MessageActions } from "@/components/chat/message-actions";
import { saveConversation } from "@/app/actions/conversations";
import {
  Maximize2,
  X,
  Loader2,
  Wrench,
  UserCog,
  ChevronDown,
  Sparkles,
  Globe,
  Radar,
  Search,
  BarChart3,
  FileText,
  Activity,
  BookOpen,
  Lightbulb,
  Users,
  CalendarDays,
  Package,
  FolderOpen,
  PenTool,
  Type,
  Film,
  RefreshCw,
  Image as ImageIcon,
  Music,
  CheckCircle,
  Shield,
  TrendingUp,
  RotateCcw,
  Radio,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const ICON_MAP: Record<string, LucideIcon> = {
  Radar,
  Search,
  BarChart3,
  FileText,
  Activity,
  BookOpen,
  Lightbulb,
  Users,
  CalendarDays,
  Package,
  FolderOpen,
  PenTool,
  Type,
  Film,
  RefreshCw,
  Image: ImageIcon,
  Music,
  CheckCircle,
  Shield,
  TrendingUp,
  RotateCcw,
  Radio,
  Zap,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const SWITCHABLE_EMPLOYEES: EmployeeId[] = [
  "xiaolei", "xiaoce", "xiaozi", "xiaowen",
  "xiaojian", "xiaoshen", "xiaofa", "xiaoshu",
];

interface EmbeddedChatPanelProps {
  activeEmployee: EmployeeId;
  chat: UseChatStreamReturn;
  onClose: () => void;
  /** When true, the panel becomes flex-1 and removes slide-in animation */
  embedded?: boolean;
  /** Called when user switches to a different employee */
  onSwitchEmployee?: (slug: EmployeeId) => void;
  /** Scenario whose inline input form should be shown as an AI bubble. */
  inlineScenario?: ScenarioCardData | null;
  /** Called when user submits the inline scenario form. */
  onScenarioFormSubmit?: (
    scenario: ScenarioCardData,
    inputs: Record<string, string>
  ) => void;
  /** Called when user cancels the inline scenario form. */
  onCancelScenario?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EmbeddedChatPanel({
  activeEmployee,
  chat,
  onClose,
  embedded = false,
  onSwitchEmployee,
  inlineScenario,
  onScenarioFormSubmit,
  onCancelScenario,
}: EmbeddedChatPanelProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const savingRef = useRef(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [scenarioInputs, setScenarioInputs] = useState<Record<string, string>>(
    {}
  );

  // Reset form inputs whenever a new scenario is shown
  useEffect(() => {
    if (inlineScenario) {
      setScenarioInputs({});
    }
  }, [inlineScenario?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const meta = EMPLOYEE_META[activeEmployee] as typeof EMPLOYEE_META[EmployeeId] | undefined;
  const Icon = meta?.icon ?? UserCog;

  // ── Auto-scroll on new content ──
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [chat.messages, chat.currentThinking, chat.isStreaming, inlineScenario]);

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

  // ── User-triggered favorite (from MessageActions) ──
  // If auto-save hasn't run yet, force a save now. If already saved, no-op.
  // We don't duplicate the save logic — just flip `savingRef` false so the
  // auto-save effect picks it up on the next render. In practice, the
  // auto-save effect runs whenever `chat.messages` / `chat.loading` change,
  // so this path is mainly a user affordance when they want to save before
  // the auto-save fires.
  const handleFavoriteFromAction = useCallback(async () => {
    if (conversationId || savingRef.current) return;
    if (chat.messages.length < 2 || chat.isStreaming || chat.loading) return;

    const lastMsg = chat.messages[chat.messages.length - 1];
    if (!lastMsg || lastMsg.role !== "assistant" || !lastMsg.content.trim()) {
      return;
    }

    savingRef.current = true;
    try {
      const title =
        chat.messages.find((m) => m.role === "user")?.content.slice(0, 50) ??
        "新对话";
      const row = await saveConversation({
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
      });
      if (row?.id) setConversationId(row.id);
    } catch (err) {
      console.error("[embedded-chat] manual save failed:", err);
    } finally {
      savingRef.current = false;
    }
  }, [
    activeEmployee,
    chat.isStreaming,
    chat.loading,
    chat.messages,
    conversationId,
  ]);

  // ── Navigate to full chat page ──
  // Always snapshot the CURRENT in-memory state (messages, pendingIntent,
  // etc.) to sessionStorage so the chat center can hydrate instantly — even
  // if we're mid-stream. The active fetch on this panel will be dropped when
  // this component unmounts (React owns that closure); transferring the
  // snapshot at least keeps what the user has already seen on-screen.
  // If a saved row already exists, we also prefer the `continue=<id>` path so
  // the chat center can re-load from the DB (handles the case where the user
  // is away long enough for sessionStorage to be cleared).
  const handleExpand = () => {
    try {
      // Drop a trailing empty assistant message — it would render as an
      // eternal loading spinner on the new page since the stream is gone.
      const snapshotMessages =
        chat.messages.length > 0 &&
        chat.messages[chat.messages.length - 1].role === "assistant" &&
        !chat.messages[chat.messages.length - 1].content
          ? chat.messages.slice(0, -1)
          : chat.messages;

      sessionStorage.setItem(
        "home-chat-handoff",
        JSON.stringify({
          employeeSlug: activeEmployee,
          messages: snapshotMessages,
          conversationId,
          timestamp: Date.now(),
        })
      );
    } catch {
      // Quota / serialization errors — best-effort only
    }

    if (conversationId) {
      router.push(
        `/chat?employee=${activeEmployee}&continue=${conversationId}&handoff=1`
      );
    } else {
      router.push(`/chat?employee=${activeEmployee}&handoff=1`);
    }
  };

  return (
    <div
      className={cn(
        // Single root element — no nested wrap. When embedded, becomes a
        // strict flex-col that fills its parent row with its header
        // (shrink-0) pinned at the top and the scroll area taking the
        // remaining space. Every level has `min-h-0` so no min-content
        // leakage can push the layout out of bounds.
        embedded
          ? "flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden"
          : "max-w-3xl mx-auto mt-6 animate-in slide-in-from-bottom-4 fade-in duration-500"
      )}
    >
      <>
        {/* ── Header — minimal, no panel background ── */}
        <div className="flex items-center gap-3 py-2 shrink-0">
          {/* Employee switcher */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] rounded-lg px-1.5 py-1 -ml-1.5 transition-colors border-0 bg-transparent cursor-pointer">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: meta?.bgColor ?? "rgba(107,114,128,0.15)" }}
                >
                  <Icon size={16} style={{ color: meta?.color ?? "#6b7280" }} />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-gray-900 dark:text-white/90">
                    {meta?.nickname ?? "AI 助手"}
                  </span>
                  <ChevronDown size={12} className="text-gray-400 dark:text-white/30" />
                </div>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-2" sideOffset={8}>
              <div className="grid grid-cols-4 gap-1">
                {SWITCHABLE_EMPLOYEES.map((slug) => {
                  const emp = EMPLOYEE_META[slug];
                  const EmpIcon = emp.icon;
                  const isActive = slug === activeEmployee;
                  return (
                    <button
                      key={slug}
                      onClick={() => {
                        if (!isActive && onSwitchEmployee) {
                          onSwitchEmployee(slug);
                        }
                      }}
                      className={cn(
                        "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors border-0 bg-transparent",
                        isActive
                          ? "bg-black/[0.05] dark:bg-white/[0.08]"
                          : "hover:bg-black/[0.03] dark:hover:bg-white/[0.05] cursor-pointer"
                      )}
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: emp.bgColor }}
                      >
                        <EmpIcon size={18} style={{ color: emp.color }} />
                      </div>
                      <span className={cn(
                        "text-[10px] leading-none",
                        isActive
                          ? "text-gray-900 dark:text-white font-medium"
                          : "text-gray-500 dark:text-white/50"
                      )}>
                        {emp.nickname}
                      </span>
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

          {/* Title + loading indicator */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
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

        {/* ── Messages area — no panel background, messages flow freely ── */}
        <div
          ref={scrollRef}
          className={cn(
            "overflow-y-auto py-2 space-y-4 scroll-smooth",
            embedded ? "flex-1 min-h-0" : "max-h-96"
          )}
        >
          {chat.messages.map((msg, i) => {
            const isUser = msg.role === "user";
            const isLastAssistant =
              msg.role === "assistant" && i === chat.messages.length - 1;

            // Whether intent indicators should render after this user message
            // (mirrors chat-panel.tsx logic so intent appears inline, not at
            // the top/bottom of the whole list)
            const isLastUserBeforeAssistant =
              isUser &&
              i < chat.messages.length - 1 &&
              chat.messages[i + 1]?.role === "assistant";
            const isLastUserMsg = isUser && i === chat.messages.length - 1;
            const showIntentHere =
              (isLastUserBeforeAssistant || isLastUserMsg) &&
              (chat.intentLoading || !!chat.pendingIntent);

            const bubble = (
              <div
                className={cn(
                  "flex",
                  isUser ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "text-sm leading-relaxed",
                    isUser
                      ? "max-w-[80%] rounded-2xl px-3 py-2 bg-blue-500/80 text-white shadow-[0_2px_12px_rgba(59,130,246,0.2)]"
                      : "max-w-[90%] text-gray-800 dark:text-white/85"
                  )}
                >
                  {/* Message content — user bubbles stay plain text;
                      assistant bubbles render markdown (same plugins &
                      components as chat center for visual consistency). */}
                  {msg.content ? (
                    isUser ? (
                      <div className="whitespace-pre-wrap break-words">
                        {msg.content}
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed",
                          "[&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5",
                          "[&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-2",
                          "[&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-2.5 [&_h2]:mb-1.5",
                          "[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1",
                          "[&_strong]:text-gray-900 dark:[&_strong]:text-gray-100",
                          "[&_code]:text-xs [&_code]:bg-gray-100 dark:[&_code]:bg-gray-700 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded"
                        )}
                      >
                        <ReactMarkdown
                          remarkPlugins={remarkPlugins}
                          components={markdownComponents}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )
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

                  {/* Skills used — live during streaming, persisted after completion */}
                  {(() => {
                    const skills = msg.durationMs
                      ? msg.skillsUsed
                      : isLastAssistant
                        ? chat.currentSkillsUsed
                        : undefined;
                    return skills && skills.length > 0 ? (
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span className="text-[10px] text-gray-400 dark:text-white/40 mr-0.5">
                          使用技能
                        </span>
                        {skills.map((s) => (
                          <span
                            key={s.tool}
                            className={cn(
                              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-violet-50 dark:bg-violet-900/30 text-[10px] text-violet-600 dark:text-violet-400",
                              !msg.durationMs && "animate-in fade-in zoom-in-95 duration-200"
                            )}
                          >
                            <Sparkles size={9} className="flex-shrink-0" />
                            {s.skillName}
                          </span>
                        ))}
                      </div>
                    ) : null;
                  })()}

                  {/* Sources */}
                  {(() => {
                    const sources = msg.durationMs
                      ? msg.sources
                      : isLastAssistant
                        ? (chat.currentSources.length > 0 ? chat.currentSources : undefined)
                        : undefined;
                    return sources && sources.length > 0 ? (
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        {sources.slice(0, 4).map((src) => (
                          <span
                            key={src}
                            className={cn(
                              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-[10px] text-blue-600 dark:text-blue-400",
                              !msg.durationMs && "animate-in fade-in zoom-in-95 duration-200"
                            )}
                          >
                            <Globe size={9} className="flex-shrink-0" />
                            {src}
                          </span>
                        ))}
                        {sources.length > 4 && (
                          <span className="text-[10px] text-gray-400">
                            +{sources.length - 4}个来源
                          </span>
                        )}
                      </div>
                    ) : null;
                  })()}

                  {/* Per-message actions — only for completed assistant
                      messages. `compact` keeps the footprint tight for the
                      embedded panel. Shares the same MessageActions
                      component as the chat center for consistency. */}
                  {!isUser && msg.durationMs && msg.content && (
                    <MessageActions
                      compact
                      messageContent={msg.content}
                      employeeSlug={activeEmployee}
                      userPrompt={
                        chat.messages[i - 1]?.role === "user"
                          ? chat.messages[i - 1]?.content
                          : undefined
                      }
                      onRegenerate={() => {
                        void chat.regenerate(i);
                      }}
                      onFavorite={handleFavoriteFromAction}
                      isFavorited={!!conversationId}
                      shareUrl={
                        conversationId
                          ? `${typeof window !== "undefined" ? window.location.origin : ""}/chat/${conversationId}`
                          : undefined
                      }
                    />
                  )}
                </div>
              </div>
            );

            if (!isUser) return <React.Fragment key={i}>{bubble}</React.Fragment>;

            return (
              <React.Fragment key={i}>
                {bubble}
                {/* Intent bubbles — rendered right after the triggering user
                    message so they appear inline (matches chat-panel.tsx) */}
                {showIntentHere && chat.intentLoading && (
                  <IntentAnalyzing steps={chat.intentProgress} />
                )}
                {showIntentHere &&
                  chat.pendingIntent &&
                  !chat.intentLoading &&
                  (chat.pendingIntent.confidence < 0.8 &&
                  !chat.loading &&
                  !chat.isStreaming &&
                  isLastUserMsg ? (
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
                  ) : (
                    <IntentResultBubble
                      intent={chat.pendingIntent}
                      executing={chat.loading || chat.isStreaming}
                      currentStep={chat.currentStep}
                      onCancel={chat.cancelIntent}
                    />
                  ))}
              </React.Fragment>
            );
          })}

          {/* ── Inline scenario form (AI message bubble) ── */}
          {inlineScenario && !chat.loading && (
            <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{
                  backgroundColor: meta?.bgColor ?? "rgba(107,114,128,0.15)",
                }}
              >
                <Icon size={16} style={{ color: meta?.color ?? "#6b7280" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="bg-gradient-to-br from-white/80 to-gray-50/70 dark:from-gray-800/60 dark:to-gray-800/40 backdrop-blur-sm rounded-2xl shadow-[0_1px_6px_rgba(0,0,0,0.06)] ring-1 ring-gray-200/30 dark:ring-gray-700/30 px-5 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    {(() => {
                      const ScIcon = ICON_MAP[inlineScenario.icon] || Sparkles;
                      return (
                        <ScIcon
                          size={16}
                          style={{ color: meta?.color ?? "#3b82f6" }}
                        />
                      );
                    })()}
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      {inlineScenario.name}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    {inlineScenario.description}
                  </p>
                  <div className="space-y-3">
                    {inlineScenario.inputFields.map((field) => (
                      <div key={field.name}>
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                          {field.label}
                          {field.required && (
                            <span className="text-red-500 ml-0.5">*</span>
                          )}
                        </label>
                        {field.type === "select" ? (
                          <select
                            className="w-full h-9 px-3 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-200 outline-none focus:ring-1 focus:ring-blue-400/50 border border-gray-200 dark:border-gray-600 transition-all"
                            value={scenarioInputs[field.name] ?? ""}
                            onChange={(e) =>
                              setScenarioInputs((prev) => ({
                                ...prev,
                                [field.name]: e.target.value,
                              }))
                            }
                          >
                            <option value="">
                              {field.placeholder || "请选择"}
                            </option>
                            {field.options?.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : field.type === "textarea" ? (
                          <textarea
                            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-200 outline-none focus:ring-1 focus:ring-blue-400/50 border border-gray-200 dark:border-gray-600 resize-none transition-all"
                            rows={3}
                            placeholder={field.placeholder}
                            value={scenarioInputs[field.name] ?? ""}
                            onChange={(e) =>
                              setScenarioInputs((prev) => ({
                                ...prev,
                                [field.name]: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          <input
                            type="text"
                            className="w-full h-9 px-3 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-700 dark:text-gray-200 outline-none focus:ring-1 focus:ring-blue-400/50 border border-gray-200 dark:border-gray-600 transition-all"
                            placeholder={field.placeholder}
                            value={scenarioInputs[field.name] ?? ""}
                            onChange={(e) =>
                              setScenarioInputs((prev) => ({
                                ...prev,
                                [field.name]: e.target.value,
                              }))
                            }
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-4">
                    <button
                      className={cn(
                        "flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 border-0",
                        inlineScenario.inputFields.every(
                          (f) => !f.required || scenarioInputs[f.name]?.trim()
                        )
                          ? "bg-blue-500 text-white hover:bg-blue-600 shadow-sm cursor-pointer"
                          : "bg-gray-200 dark:bg-gray-600 text-gray-400 cursor-not-allowed"
                      )}
                      disabled={
                        !inlineScenario.inputFields.every(
                          (f) => !f.required || scenarioInputs[f.name]?.trim()
                        )
                      }
                      onClick={() => {
                        onScenarioFormSubmit?.(inlineScenario, scenarioInputs);
                      }}
                    >
                      <Sparkles size={13} />
                      开始执行
                    </button>
                    <button
                      className="px-3 py-2 rounded-lg text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 border-0 cursor-pointer"
                      onClick={() => {
                        onCancelScenario?.();
                      }}
                    >
                      取消
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </>
    </div>
  );
}

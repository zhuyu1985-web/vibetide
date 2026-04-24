"use client";

import { useState, useCallback, useRef } from "react";
import {
  executeStreamingChat,
  parseSSE,
  type ChatMessage,
  type ThinkingStep,
  type SkillUsed,
  type StepInfo,
} from "@/lib/chat-utils";
import type { IntentResult } from "@/lib/agent/types";
import type { IntentProgress } from "@/components/chat/intent-bubble";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseChatStreamOptions {
  /** The currently-selected employee slug (used for intent recognition). */
  employeeSlug: string;
}

export interface UseChatStreamReturn {
  // Message state
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;

  // Streaming display state
  isStreaming: boolean;
  loading: boolean;
  currentThinking: ThinkingStep[];
  currentSkillsUsed: SkillUsed[];
  currentSources: string[];
  currentRefCount: number;
  currentStep: StepInfo | null;

  // Intent state
  pendingIntent: IntentResult | null;
  setPendingIntent: React.Dispatch<React.SetStateAction<IntentResult | null>>;
  pendingMessage: string;
  setPendingMessage: React.Dispatch<React.SetStateAction<string>>;
  intentLoading: boolean;
  intentProgress: IntentProgress[];
  setIntentProgress: React.Dispatch<React.SetStateAction<IntentProgress[]>>;

  // Core actions
  /**
   * Execute a streaming chat request.
   * This is the low-level streaming function used by both free-chat and
   * intent/scenario execution paths.
   *
   * @param userContent - The user message text to display
   * @param history - Conversation history (messages before this turn)
   * @param url - API endpoint to stream from
   * @param body - Request body to POST
   */
  executeChat: (
    userContent: string,
    history: ChatMessage[],
    url: string,
    body: Record<string, unknown>
  ) => Promise<void>;

  /**
   * Send a message with intent recognition.
   * Handles the full flow: intent SSE -> route to free chat or intent execution.
   */
  sendMessage: (text: string) => Promise<void>;

  /**
   * Execute a confirmed (possibly edited) intent.
   */
  executeIntent: (
    text: string,
    intent: IntentResult,
    edited: boolean
  ) => Promise<void>;

  /** Cancel pending intent. */
  cancelIntent: () => void;

  /** Clear all messages and intent state. */
  clearMessages: () => void;

  /**
   * Regenerate the assistant response at `assistantIndex`. Truncates the
   * conversation up to (but not including) the user message that triggered
   * it, then re-runs the full intent-aware sendMessage pipeline on the same
   * user prompt. If the assistant message is followed by later turns, those
   * later turns are discarded — mirroring the behavior of most chat clients.
   */
  regenerate: (assistantIndex: number) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChatStream({
  employeeSlug,
}: UseChatStreamOptions): UseChatStreamReturn {
  // ── Message state ──
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // ── Streaming display state ──
  const [isStreaming, setIsStreaming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentThinking, setCurrentThinking] = useState<ThinkingStep[]>([]);
  const [currentSkillsUsed, setCurrentSkillsUsed] = useState<SkillUsed[]>([]);
  const [currentSources, setCurrentSources] = useState<string[]>([]);
  const [currentRefCount, setCurrentRefCount] = useState(0);
  const [currentStep, setCurrentStep] = useState<StepInfo | null>(null);

  // ── Intent state ──
  const [pendingIntent, setPendingIntent] = useState<IntentResult | null>(null);
  const [pendingMessage, setPendingMessage] = useState("");
  const [intentLoading, setIntentLoading] = useState(false);
  const [intentProgress, setIntentProgress] = useState<IntentProgress[]>([]);

  // Stable refs for values used inside callbacks that we don't want as deps
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;

  // ── Core streaming execution ──
  const executeChat = useCallback(
    async (
      userContent: string,
      history: ChatMessage[],
      url: string,
      body: Record<string, unknown>
    ) => {
      const userMsg: ChatMessage = { role: "user", content: userContent };
      const allMessages = [...history, userMsg];
      const assistantIdx = allMessages.length;
      setMessages([...allMessages, { role: "assistant", content: "" }]);
      setLoading(true);
      setIsStreaming(false);
      setCurrentThinking([]);
      setCurrentSkillsUsed([]);
      setCurrentSources([]);
      setCurrentRefCount(0);

      try {
        const thinkingSteps: ThinkingStep[] = [];
        const skillsUsed: SkillUsed[] = [];

        const { accumulated, durationMs } = await executeStreamingChat(
          url,
          body,
          {
            onThinking: (step) => {
              thinkingSteps.push(step);
              setCurrentThinking([...thinkingSteps]);
            },
            onSkillUsed: (skill) => {
              skillsUsed.push(skill);
              setCurrentSkillsUsed([...skillsUsed]);
            },
            onSource: (sources, totalReferences) => {
              setCurrentSources([...sources]);
              setCurrentRefCount(totalReferences);
            },
            onStepStart: (step) => {
              setCurrentStep(step);
            },
            onStepComplete: () => {
              setCurrentStep(null);
            },
            onTextDelta: (_delta, acc) => {
              setIsStreaming(true);
              setMessages((prev) => {
                if (prev.length <= assistantIdx) return prev;
                const updated = [...prev];
                updated[assistantIdx] = {
                  role: "assistant",
                  content: acc,
                };
                return updated;
              });
            },
            onDone: (result) => {
              setCurrentRefCount(result.referenceCount);
              setCurrentSources(result.sources);
              // Merge final skills
              for (const s of result.skillsUsed) {
                if (!skillsUsed.find((su) => su.tool === s.tool)) {
                  skillsUsed.push(s);
                }
              }
            },
            onError: (msg) => {
              setMessages((prev) => {
                if (prev.length <= assistantIdx) return prev;
                const updated = [...prev];
                updated[assistantIdx] = {
                  role: "assistant",
                  content: `执行出错：${msg}`,
                };
                return updated;
              });
            },
          }
        );

        setMessages((prev) => {
          if (prev.length <= assistantIdx) return prev;
          const updated = [...prev];
          updated[assistantIdx] = {
            role: "assistant",
            content: accumulated,
            durationMs,
            thinkingSteps:
              thinkingSteps.length > 0 ? thinkingSteps : undefined,
            skillsUsed: skillsUsed.length > 0 ? skillsUsed : undefined,
            sources:
              (prev[assistantIdx] as { sources?: string[] })?.sources ??
              undefined,
            referenceCount: undefined,
          };
          return updated;
        });

        // Re-apply final sources and refCount from the done callback
        setMessages((prev) => {
          if (prev.length <= assistantIdx) return prev;
          const updated = [...prev];
          const sources = [
            ...new Set([...(updated[assistantIdx]?.sources ?? [])]),
          ];
          updated[assistantIdx] = {
            ...updated[assistantIdx],
            sources: sources.length > 0 ? sources : undefined,
          };
          return updated;
        });
      } catch (err) {
        setMessages((prev) => {
          if (prev.length <= assistantIdx) return prev;
          const updated = [...prev];
          updated[assistantIdx] = {
            role: "assistant",
            content: `执行出错：${err instanceof Error ? err.message : "未知错误"}`,
          };
          return updated;
        });
      } finally {
        setLoading(false);
        setIsStreaming(false);
        setCurrentThinking([]);
        setCurrentSkillsUsed([]);
        setCurrentSources([]);
        // Keep pendingIntent visible after execution completes
        setCurrentStep(null);
        setIntentProgress([]);
        setCurrentRefCount(0);
      }
    },
    []
  );

  // ── Execute confirmed intent ──
  const executeIntentFn = useCallback(
    async (text: string, intent: IntentResult, edited: boolean) => {
      // Keep pendingIntent alive so hint bar stays visible during execution
      setPendingIntent(intent);
      setPendingMessage(text);
      // Collect history WITHOUT the pending user message (executeChat re-adds it)
      const currentMessages = messagesRef.current;
      const history = currentMessages.filter(
        (m, i) =>
          !(
            m.role === "user" &&
            m.content === text &&
            i === currentMessages.length - 1
          )
      );

      await executeChat(text, history, "/api/chat/intent-execute", {
        message: text,
        intent,
        conversationHistory: [
          ...history,
          { role: "user" as const, content: text },
        ].slice(-10),
        userEdited: edited,
      });
    },
    [executeChat]
  );

  // ── Send free chat message (with intent recognition) ──
  const sendMessage = useCallback(
    async (text: string) => {
      // Clear previous intent when sending a new message
      setPendingIntent(null);
      setPendingMessage("");

      // Immediately show the user message in the chat
      const historyBeforeSend = [...messagesRef.current];
      const userMsg: ChatMessage = { role: "user", content: text };
      setMessages((prev) => [...prev, userMsg]);

      const fallbackToFreeChat = async () => {
        setIntentLoading(false);
        setIntentProgress([]);
        // Remove the user message we added (executeChat will re-add it)
        setMessages(historyBeforeSend);
        await executeChat(text, historyBeforeSend, "/api/chat/stream", {
          employeeSlug,
          message: text,
          conversationHistory: [
            ...historyBeforeSend,
            { role: "user" as const, content: text },
          ].slice(-10),
        });
      };

      // Step 1: Call intent recognition API (SSE stream)
      setIntentLoading(true);
      setIntentProgress([]);
      try {
        const res = await fetch("/api/chat/intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, employeeSlug }),
        });

        if (!res.ok || !res.body) {
          console.warn("[intent] API failed, falling back to free chat");
          await fallbackToFreeChat();
          return;
        }

        // Parse SSE stream for progress events
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = "";
        let intentResult: IntentResult | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          sseBuffer += decoder.decode(value, { stream: true });

          const { events, remaining } = parseSSE(sseBuffer);
          sseBuffer = remaining;

          for (const evt of events) {
            try {
              const payload = JSON.parse(evt.data);
              if (evt.event === "progress") {
                setIntentProgress((prev) => [
                  ...prev,
                  { phase: payload.phase, label: payload.label },
                ]);
              } else if (evt.event === "result") {
                intentResult = payload as IntentResult;
              } else if (evt.event === "error") {
                console.warn("[intent] Stream error:", payload.message);
                await fallbackToFreeChat();
                return;
              }
            } catch {
              continue;
            }
          }
        }

        setIntentLoading(false);

        if (!intentResult) {
          await fallbackToFreeChat();
          return;
        }

        // Step 2: Route based on intent
        if (
          intentResult.intentType === "general_chat" ||
          intentResult.steps.length === 0
        ) {
          setIntentProgress([]);
          await fallbackToFreeChat();
        } else if (intentResult.confidence >= 0.8) {
          // High confidence — auto-execute
          // Remove the user message we added (executeIntent→executeChat will re-add it)
          setMessages(historyBeforeSend);
          setPendingIntent(intentResult);
          setPendingMessage(text);
          await executeIntentFn(text, intentResult, false);
        } else {
          // Low confidence — show editable intent card (keep user message visible)
          setPendingIntent(intentResult);
          setPendingMessage(text);
        }
      } catch {
        await fallbackToFreeChat();
      }
    },
    [employeeSlug, executeChat, executeIntentFn]
  );

  // ── Cancel pending intent ──
  const cancelIntent = useCallback(() => {
    setPendingIntent(null);
    setPendingMessage("");
    setIntentLoading(false);
  }, []);

  // ── Regenerate an assistant message ──
  const regenerate = useCallback(
    async (assistantIndex: number) => {
      const current = messagesRef.current;
      const userIdx = assistantIndex - 1;
      const userMsg = current[userIdx];
      if (!userMsg || userMsg.role !== "user") return;

      const userText = userMsg.content;
      // Truncate to the history BEFORE that user message. sendMessage will
      // re-add it. We mutate the ref synchronously so sendMessage's closure
      // picks up the truncated history even before React re-renders.
      const truncated = current.slice(0, userIdx);
      setMessages(truncated);
      messagesRef.current = truncated;

      // Clear any stale intent state from the previous run
      setPendingIntent(null);
      setPendingMessage("");
      setIntentProgress([]);

      await sendMessage(userText);
    },
    [sendMessage]
  );

  // ── Clear all messages and intent state ──
  const clearMessages = useCallback(() => {
    setMessages([]);
    setPendingIntent(null);
    setPendingMessage("");
    setIntentProgress([]);
  }, []);

  return {
    // Message state
    messages,
    setMessages,

    // Streaming display state
    isStreaming,
    loading,
    currentThinking,
    currentSkillsUsed,
    currentSources,
    currentRefCount,
    currentStep,

    // Intent state
    pendingIntent,
    setPendingIntent,
    pendingMessage,
    setPendingMessage,
    intentLoading,
    intentProgress,
    setIntentProgress,

    // Core actions
    executeChat,
    sendMessage,
    executeIntent: executeIntentFn,
    cancelIntent,
    clearMessages,
    regenerate,
  };
}

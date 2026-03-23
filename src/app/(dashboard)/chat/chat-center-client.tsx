"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { EmployeeListPanel } from "./employee-list-panel";
import { ChatPanel } from "./chat-panel";
import {
  executeStreamingChat,
  type ChatMessage,
  type ThinkingStep,
  type SkillUsed,
} from "@/lib/chat-utils";
import {
  saveConversation,
  deleteSavedConversation,
} from "@/app/actions/conversations";
import type { AIEmployee, ScenarioCardData } from "@/lib/types";
import type { SavedConversationRow } from "@/db/types";

interface ChatCenterClientProps {
  employees: AIEmployee[];
  savedConversations: SavedConversationRow[];
  scenarioMap: Record<string, ScenarioCardData[]>;
}

export function ChatCenterClient({
  employees,
  savedConversations: initialSavedConversations,
  scenarioMap,
}: ChatCenterClientProps) {
  const searchParams = useSearchParams();

  // Determine initial slug from URL or first employee
  const initialSlug =
    searchParams.get("employee") || (employees[0]?.id ?? "");

  const [selectedSlug, setSelectedSlug] = useState(initialSlug);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Persist messages per employee across switches
  const messagesMapRef = useRef<Record<string, ChatMessage[]>>({});
  // Track unread: number of assistant messages user hasn't seen for each employee
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  // Track how many messages user has "seen" per employee
  const seenCountRef = useRef<Record<string, number>>({});

  // Scenarios come from server-side props — instant lookup, no fetch needed
  const scenarios = scenarioMap[selectedSlug] ?? [];
  const [activeScenario, setActiveScenario] =
    useState<ScenarioCardData | null>(null);
  const [viewingSaved, setViewingSaved] =
    useState<SavedConversationRow | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [tab, setTab] = useState<"employees" | "saved">("employees");
  const [loading, setLoading] = useState(false);
  const [inlineScenario, setInlineScenario] =
    useState<ScenarioCardData | null>(null);
  const [savedConversations, setSavedConversations] = useState(
    initialSavedConversations
  );
  // Streaming state lifted here so ChatPanel can display it
  const [currentThinking, setCurrentThinking] = useState<ThinkingStep[]>([]);
  const [currentSkillsUsed, setCurrentSkillsUsed] = useState<SkillUsed[]>([]);
  const [currentSources, setCurrentSources] = useState<string[]>([]);
  const [currentRefCount, setCurrentRefCount] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);

  // Keep messagesMap in sync and mark current employee as fully read
  useEffect(() => {
    if (!selectedSlug || viewingSaved) return;
    if (messages.length > 0) {
      messagesMapRef.current[selectedSlug] = messages;
    }
    // User is viewing this employee — mark all as seen
    const assistantCount = messages.filter((m) => m.role === "assistant" && m.content).length;
    seenCountRef.current[selectedSlug] = assistantCount;
    // Clear unread for current employee
    setUnreadCounts((prev) => {
      if (!prev[selectedSlug]) return prev;
      const next = { ...prev };
      delete next[selectedSlug];
      return next;
    });
  }, [messages, selectedSlug, viewingSaved]);

  // Compute unread for all OTHER employees from their stored messages
  useEffect(() => {
    const newUnread: Record<string, number> = {};
    for (const [slug, msgs] of Object.entries(messagesMapRef.current)) {
      if (slug === selectedSlug) continue;
      const assistantCount = msgs.filter((m) => m.role === "assistant" && m.content).length;
      const seen = seenCountRef.current[slug] ?? 0;
      const diff = assistantCount - seen;
      if (diff > 0) newUnread[slug] = diff;
    }
    setUnreadCounts(newUnread);
  }, [selectedSlug]);

  // Track whether the initial scenario was from a first execution (for follow-ups)
  const scenarioInputsRef = useRef<Record<string, string>>({});

  const selectedEmployee = employees.find((e) => e.id === selectedSlug) ?? null;

  // Lock the entire ancestor chain to fixed viewport height so the chat
  // center can use flex layout without any container overflowing.
  // Chain: sidebar-wrapper(min-h-svh) > SidebarInset(flex-1) > inner-main(flex-1) > div.p-6 > this
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    // Collect all ancestors up to body and patch them
    const patches: { el: HTMLElement; saved: string }[] = [];
    const patch = (target: HTMLElement | null | undefined, styles: Record<string, string>) => {
      if (!target) return;
      patches.push({ el: target, saved: target.style.cssText });
      Object.assign(target.style, styles);
    };

    const wrapper = el.parentElement; // div.relative.z-10.p-6
    const innerMain = wrapper?.parentElement; // main.flex-1.overflow-y-auto
    const sidebarInset = innerMain?.parentElement; // SidebarInset (main)
    const sidebarWrapper = sidebarInset?.parentElement; // sidebar-wrapper div

    // sidebar-wrapper: lock to viewport height
    patch(sidebarWrapper, { height: "100svh", maxHeight: "100svh", overflow: "hidden" });
    // SidebarInset: constrain height, don't grow
    patch(sidebarInset, { minHeight: "0", overflow: "hidden" });
    // inner-main: flex container, no scroll
    patch(innerMain, { overflow: "hidden", display: "flex", flexDirection: "column" });
    // div.p-6 wrapper: fill remaining space
    patch(wrapper, { padding: "0", flex: "1", minHeight: "0", display: "flex", flexDirection: "column" });

    return () => {
      for (const p of patches) p.el.style.cssText = p.saved;
    };
  }, []);

  // Update URL when slug changes — use history.replaceState to avoid Next.js navigation/scroll
  useEffect(() => {
    if (selectedSlug) {
      const current = searchParams.get("employee");
      if (current !== selectedSlug) {
        window.history.replaceState(null, "", `/chat?employee=${selectedSlug}`);
      }
    }
  }, [selectedSlug, searchParams]);

  /* ── Employee selection ── */
  const handleSelectEmployee = useCallback(
    (slug: string) => {
      if (slug === selectedSlug && !viewingSaved) return;
      // Save current employee's messages
      if (selectedSlug && messages.length > 0 && !viewingSaved) {
        messagesMapRef.current[selectedSlug] = messages;
      }
      // Restore target employee's messages (or empty)
      const restored = messagesMapRef.current[slug] ?? [];
      setMessages(restored);
      setActiveScenario(null);
      setInlineScenario(null);
      setViewingSaved(null);
      setIsSaved(false);
      setSelectedSlug(slug);
      setTab("employees");
      scenarioInputsRef.current = {};
      // Clear unread for the target employee
      setUnreadCounts((prev) => {
        if (!prev[slug]) return prev;
        const next = { ...prev };
        delete next[slug];
        return next;
      });
    },
    [selectedSlug, viewingSaved, messages]
  );

  /* ── Saved conversation selection ── */
  const handleSelectSaved = useCallback(
    (conv: SavedConversationRow) => {
      setViewingSaved(conv);
      setSelectedSlug(conv.employeeSlug);
      setMessages(
        (conv.messages as ChatMessage[]) ?? []
      );
      setActiveScenario(null);
      setIsSaved(true);
    },
    []
  );

  /* ── Delete saved conversation ── */
  const handleDeleteSaved = useCallback(
    async (id: string) => {
      try {
        await deleteSavedConversation(id);
        setSavedConversations((prev) => prev.filter((c) => c.id !== id));
        if (viewingSaved?.id === id) {
          setViewingSaved(null);
          setMessages([]);
          setIsSaved(false);
        }
      } catch {
        // silently fail
      }
    },
    [viewingSaved]
  );

  /* ── New chat ── */
  const handleNewChat = useCallback(() => {
    setMessages([]);
    setActiveScenario(null);
    setInlineScenario(null);
    setViewingSaved(null);
    setIsSaved(false);
    scenarioInputsRef.current = {};
    // Clear stored messages for current employee
    delete messagesMapRef.current[selectedSlug];
    setUnreadCounts((prev) => {
      if (!prev[selectedSlug]) return prev;
      const next = { ...prev };
      delete next[selectedSlug];
      return next;
    });
  }, [selectedSlug]);

  /* ── Save conversation ── */
  const handleSave = useCallback(async () => {
    if (!selectedEmployee || messages.length === 0 || isSaved) return;
    try {
      // Generate title from first user message
      const firstUserMsg = messages.find((m) => m.role === "user");
      const title = firstUserMsg
        ? firstUserMsg.content.slice(0, 50) +
          (firstUserMsg.content.length > 50 ? "..." : "")
        : `${selectedEmployee.nickname}对话`;

      const row = await saveConversation({
        employeeSlug: selectedSlug,
        title,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          durationMs: m.durationMs,
          thinkingSteps: m.thinkingSteps,
          skillsUsed: m.skillsUsed,
          sources: m.sources,
          referenceCount: m.referenceCount,
        })),
        scenarioId: activeScenario?.id,
      });

      setIsSaved(true);
      if (row) {
        setSavedConversations((prev) => [row, ...prev]);
      }
    } catch {
      // silently fail
    }
  }, [selectedEmployee, selectedSlug, messages, isSaved, activeScenario]);

  /* ── Select scenario — show inline form or execute directly ── */
  const handleSelectScenario = useCallback((scenario: ScenarioCardData) => {
    if (scenario.inputFields.length > 0) {
      setInlineScenario(scenario);
    } else {
      // No inputs needed, execute directly
      setInlineScenario(null);
      setActiveScenario(scenario);
      handleScenarioSubmit(scenario, {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Execute scenario with inputs ── */
  const handleScenarioSubmit = useCallback(
    async (scenario: ScenarioCardData, inputs: Record<string, string>) => {
      if (!selectedEmployee) return;
      setActiveScenario(scenario);
      setInlineScenario(null);
      scenarioInputsRef.current = inputs;

      const inputSummary = scenario.inputFields
        .map((f) => `${f.label}: ${inputs[f.name] || "全部"}`)
        .join("，");
      const userContent = inputSummary || `请执行「${scenario.name}」`;

      await executeChat(userContent, [], "/api/scenarios/execute", {
        employeeDbId: selectedEmployee.dbId,
        scenarioId: scenario.id,
        userInputs: inputs,
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedEmployee]
  );

  /* ── Send free chat message ── */
  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!selectedEmployee) return;

      const history = [...messages];

      // If we had a scenario but are now in follow-up mode, use chat/stream
      await executeChat(text, history, "/api/chat/stream", {
        employeeSlug: selectedSlug,
        message: text,
        conversationHistory: [...history, { role: "user" as const, content: text }].slice(-10),
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedEmployee, selectedSlug, messages]
  );

  /* ── Core streaming execution ── */
  const executeChat = async (
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
    setIsSaved(false);

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
          onTextDelta: (_delta, acc) => {
            setIsStreaming(true);
            setMessages((prev) => {
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
        const updated = [...prev];
        const sources = [...new Set([...(updated[assistantIdx]?.sources ?? [])])];
        updated[assistantIdx] = {
          ...updated[assistantIdx],
          sources: sources.length > 0 ? sources : undefined,
        };
        return updated;
      });
    } catch (err) {
      setMessages((prev) => {
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
      setCurrentRefCount(0);
    }
  };

  /* ── Cancel inline scenario ── */
  const handleCancelScenario = useCallback(() => {
    setInlineScenario(null);
  }, []);

  return (
    <div ref={rootRef} className="flex flex-1 min-h-0 overflow-hidden">
      <EmployeeListPanel
        employees={employees}
        savedConversations={savedConversations}
        selectedSlug={selectedSlug}
        activeTab={tab}
        unreadCounts={unreadCounts}
        onSelectEmployee={handleSelectEmployee}
        onSelectSaved={handleSelectSaved}
        onTabChange={setTab}
        onDeleteSaved={handleDeleteSaved}
      />
      <ChatPanel
        employee={selectedEmployee}
        messages={messages}
        scenarios={scenarios}
        activeScenario={activeScenario}
        inlineScenario={inlineScenario}
        viewingSaved={viewingSaved}
        isSaved={isSaved}
        loading={loading}
        onSendMessage={handleSendMessage}
        onSelectScenario={handleSelectScenario}
        onScenarioFormSubmit={handleScenarioSubmit}
        onCancelScenario={handleCancelScenario}
        onSave={handleSave}
        onNewChat={handleNewChat}
        currentThinking={currentThinking}
        currentSkillsUsed={currentSkillsUsed}
        currentSources={currentSources}
        currentRefCount={currentRefCount}
        isStreaming={isStreaming}
      />
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { EmployeeListPanel } from "./employee-list-panel";
import { ChatPanel } from "./chat-panel";
import { ScenarioFormSheet } from "./scenario-form-sheet";
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
}

export function ChatCenterClient({
  employees,
  savedConversations: initialSavedConversations,
}: ChatCenterClientProps) {
  const searchParams = useSearchParams();

  // Determine initial slug from URL or first employee
  const initialSlug =
    searchParams.get("employee") || (employees[0]?.id ?? "");

  const [selectedSlug, setSelectedSlug] = useState(initialSlug);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioCardData[]>([]);
  const [activeScenario, setActiveScenario] =
    useState<ScenarioCardData | null>(null);
  const [viewingSaved, setViewingSaved] =
    useState<SavedConversationRow | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [tab, setTab] = useState<"employees" | "saved">("employees");
  const [loading, setLoading] = useState(false);
  const [scenarioSheetOpen, setScenarioSheetOpen] = useState(false);
  const [pendingScenario, setPendingScenario] =
    useState<ScenarioCardData | null>(null);
  const [savedConversations, setSavedConversations] = useState(
    initialSavedConversations
  );
  const [scenariosLoading, setScenariosLoading] = useState(false);

  // Streaming state lifted here so ChatPanel can display it
  const [currentThinking, setCurrentThinking] = useState<ThinkingStep[]>([]);
  const [currentSkillsUsed, setCurrentSkillsUsed] = useState<SkillUsed[]>([]);
  const [currentSources, setCurrentSources] = useState<string[]>([]);
  const [currentRefCount, setCurrentRefCount] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);

  // Track whether the initial scenario was from a first execution (for follow-ups)
  const scenarioInputsRef = useRef<Record<string, string>>({});

  const selectedEmployee = employees.find((e) => e.id === selectedSlug) ?? null;

  // Disable outer scroll — chat center manages its own scrolling
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    // parentElement = div.p-6 wrapper, grandparent = main.overflow-y-auto
    const wrapper = el.parentElement;
    const scrollableMain = wrapper?.parentElement;
    const saved = {
      wPad: wrapper?.style.padding ?? "",
      wH: wrapper?.style.height ?? "",
      mOv: scrollableMain?.style.overflow ?? "",
    };
    if (wrapper) {
      wrapper.style.padding = "0";
      wrapper.style.height = "100%";
    }
    if (scrollableMain) {
      scrollableMain.style.overflow = "hidden";
    }
    return () => {
      if (wrapper) {
        wrapper.style.padding = saved.wPad;
        wrapper.style.height = saved.wH;
      }
      if (scrollableMain) {
        scrollableMain.style.overflow = saved.mOv;
      }
    };
  }, []);

  // Fetch scenarios when employee changes
  const fetchScenarios = useCallback(async (slug: string) => {
    setScenariosLoading(true);
    try {
      const res = await fetch(`/api/employees/${slug}/scenarios`);
      if (res.ok) {
        const data = await res.json();
        setScenarios(data as ScenarioCardData[]);
      } else {
        setScenarios([]);
      }
    } catch {
      setScenarios([]);
    } finally {
      setScenariosLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSlug) {
      fetchScenarios(selectedSlug);
    }
  }, [selectedSlug, fetchScenarios]);

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
      // Clear current conversation
      setMessages([]);
      setActiveScenario(null);
      setViewingSaved(null);
      setIsSaved(false);
      setSelectedSlug(slug);
      setTab("employees");
      scenarioInputsRef.current = {};
    },
    [selectedSlug, viewingSaved]
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
    setViewingSaved(null);
    setIsSaved(false);
    scenarioInputsRef.current = {};
  }, []);

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

  /* ── Select scenario (opens form sheet) ── */
  const handleSelectScenario = useCallback((scenario: ScenarioCardData) => {
    if (scenario.inputFields.length > 0) {
      setPendingScenario(scenario);
      setScenarioSheetOpen(true);
    } else {
      // No inputs needed, execute directly
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

  /* ── Scenario form submit handler ── */
  const handleScenarioFormSubmit = useCallback(
    (inputs: Record<string, string>) => {
      if (pendingScenario) {
        handleScenarioSubmit(pendingScenario, inputs);
        setPendingScenario(null);
      }
    },
    [pendingScenario, handleScenarioSubmit]
  );

  return (
    <div ref={rootRef} className="flex h-full overflow-hidden">
      <EmployeeListPanel
        employees={employees}
        savedConversations={savedConversations}
        selectedSlug={selectedSlug}
        activeTab={tab}
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
        viewingSaved={viewingSaved}
        isSaved={isSaved}
        loading={loading}
        onSendMessage={handleSendMessage}
        onSelectScenario={handleSelectScenario}
        onSave={handleSave}
        onNewChat={handleNewChat}
        currentThinking={currentThinking}
        currentSkillsUsed={currentSkillsUsed}
        currentSources={currentSources}
        currentRefCount={currentRefCount}
        isStreaming={isStreaming}
      />
      <ScenarioFormSheet
        open={scenarioSheetOpen}
        onOpenChange={setScenarioSheetOpen}
        scenario={pendingScenario}
        onSubmit={handleScenarioFormSubmit}
      />
    </div>
  );
}

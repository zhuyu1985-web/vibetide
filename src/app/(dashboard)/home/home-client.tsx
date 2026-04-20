"use client";

import { useState, useCallback, useRef, useEffect, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { type EmployeeId } from "@/lib/constants";
import { Mic, Paperclip, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatStream } from "@/hooks/use-chat-stream";
import { renderScenarioTemplate } from "@/lib/scenario-template";
import { ParticleBackground } from "@/components/shared/particle-background";
import { ModelSwitcher, DEFAULT_MODEL_ID } from "@/components/shared/model-switcher";
import { HeroSection } from "@/components/home/hero-section";
import { EmployeeQuickPanel } from "@/components/home/employee-quick-panel";
import { ScenarioGrid } from "@/components/home/scenario-grid";
import { RecentSection } from "@/components/home/recent-section";
import { EmbeddedChatPanel } from "@/components/home/embedded-chat-panel";
import type { ScenarioCardData } from "@/lib/types";
import type { WorkflowTemplateRow } from "@/db/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HomeClientProps {
  recentMissions: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
    sourceModule?: string;
  }>;
  recentConversations: Array<{
    id: string;
    title: string;
    employeeSlug: string;
    updatedAt: string;
  }>;
  scenarioMap?: Record<string, ScenarioCardData[]>;
  employeeDbIdMap?: Record<string, string>;
  /**
   * Task 2.3 — Map of tab key → workflow templates for that tab. Keys are the
   * 8 employee slugs plus `"custom"` for user-defined workflows. Replaces the
   * former flat `workflows` prop and legacy scenario-detail-sheet plumbing.
   */
  templatesByTab?: Record<string, WorkflowTemplateRow[]>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HomeClient({
  recentMissions,
  recentConversations,
  scenarioMap = {},
  employeeDbIdMap: _employeeDbIdMap = {},
  templatesByTab = {},
}: HomeClientProps) {
  const router = useRouter();

  // ── State ──
  const [inputValue, setInputValue] = useState("");
  const [activeEmployee, setActiveEmployee] = useState<EmployeeId | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(DEFAULT_MODEL_ID);
  const [isRecording, setIsRecording] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [inlineScenario, setInlineScenario] = useState<ScenarioCardData | null>(null);
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Silence unused-var warnings for props reserved for follow-ups.
  void _employeeDbIdMap;

  // Task 2.3 — custom-scenario localStorage migration is handled by the
  // "我的工作流" tab in <ScenarioGrid>, which reads from workflow_templates.
  // Previously we hydrated `customScenarios` from `vibetide_custom_scenarios`
  // here; that state has been removed.
  useEffect(() => {
    // intentionally no-op (retained for future onboarding hooks)
  }, []);

  const effectiveEmployee: EmployeeId = activeEmployee ?? "xiaolei";

  // Per-employee scenarios from DB — only when user explicitly selected an employee
  const allEmployeeScenarios: ScenarioCardData[] = activeEmployee
    ? (scenarioMap[activeEmployee] ?? [])
    : [];
  // Normal mode: top 3; Chat mode: all
  const activeScenarios = chatOpen ? allEmployeeScenarios : allEmployeeScenarios.slice(0, 3);

  // ── Chat stream hook ──
  const chat = useChatStream({ employeeSlug: effectiveEmployee });

  // ── Handlers ──

  // Submit from input box → open embedded chat and send message
  const handleSubmit = useCallback(() => {
    if (!inputValue.trim()) return;
    const text = inputValue;
    setInputValue("");
    setChatOpen(true);
    // Send message after state update
    setTimeout(() => {
      chat.sendMessage(text);
    }, 0);
  }, [inputValue, chat]);

  const handleSelectEmployee = useCallback((slug: EmployeeId) => {
    setActiveEmployee(slug);
    // If already in chat, clear messages for new employee
    if (chatOpen) {
      chat.clearMessages();
    }
  }, [chatOpen, chat]);

  const handleSwitchEmployee = useCallback((slug: EmployeeId) => {
    setActiveEmployee(slug);
    chat.clearMessages();
  }, [chat]);

  const handleVoiceToggle = useCallback(() => {
    setIsRecording((prev) => !prev);
  }, []);

  // Click employee scenario chip → open chat with inline scenario form
  const handleEmployeeScenarioClick = useCallback(
    (scenario: { id: string; name: string; icon?: string }) => {
      const fullScenario = allEmployeeScenarios.find((s) => s.id === scenario.id);
      if (!fullScenario) return;

      setChatOpen(true);

      // If the scenario has a welcome message, show it as the opening assistant
      // message when entering the scenario. Rendered with empty inputs so any
      // {{placeholder}} references remain visible (they'll resolve on submit
      // via the instruction itself, so the welcome should usually avoid
      // placeholders).
      if (fullScenario.welcomeMessage) {
        const welcome = renderScenarioTemplate(fullScenario.welcomeMessage, {});
        if (welcome.trim()) {
          chat.setMessages((prev) => [
            ...prev,
            { role: "assistant", content: welcome },
          ]);
        }
      }

      if (fullScenario.inputFields?.length > 0) {
        // Show inline scenario form in chat
        setInlineScenario(fullScenario);
      } else {
        // Execute directly (no inputs to collect)
        setTimeout(() => {
          chat.sendMessage(`执行场景：${fullScenario.name}`);
        }, 0);
      }
    },
    [allEmployeeScenarios, chat]
  );

  // Inline scenario form submit
  const handleScenarioFormSubmit = useCallback(
    (scenario: ScenarioCardData, inputs: Record<string, string>) => {
      setInlineScenario(null);
      const summary = Object.entries(inputs)
        .filter(([, v]) => v)
        .map(([k, v]) => {
          const field = scenario.inputFields.find((f) => f.name === k);
          return `${field?.label ?? k}: ${v}`;
        })
        .join("\n");
      chat.sendMessage(`场景：${scenario.name}\n${summary}`);
    },
    [chat]
  );

  const handleCancelScenario = useCallback(() => {
    setInlineScenario(null);
  }, []);

  const handleCloseChat = useCallback(() => {
    setChatOpen(false);
    setChatInput("");
  }, []);

  // Send message from chat-mode input box
  const handleChatSend = useCallback(() => {
    if (!chatInput.trim() || chat.isStreaming) return;
    const text = chatInput;
    setChatInput("");
    // Reset textarea height
    if (chatTextareaRef.current) {
      chatTextareaRef.current.style.height = "auto";
    }
    chat.sendMessage(text);
  }, [chatInput, chat]);

  const handleChatKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleChatSend();
      }
    },
    [handleChatSend]
  );

  // `router` retained for future scenario-level navigation hooks (e.g. the
  // per-employee chat panel may push to `/missions/:id`). Silence unused-var
  // warning if no current call path reaches router.push() here.
  void router;

  // ── Shared input box (used in both normal and chat modes) ──
  const renderInputBox = () => (
    <div className="w-full">
      <div
        className={cn(
          "gemini-border rounded-2xl",
          "bg-white dark:bg-white/[0.06]",
          "transition-shadow duration-300 ease-out"
        )}
      >
        {/* Textarea */}
        <div className="px-5 pt-4 pb-2">
          <textarea
            ref={chatTextareaRef}
            value={chatOpen ? chatInput : inputValue}
            onChange={(e) => chatOpen ? setChatInput(e.target.value) : setInputValue(e.target.value)}
            onKeyDown={chatOpen ? handleChatKeyDown : (e: KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={chatOpen ? "继续对话..." : "有什么想法？告诉 AI 团队…"}
            rows={chatOpen ? 1 : 2}
            className={cn(
              "w-full bg-transparent text-[15px] leading-relaxed",
              "text-foreground placeholder:text-muted-foreground/50",
              "resize-none outline-none",
              chatOpen ? "min-h-[36px] max-h-[100px]" : "min-h-[52px] max-h-[160px]"
            )}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              const maxH = chatOpen ? 100 : 160;
              target.style.height = `${Math.min(target.scrollHeight, maxH)}px`;
            }}
          />
        </div>

        {/* Scenario chips — only when an employee is actively selected */}
        {activeEmployee && activeScenarios.length > 0 && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {activeScenarios.map((scenario) => (
              <button
                key={scenario.id}
                onClick={() => handleEmployeeScenarioClick(scenario)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors cursor-pointer"
              >
                {scenario.name}
              </button>
            ))}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 pb-3 pt-1">
          <div className="flex items-center gap-1">
            <button
              onClick={handleVoiceToggle}
              className={cn(
                "p-2 rounded-xl transition-all duration-200",
                isRecording
                  ? "bg-red-500/20 text-red-400"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              )}
            >
              <Mic size={16} />
            </button>
            <button
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200"
            >
              <Paperclip size={16} />
            </button>
            <span className="mx-1 h-4 w-px bg-border" />
            <ModelSwitcher
              value={selectedModel}
              onChange={setSelectedModel}
              size="sm"
            />
          </div>
          <button
            onClick={chatOpen ? handleChatSend : handleSubmit}
            disabled={chatOpen ? (!chatInput.trim() || chat.isStreaming) : !inputValue.trim()}
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200",
              (chatOpen ? (chatInput.trim() && !chat.isStreaming) : inputValue.trim())
                ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_2px_12px_rgba(99,102,241,0.4)] hover:scale-105 cursor-pointer"
                : "bg-muted text-muted-foreground/40 cursor-not-allowed"
            )}
          >
            <ArrowUp size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );

  // ── Render: Chat mode ──
  if (chatOpen) {
    return (
      <div className="relative h-full flex flex-col overflow-hidden">
        {/* Background */}
        <ParticleBackground
          particleCount={40}
          className="fixed inset-0 z-0 pointer-events-none dark:opacity-30 opacity-10"
        />

        {/* Chat messages — fills all available space, scrolls internally */}
        <div className="relative z-10 flex-1 min-h-0 flex justify-center overflow-hidden">
          <div className="w-full max-w-3xl min-h-0 flex flex-col">
            <EmbeddedChatPanel
              activeEmployee={effectiveEmployee}
              chat={chat}
              onClose={handleCloseChat}
              onSwitchEmployee={handleSwitchEmployee}
              inlineScenario={inlineScenario}
              onScenarioFormSubmit={handleScenarioFormSubmit}
              onCancelScenario={handleCancelScenario}
              embedded
            />
          </div>
        </div>

        {/* Input box — fixed at absolute bottom of the page */}
        <div className="relative z-10 flex-shrink-0 px-4 pb-4 pt-2 flex justify-center">
          <div className="w-full max-w-3xl">
            {renderInputBox()}
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Homepage mode ──
  return (
    <div className="relative h-full overflow-y-auto scrollbar-thin">
      {/* Particle background */}
      <ParticleBackground
        particleCount={60}
        className="fixed inset-0 z-0 pointer-events-none dark:opacity-50 opacity-20"
      />

      {/* Four-layer content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 pb-12">
        {/* Layer 1: Hero title + badge */}
        <HeroSection />

        {/* Layer 1.5: Shared input box */}
        <div className="max-w-[820px] mx-auto mt-2">
          {renderInputBox()}
        </div>

        {/* Layer 2: Employee quick panel */}
        <div className="max-w-[820px] mx-auto mt-4">
          <EmployeeQuickPanel
            activeEmployee={activeEmployee}
            onEmployeeClick={handleSelectEmployee}
          />
        </div>

        {/* Layer 3: Scenario grid — Task 2.3: 9-tab view driven by
            `templatesByTab` (8 employees + "我的工作流"). Each card either
            opens <WorkflowLaunchDialog> (template has input fields) or starts
            the mission directly via `startMissionFromTemplate`. */}
        <div className="px-4 mt-6">
          <ScenarioGrid templatesByTab={templatesByTab} />
        </div>

        {/* Layer 4: Recent missions & conversations */}
        {(recentMissions.length > 0 || recentConversations.length > 0) && (
          <div className="px-4 mt-6">
            <RecentSection
              missions={recentMissions}
              conversations={recentConversations}
            />
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useCallback, useRef, useEffect, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ADVANCED_SCENARIO_CONFIG,
  type EmployeeId,
  type AdvancedScenarioKey,
} from "@/lib/constants";
import { startMission } from "@/app/actions/missions";
import { Mic, Paperclip, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatStream } from "@/hooks/use-chat-stream";
import { ParticleBackground } from "@/components/shared/particle-background";
import { HeroSection } from "@/components/home/hero-section";
import { EmployeeQuickPanel } from "@/components/home/employee-quick-panel";
import { ScenarioGrid, type CustomScenario } from "@/components/home/scenario-grid";
import { ScenarioDetailSheet } from "@/components/home/scenario-detail-sheet";
import { RecentSection } from "@/components/home/recent-section";
import { EmbeddedChatPanel } from "@/components/home/embedded-chat-panel";
import type { ScenarioCardData } from "@/lib/types";
import type { WorkflowTemplateRow } from "@/db/types";
import { templateToScenarioSlug } from "@/lib/workflow-template-slug";

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
   * B.1 Unified Scenario Workflow — enabled builtin workflow templates for the
   * current org. Accepted here and passed through; Task 16 wires scenario-grid
   * to consume it.
   */
  workflows?: WorkflowTemplateRow[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HomeClient({
  recentMissions,
  recentConversations,
  scenarioMap = {},
  employeeDbIdMap = {},
  workflows = [],
}: HomeClientProps) {
  const router = useRouter();

  // ── State ──
  const [inputValue, setInputValue] = useState("");
  const [customScenarios, setCustomScenarios] = useState<CustomScenario[]>([]);
  const [activeEmployee, setActiveEmployee] = useState<EmployeeId | null>(null);
  const [selectedModel, setSelectedModel] = useState("auto");
  const [isRecording, setIsRecording] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<AdvancedScenarioKey | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [inlineScenario, setInlineScenario] = useState<ScenarioCardData | null>(null);
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Load custom scenarios from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("vibetide_custom_scenarios");
      if (raw) setCustomScenarios(JSON.parse(raw) as CustomScenario[]);
    } catch {
      // ignore parse errors
    }
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

  const handleScenarioClick = useCallback((key: AdvancedScenarioKey) => {
    setSelectedScenario(key);
    setSheetOpen(true);
  }, []);

  // B.1 Unified Scenario Workflow: when a WorkflowTemplateRow card is clicked.
  // If the workflow maps to a legacy `AdvancedScenarioKey`, preserve the existing
  // ScenarioDetailSheet UX (form → one-click launch). Otherwise, dispatch
  // `startMission` directly with `workflowTemplateId` dual-write. B.2 will
  // unify the Sheet interface so this branch collapses.
  const handleWorkflowStart = useCallback(
    async (wf: WorkflowTemplateRow) => {
      const legacyKey = wf.legacyScenarioKey as AdvancedScenarioKey | null;
      if (legacyKey && ADVANCED_SCENARIO_CONFIG[legacyKey]) {
        setSelectedScenario(legacyKey);
        setSheetOpen(true);
        return;
      }
      // Non-legacy workflow: direct start with dual-write.
      try {
        const result = await startMission({
          title: wf.name,
          scenario: templateToScenarioSlug(wf),
          userInstruction: wf.description ?? "",
          workflowTemplateId: wf.id,
        });
        toast.success(`${wf.name} 已启动`);
        if (result?.id) router.push(`/missions/${result.id}`);
      } catch {
        toast.error("启动失败，请重试");
      }
    },
    [router],
  );

  // Click employee scenario chip → open chat with inline scenario form
  const handleEmployeeScenarioClick = useCallback(
    (scenario: { id: string; name: string; icon?: string }) => {
      const fullScenario = allEmployeeScenarios.find((s) => s.id === scenario.id);
      if (fullScenario) {
        if (fullScenario.inputFields?.length > 0) {
          // Show inline scenario form in chat
          setInlineScenario(fullScenario);
          setChatOpen(true);
        } else {
          // Execute directly
          setChatOpen(true);
          setTimeout(() => {
            chat.sendMessage(`执行场景：${fullScenario.name}`);
          }, 0);
        }
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

  const handleCustomScenario = useCallback(() => {
    router.push("/workflows?action=create");
  }, [router]);

  const handleCustomScenarioClick = useCallback((scenario: CustomScenario) => {
    // Open the base scenario detail sheet as a starting point
    setSelectedScenario(scenario.baseKey);
    setSheetOpen(true);
  }, []);

  const handleScenarioLaunch = useCallback(
    async (key: AdvancedScenarioKey, inputs: Record<string, string>) => {
      const sc = ADVANCED_SCENARIO_CONFIG[key];
      try {
        const result = await startMission({
          title: `${sc.label} - ${inputs[sc.inputFields[0]?.name] ?? ""}`.trim(),
          scenario: key,
          userInstruction: Object.entries(inputs)
            .filter(([, v]) => v)
            .map(([k, v]) => `${sc.inputFields.find((f) => f.name === k)?.label}: ${v}`)
            .join("\n"),
        });
        toast.success(`${sc.label} 已启动`);
        setSheetOpen(false);
        if (result?.id) router.push(`/missions/${result.id}`);
      } catch {
        toast.error("启动失败，请重试");
      }
    },
    [router]
  );

  const handleScenarioChat = useCallback(
    (key: AdvancedScenarioKey) => {
      const sc = ADVANCED_SCENARIO_CONFIG[key];
      setActiveEmployee(sc.teamMembers[0]);
      setSheetOpen(false);
      setChatOpen(true);
      chat.clearMessages();
    },
    [chat]
  );

  // ── Shared input box (used in both normal and chat modes) ──
  const renderInputBox = () => (
    <div className="w-full">
      <div
        className={cn(
          "rounded-2xl overflow-hidden",
          "bg-white dark:bg-white/[0.06]",
          "border border-gray-200 dark:border-white/[0.1]",
          "shadow-[0_2px_12px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]",
          "focus-within:border-indigo-400 dark:focus-within:border-white/[0.18]",
          "focus-within:shadow-[0_2px_20px_rgba(99,102,241,0.15)] dark:focus-within:shadow-[0_8px_40px_rgba(59,130,246,0.12)]",
          "transition-all duration-300 ease-out"
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
        <div className="max-w-3xl mx-auto mt-2">
          {renderInputBox()}
        </div>

        {/* Layer 2: Employee quick panel */}
        <div className="px-4 mt-4">
          <EmployeeQuickPanel
            activeEmployee={activeEmployee}
            onEmployeeClick={handleSelectEmployee}
          />
        </div>

        {/* Layer 3: Scenario grid — B.1 driven by `workflows` prop */}
        <div className="px-4 mt-6">
          <ScenarioGrid
            workflows={workflows}
            currentEmployeeSlug={activeEmployee}
            onStart={handleWorkflowStart}
            onScenarioClick={handleScenarioClick}
            onCustomClick={handleCustomScenario}
            customScenarios={customScenarios}
            onCustomScenarioClick={handleCustomScenarioClick}
          />
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

      {/* Scenario detail sheet (side panel) */}
      <ScenarioDetailSheet
        scenarioKey={selectedScenario}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onLaunch={handleScenarioLaunch}
        onChat={handleScenarioChat}
      />
    </div>
  );
}

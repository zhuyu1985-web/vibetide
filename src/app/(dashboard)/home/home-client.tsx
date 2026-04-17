"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ADVANCED_SCENARIO_CONFIG,
  type EmployeeId,
  type AdvancedScenarioKey,
} from "@/lib/constants";
import { startMission } from "@/app/actions/missions";
import { useChatStream } from "@/hooks/use-chat-stream";
import { ParticleBackground } from "@/components/shared/particle-background";
import { HeroSection } from "@/components/home/hero-section";
import { EmployeeQuickPanel } from "@/components/home/employee-quick-panel";
import { ScenarioGrid } from "@/components/home/scenario-grid";
import { ScenarioDetailSheet } from "@/components/home/scenario-detail-sheet";
import { RecentSection } from "@/components/home/recent-section";
import { EmbeddedChatPanel } from "@/components/home/embedded-chat-panel";
import type { ScenarioCardData } from "@/lib/types";

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
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HomeClient({
  recentMissions,
  recentConversations,
  scenarioMap = {},
  employeeDbIdMap = {},
}: HomeClientProps) {
  const router = useRouter();

  // ── State ──
  const [inputValue, setInputValue] = useState("");
  const [activeEmployee, setActiveEmployee] = useState<EmployeeId | null>(null);
  const [selectedModel, setSelectedModel] = useState("auto");
  const [isRecording, setIsRecording] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<AdvancedScenarioKey | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [inlineScenario, setInlineScenario] = useState<ScenarioCardData | null>(null);

  const effectiveEmployee: EmployeeId = activeEmployee ?? "xiaolei";

  // Per-employee scenarios from DB
  const employeeScenarios: ScenarioCardData[] = scenarioMap[effectiveEmployee] ?? [];

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

  // Click employee scenario chip → open chat with inline scenario form
  const handleEmployeeScenarioClick = useCallback(
    (scenario: { id: string; name: string; icon?: string }) => {
      const fullScenario = employeeScenarios.find((s) => s.id === scenario.id);
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
    [employeeScenarios, chat]
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
  }, []);

  const handleCustomScenario = useCallback(() => {
    router.push("/workflows?action=create");
  }, [router]);

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

  // ── Render: Chat mode ──
  if (chatOpen) {
    return (
      <div className="relative flex-1 min-h-0 flex flex-col items-center px-4 pb-4 overflow-hidden">
        {/* Background */}
        <ParticleBackground
          particleCount={40}
          className="fixed inset-0 z-0 pointer-events-none dark:opacity-30 opacity-10"
        />

        {/* Grid layout: Row 1 = chat (scrollable), Row 2 = input (pinned) */}
        <div
          className="relative z-10 w-full max-w-3xl flex-1 min-h-0 grid gap-3"
          style={{ gridTemplateRows: "minmax(0, 1fr) auto" }}
        >
          {/* Row 1 — embedded chat panel */}
          <div className="min-h-0 overflow-hidden flex flex-col">
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
      </div>
    );
  }

  // ── Render: Homepage mode ──
  return (
    <div className="relative h-full overflow-y-auto">
      {/* Particle background */}
      <ParticleBackground
        particleCount={60}
        className="fixed inset-0 z-0 pointer-events-none dark:opacity-50 opacity-20"
      />

      {/* Four-layer content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 pb-12">
        {/* Layer 1: Hero — title + unified input */}
        <HeroSection
          inputValue={inputValue}
          onInputChange={setInputValue}
          onSubmit={handleSubmit}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          isRecording={isRecording}
          onVoiceToggle={handleVoiceToggle}
          employeeScenarios={employeeScenarios}
          onScenarioChipClick={handleEmployeeScenarioClick}
        />

        {/* Layer 2: Employee quick panel */}
        <div className="px-4 mt-2">
          <EmployeeQuickPanel
            activeEmployee={activeEmployee}
            onEmployeeClick={handleSelectEmployee}
          />
        </div>

        {/* Layer 3: Scenario grid */}
        <div className="px-4 mt-6">
          <ScenarioGrid
            onScenarioClick={handleScenarioClick}
            onCustomClick={handleCustomScenario}
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

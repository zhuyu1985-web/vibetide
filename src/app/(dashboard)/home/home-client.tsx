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
import { ParticleBackground } from "@/components/shared/particle-background";
import { HeroSection } from "@/components/home/hero-section";
import { EmployeeQuickPanel } from "@/components/home/employee-quick-panel";
import { ScenarioGrid } from "@/components/home/scenario-grid";
import { ScenarioDetailSheet } from "@/components/home/scenario-detail-sheet";
import { RecentSection } from "@/components/home/recent-section";
import { EMPLOYEE_META } from "@/lib/constants";
import type { ScenarioCardData } from "@/lib/types";
import { Sparkles } from "lucide-react";

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

  const effectiveEmployee: EmployeeId = activeEmployee ?? "xiaolei";

  // Per-employee scenarios from DB
  const employeeScenarios: ScenarioCardData[] = scenarioMap[effectiveEmployee] ?? [];

  // ── Handlers ──

  const handleSubmit = useCallback(() => {
    if (!inputValue.trim()) return;
    sessionStorage.setItem(
      "chat-handoff",
      JSON.stringify({
        employeeSlug: effectiveEmployee,
        initialMessage: inputValue,
      })
    );
    router.push(`/chat?handoff=1&employee=${effectiveEmployee}`);
  }, [inputValue, effectiveEmployee, router]);

  const handleSelectEmployee = useCallback((slug: EmployeeId) => {
    setActiveEmployee(slug);
  }, []);

  const handleVoiceToggle = useCallback(() => {
    setIsRecording((prev) => !prev);
  }, []);

  const handleScenarioClick = useCallback((key: AdvancedScenarioKey) => {
    setSelectedScenario(key);
    setSheetOpen(true);
  }, []);

  // Click employee scenario chip → navigate to chat with scenario context
  const handleEmployeeScenarioClick = useCallback(
    (scenario: ScenarioCardData) => {
      sessionStorage.setItem(
        "chat-handoff",
        JSON.stringify({
          employeeSlug: effectiveEmployee,
          scenarioId: scenario.id,
          scenarioName: scenario.name,
        })
      );
      router.push(`/chat?handoff=1&employee=${effectiveEmployee}`);
    },
    [effectiveEmployee, router]
  );

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
      sessionStorage.setItem(
        "chat-handoff",
        JSON.stringify({
          employeeSlug: sc.teamMembers[0],
          scenarioKey: key,
        })
      );
      setSheetOpen(false);
      router.push(`/chat?handoff=1&employee=${sc.teamMembers[0]}`);
    },
    [router]
  );

  // ── Render ──
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
        />

        {/* Layer 2: Employee quick panel */}
        <div className="px-4 mt-2">
          <EmployeeQuickPanel
            activeEmployee={activeEmployee}
            onEmployeeClick={handleSelectEmployee}
          />
        </div>

        {/* Layer 2.5: Per-employee scenario chips */}
        {employeeScenarios.length > 0 && (
          <div className="px-4 mt-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={13} className="text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {EMPLOYEE_META[effectiveEmployee]?.title} 的场景
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {employeeScenarios.map((sc) => (
                <button
                  key={sc.id}
                  onClick={() => handleEmployeeScenarioClick(sc)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                    bg-accent/50 hover:bg-accent text-foreground/80 hover:text-foreground
                    transition-all duration-200"
                >
                  {sc.icon && <span>{sc.icon}</span>}
                  {sc.name}
                </button>
              ))}
            </div>
          </div>
        )}

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

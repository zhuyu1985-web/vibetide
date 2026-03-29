"use client";

import { useState } from "react";
import { GlassCard } from "@/components/shared/glass-card";
import { ScenarioChatSheet } from "./scenario-chat-sheet";
import {
  Radar,
  Search,
  BarChart3,
  FileText,
  Activity,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ScenarioCardData } from "@/lib/types";

const ICON_MAP: Record<string, LucideIcon> = {
  Radar,
  Search,
  BarChart3,
  FileText,
  Activity,
  Zap,
};

interface ScenarioWorkbenchProps {
  scenarios: ScenarioCardData[];
  employeeDbId: string;
  employeeSlug: string;
  employeeNickname: string;
}

export function ScenarioWorkbench({
  scenarios,
  employeeDbId,
  employeeSlug,
  employeeNickname,
}: ScenarioWorkbenchProps) {
  const [activeScenario, setActiveScenario] =
    useState<ScenarioCardData | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <GlassCard className="mt-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            场景工作台
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            选择场景，让{employeeNickname}为你执行
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {scenarios.map((s) => {
            const Icon = ICON_MAP[s.icon] || Zap;
            return (
              <button
                key={s.id}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-50/50 dark:bg-gray-800/30 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer text-center group"
                onClick={() => {
                  setActiveScenario(s);
                  setSheetOpen(true);
                }}
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/10 to-purple-500/10 dark:from-blue-500/20 dark:to-purple-500/20 flex items-center justify-center group-hover:from-blue-500/20 group-hover:to-purple-500/20 transition-colors">
                  <Icon
                    size={20}
                    className="text-blue-600 dark:text-blue-400"
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-900 dark:text-gray-100">
                    {s.name}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-1">
                    {s.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </GlassCard>

      <ScenarioChatSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        scenario={activeScenario}
        scenarios={scenarios}
        employeeDbId={employeeDbId}
        employeeSlug={employeeSlug}
        employeeNickname={employeeNickname}
      />
    </>
  );
}

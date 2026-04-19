"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import * as LucideIcons from "lucide-react";
import { FileText, Settings2, Workflow, type LucideIcon } from "lucide-react";
import {
  ADVANCED_SCENARIO_CONFIG,
  type AdvancedScenarioKey,
  type EmployeeId,
} from "@/lib/constants";
import type { WorkflowTemplateRow } from "@/db/types";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface CustomScenario {
  id: string;
  name: string;
  baseKey: AdvancedScenarioKey;
  teamMembers: EmployeeId[];
  workflowSteps: unknown[];
  inputFields: unknown[];
  createdAt: string;
}

interface ScenarioGridProps {
  /**
   * B.1 Unified Scenario Workflow — workflow templates loaded from DB.
   * The grid iterates this list as the primary source of truth. If a workflow
   * has `legacyScenarioKey` matching an `AdvancedScenarioKey`, we surface the
   * legacy config's color/bg/team avatars for visual parity with existing UI.
   */
  workflows: WorkflowTemplateRow[];
  /**
   * When provided, only workflows whose `defaultTeam` includes this slug are
   * shown (useful when an employee is actively selected on the homepage).
   */
  currentEmployeeSlug?: EmployeeId | null;
  /**
   * Callback for starting a mission directly from a workflow card. Receives
   * the full `WorkflowTemplateRow` so the parent can dispatch `startMission`
   * with `workflowTemplateId` + `scenario: templateToScenarioSlug(wf)`.
   * NOTE: for B.1, the parent may still open `ScenarioDetailSheet` when the
   * workflow maps to a legacy `AdvancedScenarioKey` (dual-write preserved).
   */
  onStart?: (wf: WorkflowTemplateRow) => void;
  /**
   * Legacy callback — opens `ScenarioDetailSheet` keyed by `AdvancedScenarioKey`.
   * Called when the clicked workflow has a matching `legacyScenarioKey`.
   * B.2 will unify this; for now we keep both paths to avoid breaking UX.
   */
  onScenarioClick?: (key: AdvancedScenarioKey) => void;
  onCustomClick?: () => void;
  customScenarios?: CustomScenario[];
  onCustomScenarioClick?: (scenario: CustomScenario) => void;
}

/**
 * Dynamically resolve a Lucide icon by its component name string (stored in
 * `workflow_templates.icon`). Falls back to `FileText` if the name doesn't
 * match any exported icon. This keeps the DB schema lightweight (single text
 * column) while still rendering the full Lucide set.
 */
function resolveLucideIcon(iconName: string | null | undefined): LucideIcon {
  if (!iconName) return FileText;
  const maybeIcon = (LucideIcons as unknown as Record<string, LucideIcon>)[iconName];
  return maybeIcon ?? FileText;
}

/**
 * If a workflow maps to a legacy `AdvancedScenarioKey` (via `legacyScenarioKey`),
 * return the legacy config so we can reuse color/bg/team visuals. Otherwise
 * null — caller renders neutral fallback styling.
 */
function resolveLegacyConfig(wf: WorkflowTemplateRow) {
  const key = wf.legacyScenarioKey as AdvancedScenarioKey | null;
  if (!key) return null;
  return ADVANCED_SCENARIO_CONFIG[key] ?? null;
}

export function ScenarioGrid({
  workflows,
  currentEmployeeSlug,
  onStart,
  onScenarioClick,
  onCustomClick: _onCustomClick,
  customScenarios = [],
  onCustomScenarioClick,
}: ScenarioGridProps) {
  const router = useRouter();

  // Filter by current employee when provided; otherwise show all builtin workflows.
  const visibleWorkflows = currentEmployeeSlug
    ? workflows.filter((wf) =>
        ((wf.defaultTeam ?? []) as string[]).includes(currentEmployeeSlug),
      )
    : workflows;

  const handleClick = (wf: WorkflowTemplateRow) => {
    const legacyKey = wf.legacyScenarioKey as AdvancedScenarioKey | null;
    // Preferred path: parent-provided direct-start handler.
    if (onStart) {
      onStart(wf);
      return;
    }
    // Legacy path: open ScenarioDetailSheet when we have a matching key.
    if (legacyKey && onScenarioClick && ADVANCED_SCENARIO_CONFIG[legacyKey]) {
      onScenarioClick(legacyKey);
    }
    // Otherwise: no-op. B.2 will introduce a Sheet that accepts
    // WorkflowTemplateRow directly; until then non-legacy workflows rely on
    // the parent-provided `onStart` callback.
  };

  return (
    <div className="space-y-2.5">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground/80">场景快捷启动</span>
        <Popover>
          <PopoverTrigger asChild>
            <button className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer border-0">
              + 自定义场景
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={8} className="w-56 p-2">
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground px-2 pt-1 pb-2 font-medium">选择创建方式</p>
              <button
                onClick={() => router.push("/scenarios/customize")}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-foreground hover:bg-accent transition-colors duration-150 cursor-pointer text-left"
              >
                <Settings2 size={14} className="text-indigo-500 shrink-0" />
                <div>
                  <p className="font-medium leading-tight">基于现有场景修改</p>
                  <p className="text-xs text-muted-foreground mt-0.5">从预设场景调参</p>
                </div>
              </button>
              <button
                onClick={() => router.push("/workflows/new")}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-foreground hover:bg-accent transition-colors duration-150 cursor-pointer text-left"
              >
                <Workflow size={14} className="text-violet-500 shrink-0" />
                <div>
                  <p className="font-medium leading-tight">从零创建工作流</p>
                  <p className="text-xs text-muted-foreground mt-0.5">完全自定义步骤</p>
                </div>
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Preset grid — driven by `workflows` prop (B.1 unified source of truth) */}
      <div className="grid grid-cols-3 gap-2.5">
        {visibleWorkflows.map((wf, index) => {
          const legacy = resolveLegacyConfig(wf);
          const color = legacy?.color ?? "#6366f1";
          const bgColor = legacy?.bgColor ?? "rgba(99,102,241,0.12)";
          const team = (legacy?.teamMembers ??
            ((wf.defaultTeam ?? []) as EmployeeId[])) as EmployeeId[];
          const Icon = legacy?.icon ?? resolveLucideIcon(wf.icon);
          const description = legacy?.description ?? wf.description ?? "";

          return (
            <motion.button
              key={wf.id}
              type="button"
              onClick={() => handleClick(wf)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.06, ease: "easeOut" }}
              whileHover={{ y: -2 }}
              className="text-left rounded-xl px-3 py-2.5 cursor-pointer transition-shadow duration-200 hover:shadow-[0_4px_20px_rgba(0,0,0,0.15)] border-0"
              style={{
                background: `linear-gradient(135deg, ${bgColor}, ${bgColor.replace(/[\d.]+\)$/, "0.05)")})`,
              }}
            >
              {/* Icon */}
              <div className="mb-1.5">
                <Icon size={22} style={{ color }} />
              </div>

              {/* Label — prefer workflow name (authoritative) */}
              <div
                className="text-xs font-semibold leading-tight mb-0.5"
                style={{ color }}
              >
                {wf.name}
              </div>

              {/* Description */}
              <div className="text-[10px] text-foreground/50 leading-tight mb-2 line-clamp-1">
                {description}
              </div>

              {/* Team member avatars */}
              <div className="flex items-center -space-x-1">
                {team.map((memberId) => (
                  <EmployeeAvatar
                    key={memberId}
                    employeeId={memberId}
                    size="sm"
                  />
                ))}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Custom scenarios (localStorage-backed, untouched by B.1) */}
      {customScenarios.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-xs text-muted-foreground/60 font-medium">我的场景</span>
          <div className="grid grid-cols-3 gap-2.5">
            {customScenarios.map((scenario, index) => {
              const baseConfig = ADVANCED_SCENARIO_CONFIG[scenario.baseKey];
              return (
                <motion.button
                  key={scenario.id}
                  onClick={() => onCustomScenarioClick?.(scenario)}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.3,
                    delay: (visibleWorkflows.length + index) * 0.06,
                    ease: "easeOut",
                  }}
                  whileHover={{ y: -2 }}
                  className="text-left rounded-xl px-3 py-2.5 cursor-pointer transition-shadow duration-200 hover:shadow-[0_4px_20px_rgba(0,0,0,0.1)] border-0 relative"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.04))",
                    boxShadow: "inset 0 0 0 1px rgba(99,102,241,0.18)",
                  }}
                >
                  {/* 自定义 badge */}
                  <div className="absolute top-2 right-2">
                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-500">
                      自定义
                    </span>
                  </div>

                  {/* Base scenario icon */}
                  <div className="mb-1.5">
                    {baseConfig ? (
                      <baseConfig.icon size={22} style={{ color: baseConfig.color }} />
                    ) : (
                      <Settings2 size={22} className="text-indigo-400" />
                    )}
                  </div>

                  {/* Name */}
                  <div className="text-xs font-semibold leading-tight mb-0.5 text-indigo-500 pr-10">
                    {scenario.name}
                  </div>

                  {/* Base label */}
                  <div className="text-[10px] text-foreground/40 leading-tight mb-2 line-clamp-1">
                    基于 {baseConfig?.label ?? scenario.baseKey}
                  </div>

                  {/* Team member avatars */}
                  <div className="flex items-center -space-x-1">
                    {scenario.teamMembers.slice(0, 5).map((memberId) => (
                      <EmployeeAvatar
                        key={memberId}
                        employeeId={memberId}
                        size="sm"
                        className="ring-2 ring-background"
                      />
                    ))}
                    {scenario.teamMembers.length > 5 && (
                      <span className="text-[9px] text-muted-foreground ml-1">
                        +{scenario.teamMembers.length - 5}
                      </span>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

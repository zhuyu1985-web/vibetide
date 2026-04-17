"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Settings2, Workflow } from "lucide-react";
import {
  ADVANCED_SCENARIO_CONFIG,
  ADVANCED_SCENARIO_KEYS,
  type AdvancedScenarioKey,
  type EmployeeId,
} from "@/lib/constants";
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
  onScenarioClick: (key: AdvancedScenarioKey) => void;
  onCustomClick: () => void;
  customScenarios?: CustomScenario[];
  onCustomScenarioClick?: (scenario: CustomScenario) => void;
}

export function ScenarioGrid({
  onScenarioClick,
  onCustomClick: _onCustomClick,
  customScenarios = [],
  onCustomScenarioClick,
}: ScenarioGridProps) {
  const router = useRouter();

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

      {/* Preset 3x2 grid */}
      <div className="grid grid-cols-3 gap-2.5">
        {ADVANCED_SCENARIO_KEYS.map((key, index) => {
          const sc = ADVANCED_SCENARIO_CONFIG[key];
          return (
            <motion.button
              key={key}
              onClick={() => onScenarioClick(key)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.06, ease: "easeOut" }}
              whileHover={{ y: -2 }}
              className="text-left rounded-xl px-3 py-2.5 cursor-pointer transition-shadow duration-200 hover:shadow-[0_4px_20px_rgba(0,0,0,0.15)] border-0"
              style={{
                background: `linear-gradient(135deg, ${sc.bgColor}, ${sc.bgColor.replace(/[\d.]+\)$/, "0.05)")})`,
              }}
            >
              {/* Icon */}
              <div className="mb-1.5">
                <sc.icon size={22} style={{ color: sc.color }} />
              </div>

              {/* Label */}
              <div
                className="text-xs font-semibold leading-tight mb-0.5"
                style={{ color: sc.color }}
              >
                {sc.label}
              </div>

              {/* Description */}
              <div className="text-[10px] text-foreground/50 leading-tight mb-2 line-clamp-1">
                {sc.description}
              </div>

              {/* Team member avatars */}
              <div className="flex items-center -space-x-1">
                {sc.teamMembers.map((memberId) => (
                  <EmployeeAvatar
                    key={memberId}
                    employeeId={memberId}
                    size="xs"
                    className=""
                  />
                ))}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Custom scenarios */}
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
                    delay: (ADVANCED_SCENARIO_KEYS.length + index) * 0.06,
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
                        size="xs"
                        className=""
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

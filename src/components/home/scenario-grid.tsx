"use client";

import { motion } from "framer-motion";
import { ADVANCED_SCENARIO_CONFIG, ADVANCED_SCENARIO_KEYS, type AdvancedScenarioKey } from "@/lib/constants";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";

interface ScenarioGridProps {
  onScenarioClick: (key: AdvancedScenarioKey) => void;
  onCustomClick: () => void;
}

export function ScenarioGrid({ onScenarioClick, onCustomClick }: ScenarioGridProps) {
  return (
    <div className="space-y-2.5">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white/70">场景快捷启动</span>
        <button
          onClick={onCustomClick}
          className="text-xs text-white/40 hover:text-white/70 transition-colors duration-200 cursor-pointer"
        >
          + 自定义场景
        </button>
      </div>

      {/* 3x2 grid */}
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
              className="text-left rounded-xl px-3 py-2.5 cursor-pointer transition-shadow duration-200 hover:shadow-[0_4px_20px_rgba(0,0,0,0.35)]"
              style={{
                background: `linear-gradient(135deg, ${sc.bgColor}, ${sc.bgColor.replace(/[\d.]+\)$/, "0.05)")}`,
              }}
            >
              {/* Emoji */}
              <div className="text-2xl leading-none mb-1.5">{sc.emoji}</div>

              {/* Label */}
              <div
                className="text-xs font-semibold leading-tight mb-0.5"
                style={{ color: sc.color }}
              >
                {sc.label}
              </div>

              {/* Description */}
              <div className="text-[10px] text-white/40 leading-tight mb-2 line-clamp-1">
                {sc.description}
              </div>

              {/* Team member avatars */}
              <div className="flex items-center -space-x-1">
                {sc.teamMembers.map((memberId) => (
                  <EmployeeAvatar
                    key={memberId}
                    employeeId={memberId}
                    size="xs"
                    className="ring-1 ring-black/20"
                  />
                ))}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { EMPLOYEE_META, type EmployeeId } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface PipelineNodeProps {
  employeeId: EmployeeId;
  label: string;
  description: string;
  duration: string;
  isActive: boolean;
  index: number;
}

/** Convert a hex color like "#3b82f6" to "r, g, b" string for rgba usage. */
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

function buildAvatarVariants(rgb: string) {
  return {
    inactive: {
      scale: 1,
      boxShadow: `0 0 0px rgba(${rgb}, 0)`,
    },
    active: {
      scale: [1, 1.15, 1.05],
      boxShadow: [
        `0 0 0px rgba(${rgb}, 0)`,
        `0 0 24px rgba(${rgb}, 0.6)`,
        `0 0 16px rgba(${rgb}, 0.4)`,
      ],
      transition: {
        duration: 0.6,
        ease: "easeOut" as const,
      },
    },
  };
}

const cardVariants = {
  inactive: {
    opacity: 0.6,
    y: 8,
  },
  active: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut" as const,
      delay: 0.15,
    },
  },
};

export function PipelineNode({
  employeeId,
  label,
  description,
  duration,
  isActive,
  index,
}: PipelineNodeProps) {
  const state = isActive ? "active" : "inactive";
  const color = EMPLOYEE_META[employeeId].color;
  const rgb = useMemo(() => hexToRgb(color), [color]);
  const avatarVariants = useMemo(() => buildAvatarVariants(rgb), [rgb]);

  return (
    <motion.div
      className="flex flex-col items-center gap-3"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
    >
      {/* Avatar with glow ring */}
      <motion.div
        className={cn(
          "relative flex items-center justify-center rounded-full p-1",
          !isActive && "ring-1 ring-border dark:ring-white/10"
        )}
        style={
          isActive
            ? {
                boxShadow: `0 0 0 2px transparent, 0 0 0 4px rgba(${rgb}, 0.6)`,
              }
            : undefined
        }
        variants={avatarVariants}
        animate={state}
      >
        <EmployeeAvatar employeeId={employeeId} size="lg" />
        {isActive && (
          <motion.div
            className="pointer-events-none absolute -inset-2 rounded-full"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{
              background: `radial-gradient(circle, rgba(${rgb}, 0.3) 0%, transparent 70%)`,
            }}
            aria-hidden="true"
          />
        )}
      </motion.div>

      {/* Info card */}
      <motion.div
        className={cn(
          "w-32 rounded-2xl px-3 py-2 text-center",
          !isActive && "dark:!bg-[#111a2e] dark:!border-[#1e293b]",
        )}
        style={
          isActive
            ? {
                background: `rgba(${rgb}, 0.06)`,
                border: `1px solid rgba(${rgb}, 0.15)`,
                boxShadow: `0 2px 8px rgba(${rgb}, 0.08)`,
              }
            : {
                background: "white",
                border: "1px solid rgba(0,0,0,0.06)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }
        }
        variants={cardVariants}
        animate={state}
      >
        <p
          className={cn(
            "text-sm font-medium",
            isActive ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {label}
        </p>
        <p
          className={cn(
            "mt-0.5 text-xs",
            isActive ? "text-muted-foreground" : "text-muted-foreground/60"
          )}
        >
          {description}
        </p>
        <p
          className={cn(
            "mt-1 text-[10px] tabular-nums",
            !isActive && "text-muted-foreground/50"
          )}
          style={isActive ? { color } : undefined}
        >
          {duration}
        </p>
      </motion.div>
    </motion.div>
  );
}

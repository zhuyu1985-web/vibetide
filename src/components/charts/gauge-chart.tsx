"use client";

import { motion } from "framer-motion";
import { GlassCard } from "@/components/shared/glass-card";

export function GaugeChart({
  value,
  max = 100,
  label,
  suffix = "%",
  size = 180,
}: {
  value: number;
  max?: number;
  label: string;
  suffix?: string;
  size?: number;
}) {
  const pct = Math.min(value / max, 1);
  const r = size * 0.38;
  const cx = size / 2;
  const cy = size * 0.55;
  // Half circle from 180° to 0° (left to right)
  const startAngle = Math.PI;
  const endAngle = 0;
  const sweepAngle = startAngle - endAngle;

  const arcPath = (angle: number) => {
    const x = cx + r * Math.cos(angle);
    const y = cy - r * Math.sin(angle);
    return { x, y };
  };

  const start = arcPath(startAngle);
  const end = arcPath(endAngle);

  const trackD = `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`;

  const valueAngle = startAngle - sweepAngle * pct;
  const valueEnd = arcPath(valueAngle);
  const largeArc = pct > 0.5 ? 1 : 0;
  const valueD = `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${valueEnd.x} ${valueEnd.y}`;

  const color = value <= 5 ? "#10b981" : value <= 20 ? "#f59e0b" : "#ef4444";

  return (
    <GlassCard padding="sm" className="flex flex-col items-center">
      <svg width={size} height={size * 0.65} viewBox={`0 0 ${size} ${size * 0.65}`}>
        <path d={trackD} fill="none" stroke="#e5e7eb" strokeWidth={12} strokeLinecap="round" />
        <motion.path
          d={valueD}
          fill="none"
          stroke={color}
          strokeWidth={12}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          className="font-bold fill-gray-800 dark:fill-gray-100"
          fontSize={size * 0.16}
        >
          {value}{suffix}
        </text>
      </svg>
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 -mt-1">{label}</span>
    </GlassCard>
  );
}

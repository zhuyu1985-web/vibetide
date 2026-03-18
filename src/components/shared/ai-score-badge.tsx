"use client";

import { motion } from "framer-motion";

export function AIScoreBadge({
  score,
  size = 48,
  label,
}: {
  score: number;
  size?: number;
  label?: string;
}) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color =
    score >= 80 ? "#10b981" : score >= 60 ? "#3b82f6" : score >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={3}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-gray-800 dark:fill-gray-100 font-bold"
          fontSize={size * 0.28}
          transform={`rotate(90, ${size / 2}, ${size / 2})`}
        >
          {score}
        </text>
      </svg>
      {label && <span className="text-[9px] text-gray-500 dark:text-gray-400">{label}</span>}
    </div>
  );
}

"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface Dimension {
  score: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

interface Props {
  label: string;
  dimension: Dimension;
  defaultOpen?: boolean;
}

function scoreColor(score: number): string {
  if (score >= 90) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 75) return "text-sky-600 dark:text-sky-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function scoreLabel(score: number): string {
  if (score >= 90) return "优秀";
  if (score >= 75) return "良好";
  if (score >= 60) return "合格";
  return "需改进";
}

export function DimensionCard({ label, dimension, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg bg-white/60 dark:bg-gray-800/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/80 dark:hover:bg-gray-800/80 transition"
      >
        <div className="flex-shrink-0 w-12 text-center">
          <div className={`text-2xl font-bold ${scoreColor(dimension.score)}`}>
            {Math.round(dimension.score)}
          </div>
          <div className="text-[10px] text-gray-500">{scoreLabel(dimension.score)}</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
            {dimension.summary}
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 space-y-3 text-xs border-t border-gray-200/50 dark:border-gray-700/50">
          {dimension.strengths.length > 0 && (
            <div>
              <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 mb-1">
                亮点
              </div>
              <ul className="space-y-1 list-disc list-inside text-gray-700 dark:text-gray-300">
                {dimension.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {dimension.weaknesses.length > 0 && (
            <div>
              <div className="text-[11px] font-medium text-red-700 dark:text-red-400 mb-1">
                短板
              </div>
              <ul className="space-y-1 list-disc list-inside text-gray-700 dark:text-gray-300">
                {dimension.weaknesses.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {dimension.suggestions.length > 0 && (
            <div>
              <div className="text-[11px] font-medium text-sky-700 dark:text-sky-400 mb-1">
                改进建议
              </div>
              <ul className="space-y-1 list-disc list-inside text-gray-700 dark:text-gray-300">
                {dimension.suggestions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

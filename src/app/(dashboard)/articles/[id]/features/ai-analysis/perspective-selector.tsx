"use client";

import { cn } from "@/lib/utils";
import type { AIAnalysisPerspective } from "../../types";

interface PerspectiveSelectorProps {
  value: AIAnalysisPerspective;
  onChange: (perspective: AIAnalysisPerspective) => void;
  disabled?: boolean;
}

const PERSPECTIVES: { value: AIAnalysisPerspective; label: string }[] = [
  { value: "summary", label: "📋 摘要 (TL;DR)" },
  { value: "journalist", label: "🎙 记者视点" },
  { value: "quotes", label: "💎 金句提取" },
  { value: "timeline", label: "📅 时间线" },
  { value: "qa", label: "❓ 关键问答" },
  { value: "deep", label: "🔬 深度剖析" },
];

export function PerspectiveSelector({
  value,
  onChange,
  disabled,
}: PerspectiveSelectorProps) {
  return (
    <div className="px-3 py-2 border-b border-[var(--glass-border)] shrink-0">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as AIAnalysisPerspective)}
        disabled={disabled}
        className={cn(
          "w-full bg-muted/30 rounded-lg px-2 py-1.5 text-xs",
          "outline-none appearance-none cursor-pointer",
          "text-foreground",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {PERSPECTIVES.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
    </div>
  );
}

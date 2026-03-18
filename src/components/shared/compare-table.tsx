"use client";

import { GlassCard } from "./glass-card";

export interface CompareRow {
  media: string;
  scores: { dimension: string; score: number }[];
  total: number;
  highlight?: boolean;
}

function ScoreBar({ score, max = 10 }: { score: number; max?: number }) {
  const pct = (score / max) * 100;
  const color =
    score >= 8 ? "bg-green-500" : score >= 6 ? "bg-blue-500" : score >= 4 ? "bg-amber-500" : "bg-red-400";
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono text-gray-600 dark:text-gray-400 w-4 text-right">{score}</span>
    </div>
  );
}

export function CompareTable({
  rows,
  dimensions,
}: {
  rows: CompareRow[];
  dimensions: string[];
}) {
  return (
    <GlassCard padding="none">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/25">
              <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">媒体</th>
              {dimensions.map((d) => (
                <th key={d} className="text-center py-2.5 px-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                  {d}
                </th>
              ))}
              <th className="text-center py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">总分</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className={`border-b border-gray-50 dark:border-gray-800 transition-colors ${
                  row.highlight ? "bg-blue-50/40 dark:bg-blue-950/20" : "hover:bg-gray-50/50 dark:hover:bg-gray-800/25"
                }`}
              >
                <td className="py-2.5 px-3 text-xs font-semibold text-gray-800 dark:text-gray-100">
                  {row.highlight && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5" />
                  )}
                  {row.media}
                </td>
                {row.scores.map((s, j) => (
                  <td key={j} className="py-2.5 px-2">
                    <ScoreBar score={s.score} />
                  </td>
                ))}
                <td className="py-2.5 px-3 text-center">
                  <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{row.total}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}

"use client";

import { useMemo } from "react";
import { SourceUrlPill } from "@/components/shared/source-url-pill";
import { FallbackRenderer } from "./fallback-renderer";

export interface ClassifiedItem {
  id: string;
  category: string;
  confidence: number;
  reason: string;
  sourceUrl?: string;
  title?: string;
  summary?: string;
}

interface ExtractedResult {
  passed: ClassifiedItem[];
  other: ClassifiedItem[];
}

interface TopicClassifierRendererProps {
  outputData: unknown;
}

/**
 * Pure parsing helper, exported for unit testing.
 * 拆分 outputData.results 数组为 passed (非 other 类) + other 两组。
 * 不是 results 数组形态时返回 null（让 caller fallback）。
 */
export function extractClassifierResults(outputData: unknown): ExtractedResult | null {
  if (!outputData || typeof outputData !== "object") return null;
  const obj = outputData as Record<string, unknown>;
  if (!Array.isArray(obj.results)) return null;
  const results = obj.results as ClassifiedItem[];
  return {
    passed: results.filter((r) => r.category !== "other"),
    other: results.filter((r) => r.category === "other"),
  };
}

const CATEGORY_BADGE_COLOR: Record<string, string> = {
  food: "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300",
  pets: "bg-pink-100 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300",
  domestic_tech: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300",
  other: "bg-gray-100 dark:bg-gray-800/40 text-gray-600 dark:text-gray-400",
};

function CategoryBadge({ value }: { value: string }) {
  const color = CATEGORY_BADGE_COLOR[value] ?? CATEGORY_BADGE_COLOR.other;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] rounded ${color}`}>
      {value}
    </span>
  );
}

export function TopicClassifierRenderer({ outputData }: TopicClassifierRendererProps) {
  const extracted = useMemo(() => extractClassifierResults(outputData), [outputData]);

  if (extracted === null) {
    return <FallbackRenderer outputData={outputData} reason="无法解析 topic_classifier 输出" />;
  }

  const { passed, other } = extracted;
  const groupCounts = passed.reduce<Record<string, number>>((acc, r) => {
    acc[r.category] = (acc[r.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">
        过滤通过 {passed.length} 条
        {Object.keys(groupCounts).length > 0 && (
          <> ({Object.entries(groupCounts).map(([cat, n]) => `${cat}: ${n}`).join(", ")})</>
        )}
      </div>
      {/* 单行列表 —— 跟 step 4 风格一致,标题/理由 truncate 防止换行竖排。 */}
      {passed.length > 0 && (
        <div className="space-y-1">
          {passed.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/30"
            >
              <code className="shrink-0 text-xs text-muted-foreground">{r.id}</code>
              <CategoryBadge value={r.category} />
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {r.confidence.toFixed(2)}
              </span>
              <span
                className="text-sm flex-1 min-w-0 truncate"
                title={`${r.title ?? ""}\n${r.reason}`}
              >
                {r.title ?? r.reason}
              </span>
              <SourceUrlPill url={r.sourceUrl} variant="compact" />
            </div>
          ))}
        </div>
      )}
      {other.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-muted-foreground">
            被过滤为 other 的 {other.length} 条
          </summary>
          <div className="mt-2 space-y-1">
            {other.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/30"
              >
                <code className="shrink-0 text-xs text-muted-foreground">{r.id}</code>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {r.confidence.toFixed(2)}
                </span>
                <span
                  className="text-xs flex-1 min-w-0 truncate"
                  title={`${r.title ?? ""}\n${r.reason}`}
                >
                  {r.title ?? r.reason}
                </span>
                <SourceUrlPill url={r.sourceUrl} variant="compact" />
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { SourceUrlPill } from "@/components/shared/source-url-pill";
import { FallbackRenderer } from "./fallback-renderer";

export interface DeepReadItem {
  id: string;
  title?: string;
  category?: string;
  sourceUrl?: string;
  body?: string;
  fetchedAt?: string;
  fetchStatus?:
    | "ok"
    | "fallback_summary"
    | "fallback_title"
    | "skipped_other"
    | "failed";
  fetchError?: string;
}

interface ExtractedDeepRead {
  items: DeepReadItem[];
  okCount: number;
  fallbackCount: number;
  skippedCount: number;
  totalRequested: number;
}

/**
 * Pure parsing helper, exported for unit testing.
 * batch_deep_read 输出形态：{ items, totalRequested, okCount, fallbackCount }
 */
export function extractDeepReadResults(outputData: unknown): ExtractedDeepRead | null {
  if (!outputData || typeof outputData !== "object") return null;
  const obj = outputData as Record<string, unknown>;
  if (!Array.isArray(obj.items)) return null;
  return {
    items: obj.items as DeepReadItem[],
    okCount: typeof obj.okCount === "number" ? obj.okCount : 0,
    fallbackCount: typeof obj.fallbackCount === "number" ? obj.fallbackCount : 0,
    skippedCount: typeof obj.skippedCount === "number" ? obj.skippedCount : 0,
    totalRequested:
      typeof obj.totalRequested === "number" ? obj.totalRequested : (obj.items as unknown[]).length,
  };
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  ok: {
    label: "已抓",
    color: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300",
  },
  fallback_summary: {
    label: "用摘要",
    color: "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300",
  },
  fallback_title: {
    label: "仅标题",
    color: "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300",
  },
  skipped_other: {
    label: "跳过",
    color: "bg-gray-100 dark:bg-gray-800/40 text-gray-600 dark:text-gray-400",
  },
  failed: {
    label: "失败",
    color: "bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300",
  },
};

function StatusBadge({ status }: { status?: string }) {
  const meta = STATUS_BADGE[status ?? "ok"] ?? STATUS_BADGE.ok;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] rounded ${meta.color}`}>
      {meta.label}
    </span>
  );
}

export function BatchDeepReadRenderer({ outputData }: { outputData: unknown }) {
  const extracted = useMemo(() => extractDeepReadResults(outputData), [outputData]);

  if (extracted === null) {
    return (
      <FallbackRenderer outputData={outputData} reason="无法解析 batch_deep_read 输出" />
    );
  }

  const { items, okCount, fallbackCount, skippedCount, totalRequested } =
    extracted;
  const avgBodyLen =
    items.length > 0
      ? Math.round(items.reduce((acc, it) => acc + (it.body?.length ?? 0), 0) / items.length)
      : 0;

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">
        共 {totalRequested} 条 — 抓取 {okCount} 条，兜底 {fallbackCount} 条，跳过 {skippedCount} 条；平均正文 {avgBodyLen} 字
      </div>
      {/* 单行列表 —— 跟 step 4 风格一致。details 包住每行让用户能点开看正文。 */}
      <div className="space-y-1">
        {items.map((r) => (
          <details key={r.id} className="group">
            <summary className="cursor-pointer flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/30 list-none">
              <code className="shrink-0 text-xs text-muted-foreground">{r.id}</code>
              <StatusBadge status={r.fetchStatus} />
              <span
                className="text-sm flex-1 min-w-0 truncate"
                title={r.title ?? ""}
              >
                {r.title ?? "（无标题）"}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                {r.body ? r.body.length : 0} 字
              </span>
              <SourceUrlPill url={r.sourceUrl} variant="compact" />
            </summary>
            <div className="mt-2 ml-2 space-y-2 text-xs">
              {r.fetchError && (
                <div className="rounded bg-rose-50 dark:bg-rose-900/10 p-2 text-rose-700 dark:text-rose-300">
                  抓取错误：{r.fetchError}
                </div>
              )}
              <div className="whitespace-pre-wrap text-muted-foreground line-clamp-12">
                {r.body || "（无正文）"}
              </div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

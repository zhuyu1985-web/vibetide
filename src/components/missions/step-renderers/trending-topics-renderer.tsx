"use client";

import { useMemo } from "react";
import { DataTable } from "@/components/shared/data-table";
import { SourceUrlPill } from "@/components/shared/source-url-pill";
import { FallbackRenderer } from "./fallback-renderer";

export interface TrendingItem {
  rank?: number;
  platform?: string;
  title?: string;
  heat?: string | number;
  url?: string;
  category?: string;
  discoveredAt?: string;
}

interface TrendingTopicsRendererProps {
  outputData: unknown;
}

/**
 * 简单平台徽章（inline，避免依赖 inspiration-client 内部 PlatformTag）
 */
function PlatformBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 text-[11px] rounded bg-muted/40 text-muted-foreground">
      {name}
    </span>
  );
}

/**
 * 从 step outputData 抽取 TrendingItem[]。
 * - Case A: 结构化 outputData { topics: [...] } (Phase A short-circuit 之后)
 * - Case B: short-circuit 未触发的老 mission，outputData.text 内嵌 ```json``` 块
 * - 解析失败返回 null（让上层渲染 FallbackRenderer）。
 */
export function extractTopics(outputData: unknown): TrendingItem[] | null {
  if (!outputData || typeof outputData !== "object") return null;
  const obj = outputData as Record<string, unknown>;
  // Case A: 结构化 outputData { topics: [...] } (after Phase A short-circuit spread)
  if (Array.isArray(obj.topics)) return obj.topics as TrendingItem[];
  // Case B: short-circuit text 字段里 JSON 块 (fallback for older missions)
  if (typeof obj.text === "string") {
    const match = obj.text.match(/```json\s*\n([\s\S]*?)\n```/);
    if (match) {
      try {
        const parsed = JSON.parse(match[1]);
        if (parsed && typeof parsed === "object" && Array.isArray(parsed.topics)) {
          return parsed.topics as TrendingItem[];
        }
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function TrendingTopicsRenderer({ outputData }: TrendingTopicsRendererProps) {
  const topics = useMemo(() => extractTopics(outputData), [outputData]);

  if (topics === null) {
    return <FallbackRenderer outputData={outputData} reason="无法解析 trending_topics 输出" />;
  }
  if (topics.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        无热榜结果
      </div>
    );
  }

  const uniquePlatforms = new Set(topics.map((t) => t.platform).filter(Boolean));

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">
        拉取 {topics.length} 条热榜 · 涉及 {uniquePlatforms.size} 个平台
      </div>
      <DataTable
        rows={topics}
        rowKey={(t) =>
          `${t.platform ?? "?"}-${t.rank ?? t.title ?? Math.random().toString(36).slice(2, 8)}`
        }
        columns={[
          { key: "rank", header: "#", width: "w-12", align: "right", render: (t) => t.rank ?? "—" },
          {
            key: "platform",
            header: "平台",
            width: "w-24",
            render: (t) => (t.platform ? <PlatformBadge name={t.platform} /> : "—"),
          },
          { key: "title", header: "标题", render: (t) => t.title ?? "—" },
          {
            key: "heat",
            header: "热度",
            width: "w-24",
            align: "right",
            render: (t) => (t.heat !== undefined ? String(t.heat) : "—"),
          },
          {
            key: "url",
            header: "原文",
            width: "w-32",
            render: (t) => <SourceUrlPill url={t.url} variant="compact" />,
          },
        ]}
      />
    </div>
  );
}

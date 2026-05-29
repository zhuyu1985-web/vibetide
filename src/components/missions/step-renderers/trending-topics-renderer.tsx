"use client";

import { useMemo } from "react";
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
      {/* 单行列表 —— 跟 step 4 cross_language_rewrite 风格一致:
          mission console TaskDetailSheet 右侧容器只有 ~400-500px,DataTable
          会让长中文标题挤成"一字一行"竖排。改成 flex 单行 + truncate 后
          长标题省略号截断,鼠标 hover 看 tooltip。 */}
      <div className="space-y-1">
        {topics.map((t, i) => (
          <div
            key={`${t.platform ?? "?"}-${t.rank ?? i}`}
            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/30"
          >
            <span className="shrink-0 text-xs text-muted-foreground w-6 text-right tabular-nums">
              {t.rank ?? i + 1}
            </span>
            {t.platform && <PlatformBadge name={t.platform} />}
            <span
              className="text-sm flex-1 min-w-0 truncate"
              title={t.title ?? ""}
            >
              {t.title ?? "—"}
            </span>
            {t.heat !== undefined && (
              <span className="shrink-0 text-xs text-muted-foreground whitespace-nowrap">
                {String(t.heat)}
              </span>
            )}
            <SourceUrlPill url={t.url} variant="compact" />
          </div>
        ))}
      </div>
    </div>
  );
}

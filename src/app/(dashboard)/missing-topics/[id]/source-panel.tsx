"use client";

import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
import type { MissingTopicDetail } from "@/lib/types";

/* ─── Source tag config ─── */

const sourceTagConfig: Record<string, { label: string; color: string }> = {
  social_hot: {
    label: "🔥 社媒热榜",
    color:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  },
  benchmark_media: {
    label: "📰 对标媒体",
    color:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  sentiment_event: {
    label: "⚠️ 舆情预警",
    color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  multi_source: {
    label: "🔗 多源交叉",
    color:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  },
};

/* ─── Helpers ─── */

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}`;
}

function minutesAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.max(0, Math.floor(diff / 60000));
  if (mins < 60) return `${mins}分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}

function heatBarColor(score: number): string {
  if (score > 80) return "bg-red-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-gray-400";
}

/* ─── Component ─── */

interface Props {
  detail: MissingTopicDetail;
}

export function SourcePanel({ detail }: Props) {
  const visibleReporters = detail.reportedBy.slice(0, 5);
  const extraCount = detail.reportedBy.length - 5;

  return (
    <GlassCard padding="lg">
      {/* Section label */}
      <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
        漏题原文信息
      </p>

      {/* Title */}
      <h2 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-3">
        {detail.title}
      </h2>

      {/* Source tags */}
      <div className="flex flex-wrap gap-2 mb-4">
        {detail.sourceTags.map((tag) => {
          const cfg = sourceTagConfig[tag];
          if (!cfg) return null;
          return (
            <Badge key={tag} className={`border-0 ${cfg.color}`}>
              {cfg.label}
            </Badge>
          );
        })}
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm mb-4">
        <span className="text-gray-500 dark:text-gray-400">来源平台</span>
        <span className="text-gray-900 dark:text-gray-100">
          {detail.sourceDetail}
        </span>

        <span className="text-gray-500 dark:text-gray-400">发布时间</span>
        <span className="text-gray-900 dark:text-gray-100">
          {formatDateTime(detail.publishedAt)}
        </span>

        <span className="text-gray-500 dark:text-gray-400">发现时间</span>
        <span className="text-gray-900 dark:text-gray-100">
          {formatDateTime(detail.discoveredAt)}{" "}
          <span className="text-gray-400 text-xs">
            ({minutesAgo(detail.discoveredAt)})
          </span>
        </span>

        <span className="text-gray-500 dark:text-gray-400">当前热度</span>
        <div className="flex items-center gap-2">
          <div className="flex-1 max-w-40 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div
              className={`h-full rounded-full ${heatBarColor(detail.heatScore)}`}
              style={{ width: `${detail.heatScore}%` }}
            />
          </div>
          <span className="font-bold text-gray-900 dark:text-gray-100">
            {detail.heatScore}
          </span>
          <span className="text-gray-400 text-xs">/100</span>
        </div>

        <span className="text-gray-500 dark:text-gray-400">原文链接</span>
        <a
          href={detail.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition"
        >
          查看原文 ↗
        </a>
      </div>

      {/* Content summary */}
      <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-4 mb-4">
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          {detail.contentSummary}
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          (原文共{detail.contentLength}字)
        </p>
      </div>

      {/* Already reported by */}
      {detail.reportedBy.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            已有媒体报道
          </p>
          <div className="flex flex-wrap gap-1.5">
            {visibleReporters.map((r) => (
              <Badge
                key={r.name}
                className={`border-0 ${
                  r.level === "central"
                    ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                }`}
              >
                {r.level === "central" ? "🏛 " : ""}
                {r.name}
              </Badge>
            ))}
            {extraCount > 0 && (
              <Badge className="border-0 bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                +{extraCount}家
              </Badge>
            )}
          </div>
        </div>
      )}
    </GlassCard>
  );
}

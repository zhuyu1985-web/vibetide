"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, RefreshCw, Copy, Download, ThumbsUp, ThumbsDown } from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import type { TopicCompareDetail } from "@/lib/types";

/* ─── Section Config ─── */

interface SectionConfig {
  key: string;
  tag: string;
  tagColor: string;
  title: string;
  contentKey: "centralMediaReport" | "otherMediaReport" | "highlights" | "overallSummary";
}

const sections: SectionConfig[] = [
  {
    key: "central",
    tag: "央级媒体",
    tagColor: "bg-red-600",
    title: "官媒及央媒报道分析",
    contentKey: "centralMediaReport",
  },
  {
    key: "other",
    tag: "其他媒体",
    tagColor: "bg-blue-600",
    title: "其他媒体报道分析",
    contentKey: "otherMediaReport",
  },
  {
    key: "highlights",
    tag: "💡 亮点",
    tagColor: "bg-amber-500",
    title: "报道亮点与创新点",
    contentKey: "highlights",
  },
  {
    key: "summary",
    tag: "📊 总结",
    tagColor: "bg-gray-500",
    title: "整体报道总结",
    contentKey: "overallSummary",
  },
];

/* ─── Component ─── */

interface Props {
  detail: TopicCompareDetail;
}

export function OverviewTab({ detail }: Props) {
  const { aiSummary, lastAnalyzedAt } = detail;
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [regenerating, setRegenerating] = useState<string | null>(null);

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleRegenerate = (key: string) => {
    setRegenerating(key);
    setTimeout(() => setRegenerating(null), 2000);
  };

  const handleCopyAll = () => {
    if (!aiSummary) return;
    const fullText = sections
      .map((s) => `【${s.tag}】${s.title}\n${aiSummary[s.contentKey]}`)
      .join("\n\n");
    navigator.clipboard.writeText(fullText);
  };

  if (!aiSummary) {
    return (
      <GlassCard className="mt-4">
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
          <p className="text-sm">暂无AI分析数据，请点击"刷新数据"生成分析</p>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {sections.map((section) => {
        const isCollapsed = collapsed[section.key] ?? false;
        const isLoading = regenerating === section.key;
        const content = aiSummary[section.contentKey];

        return (
          <GlassCard key={section.key} padding="none">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2.5">
                <span
                  className={`${section.tagColor} text-white text-xs font-medium px-2 py-0.5 rounded`}
                >
                  {section.tag}
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {section.title}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="border-0 text-xs"
                  onClick={() => handleRegenerate(section.key)}
                  disabled={isLoading}
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 mr-1 ${isLoading ? "animate-spin" : ""}`}
                  />
                  重新生成
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="border-0 p-1.5"
                  onClick={() => toggleCollapse(section.key)}
                >
                  {isCollapsed ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Content */}
            {!isCollapsed && (
              <div className="px-5 py-4">
                <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                  {content}
                </div>
              </div>
            )}
          </GlassCard>
        );
      })}

      {/* ── Bottom Actions ── */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="border-0" onClick={handleCopyAll}>
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            复制全文
          </Button>
          <Button variant="ghost" size="sm" className="border-0">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            导出文档
          </Button>
        </div>
        <div className="flex items-center gap-3">
          {lastAnalyzedAt && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              最近分析：
              {new Date(lastAnalyzedAt).toLocaleString("zh-CN", {
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="border-0 p-1.5">
              <ThumbsUp className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="border-0 p-1.5">
              <ThumbsDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

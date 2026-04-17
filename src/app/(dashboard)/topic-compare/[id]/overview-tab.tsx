"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Copy,
  Download,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { generateTopicCompareAISummary } from "@/app/actions/topic-compare";
import type { TopicCompareDetail, BenchmarkAISummary } from "@/lib/types";

interface SectionConfig {
  key: string;
  tag: string;
  tagColor: string;
  title: string;
  contentKey: "centralMediaReport" | "otherMediaReport" | "highlights" | "overallSummary";
}

const sections: SectionConfig[] = [
  { key: "central", tag: "央级媒体", tagColor: "bg-red-600", title: "官媒及央媒报道分析", contentKey: "centralMediaReport" },
  { key: "other", tag: "其他媒体", tagColor: "bg-blue-600", title: "其他媒体报道分析", contentKey: "otherMediaReport" },
  { key: "highlights", tag: "💡 亮点", tagColor: "bg-amber-500", title: "报道亮点与创新点", contentKey: "highlights" },
  { key: "summary", tag: "📊 总结", tagColor: "bg-gray-500", title: "整体报道总结", contentKey: "overallSummary" },
];

interface Props {
  detail: TopicCompareDetail;
}

export function OverviewTab({ detail }: Props) {
  const router = useRouter();
  const { article, lastAnalyzedAt } = detail;

  // Local state so we can update the UI as soon as generation finishes,
  // without waiting for a full router refresh round-trip.
  const [aiSummary, setAiSummary] = useState<BenchmarkAISummary | null>(detail.aiSummary);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGenerate = () => {
    setErrorMsg(null);
    startTransition(async () => {
      const result = await generateTopicCompareAISummary(article.id);
      if (result.success && result.summary) {
        setAiSummary(result.summary);
        router.refresh();
      } else {
        setErrorMsg(result.error ?? "生成失败");
      }
    });
  };

  const handleCopyAll = () => {
    if (!aiSummary) return;
    const fullText = sections
      .map((s) => `【${s.tag}】${s.title}\n${aiSummary[s.contentKey]}`)
      .join("\n\n");
    navigator.clipboard.writeText(fullText);
  };

  /* ── Empty state (no AI summary yet) ── */
  if (!aiSummary) {
    return (
      <GlassCard className="mt-4">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center mb-4">
            <Sparkles className="h-6 w-6 text-blue-500 dark:text-blue-400" />
          </div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            尚未生成 AI 分析
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mb-5">
            AI 将自动检索全网报道，从央级媒体、其他媒体、报道亮点、整体总结四个维度进行结构化分析
          </p>
          <Button
            size="sm"
            className="border-0 bg-blue-600 text-white hover:bg-blue-700"
            disabled={isPending}
            onClick={handleGenerate}
          >
            {isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                正在生成...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                生成 AI 分析
              </>
            )}
          </Button>
          {errorMsg && (
            <div className="mt-4 flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="h-3.5 w-3.5" />
              {errorMsg}
            </div>
          )}
        </div>
      </GlassCard>
    );
  }

  /* ── Normal state with AI summary ── */
  return (
    <div className="mt-4 space-y-4">
      {sections.map((section) => {
        const isCollapsed = collapsed[section.key] ?? false;
        const content = aiSummary[section.contentKey];

        return (
          <GlassCard key={section.key} padding="none">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2.5">
                <span className={`${section.tagColor} text-white text-xs font-medium px-2 py-0.5 rounded`}>
                  {section.tag}
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {section.title}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="border-0 p-1.5"
                onClick={() => toggleCollapse(section.key)}
              >
                {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </Button>
            </div>
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
      <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="border-0" onClick={handleCopyAll}>
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            复制全文
          </Button>
          <Button variant="ghost" size="sm" className="border-0">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            导出文档
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="border-0"
            onClick={handleGenerate}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            )}
            {isPending ? "重新生成中..." : "重新生成"}
          </Button>
        </div>
        <div className="flex items-center gap-3">
          {errorMsg && (
            <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              {errorMsg}
            </span>
          )}
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

"use client";

import { useState } from "react";
import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  ExternalLink,
  Sparkles,
  Newspaper,
} from "lucide-react";
import type { BenchmarkAISummary } from "@/lib/types";

interface TopicReportPanelProps {
  topicTitle: string;
  cachedReport?: BenchmarkAISummary;
  onReportGenerated?: (report: BenchmarkAISummary) => void;
}

type PanelState = "empty" | "loading" | "result";

const mediaLevelConfig: Record<
  string,
  { label: string; className: string }
> = {
  central: {
    label: "央媒",
    className:
      "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200",
  },
  provincial: {
    label: "省媒",
    className:
      "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200",
  },
  municipal: {
    label: "市媒",
    className:
      "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200",
  },
  industry: {
    label: "行业",
    className:
      "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700",
  },
  unknown: {
    label: "其他",
    className:
      "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700",
  },
};

export function TopicReportPanel({
  topicTitle,
  cachedReport,
  onReportGenerated,
}: TopicReportPanelProps) {
  const [state, setState] = useState<PanelState>(
    cachedReport ? "result" : "empty"
  );
  const [report, setReport] = useState<BenchmarkAISummary | undefined>(
    cachedReport
  );
  const [loadingLabel, setLoadingLabel] = useState("正在搜索全网报道...");

  async function handleGenerate() {
    setState("loading");
    setLoadingLabel("正在搜索全网报道...");

    try {
      const response = await fetch("/api/benchmarking/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicTitle }),
      });

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("无法读取响应流");

      const decoder = new TextDecoder();
      let buffer = "";
      let finalReport: BenchmarkAISummary | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim() || !line.startsWith("data:")) continue;
          const dataStr = line.slice(5).trim();
          if (dataStr === "[DONE]") break;

          try {
            const event = JSON.parse(dataStr);
            if (event.type === "status") {
              setLoadingLabel(event.message ?? "正在生成 AI 总结...");
            } else if (event.type === "result") {
              finalReport = event.data as BenchmarkAISummary;
            }
          } catch {
            // 忽略解析错误
          }
        }
      }

      if (finalReport) {
        setReport(finalReport);
        setState("result");
        onReportGenerated?.(finalReport);
      } else {
        setState("empty");
      }
    } catch {
      setState("empty");
    }
  }

  // Empty state
  if (state === "empty") {
    return (
      <GlassCard>
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center mb-4">
            <Newspaper size={22} className="text-blue-400" />
          </div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            AI 全网报道总结
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mb-5">
            一键搜索全网{topicTitle ? `「${topicTitle}」` : ""}相关报道，生成央媒、省媒、市媒覆盖分析
          </p>
          <Button
            className="border-0"
            size="sm"
            onClick={handleGenerate}
          >
            <Sparkles size={14} className="mr-1.5" />
            点击生成 AI 全网报道总结
          </Button>
        </div>
      </GlassCard>
    );
  }

  // Loading state
  if (state === "loading") {
    return (
      <GlassCard>
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <Loader2 size={28} className="text-blue-500 animate-spin mb-4" />
          <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
            {loadingLabel}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            正在生成 AI 总结...
          </p>
        </div>
      </GlassCard>
    );
  }

  // Result state
  if (!report) return null;

  const sections: { title: string; content: string }[] = [
    { title: "官媒及央媒报道", content: report.centralMediaReport },
    { title: "其他媒体报道", content: report.otherMediaReport },
    { title: "报道亮点与创新", content: report.highlights },
    { title: "整体报道总结", content: report.overallSummary },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            AI 全网报道总结
          </h3>
          {topicTitle && (
            <Badge variant="secondary" className="text-xs">
              {topicTitle}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="border-0 text-xs text-gray-500"
          onClick={() => {
            setState("empty");
            setReport(undefined);
          }}
        >
          重新生成
        </Button>
      </div>

      {/* Four analysis sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((section) => (
          <GlassCard key={section.title} variant="secondary" padding="sm">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {section.title}
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              {section.content || "暂无数据"}
            </p>
          </GlassCard>
        ))}
      </div>

      {/* Source articles */}
      {report.sourceArticles && report.sourceArticles.length > 0 && (
        <GlassCard padding="sm">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
            <Newspaper size={13} className="text-gray-400" />
            参考来源（{report.sourceArticles.length} 篇）
          </h4>
          <div className="space-y-2">
            {report.sourceArticles.map((article, index) => {
              const levelCfg =
                mediaLevelConfig[article.mediaLevel] ??
                mediaLevelConfig.unknown;
              return (
                <div
                  key={index}
                  className="flex items-start gap-2.5 py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0"
                >
                  <span
                    className={`inline-flex shrink-0 items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border mt-0.5 ${levelCfg.className}`}
                  >
                    {levelCfg.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 line-clamp-1 flex items-center gap-1"
                    >
                      {article.title}
                      <ExternalLink size={10} className="shrink-0 text-gray-400" />
                    </a>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                      {article.platform}
                      {article.publishedAt && ` · ${article.publishedAt}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}
    </div>
  );
}

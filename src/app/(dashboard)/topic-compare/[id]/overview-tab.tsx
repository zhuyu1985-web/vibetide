"use client";

import { useState, useRef } from "react";
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
  PenTool,
} from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { parseSSE } from "@/lib/chat-utils";
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

type PartialSummary = Partial<
  Pick<BenchmarkAISummary, "centralMediaReport" | "otherMediaReport" | "highlights" | "overallSummary">
>;

interface Props {
  detail: TopicCompareDetail;
}

export function OverviewTab({ detail }: Props) {
  const router = useRouter();
  const { article, lastAnalyzedAt } = detail;

  const [aiSummary, setAiSummary] = useState<BenchmarkAISummary | null>(detail.aiSummary);
  const [streaming, setStreaming] = useState(false);
  const [statusText, setStatusText] = useState<string>("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const toggleCollapse = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGenerate = async () => {
    setErrorMsg(null);
    setStreaming(true);
    setStatusText("正在初始化...");
    // Start with an empty-section placeholder so the 4 cards render immediately
    setAiSummary({
      centralMediaReport: "",
      otherMediaReport: "",
      highlights: "",
      overallSummary: "",
      sourceArticles: [],
      generatedAt: new Date().toISOString(),
    });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/topic-compare/generate-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId: article.id }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(data.error ?? "生成失败");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("流式响应不可用");
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { events, remaining } = parseSSE(buffer);
        buffer = remaining;

        for (const evt of events) {
          let payload: Record<string, unknown>;
          try {
            payload = JSON.parse(evt.data);
          } catch {
            continue;
          }

          if (evt.event === "status") {
            setStatusText(String(payload.message ?? ""));
          } else if (evt.event === "partial") {
            const partial = payload as PartialSummary;
            setAiSummary((prev) => {
              const base = prev ?? {
                centralMediaReport: "",
                otherMediaReport: "",
                highlights: "",
                overallSummary: "",
                sourceArticles: [],
                generatedAt: new Date().toISOString(),
              };
              return {
                ...base,
                centralMediaReport: partial.centralMediaReport ?? base.centralMediaReport,
                otherMediaReport: partial.otherMediaReport ?? base.otherMediaReport,
                highlights: partial.highlights ?? base.highlights,
                overallSummary: partial.overallSummary ?? base.overallSummary,
              };
            });
          } else if (evt.event === "done") {
            const summary = payload.summary as BenchmarkAISummary;
            setAiSummary(summary);
            setStatusText("");
            router.refresh();
          } else if (evt.event === "error") {
            throw new Error(String(payload.message ?? "生成失败"));
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setStatusText("");
        return;
      }
      setErrorMsg(err instanceof Error ? err.message : "生成失败");
      // Revert to original state if nothing was streamed yet
      if (!aiSummary?.centralMediaReport && !aiSummary?.otherMediaReport) {
        setAiSummary(detail.aiSummary);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const handleCopyAll = async () => {
    if (!aiSummary) return;
    const fullText = sections
      .map((s) => `【${s.tag}】${s.title}\n${aiSummary[s.contentKey]}`)
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(fullText);
      setStatusText("已复制到剪贴板");
      setTimeout(() => setStatusText(""), 2000);
    } catch {
      setErrorMsg("复制失败，请检查浏览器权限");
    }
  };

  const handleExportMarkdown = () => {
    if (!aiSummary) return;
    const timestamp = new Date().toLocaleString("zh-CN");
    const md = [
      `# 同题对比 AI 分析：${article.title}`,
      ``,
      `> 生成时间：${timestamp}`,
      ``,
      ...sections.flatMap((s) => [
        `## ${s.tag} · ${s.title}`,
        ``,
        aiSummary[s.contentKey] || "（暂无内容）",
        ``,
      ]),
      aiSummary.sourceArticles && aiSummary.sourceArticles.length > 0
        ? [
            `## 📎 参考报道`,
            ``,
            ...aiSummary.sourceArticles.map(
              (sa, i) =>
                `${i + 1}. [${sa.title}](${sa.url}) — ${sa.platform}${sa.publishedAt ? ` (${new Date(sa.publishedAt).toLocaleDateString("zh-CN")})` : ""}`
            ),
          ].join("\n")
        : "",
    ].join("\n");

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const filename = `同题对比_${article.title.slice(0, 20).replace(/[\/\\:*?"<>|]/g, "_")}_${new Date().toISOString().slice(0, 10)}.md`;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyAsTopic = () => {
    // Use the article title as the topic seed; super-creation accepts ?topic=&source=
    const params = new URLSearchParams({
      topic: article.title,
      source: "topic-compare",
    });
    router.push(`/super-creation?${params.toString()}`);
  };

  /* ── Empty state (no summary AND not streaming) ── */
  if (!aiSummary && !streaming) {
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
            AI 将基于已抓取的全网同题报道，从央级媒体、其他媒体、报道亮点、整体总结四个维度流式生成结构化分析
          </p>
          <Button
            size="sm"
            className="border-0 bg-blue-600 text-white hover:bg-blue-700"
            onClick={handleGenerate}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            生成 AI 分析
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

  const summary = aiSummary!;

  /* ── Normal / streaming state ── */
  return (
    <div className="mt-4 space-y-4">
      {/* Streaming status bar */}
      {streaming && (
        <div className="flex items-center justify-between rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 px-4 py-2">
          <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {statusText || "正在生成..."}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="border-0 h-6 px-2 text-xs text-blue-700 dark:text-blue-300"
            onClick={handleCancel}
          >
            取消
          </Button>
        </div>
      )}

      {sections.map((section) => {
        const isCollapsed = collapsed[section.key] ?? false;
        const content = summary[section.contentKey];
        const isEmpty = !content || content.length === 0;

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
                {streaming && isEmpty && (
                  <Loader2 className="h-3 w-3 text-gray-400 animate-spin" />
                )}
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
                {isEmpty && streaming ? (
                  <div className="text-xs text-gray-400 dark:text-gray-500">等待生成...</div>
                ) : isEmpty ? (
                  <div className="text-xs text-gray-400 dark:text-gray-500">（本节暂无内容）</div>
                ) : (
                  <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                    {content}
                    {streaming && content.length > 0 && (
                      <span className="inline-block w-1.5 h-4 bg-blue-400 dark:bg-blue-500 animate-pulse ml-0.5 align-middle" />
                    )}
                  </div>
                )}
              </div>
            )}
          </GlassCard>
        );
      })}

      {/* ── Bottom Actions ── */}
      <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="border-0"
            onClick={handleCopyAll}
            disabled={streaming}
          >
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            复制全文
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="border-0"
            onClick={handleExportMarkdown}
            disabled={streaming}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            导出 Markdown
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="border-0 text-blue-600 dark:text-blue-400 hover:text-blue-700"
            onClick={handleCopyAsTopic}
            disabled={streaming}
          >
            <PenTool className="h-3.5 w-3.5 mr-1.5" />
            复制为选题
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="border-0"
            onClick={handleGenerate}
            disabled={streaming}
          >
            {streaming ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            )}
            {streaming ? "生成中..." : "重新生成"}
          </Button>
        </div>
        <div className="flex items-center gap-3">
          {errorMsg && (
            <span className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              {errorMsg}
            </span>
          )}
          {lastAnalyzedAt && !streaming && (
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
            <Button variant="ghost" size="sm" className="border-0 p-1.5" disabled={streaming}>
              <ThumbsUp className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="border-0 p-1.5" disabled={streaming}>
              <ThumbsDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

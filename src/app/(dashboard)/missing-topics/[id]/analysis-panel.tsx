"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Loader2,
  AlertCircle,
  ClipboardCopy,
  Clock,
} from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { parseSSE } from "@/lib/chat-utils";
import type { MissingTopicDetail, MissingTopicAIAnalysis } from "@/lib/types";

/* ─── Urgency config ─── */

const urgencyConfig: Record<
  NonNullable<MissingTopicAIAnalysis["supplementAdvice"]["urgency"]>,
  { label: string; color: string }
> = {
  immediate: { label: "⏰ 立即报道", color: "text-red-600 dark:text-red-400" },
  today: { label: "📅 今日内报道", color: "text-orange-600 dark:text-orange-400" },
  scheduled: { label: "🗓 择时报道", color: "text-amber-600 dark:text-amber-400" },
  skip: { label: "⏭ 可不报道", color: "text-gray-500 dark:text-gray-400" },
};

/* ─── Collapsible section ─── */

function Section({
  tag,
  tagColor,
  title,
  children,
  defaultOpen = true,
  cardClassName = "",
  loading = false,
}: {
  tag: string;
  tagColor: string;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  cardClassName?: string;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={`rounded-lg border border-gray-100 dark:border-gray-700/60 ${cardClassName}`}
    >
      <button
        type="button"
        className="flex items-center gap-2 w-full px-4 py-3 text-left border-0 bg-transparent"
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
        )}
        <Badge className={`border-0 text-[11px] ${tagColor}`}>{tag}</Badge>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {title}
        </span>
        {loading && (
          <Loader2 className="h-3 w-3 text-gray-400 animate-spin ml-1" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}

/* ─── Component ─── */

interface Props {
  detail: MissingTopicDetail;
}

type PartialAnalysis = Partial<
  Pick<
    MissingTopicAIAnalysis,
    "centralMediaReport" | "otherMediaReport" | "highlights" | "overallSummary"
  >
> & {
  supplementAdvice?: Partial<MissingTopicAIAnalysis["supplementAdvice"]>;
};

export function AnalysisPanel({ detail }: Props) {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<MissingTopicAIAnalysis | null>(
    detail.aiAnalysis
  );
  const [streaming, setStreaming] = useState(false);
  const [statusText, setStatusText] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleGenerate = async () => {
    setErrorMsg(null);
    setStreaming(true);
    setStatusText("正在初始化...");
    setAnalysis({
      centralMediaReport: "",
      otherMediaReport: "",
      highlights: "",
      overallSummary: "",
      supplementAdvice: {
        urgency: "scheduled",
        urgencyReason: "",
        angles: [],
        risks: "",
      },
      sourceArticles: [],
      generatedAt: new Date().toISOString(),
    });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/missing-topics/generate-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId: detail.id,
          topicTitle: detail.title,
          contentSummary: detail.contentSummary,
        }),
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
            const partial = payload as PartialAnalysis;
            setAnalysis((prev) => {
              const base: MissingTopicAIAnalysis = prev ?? {
                centralMediaReport: "",
                otherMediaReport: "",
                highlights: "",
                overallSummary: "",
                supplementAdvice: {
                  urgency: "scheduled",
                  urgencyReason: "",
                  angles: [],
                  risks: "",
                },
                sourceArticles: [],
                generatedAt: new Date().toISOString(),
              };
              return {
                ...base,
                centralMediaReport: partial.centralMediaReport ?? base.centralMediaReport,
                otherMediaReport: partial.otherMediaReport ?? base.otherMediaReport,
                highlights: partial.highlights ?? base.highlights,
                overallSummary: partial.overallSummary ?? base.overallSummary,
                supplementAdvice: {
                  urgency:
                    partial.supplementAdvice?.urgency ??
                    base.supplementAdvice.urgency,
                  urgencyReason:
                    partial.supplementAdvice?.urgencyReason ??
                    base.supplementAdvice.urgencyReason,
                  angles:
                    partial.supplementAdvice?.angles ??
                    base.supplementAdvice.angles,
                  risks:
                    partial.supplementAdvice?.risks ??
                    base.supplementAdvice.risks,
                },
              };
            });
          } else if (evt.event === "done") {
            const full = payload.analysis as MissingTopicAIAnalysis;
            setAnalysis(full);
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
      if (!analysis?.centralMediaReport && !analysis?.otherMediaReport) {
        setAnalysis(detail.aiAnalysis);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const handleCancel = () => abortRef.current?.abort();

  const handleCopyAsTopic = (angleTitle: string, angleDescription: string) => {
    const topicText = `${angleTitle}（来自漏题"${detail.title}"的补报建议：${angleDescription}）`;
    const params = new URLSearchParams({
      topic: topicText,
      source: "missing-topic",
    });
    router.push(`/super-creation?${params.toString()}`);
  };

  /* ── Empty state ── */
  if (!analysis && !streaming) {
    return (
      <GlassCard padding="lg" className="bg-gray-50/50 dark:bg-gray-900/30">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
            AI 全网报道分析
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center mb-4">
            <Sparkles className="h-6 w-6 text-blue-500 dark:text-blue-400" />
          </div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            尚未生成 AI 分析
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mb-5">
            AI 将基于全网同题报道，生成 4 个维度的分析以及具体的补充报道建议（紧急度、角度、风险）
          </p>
          <Button
            size="sm"
            className="border-0 bg-blue-600 text-white hover:bg-blue-700"
            onClick={handleGenerate}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            一键 AI 检索全网报道
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

  const a = analysis!;
  const ug = urgencyConfig[a.supplementAdvice.urgency];

  return (
    <GlassCard padding="lg" className="bg-gray-50/50 dark:bg-gray-900/30">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
          AI 全网报道分析
        </p>
        <Button
          size="sm"
          className="border-0 bg-blue-600 text-white hover:bg-blue-700"
          onClick={streaming ? handleCancel : handleGenerate}
        >
          {streaming ? (
            <>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              取消生成
            </>
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              重新生成
            </>
          )}
        </Button>
      </div>

      {/* Streaming status */}
      {streaming && (
        <div className="flex items-center gap-2 mb-3 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {statusText || "正在生成..."}
        </div>
      )}

      {/* Error */}
      {errorMsg && !streaming && (
        <div className="flex items-center gap-2 mb-3 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/40 px-3 py-2 text-xs text-red-700 dark:text-red-300">
          <AlertCircle className="h-3.5 w-3.5" />
          {errorMsg}
        </div>
      )}

      {/* Sections */}
      <div className="flex flex-col gap-3">
        <Section
          tag="央级媒体"
          tagColor="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
          title="官媒报道分析"
          loading={streaming && !a.centralMediaReport}
        >
          {a.centralMediaReport || (
            <span className="text-gray-400 dark:text-gray-500">
              {streaming ? "等待生成..." : "（暂无内容）"}
            </span>
          )}
        </Section>

        <Section
          tag="其他"
          tagColor="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
          title="其他媒体分析"
          loading={streaming && !a.otherMediaReport}
        >
          {a.otherMediaReport || (
            <span className="text-gray-400 dark:text-gray-500">
              {streaming ? "等待生成..." : "（暂无内容）"}
            </span>
          )}
        </Section>

        <Section
          tag="亮点"
          tagColor="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          title="报道亮点"
          loading={streaming && !a.highlights}
        >
          {a.highlights || (
            <span className="text-gray-400 dark:text-gray-500">
              {streaming ? "等待生成..." : "（暂无内容）"}
            </span>
          )}
        </Section>

        <Section
          tag="总结"
          tagColor="bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
          title="整体总结"
          loading={streaming && !a.overallSummary}
        >
          {a.overallSummary || (
            <span className="text-gray-400 dark:text-gray-500">
              {streaming ? "等待生成..." : "（暂无内容）"}
            </span>
          )}
        </Section>

        {/* Supplement advice */}
        <Section
          tag="📝 补报"
          tagColor="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
          title="补充报道建议"
          cardClassName="bg-blue-50/50 dark:bg-blue-950/20"
          loading={streaming && !a.supplementAdvice.urgencyReason && a.supplementAdvice.angles.length === 0}
        >
          <div className="space-y-3">
            {/* Urgency */}
            <p>
              <span className={`font-bold ${ug.color}`}>{ug.label}</span>
              {a.supplementAdvice.urgencyReason && (
                <span className="text-gray-500 dark:text-gray-400 ml-2 text-xs inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {a.supplementAdvice.urgencyReason}
                </span>
              )}
            </p>

            {/* Angles */}
            {a.supplementAdvice.angles.length > 0 ? (
              <div>
                <p className="text-gray-700 dark:text-gray-300 font-medium mb-2">
                  建议角度：
                </p>
                <div className="space-y-2">
                  {a.supplementAdvice.angles.map((angle, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between gap-2 bg-white dark:bg-gray-800/60 rounded-lg p-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-800 dark:text-gray-200 font-medium">
                          {i + 1}. {angle.title}
                        </p>
                        {angle.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                            {angle.description}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="border-0 text-blue-600 dark:text-blue-400 shrink-0"
                        onClick={() => handleCopyAsTopic(angle.title, angle.description)}
                        disabled={streaming}
                      >
                        <ClipboardCopy className="h-3.5 w-3.5 mr-1" />
                        复制为选题
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : streaming ? (
              <div className="text-xs text-gray-400">等待生成建议角度...</div>
            ) : null}

            {/* Risks */}
            {a.supplementAdvice.risks && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3">
                <p className="text-sm text-red-700 dark:text-red-400">
                  ⚠ 风险提示：{a.supplementAdvice.risks}
                </p>
              </div>
            )}
          </div>
        </Section>
      </div>
    </GlassCard>
  );
}

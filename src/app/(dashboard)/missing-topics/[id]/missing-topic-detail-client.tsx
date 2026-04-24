"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  ExternalLink,
  Sparkles,
  RefreshCcw,
  Flame,
  Trophy,
  AlertCircle,
} from "lucide-react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { AnalysisProgress, type AnalysisPhase } from "@/components/topic-compare/analysis-progress";
import {
  confirmMissedTopic,
  excludeMissedTopic,
  markMissedTopicPushed,
} from "@/app/actions/missing-topics";
import type {
  MissingTopicDetail,
  MissingTopicComparisonAnalysis,
  MissingTopicBenchmarkReport,
} from "@/lib/dal/missing-topics";

const LEVEL_LABEL: Record<string, string> = {
  central: "央级", provincial: "省级", city: "地市", industry: "行业", self_media: "自媒体",
};
const LEVEL_COLOR: Record<string, string> = {
  central: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  provincial: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  city: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  industry: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
  self_media: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};
const PLATFORM_LABEL: Record<string, string> = {
  douyin: "抖音", wechat: "微信", weibo: "微博", website: "网站",
  app: "APP", bilibili: "B站", kuaishou: "快手", xiaohongshu: "小红书",
};
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  covered: { label: "已覆盖", color: "bg-green-100 text-green-700" },
  suspected: { label: "疑似漏题", color: "bg-orange-100 text-orange-700" },
  confirmed: { label: "已确认", color: "bg-red-100 text-red-700" },
  excluded: { label: "已排除", color: "bg-gray-100 text-gray-700" },
  pushed: { label: "已推送", color: "bg-sky-100 text-sky-700" },
};
const URGENCY_COLOR: Record<string, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fmtNum(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

interface Props {
  detail: MissingTopicDetail;
}

export function MissingTopicDetailClient({ detail }: Props) {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<MissingTopicComparisonAnalysis | null>(
    detail.comparisonAnalysis
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [phase, setPhase] = useState<AnalysisPhase>("idle");
  const [progressMsg, setProgressMsg] = useState("");
  const [liveReportCount, setLiveReportCount] = useState<number | undefined>();
  const [actionPending, setActionPending] = useState(false);

  const allReports: MissingTopicBenchmarkReport[] = [
    ...(detail.primaryReport ? [detail.primaryReport] : []),
    ...detail.relatedReports,
  ];

  // 按 level 分组
  const grouped = allReports.reduce<Record<string, MissingTopicBenchmarkReport[]>>((acc, r) => {
    if (!acc[r.accountLevel]) acc[r.accountLevel] = [];
    acc[r.accountLevel].push(r);
    return acc;
  }, {});
  const levelOrder = ["central", "provincial", "city", "industry", "self_media"];

  const statusCfg = STATUS_CONFIG[detail.uiStatus] ?? STATUS_CONFIG.suspected;

  async function runAnalysis(forceRefresh = false) {
    setAnalyzing(true);
    setPhase("matching");
    setProgressMsg("");
    setLiveReportCount(undefined);
    try {
      const res = await fetch("/api/missing-topics/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId: detail.id, forceRefresh, expandFirst: true }),
      });
      if (!res.body) throw new Error("无响应");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const evt of events) {
          if (!evt.trim()) continue;
          const lines = evt.split("\n");
          const eventName = lines.find((l) => l.startsWith("event: "))?.slice(7);
          const dataStr = lines.find((l) => l.startsWith("data: "))?.slice(6);
          if (!dataStr) continue;
          const data = JSON.parse(dataStr);
          if (eventName === "status") {
            setProgressMsg(data.message ?? "");
            const mapping: Record<string, AnalysisPhase> = {
              expanding: "matching",
              analyzing: "analyzing",
              saving: "saving",
              "cache-hit": "done",
            };
            if (data.phase && mapping[data.phase]) setPhase(mapping[data.phase]);
          } else if (eventName === "expanded") {
            setProgressMsg(`扩展搜索完成：发现 ${data.total} 篇同题报道`);
          } else if (eventName === "matched") {
            setLiveReportCount(data.reportCount);
            setPhase("matched");
            setTimeout(() => setPhase("analyzing"), 800);
          } else if (eventName === "partial") {
            setAnalysis(data as MissingTopicComparisonAnalysis);
          } else if (eventName === "done") {
            setAnalysis(data.analysis);
            setPhase("done");
            setProgressMsg("");
            toast.success(data.cached ? "已加载缓存" : "对比分析生成完成");
            setTimeout(() => {
              setAnalyzing(false);
              setPhase("idle");
              router.refresh();
            }, 600);
            return;
          } else if (eventName === "error") {
            throw new Error(data.message);
          }
        }
      }
    } catch (err) {
      toast.error((err as Error).message || "分析失败");
      setAnalyzing(false);
      setPhase("idle");
    }
  }

  async function handleConfirm() {
    setActionPending(true);
    try {
      const res = await confirmMissedTopic(detail.id);
      if (res.success) {
        toast.success("已确认为漏题");
        router.refresh();
      } else toast.error(res.error || "失败");
    } finally {
      setActionPending(false);
    }
  }

  async function handleExclude() {
    const reason = prompt("排除原因（选填）") ?? "";
    setActionPending(true);
    try {
      const res = await excludeMissedTopic({
        topicId: detail.id,
        reasonCode: "manual_excluded",
        reasonText: reason || undefined,
      });
      if (res.success) {
        toast.success("已排除");
        router.refresh();
      } else toast.error(res.error || "失败");
    } finally {
      setActionPending(false);
    }
  }

  async function handlePush() {
    setActionPending(true);
    try {
      const res = await markMissedTopicPushed(detail.id);
      if (res.success) {
        toast.success("已推送");
        router.refresh();
      } else toast.error(res.error || "推送失败");
    } finally {
      setActionPending(false);
    }
  }

  return (
    <div className="max-w-[1600px] mx-auto">
      <div className="mb-3">
        <Link href="/missing-topics">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            返回漏题列表
          </Button>
        </Link>
      </div>

      <PageHeader
        title={detail.title}
        description={`${allReports.length} 家媒体已报道该话题 · 发现于 ${fmtDate(detail.discoveredAt)}`}
        actions={
          <div className="flex gap-2">
            {detail.uiStatus !== "covered" && detail.uiStatus !== "excluded" && (
              <>
                {detail.uiStatus !== "confirmed" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={actionPending}
                    onClick={handleConfirm}
                  >
                    确认漏题
                  </Button>
                )}
                <Button variant="ghost" size="sm" disabled={actionPending} onClick={handleExclude}>
                  排除
                </Button>
                {detail.uiStatus !== "pushed" && (
                  <Button variant="ghost" size="sm" disabled={actionPending} onClick={handlePush}>
                    推送
                  </Button>
                )}
              </>
            )}
            {analysis ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={analyzing}
                onClick={() => runAnalysis(true)}
              >
                <RefreshCcw className={`w-4 h-4 mr-1.5 ${analyzing ? "animate-spin" : ""}`} />
                {analyzing ? "分析中..." : "刷新对比分析"}
              </Button>
            ) : (
              <Button size="sm" disabled={analyzing} onClick={() => runAnalysis(false)}>
                <Sparkles className="w-4 h-4 mr-1.5" />
                {analyzing ? "分析中..." : "生成对比分析"}
              </Button>
            )}
          </div>
        }
      />

      {/* 元信息徽标栏 */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <span className={`text-xs px-2 py-0.5 rounded ${statusCfg.color}`}>
          {statusCfg.label}
        </span>
        <span className="text-xs text-gray-600 dark:text-gray-400 inline-flex items-center gap-1">
          <Flame className="w-3 h-3 text-orange-500" />
          热度 {detail.heatScore}
        </span>
        {detail.topic && (
          <span className="text-xs text-gray-600 dark:text-gray-400">
            · 话题：{detail.topic}
          </span>
        )}
        {detail.matchedMyPostTitle && (
          <span className="text-xs text-green-700 dark:text-green-300">
            · 已关联我方作品：{detail.matchedMyPostTitle}
          </span>
        )}
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* 左栏：报道媒体列表（按级别分组） */}
        <div className="col-span-12 lg:col-span-4">
          <GlassCard padding="md">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              报道此话题的媒体（{allReports.length}）
            </h3>
            {allReports.length === 0 ? (
              <p className="text-sm text-gray-500">暂无报道</p>
            ) : (
              <div className="space-y-4">
                {levelOrder.map((level) => {
                  const reports = grouped[level];
                  if (!reports || reports.length === 0) return null;
                  return (
                    <div key={level}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded ${LEVEL_COLOR[level]}`}>
                          {LEVEL_LABEL[level]}
                        </span>
                        <span className="text-xs text-gray-500">{reports.length} 家</span>
                      </div>
                      <div className="space-y-2">
                        {reports.map((r) => (
                          <ReportItem key={r.id} report={r} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </div>

        {/* 右栏：多媒体对比分析 */}
        <div className="col-span-12 lg:col-span-8">
          <GlassCard padding="md">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              多媒体对比分析
            </h3>
            {analyzing ? (
              <AnalysisProgress
                phase={phase}
                matchCount={liveReportCount}
                message={progressMsg}
              />
            ) : !analysis ? (
              <div className="text-center py-16 text-gray-500 dark:text-gray-400 text-sm">
                <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p>暂无对比分析</p>
                <p className="text-xs mt-2">
                  点击右上角「生成对比分析」，AI 将综合 {allReports.length} 家媒体的报道视角做差异分析
                </p>
              </div>
            ) : (
              <AnalysisBody analysis={analysis} />
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function ReportItem({ report }: { report: MissingTopicBenchmarkReport }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg bg-white/60 dark:bg-gray-800/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left p-3 hover:bg-white dark:hover:bg-gray-800 transition"
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {report.accountName}
          </span>
          <span className="text-[10px] text-gray-500">
            {PLATFORM_LABEL[report.accountPlatform] ?? report.accountPlatform}
          </span>
        </div>
        <div className="text-sm text-gray-900 dark:text-gray-100 leading-snug">
          {report.title}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-gray-500 mt-1">
          <span>{fmtDate(report.publishedAt)}</span>
          <span>{fmtNum(report.views)} 阅读</span>
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-200/50 dark:border-gray-700/50 space-y-2 text-xs">
          {report.summary && (
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              {report.summary}
            </p>
          )}
          {report.body && (
            <details className="text-gray-500">
              <summary className="cursor-pointer hover:text-gray-700">正文摘录</summary>
              <p className="mt-1 whitespace-pre-wrap">{report.body.slice(0, 400)}...</p>
            </details>
          )}
          {report.sourceUrl && (
            <a
              href={report.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-700"
            >
              查看原文
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function AnalysisBody({ analysis }: { analysis: MissingTopicComparisonAnalysis }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* 总览 */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-sky-50 via-indigo-50 to-purple-50 dark:from-sky-950/40 dark:via-indigo-950/40 dark:to-purple-950/40">
        <div className="text-xs font-medium text-sky-700 dark:text-sky-300 mb-1">
          报道格局总览
        </div>
        <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
          {analysis.summary}
        </p>
      </div>

      {/* 各家媒体视角 */}
      <div>
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          各家媒体视角
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {analysis.mediaPerspectives.map((p, i) => (
            <div
              key={i}
              className="rounded-lg bg-white/60 dark:bg-gray-800/60 p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {p.accountName}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded ${LEVEL_COLOR[levelFromLabel(p.level)] ?? "bg-gray-100 text-gray-700"}`}>
                  {p.level}
                </span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div>
                  <span className="text-gray-500">角度：</span>
                  <span className="text-gray-800 dark:text-gray-200">{p.angle}</span>
                </div>
                <div>
                  <span className="text-gray-500">语气：</span>
                  <span className="text-gray-800 dark:text-gray-200">{p.tone}</span>
                </div>
                {p.keyPoints.length > 0 && (
                  <div>
                    <span className="text-gray-500">要点：</span>
                    <ul className="mt-0.5 list-disc list-inside text-gray-700 dark:text-gray-300 space-y-0.5">
                      {p.keyPoints.map((k, j) => (
                        <li key={j}>{k}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {p.differentiator && (
                  <div className="mt-1 p-2 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-[11px]">
                    💡 {p.differentiator}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 维度对比 */}
      <div>
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          维度对比（各家媒体谁更强）
        </div>
        <div className="space-y-2">
          {analysis.dimensionComparison.map((d, i) => (
            <div
              key={i}
              className="rounded-lg bg-white/60 dark:bg-gray-800/60 p-3"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {d.dimension}
                </span>
                {d.winners.map((w, j) => (
                  <span
                    key={j}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                  >
                    <Trophy className="w-3 h-3" />
                    {w}
                  </span>
                ))}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                {d.comment}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 覆盖空白 / 补报机会 */}
      {analysis.coverageGaps.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            覆盖空白 / 补报机会
          </div>
          <div className="space-y-2">
            {analysis.coverageGaps.map((g, i) => (
              <div
                key={i}
                className="flex gap-3 p-3 rounded-lg bg-white/60 dark:bg-gray-800/60"
              >
                <div className="flex-shrink-0">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded ${URGENCY_COLOR[g.urgency]}`}
                  >
                    <AlertCircle className="w-3 h-3" />
                    {g.urgency === "high" ? "紧急" : g.urgency === "medium" ? "常规" : "观察"}
                  </span>
                </div>
                <div className="flex-1 text-xs space-y-1">
                  <div className="text-gray-800 dark:text-gray-200">{g.gap}</div>
                  <div className="text-gray-500">💡 {g.suggestion}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 补报建议 */}
      <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 p-4">
        <div className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-2">
          🎯 我方补报建议
        </div>
        <div className="mb-2 p-2 rounded bg-white/60 dark:bg-gray-800/60">
          <div className="text-[10px] text-gray-500">建议标题</div>
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">
            {analysis.recommendedHeadline}
          </div>
        </div>
        <div className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
          {analysis.recommendedAngle}
        </div>
      </div>
    </motion.div>
  );
}

function levelFromLabel(label: string): string {
  const reverseMap: Record<string, string> = {
    央级: "central", 省级: "provincial", 地市: "city", 行业: "industry", 自媒体: "self_media",
  };
  return reverseMap[label] ?? "industry";
}

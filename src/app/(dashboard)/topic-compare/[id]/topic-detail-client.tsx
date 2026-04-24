"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, RefreshCcw, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { DimensionRadar } from "@/components/topic-compare/dimension-radar";
import { DimensionCard } from "@/components/topic-compare/dimension-card";
import {
  AnalysisProgress,
  type AnalysisPhase,
} from "@/components/topic-compare/analysis-progress";
import { DIMENSION_META, type TenDimensionAnalysis } from "@/lib/topic-matching/dimension-analyzer";
import type { TopicCompareDetail } from "@/lib/dal/topic-compare";

const LEVEL_LABEL: Record<string, string> = {
  central: "央级",
  provincial: "省级",
  city: "地市",
  industry: "行业",
  self_media: "自媒体",
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
  detail: TopicCompareDetail;
}

export function TopicDetailClient({ detail }: Props) {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<TenDimensionAnalysis | null>(
    detail.match?.aiAnalysis ?? null
  );
  const [radarData, setRadarData] = useState<Array<{ dimension: string; score: number }> | null>(
    detail.match?.radarData ?? null
  );
  const [analyzing, setAnalyzing] = useState(false);
  const [phase, setPhase] = useState<AnalysisPhase>("idle");
  const [progressMsg, setProgressMsg] = useState("");
  const [liveMatchCount, setLiveMatchCount] = useState<number | undefined>();

  async function runAnalysis(forceRefresh = false) {
    setAnalyzing(true);
    setPhase("matching");
    setProgressMsg("");
    setLiveMatchCount(undefined);
    try {
      const res = await fetch("/api/topic-compare/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ myPostId: detail.myPost.id, forceRefresh }),
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
              matching: "matching",
              analyzing: "analyzing",
              saving: "saving",
              "cache-hit": "done",
            };
            if (data.phase && mapping[data.phase]) {
              setPhase(mapping[data.phase]);
            }
          } else if (eventName === "matched") {
            setLiveMatchCount(data.matchCount);
            setPhase("matched");
            // 短暂停留展示 matched，然后进入 analyzing
            setTimeout(() => setPhase("analyzing"), 800);
          } else if (eventName === "partial") {
            setAnalysis((prev) => ({ ...prev, ...data } as TenDimensionAnalysis));
          } else if (eventName === "done") {
            setAnalysis(data.analysis);
            setRadarData(data.radarData ?? null);
            setPhase("done");
            setProgressMsg("");
            toast.success(data.cached ? "已加载缓存结果" : "分析完成");
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
      setPhase("idle");
      setAnalyzing(false);
    }
  }

  // benchmark reports 按 level 分组
  const groupedReports = detail.benchmarkReports.reduce<Record<string, typeof detail.benchmarkReports>>((acc, r) => {
    if (!acc[r.accountLevel]) acc[r.accountLevel] = [];
    acc[r.accountLevel].push(r);
    return acc;
  }, {});

  const levelOrder = ["central", "provincial", "city", "industry", "self_media"];

  return (
    <div className="max-w-[1600px] mx-auto">
      <div className="mb-3">
        <Link href="/topic-compare">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            返回作品列表
          </Button>
        </Link>
      </div>

      <PageHeader
        title={detail.myPost.title}
        description={
          detail.myPost.topic ? `主题：${detail.myPost.topic}` : "同题对比详情"
        }
        actions={
          <div className="flex gap-2">
            {analysis ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => runAnalysis(true)}
                disabled={analyzing}
              >
                <RefreshCcw className={`w-4 h-4 mr-1.5 ${analyzing ? "animate-spin" : ""}`} />
                {analyzing ? "分析中..." : "刷新分析"}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => runAnalysis(false)}
                disabled={analyzing}
              >
                <Sparkles className="w-4 h-4 mr-1.5" />
                {analyzing ? "分析中..." : "生成 10 维分析"}
              </Button>
            )}
          </div>
        }
      />


      <div className="grid grid-cols-12 gap-4">
        {/* 左栏：我方稿件 */}
        <div className="col-span-12 lg:col-span-3 space-y-3">
          <GlassCard padding="md">
            <h3 className="text-xs font-medium text-gray-500 uppercase mb-2">我方稿件</h3>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 leading-snug">
              {detail.myPost.title}
            </h4>
            {detail.myPost.summary && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 line-clamp-4">
                {detail.myPost.summary}
              </p>
            )}
            <div className="space-y-1 text-xs text-gray-500">
              <div>发布时间：{fmtDate(detail.myPost.publishedAt)}</div>
              {detail.myPost.originalSourceUrl && (
                <a
                  href={detail.myPost.originalSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sky-600 hover:text-sky-700"
                >
                  首发源链接
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-gray-200/50 dark:border-gray-700/50 grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-gray-500">阅读</div>
                <div className="text-sm font-semibold">{fmtNum(detail.myPost.totalViews)}</div>
              </div>
              <div>
                <div className="text-gray-500">点赞</div>
                <div className="text-sm font-semibold">{fmtNum(detail.myPost.totalLikes)}</div>
              </div>
              <div>
                <div className="text-gray-500">转发</div>
                <div className="text-sm font-semibold">{fmtNum(detail.myPost.totalShares)}</div>
              </div>
              <div>
                <div className="text-gray-500">评论</div>
                <div className="text-sm font-semibold">{fmtNum(detail.myPost.totalComments)}</div>
              </div>
            </div>
          </GlassCard>

          <GlassCard padding="md">
            <h3 className="text-xs font-medium text-gray-500 uppercase mb-2">
              多渠道发布 ({detail.distributions.length})
            </h3>
            <div className="space-y-2">
              {detail.distributions.map((d) => (
                <a
                  key={d.id}
                  href={d.publishedUrl ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-2 rounded bg-white/60 dark:bg-gray-800/60 hover:bg-white dark:hover:bg-gray-800 transition"
                  onClick={(e) => { if (!d.publishedUrl) e.preventDefault(); }}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {d.accountName}
                    </span>
                    <span className="text-gray-500">
                      {PLATFORM_LABEL[d.accountPlatform] ?? d.accountPlatform}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-500 mt-1">
                    <span>{fmtDate(d.publishedAt)}</span>
                    <span>{fmtNum(d.views)} 阅读</span>
                  </div>
                </a>
              ))}
            </div>
          </GlassCard>

          {detail.myPost.body && (
            <GlassCard padding="md">
              <h3 className="text-xs font-medium text-gray-500 uppercase mb-2">稿件正文</h3>
              <div className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-96 overflow-y-auto">
                {detail.myPost.body}
              </div>
            </GlassCard>
          )}
        </div>

        {/* 中栏：10 维分析 */}
        <div className="col-span-12 lg:col-span-5 space-y-3">
          <GlassCard padding="md">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              10 维度分析
            </h3>
            {analyzing ? (
              <AnalysisProgress
                phase={phase}
                matchCount={liveMatchCount}
                message={progressMsg}
              />
            ) : !analysis ? (
              <div className="text-center py-16 text-gray-500 dark:text-gray-400 text-sm">
                <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p>暂无 AI 分析</p>
                <p className="text-xs mt-2">点击右上角「生成 10 维分析」开始</p>
              </div>
            ) : (
              <>
                {radarData && radarData.length > 0 && (
                  <div className="mb-4">
                    <DimensionRadar data={radarData} height={260} />
                  </div>
                )}
                {analysis.overallScore !== undefined && (
                  <div className="mb-4 p-3 rounded-lg bg-gradient-to-r from-sky-50 to-indigo-50 dark:from-sky-950/40 dark:to-indigo-950/40">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-sky-700 dark:text-sky-300">
                        {Math.round(analysis.overallScore)}
                      </span>
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        综合评分
                      </span>
                    </div>
                    <p className="text-xs text-gray-700 dark:text-gray-300 mt-2 leading-relaxed">
                      {analysis.overallVerdict}
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  {DIMENSION_META.map(({ key, label }) => {
                    const dim = analysis[key];
                    if (!dim || typeof dim !== "object" || !("score" in dim)) return null;
                    return (
                      <DimensionCard
                        key={key}
                        label={label}
                        dimension={dim as {
                          score: number;
                          summary: string;
                          strengths: string[];
                          weaknesses: string[];
                          suggestions: string[];
                        }}
                      />
                    );
                  })}
                </div>

                {analysis.keyInsights && analysis.keyInsights.length > 0 && (
                  <div className="mt-4 p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/20">
                    <div className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-2">
                      关键洞察
                    </div>
                    <ul className="space-y-1 text-xs text-gray-700 dark:text-gray-300 list-disc list-inside">
                      {analysis.keyInsights.map((k, i) => (
                        <li key={i}>{k}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.coreImprovements && analysis.coreImprovements.length > 0 && (
                  <div className="mt-3 p-3 rounded-lg bg-sky-50/50 dark:bg-sky-950/20">
                    <div className="text-xs font-medium text-sky-800 dark:text-sky-300 mb-2">
                      核心改进建议
                    </div>
                    <ul className="space-y-1 text-xs text-gray-700 dark:text-gray-300 list-disc list-inside">
                      {analysis.coreImprovements.map((k, i) => (
                        <li key={i}>{k}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </GlassCard>
        </div>

        {/* 右栏：同题报道 */}
        <div className="col-span-12 lg:col-span-4">
          <GlassCard padding="md">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              同题报道 ({detail.benchmarkReports.length})
            </h3>
            {detail.benchmarkReports.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400 text-sm">
                <p>暂无同题报道</p>
                <p className="text-xs mt-2">点击「生成分析」触发同题检索</p>
              </div>
            ) : (
              <div className="space-y-4">
                {levelOrder.map((level) => {
                  const reports = groupedReports[level];
                  if (!reports || reports.length === 0) return null;
                  return (
                    <div key={level}>
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded ${LEVEL_COLOR[level]}`}
                        >
                          {LEVEL_LABEL[level]}
                        </span>
                        <span className="text-xs text-gray-500">{reports.length} 篇</span>
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
      </div>
    </div>
  );
}

function ReportItem({
  report,
}: {
  report: TopicCompareDetail["benchmarkReports"][number];
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-lg bg-white/60 dark:bg-gray-800/60 p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
          {report.accountName}
          <span className="ml-1 text-[10px] text-gray-500">
            · {PLATFORM_LABEL[report.accountPlatform] ?? report.accountPlatform}
          </span>
        </span>
        <span className="text-[10px] text-gray-400">
          相似度 {(report.similarityScore * 100).toFixed(0)}%
        </span>
      </div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="text-left w-full"
      >
        <div className="text-sm text-gray-900 dark:text-gray-100 leading-snug hover:text-sky-600">
          {report.title}
        </div>
      </button>
      {expanded && (
        <div className="mt-2 pt-2 border-t border-gray-200/50 dark:border-gray-700/50 space-y-1 text-xs">
          {report.summary && (
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              {report.summary}
            </p>
          )}
          {report.reason && (
            <p className="text-gray-500 italic">匹配原因：{report.reason}</p>
          )}
          <div className="flex items-center justify-between pt-1">
            <span className="text-gray-500">{fmtDate(report.publishedAt)}</span>
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
        </div>
      )}
    </div>
  );
}

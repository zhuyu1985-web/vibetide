"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { KPIComparisonBar } from "@/components/shared/kpi-comparison-bar";
import { RealTimeIndicator } from "@/components/shared/realtime-indicator";
import { AIScoreBadge } from "@/components/shared/ai-score-badge";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { HeatScoreBadge } from "@/components/shared/heat-score-badge";
import { TrendIndicator } from "@/components/shared/trend-indicator";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { HeatCurveChart } from "@/components/charts/heat-curve-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Zap,
  ChevronDown,
  ChevronUp,
  Eye,
  MessageSquare,
  Lightbulb,
  Users,
  Clock,
  Rocket,
  Newspaper,
  Video,
  Layout,
  Radio,
  ThumbsUp,
  Minus,
  ThumbsDown,
  FileText,
} from "lucide-react";
import type {
  InspirationTopic,
  PlatformMonitor,
  EditorialMeeting,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Topic Card Component
// ---------------------------------------------------------------------------
function TopicCard({
  topic,
  expanded,
  onToggle,
  compact = false,
}: {
  topic: InspirationTopic;
  expanded: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  const totalSentiment =
    topic.commentInsight.positive +
    topic.commentInsight.neutral +
    topic.commentInsight.negative;
  const posPercent = Math.round(
    (topic.commentInsight.positive / totalSentiment) * 100
  );
  const neuPercent = Math.round(
    (topic.commentInsight.neutral / totalSentiment) * 100
  );
  const negPercent = Math.round(
    (topic.commentInsight.negative / totalSentiment) * 100
  );

  // Compact row mode for P2
  if (compact) {
    return (
      <GlassCard variant="interactive" padding="sm" className="mb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <PriorityBadge priority={topic.priority} />
            <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
              {topic.title}
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <HeatScoreBadge score={topic.heatScore} />
            <TrendIndicator trend={topic.trend} />
            <span className="text-[10px] text-gray-400 dark:text-gray-500">{topic.source}</span>
            <div className="flex gap-1">
              {topic.platforms.slice(0, 3).map((p) => (
                <Badge
                  key={p}
                  variant="outline"
                  className="text-[9px] px-1 py-0"
                >
                  {p}
                </Badge>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={onToggle}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="pt-3 mt-3 border-t border-gray-100 dark:border-gray-700/50">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{topic.summary}</p>
                {topic.suggestedAngles.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <Lightbulb size={12} className="text-amber-500" />
                    {topic.suggestedAngles.map((angle, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="text-[10px] bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-200"
                      >
                        {angle}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    );
  }

  // Full card mode for P0 / P1
  return (
    <GlassCard variant="interactive" padding="none" className="overflow-hidden">
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <PriorityBadge priority={topic.priority} />
            <HeatScoreBadge score={topic.heatScore} />
            <TrendIndicator trend={topic.trend} />
          </div>
          <AIScoreBadge score={topic.aiScore} size={42} label="AI评分" />
        </div>
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-snug mb-1">
          {topic.title}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
          {topic.summary}
        </p>
        <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400 dark:text-gray-500">
          <Clock size={10} />
          <span>发现于 {topic.discoveredAt}</span>
          <span className="mx-1">|</span>
          <span>{topic.source}</span>
          <span className="mx-1">|</span>
          <span>{topic.category}</span>
        </div>
      </div>

      {/* Platform tags */}
      <div className="px-4 pb-2 flex items-center gap-1 flex-wrap">
        {topic.platforms.map((p) => (
          <Badge
            key={p}
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-5"
          >
            {p}
          </Badge>
        ))}
      </div>

      {/* Heat Curve */}
      <div className="px-4 pb-2">
        <div className="text-[10px] text-gray-400 dark:text-gray-500 mb-1 flex items-center gap-1">
          <Eye size={10} />
          热度曲线
        </div>
        <HeatCurveChart data={topic.heatCurve} height={80} />
      </div>

      {/* Toggle for details */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-2 flex items-center justify-center gap-1 text-xs text-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors border-t border-gray-100 dark:border-gray-700/50"
      >
        {expanded ? (
          <>
            收起详情 <ChevronUp size={14} />
          </>
        ) : (
          <>
            展开详情 <ChevronDown size={14} />
          </>
        )}
      </button>

      {/* Expandable details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-gray-100 dark:border-gray-700/50 pt-3">
              {/* Suggested Angles */}
              {topic.suggestedAngles.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    <Lightbulb size={12} className="text-amber-500" />
                    AI 建议切角
                  </div>
                  <div className="flex flex-col gap-1">
                    {topic.suggestedAngles.map((angle, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-amber-50/70 dark:bg-amber-950/50 border border-amber-100"
                      >
                        <span className="text-amber-600 dark:text-amber-400 text-[10px] font-bold shrink-0">
                          #{i + 1}
                        </span>
                        <span className="text-xs text-gray-700 dark:text-gray-300">{angle}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Competitor Response */}
              {topic.competitorResponse.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    <Users size={12} className="text-blue-500" />
                    竞品动态
                  </div>
                  <div className="flex flex-col gap-1">
                    {topic.competitorResponse.map((resp, i) => (
                      <div
                        key={i}
                        className="text-[11px] text-gray-600 dark:text-gray-400 px-2.5 py-1.5 rounded-md bg-blue-50/70 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-800/30"
                      >
                        {resp}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comment Insight */}
              <div>
                <div className="flex items-center gap-1 text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  <MessageSquare size={12} className="text-purple-500" />
                  舆情洞察
                </div>

                {/* Sentiment bar */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 flex h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-green-400 transition-all"
                      style={{ width: `${posPercent}%` }}
                    />
                    <div
                      className="bg-gray-300 transition-all"
                      style={{ width: `${neuPercent}%` }}
                    />
                    <div
                      className="bg-red-400 transition-all"
                      style={{ width: `${negPercent}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[10px] mb-2">
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <ThumbsUp size={10} /> 正面 {posPercent}%
                  </span>
                  <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                    <Minus size={10} /> 中性 {neuPercent}%
                  </span>
                  <span className="flex items-center gap-1 text-red-500">
                    <ThumbsDown size={10} /> 负面 {negPercent}%
                  </span>
                </div>

                {/* Hot comments */}
                {topic.commentInsight.hotComments.length > 0 && (
                  <div className="space-y-1">
                    {topic.commentInsight.hotComments.map((comment, i) => (
                      <div
                        key={i}
                        className="text-[11px] text-gray-600 dark:text-gray-400 pl-3 border-l-2 border-purple-200 py-0.5"
                      >
                        &ldquo;{comment}&rdquo;
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Related Assets */}
              {topic.relatedAssets.length > 0 && (
                <div>
                  <div className="flex items-center gap-1 text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    <FileText size={12} className="text-gray-500 dark:text-gray-400" />
                    关联素材
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {topic.relatedAssets.map((asset, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="text-[10px] bg-gray-50 dark:bg-gray-800/50"
                      >
                        {asset}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Output type icon helper
// ---------------------------------------------------------------------------
function OutputTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "图文":
      return <Newspaper size={12} />;
    case "短视频":
      return <Video size={12} />;
    case "H5专题":
      return <Layout size={12} />;
    case "直播":
      return <Radio size={12} />;
    default:
      return <FileText size={12} />;
  }
}

// ---------------------------------------------------------------------------
// Client Props
// ---------------------------------------------------------------------------
interface InspirationClientProps {
  topics: InspirationTopic[];
  monitors: PlatformMonitor[];
  meeting: EditorialMeeting;
}

// ---------------------------------------------------------------------------
// Main Client Component
// ---------------------------------------------------------------------------
export function InspirationClient({
  topics,
  monitors,
  meeting,
}: InspirationClientProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const p0Topics = topics.filter((t) => t.priority === "P0");
  const p1Topics = topics.filter((t) => t.priority === "P1");
  const p2Topics = topics.filter((t) => t.priority === "P2");

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Page Header */}
      <PageHeader
        title="灵感池"
        description="24小时全网热点雷达 · 5分钟编前会"
        actions={
          <div className="flex items-center gap-2">
            <EmployeeAvatar employeeId="xiaolei" size="xs" />
            <span className="text-xs text-gray-500 dark:text-gray-400">小雷 全网追踪中</span>
          </div>
        }
      />

      {/* KPI Comparison Bar */}
      <KPIComparisonBar
        items={[
          {
            label: "响应速度",
            before: "45min",
            after: "5min",
            improvement: "9x",
          },
          {
            label: "编前会",
            before: "1h",
            after: "5min",
            improvement: "12x",
          },
          {
            label: "选题精准度",
            before: "65%",
            after: "92%",
            improvement: "+27%",
          },
          {
            label: "漏题率",
            before: "30%",
            after: "~0%",
            improvement: "-30%",
          },
        ]}
      />

      {/* Real-time Indicator + Platform Monitor Bar */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <RealTimeIndicator label="平台" count={30} />
      </div>

      {/* Platform Monitor Horizontal Scroll */}
      <div className="mb-6 -mx-1">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 px-1 scrollbar-hide">
          {monitors.map((pm) => (
            <div
              key={pm.name}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/70 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-700/50 shadow-sm shrink-0"
            >
              <span className="text-sm">{pm.icon}</span>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {pm.name}
              </span>
              <span className="relative flex h-2 w-2">
                {pm.status === "online" ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </>
                ) : (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-gray-300" />
                )}
              </span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500">{pm.lastScan}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 5-Minute Editorial Meeting Summary */}
      <GlassCard variant="blue" padding="md" className="mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Zap size={16} className="text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-bold text-blue-800">
                5分钟编前会摘要
              </span>
              <Badge
                variant="outline"
                className="text-[10px] bg-blue-100/50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-700/50"
              >
                <Clock size={10} className="mr-1" />
                {meeting.generatedAt} AI 生成
              </Badge>
            </div>

            {/* Priority counts */}
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[10px] font-bold">
                  P0
                </span>
                <span className="text-sm font-bold text-red-700 dark:text-red-400">
                  {meeting.p0Count}
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">必追</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[10px] font-bold">
                  P1
                </span>
                <span className="text-sm font-bold text-blue-700 dark:text-blue-400">
                  {meeting.p1Count}
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">建议</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px] font-bold">
                  P2
                </span>
                <span className="text-sm font-bold text-gray-600 dark:text-gray-400">
                  {meeting.p2Count}
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">关注</span>
              </div>
            </div>

            {/* Output matrix */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium mr-1">
                产出矩阵:
              </span>
              {meeting.outputMatrix.map((item) => (
                <div
                  key={item.type}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/60 dark:bg-gray-900/60 border border-blue-100 dark:border-blue-800/30 text-xs"
                >
                  <OutputTypeIcon type={item.type} />
                  <span className="text-gray-700 dark:text-gray-300">{item.type}</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs shrink-0"
          >
            <Rocket size={14} className="mr-1" />
            一键启动全部追踪
          </Button>
        </div>
      </GlassCard>

      {/* ----------------------------------------------------------------- */}
      {/* P0 Section -- 3 column grid */}
      {/* ----------------------------------------------------------------- */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-bold">
            P0
          </span>
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
            必追热点
          </span>
          <Badge
            variant="outline"
            className="text-[10px] text-red-600 dark:text-red-400 border-red-200"
          >
            {p0Topics.length} 条
          </Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {p0Topics.map((topic) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              expanded={expandedId === topic.id}
              onToggle={() => toggleExpand(topic.id)}
            />
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* P1 Section -- 2 column grid */}
      {/* ----------------------------------------------------------------- */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold">
            P1
          </span>
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
            建议跟进
          </span>
          <Badge
            variant="outline"
            className="text-[10px] text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-700/50"
          >
            {p1Topics.length} 条
          </Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {p1Topics.map((topic) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              expanded={expandedId === topic.id}
              onToggle={() => toggleExpand(topic.id)}
            />
          ))}
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* P2 Section -- compact row mode */}
      {/* ----------------------------------------------------------------- */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-bold">
            P2
          </span>
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
            持续关注
          </span>
          <Badge
            variant="outline"
            className="text-[10px] text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700"
          >
            {p2Topics.length} 条
          </Badge>
        </div>
        <div className="flex flex-col">
          {p2Topics.map((topic) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              expanded={expandedId === topic.id}
              onToggle={() => toggleExpand(topic.id)}
              compact
            />
          ))}
        </div>
      </section>
    </div>
  );
}

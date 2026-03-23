"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
// KPIComparisonBar / RealTimeIndicator removed — stats inlined in toolbar
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
  ThumbsUp,
  Minus,
  ThumbsDown,
  FileText,
  RefreshCw,
  Radar,
  Tag,
  X,
} from "lucide-react";
import { triggerHotTopicCrawl, startTopicMission } from "@/app/actions/hot-topics";
import type {
  InspirationTopic,
  PlatformMonitor,
  EditorialMeeting,
  UserTopicSubscription,
  CalendarEvent,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Platform styling map — color classes for each platform
// ---------------------------------------------------------------------------
const PLATFORM_STYLE: Record<string, { bg: string; text: string; icon: string }> = {
  微博: { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-600 dark:text-orange-400", icon: "📱" },
  知乎: { bg: "bg-sky-50 dark:bg-sky-950/30", text: "text-sky-600 dark:text-sky-400", icon: "💡" },
  百度: { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-600 dark:text-blue-400", icon: "🔍" },
  抖音: { bg: "bg-pink-50 dark:bg-pink-950/30", text: "text-pink-600 dark:text-pink-400", icon: "🎵" },
  今日头条: { bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-600 dark:text-red-400", icon: "📰" },
  "36氪": { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-600 dark:text-emerald-400", icon: "📊" },
  哔哩哔哩: { bg: "bg-cyan-50 dark:bg-cyan-950/30", text: "text-cyan-600 dark:text-cyan-400", icon: "📺" },
  小红书: { bg: "bg-rose-50 dark:bg-rose-950/30", text: "text-rose-600 dark:text-rose-400", icon: "📕" },
  澎湃: { bg: "bg-indigo-50 dark:bg-indigo-950/30", text: "text-indigo-600 dark:text-indigo-400", icon: "📰" },
  微信: { bg: "bg-green-50 dark:bg-green-950/30", text: "text-green-600 dark:text-green-400", icon: "💬" },
};

/** Get platform display name (strip 热搜/热榜/热点/热文 suffix) */
function getPlatformShort(name: string): string {
  return name.replace(/(热搜|热榜|热点|热文)$/, "");
}

/** Get platform styling by matching short name */
function getPlatformStyle(name: string) {
  const short = getPlatformShort(name);
  return PLATFORM_STYLE[short] || { bg: "bg-gray-50 dark:bg-gray-800/50", text: "text-gray-600 dark:text-gray-400", icon: "📡" };
}

/** Styled platform badge component */
function PlatformTag({ name, size = "sm" }: { name: string; size?: "xs" | "sm" }) {
  const style = getPlatformStyle(name);
  const short = getPlatformShort(name);
  const isXs = size === "xs";
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full ${style.bg} ${style.text} ${isXs ? "px-1.5 py-0 text-[9px]" : "px-2 py-0.5 text-[10px]"} font-medium`}>
      <span className={isXs ? "text-[8px]" : "text-[10px]"}>{style.icon}</span>
      {short}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Category styling
// ---------------------------------------------------------------------------
/** Standard news categories — only these are valid */
const VALID_CATEGORIES = ["要闻", "国际", "军事", "体育", "娱乐", "财经", "科技", "社会", "健康", "教育", "时政"] as const;
const VALID_CATEGORY_SET = new Set<string>(VALID_CATEGORIES);

const CATEGORY_STYLE: Record<string, { bg: string; text: string }> = {
  要闻: { bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-600 dark:text-red-400" },
  国际: { bg: "bg-sky-50 dark:bg-sky-950/30", text: "text-sky-600 dark:text-sky-400" },
  军事: { bg: "bg-slate-100 dark:bg-slate-900/40", text: "text-slate-600 dark:text-slate-400" },
  体育: { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-600 dark:text-emerald-400" },
  娱乐: { bg: "bg-pink-50 dark:bg-pink-950/30", text: "text-pink-600 dark:text-pink-400" },
  财经: { bg: "bg-amber-50 dark:bg-amber-950/30", text: "text-amber-600 dark:text-amber-400" },
  科技: { bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-600 dark:text-violet-400" },
  社会: { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-600 dark:text-blue-400" },
  健康: { bg: "bg-teal-50 dark:bg-teal-950/30", text: "text-teal-600 dark:text-teal-400" },
  教育: { bg: "bg-indigo-50 dark:bg-indigo-950/30", text: "text-indigo-600 dark:text-indigo-400" },
  时政: { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-600 dark:text-orange-400" },
};

/** Normalize category: return valid category or empty string */
function normalizeCategory(raw: string | undefined | null): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (VALID_CATEGORY_SET.has(trimmed)) return trimmed;
  return "";
}

function getCategoryStyle(name: string) {
  return CATEGORY_STYLE[name] || { bg: "bg-gray-50 dark:bg-gray-800/50", text: "text-gray-500 dark:text-gray-400" };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Truncate text to a max character count */
function truncTitle(text: string, max: number) {
  if (text.length <= max) return text;
  return text.slice(0, max) + "…";
}

// ---------------------------------------------------------------------------
// Topic Card Component
// ---------------------------------------------------------------------------
function TopicCard({
  topic,
  expanded,
  onToggle,
  onStartMission,
  isMissionPending,
  isTracked = false,
  compact = false,
}: {
  topic: InspirationTopic;
  expanded: boolean;
  onToggle: () => void;
  onStartMission: (topicId: string) => void;
  isMissionPending: boolean;
  isTracked?: boolean;
  compact?: boolean;
}) {
  const totalSentiment =
    topic.commentInsight.positive +
    topic.commentInsight.neutral +
    topic.commentInsight.negative;
  const posPercent = totalSentiment > 0 ? Math.round(
    (topic.commentInsight.positive / totalSentiment) * 100
  ) : 0;
  const neuPercent = totalSentiment > 0 ? Math.round(
    (topic.commentInsight.neutral / totalSentiment) * 100
  ) : 0;
  const negPercent = totalSentiment > 0 ? Math.round(
    (topic.commentInsight.negative / totalSentiment) * 100
  ) : 0;

  // Compact row mode for P2
  if (compact) {
    return (
      <div className="rounded-xl bg-white/70 dark:bg-gray-900/60 border border-gray-200/60 dark:border-gray-700/40 mb-1.5 hover:bg-white dark:hover:bg-gray-800/60 transition-colors overflow-hidden">
        <div
          className="flex items-center gap-3 px-4 py-2.5 cursor-pointer"
          onClick={onToggle}
        >
          <PriorityBadge priority={topic.priority} />
          <span className="text-sm text-gray-800 dark:text-gray-100 truncate flex-1 min-w-0">
            {truncTitle(topic.title, 50)}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <HeatScoreBadge score={topic.heatScore} />
            {normalizeCategory(topic.category) && (
              <span className={`inline-flex items-center px-1.5 py-0 rounded-full text-[9px] font-medium ${getCategoryStyle(normalizeCategory(topic.category)).bg} ${getCategoryStyle(normalizeCategory(topic.category)).text}`}>
                {normalizeCategory(topic.category)}
              </span>
            )}
            {topic.platforms.slice(0, 2).map((p) => (
              <PlatformTag key={p} name={p} size="xs" />
            ))}
            {topic.platforms.length > 2 && (
              <span className="text-[9px] text-gray-400">+{topic.platforms.length - 2}</span>
            )}
            <ChevronDown
              size={12}
              className={`text-gray-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            />
          </div>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-3 pt-1 border-t border-gray-100 dark:border-gray-700/50 space-y-2">
                {/* Full title */}
                {topic.title.length > 50 && (
                  <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{topic.title}</p>
                )}
                {/* Summary */}
                {topic.summary && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{topic.summary}</p>
                )}
                {/* Suggested Angles */}
                {topic.suggestedAngles.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <Lightbulb size={10} className="text-amber-500 shrink-0" />
                    {topic.suggestedAngles.map((angle, i) => (
                      <span key={i} className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 rounded">
                        {angle}
                      </span>
                    ))}
                  </div>
                )}
                {/* Platform tags + action */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {topic.platforms.map((p) => (
                      <PlatformTag key={p} name={p} size="xs" />
                    ))}
                  </div>
                  {isTracked ? (
                    <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-medium bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400">
                      <Eye size={10} />
                      已追踪
                    </span>
                  ) : (
                    <span
                      role="button"
                      tabIndex={0}
                      className="inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors cursor-pointer select-none"
                      onClick={(e) => { e.stopPropagation(); if (!isMissionPending) onStartMission(topic.id); }}
                    >
                      <Rocket size={10} />
                      {isMissionPending ? "创建中..." : "追踪"}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Full card mode for P0 / P1
  return (
    <div className="rounded-2xl bg-white/80 dark:bg-gray-900/70 border border-gray-200/70 dark:border-gray-700/50 shadow-sm overflow-hidden hover:shadow-md hover:border-gray-300/80 dark:hover:border-gray-600/60 transition-all duration-200 cursor-pointer" onClick={onToggle}>
      {/* Header area */}
      <div className="p-4 pb-3">
        {/* Top row: badges + AI score */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <PriorityBadge priority={topic.priority} />
            <HeatScoreBadge score={topic.heatScore} />
            <TrendIndicator trend={topic.trend} />
            {normalizeCategory(topic.category) && (
              <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${getCategoryStyle(normalizeCategory(topic.category)).bg} ${getCategoryStyle(normalizeCategory(topic.category)).text}`}>
                <Tag size={8} />
                {normalizeCategory(topic.category)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <AIScoreBadge score={topic.aiScore} size={36} label="AI" />
            <ChevronDown
              size={14}
              className={`text-gray-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            />
          </div>
        </div>

        {/* Title — hard-truncated */}
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-snug mb-1.5">
          {truncTitle(topic.title, 80)}
        </h3>

        {/* Summary */}
        {topic.summary && (
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2 mb-2">
            {truncTitle(topic.summary, 120)}
          </p>
        )}

        {/* Platform tags row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {topic.platforms.map((p) => (
              <PlatformTag key={p} name={p} />
            ))}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-gray-400 shrink-0">
            <Clock size={10} />
            <span>{topic.discoveredAt}</span>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="px-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {topic.suggestedAngles.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
              <Lightbulb size={10} />
              {topic.suggestedAngles.length} 个切角建议
            </span>
          )}
        </div>
        {isTracked ? (
          <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[10px] font-medium bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 shrink-0">
            <Eye size={10} />
            已追踪
          </span>
        ) : (
          <span
            role="button"
            tabIndex={0}
            className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[10px] font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors cursor-pointer shrink-0 select-none"
            onClick={(e) => { e.stopPropagation(); if (!isMissionPending) onStartMission(topic.id); }}
          >
            <Rocket size={10} />
            {isMissionPending ? "创建中..." : "启动追踪"}
          </span>
        )}
      </div>

      {/* Inline expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden border-t border-gray-100 dark:border-gray-700/50"
          >
            <div className="p-4 space-y-3">
              {/* Full title if truncated */}
              {topic.title.length > 80 && (
                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                  {topic.title}
                </p>
              )}

              {/* AI Suggested Angles */}
              {topic.suggestedAngles.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/40 dark:border-amber-800/30">
                  <div className="flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2">
                    <Lightbulb size={12} />
                    AI 建议切角
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {topic.suggestedAngles.map((angle, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                        <span className="text-amber-500 font-bold text-[10px]">#{i + 1}</span>
                        {angle}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Heat Curve */}
              {topic.heatCurve.length >= 2 && (
                <div className="p-3 rounded-lg bg-gray-50/80 dark:bg-gray-800/40">
                  <div className="text-[10px] text-gray-500 mb-1.5 flex items-center gap-1">
                    <Eye size={10} /> 热度曲线
                  </div>
                  <HeatCurveChart data={topic.heatCurve} height={80} />
                </div>
              )}

              {/* Sentiment */}
              {totalSentiment > 0 && (
                <div className="p-3 rounded-lg bg-gray-50/80 dark:bg-gray-800/40">
                  <div className="flex items-center gap-1 text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    <MessageSquare size={12} className="text-purple-500" />
                    舆情洞察
                  </div>
                  <div className="flex h-2 rounded-full overflow-hidden mb-1.5">
                    <div className="bg-green-500" style={{ width: `${posPercent}%` }} />
                    <div className="bg-gray-400" style={{ width: `${neuPercent}%` }} />
                    <div className="bg-red-500" style={{ width: `${negPercent}%` }} />
                  </div>
                  <div className="flex items-center gap-3 text-[10px]">
                    <span className="text-green-600 dark:text-green-400"><ThumbsUp size={10} className="inline mr-0.5" />正面 {posPercent}%</span>
                    <span className="text-gray-500"><Minus size={10} className="inline mr-0.5" />中性 {neuPercent}%</span>
                    <span className="text-red-600 dark:text-red-400"><ThumbsDown size={10} className="inline mr-0.5" />负面 {negPercent}%</span>
                  </div>
                </div>
              )}

              {/* Competitor Response */}
              {topic.competitorResponse.length > 0 && (
                <div className="p-3 rounded-lg bg-gray-50/80 dark:bg-gray-800/40">
                  <div className="flex items-center gap-1 text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    <Users size={12} className="text-blue-400" /> 竞品动态
                  </div>
                  {topic.competitorResponse.map((resp, i) => (
                    <div key={i} className="text-[11px] text-gray-600 dark:text-gray-400 mb-1">{resp}</div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Client Props
// ---------------------------------------------------------------------------
interface InspirationClientProps {
  topics: InspirationTopic[];
  monitors: PlatformMonitor[];
  meeting: EditorialMeeting;
  subscriptions?: UserTopicSubscription | null;
  calendarEvents?: CalendarEvent[];
  lastViewedAt?: string;
}

// ---------------------------------------------------------------------------
// Main Client Component
// ---------------------------------------------------------------------------
export function InspirationClient({
  topics,
  monitors,
  meeting,
}: InspirationClientProps) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [p0Limit, setP0Limit] = useState(6);
  const [p1Limit, setP1Limit] = useState(4);
  const [p2Limit, setP2Limit] = useState(8);
  const [isRefreshing, startRefreshTransition] = useTransition();
  const [isTracking, startTrackingTransition] = useTransition();
  const [missionPendingId, setMissionPendingId] = useState<string | null>(null);
  const [trackedIds, setTrackedIds] = useState<Set<string>>(new Set());
  const [lastUpdated, setLastUpdated] = useState("");

  // Set initial time on client only (avoid hydration mismatch)
  useEffect(() => {
    setLastUpdated(
      new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    );
    const interval = setInterval(() => {
      router.refresh();
      setLastUpdated(
        new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
      );
    }, 60000);
    return () => clearInterval(interval);
  }, [router]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleRefresh = () => {
    startRefreshTransition(async () => {
      await triggerHotTopicCrawl();
      router.refresh();
      setLastUpdated(
        new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
      );
    });
  };

  const handleTrackAll = () => {
    startTrackingTransition(async () => {
      const p0Ids = topics.filter((t) => t.priority === "P0").map((t) => t.id);
      for (const id of p0Ids) {
        await startTopicMission(id);
      }
      router.refresh();
    });
  };

  const handleStartMission = (topicId: string) => {
    setMissionPendingId(topicId);
    startTrackingTransition(async () => {
      try {
        await startTopicMission(topicId);
        setTrackedIds((prev) => new Set(prev).add(topicId));
        router.refresh();
      } finally {
        setMissionPendingId(null);
      }
    });
  };

  // Collect valid categories present in data for filter pills
  const allCategories = useMemo(() => {
    const catMap = new Map<string, number>();
    for (const t of topics) {
      const cat = normalizeCategory(t.category);
      if (cat) catMap.set(cat, (catMap.get(cat) || 0) + 1);
    }
    // Show in predefined order, only categories that have topics
    return VALID_CATEGORIES
      .filter((c) => catMap.has(c))
      .map((name) => ({ name, count: catMap.get(name)! }));
  }, [topics]);

  // Apply platform + category filter
  const filteredTopics = topics.filter((t) => {
    if (platformFilter && !t.platforms.some((p) => p.includes(platformFilter))) return false;
    if (categoryFilter && normalizeCategory(t.category) !== categoryFilter) return false;
    return true;
  });

  const p0Topics = filteredTopics.filter((t) => t.priority === "P0");
  const p1Topics = filteredTopics.filter((t) => t.priority === "P1");
  const p2Topics = filteredTopics.filter((t) => t.priority === "P2");

  // Empty state
  if (topics.length === 0) {
    return (
      <div className="max-w-[1400px] mx-auto">
        <PageHeader
          title="灵感池"
          description="24小时全网热点雷达 · 5分钟编前会"
          actions={
            <div className="flex items-center gap-2">
              <EmployeeAvatar employeeId="xiaolei" size="xs" />
              <span className="text-xs text-gray-500 dark:text-gray-400">小雷 待命中</span>
            </div>
          }
        />
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
            <Radar size={32} className="text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            暂无热点数据
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            点击下方按钮从全网 10 个平台获取最新热点
          </p>
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin mr-2" : "mr-2"} />
            {isRefreshing ? "正在抓取..." : "刷新热点"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Page Header */}
      <PageHeader
        title="灵感池"
        description="24小时全网热点雷达 · 5分钟编前会"
        actions={
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              上次更新: {lastUpdated}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-7 text-xs px-2"
            >
              <RefreshCw size={12} className={isRefreshing ? "animate-spin mr-1" : "mr-1"} />
              {isRefreshing ? "抓取中..." : "刷新热点"}
            </Button>
            <EmployeeAvatar employeeId="xiaolei" size="xs" />
            <span className="text-xs text-gray-500 dark:text-gray-400">小雷 全网追踪中</span>
          </div>
        }
      />

      {/* Stats bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          话题 <span className="font-bold text-gray-800 dark:text-gray-100">{topics.length}</span>
        </div>
        <span className="text-gray-200 dark:text-gray-700">|</span>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          <span className="text-gray-500">P0</span>
          <span className="font-bold text-red-600 dark:text-red-400">{meeting.p0Count}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          <span className="text-gray-500">P1</span>
          <span className="font-bold text-blue-600 dark:text-blue-400">{meeting.p1Count}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
          <span className="text-gray-500">P2</span>
          <span className="font-bold text-gray-600 dark:text-gray-300">{meeting.p2Count}</span>
        </div>
      </div>

      {/* Editorial Briefing — real data summary */}
      <GlassCard variant="blue" padding="md" className="mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={16} className="text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-bold text-blue-800 dark:text-blue-200">
                编前会速览
              </span>
              <Badge
                variant="outline"
                className="text-[10px] bg-blue-100/50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-700/50"
              >
                <Clock size={10} className="mr-1" />
                {meeting.generatedAt} 更新
              </Badge>
            </div>

            {/* AI Summary */}
            <div className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed mb-3 space-y-1">
              {meeting.aiSummary.split("\n").map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>

            {/* Category distribution */}
            {meeting.topCategories.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                  话题分布:
                </span>
                {meeting.topCategories.map((cat) => (
                  <div
                    key={cat.name}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/60 dark:bg-gray-900/60 border border-blue-100 dark:border-blue-800/30 text-xs"
                  >
                    <span className="text-gray-700 dark:text-gray-300">{cat.name}</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {cat.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs shrink-0"
            onClick={handleTrackAll}
            disabled={isTracking || p0Topics.length === 0}
          >
            <Rocket size={14} className="mr-1" />
            {isTracking ? "启动中..." : "一键启动全部追踪"}
          </Button>
        </div>
      </GlassCard>

      {/* ── Inline Filter Strip (shared by P0 & P1) ── */}
      <div className="mb-5 space-y-2">
        {/* Platform filter row */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          <span className="text-[11px] text-gray-400 shrink-0 mr-1">平台</span>
          <button
            onClick={() => setPlatformFilter(null)}
            className={`inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-medium shrink-0 transition-all ${
              !platformFilter
                ? "bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900"
                : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            全部
          </button>
          {monitors.map((pm) => {
            const isActive = platformFilter === pm.name;
            const pStyle = getPlatformStyle(pm.name);
            return (
              <button
                key={pm.name}
                onClick={() => setPlatformFilter(isActive ? null : pm.name)}
                className={`relative inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium shrink-0 transition-all duration-200 ${
                  isActive
                    ? `${pStyle.bg} ${pStyle.text} shadow-sm`
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                {isActive && (
                  <span className="absolute inset-0 rounded-lg border-2 border-current opacity-60 animate-[filter-ping_1.5s_ease-out_1]" />
                )}
                {pm.name}
              </button>
            );
          })}
        </div>
        {/* Category filter row */}
        {allCategories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
            <span className="text-[11px] text-gray-400 shrink-0 mr-1">分类</span>
            <button
              onClick={() => setCategoryFilter(null)}
              className={`inline-flex items-center px-2 py-1 rounded-lg text-[11px] font-medium shrink-0 transition-all ${
                !categoryFilter
                  ? "bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900"
                  : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              全部
            </button>
            {allCategories.map((cat) => {
              const isActive = categoryFilter === cat.name;
              const style = getCategoryStyle(cat.name);
              return (
                <button
                  key={cat.name}
                  onClick={() => setCategoryFilter(isActive ? null : cat.name)}
                  className={`relative inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium shrink-0 transition-all duration-200 ${
                    isActive
                      ? `${style.bg} ${style.text} shadow-sm`
                      : `${style.text} opacity-60 hover:opacity-100`
                  }`}
                >
                  {isActive && (
                    <span className="absolute inset-0 rounded-lg border-2 border-current opacity-60 animate-[filter-ping_1.5s_ease-out_1]" />
                  )}
                  {cat.name}
                  <span className="text-[10px] opacity-50">{cat.count}</span>
                </button>
              );
            })}
          </div>
        )}
        {/* Active filter summary */}
        {(platformFilter || categoryFilter) && (
          <div className="flex items-center gap-2 text-[11px] text-gray-400">
            <span>筛选后 <span className="font-bold text-gray-700 dark:text-gray-200">{filteredTopics.length}</span> 条</span>
            <button
              onClick={() => { setPlatformFilter(null); setCategoryFilter(null); }}
              className="text-blue-500 hover:text-blue-700"
            >
              清除筛选
            </button>
          </div>
        )}
      </div>

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
          <span className="text-[11px] text-red-500 dark:text-red-400 font-medium">
            {p0Topics.length} 条
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {p0Topics.slice(0, p0Limit).map((topic) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              expanded={expandedId === topic.id}
              onToggle={() => toggleExpand(topic.id)}
              onStartMission={handleStartMission}
              isMissionPending={missionPendingId === topic.id}
              isTracked={trackedIds.has(topic.id)}
            />
          ))}
        </div>
        {p0Topics.length > p0Limit && (
          <div className="flex justify-center mt-4">
            <Button variant="ghost" size="sm" className="text-xs text-gray-500" onClick={() => setP0Limit((l) => l + 9)}>
              展开更多（剩余 {p0Topics.length - p0Limit} 条）
            </Button>
          </div>
        )}
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
          <span className="text-[11px] text-blue-500 dark:text-blue-400 font-medium">
            {p1Topics.length} 条
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {p1Topics.slice(0, p1Limit).map((topic) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              expanded={expandedId === topic.id}
              onToggle={() => toggleExpand(topic.id)}
              onStartMission={handleStartMission}
              isMissionPending={missionPendingId === topic.id}
              isTracked={trackedIds.has(topic.id)}
            />
          ))}
        </div>
        {p1Topics.length > p1Limit && (
          <div className="flex justify-center mt-4">
            <Button variant="ghost" size="sm" className="text-xs text-gray-500" onClick={() => setP1Limit((l) => l + 6)}>
              展开更多（剩余 {p1Topics.length - p1Limit} 条）
            </Button>
          </div>
        )}
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
          <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">
            {p2Topics.length} 条
          </span>
        </div>
        <div className="flex flex-col">
          {p2Topics.slice(0, p2Limit).map((topic) => (
            <TopicCard
              key={topic.id}
              topic={topic}
              expanded={expandedId === topic.id}
              onToggle={() => toggleExpand(topic.id)}
              onStartMission={handleStartMission}
              isMissionPending={missionPendingId === topic.id}
              isTracked={trackedIds.has(topic.id)}
              compact
            />
          ))}
        </div>
        {p2Topics.length > p2Limit && (
          <div className="flex justify-center mt-4">
            <Button variant="ghost" size="sm" className="text-xs text-gray-500" onClick={() => setP2Limit((l) => l + 10)}>
              展开更多（剩余 {p2Topics.length - p2Limit} 条）
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

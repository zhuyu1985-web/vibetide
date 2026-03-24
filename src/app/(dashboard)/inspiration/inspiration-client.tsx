"use client";

import { useState, useEffect, useTransition, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { GlassCard } from "@/components/shared/glass-card";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { HeatScoreBadge } from "@/components/shared/heat-score-badge";
import { TrendIndicator } from "@/components/shared/trend-indicator";
import { AIScoreBadge } from "@/components/shared/ai-score-badge";
import { HeatCurveChart } from "@/components/charts/heat-curve-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Zap,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Eye,
  EyeOff,
  MessageSquare,
  Lightbulb,
  Users,
  Clock,
  Rocket,
  ThumbsUp,
  Minus,
  ThumbsDown,
  FileText,
  RefreshCw,
  Radar,
  Tag,
  Settings,
  ArrowUp,
  Calendar,
  CalendarPlus,
  Check,
  X,
  BarChart3,
  Database,
  Star,
} from "lucide-react";
import { triggerHotTopicCrawl, startTopicMission } from "@/app/actions/hot-topics";
import { markAsReadAction, markAllAsReadAction } from "@/app/actions/topic-reads";
import { updateSubscriptionsAction } from "@/app/actions/topic-subscriptions";
import {
  createCalendarEventAction,
  confirmCalendarEventAction,
  rejectCalendarEventAction,
} from "@/app/actions/calendar-events";
import { cn } from "@/lib/utils";
import type {
  InspirationTopic,
  PlatformMonitor,
  EditorialMeeting,
  UserTopicSubscription,
  CalendarEvent,
} from "@/lib/types";

// ========================
// Types & Constants
// ========================

interface InspirationClientProps {
  topics: InspirationTopic[];
  monitors: PlatformMonitor[];
  meeting: EditorialMeeting;
  subscriptions?: UserTopicSubscription | null;
  calendarEvents?: CalendarEvent[];
  lastViewedAt?: string;
}

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

const EVENT_TYPE_LABELS: Record<string, string> = {
  festival: "节日",
  competition: "赛事",
  conference: "会议",
  exhibition: "展览",
  launch: "发布会",
  memorial: "纪念日",
};

const EVENT_TYPE_EMOJI: Record<string, string> = {
  festival: "🎉",
  competition: "🏆",
  conference: "🎤",
  exhibition: "🎨",
  launch: "🚀",
  memorial: "🕯️",
};

function getPlatformShort(name: string): string {
  return name.replace(/(热搜|热榜|热点|热文)$/, "");
}

function getPlatformStyle(name: string) {
  const short = getPlatformShort(name);
  return PLATFORM_STYLE[short] || { bg: "bg-gray-50 dark:bg-gray-800/50", text: "text-gray-600 dark:text-gray-400", icon: "📡" };
}

function normalizeCategory(raw: string | undefined | null): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (VALID_CATEGORY_SET.has(trimmed)) return trimmed;
  return "";
}

function getCategoryStyle(name: string) {
  return CATEGORY_STYLE[name] || { bg: "bg-gray-50 dark:bg-gray-800/50", text: "text-gray-500 dark:text-gray-400" };
}

function truncText(text: string, max: number) {
  if (text.length <= max) return text;
  return text.slice(0, max) + "...";
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  if (diff < 0) return "刚刚";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function PlatformTag({ name, size = "sm" }: { name: string; size?: "xs" | "sm" }) {
  const style = getPlatformStyle(name);
  const short = getPlatformShort(name);
  const isXs = size === "xs";
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full font-medium", style.bg, style.text, isXs ? "px-1.5 py-0 text-[11px]" : "px-2 py-0.5 text-[11px]")}>
      <span className={isXs ? "text-[8px]" : "text-[11px]"}>{style.icon}</span>
      {short}
    </span>
  );
}

// ========================
// Main Component
// ========================

export function InspirationClient({
  topics,
  monitors,
  meeting,
  subscriptions,
  calendarEvents = [],
  lastViewedAt,
}: InspirationClientProps) {
  const router = useRouter();

  // Core state
  const [activeTab, setActiveTab] = useState<"subscribed" | "all" | "calendar">("all");
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [localTopics, setLocalTopics] = useState(topics);
  const [localReadIds, setLocalReadIds] = useState<Set<string>>(
    new Set(topics.filter((t) => t.isRead).map((t) => t.id))
  );
  const [newTopicCount, setNewTopicCount] = useState(0);
  const [summaryCollapsed, setSummaryCollapsed] = useState(false);

  // Filter state
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Dialog/Sheet state
  const [showSubscriptionSheet, setShowSubscriptionSheet] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(!subscriptions);
  const [showCalendarSheet, setShowCalendarSheet] = useState(false);

  // Mission state
  const [, startTrackingTransition] = useTransition();
  const [missionPendingId, setMissionPendingId] = useState<string | null>(null);
  const [trackedIds, setTrackedIds] = useState<Set<string>>(
    new Set(topics.filter((t) => t.missionId).map((t) => t.id))
  );
  const [isTrackingAll, startTrackingAllTransition] = useTransition();

  // Subscription state (local copy for editing)
  const [localSubCategories, setLocalSubCategories] = useState<Set<string>>(
    new Set(subscriptions?.subscribedCategories ?? [])
  );
  const [localSubEventTypes, setLocalSubEventTypes] = useState<Set<string>>(
    new Set(subscriptions?.subscribedEventTypes ?? [])
  );

  // Refresh state
  const [isRefreshing, startRefreshTransition] = useTransition();
  const pageLoadTimeRef = useRef(new Date().toISOString());

  // Sync topics from props
  useEffect(() => {
    setLocalTopics(topics);
    setLocalReadIds(new Set(topics.filter((t) => t.isRead).map((t) => t.id)));
    setTrackedIds(new Set(topics.filter((t) => t.missionId).map((t) => t.id)));
  }, [topics]);

  // ========================
  // Polling for new topics
  // ========================
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    function startPolling() {
      interval = setInterval(async () => {
        if (document.hidden) return;
        try {
          const res = await fetch(
            `/api/inspiration/new-topics?since=${encodeURIComponent(pageLoadTimeRef.current)}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data.count > 0) {
              setNewTopicCount(data.count);
            }
          }
        } catch {
          // Silently fail
        }
      }, 60000);
    }

    startPolling();

    function handleVisibility() {
      if (document.hidden) {
        if (interval) clearInterval(interval);
        interval = null;
      } else {
        if (!interval) startPolling();
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // ========================
  // Computed data
  // ========================

  const subscribedCategories = useMemo(
    () => new Set(subscriptions?.subscribedCategories ?? []),
    [subscriptions]
  );

  // Compute priority counts and category stats for filter chips
  const baseTopics = useMemo(() => {
    return activeTab === "subscribed"
      ? localTopics.filter((t) => subscribedCategories.has(normalizeCategory(t.category)))
      : localTopics;
  }, [localTopics, activeTab, subscribedCategories]);

  const priorityStats = useMemo(() => {
    const counts: Record<string, number> = { P0: 0, P1: 0, P2: 0 };
    for (const t of baseTopics) counts[t.priority] = (counts[t.priority] || 0) + 1;
    return [
      { key: "P0", label: "P0 必追", count: counts.P0, color: "bg-red-600 text-white", inactiveColor: "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400" },
      { key: "P1", label: "P1 建议", count: counts.P1, color: "bg-orange-500 text-white", inactiveColor: "bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400" },
      { key: "P2", label: "P2 关注", count: counts.P2, color: "bg-gray-600 text-white dark:bg-gray-500", inactiveColor: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
    ].filter((p) => p.count > 0);
  }, [baseTopics]);

  const categoryStats = useMemo(() => {
    const counts = new Map<string, number>();
    let uncategorized = 0;
    for (const t of baseTopics) {
      const cat = normalizeCategory(t.category);
      if (cat) {
        counts.set(cat, (counts.get(cat) || 0) + 1);
      } else {
        uncategorized++;
      }
    }
    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
    if (uncategorized > 0) {
      sorted.push({ name: "未分类", count: uncategorized });
    }
    return sorted;
  }, [baseTopics]);

  const filteredTopics = useMemo(() => {
    let result = baseTopics;
    // Apply priority filter
    if (selectedPriority) {
      result = result.filter((t) => t.priority === selectedPriority);
    }
    // Apply category filter
    if (selectedCategory) {
      if (selectedCategory === "未分类") {
        result = result.filter((t) => !normalizeCategory(t.category));
      } else {
        result = result.filter((t) => normalizeCategory(t.category) === selectedCategory);
      }
    }
    // Sort: priority > subscribed-first (in "all" tab) > heatScore desc
    const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2 };
    return [...result].sort((a, b) => {
      const pa = priorityOrder[a.priority] ?? 3;
      const pb = priorityOrder[b.priority] ?? 3;
      if (pa !== pb) return pa - pb;
      if (activeTab === "all") {
        const aSub = subscribedCategories.has(normalizeCategory(a.category)) ? 0 : 1;
        const bSub = subscribedCategories.has(normalizeCategory(b.category)) ? 0 : 1;
        if (aSub !== bSub) return aSub - bSub;
      }
      return b.heatScore - a.heatScore;
    });
  }, [baseTopics, activeTab, subscribedCategories, selectedPriority, selectedCategory]);

  // Unread counts per tab
  const unreadSubscribed = useMemo(() => {
    return localTopics.filter(
      (t) => subscribedCategories.has(normalizeCategory(t.category)) && !localReadIds.has(t.id)
    ).length;
  }, [localTopics, subscribedCategories, localReadIds]);

  const unreadAll = useMemo(() => {
    return localTopics.filter((t) => !localReadIds.has(t.id)).length;
  }, [localTopics, localReadIds]);

  const calendarEventCount = calendarEvents.length;

  // Timeline divider index: first topic discovered before lastViewedAt
  const timelineDividerIndex = useMemo(() => {
    if (!lastViewedAt) return -1;
    const lvDate = new Date(lastViewedAt).getTime();
    return filteredTopics.findIndex((t) => new Date(t.discoveredAt).getTime() < lvDate);
  }, [filteredTopics, lastViewedAt]);

  const selectedTopic = useMemo(
    () => localTopics.find((t) => t.id === selectedTopicId) ?? null,
    [localTopics, selectedTopicId]
  );

  // ========================
  // Actions
  // ========================

  const handleSelectTopic = useCallback(
    (topicId: string) => {
      // Toggle: click same topic to collapse, or click empty string to collapse
      if (!topicId || topicId === selectedTopicId) {
        setSelectedTopicId(null);
        return;
      }
      setSelectedTopicId(topicId);
      // Mark as read optimistically
      if (!localReadIds.has(topicId)) {
        setLocalReadIds((prev) => {
          const next = new Set(prev);
          next.add(topicId);
          return next;
        });
        markAsReadAction([topicId]).catch(() => {
          setLocalReadIds((prev) => {
            const next = new Set(prev);
            next.delete(topicId);
            return next;
          });
        });
      }
    },
    [localReadIds, selectedTopicId]
  );

  const handleMarkAllRead = useCallback(() => {
    const visibleIds = filteredTopics.map((t) => t.id);
    setLocalReadIds((prev) => {
      const next = new Set(prev);
      for (const id of visibleIds) next.add(id);
      return next;
    });
    markAllAsReadAction(visibleIds).catch(() => {
      // Best-effort
    });
  }, [filteredTopics]);

  const handleStartMission = useCallback(
    (topicId: string) => {
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
    },
    [router, startTrackingTransition]
  );

  const handleTrackAllP0 = useCallback(() => {
    startTrackingAllTransition(async () => {
      const p0Ids = localTopics.filter((t) => t.priority === "P0").map((t) => t.id);
      for (const id of p0Ids) {
        await startTopicMission(id);
      }
      setTrackedIds((prev) => {
        const next = new Set(prev);
        for (const id of p0Ids) next.add(id);
        return next;
      });
      router.refresh();
    });
  }, [localTopics, router, startTrackingAllTransition]);

  const handleRefresh = useCallback(() => {
    startRefreshTransition(async () => {
      await triggerHotTopicCrawl();
      router.refresh();
    });
  }, [router, startRefreshTransition]);

  const handleNewTopicClick = useCallback(() => {
    setNewTopicCount(0);
    pageLoadTimeRef.current = new Date().toISOString();
    router.refresh();
  }, [router]);

  const handleTabChange = useCallback((tab: "subscribed" | "all" | "calendar") => {
    setActiveTab(tab);
    setSelectedTopicId(null);
    setSelectedPriority(null);
    setSelectedCategory(null);
  }, []);

  // ========================
  // Empty state
  // ========================
  if (topics.length === 0 && calendarEvents.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-4">
            <Radar size={32} className="text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">暂无热点数据</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">点击下方按钮从全网平台获取最新热点</p>
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="bg-blue-600 hover:bg-blue-700 text-white border-0"
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin mr-2" : "mr-2"} />
            {isRefreshing ? "正在抓取..." : "刷新热点"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Main dual-panel layout */}
      <div className="flex flex-1 min-h-0 gap-0">
        {/* ======================== Left Panel (45%) ======================== */}
        <div className="w-[45%] flex flex-col min-h-0 border-r border-gray-200 dark:border-white/5">
          {/* AI Summary Bar */}
          <AISummaryBar
            delta={meeting.delta}
            collapsed={summaryCollapsed}
            onToggle={() => setSummaryCollapsed(!summaryCollapsed)}
            onMarkAllRead={handleMarkAllRead}
            lastViewedAt={lastViewedAt}
          />

          {/* Tab Bar */}
          <TabBar
            activeTab={activeTab}
            onTabChange={handleTabChange}
            unreadSubscribed={unreadSubscribed}
            unreadAll={unreadAll}
            calendarCount={calendarEventCount}
            onSettingsClick={() => setShowSubscriptionSheet(true)}
          />

          {/* Filter Bar — priority + category chips */}
          {activeTab !== "calendar" && (
            <div className="border-b border-gray-200 dark:border-white/5">
              {/* Priority filter row */}
              <div className="flex items-center gap-1.5 px-3 pt-2 pb-1.5">
                <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 mr-1">优先级</span>
                <button
                  onClick={() => setSelectedPriority(null)}
                  className={cn(
                    "shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                    !selectedPriority
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
                  )}
                >
                  全部
                </button>
                {priorityStats.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => setSelectedPriority(selectedPriority === p.key ? null : p.key)}
                    className={cn(
                      "shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                      selectedPriority === p.key ? p.color : p.inactiveColor
                    )}
                  >
                    {p.label}
                    <span className="ml-1 opacity-70">{p.count}</span>
                  </button>
                ))}
                {/* Filtered count */}
                <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 shrink-0">
                  {filteredTopics.length} 条
                </span>
              </div>
              {/* Category filter row */}
              <div className="flex items-center gap-1.5 px-3 pb-2 overflow-x-auto no-scrollbar">
                <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0 mr-1">分类</span>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={cn(
                    "shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                    !selectedCategory
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
                  )}
                >
                  全部
                </button>
                {categoryStats.map((cat) => (
                  <button
                    key={cat.name}
                    onClick={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
                    className={cn(
                      "shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                      selectedCategory === cat.name
                        ? `${getCategoryStyle(cat.name).bg} ${getCategoryStyle(cat.name).text} ring-1 ring-current/20`
                        : "bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
                    )}
                  >
                    {cat.name}
                    <span className="ml-1 opacity-60">{cat.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Content Area */}
          <div className="flex-1 min-h-0 relative">
            <ScrollArea className="h-full">
              <div className="p-3">
                {activeTab === "calendar" ? (
                  <CalendarList
                    events={calendarEvents}
                    onAddEvent={() => setShowCalendarSheet(true)}
                    onConfirm={(id) => { confirmCalendarEventAction(id); router.refresh(); }}
                    onReject={(id) => { rejectCalendarEventAction(id); router.refresh(); }}
                  />
                ) : (
                  <TopicList
                    topics={filteredTopics}
                    readIds={localReadIds}
                    selectedId={selectedTopicId}
                    onSelect={handleSelectTopic}
                    subscribedCategories={subscribedCategories}
                    showSubscribedAccent={activeTab === "all"}
                    timelineDividerIndex={timelineDividerIndex}
                    lastViewedAt={lastViewedAt}
                    trackedIds={trackedIds}
                    missionPendingId={missionPendingId}
                    onStartMission={handleStartMission}
                  />
                )}
              </div>
            </ScrollArea>

            {/* New topic floating bar */}
            <AnimatePresence>
              {newTopicCount > 0 && (
                <FloatingNewTopicBar count={newTopicCount} onClick={handleNewTopicClick} />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ======================== Right Panel (55%) — Always Editorial Briefing ======================== */}
        <div className="w-[55%] flex flex-col min-h-0">
          <ScrollArea className="h-full">
            <div className="p-5">
              <EditorialBriefing
                meeting={meeting}
                calendarEvents={calendarEvents}
                p0Count={meeting.p0Count}
                p1Count={meeting.p1Count}
                p2Count={meeting.p2Count}
                onTrackAllP0={handleTrackAllP0}
                isTrackingAll={isTrackingAll}
              />
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* ======================== Bottom: Platform Status Bar ======================== */}
      <PlatformStatusBar monitors={monitors} isRefreshing={isRefreshing} onRefresh={handleRefresh} />

      {/* ======================== Dialogs ======================== */}
      <SubscriptionSheet
        open={showSubscriptionSheet}
        onOpenChange={setShowSubscriptionSheet}
        categories={localSubCategories}
        eventTypes={localSubEventTypes}
        onCategoriesChange={setLocalSubCategories}
        onEventTypesChange={setLocalSubEventTypes}
        onSave={async () => {
          await updateSubscriptionsAction(
            Array.from(localSubCategories),
            Array.from(localSubEventTypes)
          );
          setShowSubscriptionSheet(false);
          router.refresh();
        }}
      />

      <OnboardingDialog
        open={showOnboarding}
        onOpenChange={setShowOnboarding}
        categories={localSubCategories}
        eventTypes={localSubEventTypes}
        onCategoriesChange={setLocalSubCategories}
        onEventTypesChange={setLocalSubEventTypes}
        onSave={async () => {
          await updateSubscriptionsAction(
            Array.from(localSubCategories),
            Array.from(localSubEventTypes)
          );
          setShowOnboarding(false);
          router.refresh();
        }}
        onSkip={() => setShowOnboarding(false)}
      />

      <CalendarEventSheet
        open={showCalendarSheet}
        onOpenChange={setShowCalendarSheet}
        onSubmit={async (data) => {
          await createCalendarEventAction(data);
          setShowCalendarSheet(false);
          router.refresh();
        }}
      />
    </div>
  );
}

// ========================
// Left Panel: AI Summary Bar
// ========================

function AISummaryBar({
  delta,
  collapsed,
  onToggle,
  onMarkAllRead,
  lastViewedAt,
}: {
  delta?: EditorialMeeting["delta"];
  collapsed: boolean;
  onToggle: () => void;
  onMarkAllRead: () => void;
  lastViewedAt?: string;
}) {
  const timeSince = delta?.timeSinceLastView ?? (lastViewedAt ? timeAgo(lastViewedAt) : "");
  const newCount = delta?.newTopicsCount ?? 0;

  return (
    <div className="border-b border-gray-200 dark:border-white/5">
      {/* Collapsed: one-line summary */}
      <div
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Zap size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
            {timeSince ? `距上次 ${timeSince}` : "欢迎回来"}
            {newCount > 0 && (
              <span className="text-amber-600 dark:text-amber-400 font-medium ml-1">+{newCount} 新热点</span>
            )}
            {delta && delta.newP0Count > 0 && (
              <span className="text-red-600 dark:text-red-400 font-medium ml-1">
                (P0: {delta.newP0Count})
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMarkAllRead();
            }}
            className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors px-2 py-0.5 rounded"
          >
            <EyeOff size={10} className="inline mr-1" />
            一键全部已读
          </button>
          {collapsed ? <ChevronDown size={12} className="text-gray-400 dark:text-gray-500" /> : <ChevronUp size={12} className="text-gray-400 dark:text-gray-500" />}
        </div>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {!collapsed && delta && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-1.5">
              {delta.significantChanges.length > 0 && (
                <div className="space-y-1">
                  {delta.significantChanges.map((change, i) => (
                    <p key={i} className="text-xs text-gray-500 dark:text-gray-500 leading-relaxed">
                      {change}
                    </p>
                  ))}
                </div>
              )}
              {delta.subscribedChannelUpdates && (
                <p className="text-xs text-blue-600 dark:text-blue-400/70">
                  {delta.subscribedChannelUpdates}
                </p>
              )}
              <div className="flex items-center gap-3 text-[11px] text-gray-400 dark:text-gray-500">
                <span>P0: <span className="text-red-600 dark:text-red-400">{delta.newP0Count}</span></span>
                <span>P1: <span className="text-orange-600 dark:text-orange-400">{delta.newP1Count}</span></span>
                <span>P2: <span className="text-gray-500 dark:text-gray-500">{delta.newP2Count}</span></span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ========================
// Left Panel: Tab Bar
// ========================

function TabBar({
  activeTab,
  onTabChange,
  unreadSubscribed,
  unreadAll,
  calendarCount,
  onSettingsClick,
}: {
  activeTab: "subscribed" | "all" | "calendar";
  onTabChange: (tab: "subscribed" | "all" | "calendar") => void;
  unreadSubscribed: number;
  unreadAll: number;
  calendarCount: number;
  onSettingsClick: () => void;
}) {
  const tabs: { key: "subscribed" | "all" | "calendar"; label: string; count: number }[] = [
    { key: "all", label: "全网热点", count: unreadAll },
    { key: "subscribed", label: "我的订阅", count: unreadSubscribed },
    { key: "calendar", label: "日历灵感", count: calendarCount },
  ];

  return (
    <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 dark:border-white/5">
      <div className="flex items-center gap-0.5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              activeTab === tab.key
                ? "bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white/60 hover:bg-gray-100 dark:hover:bg-white/5"
            )}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={cn(
                "ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[11px] font-bold",
                activeTab === tab.key
                  ? "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400"
                  : "bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400"
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
      <button
        onClick={onSettingsClick}
        className="p-1.5 rounded-md text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-white/60 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
      >
        <Settings size={14} />
      </button>
    </div>
  );
}

// ========================
// Left Panel: Topic List
// ========================

function TopicList({
  topics,
  readIds,
  selectedId,
  onSelect,
  subscribedCategories,
  showSubscribedAccent,
  timelineDividerIndex,
  lastViewedAt,
  trackedIds,
  missionPendingId,
  onStartMission,
}: {
  topics: InspirationTopic[];
  readIds: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  subscribedCategories: Set<string>;
  showSubscribedAccent: boolean;
  timelineDividerIndex: number;
  lastViewedAt?: string;
  trackedIds: Set<string>;
  missionPendingId: string | null;
  onStartMission: (id: string) => void;
}) {
  if (topics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Eye size={24} className="text-gray-300 dark:text-gray-600 mb-2" />
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {showSubscribedAccent ? "暂无热点" : "暂无订阅热点，请先设置订阅分类"}
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100 dark:divide-white/5">
      {topics.map((topic, index) => {
        const isRead = readIds.has(topic.id);
        const isExpanded = selectedId === topic.id;
        const cat = normalizeCategory(topic.category);
        const isSubscribed = subscribedCategories.has(cat);

        return (
          <div key={topic.id}>
            {/* Timeline divider */}
            {timelineDividerIndex === index && timelineDividerIndex > 0 && (
              <div className="flex items-center gap-2 py-2 px-2">
                <div className="flex-1 h-px bg-gray-200 dark:bg-white/10" />
                <span className="text-[11px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                  上次查看到这里 {lastViewedAt ? `· ${timeAgo(lastViewedAt)}` : ""}
                </span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-white/10" />
              </div>
            )}

            {/* Topic item header — always visible */}
            <div
              onClick={() => onSelect(isExpanded ? "" : topic.id)}
              className={cn(
                "relative flex gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all duration-150 group",
                isExpanded
                  ? "bg-blue-50 dark:bg-white/[0.08] border-l-2 border-l-blue-400"
                  : "hover:bg-gray-50 dark:hover:bg-white/[0.03] border-l-2 border-l-transparent",
              )}
            >
              {/* Unread dot */}
              <div className="pt-1.5 w-3 shrink-0 flex justify-center">
                {!isRead && (
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Top row: badges */}
                <div className="flex items-center gap-1.5 mb-1">
                  <PriorityBadge priority={topic.priority} />
                  <HeatScoreBadge score={topic.heatScore} />
                  <TrendIndicator trend={topic.trend} />
                  {cat && (
                    <span
                      className={cn(
                        "inline-flex items-center px-1.5 py-0 rounded-full text-[11px] font-medium",
                        showSubscribedAccent && isSubscribed
                          ? `${getCategoryStyle(cat).bg} ${getCategoryStyle(cat).text}`
                          : "bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400"
                      )}
                    >
                      {cat}
                    </span>
                  )}
                  <div className="ml-auto">
                    {isExpanded ? <ChevronUp size={12} className="text-gray-400" /> : <ChevronDown size={12} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
                  </div>
                </div>

                {/* Title */}
                <h4
                  className={cn(
                    "text-sm leading-snug mb-1",
                    isExpanded ? "line-clamp-none" : "line-clamp-2",
                    isRead
                      ? "text-gray-500 dark:text-gray-500 font-normal"
                      : "text-gray-900 dark:text-gray-100 font-semibold"
                  )}
                >
                  {topic.title}
                </h4>

                {/* Summary — collapsed only */}
                {!isExpanded && topic.summary && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed line-clamp-2 mb-1.5">
                    {truncText(topic.summary, 80)}
                  </p>
                )}

                {/* Bottom: platforms + time */}
                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                  {topic.platforms.slice(0, 3).map((p) => (
                    <PlatformTag key={p} name={p} size="xs" />
                  ))}
                  {topic.platforms.length > 3 && (
                    <span className="text-[11px] text-gray-300 dark:text-gray-600">+{topic.platforms.length - 3}</span>
                  )}
                  <span className="text-[11px] text-gray-400 dark:text-gray-500 ml-auto flex items-center gap-0.5">
                    <Clock size={8} />
                    {formatTime(topic.discoveredAt)} · {timeAgo(topic.discoveredAt)}
                  </span>
                  {!isExpanded && topic.suggestedAngles.length > 0 && (
                    <span className="text-[11px] text-amber-600 dark:text-amber-400/60">
                      <Lightbulb size={8} className="inline mr-0.5" />
                      {topic.suggestedAngles.length}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Inline expanded detail */}
            <AnimatePresence>
              {isExpanded && (
                <TopicInlineDetail
                  topic={topic}
                  isTracked={trackedIds.has(topic.id)}
                  missionPending={missionPendingId === topic.id}
                  onStartMission={onStartMission}
                />
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

// ========================
// Left Panel: Inline Topic Detail (expanded in list)
// ========================

function TopicInlineDetail({
  topic,
  isTracked,
  missionPending,
  onStartMission,
}: {
  topic: InspirationTopic;
  isTracked: boolean;
  missionPending: boolean;
  onStartMission: (id: string) => void;
}) {
  const totalSentiment =
    topic.commentInsight.positive + topic.commentInsight.neutral + topic.commentInsight.negative;
  const posPercent = totalSentiment > 0 ? Math.round((topic.commentInsight.positive / totalSentiment) * 100) : 0;
  const neuPercent = totalSentiment > 0 ? Math.round((topic.commentInsight.neutral / totalSentiment) * 100) : 0;
  const negPercent = totalSentiment > 0 ? Math.round((topic.commentInsight.negative / totalSentiment) * 100) : 0;

  const angles = topic.enrichedOutlines.length > 0
    ? topic.enrichedOutlines
    : topic.suggestedAngles.map((a) => ({ angle: a, points: [], wordCount: "", style: "" }));

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div className="mx-2 mb-3 mt-1 rounded-xl bg-gradient-to-b from-blue-50/80 to-gray-50/50 dark:from-blue-950/20 dark:to-gray-900/20 p-3 space-y-3 ring-1 ring-blue-200/50 dark:ring-blue-500/10">
        {/* Full summary */}
        {topic.summary && (
          <p className="text-[12px] text-gray-600 dark:text-gray-400 leading-relaxed">
            {topic.summary}
          </p>
        )}

        {/* Heat Curve — compact */}
        {topic.heatCurve.length >= 2 && (
          <div className="rounded-lg bg-white/70 dark:bg-white/[0.03] p-2.5 ring-1 ring-gray-200/50 dark:ring-white/5">
            <div className="text-[11px] text-gray-500 dark:text-gray-500 mb-1.5 flex items-center gap-1 font-medium">
              <BarChart3 size={10} /> 热度趋势
            </div>
            <HeatCurveChart data={topic.heatCurve} height={60} />
          </div>
        )}

        {/* AI Angles — styled cards */}
        {angles.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <Lightbulb size={12} /> AI 建议切角
            </div>
            {angles.map((outline, i) => (
              <div key={i} className="rounded-lg bg-white/80 dark:bg-amber-500/5 p-2.5 ring-1 ring-amber-200/50 dark:ring-amber-500/10">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[11px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <span className="text-[12px] font-medium text-gray-800 dark:text-gray-200 flex-1">{outline.angle}</span>
                  {outline.wordCount && (
                    <span className="text-[11px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded-full">{outline.wordCount}字</span>
                  )}
                </div>
                {outline.points.length > 0 && (
                  <div className="space-y-0.5 ml-7">
                    {outline.points.map((pt, j) => (
                      <p key={j} className="text-xs text-gray-500 dark:text-gray-500 leading-relaxed">
                        · {pt}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Sentiment — compact bar */}
        {totalSentiment > 0 && (
          <div className="rounded-lg bg-white/70 dark:bg-white/[0.03] p-2.5 ring-1 ring-gray-200/50 dark:ring-white/5">
            <div className="text-[11px] font-medium text-gray-500 dark:text-gray-500 mb-1.5 flex items-center gap-1">
              <MessageSquare size={10} /> 舆情
            </div>
            <div className="flex h-2 rounded-full overflow-hidden mb-1.5">
              <div className="bg-green-500" style={{ width: `${posPercent}%` }} />
              <div className="bg-gray-300 dark:bg-gray-600" style={{ width: `${neuPercent}%` }} />
              <div className="bg-red-500" style={{ width: `${negPercent}%` }} />
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="text-green-600 dark:text-green-400">正面 {posPercent}%</span>
              <span className="text-gray-500 dark:text-gray-400">中性 {neuPercent}%</span>
              <span className="text-red-600 dark:text-red-400">负面 {negPercent}%</span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-1">
          {isTracked ? (
            <Button size="sm" disabled className="h-8 text-xs bg-green-100 dark:bg-green-600/20 text-green-600 dark:text-green-400 border-0 rounded-lg">
              <Eye size={12} className="mr-1.5" /> 已追踪
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={(e) => { e.stopPropagation(); onStartMission(topic.id); }}
              disabled={missionPending}
              className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white border-0 rounded-lg shadow-sm"
            >
              <Rocket size={12} className="mr-1.5" />
              {missionPending ? "创建中..." : "启动追踪"}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs text-gray-500 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 border-0 rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <Star size={12} className="mr-1.5" /> 收藏
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ========================
// Left Panel: Calendar List
// ========================

function CalendarList({
  events,
  onAddEvent,
  onConfirm,
  onReject,
}: {
  events: CalendarEvent[];
  onAddEvent: () => void;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
}) {
  // Group events by time bucket
  const grouped = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 86400000);
    const endOfWeek = new Date(today.getTime() + 7 * 86400000);
    const endOfNextWeek = new Date(today.getTime() + 14 * 86400000);
    const endOf30Days = new Date(today.getTime() + 30 * 86400000);

    const groups: { label: string; items: CalendarEvent[] }[] = [
      { label: "今天", items: [] },
      { label: "明天", items: [] },
      { label: "本周", items: [] },
      { label: "下周", items: [] },
      { label: "未来30天", items: [] },
    ];

    for (const ev of events) {
      const start = new Date(ev.startDate);
      if (start < tomorrow) groups[0].items.push(ev);
      else if (start < new Date(tomorrow.getTime() + 86400000)) groups[1].items.push(ev);
      else if (start < endOfWeek) groups[2].items.push(ev);
      else if (start < endOfNextWeek) groups[3].items.push(ev);
      else if (start < endOf30Days) groups[4].items.push(ev);
    }

    return groups.filter((g) => g.items.length > 0);
  }, [events]);

  return (
    <div className="space-y-3">
      {/* Add event button */}
      <button
        onClick={onAddEvent}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-gray-100 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/8 text-gray-500 dark:text-gray-500 hover:text-gray-800 dark:hover:text-white/70 text-xs transition-colors"
      >
        <CalendarPlus size={14} />
        添加事件
      </button>

      {grouped.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <Calendar size={24} className="text-gray-300 dark:text-gray-600 mb-2" />
          <p className="text-xs text-gray-400 dark:text-gray-500">暂无日历事件</p>
        </div>
      )}

      {grouped.map((group) => (
        <div key={group.label}>
          <div className="text-[11px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5 px-1">
            {group.label}
          </div>
          <div className="space-y-1">
            {group.items.map((ev) => (
              <div
                key={ev.id}
                className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors"
              >
                <span className="text-lg mt-0.5">{EVENT_TYPE_EMOJI[ev.eventType] ?? "📅"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[12px] font-medium text-gray-800 dark:text-gray-200 truncate">
                      {ev.name}
                    </span>
                    {normalizeCategory(ev.category) && (
                      <span className={cn(
                        "inline-flex items-center px-1.5 py-0 rounded-full text-[11px] font-medium",
                        getCategoryStyle(normalizeCategory(ev.category)).bg,
                        getCategoryStyle(normalizeCategory(ev.category)).text,
                      )}>
                        {normalizeCategory(ev.category)}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-gray-400 dark:text-gray-500 mb-1">
                    {new Date(ev.startDate).toLocaleDateString("zh-CN")}
                    {ev.endDate !== ev.startDate && ` - ${new Date(ev.endDate).toLocaleDateString("zh-CN")}`}
                  </div>
                  {ev.aiAngles.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <Lightbulb size={9} className="text-amber-600 dark:text-amber-400/60" />
                      {ev.aiAngles.slice(0, 2).map((angle, i) => (
                        <span key={i} className="text-[11px] text-amber-600 dark:text-amber-400/50 bg-amber-50 dark:bg-amber-400/5 px-1.5 py-0.5 rounded">
                          {truncText(angle, 20)}
                        </span>
                      ))}
                      {ev.aiAngles.length > 2 && (
                        <span className="text-[11px] text-gray-300 dark:text-gray-600">+{ev.aiAngles.length - 2}</span>
                      )}
                    </div>
                  )}
                </div>
                {/* Pending review actions */}
                {ev.status === "pending_review" && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => onConfirm(ev.id)}
                      className="p-1 rounded text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-400/10 transition-colors"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => onReject(ev.id)}
                      className="p-1 rounded text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-400/10 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ========================
// Left Panel: Floating Notification
// ========================

function FloatingNewTopicBar({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <motion.div
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -40, opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="absolute top-2 left-3 right-3 z-10"
    >
      <button
        onClick={onClick}
        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-100 dark:bg-blue-500/20 backdrop-blur-sm text-blue-600 dark:text-blue-400 text-xs font-medium hover:bg-blue-200 dark:hover:bg-blue-500/30 transition-colors"
      >
        <ArrowUp size={12} />
        发现 {count} 条新热点，点击查看
      </button>
    </motion.div>
  );
}

// ========================
// Right Panel: Editorial Briefing
// ========================

function EditorialBriefing({
  meeting,
  calendarEvents,
  p0Count,
  p1Count,
  p2Count,
  onTrackAllP0,
  isTrackingAll,
}: {
  meeting: EditorialMeeting;
  calendarEvents: CalendarEvent[];
  p0Count: number;
  p1Count: number;
  p2Count: number;
  onTrackAllP0: () => void;
  isTrackingAll: boolean;
}) {
  const total = p0Count + p1Count + p2Count;
  const next3DaysEvents = useMemo(() => {
    const cutoff = new Date(Date.now() + 3 * 86400000);
    return calendarEvents.filter((ev) => new Date(ev.startDate) <= cutoff).slice(0, 5);
  }, [calendarEvents]);

  return (
    <div className="space-y-5">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">编辑简报 · 今日全景</h2>
        </div>
        <Badge variant="outline" className="text-[11px] bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-white/10">
          <Clock size={10} className="mr-1" />
          {meeting.generatedAt} 更新
        </Badge>
      </div>

      {/* AI Summary */}
      <GlassCard variant="accent" padding="md">
        <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed space-y-1.5">
          {meeting.aiSummary.split("\n").map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      </GlassCard>

      {/* Priority Distribution */}
      <GlassCard variant="default" padding="md">
        <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 flex items-center gap-1.5">
          <BarChart3 size={12} />
          优先级分布
        </h3>
        <div className="space-y-2">
          {[
            { label: "P0 必追", count: p0Count, color: "bg-red-500", textColor: "text-red-600 dark:text-red-400" },
            { label: "P1 建议", count: p1Count, color: "bg-orange-500", textColor: "text-orange-600 dark:text-orange-400" },
            { label: "P2 关注", count: p2Count, color: "bg-gray-500", textColor: "text-gray-600 dark:text-gray-400" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className={cn("text-xs font-medium w-14", item.textColor)}>{item.label}</span>
              <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", item.color)}
                  style={{ width: total > 0 ? `${(item.count / total) * 100}%` : "0%" }}
                />
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-500 w-6 text-right">{item.count}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Category TOP 5 */}
      {meeting.topCategories.length > 0 && (
        <GlassCard variant="default" padding="md">
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 flex items-center gap-1.5">
            <Tag size={12} />
            分类 TOP 5
          </h3>
          <div className="space-y-2">
            {meeting.topCategories.slice(0, 5).map((cat) => {
              const maxCount = meeting.topCategories[0]?.count ?? 1;
              const style = getCategoryStyle(cat.name);
              return (
                <div key={cat.name} className="flex items-center gap-3">
                  <span className={cn("text-xs font-medium w-12 shrink-0 truncate", style.text)}>{cat.name}</span>
                  <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500/60 transition-all"
                      style={{ width: `${(cat.count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-500 w-6 text-right">{cat.count}</span>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* Calendar Preview: next 3 days */}
      {next3DaysEvents.length > 0 && (
        <GlassCard variant="default" padding="md">
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 flex items-center gap-1.5">
            <Calendar size={12} />
            近3日事件
          </h3>
          <div className="space-y-1.5">
            {next3DaysEvents.map((ev) => (
              <div key={ev.id} className="flex items-center gap-2 text-xs">
                <span>{EVENT_TYPE_EMOJI[ev.eventType] ?? "📅"}</span>
                <span className="text-gray-700 dark:text-gray-300 truncate flex-1">{ev.name}</span>
                <span className="text-gray-400 dark:text-gray-500">{new Date(ev.startDate).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Track all P0 button */}
      {p0Count > 0 && (
        <Button
          onClick={onTrackAllP0}
          disabled={isTrackingAll}
          className="w-full bg-red-600 hover:bg-red-700 text-white border-0"
        >
          <Rocket size={14} className="mr-1.5" />
          {isTrackingAll ? "启动中..." : `一键追踪全部 P0（${p0Count} 条）`}
        </Button>
      )}
    </div>
  );
}

// ========================
// Right Panel: Topic Detail
// ========================

function TopicDetail({
  topic,
  isTracked,
  missionPending,
  onStartMission,
  onBack,
}: {
  topic: InspirationTopic;
  isTracked: boolean;
  missionPending: boolean;
  onStartMission: (id: string) => void;
  onBack: () => void;
}) {
  const [anglesExpanded, setAnglesExpanded] = useState(true);
  const [materialsExpanded, setMaterialsExpanded] = useState(true);

  const totalSentiment =
    topic.commentInsight.positive + topic.commentInsight.neutral + topic.commentInsight.negative;
  const posPercent = totalSentiment > 0 ? Math.round((topic.commentInsight.positive / totalSentiment) * 100) : 0;
  const neuPercent = totalSentiment > 0 ? Math.round((topic.commentInsight.neutral / totalSentiment) * 100) : 0;
  const negPercent = totalSentiment > 0 ? Math.round((topic.commentInsight.negative / totalSentiment) * 100) : 0;

  // Use enrichedOutlines or fallback to suggestedAngles
  const angles = topic.enrichedOutlines.length > 0
    ? topic.enrichedOutlines
    : topic.suggestedAngles.map((a) => ({ angle: a, points: [], wordCount: "", style: "" }));

  // Group materials by type
  const materialsByType = useMemo(() => {
    const groups: Record<string, typeof topic.relatedMaterials> = {};
    for (const m of topic.relatedMaterials) {
      if (!groups[m.type]) groups[m.type] = [];
      groups[m.type].push(m);
    }
    return groups;
  }, [topic.relatedMaterials]);

  const materialTypeLabels: Record<string, { label: string; icon: typeof FileText }> = {
    report: { label: "报告", icon: FileText },
    data: { label: "数据", icon: Database },
    comment: { label: "评论", icon: MessageSquare },
  };

  return (
    <div className="space-y-5">
      {/* Back link */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white/60 transition-colors"
      >
        <ChevronLeft size={14} />
        返回简报
      </button>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <PriorityBadge priority={topic.priority} />
          <HeatScoreBadge score={topic.heatScore} />
          <TrendIndicator trend={topic.trend} />
          <AIScoreBadge score={topic.aiScore} size={32} />
          {normalizeCategory(topic.category) && (
            <span className={cn(
              "inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-medium",
              getCategoryStyle(normalizeCategory(topic.category)).bg,
              getCategoryStyle(normalizeCategory(topic.category)).text,
            )}>
              <Tag size={8} />
              {normalizeCategory(topic.category)}
            </span>
          )}
        </div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-snug">{topic.title}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {topic.platforms.map((p) => (
            <PlatformTag key={p} name={p} />
          ))}
          <span className="text-[11px] text-gray-400 dark:text-gray-500 ml-auto flex items-center gap-1">
            <Clock size={10} />
            {topic.discoveredAt}
          </span>
        </div>
      </div>

      {/* Summary */}
      {topic.summary && (
        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{topic.summary}</p>
      )}

      {/* Heat Curve */}
      {topic.heatCurve.length >= 2 && (
        <GlassCard variant="default" padding="md">
          <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
            <Eye size={10} /> 热度曲线
          </div>
          <HeatCurveChart data={topic.heatCurve} height={100} />
        </GlassCard>
      )}

      {/* AI Angles */}
      {angles.length > 0 && (
        <GlassCard variant="default" padding="none">
          <button
            onClick={() => setAnglesExpanded(!anglesExpanded)}
            className="w-full flex items-center justify-between p-4 text-left"
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <Lightbulb size={14} />
              AI 建议切角 ({angles.length})
            </div>
            {anglesExpanded ? <ChevronUp size={14} className="text-gray-400 dark:text-gray-500" /> : <ChevronDown size={14} className="text-gray-400 dark:text-gray-500" />}
          </button>
          <AnimatePresence>
            {anglesExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-3">
                  {angles.map((outline, i) => (
                    <div key={i} className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[11px] font-bold text-amber-500">#{i + 1}</span>
                        <span className="text-xs font-medium text-gray-800 dark:text-gray-200">{outline.angle}</span>
                        {outline.wordCount && (
                          <span className="text-[11px] text-gray-400 dark:text-gray-500 ml-auto">{outline.wordCount}</span>
                        )}
                        {outline.style && (
                          <span className="text-[11px] text-gray-400 dark:text-gray-500">{outline.style}</span>
                        )}
                      </div>
                      {outline.points.length > 0 && (
                        <div className="space-y-0.5 ml-5">
                          {outline.points.map((pt, j) => (
                            <p key={j} className="text-xs text-gray-500 dark:text-gray-500 leading-relaxed">
                              · {pt}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>
      )}

      {/* Materials */}
      {topic.relatedMaterials.length > 0 && (
        <GlassCard variant="default" padding="none">
          <button
            onClick={() => setMaterialsExpanded(!materialsExpanded)}
            className="w-full flex items-center justify-between p-4 text-left"
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <FileText size={14} />
              相关素材 ({topic.relatedMaterials.length})
            </div>
            {materialsExpanded ? <ChevronUp size={14} className="text-gray-400 dark:text-gray-500" /> : <ChevronDown size={14} className="text-gray-400 dark:text-gray-500" />}
          </button>
          <AnimatePresence>
            {materialsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 space-y-3">
                  {Object.entries(materialsByType).map(([type, items]) => {
                    const info = materialTypeLabels[type] ?? { label: type, icon: FileText };
                    const Icon = info.icon;
                    return (
                      <div key={type}>
                        <div className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 mb-1.5">
                          <Icon size={10} />
                          {info.label}
                        </div>
                        <div className="space-y-1.5">
                          {items.map((m, i) => (
                            <div key={i} className="p-2 rounded-lg bg-gray-50 dark:bg-white/[0.03]">
                              <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">{m.title}</div>
                              <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2">{m.snippet}</p>
                              <span className="text-[11px] text-gray-300 dark:text-gray-600">{m.source}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>
      )}

      {/* Sentiment */}
      {totalSentiment > 0 && (
        <GlassCard variant="default" padding="md">
          <div className="flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-400 mb-3">
            <MessageSquare size={12} className="text-purple-600 dark:text-purple-400" />
            舆情分布
          </div>
          <div className="flex h-2.5 rounded-full overflow-hidden mb-2">
            <div className="bg-green-500/80" style={{ width: `${posPercent}%` }} />
            <div className="bg-gray-500/60" style={{ width: `${neuPercent}%` }} />
            <div className="bg-red-500/80" style={{ width: `${negPercent}%` }} />
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="text-green-600 dark:text-green-400"><ThumbsUp size={10} className="inline mr-0.5" />正面 {posPercent}%</span>
            <span className="text-gray-500 dark:text-gray-400"><Minus size={10} className="inline mr-0.5" />中性 {neuPercent}%</span>
            <span className="text-red-600 dark:text-red-400"><ThumbsDown size={10} className="inline mr-0.5" />负面 {negPercent}%</span>
          </div>
          {topic.commentInsight.hotComments.length > 0 && (
            <div className="mt-3 space-y-1">
              <div className="text-[11px] text-gray-400 dark:text-gray-500">热门评论</div>
              {topic.commentInsight.hotComments.slice(0, 3).map((comment, i) => (
                <p key={i} className="text-xs text-gray-500 dark:text-gray-500 leading-relaxed pl-2 border-l-2 border-gray-200 dark:border-white/10">
                  {comment}
                </p>
              ))}
            </div>
          )}
        </GlassCard>
      )}

      {/* Competitor */}
      {topic.competitorResponse.length > 0 && (
        <GlassCard variant="default" padding="md">
          <div className="flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-400 mb-3">
            <Users size={12} className="text-blue-600 dark:text-blue-400" />
            竞品动态
          </div>
          <div className="space-y-1.5">
            {topic.competitorResponse.map((resp, i) => (
              <p key={i} className="text-xs text-gray-500 dark:text-gray-500 leading-relaxed">{resp}</p>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        {isTracked ? (
          <Button disabled className="flex-1 bg-green-100 dark:bg-green-600/20 text-green-600 dark:text-green-400 border-0">
            <Eye size={14} className="mr-1.5" />
            已追踪
          </Button>
        ) : (
          <Button
            onClick={() => onStartMission(topic.id)}
            disabled={missionPending}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white border-0"
          >
            <Rocket size={14} className="mr-1.5" />
            {missionPending ? "创建中..." : "启动追踪"}
          </Button>
        )}
        <Button
          variant="ghost"
          className="flex-1 text-gray-500 dark:text-gray-500 hover:text-gray-800 dark:hover:text-white/70 border-0"
        >
          <Star size={14} className="mr-1.5" />
          加入选题策划会素材
        </Button>
      </div>
    </div>
  );
}

// ========================
// Bottom: Platform Status Bar
// ========================

function PlatformStatusBar({
  monitors,
  isRefreshing,
  onRefresh,
}: {
  monitors: PlatformMonitor[];
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-1.5 border-t border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-black/20">
      <div className="flex items-center gap-3 overflow-x-auto">
        {monitors.map((m) => (
          <div key={m.name} className="flex items-center gap-1.5 shrink-0">
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                m.status === "online" ? "bg-green-400" : "bg-gray-500"
              )}
            />
            <span className="text-[11px] text-gray-500 dark:text-gray-400">{getPlatformShort(m.name)}</span>
            <span className="text-[11px] text-gray-300 dark:text-gray-600">{m.lastScan}</span>
          </div>
        ))}
      </div>
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-white/50 transition-colors shrink-0 ml-3"
      >
        <RefreshCw size={10} className={isRefreshing ? "animate-spin" : ""} />
        {isRefreshing ? "抓取中" : "刷新"}
      </button>
    </div>
  );
}

// ========================
// Dialogs: Subscription Management
// ========================

function SubscriptionCheckboxGrid({
  categories,
  eventTypes,
  onCategoriesChange,
  onEventTypesChange,
}: {
  categories: Set<string>;
  eventTypes: Set<string>;
  onCategoriesChange: (s: Set<string>) => void;
  onEventTypesChange: (s: Set<string>) => void;
}) {
  const toggleCategory = (cat: string) => {
    const next = new Set(categories);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    onCategoriesChange(next);
  };

  const toggleEventType = (et: string) => {
    const next = new Set(eventTypes);
    if (next.has(et)) next.delete(et);
    else next.add(et);
    onEventTypesChange(next);
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">内容分类</h4>
        <div className="grid grid-cols-3 gap-2">
          {VALID_CATEGORIES.map((cat) => (
            <label key={cat} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={categories.has(cat)}
                onCheckedChange={() => toggleCategory(cat)}
              />
              <span className="text-xs text-gray-700 dark:text-gray-300">{cat}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">事件类型</h4>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={eventTypes.has(key)}
                onCheckedChange={() => toggleEventType(key)}
              />
              <span className="text-xs text-gray-700 dark:text-gray-300">
                {EVENT_TYPE_EMOJI[key]} {label}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function SubscriptionSheet({
  open,
  onOpenChange,
  categories,
  eventTypes,
  onCategoriesChange,
  onEventTypesChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Set<string>;
  eventTypes: Set<string>;
  onCategoriesChange: (s: Set<string>) => void;
  onEventTypesChange: (s: Set<string>) => void;
  onSave: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] bg-white dark:bg-gray-950 border-gray-200 dark:border-white/10">
        <SheetHeader>
          <SheetTitle className="text-gray-900 dark:text-gray-100">订阅管理</SheetTitle>
          <SheetDescription className="text-gray-500 dark:text-gray-400">
            选择你关注的内容分类和事件类型
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 px-4">
          <SubscriptionCheckboxGrid
            categories={categories}
            eventTypes={eventTypes}
            onCategoriesChange={onCategoriesChange}
            onEventTypesChange={onEventTypesChange}
          />
          <Button
            onClick={onSave}
            className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white border-0"
          >
            保存
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ========================
// Dialogs: Onboarding
// ========================

function OnboardingDialog({
  open,
  onOpenChange,
  categories,
  eventTypes,
  onCategoriesChange,
  onEventTypesChange,
  onSave,
  onSkip,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Set<string>;
  eventTypes: Set<string>;
  onCategoriesChange: (s: Set<string>) => void;
  onEventTypesChange: (s: Set<string>) => void;
  onSave: () => void;
  onSkip: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white dark:bg-gray-950 border-gray-200 dark:border-white/10 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-gray-900 dark:text-gray-100">选择你感兴趣的内容</DialogTitle>
          <DialogDescription className="text-gray-500 dark:text-gray-400">
            设置订阅分类，灵感池将优先展示你关注的领域
          </DialogDescription>
        </DialogHeader>
        <SubscriptionCheckboxGrid
          categories={categories}
          eventTypes={eventTypes}
          onCategoriesChange={onCategoriesChange}
          onEventTypesChange={onEventTypesChange}
        />
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={onSkip}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white/60 border-0"
          >
            跳过
          </Button>
          <Button
            onClick={onSave}
            className="bg-blue-600 hover:bg-blue-700 text-white border-0"
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ========================
// Dialogs: Calendar Event Creation
// ========================

function CalendarEventSheet({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    category: string;
    eventType: "festival" | "competition" | "conference" | "exhibition" | "launch" | "memorial";
    startDate: string;
    endDate: string;
    recurrence?: "once" | "yearly" | "custom";
    reminderDaysBefore?: number;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("要闻");
  const [eventType, setEventType] = useState<"festival" | "competition" | "conference" | "exhibition" | "launch" | "memorial">("festival");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [recurrence, setRecurrence] = useState<"once" | "yearly" | "custom">("once");
  const [reminderDays, setReminderDays] = useState("3");

  const handleSubmit = () => {
    if (!name || !startDate || !endDate) return;
    onSubmit({
      name,
      category,
      eventType,
      startDate,
      endDate,
      recurrence,
      reminderDaysBefore: parseInt(reminderDays) || 3,
    });
    // Reset form
    setName("");
    setStartDate("");
    setEndDate("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] bg-white dark:bg-gray-950 border-gray-200 dark:border-white/10">
        <SheetHeader>
          <SheetTitle className="text-gray-900 dark:text-gray-100">添加日历事件</SheetTitle>
          <SheetDescription className="text-gray-500 dark:text-gray-400">
            创建选题灵感日历事件
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 px-4 space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-500 mb-1 block">事件名称</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：2026世界杯"
              className="bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-800 dark:text-gray-200"
            />
          </div>

          {/* Category */}
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-500 mb-1 block">分类</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-800 dark:text-gray-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VALID_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Event Type */}
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-500 mb-1 block">事件类型</label>
            <Select value={eventType} onValueChange={(v) => setEventType(v as typeof eventType)}>
              <SelectTrigger className="w-full bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-800 dark:text-gray-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{EVENT_TYPE_EMOJI[key]} {label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Start Date */}
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-500 mb-1 block">开始日期</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-800 dark:text-gray-200"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-500 mb-1 block">结束日期</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-800 dark:text-gray-200"
            />
          </div>

          {/* Recurrence */}
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-500 mb-1 block">重复</label>
            <Select value={recurrence} onValueChange={(v) => setRecurrence(v as typeof recurrence)}>
              <SelectTrigger className="w-full bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-800 dark:text-gray-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="once">仅一次</SelectItem>
                <SelectItem value="yearly">每年</SelectItem>
                <SelectItem value="custom">自定义</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reminder */}
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-500 mb-1 block">提前提醒（天）</label>
            <Input
              type="number"
              value={reminderDays}
              onChange={(e) => setReminderDays(e.target.value)}
              className="bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-800 dark:text-gray-200"
              min={0}
              max={30}
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!name || !startDate || !endDate}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white border-0"
          >
            创建事件
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

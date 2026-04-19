"use client";

import { useState, useEffect, useTransition, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { HeatScoreBadge } from "@/components/shared/heat-score-badge";
import { TrendIndicator } from "@/components/shared/trend-indicator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
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
  Eye,
  EyeOff,
  Lightbulb,
  Clock,
  Rocket,
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
  Star,
  Search,
  Sparkles,
  Globe,
  MessageCircle,
  Music,
  Newspaper,
  Tv,
  BookOpen,
  MessageSquare,
  Radio,
  ExternalLink,
  Play,
  FileText,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { startTopicMission, refreshInspirationData } from "@/app/actions/hot-topics";
import { startMission } from "@/app/actions/missions";
import { markAsReadAction, markAllAsReadAction } from "@/app/actions/topic-reads";
import { updateSubscriptionsAction } from "@/app/actions/topic-subscriptions";
import {
  createCalendarEventAction,
  confirmCalendarEventAction,
  rejectCalendarEventAction,
} from "@/app/actions/calendar-events";
import { templateToScenarioSlug } from "@/lib/workflow-template-slug";
import {
  ORDERED_CATEGORIES,
  CATEGORY_LABELS,
  type OrderedCategory,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import type {
  InspirationTopic,
  PlatformMonitor,
  EditorialMeeting,
  UserTopicSubscription,
  CalendarEvent,
} from "@/lib/types";
import type { WorkflowTemplateRow } from "@/db/types";

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
  workflows?: WorkflowTemplateRow[];
}

const PLATFORM_STYLE: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  微博: { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-600 dark:text-orange-400", icon: <MessageCircle className="size-4" /> },
  知乎: { bg: "bg-sky-50 dark:bg-sky-950/30", text: "text-sky-600 dark:text-sky-400", icon: <Lightbulb className="size-4" /> },
  百度: { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-600 dark:text-blue-400", icon: <Search className="size-4" /> },
  抖音: { bg: "bg-pink-50 dark:bg-pink-950/30", text: "text-pink-600 dark:text-pink-400", icon: <Music className="size-4" /> },
  今日头条: { bg: "bg-red-50 dark:bg-red-950/30", text: "text-red-600 dark:text-red-400", icon: <Newspaper className="size-4" /> },
  "36氪": { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-600 dark:text-emerald-400", icon: <BarChart3 className="size-4" /> },
  哔哩哔哩: { bg: "bg-cyan-50 dark:bg-cyan-950/30", text: "text-cyan-600 dark:text-cyan-400", icon: <Tv className="size-4" /> },
  小红书: { bg: "bg-rose-50 dark:bg-rose-950/30", text: "text-rose-600 dark:text-rose-400", icon: <BookOpen className="size-4" /> },
  澎湃: { bg: "bg-indigo-50 dark:bg-indigo-950/30", text: "text-indigo-600 dark:text-indigo-400", icon: <Newspaper className="size-4" /> },
  微信: { bg: "bg-green-50 dark:bg-green-950/30", text: "text-green-600 dark:text-green-400", icon: <MessageSquare className="size-4" /> },
};

const PLATFORM_SIDEBAR_LIST: { name: string; subtitle: string }[] = [
  { name: "综合榜单", subtitle: "全网热搜" },
  { name: "微博", subtitle: "热搜榜" },
  { name: "百度", subtitle: "实时热点" },
  { name: "抖音", subtitle: "热搜榜" },
  { name: "今日头条", subtitle: "热搜榜" },
  { name: "36氪", subtitle: "热榜" },
  { name: "哔哩哔哩", subtitle: "全站日榜" },
  { name: "小红书", subtitle: "热搜" },
  { name: "澎湃", subtitle: "热榜" },
  { name: "微信", subtitle: "24h热文" },
];

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
  return PLATFORM_STYLE[short] || { bg: "bg-gray-50 dark:bg-gray-800/50", text: "text-gray-600 dark:text-gray-400", icon: <Radio className="size-4" /> };
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
      <span className="shrink-0">{style.icon}</span>
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
  workflows = [],
}: InspirationClientProps) {
  const router = useRouter();

  // Core state
  const [localTopics, setLocalTopics] = useState(topics);
  const [localReadIds, setLocalReadIds] = useState<Set<string>>(
    new Set(topics.filter((t) => t.isRead).map((t) => t.id))
  );
  const [newTopicCount, setNewTopicCount] = useState(0);
  const [summaryCollapsed, setSummaryCollapsed] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter state
  const [selectedPriority, setSelectedPriority] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<"today" | "yesterday" | "3days" | "all">("all");

  // Dialog/Sheet state
  const [showSubscriptionSheet, setShowSubscriptionSheet] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(!subscriptions);
  const [showCalendarSheet, setShowCalendarSheet] = useState(false);

  // Generate article sheet state
  const [generateSheetOpen, setGenerateSheetOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<{
    title: string;
    summary?: string;
  } | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowTemplateRow | null>(
    null
  );
  const [activeCategory, setActiveCategory] = useState<OrderedCategory>("daily_brief");
  const [isGeneratePending, startGenerateTransition] = useTransition();

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

  // Crawl progress state (null = idle)
  const [crawlProgress, setCrawlProgress] = useState<{
    current: number;
    total: number;
    platform: string;
  } | null>(null);
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

  // Group workflows by category for the generate-article sheet
  const workflowsByCategory = useMemo(() => {
    return workflows.reduce((acc, w) => {
      const c = (w.category ?? "custom") as OrderedCategory;
      (acc[c] ??= []).push(w);
      return acc;
    }, {} as Partial<Record<OrderedCategory, WorkflowTemplateRow[]>>);
  }, [workflows]);

  // Pick a sensible initial active tab when the sheet opens
  useEffect(() => {
    if (!generateSheetOpen) return;
    const firstNonEmpty = ORDERED_CATEGORIES.find(
      (c) => (workflowsByCategory[c]?.length ?? 0) > 0
    );
    if (firstNonEmpty) {
      setActiveCategory(firstNonEmpty);
    }
  }, [generateSheetOpen, workflowsByCategory]);

  const baseTopics = useMemo(() => {
    return localTopics;
  }, [localTopics]);

  const priorityStats = useMemo(() => {
    const counts: Record<string, number> = { P0: 0, P1: 0, P2: 0 };
    for (const t of baseTopics) counts[t.priority] = (counts[t.priority] || 0) + 1;
    return [
      { key: "P0", label: "P0 必追", count: counts.P0, color: "bg-red-600 text-white", inactiveColor: "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400", desc: "跨3+平台且热度>90，全网爆点级话题，需立即跟进" },
      { key: "P1", label: "P1 建议", count: counts.P1, color: "bg-orange-500 text-white", inactiveColor: "bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400", desc: "跨2+平台或热度较高，建议安排跟进报道" },
      { key: "P2", label: "P2 关注", count: counts.P2, color: "bg-gray-600 text-white dark:bg-gray-500", inactiveColor: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", desc: "单平台热点，持续关注动态，必要时升级" },
    ].filter((p) => p.count > 0);
  }, [baseTopics]);

  const filteredTopics = useMemo(() => {
    let result = baseTopics;

    // Apply date filter
    if (dateFilter !== "all") {
      const cutoff = new Date();
      if (dateFilter === "today") cutoff.setHours(0, 0, 0, 0);
      else if (dateFilter === "yesterday") cutoff.setDate(cutoff.getDate() - 1);
      else if (dateFilter === "3days") cutoff.setDate(cutoff.getDate() - 3);
      result = result.filter((t) => new Date(t.discoveredAt) >= cutoff);
    }

    // Apply priority filter
    if (selectedPriority) {
      result = result.filter((t) => t.priority === selectedPriority);
    }

    // Apply platform filter
    if (selectedPlatform) {
      result = result.filter((t) =>
        t.platforms.some((p) => getPlatformShort(p) === selectedPlatform)
      );
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.summary?.toLowerCase().includes(q) ||
          t.suggestedAngles.some((a) => a.toLowerCase().includes(q))
      );
    }

    // Sort: discoveredAt desc > priority > heatScore desc
    const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2 };
    return [...result].sort((a, b) => {
      const timeA = new Date(a.discoveredAt).getTime();
      const timeB = new Date(b.discoveredAt).getTime();
      if (timeA !== timeB) return timeB - timeA;
      const pa = priorityOrder[a.priority] ?? 3;
      const pb = priorityOrder[b.priority] ?? 3;
      if (pa !== pb) return pa - pb;
      return b.heatScore - a.heatScore;
    });
  }, [baseTopics, subscribedCategories, selectedPriority, selectedPlatform, dateFilter, searchQuery]);

  // ========================
  // Actions
  // ========================

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

  const handleOpenGenerate = useCallback((topic: InspirationTopic) => {
    setSelectedTopic({ title: topic.title, summary: topic.summary });
    setSelectedWorkflow(null);
    setGenerateSheetOpen(true);
  }, []);

  const handleGenerate = useCallback(() => {
    if (!selectedWorkflow || !selectedTopic) return;
    startGenerateTransition(async () => {
      try {
        const mission = await startMission({
          title: selectedTopic.title,
          scenario: templateToScenarioSlug({
            legacyScenarioKey: selectedWorkflow.legacyScenarioKey,
            name: selectedWorkflow.name,
          }),
          workflowTemplateId: selectedWorkflow.id,
          userInstruction: selectedTopic.summary ?? selectedTopic.title,
        });
        if (mission?.id) {
          setGenerateSheetOpen(false);
          router.push(`/missions/${mission.id}`);
        }
      } catch (err) {
        console.error("[inspiration] startMission failed:", err);
      }
    });
  }, [selectedWorkflow, selectedTopic, router, startGenerateTransition]);

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

  const handleRefresh = useCallback(async () => {
    if (crawlProgress !== null) return;
    try {
      const res = await fetch("/api/inspiration/crawl", { method: "POST" });
      if (!res.ok || !res.body) {
        console.error("[refresh] 请求失败:", res.status);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const dataLine = line.startsWith("data: ") ? line.slice(6) : null;
          if (!dataLine) continue;
          try {
            const event = JSON.parse(dataLine) as {
              type: string;
              current?: number;
              total?: number;
              platform?: string;
              newTopics?: number;
              updatedTopics?: number;
              message?: string;
            };
            if (event.type === "progress" && typeof event.current === "number" && typeof event.total === "number") {
              setCrawlProgress({
                current: event.current,
                total: event.total,
                platform: event.platform ?? "",
              });
            } else if (event.type === "complete" || event.type === "error") {
              setCrawlProgress(null);
              router.refresh();
            }
          } catch {
            // Malformed JSON — skip
          }
        }
      }
    } catch (err) {
      console.error("[refresh] 抓取失败:", err);
      setCrawlProgress(null);
    }
  }, [crawlProgress, router]);

  const handleNewTopicClick = useCallback(async () => {
    setNewTopicCount(0);
    pageLoadTimeRef.current = new Date().toISOString();
    await refreshInspirationData();
    router.refresh();
  }, [router]);

  const handleMarkRead = useCallback((topicId: string) => {
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
  }, [localReadIds]);

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
            disabled={crawlProgress !== null}
            className="bg-blue-600 hover:bg-blue-700 text-white border-0"
          >
            <RefreshCw size={14} className={crawlProgress !== null ? "animate-spin mr-2" : "mr-2"} />
            {crawlProgress !== null ? "正在抓取..." : "刷新热点"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto h-full flex flex-col">
      <PageHeader
        title="热点发现"
        description="全网热点聚合 · AI 选题建议"
      />
      {/* Three-column layout */}
      <div className="flex flex-1 min-h-0 rounded-xl border border-gray-200 dark:border-white/5 overflow-hidden">
        {/* ======================== Column 1: Platform Sidebar ======================== */}
        <div className="w-[140px] shrink-0 flex flex-col min-h-0 border-r border-gray-200 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.01]">
          <ScrollArea className="h-full">
            <div className="py-2 px-1.5 space-y-0.5">
              {PLATFORM_SIDEBAR_LIST.map((item) => {
                const isAll = item.name === "综合榜单";
                const isActive = isAll ? !selectedPlatform : selectedPlatform === item.name;
                const style = isAll
                  ? { icon: <Globe className="size-[18px]" />, bg: "", text: "" }
                  : PLATFORM_STYLE[item.name] || { icon: <Radio className="size-[18px]" />, bg: "", text: "" };

                return (
                  <button
                    key={item.name}
                    onClick={() => setSelectedPlatform(isAll ? null : item.name)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all duration-150",
                      isActive
                        ? "bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-200/50 dark:ring-blue-500/20"
                        : "hover:bg-gray-100 dark:hover:bg-white/[0.04]"
                    )}
                  >
                    <span className="shrink-0">{style.icon}</span>
                    <div className="min-w-0">
                      <div className={cn(
                        "text-xs font-medium truncate",
                        isActive
                          ? "text-blue-700 dark:text-blue-300"
                          : "text-gray-700 dark:text-gray-300"
                      )}>
                        {item.name}
                      </div>
                      <div className={cn(
                        "text-[10px] truncate",
                        isActive
                          ? "text-blue-500/70 dark:text-blue-400/50"
                          : "text-gray-400 dark:text-gray-500"
                      )}>
                        {item.subtitle}
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* Divider */}
              <div className="h-px bg-gray-200 dark:bg-white/5 mx-2 my-2" />

              {/* Settings & Refresh */}
              <button
                onClick={() => setShowSubscriptionSheet(true)}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-colors"
              >
                <Settings size={14} className="text-gray-400 dark:text-gray-500 shrink-0" />
                <span className="text-xs text-gray-500 dark:text-gray-400">订阅管理</span>
              </button>
              <button
                onClick={() => setShowCalendarSheet(true)}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-colors"
              >
                <CalendarPlus size={14} className="text-gray-400 dark:text-gray-500 shrink-0" />
                <span className="text-xs text-gray-500 dark:text-gray-400">日历事件</span>
              </button>
              <button
                onClick={handleRefresh}
                disabled={crawlProgress !== null}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-left hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-colors"
              >
                <RefreshCw size={14} className={cn("text-gray-400 dark:text-gray-500 shrink-0", crawlProgress !== null && "animate-spin")} />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {crawlProgress !== null ? "抓取中..." : "刷新数据"}
                </span>
              </button>
            </div>
          </ScrollArea>
        </div>

        {/* ======================== Column 2: Main Content ======================== */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-x-hidden">
          {/* Crawl Progress Bar */}
          {crawlProgress && (
            <div className="border-b border-gray-200 dark:border-white/5">
              <div className="px-4 py-2 flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${(crawlProgress.current / crawlProgress.total) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                  {crawlProgress.current}/{crawlProgress.total} 平台已完成
                </span>
              </div>
            </div>
          )}
          {/* AI Summary Bar (thin, collapsible) */}
          <AISummaryBar
            delta={meeting.delta}
            collapsed={summaryCollapsed}
            onToggle={() => setSummaryCollapsed(!summaryCollapsed)}
            onMarkAllRead={handleMarkAllRead}
            lastViewedAt={lastViewedAt}
          />

          {/* Top bar: Date filter + Search */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-200 dark:border-white/5">
            <div className="flex items-center gap-1">
              {(
                [
                  { key: "all", label: "全部" },
                  { key: "today", label: "今日" },
                  { key: "yesterday", label: "昨日" },
                  { key: "3days", label: "近3天" },
                ] as const
              ).map((item) => (
                <button
                  key={item.key}
                  onClick={() => setDateFilter(item.key)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    dateFilter === item.key
                      ? "bg-gray-900 dark:bg-white/90 text-white dark:text-gray-900"
                      : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="ml-auto relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索热点..."
                className="h-8 w-48 rounded-lg bg-gray-100 dark:bg-white/5 pl-8 pr-3 text-xs text-gray-700 dark:text-gray-300 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:ring-1 focus:ring-blue-500/30 transition-all"
              />
            </div>
          </div>

          {/* Priority filter row */}
          <div className="border-b border-gray-200 dark:border-white/5">
            <TooltipProvider delayDuration={200}>
              <div className="flex items-center gap-1.5 px-4 py-2 bg-gray-50/50 dark:bg-white/[0.02]">
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
                  <Tooltip key={p.key}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setSelectedPriority(selectedPriority === p.key ? null : p.key)}
                        className={cn(
                          "shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                          selectedPriority === p.key ? p.color : p.inactiveColor
                        )}
                      >
                        {p.label}
                        <span className="ml-1 opacity-70">{p.count}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[240px] text-xs">
                      <p>{p.desc}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
                {/* Filtered count */}
                <span className={cn(
                  "ml-auto text-xs shrink-0 transition-colors",
                  (selectedPriority || selectedPlatform || dateFilter !== "all" || searchQuery)
                    ? "text-blue-600 dark:text-blue-400 font-medium"
                    : "text-gray-400 dark:text-gray-500"
                )}>
                  {filteredTopics.length} 条
                </span>
              </div>
            </TooltipProvider>
          </div>

          {/* Topic list area */}
          <div className="flex-1 min-h-0 relative">
            <ScrollArea className="h-full">
              <div className="p-4">
                <TopicList
                  topics={filteredTopics}
                  readIds={localReadIds}
                  trackedIds={trackedIds}
                  missionPendingId={missionPendingId}
                  onStartMission={handleStartMission}
                  onMarkRead={handleMarkRead}
                  subscribedCategories={subscribedCategories}
                  onGenerate={handleOpenGenerate}
                />
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

        {/* ======================== Column 3: Right Panel ======================== */}
        <div className="w-[380px] shrink-0 flex flex-col min-h-0 overflow-x-hidden border-l border-gray-200 dark:border-white/5">
          <Tabs defaultValue="briefing" className="flex flex-col h-full">
            <TabsList variant="line" className="px-3 pt-1 shrink-0 w-full justify-start rounded-none border-b border-gray-200 dark:border-white/5 bg-transparent h-auto">
              <TabsTrigger value="briefing" className="text-xs rounded-none border-0">
                编辑简报
              </TabsTrigger>
              <TabsTrigger value="inspiration" className="text-xs rounded-none border-0">
                灵感整理
              </TabsTrigger>
            </TabsList>
            <TabsContent value="briefing" className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col">
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
                    onAddCalendarEvent={() => setShowCalendarSheet(true)}
                  />
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="inspiration" className="flex-1 min-h-0 mt-0 data-[state=active]:flex data-[state=active]:flex-col">
              <InspirationInput />
            </TabsContent>
          </Tabs>
        </div>
      </div>

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

      <GenerateArticleSheet
        open={generateSheetOpen}
        onOpenChange={setGenerateSheetOpen}
        topic={selectedTopic}
        workflows={workflows}
        workflowsByCategory={workflowsByCategory}
        activeCategory={activeCategory}
        onActiveCategoryChange={setActiveCategory}
        selectedWorkflow={selectedWorkflow}
        onSelectWorkflow={setSelectedWorkflow}
        onGenerate={handleGenerate}
        isPending={isGeneratePending}
      />
    </div>
  );
}

// ========================
// AI Summary Bar (thin collapsible bar)
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
// Column 2: Topic List (clean numbered list, no expand/collapse)
// ========================

const PAGE_SIZE = 20;

function TopicList({
  topics,
  readIds,
  trackedIds,
  missionPendingId,
  onStartMission,
  onMarkRead,
  subscribedCategories,
  onGenerate,
}: {
  topics: InspirationTopic[];
  readIds: Set<string>;
  trackedIds: Set<string>;
  missionPendingId: string | null;
  onStartMission: (id: string) => void;
  onMarkRead: (id: string) => void;
  subscribedCategories: Set<string>;
  onGenerate: (topic: InspirationTopic) => void;
}) {
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset to first page when filter changes (topics array identity changes)
  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [topics]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setDisplayCount((prev) => Math.min(prev + PAGE_SIZE, topics.length));
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [topics.length]);

  if (topics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Eye size={24} className="text-gray-300 dark:text-gray-600 mb-2" />
        <p className="text-xs text-gray-400 dark:text-gray-500">暂无匹配的热点</p>
      </div>
    );
  }

  const visibleTopics = topics.slice(0, displayCount);
  const hasMore = displayCount < topics.length;

  return (
    <div className="space-y-0">
      {visibleTopics.map((topic, index) => {
        const isRead = readIds.has(topic.id);
        const isTracked = trackedIds.has(topic.id);
        const isMissionPending = missionPendingId === topic.id;
        const isTop3 = index < 3;
        const isP0 = topic.priority === "P0";
        const cat = normalizeCategory(topic.category);
        const isSubscribed = subscribedCategories.has(cat);

        const angles = topic.enrichedOutlines.length > 0
          ? topic.enrichedOutlines
          : topic.suggestedAngles.map((a) => ({ angle: a, points: [] as string[], wordCount: "", style: "" }));

        return (
          <div
            key={topic.id}
            className={cn(
              "py-4 px-3 transition-all duration-150 relative",
              "hover:bg-blue-100/80 dark:hover:bg-blue-900/30",
              isTracked && "bg-blue-50/40 dark:bg-blue-950/20 border-l-4 border-l-blue-500",
              index < topics.length - 1 && "border-b border-gray-200/80 dark:border-white/[0.06]"
            )}
            onMouseEnter={() => onMarkRead(topic.id)}
          >
            <div className="flex gap-3">
              {/* Number column */}
              <div className="w-8 shrink-0 flex justify-center pt-0.5">
                {(isTop3 || isP0) ? (
                  <span className="text-lg">🔥</span>
                ) : (
                  <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-xs font-semibold text-gray-400 dark:text-gray-500">
                    {index + 1}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Title row */}
                <div className="flex items-start gap-2 mb-1">
                  {topic.sourceUrl && topic.sourceUrl.startsWith("http") ? (
                    <a
                      href={topic.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "text-base leading-snug flex-1 group/link inline-flex items-start gap-1 hover:underline",
                        isRead
                          ? "text-gray-500 dark:text-gray-500 font-normal"
                          : "text-gray-900 dark:text-gray-100 font-semibold"
                      )}
                    >
                      {topic.title}
                      <ExternalLink size={12} className="shrink-0 mt-1.5 opacity-0 group-hover/link:opacity-50 transition-opacity" />
                    </a>
                  ) : (
                    <h4 className={cn(
                      "text-base leading-snug flex-1",
                      isRead
                        ? "text-gray-500 dark:text-gray-500 font-normal"
                        : "text-gray-900 dark:text-gray-100 font-semibold"
                    )}>
                      {topic.title}
                    </h4>
                  )}
                  {!isRead && (
                    <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0 mt-2" />
                  )}
                </div>

                {/* Badges row */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <PriorityBadge priority={topic.priority} />
                  <HeatScoreBadge score={topic.heatScore} />
                  <TrendIndicator trend={topic.trend} />
                  {cat && (
                    <span className={cn(
                      "inline-flex items-center px-1.5 py-0 rounded-full text-[11px] font-medium",
                      isSubscribed
                        ? `${getCategoryStyle(cat).bg} ${getCategoryStyle(cat).text}`
                        : "bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400"
                    )}>
                      {cat}
                    </span>
                  )}
                </div>

                {/* Summary */}
                {topic.summary && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2 mb-2">
                    {topic.summary}
                  </p>
                )}

                {/* AI Angles card */}
                {angles.length > 0 && (
                  <div className="bg-blue-50/50 dark:bg-blue-950/20 rounded-lg p-3 mb-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 mb-2">
                      <Sparkles size={12} />
                      AI要点提炼
                    </div>
                    <div className="space-y-1">
                      {angles.map((outline, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                          <span className="text-blue-500 dark:text-blue-400 font-semibold shrink-0 mt-px">{i + 1}.</span>
                          <span>{outline.angle}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bottom row: platforms + time + actions */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {topic.platforms.slice(0, 3).map((p) => (
                    <PlatformTag key={p} name={p} size="xs" />
                  ))}
                  {topic.platforms.length > 3 && (
                    <span className="text-[11px] text-gray-300 dark:text-gray-600">+{topic.platforms.length - 3}</span>
                  )}
                  <span className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-0.5">
                    <Clock size={8} />
                    {formatTime(topic.discoveredAt)} · {timeAgo(topic.discoveredAt)}
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    {isTracked ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                        <Radar size={10} className="animate-pulse" />
                        追踪中
                      </span>
                    ) : (
                      <button
                        onClick={() => onStartMission(topic.id)}
                        disabled={isMissionPending}
                        className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-0.5 transition-colors"
                      >
                        <Rocket size={10} />
                        {isMissionPending ? "创建中..." : "启动追踪"}
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onGenerate(topic);
                      }}
                      className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-0.5 ml-2 transition-colors"
                    >
                      <Play size={10} />
                      生成稿件
                    </button>
                    <button
                      className="text-[11px] text-gray-400 dark:text-gray-500 hover:text-amber-600 dark:hover:text-amber-400 flex items-center gap-0.5 ml-2 transition-colors"
                    >
                      <Star size={10} />
                      收藏
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {/* Sentinel for infinite scroll */}
      <div ref={sentinelRef} className="h-1" />
      {hasMore && (
        <div className="flex justify-center py-4">
          <span className="text-xs text-gray-400 dark:text-gray-500">加载更多...</span>
        </div>
      )}
    </div>
  );
}

// ========================
// Floating Notification
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
// Column 3: Editorial Briefing
// ========================

function EditorialBriefing({
  meeting,
  calendarEvents,
  p0Count,
  p1Count,
  p2Count,
  onTrackAllP0,
  isTrackingAll,
  onAddCalendarEvent,
}: {
  meeting: EditorialMeeting;
  calendarEvents: CalendarEvent[];
  p0Count: number;
  p1Count: number;
  p2Count: number;
  onTrackAllP0: () => void;
  isTrackingAll: boolean;
  onAddCalendarEvent: () => void;
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
          <BarChart3 size={14} />
          优先级分布
        </h3>
        <div className="space-y-3">
          {[
            { label: "P0 必追", desc: "跨3+平台且热度>90，全网爆点，需立即跟进", count: p0Count, color: "bg-red-500", textColor: "text-red-600 dark:text-red-400", dotColor: "bg-red-500" },
            { label: "P1 建议", desc: "跨2+平台或热度较高，建议安排跟进报道", count: p1Count, color: "bg-orange-500", textColor: "text-orange-600 dark:text-orange-400", dotColor: "bg-orange-500" },
            { label: "P2 关注", desc: "单平台热点，持续关注，必要时升级", count: p2Count, color: "bg-gray-500", textColor: "text-gray-600 dark:text-gray-400", dotColor: "bg-gray-400" },
          ].map((item) => (
            <div key={item.label} className="space-y-1">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 w-16 shrink-0">
                  <span className={cn("w-2 h-2 rounded-full shrink-0", item.dotColor)} />
                  <span className={cn("text-sm font-semibold", item.textColor)}>{item.label}</span>
                </div>
                <div className="flex-1 h-2.5 rounded-full bg-gray-100 dark:bg-white/5 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", item.color)}
                    style={{ width: total > 0 ? `${(item.count / total) * 100}%` : "0%" }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-8 text-right">{item.count}</span>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 ml-[22px]">{item.desc}</p>
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
      <GlassCard variant="default" padding="md">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
            <Calendar size={12} />
            近3日事件
          </h3>
          <button
            onClick={onAddCalendarEvent}
            className="p-1 rounded-md text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <CalendarPlus size={14} />
          </button>
        </div>
        {next3DaysEvents.length > 0 ? (
          <div className="space-y-1.5">
            {next3DaysEvents.map((ev) => (
              <div key={ev.id} className="flex items-center gap-2 text-xs">
                <span>{EVENT_TYPE_EMOJI[ev.eventType] ?? "📅"}</span>
                <span className="text-gray-700 dark:text-gray-300 truncate flex-1">{ev.name}</span>
                <span className="text-gray-400 dark:text-gray-500">{new Date(ev.startDate).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 dark:text-gray-500">暂无近期事件，点击右上角添加</p>
        )}
      </GlassCard>

      {/* Track all P0 button */}
      {p0Count > 0 && (
        <Button
          onClick={onTrackAllP0}
          disabled={isTrackingAll}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white border-0"
        >
          <Rocket size={14} className="mr-1.5" />
          {isTrackingAll ? "启动中..." : `一键追踪全部 P0（${p0Count} 条）`}
        </Button>
      )}

    </div>
  );
}

// ========================
// Inspiration Input Panel (小策灵感整理)
// ========================

interface InspirationMessage {
  role: "user" | "assistant";
  content: string;
}

interface OrganizeResult {
  title: string;
  summary: string;
  angles: string[];
  relatedKeywords: string[];
  confidence: "high" | "medium" | "low";
}

function InspirationResultCard({ content }: { content: string }) {
  let result: OrganizeResult | null = null;
  try {
    // Strip markdown code fences if present
    const cleaned = content.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    result = JSON.parse(cleaned) as OrganizeResult;
  } catch {
    // Fall back to plain text
  }

  if (!result) {
    return (
      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
        {content}
      </p>
    );
  }

  const confidenceLabel: Record<string, { label: string; color: string }> = {
    high: { label: "高", color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30" },
    medium: { label: "中", color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30" },
    low: { label: "低", color: "text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-white/5" },
  };
  const conf = confidenceLabel[result.confidence] ?? confidenceLabel.medium;

  return (
    <div className="space-y-3">
      {/* Title + confidence */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug flex-1">
          {result.title}
        </p>
        <span className={cn("shrink-0 text-[11px] font-medium px-1.5 py-0.5 rounded-full", conf.color)}>
          置信度·{conf.label}
        </span>
      </div>

      {/* Summary */}
      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
        {result.summary}
      </p>

      {/* Angles */}
      {result.angles.length > 0 && (
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">建议角度</p>
          {result.angles.map((angle, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-gray-700 dark:text-gray-300">
              <span className="text-blue-500 dark:text-blue-400 font-semibold shrink-0 mt-px">{i + 1}.</span>
              <span>{angle}</span>
            </div>
          ))}
        </div>
      )}

      {/* Keywords */}
      {result.relatedKeywords.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {result.relatedKeywords.map((kw) => (
            <span
              key={kw}
              className="text-[11px] px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400"
            >
              {kw}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function InspirationInput() {
  const [messages, setMessages] = useState<InspirationMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: InspirationMessage = { role: "user", content: trimmed };
    const history = messages.slice(-10); // send last 10 messages as context

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // Resize textarea back to default
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const res = await fetch("/api/inspiration/organize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`请求失败: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const lines = part.split("\n");
          let eventType = "";
          let dataLine = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) eventType = line.slice(7).trim();
            if (line.startsWith("data: ")) dataLine = line.slice(6);
          }
          if (!dataLine) continue;

          try {
            const parsed = JSON.parse(dataLine) as { content?: string; message?: string };
            if (eventType === "result" && parsed.content) {
              assistantContent = parsed.content;
            } else if (eventType === "error") {
              assistantContent = parsed.message ?? "AI 处理失败";
            }
          } catch {
            // Malformed JSON — skip
          }
        }
      }

      if (assistantContent) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: assistantContent },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: err instanceof Error ? err.message : "请求失败，请稍后重试",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize textarea
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  return (
    <div className="flex flex-col h-full p-4">
      {/* Empty state hint */}
      {messages.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center mb-3">
            <Sparkles size={24} className="text-blue-500 dark:text-blue-400" />
          </div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">灵感整理</h4>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">输入你的灵感或想法</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">小策会帮你整理成结构化选题建议</p>
        </div>
      )}

      {/* Message history */}
      {messages.length > 0 && (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-3 mb-3 pr-1">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {msg.role === "assistant" && (
                  <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center shrink-0 mt-0.5 mr-1.5">
                    <Sparkles size={10} className="text-blue-500 dark:text-blue-400" />
                  </div>
                )}
                <div
                  className={cn(
                    "rounded-xl px-3 py-2 max-w-[85%] text-xs",
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 dark:bg-white/5 text-gray-800 dark:text-gray-200"
                  )}
                >
                  {msg.role === "assistant" ? (
                    <InspirationResultCard content={msg.content} />
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center shrink-0 mt-0.5 mr-1.5">
                  <Sparkles size={10} className="text-blue-500 dark:text-blue-400" />
                </div>
                <div className="rounded-xl px-3 py-2 bg-gray-100 dark:bg-white/5 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                  <span className="inline-flex gap-0.5">
                    <span className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce [animation-delay:0ms]" />
                    <span className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce [animation-delay:300ms]" />
                  </span>
                  小策正在整理...
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}

        {/* Input area */}
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="输入你的灵感或想法，小策帮你整理成选题..."
            rows={4}
            disabled={isLoading}
            className={cn(
              "flex-1 resize-none rounded-xl bg-gray-100 dark:bg-white/5 px-4 py-3 text-sm text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none focus:ring-1 focus:ring-blue-500/30 transition-all min-h-[96px]",
              isLoading && "opacity-60 cursor-not-allowed"
            )}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={cn(
              "shrink-0 w-9 h-9 rounded-full flex items-center justify-center border-0 transition-all",
              input.trim() && !isLoading
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-gray-200 dark:bg-white/10 text-gray-400 dark:text-gray-500 cursor-not-allowed"
            )}
          >
            <ArrowUp size={16} />
          </button>
        </div>

        {/* Hint */}
        <p className="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500 text-center">
          Enter 发送 · Shift+Enter 换行
        </p>
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
            设置订阅分类，热点发现将优先展示你关注的领域
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

// ========================
// Generate Article Sheet
// ========================

function GenerateArticleSheet({
  open,
  onOpenChange,
  topic,
  workflows,
  workflowsByCategory,
  activeCategory,
  onActiveCategoryChange,
  selectedWorkflow,
  onSelectWorkflow,
  onGenerate,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topic: { title: string; summary?: string } | null;
  workflows: WorkflowTemplateRow[];
  workflowsByCategory: Partial<Record<OrderedCategory, WorkflowTemplateRow[]>>;
  activeCategory: OrderedCategory;
  onActiveCategoryChange: (c: OrderedCategory) => void;
  selectedWorkflow: WorkflowTemplateRow | null;
  onSelectWorkflow: (wf: WorkflowTemplateRow) => void;
  onGenerate: () => void;
  isPending: boolean;
}) {
  const nonEmptyCategories = ORDERED_CATEGORIES.filter(
    (c) => (workflowsByCategory[c]?.length ?? 0) > 0
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader>
          <SheetTitle>生成稿件</SheetTitle>
          <SheetDescription>
            选择一个工作流，AI 员工会自动执行
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 space-y-4">
          {/* Topic summary */}
          <div className="text-sm">
            <div className="text-muted-foreground text-xs">选题</div>
            <div className="mt-1 font-medium text-gray-900 dark:text-gray-100">
              {topic?.title ?? "—"}
            </div>
            {topic?.summary && (
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                {topic.summary}
              </div>
            )}
          </div>

          {/* Workflow picker */}
          {workflows.length === 0 ? (
            <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">
              当前组织暂无可用工作流
            </div>
          ) : (
            <Tabs
              value={activeCategory}
              onValueChange={(v) => onActiveCategoryChange(v as OrderedCategory)}
            >
              <TabsList variant="line" className="w-full justify-start overflow-x-auto">
                {nonEmptyCategories.map((c) => (
                  <TabsTrigger key={c} value={c}>
                    {CATEGORY_LABELS[c]} ({workflowsByCategory[c]?.length ?? 0})
                  </TabsTrigger>
                ))}
              </TabsList>
              {nonEmptyCategories.map((c) => (
                <TabsContent key={c} value={c} className="mt-3 space-y-2">
                  {(workflowsByCategory[c] ?? []).map((wf) => {
                    const IconComp =
                      wf.icon && (LucideIcons as Record<string, unknown>)[wf.icon]
                        ? ((LucideIcons as Record<string, unknown>)[
                            wf.icon
                          ] as React.ComponentType<{ size?: number | string }>)
                        : FileText;
                    const isSelected = selectedWorkflow?.id === wf.id;
                    const team = Array.isArray(wf.defaultTeam)
                      ? (wf.defaultTeam as string[])
                      : [];
                    return (
                      <button
                        key={wf.id}
                        type="button"
                        onClick={() => onSelectWorkflow(wf)}
                        className={cn(
                          "w-full text-left p-3 rounded-lg transition",
                          isSelected
                            ? "bg-sky-50 dark:bg-sky-950/30 ring-2 ring-sky-400"
                            : "hover:bg-muted/50"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <IconComp size={18} />
                          <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                            {wf.name}
                          </div>
                        </div>
                        {wf.description && (
                          <div className="mt-1 text-xs text-muted-foreground line-clamp-2">
                            {wf.description}
                          </div>
                        )}
                        <div className="mt-2 flex gap-1 items-center text-xs">
                          {team.length > 0 && (
                            <>
                              <span className="text-muted-foreground">团队：</span>
                              <div className="flex -space-x-1">
                                {team.slice(0, 4).map((emp) => (
                                  <EmployeeAvatar
                                    key={emp}
                                    employeeId={emp}
                                    size="xs"
                                  />
                                ))}
                              </div>
                            </>
                          )}
                          {wf.appChannelSlug && (
                            <span className="ml-auto text-muted-foreground">
                              → {wf.appChannelSlug}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>

        <SheetFooter className="border-t p-4">
          <Button
            variant="ghost"
            disabled={!selectedWorkflow || isPending || !topic}
            onClick={onGenerate}
            className="w-full"
          >
            {isPending ? "生成中..." : "立即生成"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import { useState, useTransition, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { seedBenchmarkTestData, generateBenchmarkForTopic } from "@/app/actions/benchmarking";
import type { TopicCandidate } from "@/lib/dal/benchmarking";
import { KPIComparisonBar } from "@/components/shared/kpi-comparison-bar";
import { RealTimeIndicator } from "@/components/shared/realtime-indicator";
import { CompareTable } from "@/components/shared/compare-table";
import type { CompareRow } from "@/components/shared/compare-table";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { StatCard } from "@/components/shared/stat-card";
import { RadarChartCard } from "@/components/charts/radar-chart-card";
import { GaugeChart } from "@/components/charts/gauge-chart";
import { DonutChartCard } from "@/components/charts/donut-chart-card";
import { AreaChartCard } from "@/components/charts/area-chart-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search,
  Clock,
  Flame,
  AlertTriangle,
  CheckCircle,
  Crosshair,
  FileBarChart,
  Lightbulb,
  ArrowUpRight,
  Target,
  Shield,
  BarChart3,
  TrendingUp,
  Activity,
  Bell,
  Settings,
  Plus,
  FileText,
  Zap,
  Loader2,
} from "lucide-react";
import type {
  BenchmarkTopic,
  MissedTopic,
  WeeklyReport,
  MonitoredPlatformUI,
  PlatformContentUI,
  BenchmarkAlertUI,
  PlatformComparisonRow,
  CoverageOverview,
  BenchmarkArticleUI,
} from "@/lib/types";
import { crawlPlatformDirect } from "@/app/actions/benchmarking";
import { PlatformConfigSheet } from "./platform-config-sheet";
import { PlatformStatusTree } from "./platform-status-tree";
import { CrawlFeedList } from "./crawl-feed-list";
import { AlertCenter } from "./alert-center";
import { ComparisonFilterBar } from "./comparison-filter-bar";
import { AISuggestionPanel } from "./ai-suggestion-panel";
import { MultiPlatformTable } from "./multi-platform-table";
import { AIPredictionPanel } from "./ai-prediction-panel";
import { ExportButtons } from "./export-buttons";
import { ArticleCompareView } from "./article-compare-view";
import { MissedTopicDetail } from "./missed-topic-detail";

const priorityColors: Record<string, string> = {
  high: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200",
  medium: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200",
  low: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700",
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  missed: {
    label: "未覆盖",
    color: "bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border-red-100",
    icon: <AlertTriangle size={12} />,
  },
  tracking: {
    label: "追踪中",
    color: "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800/30",
    icon: <Crosshair size={12} />,
  },
  resolved: {
    label: "已补发",
    color: "bg-green-50 dark:bg-green-950/50 text-green-600 dark:text-green-400 border-green-100",
    icon: <CheckCircle size={12} />,
  },
};

interface BenchmarkingClientProps {
  benchmarkTopics: BenchmarkTopic[];
  missedTopics: MissedTopic[];
  weeklyReport: WeeklyReport | null;
  dimensions: string[];
  missedTypeDistribution: { name: string; value: number; color: string }[];
  platforms: MonitoredPlatformUI[];
  recentContent: PlatformContentUI[];
  alerts: BenchmarkAlertUI[];
  alertStats: { total: number; urgent: number; high: number; new: number; actioned: number };
  unreadAlertCount: number;
  coverageOverview: CoverageOverview;
  multiPlatformComparison: PlatformComparisonRow[];
  topicCandidates: TopicCandidate[];
  publishedArticles: BenchmarkArticleUI[];
}

export function BenchmarkingClient({
  benchmarkTopics,
  missedTopics,
  weeklyReport,
  dimensions,
  missedTypeDistribution,
  platforms,
  recentContent,
  alerts,
  alertStats,
  unreadAlertCount,
  coverageOverview,
  multiPlatformComparison,
  topicCandidates,
  publishedArticles,
}: BenchmarkingClientProps) {
  const router = useRouter();
  const [selectedTopicId, setSelectedTopicId] = useState(benchmarkTopics[0]?.id || "");
  const [platformConfigOpen, setPlatformConfigOpen] = useState(false);
  const [selectedPlatformFilter, setSelectedPlatformFilter] = useState("all");
  const [timeRange, setTimeRange] = useState("7d");
  const [isSeedPending, startSeedTransition] = useTransition();
  const [seedResult, setSeedResult] = useState<string | null>(null);

  // Topic picker state
  const [topicSearch, setTopicSearch] = useState("");
  const [showTopicDropdown, setShowTopicDropdown] = useState(false);
  const [isGenerating, startGenerateTransition] = useTransition();
  const topicPickerRef = useRef<HTMLDivElement>(null);

  // Compare tab: selected published article
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  // Missed topics: expanded detail
  const [expandedMissedId, setExpandedMissedId] = useState<string | null>(null);

  // Auto-crawl state
  const [crawlProgress, setCrawlProgress] = useState<Record<string, "idle" | "loading" | "done" | "error">>({});
  const [isCrawling, setIsCrawling] = useState(false);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (topicPickerRef.current && !topicPickerRef.current.contains(e.target as Node)) {
        setShowTopicDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredCandidates = useMemo(() => {
    if (!topicSearch.trim()) return topicCandidates.slice(0, 15);
    const q = topicSearch.toLowerCase();
    return topicCandidates
      .filter((c) => c.title.toLowerCase().includes(q))
      .slice(0, 15);
  }, [topicSearch, topicCandidates]);

  function handleGenerateBenchmark(title: string) {
    setTopicSearch(title);
    setShowTopicDropdown(false);
    startGenerateTransition(async () => {
      await generateBenchmarkForTopic(title);
      router.refresh();
    });
  }

  const hasData = recentContent.length > 0 || benchmarkTopics.length > 0 || missedTopics.length > 0;

  const selectedTopic = benchmarkTopics.find((t) => t.id === selectedTopicId) ?? benchmarkTopics[0];

  const compareRows: CompareRow[] = selectedTopic
    ? selectedTopic.mediaScores.map((ms) => ({
        media: ms.media,
        scores: ms.scores,
        total: ms.total,
        highlight: ms.isUs,
      }))
    : [];

  const radarData = selectedTopic
    ? selectedTopic.radarData.map((rd) => ({
        dimension: rd.dimension,
        us: rd.us,
        best: rd.best,
      }))
    : [];

  // Compare tab: selected article and matching competitor content
  const selectedPublishedArticle = publishedArticles.find((a) => a.id === selectedArticleId);
  const matchingCompetitorContent = useMemo(() => {
    if (!selectedPublishedArticle) return [];
    const titleWords = selectedPublishedArticle.title
      .replace(/[，。、：；！？（）【】《》""'']/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 2);
    if (titleWords.length === 0) return recentContent;
    return recentContent.filter((c) =>
      titleWords.some(
        (kw) =>
          c.title.includes(kw) ||
          c.topics.some((t) => t.includes(kw)) ||
          (c.summary && c.summary.includes(kw))
      )
    );
  }, [selectedPublishedArticle, recentContent]);

  // Auto-crawl handler
  async function handleAutoCrawl() {
    if (platforms.length === 0) return;
    setIsCrawling(true);
    const initial: Record<string, "idle" | "loading" | "done" | "error"> = {};
    for (const p of platforms) initial[p.id] = "loading";
    setCrawlProgress(initial);

    await Promise.allSettled(
      platforms.map(async (p) => {
        try {
          await crawlPlatformDirect(p.id);
          setCrawlProgress((prev) => ({ ...prev, [p.id]: "done" }));
        } catch {
          setCrawlProgress((prev) => ({ ...prev, [p.id]: "error" }));
        }
      })
    );
    setIsCrawling(false);
    router.refresh();
  }

  const interceptedCount = missedTopics.filter(
    (t) => t.status === "tracking" || t.status === "resolved"
  ).length;

  const report = weeklyReport || {
    period: "",
    overallScore: 0,
    missedRate: 0,
    responseSpeed: "",
    coverageRate: 0,
    trends: [],
    gapList: [],
  };

  // Filter content by selected platform or category
  const filteredContent = (() => {
    if (selectedPlatformFilter === "all") return recentContent;
    if (selectedPlatformFilter.startsWith("cat:")) {
      const cat = selectedPlatformFilter.slice(4);
      const platformIdsInCat = new Set(
        platforms.filter((p) => p.category === cat).map((p) => p.id)
      );
      return recentContent.filter((c) => platformIdsInCat.has(c.platformId));
    }
    return recentContent.filter((c) => c.platformId === selectedPlatformFilter);
  })();

  // Empty state helper
  const EmptyState = ({ icon: Icon, title, description, action }: {
    icon: React.ElementType;
    title: string;
    description: string;
    action?: React.ReactNode;
  }) => (
    <GlassCard>
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
          <Icon size={24} className="text-gray-400 dark:text-gray-500" />
        </div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{title}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm">{description}</p>
        {action && <div className="mt-4">{action}</div>}
      </div>
    </GlassCard>
  );

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader
        title="同题对标"
        description="竞品做了我没做的秒级预警 · 同题深度拆解"
        actions={
          <div className="flex items-center gap-2">
            {!hasData && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                disabled={isSeedPending}
                onClick={() => {
                  startSeedTransition(async () => {
                    const result = await seedBenchmarkTestData();
                    setSeedResult(result.message);
                    router.refresh();
                  });
                }}
              >
                {isSeedPending ? (
                  <Activity size={14} className="mr-1 animate-spin" />
                ) : (
                  <BarChart3 size={14} className="mr-1" />
                )}
                {isSeedPending ? "填充中..." : "填充测试数据"}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setPlatformConfigOpen(true)}
            >
              <Settings size={14} className="mr-1" />
              平台配置
            </Button>
          </div>
        }
      />

      <KPIComparisonBar
        items={[
          { label: "漏题率", before: "30%", after: "~0%", improvement: "-100%" },
          { label: "响应速度", before: "慢", after: "快", improvement: "+80%" },
          { label: "对标覆盖", before: "3家", after: `${platforms.length}家`, improvement: `${Math.round(platforms.length / 3)}x` },
          { label: "分析深度", before: "基础", after: "四维度", improvement: "升级" },
        ]}
      />

      <Tabs defaultValue="dashboard" className="w-full">
        <div className="flex items-center justify-between mb-4">
          <TabsList>
          <TabsTrigger value="dashboard">
            <Activity size={14} className="mr-1" />
            监控看板
          </TabsTrigger>
          <TabsTrigger value="compare">
            <Target size={14} className="mr-1" />
            同题对标
          </TabsTrigger>
          <TabsTrigger value="missed">
            <Shield size={14} className="mr-1" />
            漏题筛查
          </TabsTrigger>
          <TabsTrigger value="alerts" className="relative">
            <Bell size={14} className="mr-1" />
            预警中心
            {unreadAlertCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {unreadAlertCount > 9 ? "9+" : unreadAlertCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="report">
            <BarChart3 size={14} className="mr-1" />
            对标报告
          </TabsTrigger>
          </TabsList>
          <RealTimeIndicator label="媒体" count={platforms.length || 20} />
        </div>

        {/* ====== Tab 1: 监控看板 ====== */}
        <TabsContent value="dashboard">
          {recentContent.length === 0 ? (
            platforms.length > 0 ? (
              <GlassCard>
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                    <Activity size={24} className="text-blue-500" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    已配置 {platforms.length} 个监控平台
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mb-4">
                    点击下方按钮立即开始抓取所有平台的最新内容
                  </p>

                  {isCrawling ? (
                    <div className="w-full max-w-md space-y-2">
                      {platforms.map((p) => (
                        <div key={p.id} className="flex items-center gap-2 text-xs">
                          <span className="w-28 truncate text-gray-600 dark:text-gray-400">{p.name}</span>
                          {crawlProgress[p.id] === "loading" && <Loader2 size={12} className="animate-spin text-blue-500" />}
                          {crawlProgress[p.id] === "done" && <CheckCircle size={12} className="text-green-500" />}
                          {crawlProgress[p.id] === "error" && <AlertTriangle size={12} className="text-red-500" />}
                          <span className="text-gray-400">
                            {crawlProgress[p.id] === "loading" ? "抓取中..." : crawlProgress[p.id] === "done" ? "完成" : crawlProgress[p.id] === "error" ? "失败" : "等待"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      className="border-0"
                      onClick={handleAutoCrawl}
                    >
                      <Zap size={14} className="mr-1.5" />
                      开始抓取
                    </Button>
                  )}
                </div>
              </GlassCard>
            ) : (
            <EmptyState
              icon={Activity}
              title="暂无监控数据"
              description="系统已配置监控平台，将在下次定时抓取后显示数据。你也可以手动触发一次抓取。"
              action={
                <Button variant="ghost" size="sm" onClick={() => setPlatformConfigOpen(true)}>
                  <Settings size={14} className="mr-1" />
                  查看平台配置
                </Button>
              }
            />
            )
          ) : (
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-3">
                <div className="sticky top-4">
                  <PlatformStatusTree
                    platforms={platforms}
                    selectedFilter={selectedPlatformFilter}
                    onFilterChange={setSelectedPlatformFilter}
                  />
                </div>
              </div>
              <div className="col-span-9">
                <GlassCard padding="none">
                  <div className="flex items-center justify-between px-4 pt-4 pb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        内容动态
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        共 {filteredContent.length} 条内容
                      </p>
                    </div>
                    <ComparisonFilterBar
                      platforms={platforms}
                      selectedPlatform={selectedPlatformFilter}
                      onPlatformChange={setSelectedPlatformFilter}
                      timeRange={timeRange}
                      onTimeRangeChange={setTimeRange}
                    />
                  </div>
                  <CrawlFeedList content={filteredContent} hideHeader />
                </GlassCard>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ====== Tab 2: 同题对标 ====== */}
        <TabsContent value="compare">
          {/* Published articles selector */}
          {publishedArticles.length > 0 && (
            <GlassCard padding="sm" className="mb-4">
              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                <FileText size={13} className="text-blue-500" />
                选择我方作品进行对标
              </h4>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {publishedArticles.slice(0, 10).map((article) => (
                  <button
                    key={article.id}
                    className={`shrink-0 text-left px-3 py-2 rounded-lg transition-colors text-xs max-w-[220px] ${
                      selectedArticleId === article.id
                        ? "bg-blue-50 dark:bg-blue-950/40 ring-1 ring-blue-300 dark:ring-blue-700"
                        : "bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                    onClick={() =>
                      setSelectedArticleId(
                        selectedArticleId === article.id ? null : article.id
                      )
                    }
                  >
                    <p className="font-medium text-gray-800 dark:text-gray-100 truncate">
                      {article.title}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                      {article.publishedAt
                        ? new Date(article.publishedAt).toLocaleDateString("zh-CN")
                        : article.status}
                    </p>
                  </button>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Article compare view when article selected */}
          {selectedArticleId && selectedPublishedArticle && (
            <div className="mb-5">
              <ArticleCompareView
                ourArticle={selectedPublishedArticle}
                competitorContent={matchingCompetitorContent}
                topicTitle={selectedPublishedArticle.title}
              />
            </div>
          )}

          {/* Topic picker — search-based flow */}
          <div className="mb-4 flex items-center gap-3">
            <div ref={topicPickerRef} className="relative flex-1 max-w-lg">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                value={topicSearch}
                onChange={(e) => {
                  setTopicSearch(e.target.value);
                  setShowTopicDropdown(true);
                }}
                onFocus={() => setShowTopicDropdown(true)}
                placeholder="输入选题关键词，或从已有文章/热点中选取..."
                className="w-full text-sm pl-9 pr-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 placeholder:text-gray-400"
              />
              {showTopicDropdown && (topicSearch.trim() || topicCandidates.length > 0) && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-72 overflow-y-auto">
                  {topicSearch.trim().length >= 2 && (
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors text-blue-600 dark:text-blue-400"
                      onClick={() => handleGenerateBenchmark(topicSearch.trim())}
                    >
                      <Plus size={14} />
                      <span>对标「{topicSearch.trim()}」</span>
                    </button>
                  )}
                  {filteredCandidates.length > 0 && (
                    <>
                      {topicSearch.trim().length >= 2 && (
                        <div className="border-t border-gray-100 dark:border-gray-800" />
                      )}
                      {filteredCandidates.map((candidate) => (
                        <button
                          key={`${candidate.source}-${candidate.id}`}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                          onClick={() => handleGenerateBenchmark(candidate.title)}
                        >
                          {candidate.source === "article" ? (
                            <FileText size={13} className="text-green-500 shrink-0" />
                          ) : (
                            <Zap size={13} className="text-amber-500 shrink-0" />
                          )}
                          <span className="truncate text-gray-700 dark:text-gray-300">{candidate.title}</span>
                          <span className="ml-auto text-[10px] text-gray-400 shrink-0">
                            {candidate.source === "article" ? "文章" : "热点"}
                          </span>
                        </button>
                      ))}
                    </>
                  )}
                  {filteredCandidates.length === 0 && topicSearch.trim().length < 2 && (
                    <div className="px-3 py-4 text-center text-xs text-gray-400">
                      输入至少2个字符搜索，或直接输入选题名称
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Existing analysis selector */}
            {benchmarkTopics.length > 0 && (
              <select
                value={selectedTopicId}
                onChange={(e) => setSelectedTopicId(e.target.value)}
                className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 max-w-xs"
              >
                {benchmarkTopics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.title}
                  </option>
                ))}
              </select>
            )}

            {selectedTopic && (
              <Badge variant="secondary">{selectedTopic.category}</Badge>
            )}
          </div>

          {/* Loading state */}
          {isGenerating && (
            <GlassCard>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Loader2 size={24} className="text-blue-500 animate-spin mb-3" />
                <p className="text-sm text-gray-600 dark:text-gray-400">正在生成对标分析...</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">系统正在匹配竞品内容并计算四维评分</p>
              </div>
            </GlassCard>
          )}

          {/* Analysis results */}
          {!isGenerating && benchmarkTopics.length === 0 && !selectedArticleId ? (
            <EmptyState
              icon={Target}
              title="选择一个话题开始对标"
              description="在上方选择我方作品，或在搜索框中输入选题关键词，系统将自动与竞品内容进行四维度对比分析。"
            />
          ) : !isGenerating && benchmarkTopics.length > 0 && (
          <>
          <div className="grid grid-cols-12 gap-5">
            {/* Left: Compare Table + Timeline */}
            <div className="col-span-8 space-y-4">
              <CompareTable rows={compareRows} dimensions={dimensions} />

              {/* Publish Timeline */}
              {selectedTopic && (
                <GlassCard>
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                    <Clock size={14} className="text-gray-400 dark:text-gray-500" />
                    发布时间线
                  </h4>
                  <div className="relative">
                    <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
                    {selectedTopic.mediaScores
                      .sort((a, b) => a.publishTime.localeCompare(b.publishTime))
                      .map((ms, i) => (
                        <div key={i} className="flex items-center gap-3 mb-3 last:mb-0 relative pl-7">
                          <div
                            className={`absolute left-1.5 w-3 h-3 rounded-full border-2 ${
                              ms.isUs
                                ? "bg-blue-500 border-blue-300"
                                : "bg-white dark:bg-gray-900 border-gray-300"
                            }`}
                          />
                          <span className="text-xs font-mono text-gray-500 dark:text-gray-400 w-12">
                            {ms.publishTime}
                          </span>
                          <span
                            className={`text-xs font-medium ${
                              ms.isUs ? "text-blue-700 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {ms.media}
                          </span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            总分 {ms.total}
                          </span>
                        </div>
                      ))}
                  </div>
                </GlassCard>
              )}

              {/* AI Suggestion Panel */}
              <AISuggestionPanel
                suggestions={
                  selectedTopic?.improvements.map((imp) => ({
                    title: "改进建议",
                    description: imp,
                  })) ?? []
                }
              />
            </div>

            {/* Right: Radar + Improvements */}
            <div className="col-span-4 space-y-4">
              <RadarChartCard
                title="四维度对比"
                data={radarData}
                series={[
                  { dataKey: "us", name: "我方", color: "#3b82f6" },
                  { dataKey: "best", name: "最佳", color: "#ef4444" },
                ]}
                height={260}
              />

              {selectedTopic && (
                <GlassCard>
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                    <Lightbulb size={14} className="text-amber-500" />
                    改进建议
                  </h4>
                  <ul className="space-y-2">
                    {selectedTopic.improvements.map((item, i) => (
                      <li
                        key={i}
                        className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed pl-3 border-l-2 border-blue-200 dark:border-blue-700/50"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </GlassCard>
              )}
            </div>
          </div>
          </>
          )}
        </TabsContent>

        {/* ====== Tab 3: 漏题筛查 ====== */}
        <TabsContent value="missed">
          {missedTopics.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="暂无漏题记录"
              description="系统运行正常，未发现遗漏选题。AI 将持续监控竞品动态，发现漏题后实时提醒。"
            />
          ) : (
          <div className="grid grid-cols-12 gap-5">
            {/* Left: Gauge + Stats + Donut */}
            <div className="col-span-4 space-y-4">
              <GaugeChart
                value={report.missedRate}
                label="漏题率"
              />

              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label="今日筛查"
                  value={missedTopics.length}
                  suffix="条"
                  icon={<Search size={18} />}
                />
                <StatCard
                  label="已拦截"
                  value={interceptedCount}
                  suffix="条"
                  icon={<Shield size={18} />}
                />
              </div>

              <GlassCard>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  漏题类型分布
                </h4>
                <DonutChartCard data={missedTypeDistribution} height={180} />
                <div className="flex flex-wrap gap-2 mt-2 justify-center">
                  {missedTypeDistribution.map((item, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">
                        {item.name} {item.value}%
                      </span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>

            {/* Right: Missed topics list */}
            <div className="col-span-8 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  漏题列表
                </h3>
                <Badge variant="outline" className="text-xs">
                  共 {missedTopics.length} 条
                </Badge>
              </div>
              {missedTopics.map((topic) => {
                const status = statusConfig[topic.status];
                const isExpanded = expandedMissedId === topic.id;
                const sourceTypeBadge: Record<string, { label: string; color: string }> = {
                  social_hot: { label: "社媒热榜", color: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-700/50" },
                  sentiment_event: { label: "舆情事件", color: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-700/50" },
                  benchmark_media: { label: "对标媒体", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-700/50" },
                };
                const stBadge = topic.sourceType ? sourceTypeBadge[topic.sourceType] : null;

                return (
                  <GlassCard
                    key={topic.id}
                    variant="interactive"
                    padding="sm"
                    className={topic.heatScore >= 80 ? "ring-1 ring-red-200 dark:ring-red-800/40 bg-red-50/30 dark:bg-red-950/10" : ""}
                  >
                    <div
                      className="cursor-pointer"
                      onClick={() => setExpandedMissedId(isExpanded ? null : topic.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${priorityColors[topic.priority]}`}
                            >
                              {topic.priority === "high"
                                ? "高优"
                                : topic.priority === "medium"
                                ? "中优"
                                : "低优"}
                            </span>
                            {stBadge && (
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${stBadge.color}`}
                              >
                                {stBadge.label}
                              </span>
                            )}
                            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                              {topic.title}
                            </h4>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <Clock size={11} />
                              {topic.discoveredAt} 发现
                            </span>
                            <span className="flex items-center gap-1">
                              <Flame size={11} className={topic.heatScore >= 80 ? "text-red-500" : "text-orange-400"} />
                              热度 {topic.heatScore}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 mt-2">
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">
                              竞品已发:
                            </span>
                            {topic.competitors.map((comp, i) => (
                              <Badge
                                key={i}
                                variant="secondary"
                                className="text-[10px] py-0"
                              >
                                {comp}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${status.color}`}
                          >
                            {status.icon}
                            {status.label}
                          </span>

                          {topic.status === "missed" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7 px-3 border-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                const params = new URLSearchParams({ topic: topic.title, source: "benchmarking" });
                                router.push(`/super-creation?${params.toString()}`);
                              }}
                            >
                              <Crosshair size={12} className="mr-1" />
                              发起跟进
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expandable detail panel */}
                    {isExpanded && (
                      <MissedTopicDetail
                        topic={topic}
                        onUpdate={() => router.refresh()}
                      />
                    )}
                  </GlassCard>
                );
              })}
            </div>
          </div>
          )}
        </TabsContent>

        {/* ====== Tab 4: 预警中心 ====== */}
        <TabsContent value="alerts">
          {alerts.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="暂无预警"
              description="系统运行正常，当前没有需要关注的对标预警。AI 将持续监控外部平台，发现重要事项后自动生成预警。"
            />
          ) : (
            <AlertCenter alerts={alerts} alertStats={alertStats} />
          )}
        </TabsContent>

        {/* ====== Tab 5: 对标报告 ====== */}
        <TabsContent value="report">
          {!weeklyReport && multiPlatformComparison.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="暂无报告数据"
              description="系统需要积累一段时间的对标数据后才能生成报告。请先确保监控平台已配置并完成过至少一次爬取分析。"
            />
          ) : (
          <div className="space-y-5">
            {/* Weekly Overview */}
            <GlassCard>
              <div className="flex items-center gap-2 mb-4">
                <FileBarChart size={16} className="text-blue-500" />
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  周报总览
                </h3>
                <Badge variant="outline" className="text-xs ml-auto">
                  {report.period}
                </Badge>
                <ExportButtons />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  label="综合评分"
                  value={report.overallScore}
                  suffix="分"
                  icon={<TrendingUp size={18} />}
                />
                <StatCard
                  label="漏题率"
                  value={`${report.missedRate}%`}
                  icon={<AlertTriangle size={18} />}
                />
                <StatCard
                  label="平均响应速度"
                  value={report.responseSpeed}
                  icon={<Clock size={18} />}
                />
                <StatCard
                  label="覆盖率"
                  value={`${report.coverageRate}%`}
                  icon={<Target size={18} />}
                />
              </div>
            </GlassCard>

            {/* Trends */}
            <div className="grid grid-cols-12 gap-5">
              <div className="col-span-6">
                <GlassCard>
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    综合评分趋势
                  </h4>
                  <AreaChartCard
                    data={report.trends}
                    dataKey="score"
                    xKey="week"
                    color="#3b82f6"
                    height={220}
                  />
                </GlassCard>
              </div>
              <div className="col-span-6">
                <GlassCard>
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    漏题率趋势
                  </h4>
                  <AreaChartCard
                    data={report.trends}
                    dataKey="missedRate"
                    xKey="week"
                    color="#ef4444"
                    height={220}
                  />
                </GlassCard>
              </div>
            </div>

            {/* Multi-Platform Comparison Table */}
            <MultiPlatformTable data={multiPlatformComparison} />

            {/* AI Prediction Panel */}
            <AIPredictionPanel coverageOverview={coverageOverview} />

            {/* Gap List */}
            <GlassCard>
              <div className="flex items-center gap-2 mb-4">
                <ArrowUpRight size={16} className="text-amber-500" />
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  差距分析与改进建议
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/25">
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                        领域
                      </th>
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                        差距
                      </th>
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                        改进建议
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.gapList.map((gap, i) => (
                      <tr
                        key={i}
                        className="border-b border-gray-50 dark:border-gray-800 hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-colors"
                      >
                        <td className="py-2.5 px-3 font-medium text-gray-800 dark:text-gray-100">
                          {gap.area}
                        </td>
                        <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">
                          <Badge variant="outline" className="text-xs">
                            {gap.gap}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400 text-xs leading-relaxed">
                          {gap.suggestion}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Platform Config Sheet */}
      <PlatformConfigSheet
        open={platformConfigOpen}
        onOpenChange={setPlatformConfigOpen}
        platforms={platforms}
      />
    </div>
  );
}

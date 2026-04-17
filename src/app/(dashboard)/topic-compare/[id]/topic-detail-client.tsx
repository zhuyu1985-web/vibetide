"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  RefreshCw,
  Eye,
  Heart,
  MessageCircle,
  Share2,
} from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { TopicCompareDetail, NetworkReport, CompetitorGroup } from "@/lib/types";
import { OverviewTab } from "./overview-tab";
import { ArticlesTab } from "./articles-tab";
import { CompetitorTab } from "./competitor-tab";

/* ─── Helpers ─── */

function formatNumber(n: number): string {
  if (n >= 10000) {
    const v = n / 10000;
    return v % 1 === 0 ? `${v}万` : `${v.toFixed(1)}万`;
  }
  return n.toLocaleString("zh-CN");
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${m}-${day} ${h}:${min}`;
}

function computeTimeSpan(earliest: string, latest: string): string {
  const diff = new Date(latest).getTime() - new Date(earliest).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}小时${mins}分`;
  return `${mins}分钟`;
}

const channelColor: Record<string, string> = {
  APP: "bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300",
  微信: "bg-green-50 text-green-600 dark:bg-green-900/40 dark:text-green-300",
  微博: "bg-purple-50 text-purple-600 dark:bg-purple-900/40 dark:text-purple-300",
  抖音: "bg-orange-50 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300",
};

/* ─── Component ─── */

interface Props {
  detail: TopicCompareDetail;
  reports: NetworkReport[];
  competitorGroups: CompetitorGroup[];
}

export function TopicDetailClient({ detail, reports, competitorGroups }: Props) {
  const router = useRouter();
  const { article, stats } = detail;
  const [isRefreshing, startRefresh] = useTransition();
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const handleRefresh = () => {
    setRefreshError(null);
    startRefresh(async () => {
      try {
        router.refresh();
      } catch (err) {
        setRefreshError(err instanceof Error ? err.message : "刷新失败");
      }
    });
  };

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* ── Breadcrumb ── */}
      <div className="mb-4">
        <Link
          href="/topic-compare"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          返回作品列表
        </Link>
      </div>

      {/* ── Article Header ── */}
      <GlassCard className="mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg text-gray-900 dark:text-gray-100 leading-relaxed">
              {article.title}
            </h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {formatDate(article.publishedAt)}
              </span>
              <div className="flex items-center gap-1">
                {article.channels.map((ch) => (
                  <span
                    key={ch}
                    className={`text-[11px] px-1.5 py-0.5 rounded ${channelColor[ch] ?? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}
                  >
                    {ch}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  {formatNumber(article.readCount)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Heart className="h-3.5 w-3.5" />
                  {formatNumber(article.likeCount)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MessageCircle className="h-3.5 w-3.5" />
                  {formatNumber(article.commentCount)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Share2 className="h-3.5 w-3.5" />
                  {formatNumber(article.shareCount)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="border-0"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />
              {isRefreshing ? "刷新中..." : "刷新数据"}
            </Button>
            {refreshError && (
              <span className="text-[11px] text-red-600 dark:text-red-400">
                {refreshError}
              </span>
            )}
          </div>
        </div>
      </GlassCard>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        <StatCard
          label="全网报道总量"
          value={stats.totalReports}
          suffix="篇"
          change={stats.trendDelta}
        />
        <GlassCard padding="md" className="bg-red-50/50 dark:bg-red-950/20">
          <p className="text-xs font-medium text-red-600 dark:text-red-400 uppercase tracking-wide">
            央级媒体报道
          </p>
          <p className="mt-1 text-2xl font-semibold text-red-700 dark:text-red-300">
            {stats.centralCount}
            <span className="text-sm font-normal text-red-500 dark:text-red-400 ml-1">篇</span>
          </p>
        </GlassCard>
        <GlassCard padding="md" className="bg-blue-50/50 dark:bg-blue-950/20">
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wide">
            省级媒体报道
          </p>
          <p className="mt-1 text-2xl font-semibold text-blue-700 dark:text-blue-300">
            {stats.provincialCount}
            <span className="text-sm font-normal text-blue-500 dark:text-blue-400 ml-1">篇</span>
          </p>
        </GlassCard>
        <StatCard label="其他媒体报道" value={stats.otherCount} suffix="篇" />
        <GlassCard padding="md" className="bg-gray-50/50 dark:bg-gray-800/30">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            报道时间跨度
          </p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {computeTimeSpan(stats.earliestTime, stats.latestTime)}
          </p>
        </GlassCard>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="overview">
        <TabsList className="mb-4 bg-transparent border-0 p-0 h-auto gap-1">
          <TabsTrigger value="overview" className="text-xs border-0 data-[state=active]:bg-accent">
            全网报道概览
          </TabsTrigger>
          <TabsTrigger value="articles" className="text-xs border-0 data-[state=active]:bg-accent">
            全网报道列表
          </TabsTrigger>
          <TabsTrigger value="competitors" className="text-xs border-0 data-[state=active]:bg-accent">
            竞品媒体对标
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab detail={detail} />
        </TabsContent>

        <TabsContent value="articles">
          <ArticlesTab reports={reports} />
        </TabsContent>

        <TabsContent value="competitors">
          <CompetitorTab competitorGroups={competitorGroups} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

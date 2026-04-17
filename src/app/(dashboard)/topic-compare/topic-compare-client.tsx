"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  ArrowUpDown,
  FileText,
  Video,
  Radio,
  Clapperboard,
  Newspaper,
  BarChart3,
  TrendingUp,
  Target,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import type { TopicCompareArticle } from "@/lib/types";

/* ─── Helpers ─── */

function formatNumber(n: number): string {
  if (n >= 10000) {
    const v = n / 10000;
    return v % 1 === 0 ? `${v}万` : `${v.toFixed(1)}万`;
  }
  return n.toLocaleString("zh-CN");
}

function isWithin24h(dateStr: string): boolean {
  return Date.now() - new Date(dateStr).getTime() < 24 * 60 * 60 * 1000;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${m}-${day} ${h}:${min}`;
}

const channelColor: Record<string, string> = {
  APP: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  微信: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  微博: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  抖音: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
};

function benchmarkBadgeColor(count: number): string {
  if (count > 30) return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
  if (count >= 10) return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  if (count > 0) return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
  return "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400";
}

function heatColor(score: number): string {
  if (score >= 80) return "bg-red-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-gray-400";
}

function heatTextColor(score: number): string {
  if (score >= 80) return "text-red-600 dark:text-red-400";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-gray-500 dark:text-gray-400";
}

const contentTypeIcon: Record<string, React.ReactNode> = {
  text: <FileText className="h-3.5 w-3.5" />,
  video: <Video className="h-3.5 w-3.5" />,
  live: <Radio className="h-3.5 w-3.5" />,
  short_video: <Clapperboard className="h-3.5 w-3.5" />,
};

const contentTypeLabel: Record<string, string> = {
  text: "图文",
  video: "视频",
  live: "直播",
  short_video: "短视频",
};

/* ─── Filter Tabs ─── */

type StatusFilter = "all" | "analyzed" | "not_analyzed";

const statusFilters: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "analyzed", label: "已分析" },
  { key: "not_analyzed", label: "未分析" },
];

/* ─── Sort ─── */

type SortField = "publishedAt" | "readCount";

/* ─── Component ─── */

interface Props {
  articles: TopicCompareArticle[];
  usingMock?: boolean;
}

export function TopicCompareClient({ articles, usingMock }: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [keyword, setKeyword] = useState("");
  const [sortField, setSortField] = useState<SortField>("publishedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  /* ─── KPI 计算 ─── */
  const kpis = useMemo(() => {
    const total = articles.length;
    const analyzed = articles.filter((a) => a.hasAnalysis).length;
    const totalBenchmarks = articles.reduce((s, a) => s + a.benchmarkCount, 0);
    const avgBenchmarks = total > 0 ? Math.round(totalBenchmarks / total) : 0;
    const totalReads = articles.reduce((s, a) => s + a.readCount, 0);
    const maxBenchmark = articles.reduce((max, a) => Math.max(max, a.benchmarkCount), 0);
    const hotArticle = articles.find((a) => a.benchmarkCount === maxBenchmark);
    return { total, analyzed, totalBenchmarks, avgBenchmarks, totalReads, hotArticle };
  }, [articles]);

  const filtered = useMemo(() => {
    let list = articles;

    if (statusFilter === "analyzed") list = list.filter((a) => a.hasAnalysis);
    if (statusFilter === "not_analyzed") list = list.filter((a) => !a.hasAnalysis);

    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      list = list.filter((a) => a.title.toLowerCase().includes(kw));
    }

    const sorted = [...list].sort((a, b) => {
      const va = sortField === "publishedAt" ? new Date(a.publishedAt).getTime() : a.readCount;
      const vb = sortField === "publishedAt" ? new Date(b.publishedAt).getTime() : b.readCount;
      return sortDir === "asc" ? va - vb : vb - va;
    });

    return sorted;
  }, [articles, statusFilter, keyword, sortField, sortDir]);

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader
        title="同题对比"
        description="以我方已发布作品为起点，对比全网媒体对同一话题的报道情况"
      />

      {usingMock && (
        <div className="mb-4 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 rounded-md px-3 py-2">
          当前展示为演示数据。组织内尚无已发布作品，或数据库尚未同步。发布稿件后将自动替换为真实数据。
        </div>
      )}

      {/* ── KPI 统计概览 ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard
          label="本周发稿"
          value={kpis.total}
          suffix="篇"
          icon={<Newspaper size={18} />}
        />
        <StatCard
          label="已对标分析"
          value={kpis.analyzed}
          suffix="篇"
          icon={<Target size={18} />}
          change={kpis.total > 0 ? Math.round((kpis.analyzed / kpis.total) * 100) : 0}
        />
        <StatCard
          label="全网同题报道"
          value={kpis.totalBenchmarks}
          suffix="篇"
          icon={<BarChart3 size={18} />}
        />
        <StatCard
          label="篇均同题数"
          value={kpis.avgBenchmarks}
          suffix="篇"
          icon={<TrendingUp size={18} />}
        />
      </div>

      {/* ── 最热选题提示 ── */}
      {kpis.hotArticle && kpis.hotArticle.benchmarkCount > 0 && (
        <GlassCard padding="sm" className="mb-5 bg-gradient-to-r from-orange-50/60 to-amber-50/60 dark:from-orange-950/20 dark:to-amber-950/20">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center shrink-0">
              <TrendingUp size={16} className="text-orange-600 dark:text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs text-gray-500 dark:text-gray-400">全网关注度最高</span>
              <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{kpis.hotArticle.title}</p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${benchmarkBadgeColor(kpis.hotArticle.benchmarkCount)}`}>
              {kpis.hotArticle.benchmarkCount} 篇同题报道
            </span>
            {kpis.hotArticle.hasAnalysis && (
              <Link
                href={`/topic-compare/${kpis.hotArticle.id}`}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 shrink-0"
              >
                查看详情 →
              </Link>
            )}
          </div>
        </GlassCard>
      )}

      {/* ── Filter Bar ── */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1">
          {statusFilters.map((f) => (
            <Button
              key={f.key}
              variant={statusFilter === f.key ? "default" : "ghost"}
              size="sm"
              className="border-0"
              onClick={() => setStatusFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索作品标题..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="h-9 w-[260px] rounded-md bg-white/60 dark:bg-gray-800/60 pl-8 pr-3 text-sm outline-none border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-500/30 transition"
          />
        </div>
      </div>

      {/* ── Table ── */}
      <GlassCard padding="none">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_100px_120px_70px_80px_70px_90px_110px] gap-2 px-5 py-3 border-b border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 font-medium">
          <span>作品标题</span>
          <button
            className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300 transition border-0 bg-transparent cursor-pointer text-xs text-gray-500 dark:text-gray-400 font-medium"
            onClick={() => toggleSort("publishedAt")}
          >
            发布时间
            <ArrowUpDown className="h-3 w-3" />
          </button>
          <span>发布渠道</span>
          <span>类型</span>
          <button
            className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300 transition border-0 bg-transparent cursor-pointer text-xs text-gray-500 dark:text-gray-400 font-medium"
            onClick={() => toggleSort("readCount")}
          >
            阅读量
            <ArrowUpDown className="h-3 w-3" />
          </button>
          <span>热度</span>
          <span>同题报道</span>
          <span>操作</span>
        </div>

        {/* Table body */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
            <Search className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">
              {articles.length === 0 ? "暂无已发布作品" : "没有找到匹配的作品，请调整筛选条件"}
            </p>
            {articles.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">作品数据将从发布系统自动同步</p>
            )}
          </div>
        ) : (
          filtered.map((article) => {
            // 模拟热度值：基于同题报道数和阅读量综合计算
            const heat = Math.min(99, Math.round(
              (article.benchmarkCount / 50) * 60 + (article.readCount / 150000) * 40
            ));
            return (
              <div
                key={article.id}
                className="grid grid-cols-[1fr_100px_120px_70px_80px_70px_90px_110px] gap-2 px-5 py-4 border-b border-gray-50 dark:border-gray-800/50 last:border-b-0 items-center hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition"
              >
                {/* Title */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
                    {article.title}
                  </span>
                  {isWithin24h(article.publishedAt) && (
                    <span className="bg-red-500 text-white text-[10px] px-1.5 py-0 leading-4 rounded shrink-0">
                      新
                    </span>
                  )}
                </div>

                {/* Publish time */}
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(article.publishedAt)}
                </span>

                {/* Channels */}
                <div className="flex items-center gap-1 flex-wrap">
                  {article.channels.map((ch) => (
                    <span
                      key={ch}
                      className={`text-[10px] px-1.5 py-0.5 rounded ${channelColor[ch] ?? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}
                    >
                      {ch}
                    </span>
                  ))}
                </div>

                {/* Content type */}
                <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                  {contentTypeIcon[article.contentType]}
                  <span className="text-xs">{contentTypeLabel[article.contentType]}</span>
                </div>

                {/* Read count */}
                <span className="text-xs text-gray-700 dark:text-gray-300">
                  {formatNumber(article.readCount)}
                </span>

                {/* 热度 */}
                <div className="flex items-center gap-1.5">
                  <div className="w-8 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${heatColor(heat)}`}
                      style={{ width: `${heat}%` }}
                    />
                  </div>
                  <span className={`text-[11px] font-medium ${heatTextColor(heat)}`}>{heat}</span>
                </div>

                {/* Benchmark count badge */}
                <div>
                  <span
                    className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${benchmarkBadgeColor(article.benchmarkCount)}`}
                  >
                    {article.benchmarkCount} 篇
                  </span>
                </div>

                {/* Action */}
                <div>
                  {article.hasAnalysis ? (
                    <Link
                      href={`/topic-compare/${article.id}`}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition"
                    >
                      查看同题对比 →
                    </Link>
                  ) : (
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      未生成分析
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Footer */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-gray-800">
            <span className="text-xs text-gray-400">共 {filtered.length} 篇作品</span>
            <span className="text-xs text-gray-400">
              累计阅读 {formatNumber(filtered.reduce((s, a) => s + a.readCount, 0))}
            </span>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

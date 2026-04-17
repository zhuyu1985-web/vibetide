"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, ArrowUpDown, FileText, Video, Radio, Clapperboard } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
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

const contentTypeIcon: Record<string, React.ReactNode> = {
  text: <FileText className="h-4 w-4" />,
  video: <Video className="h-4 w-4" />,
  live: <Radio className="h-4 w-4" />,
  short_video: <Clapperboard className="h-4 w-4" />,
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
type SortDir = "asc" | "desc";

/* ─── Component ─── */

interface Props {
  articles: TopicCompareArticle[];
}

export function TopicCompareClient({ articles }: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [keyword, setKeyword] = useState("");
  const [sortField, setSortField] = useState<SortField>("publishedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

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
        description="查看已发布作品的同题报道对比分析，了解全网媒体对同一话题的报道情况"
      />

      {/* ── Filter Bar ── */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        {/* Status filter tabs */}
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

        {/* Keyword search */}
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
        <div className="grid grid-cols-[1fr_110px_130px_80px_90px_100px_130px] gap-2 px-5 py-3 border-b border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 font-medium">
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
          <span>同题报道</span>
          <span>操作</span>
        </div>

        {/* Table body */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
            <Search className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">没有找到匹配的作品</p>
          </div>
        ) : (
          filtered.map((article) => (
            <div
              key={article.id}
              className="grid grid-cols-[1fr_110px_130px_80px_90px_100px_130px] gap-2 px-5 py-4 border-b border-gray-50 dark:border-gray-800/50 last:border-b-0 items-center hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition"
            >
              {/* Title */}
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm text-gray-900 dark:text-gray-100 truncate font-normal">
                  {article.title}
                </span>
                {isWithin24h(article.publishedAt) && (
                  <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0 leading-4 shrink-0 border-0">
                    新
                  </Badge>
                )}
              </div>

              {/* Publish time */}
              <span className="text-sm text-gray-600 dark:text-gray-400 font-normal">
                {formatDate(article.publishedAt)}
              </span>

              {/* Channels */}
              <div className="flex items-center gap-1 flex-wrap">
                {article.channels.map((ch) => (
                  <span
                    key={ch}
                    className={`text-[11px] px-1.5 py-0.5 rounded ${channelColor[ch] ?? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}
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
              <span className="text-sm text-gray-700 dark:text-gray-300 font-normal">
                {formatNumber(article.readCount)}
              </span>

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
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition"
                  >
                    查看同题对比 &rarr;
                  </Link>
                ) : (
                  <span className="text-sm text-gray-400 dark:text-gray-500">
                    未生成分析
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </GlassCard>
    </div>
  );
}

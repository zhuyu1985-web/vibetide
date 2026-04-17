"use client";

import { useState, useMemo } from "react";
import { Search, ExternalLink, Sparkles } from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { NetworkReport } from "@/lib/types";

/* ─── Level Config ─── */

type MediaLevel = "central" | "provincial" | "city" | "industry" | "self_media";

const levelConfig: Record<
  MediaLevel,
  { label: string; color: string }
> = {
  central: {
    label: "央级",
    color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  provincial: {
    label: "省级",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  city: {
    label: "市级",
    color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  },
  industry: {
    label: "行业",
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  },
  self_media: {
    label: "自媒体",
    color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
};

type FilterKey = "all" | MediaLevel;

const filterTabs: { key: FilterKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "central", label: "央级" },
  { key: "provincial", label: "省级" },
  { key: "city", label: "市级" },
  { key: "industry", label: "行业" },
  { key: "self_media", label: "自媒体" },
];

/* ─── Helpers ─── */

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${m}-${day} ${h}:${min}`;
}

/* ─── Component ─── */

interface Props {
  reports: NetworkReport[];
}

export function ArticlesTab({ reports }: Props) {
  const [levelFilter, setLevelFilter] = useState<FilterKey>("all");
  const [keyword, setKeyword] = useState("");

  const filtered = useMemo(() => {
    let list = reports;
    if (levelFilter !== "all") {
      list = list.filter((r) => r.mediaLevel === levelFilter);
    }
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(kw) ||
          r.sourceOutlet.toLowerCase().includes(kw)
      );
    }
    return list;
  }, [reports, levelFilter, keyword]);

  return (
    <div className="mt-4 space-y-4">
      {/* ── Filter Bar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {filterTabs.map((f) => (
            <Button
              key={f.key}
              variant={levelFilter === f.key ? "default" : "ghost"}
              size="sm"
              className="border-0"
              onClick={() => setLevelFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="搜索标题或媒体..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="h-9 w-[240px] rounded-md bg-white/60 dark:bg-gray-800/60 pl-8 pr-3 text-sm outline-none border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-500/30 transition"
          />
        </div>
      </div>

      {/* ── Table ── */}
      <GlassCard padding="none">
        {/* Header */}
        <div className="grid grid-cols-[1fr_160px_110px_100px_140px] gap-2 px-5 py-3 border-b border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 font-medium">
          <span>报道标题</span>
          <span>来源媒体</span>
          <span>发布时间</span>
          <span>作者</span>
          <span>操作</span>
        </div>

        {/* Body */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
            <Search className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">没有找到匹配的报道</p>
          </div>
        ) : (
          filtered.map((report) => {
            const lc = levelConfig[report.mediaLevel];
            return (
              <div
                key={report.id}
                className="grid grid-cols-[1fr_160px_110px_100px_140px] gap-2 px-5 py-4 border-b border-gray-50 dark:border-gray-800/50 last:border-b-0 items-center hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition"
              >
                {/* Title + Summary */}
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 dark:text-gray-100 truncate font-normal">
                    {report.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                    {report.summary}
                  </p>
                </div>

                {/* Source + Level Badge */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-normal">
                    {report.sourceOutlet}
                  </span>
                  <Badge className={`${lc.color} text-[10px] border-0`}>
                    {lc.label}
                  </Badge>
                </div>

                {/* Publish Time */}
                <span className="text-sm text-gray-600 dark:text-gray-400 font-normal">
                  {formatDate(report.publishedAt)}
                </span>

                {/* Author */}
                <span className="text-sm text-gray-600 dark:text-gray-400 font-normal truncate">
                  {report.author}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="border-0 text-xs">
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                    AI解读
                  </Button>
                  <a
                    href={report.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition px-2 py-1"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    查看原文
                  </a>
                </div>
              </div>
            );
          })
        )}
      </GlassCard>
    </div>
  );
}

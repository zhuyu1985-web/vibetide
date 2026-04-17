"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MissingTopicClue, MissingTopicKPIs } from "@/lib/types";

/* ─── Helpers ─── */

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${m}-${day} ${h}:${min}`;
}

function getUrgency(heatScore: number): "urgent" | "normal" | "watch" {
  if (heatScore > 80) return "urgent";
  if (heatScore >= 50) return "normal";
  return "watch";
}

function urgencyIcon(heatScore: number): string {
  const u = getUrgency(heatScore);
  if (u === "urgent") return "🔴";
  if (u === "normal") return "🟡";
  return "🟢";
}

function heatBarColor(heatScore: number): string {
  if (heatScore > 80) return "bg-red-500";
  if (heatScore >= 50) return "bg-amber-500";
  return "bg-gray-400";
}

/* ─── Source type config ─── */

const sourceTypeConfig: Record<
  MissingTopicClue["sourceType"],
  { label: string; color: string }
> = {
  social_hot: {
    label: "🔥 社媒热榜",
    color:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  },
  benchmark_media: {
    label: "📰 对标媒体",
    color:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  sentiment_event: {
    label: "⚠️ 舆情预警",
    color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
};

/* ─── Status badge config ─── */

const statusConfig: Record<
  MissingTopicClue["status"],
  { label: string; color: string }
> = {
  covered: {
    label: "已覆盖",
    color:
      "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  },
  suspected: {
    label: "疑似漏题",
    color:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  },
  confirmed: {
    label: "已确认漏题",
    color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  excluded: {
    label: "已排除",
    color:
      "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  },
  pushed: {
    label: "已推送",
    color:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
};

/* ─── Filter & Sort Types ─── */

type SourceFilter = "all" | "social_hot" | "benchmark_media" | "sentiment_event";
type StatusFilter = "all" | "covered" | "suspected" | "confirmed" | "excluded" | "pushed";
type SortMode = "heat" | "time";

const sourceFilters: { key: SourceFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "social_hot", label: "🔥 社媒热榜" },
  { key: "benchmark_media", label: "📰 对标媒体" },
  { key: "sentiment_event", label: "⚠️ 舆情预警" },
];

const statusFilters: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "全部状态" },
  { key: "suspected", label: "疑似漏题" },
  { key: "confirmed", label: "已确认漏题" },
  { key: "covered", label: "已覆盖" },
  { key: "pushed", label: "已推送" },
  { key: "excluded", label: "已排除" },
];

/* ─── Component ─── */

interface Props {
  clues: MissingTopicClue[];
  kpis: MissingTopicKPIs;
}

export function MissingTopicsClient({ clues, kpis }: Props) {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("heat");

  const filtered = useMemo(() => {
    let list = clues;

    if (sourceFilter !== "all") {
      list = list.filter((c) => c.sourceType === sourceFilter);
    }

    if (statusFilter !== "all") {
      list = list.filter((c) => c.status === statusFilter);
    }

    const sorted = [...list].sort((a, b) => {
      if (sortMode === "heat") return b.heatScore - a.heatScore;
      return new Date(b.discoveredAt).getTime() - new Date(a.discoveredAt).getTime();
    });

    return sorted;
  }, [clues, sourceFilter, statusFilter, sortMode]);

  function rowBg(clue: MissingTopicClue): string {
    if (clue.status !== "suspected") return "";
    const u = getUrgency(clue.heatScore);
    if (u === "urgent") return "bg-red-50/50 dark:bg-red-950/20";
    if (u === "normal") return "bg-amber-50/50 dark:bg-amber-950/20";
    return "";
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader
        title="漏题筛查"
        description="系统从社媒热榜、对标媒体、舆情系统自动采集线索，筛查疑似漏题并提醒处置"
      />

      {/* ── KPI Dashboard ── */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        {/* 今日线索总量 */}
        <GlassCard padding="md">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            今日线索总量
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {kpis.totalClues}
          </p>
        </GlassCard>

        {/* 疑似漏题 */}
        <div className="rounded-xl bg-red-50 dark:bg-red-950/30 p-5">
          <p className="text-xs font-medium text-red-600 dark:text-red-400">
            疑似漏题
          </p>
          <p className="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">
            {kpis.suspectedMissed}
          </p>
        </div>

        {/* 已确认漏题 */}
        <div className="rounded-xl bg-orange-50 dark:bg-orange-950/30 p-5">
          <p className="text-xs font-medium text-orange-600 dark:text-orange-400">
            已确认漏题
          </p>
          <p className="mt-1 text-2xl font-bold text-orange-600 dark:text-orange-400">
            {kpis.confirmedMissed}
          </p>
        </div>

        {/* 已处置 */}
        <div className="rounded-xl bg-green-50 dark:bg-green-950/30 p-5">
          <p className="text-xs font-medium text-green-600 dark:text-green-400">
            已处置
          </p>
          <p className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">
            {kpis.handled}
          </p>
        </div>

        {/* 线索覆盖率 */}
        <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 p-5">
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
            线索覆盖率
          </p>
          <p className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">
            {kpis.coverageRate}
            <span className="text-sm font-normal ml-0.5">%</span>
          </p>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <GlassCard padding="sm" className="mb-5">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Source type filter */}
          <div className="flex gap-1">
            {sourceFilters.map((f) => (
              <Button
                key={f.key}
                variant={sourceFilter === f.key ? "default" : "ghost"}
                size="sm"
                className="border-0"
                onClick={() => setSourceFilter(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="h-8 rounded-md bg-white/60 dark:bg-gray-800/60 px-2.5 text-sm outline-none border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-500/30 transition"
          >
            {statusFilters.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>

          {/* Sort toggle */}
          <div className="flex gap-1 ml-auto">
            <Button
              variant={sortMode === "heat" ? "default" : "ghost"}
              size="sm"
              className="border-0"
              onClick={() => setSortMode("heat")}
            >
              按热度
            </Button>
            <Button
              variant={sortMode === "time" ? "default" : "ghost"}
              size="sm"
              className="border-0"
              onClick={() => setSortMode("time")}
            >
              按时间
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* ── Clue Table ── */}
      <GlassCard padding="none">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_110px_140px_100px_110px_110px_100px] gap-2 px-5 py-3 border-b border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400 font-medium">
          <span>线索标题</span>
          <span>线索来源</span>
          <span>来源详情</span>
          <span>热度</span>
          <span>入库时间</span>
          <span>漏题状态</span>
          <span>操作</span>
        </div>

        {/* Table body */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
            <Search className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">暂无线索数据</p>
            <p className="text-xs mt-1">
              系统将定时从社媒热榜、舆情系统、对标媒体采集线索
            </p>
          </div>
        ) : (
          filtered.map((clue) => {
            const src = sourceTypeConfig[clue.sourceType];
            const st = statusConfig[clue.status];
            const canViewDetail =
              clue.status !== "covered" && clue.status !== "excluded";

            return (
              <div
                key={clue.id}
                className={`grid grid-cols-[1fr_110px_140px_100px_110px_110px_100px] gap-2 px-5 py-4 border-b border-gray-50 dark:border-gray-800/50 last:border-b-0 items-center hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition ${rowBg(clue)}`}
              >
                {/* 线索标题 */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0">{urgencyIcon(clue.heatScore)}</span>
                  <span className="text-sm text-gray-900 dark:text-gray-100 truncate font-normal">
                    {clue.title}
                  </span>
                  {clue.isMultiSource && (
                    <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 text-[10px] px-1.5 py-0 leading-4 shrink-0 border-0">
                      🔗多源
                    </Badge>
                  )}
                </div>

                {/* 线索来源 */}
                <div>
                  <span
                    className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-full font-medium ${src.color}`}
                  >
                    {src.label}
                  </span>
                </div>

                {/* 来源详情 */}
                <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {clue.sourceDetail}
                </span>

                {/* 热度 */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${heatBarColor(clue.heatScore)}`}
                      style={{ width: `${clue.heatScore}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 dark:text-gray-400 tabular-nums w-7 text-right">
                    {clue.heatScore}
                  </span>
                </div>

                {/* 入库时间 */}
                <span className="text-sm text-gray-600 dark:text-gray-400 font-normal">
                  {formatTime(clue.discoveredAt)}
                </span>

                {/* 漏题状态 */}
                <div>
                  <span
                    className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-full font-medium ${st.color}`}
                  >
                    {st.label}
                  </span>
                </div>

                {/* 操作 */}
                <div>
                  {canViewDetail ? (
                    <Link
                      href={`/missing-topics/${clue.id}`}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition"
                    >
                      查看详情 &rarr;
                    </Link>
                  ) : (
                    <span className="text-sm text-gray-400 dark:text-gray-500">
                      —
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </GlassCard>
    </div>
  );
}

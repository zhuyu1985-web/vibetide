"use client";

import { useState, useMemo } from "react";
import {
  Search,
  ExternalLink,
  Sparkles,
  Loader2,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { NetworkReport } from "@/lib/types";

/* ─── Level Config ─── */

type MediaLevel = "central" | "provincial" | "city" | "industry" | "self_media";

const levelConfig: Record<MediaLevel, { label: string; color: string }> = {
  central: { label: "央级", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  provincial: { label: "省级", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  city: { label: "市级", color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  industry: { label: "行业", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  self_media: { label: "自媒体", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
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
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${m}-${day} ${h}:${min}`;
}

function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );
}

/* ─── Interpretation State ─── */

type InterpretState = {
  loading: boolean;
  text?: string;
  error?: string;
  expanded: boolean;
};

/* ─── Component ─── */

interface Props {
  reports: NetworkReport[];
}

export function ArticlesTab({ reports }: Props) {
  const [levelFilter, setLevelFilter] = useState<FilterKey>("all");
  const [keyword, setKeyword] = useState("");
  const [interpretations, setInterpretations] = useState<
    Record<string, InterpretState>
  >({});

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

  const handleInterpret = async (contentId: string) => {
    // Mock / demo rows don't hit the API
    if (!isUUID(contentId)) {
      setInterpretations((s) => ({
        ...s,
        [contentId]: {
          loading: false,
          error: "演示数据不支持 AI 解读",
          expanded: true,
        },
      }));
      return;
    }

    const current = interpretations[contentId];
    // Already loaded — just toggle expansion
    if (current?.text) {
      setInterpretations((s) => ({
        ...s,
        [contentId]: { ...current, expanded: !current.expanded },
      }));
      return;
    }
    // Currently loading — ignore repeat clicks
    if (current?.loading) return;

    setInterpretations((s) => ({
      ...s,
      [contentId]: { loading: true, expanded: true },
    }));

    try {
      const res = await fetch("/api/benchmarking/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "AI 解读失败");
      }
      setInterpretations((s) => ({
        ...s,
        [contentId]: {
          loading: false,
          text: data.interpretation,
          expanded: true,
        },
      }));
    } catch (err) {
      setInterpretations((s) => ({
        ...s,
        [contentId]: {
          loading: false,
          error: err instanceof Error ? err.message : "AI 解读失败",
          expanded: true,
        },
      }));
    }
  };

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
        <SearchInput
          className="ml-auto w-[240px]"
          placeholder="搜索标题或媒体..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
      </div>

      {/* ── Table ── */}
      <DataTable
        rows={filtered}
        rowKey={(report) => report.id}
        emptyMessage={
          <div className="flex flex-col items-center gap-2">
            <Search className="h-10 w-10 opacity-40" />
            <p>没有找到匹配的报道</p>
          </div>
        }
        expandedKeys={
          new Set(
            Object.entries(interpretations)
              .filter(([, v]) => v?.expanded)
              .map(([k]) => k),
          )
        }
        renderExpanded={(report) => {
          const interp = interpretations[report.id];
          if (!interp) return null;
          return (
            <div className="pt-1">
              <div className="rounded-md bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 px-4 py-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                    AI 解读
                  </span>
                </div>
                {interp.loading && (
                  <div className="text-xs text-gray-500 flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    正在生成解读，请稍候...
                  </div>
                )}
                {interp.error && (
                  <div className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {interp.error}
                  </div>
                )}
                {interp.text && (
                  <div className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                    {interp.text}
                  </div>
                )}
              </div>
            </div>
          );
        }}
        columns={[
          {
            key: "title",
            header: "报道标题",
            render: (report) => (
              <div className="min-w-0">
                <p className="truncate">{report.title}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                  {report.summary}
                </p>
              </div>
            ),
          },
          {
            key: "source",
            header: "来源媒体",
            width: "160px",
            render: (report) => {
              const lc = levelConfig[report.mediaLevel];
              return (
                <div className="flex items-center gap-2">
                  <span className="truncate">{report.sourceOutlet}</span>
                  <Badge className={`${lc.color} text-[10px]`}>{lc.label}</Badge>
                </div>
              );
            },
          },
          {
            key: "publishedAt",
            header: "发布时间",
            width: "110px",
            render: (report) => (
              <span className="text-gray-600 dark:text-gray-400">{formatDate(report.publishedAt)}</span>
            ),
          },
          {
            key: "author",
            header: "作者",
            width: "100px",
            render: (report) => (
              <span className="text-gray-600 dark:text-gray-400 truncate block">{report.author}</span>
            ),
          },
          {
            key: "actions",
            header: "操作",
            width: "140px",
            render: (report) => {
              const interp = interpretations[report.id];
              const isExpanded = interp?.expanded ?? false;
              return (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => handleInterpret(report.id)}
                    disabled={interp?.loading}
                  >
                    {interp?.loading ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 mr-1" />
                    )}
                    {interp?.text && isExpanded
                      ? "收起解读"
                      : interp?.loading
                      ? "解读中..."
                      : "AI 解读"}
                    {interp?.text && (
                      <ChevronDown
                        className={`h-3 w-3 ml-0.5 transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    )}
                  </Button>
                  <a
                    href={report.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-sky-600 hover:text-sky-700 transition px-2 py-1"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    查看原文
                  </a>
                </div>
              );
            },
          },
        ] satisfies DataTableColumn<NetworkReport>[]}
      />
    </div>
  );
}

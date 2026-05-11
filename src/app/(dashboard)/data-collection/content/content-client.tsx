"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { LayoutGrid, Table2, FileText } from "lucide-react";
import { formatRelativeTime, formatAbsoluteTime } from "@/lib/format";
import { EmptyState } from "@/components/shared/empty-state";
import type { AdapterMeta } from "@/lib/collection/adapter-meta";
import { GlassCard } from "@/components/shared/glass-card";
import { DataTable } from "@/components/shared/data-table";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/shared/search-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OUTLET_TIER_VALUES, OUTLET_TIER_LABELS, SOURCE_TYPE_COLOR, type OutletTier } from "@/lib/collection/constants";
import type { MediaOutletRow } from "@/db/schema/media-outlet-dictionary";
import { ItemDetailDrawer } from "./item-detail-drawer";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TimeWindow = "24h" | "7d" | "30d" | "all";
export type EnrichmentStatus = "pending" | "enriched" | "failed";

export interface ClientFilters {
  sourceType?: string;
  module?: string;
  time?: TimeWindow;
  q?: string;
  enrichment?: EnrichmentStatus;
  platform?: string;
  outletTier?: string;
  outletRegion?: string;
}

/** Serializable subset of CollectedItemRow passed from the server page. */
export interface CollectedItemViewModel {
  id: string;
  title: string;
  summary: string | null;
  firstSeenChannel: string;
  firstSeenAt: string; // ISO string
  publishedAt: string | null; // ISO string
  category: string | null;
  tags: string[] | null;
  derivedModules: string[];
  enrichmentStatus: string;
  sourceChannels: Array<{
    channel: string;
    url?: string;
    sourceId: string;
    runId: string;
    capturedAt: string;
  }>;
  // Outlet info (Task 5.1 join)
  outletName: string | null;
  outletTier: string | null;
  /** Source type slug (rss / tophub / jina_url / list_scraper / tavily / tikhub / bocha). Null if source was deleted. */
  sourceType: string | null;
}

interface ContentClientProps {
  items: CollectedItemViewModel[];
  total: number;
  adapterMetas: AdapterMeta[];
  outlets: MediaOutletRow[];
  initialFilters: ClientFilters;
  initialView: "card" | "table";
}

const TIME_OPTIONS: { value: TimeWindow; label: string }[] = [
  { value: "24h", label: "24小时" },
  { value: "7d", label: "7天" },
  { value: "30d", label: "30天" },
  { value: "all", label: "全部" },
];

const MODULE_OPTIONS = [
  { value: "hot_topics", label: "热点话题" },
  { value: "news", label: "新闻稿件" },
  { value: "benchmarking", label: "同题对比" },
  { value: "knowledge", label: "知识库" },
];

const ENRICHMENT_OPTIONS: { value: EnrichmentStatus | "__all__"; label: string }[] = [
  { value: "__all__", label: "全部" },
  { value: "pending", label: "待解析" },
  { value: "enriched", label: "已解析" },
  { value: "failed", label: "失败" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function ContentClient({
  items,
  total,
  adapterMetas,
  outlets,
  initialFilters,
  initialView,
}: ContentClientProps) {
  const router = useRouter();
  const pathname = usePathname();

  // ── Search (debounced) ──────────────────────────────────────────────────────
  const [searchValue, setSearchValue] = useState(initialFilters.q ?? "");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateUrl = useCallback(
    (patch: Record<string, string | undefined>) => {
      const sp = new URLSearchParams();
      // Seed from current initialFilters so we don't lose other params
      if (initialFilters.sourceType) sp.set("sourceType", initialFilters.sourceType);
      if (initialFilters.module) sp.set("module", initialFilters.module);
      if (initialFilters.time && initialFilters.time !== "7d") sp.set("time", initialFilters.time);
      if (initialFilters.q) sp.set("q", initialFilters.q);
      if (initialFilters.enrichment) sp.set("enrichment", initialFilters.enrichment);
      if (initialFilters.platform) sp.set("platform", initialFilters.platform);
      if (initialFilters.outletTier) sp.set("outletTier", initialFilters.outletTier);
      if (initialFilters.outletRegion) sp.set("outletRegion", initialFilters.outletRegion);
      if (initialView !== "card") sp.set("view", initialView);

      // Apply patch
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === "" || v === "__all__") {
          sp.delete(k);
        } else {
          sp.set(k, v);
        }
      }

      const qs = sp.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`);
    },
    [router, pathname, initialFilters, initialView],
  );

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      updateUrl({ q: value || undefined });
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  // ── View toggle ─────────────────────────────────────────────────────────────
  const handleViewChange = (view: "card" | "table") => {
    updateUrl({ view: view === "card" ? undefined : view });
  };

  // ── Detail drawer ───────────────────────────────────────────────────────────
  const [detailItemId, setDetailItemId] = useState<string | null>(null);

  // ── Inline filters: 直接 URL apply,不缓存 draft 状态 ─────────────────────────
  const currentSourceType = initialFilters.sourceType ?? "__all__";
  const currentTime: TimeWindow = initialFilters.time ?? "7d";
  const currentEnrichment: EnrichmentStatus | "__all__" =
    initialFilters.enrichment ?? "__all__";
  const currentOutletTier = initialFilters.outletTier ?? "__all__";
  const currentOutletRegion = initialFilters.outletRegion ?? "__all__";

  const hasActiveFilter =
    currentSourceType !== "__all__" ||
    currentTime !== "7d" ||
    currentEnrichment !== "__all__" ||
    currentOutletTier !== "__all__" ||
    currentOutletRegion !== "__all__" ||
    Boolean(initialFilters.q);

  const handleResetAll = () => {
    setSearchValue("");
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    updateUrl({
      sourceType: undefined,
      time: undefined,
      enrichment: undefined,
      outletTier: undefined,
      outletRegion: undefined,
      module: undefined,
      platform: undefined,
      q: undefined,
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar — inline filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <SearchInput
          className="w-64"
          placeholder="搜索标题或内容…"
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
        />

        {/* Source type */}
        <Select
          value={currentSourceType}
          onValueChange={(v) =>
            updateUrl({ sourceType: v === "__all__" ? undefined : v })
          }
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="源类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部源类型</SelectItem>
            {adapterMetas.map((m) => (
              <SelectItem key={m.type} value={m.type}>
                {m.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Time */}
        <Select
          value={currentTime}
          onValueChange={(v) => updateUrl({ time: v === "7d" ? undefined : v })}
        >
          <SelectTrigger className="w-24">
            <SelectValue placeholder="时间" />
          </SelectTrigger>
          <SelectContent>
            {TIME_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* AI 解析状态 */}
        <Select
          value={currentEnrichment}
          onValueChange={(v) =>
            updateUrl({ enrichment: v === "__all__" ? undefined : v })
          }
        >
          <SelectTrigger className="w-28">
            <SelectValue placeholder="AI解析" />
          </SelectTrigger>
          <SelectContent>
            {ENRICHMENT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Outlet tier */}
        <Select
          value={currentOutletTier}
          onValueChange={(v) =>
            updateUrl({ outletTier: v === "__all__" ? undefined : v })
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="媒体分级" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部分级</SelectItem>
            {OUTLET_TIER_VALUES.map((t) => (
              <SelectItem key={t} value={t}>
                {OUTLET_TIER_LABELS[t]}
              </SelectItem>
            ))}
            <SelectItem value="unclassified">未分类</SelectItem>
          </SelectContent>
        </Select>

        {/* Outlet region */}
        <Select
          value={currentOutletRegion}
          onValueChange={(v) =>
            updateUrl({ outletRegion: v === "__all__" ? undefined : v })
          }
        >
          <SelectTrigger className="w-24">
            <SelectValue placeholder="区域" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部区域</SelectItem>
            <SelectItem value="重庆">重庆</SelectItem>
            <SelectItem value="全国">全国</SelectItem>
          </SelectContent>
        </Select>

        {/* Reset — only when any filter active */}
        {hasActiveFilter && (
          <Button variant="ghost" size="sm" onClick={handleResetAll}>
            清空
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-md border overflow-hidden">
            <button
              type="button"
              aria-label="卡片视图"
              onClick={() => handleViewChange("card")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${
                initialView === "card"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
              卡片
            </button>
            <button
              type="button"
              aria-label="表格视图"
              onClick={() => handleViewChange("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border-l transition-colors ${
                initialView === "table"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Table2 className="h-4 w-4" />
              表格
            </button>
          </div>
        </div>
      </div>

      {/* Total count */}
      {total > 0 && (
        <p className="text-xs text-muted-foreground">共 {total} 条记录</p>
      )}

      {/* Card view */}
      {initialView === "card" && items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((item) => {
            const sourcePart = item.firstSeenChannel.includes("/")
              ? item.firstSeenChannel.split("/", 2)
              : [item.firstSeenChannel, ""];
            const channelCount = Array.isArray(item.sourceChannels) ? item.sourceChannels.length : 1;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setDetailItemId(item.id)}
                className="group glass-card-interactive rounded-xl p-5 text-left transition-all"
              >
                {/* Source + time row */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="inline-flex items-center rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 text-[10px]">
                      {sourcePart[0]}
                    </span>
                    {sourcePart[1] && (
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                        {sourcePart[1]}
                      </span>
                    )}
                    {channelCount > 1 && (
                      <span
                        className="inline-flex items-center justify-center h-4 min-w-[1rem] rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-[9px] px-1"
                        title={`${channelCount} 个渠道采集到`}
                      >
                        ×{channelCount}
                      </span>
                    )}
                  </div>
                  <span
                    className="text-[11px] text-gray-400 dark:text-gray-500 shrink-0"
                    title={formatAbsoluteTime(item.firstSeenAt)}
                  >
                    {formatRelativeTime(item.firstSeenAt)}
                  </span>
                </div>

                {/* Title */}
                <div className="text-[15px] text-gray-900 dark:text-gray-100 leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                  {item.title}
                </div>

                {/* Summary */}
                {item.summary && (
                  <p className="mt-2 text-[13px] text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed">
                    {item.summary}
                  </p>
                )}

                {/* Footer */}
                <div className="mt-4 flex flex-wrap items-center gap-1.5">
                  {item.category && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {item.category}
                    </span>
                  )}
                  {item.derivedModules.slice(0, 2).map((m) => (
                    <span
                      key={m}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-transparent text-gray-400 dark:text-gray-500"
                    >
                      → {m}
                    </span>
                  ))}
                  {item.publishedAt && (
                    <span className="ml-auto text-[10px] text-gray-400 dark:text-gray-500">
                      {formatRelativeTime(item.publishedAt)}发布
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Table view — 采用 DataTable 与 /topic-compare 等保持统一玻璃边框 */}
      {initialView === "table" && items.length > 0 && (
        <DataTable
          rows={items}
          rowKey={(item) => item.id}
          onRowClick={(item) => setDetailItemId(item.id)}
          columns={[
            {
              key: "title",
              header: "标题",
              render: (item) => (
                <div className="min-w-0">
                  <div className="text-sm text-gray-900 dark:text-gray-100 truncate">
                    {item.title}
                  </div>
                  {item.summary && (
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      {item.summary}
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: "outlet",
              header: "媒体",
              width: "w-40",
              render: (item) => (
                <div className="flex flex-col min-w-0">
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                    {item.outletName ?? "未分类"}
                  </span>
                  {item.outletTier && (
                    <span className="text-xs text-muted-foreground truncate">
                      {OUTLET_TIER_LABELS[item.outletTier as OutletTier] ?? item.outletTier}
                    </span>
                  )}
                </div>
              ),
            },
            {
              key: "sourceType",
              header: "源类型",
              width: "w-32",
              render: (item) => {
                if (!item.sourceType) {
                  return <span className="text-xs text-gray-400 dark:text-gray-500">—</span>;
                }
                const meta = adapterMetas.find((m) => m.type === item.sourceType);
                const label = meta?.displayName ?? item.sourceType;
                const chip = SOURCE_TYPE_COLOR[item.sourceType] ?? "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300";
                return (
                  <span
                    className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[11px] truncate max-w-full", chip)}
                    title={item.firstSeenChannel}
                  >
                    {label}
                  </span>
                );
              },
            },
            {
              key: "firstSeenAt",
              header: "时间",
              width: "w-20",
              render: (item) => (
                <span
                  className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap"
                  title={formatAbsoluteTime(item.firstSeenAt)}
                >
                  {formatRelativeTime(item.firstSeenAt)}
                </span>
              ),
            },
            {
              key: "channels",
              header: "渠道",
              width: "w-14",
              align: "center",
              render: (item) => {
                const channels = Array.isArray(item.sourceChannels)
                  ? item.sourceChannels.length
                  : 1;
                return (
                  <span className="inline-flex items-center justify-center min-w-[1.5rem] h-5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs">
                    {channels}
                  </span>
                );
              },
            },
            {
              key: "category",
              header: "分类",
              width: "w-20",
              render: (item) => (
                <div className="text-xs text-gray-600 dark:text-gray-300 truncate">
                  {item.category ?? "—"}
                </div>
              ),
            },
            {
              key: "enrichment",
              header: "AI解析",
              width: "w-20",
              render: (item) => <EnrichmentChip status={item.enrichmentStatus} />,
            },
          ]}
        />
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <GlassCard variant="panel" padding="none">
          <EmptyState
            icon={FileText}
            title="暂无匹配的采集内容"
            description="当前筛选条件下没有找到内容。可以清空筛选,或到源管理页触发一次采集。"
          />
        </GlassCard>
      )}

      {/* Detail drawer */}
      <ItemDetailDrawer itemId={detailItemId} onClose={() => setDetailItemId(null)} outlets={outlets} />
    </div>
  );
}

// ────────────────────────────────────────────────
// Enrichment status chip (consistent with missions color tokens)
// ────────────────────────────────────────────────
function EnrichmentChip({ status }: { status: string }) {
  const config: Record<string, { cls: string; label: string }> = {
    enriched: {
      cls: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400",
      label: "已解析",
    },
    pending: {
      cls: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
      label: "待解析",
    },
    failed: {
      cls: "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400",
      label: "失败",
    },
  };
  const c = config[status] ?? { cls: "bg-gray-100 text-gray-600", label: status };
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[11px]", c.cls)}>
      {c.label}
    </span>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, SlidersHorizontal, LayoutGrid, Table2, FileText } from "lucide-react";
import { formatRelativeTime, formatAbsoluteTime } from "@/lib/format";
import { EmptyState } from "@/components/shared/empty-state";
import type { AdapterMeta } from "@/lib/collection/adapter-meta";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/shared/glass-card";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
}

interface ContentClientProps {
  items: CollectedItemViewModel[];
  total: number;
  adapterMetas: AdapterMeta[];
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
  { value: "pending", label: "待富化" },
  { value: "enriched", label: "已富化" },
  { value: "failed", label: "失败" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function ContentClient({
  items,
  total,
  adapterMetas,
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

  // ── Filter Sheet state ──────────────────────────────────────────────────────
  const [sheetOpen, setSheetOpen] = useState(false);

  // Local draft state inside the sheet — only applied when "应用" is pressed
  const [draftSourceType, setDraftSourceType] = useState<string>(
    initialFilters.sourceType ?? "__all__",
  );
  const [draftPlatform, setDraftPlatform] = useState<string>(initialFilters.platform ?? "");
  const [draftTime, setDraftTime] = useState<TimeWindow>(initialFilters.time ?? "7d");
  const [draftModules, setDraftModules] = useState<Set<string>>(
    new Set(initialFilters.module ? [initialFilters.module] : []),
  );
  const [draftEnrichment, setDraftEnrichment] = useState<EnrichmentStatus | "__all__">(
    initialFilters.enrichment ?? "__all__",
  );

  const toggleModule = (mod: string) => {
    setDraftModules((prev) => {
      const next = new Set(prev);
      if (next.has(mod)) next.delete(mod);
      else next.add(mod);
      return next;
    });
  };

  const handleApply = () => {
    const moduleVal = draftModules.size === 1 ? [...draftModules][0] : undefined;
    updateUrl({
      sourceType: draftSourceType === "__all__" ? undefined : draftSourceType,
      platform: draftPlatform || undefined,
      time: draftTime === "7d" ? undefined : draftTime,
      module: moduleVal,
      enrichment: draftEnrichment === "__all__" ? undefined : draftEnrichment,
    });
    setSheetOpen(false);
  };

  const handleReset = () => {
    setDraftSourceType("__all__");
    setDraftPlatform("");
    setDraftTime("7d");
    setDraftModules(new Set());
    setDraftEnrichment("__all__");
  };

  // Re-sync draft when sheet opens (in case URL changed externally)
  const handleSheetOpenChange = (open: boolean) => {
    if (open) {
      setDraftSourceType(initialFilters.sourceType ?? "__all__");
      setDraftPlatform(initialFilters.platform ?? "");
      setDraftTime(initialFilters.time ?? "7d");
      setDraftModules(new Set(initialFilters.module ? [initialFilters.module] : []));
      setDraftEnrichment(initialFilters.enrichment ?? "__all__");
    }
    setSheetOpen(open);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="搜索标题或内容…"
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Filter sheet trigger */}
          <Button variant="outline" onClick={() => handleSheetOpenChange(true)}>
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            筛选
          </Button>

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

      {/* Table view — missions-style */}
      {initialView === "table" && items.length > 0 && (
        <GlassCard variant="panel" padding="none">
          {/* Header row */}
          <div className="flex items-center gap-3 px-5 py-3 bg-gray-50/60 dark:bg-gray-800/30 border-b border-gray-300 dark:border-gray-600/70">
            <div className="flex-1 min-w-0 text-xs text-gray-600 dark:text-gray-300 tracking-wide">
              标题
            </div>
            <div className="w-32 text-xs text-gray-600 dark:text-gray-300 tracking-wide">
              首抓源
            </div>
            <div className="w-20 text-xs text-gray-600 dark:text-gray-300 tracking-wide">
              时间
            </div>
            <div className="w-14 text-xs text-gray-600 dark:text-gray-300 tracking-wide text-center">
              渠道
            </div>
            <div className="w-20 text-xs text-gray-600 dark:text-gray-300 tracking-wide">
              分类
            </div>
            <div className="w-20 text-xs text-gray-600 dark:text-gray-300 tracking-wide">
              富化
            </div>
          </div>
          {/* Body */}
          {items.map((item) => {
            const channels = Array.isArray(item.sourceChannels) ? item.sourceChannels.length : 1;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setDetailItemId(item.id)}
                className="w-full flex items-center gap-3 px-5 py-3.5 border-b border-gray-300 dark:border-gray-600/70 last:border-b-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors duration-200 text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900 dark:text-gray-100 truncate">
                    {item.title}
                  </div>
                  {item.summary && (
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      {item.summary}
                    </div>
                  )}
                </div>
                <div className="w-32 shrink-0 text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
                  {item.firstSeenChannel}
                </div>
                <div
                  className="w-20 shrink-0 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap"
                  title={formatAbsoluteTime(item.firstSeenAt)}
                >
                  {formatRelativeTime(item.firstSeenAt)}
                </div>
                <div className="w-14 shrink-0 text-center">
                  <span className="inline-flex items-center justify-center min-w-[1.5rem] h-5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs">
                    {channels}
                  </span>
                </div>
                <div className="w-20 shrink-0 text-xs text-gray-600 dark:text-gray-300 truncate">
                  {item.category ?? "—"}
                </div>
                <div className="w-20 shrink-0">
                  <EnrichmentChip status={item.enrichmentStatus} />
                </div>
              </button>
            );
          })}
        </GlassCard>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={FileText}
            title="暂无匹配的采集内容"
            description="当前筛选条件下没有找到内容。可以清空筛选,或到源管理页触发一次采集。"
          />
        </div>
      )}

      {/* Detail drawer */}
      <ItemDetailDrawer itemId={detailItemId} onClose={() => setDetailItemId(null)} />

      {/* Filter Sheet */}
      <Sheet open={sheetOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent side="right" className="w-80 sm:max-w-xs overflow-y-auto">
          <SheetHeader>
            <SheetTitle>筛选条件</SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-6 px-4 py-2">
            {/* Source type */}
            <div className="flex flex-col gap-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                源类型
              </Label>
              <Select value={draftSourceType} onValueChange={setDraftSourceType}>
                <SelectTrigger>
                  <SelectValue placeholder="全部类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部</SelectItem>
                  {adapterMetas.map((m) => (
                    <SelectItem key={m.type} value={m.type}>
                      {m.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Platform alias */}
            <div className="flex flex-col gap-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                平台别名
              </Label>
              <Input
                placeholder="如 weibo / zhihu / douyin"
                value={draftPlatform}
                onChange={(e) => setDraftPlatform(e.target.value)}
              />
            </div>

            {/* Time window */}
            <div className="flex flex-col gap-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                时间范围
              </Label>
              <div className="flex rounded-md border overflow-hidden">
                {TIME_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDraftTime(opt.value)}
                    className={`flex-1 py-1.5 text-xs transition-colors ${
                      draftTime === opt.value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    } ${opt.value !== "24h" ? "border-l" : ""}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target module checkboxes */}
            <div className="flex flex-col gap-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                归属模块
              </Label>
              <div className="flex flex-col gap-2">
                {MODULE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input accent-primary"
                      checked={draftModules.has(opt.value)}
                      onChange={() => toggleModule(opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Enrichment status */}
            <div className="flex flex-col gap-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                富化状态
              </Label>
              <div className="flex flex-col gap-2">
                {ENRICHMENT_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 cursor-pointer text-sm"
                  >
                    <input
                      type="radio"
                      className="h-4 w-4 accent-primary"
                      name="enrichment"
                      checked={draftEnrichment === opt.value}
                      onChange={() =>
                        setDraftEnrichment(opt.value as EnrichmentStatus | "__all__")
                      }
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <SheetFooter className="flex flex-row gap-2 px-4 pb-4">
            <Button variant="outline" className="flex-1" onClick={handleReset}>
              重置
            </Button>
            <Button className="flex-1" onClick={handleApply}>
              应用
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
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
      label: "已富化",
    },
    pending: {
      cls: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
      label: "待富化",
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

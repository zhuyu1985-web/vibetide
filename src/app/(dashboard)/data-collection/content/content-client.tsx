"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { LayoutGrid, Table2, FileText, Loader2, Trash2, FileSpreadsheet, Download } from "lucide-react";
import { toast } from "sonner";
import { formatRelativeTime, formatAbsoluteTime } from "@/lib/format";
import { EmptyState } from "@/components/shared/empty-state";
import type { AdapterMeta } from "@/lib/collection/adapter-meta";
import { GlassCard } from "@/components/shared/glass-card";
import { DataTable } from "@/components/shared/data-table";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchInput } from "@/components/shared/search-input";
import { DateRangePicker } from "@/components/shared/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { OUTLET_TIER_VALUES, OUTLET_TIER_LABELS, SOURCE_TYPE_COLOR, formatChannelLabel, getPlatformChipClass, type OutletTier } from "@/lib/collection/constants";
import type { MediaOutletRow } from "@/db/schema/media-outlet-dictionary";
import {
  bulkDeleteCollectedItemsAction,
  exportCollectedItemsToExcelAction,
  loadCollectedItemsAction,
  type LoadCollectedItemsFilters,
} from "@/app/actions/collection-items";
import { ItemDetailDrawer } from "./item-detail-drawer";
import { ImportExcelDialog } from "./import-excel-dialog";

const PAGE_SIZE = 50;

function timeWindowToSinceMs(tw: TimeWindow | undefined): number | undefined {
  if (!tw || tw === "all" || tw === "custom") return undefined;
  const hours = tw === "24h" ? 24 : tw === "30d" ? 30 * 24 : 7 * 24;
  return Date.now() - hours * 60 * 60 * 1000;
}

/**
 * 把 firstSeenChannel slug 简化为基础渠道分类:
 * "网站 / 微信 / 微博 / 抖音 / 小红书 / 知乎 / 视频号 / 快手 / 搜索 / 热榜"
 * 跟 platform 列 fallback,用在没 platform 数据的旧 item 上。
 */
function simpleChannelLabel(channel: string | undefined | null): string | null {
  if (!channel) return null;
  const c = channel.toLowerCase();
  if (c.includes("weibo") || c.includes("微博")) return "微博";
  if (c.includes("douyin") || c.includes("抖音")) return "抖音";
  if (c.includes("xiaohongshu") || c.includes("小红书")) return "小红书";
  if (c.includes("zhihu") || c.includes("知乎")) return "知乎";
  if (c.includes("kuaishou") || c.includes("快手")) return "快手";
  if (c.includes("wechat_channels") || c.includes("视频号")) return "视频号";
  if (c.includes("wechat") || c.includes("weixin") || c.includes("微信")) return "微信";
  if (c.startsWith("tophub")) return "热榜";
  if (c === "tavily" || c === "bocha" || c.includes("search")) return "搜索";
  if (
    c.startsWith("rss") ||
    c.startsWith("jina") ||
    c.startsWith("list") ||
    c.startsWith("site") ||
    c.startsWith("opinion_excel")
  ) return "网站";
  return "网站";
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type TimeWindow = "24h" | "7d" | "30d" | "all" | "custom";
export type EnrichmentStatus = "pending" | "enriched" | "failed";

export interface ClientFilters {
  sourceType?: string;
  module?: string;
  time?: TimeWindow;
  q?: string;
  enrichment?: EnrichmentStatus;
  platform?: string; // 注意:这是 platformAlias(channel 别名),给老的 RSS/Tophub 用
  outletTier?: string;
  outletRegion?: string;
  // A2 (2026-05-14)
  outletId?: string;
  category?: string;
  tag?: string;
  // 媒体账号 + 自定义发布时间(2026-05-18)
  author?: string;
  publishedSince?: string; // YYYY-MM-DD
  publishedUntil?: string; // YYYY-MM-DD
}

/** Serializable subset of CollectedItemRow passed from the server page. */
export interface CollectedItemViewModel {
  id: string;
  title: string;
  summary: string | null;
  firstSeenChannel: string;
  firstSeenAt: string; // ISO string
  publishedAt: string | null; // ISO string
  category: string[];
  tags: string[] | null;
  derivedModules: string[];
  enrichmentStatus: string;
  // 舆情字段(2026-05-18 显示)
  author: string | null;
  platform: string | null;
  accountId: string | null;
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

/** A2 (2026-05-14): 候选项给 category / tag / platform Select 下拉 */
export interface CollectedItemFilterOptions {
  categories: string[];
  tags: string[];
  platforms: string[];
}

interface ContentClientProps {
  items: CollectedItemViewModel[];
  total: number;
  adapterMetas: AdapterMeta[];
  outlets: MediaOutletRow[];
  filterOptions: CollectedItemFilterOptions;
  initialFilters: ClientFilters;
  initialView: "card" | "table";
}

const TIME_OPTIONS: { value: TimeWindow; label: string }[] = [
  { value: "24h", label: "24小时" },
  { value: "7d", label: "7天" },
  { value: "30d", label: "30天" },
  { value: "all", label: "全部" },
  { value: "custom", label: "自定义" },
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
  items: initialItems,
  total: initialTotal,
  adapterMetas,
  outlets,
  filterOptions,
  initialFilters,
  initialView,
}: ContentClientProps) {
  const router = useRouter();
  const pathname = usePathname();

  // ── 数据 state — 支持无限滚动追加 ────────────────────────────────────────────
  const [items, setItems] = useState<CollectedItemViewModel[]>(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 当 props 变化（URL 筛选触发的 server re-render）时,重置分页 state。
  useEffect(() => {
    setItems(initialItems);
    setTotal(initialTotal);
    setLoadError(null);
    setLoadingMore(false);
  }, [initialItems, initialTotal]);

  // 用 ref 缓存最新 items,避免 loadMore 被频繁重建
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const filtersForAction = useMemo<LoadCollectedItemsFilters>(() => {
    const dateToMs = (s: string | undefined, endOfDay: boolean): number | undefined => {
      if (!s) return undefined;
      const d = new Date(s);
      if (isNaN(d.getTime())) return undefined;
      if (endOfDay) d.setHours(23, 59, 59, 999);
      else d.setHours(0, 0, 0, 0);
      return d.getTime();
    };
    // 时间统一作用在 publishedAt:快捷窗 24h/7d/30d 或自定义范围
    const isCustom = initialFilters.time === "custom";
    const publishedSinceMs = isCustom
      ? dateToMs(initialFilters.publishedSince, false)
      : timeWindowToSinceMs(initialFilters.time);
    const publishedUntilMs = isCustom
      ? dateToMs(initialFilters.publishedUntil, true)
      : undefined;
    return {
      sourceType: initialFilters.sourceType,
      targetModule: initialFilters.module,
      publishedSinceMs,
      publishedUntilMs,
      searchText: initialFilters.q,
      enrichmentStatus: initialFilters.enrichment,
      platformAlias: initialFilters.platform,
      outletTier: initialFilters.outletTier,
      outletRegion: initialFilters.outletRegion,
      // A2
      outletId: initialFilters.outletId,
      category: initialFilters.category,
      tag: initialFilters.tag,
      // 媒体账号合并(2026-05-18) — 同时匹配 author/platform
      author: initialFilters.author,
    };
  }, [initialFilters]);

  const hasMore = items.length < total;

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    const currentLen = itemsRef.current.length;
    if (currentLen >= total) return;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const result = await loadCollectedItemsAction(filtersForAction, currentLen, PAGE_SIZE);
      setItems((prev) => {
        // 去重: server 端如有并发写入新数据,offset 可能错位
        const seen = new Set(prev.map((it) => it.id));
        const fresh = result.items.filter((it) => !seen.has(it.id));
        return [...prev, ...fresh];
      });
      setTotal(result.total);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "加载失败,请重试");
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, total, filtersForAction]);

  // IntersectionObserver — sentinel 进入视口时加载下一页
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  // 序号映射 — 用 Map 避免 render 内 O(n) 查找
  const seqOfId = useMemo(
    () => new Map(items.map((it, i) => [it.id, i + 1])),
    [items],
  );

  // ── Search (debounced) ──────────────────────────────────────────────────────
  const [searchValue, setSearchValue] = useState(initialFilters.q ?? "");
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Author 输入(debounced) ─────────────────────────────────────────────────
  const [authorValue, setAuthorValue] = useState(initialFilters.author ?? "");
  const authorDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateUrl = useCallback(
    (patch: Record<string, string | undefined>) => {
      const sp = new URLSearchParams();
      // Seed from current initialFilters so we don't lose other params
      if (initialFilters.sourceType) sp.set("sourceType", initialFilters.sourceType);
      if (initialFilters.module) sp.set("module", initialFilters.module);
      if (initialFilters.time && initialFilters.time !== "all") sp.set("time", initialFilters.time);
      if (initialFilters.q) sp.set("q", initialFilters.q);
      if (initialFilters.enrichment) sp.set("enrichment", initialFilters.enrichment);
      if (initialFilters.platform) sp.set("platform", initialFilters.platform);
      if (initialFilters.outletTier) sp.set("outletTier", initialFilters.outletTier);
      if (initialFilters.outletRegion) sp.set("outletRegion", initialFilters.outletRegion);
      // A2
      if (initialFilters.outletId) sp.set("outletId", initialFilters.outletId);
      if (initialFilters.category) sp.set("category", initialFilters.category);
      if (initialFilters.tag) sp.set("tag", initialFilters.tag);
      // 媒体账号 + 自定义发布时间(2026-05-18)
      if (initialFilters.author) sp.set("author", initialFilters.author);
      if (initialFilters.publishedSince) sp.set("publishedSince", initialFilters.publishedSince);
      if (initialFilters.publishedUntil) sp.set("publishedUntil", initialFilters.publishedUntil);

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

  const handleAuthorChange = (value: string) => {
    setAuthorValue(value);
    if (authorDebounceRef.current) clearTimeout(authorDebounceRef.current);
    authorDebounceRef.current = setTimeout(() => {
      updateUrl({ author: value || undefined });
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      if (authorDebounceRef.current) clearTimeout(authorDebounceRef.current);
    };
  }, []);

  // ── Detail drawer ───────────────────────────────────────────────────────────
  const [detailItemId, setDetailItemId] = useState<string | null>(null);

  // ── Import dialog ───────────────────────────────────────────────────────────
  const [importOpen, setImportOpen] = useState(false);

  // ── Export Excel ────────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);
  const handleExportExcel = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const result = await exportCollectedItemsToExcelAction(filtersForAction);
      // base64 → Blob → 触发下载
      const bin = atob(result.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`导出 ${result.rowCount} 条到 ${result.fileName}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "导出失败");
    } finally {
      setExporting(false);
    }
  }, [exporting, filtersForAction]);

  // ── 批量选择 / 删除 ─────────────────────────────────────────────────────────
  // 跨页保留: 翻下一页时已选 id 不丢; 删除成功后清空。
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 筛选/视图变化时清空选择,避免不可见行还在 Set 里
  useEffect(() => {
    setSelectedKeys(new Set());
  }, [initialFilters, initialView]);

  const toggleOne = useCallback((id: string, checked: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedKeys(new Set()), []);

  const handleConfirmDelete = useCallback(async () => {
    if (selectedKeys.size === 0) return;
    setDeleting(true);
    try {
      const ids = Array.from(selectedKeys);
      const { deletedCount } = await bulkDeleteCollectedItemsAction(ids);
      setItems((prev) => prev.filter((it) => !selectedKeys.has(it.id)));
      setTotal((prev) => Math.max(0, prev - deletedCount));
      clearSelection();
      setConfirmDeleteOpen(false);
      toast.success(`已删除 ${deletedCount} 条`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败,请重试");
    } finally {
      setDeleting(false);
    }
  }, [selectedKeys, clearSelection]);

  // ── Inline filters: 直接 URL apply,不缓存 draft 状态 ─────────────────────────
  const currentSourceType = initialFilters.sourceType ?? "__all__";
  const currentTime: TimeWindow = initialFilters.time ?? "all";
  const currentEnrichment: EnrichmentStatus | "__all__" =
    initialFilters.enrichment ?? "__all__";
  const currentOutletTier = initialFilters.outletTier ?? "__all__";
  const currentOutletRegion = initialFilters.outletRegion ?? "__all__";
  // A2 (2026-05-14)
  const currentOutletId = initialFilters.outletId ?? "__all__";
  const currentCategory = initialFilters.category ?? "__all__";
  const currentTag = initialFilters.tag ?? "__all__";

  const hasActiveFilter =
    currentSourceType !== "__all__" ||
    currentTime !== "all" ||
    currentEnrichment !== "__all__" ||
    currentOutletTier !== "__all__" ||
    currentOutletRegion !== "__all__" ||
    currentOutletId !== "__all__" ||
    currentCategory !== "__all__" ||
    currentTag !== "__all__" ||
    Boolean(initialFilters.q) ||
    Boolean(initialFilters.author) ||
    Boolean(initialFilters.publishedSince) ||
    Boolean(initialFilters.publishedUntil);

  const handleResetAll = () => {
    setSearchValue("");
    setAuthorValue("");
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (authorDebounceRef.current) clearTimeout(authorDebounceRef.current);
    updateUrl({
      sourceType: undefined,
      time: undefined,
      enrichment: undefined,
      outletTier: undefined,
      outletRegion: undefined,
      outletId: undefined,
      category: undefined,
      tag: undefined,
      module: undefined,
      platform: undefined,
      q: undefined,
      author: undefined,
      publishedSince: undefined,
      publishedUntil: undefined,
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* Row 1: 检索 — 所有筛选条件 + 清空 */}
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

        {/* 发布时间 — 快捷窗 + 自定义合二为一 */}
        <Select
          value={currentTime}
          onValueChange={(v) => {
            // 切换到非 custom 时清掉自定义日期 param
            if (v !== "custom") {
              updateUrl({
                time: v === "all" ? undefined : v,
                publishedSince: undefined,
                publishedUntil: undefined,
              });
            } else {
              updateUrl({ time: v });
            }
          }}
        >
          <SelectTrigger className="w-28">
            <SelectValue placeholder="发布时间" />
          </SelectTrigger>
          <SelectContent>
            {TIME_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 自定义发布时间范围 — 仅当时间窗选"自定义"时显示 */}
        {currentTime === "custom" && (
          <DateRangePicker
            value={
              initialFilters.publishedSince || initialFilters.publishedUntil
                ? {
                    from: initialFilters.publishedSince
                      ? new Date(initialFilters.publishedSince)
                      : undefined,
                    to: initialFilters.publishedUntil
                      ? new Date(initialFilters.publishedUntil)
                      : undefined,
                  }
                : undefined
            }
            onChange={(range) => {
              const fmt = (d: Date | undefined) =>
                d
                  ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
                  : undefined;
              updateUrl({
                publishedSince: fmt(range?.from),
                publishedUntil: fmt(range?.to),
              });
            }}
            placeholder="选择日期范围"
          />
        )}

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

        {/* A2: 绑定媒体(outletId 精确) */}
        <Select
          value={currentOutletId}
          onValueChange={(v) =>
            updateUrl({ outletId: v === "__all__" ? undefined : v })
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="绑定媒体" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部媒体</SelectItem>
            {outlets.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.outletName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* A2: 默认分类(source 上配的 defaultCategory 反过来筛) */}
        <Select
          value={currentCategory}
          onValueChange={(v) =>
            updateUrl({ category: v === "__all__" ? undefined : v })
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="分类" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部分类</SelectItem>
            {filterOptions.categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* A2: 默认标签(source 上配的 defaultTags 反过来筛,GIN 索引命中) */}
        <Select
          value={currentTag}
          onValueChange={(v) =>
            updateUrl({ tag: v === "__all__" ? undefined : v })
          }
        >
          <SelectTrigger className="w-28">
            <SelectValue placeholder="标签" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">全部标签</SelectItem>
            {filterOptions.tags.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* 媒体账号 — 模糊匹配 author 列(账号名) */}
        <SearchInput
          className="w-40"
          placeholder="媒体账号"
          value={authorValue}
          onChange={(e) => handleAuthorChange(e.target.value)}
        />

        {/* Reset — only when any filter active */}
        {hasActiveFilter && (
          <Button variant="ghost" size="sm" onClick={handleResetAll}>
            清空
          </Button>
        )}
      </div>

      {/* Row 2: 功能按钮 — 导入 / 导出(右对齐) */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
          <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
          导入 Excel
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportExcel}
          disabled={exporting || total === 0}
        >
          {exporting ? (
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5 mr-1" />
          )}
          {exporting ? "导出中…" : "导出 Excel"}
        </Button>
      </div>

      {/* Selection toolbar — 选中后才显示;否则照常显示 total */}
      {selectedKeys.size > 0 ? (
        <div className="flex items-center gap-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
          <span className="text-xs text-foreground">
            已选 <span className="font-medium text-primary">{selectedKeys.size}</span> 条
          </span>
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            取消选择
          </Button>
          <div className="ml-auto">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmDeleteOpen(true)}
              disabled={deleting}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              批量删除
            </Button>
          </div>
        </div>
      ) : (
        total > 0 && (
          <p className="text-xs text-muted-foreground">
            已加载 {items.length} / {total} 条
          </p>
        )
      )}

      {/* Confirm delete dialog */}
      <AlertDialog open={confirmDeleteOpen} onOpenChange={(open) => !deleting && setConfirmDeleteOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除 {selectedKeys.size} 条采集项?</AlertDialogTitle>
            <AlertDialogDescription>
              此操作不可撤销。所选条目及其正文/OCR/ASR 将被永久删除;
              已派生到热点/新闻/对比库的内容仍会保留(它们独立持久化)。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "删除中…" : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Table view — 唯一展示模式 */}
      {items.length > 0 && (
        <DataTable
          rows={items}
          rowKey={(item) => item.id}
          onRowClick={(item) => setDetailItemId(item.id)}
          selectable
          selectedKeys={selectedKeys}
          onSelectionChange={setSelectedKeys}
          columns={[
            {
              key: "_seq",
              header: "序号",
              width: "w-14",
              align: "center",
              render: (item) => (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {seqOfId.get(item.id)}
                </span>
              ),
            },
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
              key: "category",
              header: "分类",
              width: "w-28",
              render: (item) => (
                <div
                  className="text-xs text-gray-600 dark:text-gray-300 truncate"
                  title={item.category.join("、")}
                >
                  {item.category.length === 0 ? "—" : item.category.join("、")}
                </div>
              ),
            },
            {
              key: "account",
              header: "账号",
              width: "w-32",
              render: (item) => (
                <span
                  className="text-sm text-gray-700 dark:text-gray-300 truncate block"
                  title={item.author ?? ""}
                >
                  {item.author ?? "—"}
                </span>
              ),
            },
            {
              key: "platform",
              header: "平台",
              width: "w-24",
              render: (item) => {
                const label = item.platform ?? simpleChannelLabel(item.firstSeenChannel);
                if (!label) return <span className="text-xs text-muted-foreground">—</span>;
                return (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] truncate max-w-full",
                      getPlatformChipClass(label),
                    )}
                    title={label}
                  >
                    {label}
                  </span>
                );
              },
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

      {/* 无限滚动 sentinel + 加载状态 */}
      {items.length > 0 && (
        <div ref={sentinelRef} className="flex flex-col items-center gap-2 py-4">
          {loadingMore && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              加载中…
            </div>
          )}
          {!loadingMore && loadError && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-500">{loadError}</span>
              <Button variant="ghost" size="sm" onClick={loadMore}>
                重试
              </Button>
            </div>
          )}
          {!loadingMore && !loadError && hasMore && (
            <Button variant="ghost" size="sm" onClick={loadMore}>
              加载更多
            </Button>
          )}
          {!hasMore && !loadingMore && !loadError && (
            <span className="text-xs text-muted-foreground">已加载全部 {total} 条</span>
          )}
        </div>
      )}

      {/* Detail drawer */}
      <ItemDetailDrawer itemId={detailItemId} onClose={() => setDetailItemId(null)} outlets={outlets} />

      {/* Import Excel dialog */}
      <ImportExcelDialog open={importOpen} onOpenChange={setImportOpen} />
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

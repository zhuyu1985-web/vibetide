"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, SlidersHorizontal, LayoutGrid, Table2, FileText } from "lucide-react";
import { formatRelativeTime, formatAbsoluteTime } from "@/lib/format";
import { EmptyState } from "@/components/shared/empty-state";
import type { AdapterMeta } from "@/lib/collection/adapter-meta";
import { Badge } from "@/components/ui/badge";
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
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setDetailItemId(item.id)}
                className="group flex flex-col gap-3 text-left rounded-xl bg-card p-4 ring-1 ring-border/60 hover:ring-border hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                {/* Source + time row */}
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2 py-0.5 text-muted-foreground font-medium">
                    <span>{sourcePart[0]}</span>
                    {sourcePart[1] && (
                      <span className="text-foreground/80">/ {sourcePart[1]}</span>
                    )}
                  </span>
                  <span
                    className="text-muted-foreground shrink-0"
                    title={formatAbsoluteTime(item.firstSeenAt)}
                  >
                    {formatRelativeTime(item.firstSeenAt)}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-[15px] font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                  {item.title}
                </h3>

                {/* Summary */}
                {item.summary && (
                  <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                    {item.summary}
                  </p>
                )}

                {/* Footer: category + derived modules */}
                <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                  {item.category && (
                    <Badge variant="secondary" className="font-normal">
                      {item.category}
                    </Badge>
                  )}
                  {item.derivedModules.map((m) => (
                    <Badge
                      key={m}
                      variant="outline"
                      className="text-[10px] font-normal text-muted-foreground"
                    >
                      → {m}
                    </Badge>
                  ))}
                  {item.publishedAt && (
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {formatRelativeTime(item.publishedAt)}发布
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Table view */}
      {initialView === "table" && items.length > 0 && (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标题</TableHead>
                <TableHead>首抓源</TableHead>
                <TableHead>首抓时间</TableHead>
                <TableHead>渠道数</TableHead>
                <TableHead>分类</TableHead>
                <TableHead>富化</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow
                  key={item.id}
                  className="cursor-pointer"
                  onClick={() => setDetailItemId(item.id)}
                >
                  <TableCell className="max-w-md truncate font-medium">
                    {item.title}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {item.firstSeenChannel}
                  </TableCell>
                  <TableCell
                    className="text-xs text-muted-foreground whitespace-nowrap"
                    title={formatAbsoluteTime(item.firstSeenAt)}
                  >
                    {formatRelativeTime(item.firstSeenAt)}
                  </TableCell>
                  <TableCell className="text-center">
                    {Array.isArray(item.sourceChannels) ? item.sourceChannels.length : 1}
                  </TableCell>
                  <TableCell>{item.category ?? "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={item.enrichmentStatus === "enriched" ? "default" : "outline"}
                      className="text-[10px]"
                    >
                      {item.enrichmentStatus}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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

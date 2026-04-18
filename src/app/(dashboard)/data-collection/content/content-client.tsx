"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, SlidersHorizontal, LayoutGrid, Table2 } from "lucide-react";
import type { AdapterMeta } from "@/lib/collection/adapter-meta";
import type { CollectedItemRow } from "@/lib/dal/collected-items";
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

interface ContentClientProps {
  items: CollectedItemRow[];
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

      {/* Placeholder main area */}
      <div className="rounded-lg border bg-muted/10 p-8 text-center text-sm text-muted-foreground">
        {items.length === 0
          ? "暂无采集内容。配置源并触发采集后,这里会展示数据。"
          : `找到 ${total} 条记录。(${initialView === "card" ? "卡片" : "表格"} 视图将在 P4-T3 实现)`}
      </div>

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

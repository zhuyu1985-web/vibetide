"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DateRange } from "react-day-picker";
import {
  Download,
  Edit3,
  FileBarChart,
  FileText,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/data-table";
import { DateRangePicker } from "@/components/shared/date-picker";
import { EmptyState } from "@/components/shared/empty-state";
import { GlassCard } from "@/components/shared/glass-card";
import { SearchInput } from "@/components/shared/search-input";
import { ComboboxTrigger } from "@/components/ui/combobox-trigger";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CHANNEL_BUCKET_ORDER,
  CHANNEL_BUCKET_SLUG,
} from "@/lib/collection/channel-bucket";
import {
  OUTLET_TIER_LABELS,
  OUTLET_TIER_VALUES,
  SOURCE_TYPE_COLOR,
  formatChannelLabel,
  getPlatformChipClass,
  type OutletTier,
} from "@/lib/collection/constants";
import type { AdapterMeta } from "@/lib/collection/adapter-meta";
import type { CollectedItemFilterOptions } from "@/lib/dal/collected-items";
import type { MediaOutletRow } from "@/db/schema/media-outlet-dictionary";
import { formatRelativeTime, formatAbsoluteTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  createTopicReportAction,
  exportTopicSearchResultsToExcelAction,
  searchCollectedItemsByTopicAction,
} from "@/app/actions/research/research-topics";
import type { TopicSummary } from "@/lib/dal/research/research-topics";
import type { CollectedItemWithAnnotations } from "@/lib/dal/research/collected-item-search";
import { FilterChips, type ChipOption } from "../content/filter-chips";

type TimeWindow = "24h" | "7d" | "30d" | "all" | "custom";
type EnrichmentStatus = "pending" | "enriched" | "failed";

const PAGE_SIZE = 50;

const TIME_OPTIONS: { value: TimeWindow; label: string }[] = [
  { value: "24h", label: "24小时" },
  { value: "7d", label: "7天" },
  { value: "30d", label: "30天" },
  { value: "all", label: "全部" },
  { value: "custom", label: "自定义" },
];

const ENRICHMENT_OPTIONS: { value: EnrichmentStatus | "__all__"; label: string }[] = [
  { value: "__all__", label: "全部" },
  { value: "pending", label: "待解析" },
  { value: "enriched", label: "已解析" },
  { value: "failed", label: "失败" },
];

function timeWindowToSinceMs(tw: TimeWindow): number | undefined {
  if (tw === "all" || tw === "custom") return undefined;
  const hours = tw === "24h" ? 24 : tw === "30d" ? 30 * 24 : 7 * 24;
  return Date.now() - hours * 60 * 60 * 1000;
}

function startOfDayMs(date: Date | undefined): number | undefined {
  if (!date) return undefined;
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfDayMs(date: Date | undefined): number | undefined {
  if (!date) return undefined;
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

interface TopicDetailPanelProps {
  topic: TopicSummary;
  onEdit: () => void;
  adapterMetas: AdapterMeta[];
  outlets: MediaOutletRow[];
  filterOptions: CollectedItemFilterOptions;
}

export function TopicDetailPanel({
  topic,
  onEdit,
  adapterMetas,
  outlets,
  filterOptions,
}: TopicDetailPanelProps) {
  const router = useRouter();
  const [items, setItems] = useState<CollectedItemWithAnnotations[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [reporting, setReporting] = useState(false);

  const [platformAlias, setPlatformAlias] = useState<string | undefined>();
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [category, setCategory] = useState<string | undefined>();
  const [outletTier, setOutletTier] = useState<string | undefined>();
  const [outletRegion, setOutletRegion] = useState<string | undefined>();
  const [sourceType, setSourceType] = useState<string | undefined>();
  const [outletId, setOutletId] = useState<string | undefined>();
  const [author, setAuthor] = useState<string | undefined>();
  const [tag, setTag] = useState<string | undefined>();
  const [enrichmentStatus, setEnrichmentStatus] = useState<EnrichmentStatus | undefined>();
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPlatformAlias(undefined);
    setTimeWindow("all");
    setDateRange(undefined);
    setCategory(undefined);
    setOutletTier(undefined);
    setOutletRegion(undefined);
    setSourceType(undefined);
    setOutletId(undefined);
    setAuthor(undefined);
    setTag(undefined);
    setEnrichmentStatus(undefined);
    setSearchValue("");
    setDebouncedSearch("");
  }, [topic.id]);

  const publishedAtFrom = timeWindow === "custom"
    ? startOfDayMs(dateRange?.from)
    : timeWindowToSinceMs(timeWindow);
  const publishedAtTo = timeWindow === "custom"
    ? endOfDayMs(dateRange?.to)
    : undefined;

  const filtersForAction = useMemo(
    () => ({
      platformAlias,
      sourceType,
      publishedAtFrom,
      publishedAtTo,
      searchText: debouncedSearch.trim() || undefined,
      enrichmentStatus,
      outletTier,
      outletRegion,
      outletId,
      category,
      tag,
      author,
    }),
    [
      platformAlias,
      sourceType,
      publishedAtFrom,
      publishedAtTo,
      debouncedSearch,
      enrichmentStatus,
      outletTier,
      outletRegion,
      outletId,
      category,
      tag,
      author,
    ],
  );

  const loadData = useCallback(
    (offset = 0, append = false) => {
      setError(null);
      startTransition(async () => {
        try {
          const res = await searchCollectedItemsByTopicAction(
            topic.id,
            filtersForAction,
            { limit: PAGE_SIZE, offset },
          );
          setItems((prev) => (append ? [...prev, ...res.items] : res.items));
          setTotal(res.total);
        } catch (e) {
          setError(e instanceof Error ? e.message : "加载失败");
          if (!append) {
            setItems([]);
            setTotal(0);
          }
        } finally {
          setLoadingMore(false);
        }
      });
    },
    [
      topic.id,
      filtersForAction,
    ],
  );

  useEffect(() => {
    loadData(0, false);
  }, [loadData]);

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  function handleSearchChange(value: string) {
    setSearchValue(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  }

  function handleQuery() {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setDebouncedSearch(searchValue);
  }

  function handleResetAll() {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setPlatformAlias(undefined);
    setTimeWindow("all");
    setDateRange(undefined);
    setCategory(undefined);
    setOutletTier(undefined);
    setOutletRegion(undefined);
    setSourceType(undefined);
    setOutletId(undefined);
    setAuthor(undefined);
    setTag(undefined);
    setEnrichmentStatus(undefined);
    setSearchValue("");
    setDebouncedSearch("");
  }

  function handleLoadMore() {
    if (loadingMore || items.length >= total) return;
    setLoadingMore(true);
    loadData(items.length, true);
  }

  const handleExportExcel = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const result = await exportTopicSearchResultsToExcelAction(
        topic.id,
        filtersForAction,
      );
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
  }, [exporting, filtersForAction, topic.id]);

  const handleCreateReport = useCallback(async () => {
    if (reporting) return;
    setReporting(true);
    try {
      const result = await createTopicReportAction(topic.id, filtersForAction);
      toast.success("报告已创建，正在生成内容");
      router.push(`/data-collection/reports/${result.reportId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "生成报告失败");
    } finally {
      setReporting(false);
    }
  }, [filtersForAction, reporting, router, topic.id]);

  const channelChipOptions: ChipOption[] = CHANNEL_BUCKET_ORDER.map((bucket) => ({
    value: CHANNEL_BUCKET_SLUG[bucket],
    label: bucket,
  }));

  const timeChipOptions: ChipOption[] = TIME_OPTIONS.filter((o) => o.value !== "all").map((o) => ({
    value: o.value,
    label: o.label,
  }));

  const outletTierChipOptions: ChipOption[] = [
    ...OUTLET_TIER_VALUES.map((t) => ({ value: t, label: OUTLET_TIER_LABELS[t] })),
    { value: "unclassified", label: "未分类" },
  ];

  const categoryChipOptions: ChipOption[] = filterOptions.categories.slice(0, 8).map((c) => ({
    value: c,
    label: c,
  }));

  const hasActiveFilter =
    Boolean(platformAlias) ||
    timeWindow !== "all" ||
    Boolean(category) ||
    Boolean(outletTier) ||
    Boolean(outletRegion) ||
    Boolean(sourceType) ||
    Boolean(outletId) ||
    Boolean(author) ||
    Boolean(tag) ||
    Boolean(enrichmentStatus) ||
    Boolean(debouncedSearch);

  const hasMore = items.length < total;

  const selectedOutlet = useMemo(
    () => (outletId ? outlets.find((outlet) => outlet.id === outletId) : undefined),
    [outletId, outlets],
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-xl font-semibold text-foreground">
              {topic.name}
            </h2>
            {topic.isPreset && (
              <Badge variant="secondary">预置</Badge>
            )}
          </div>
          {topic.description && (
            <p className="mt-1 text-sm text-muted-foreground">{topic.description}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            共词 {topic.primaryKeyword ?? "未设置"} · 别名 {topic.aliasCount} · 样本{" "}
            {topic.sampleCount}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Edit3 className="mr-1 h-3.5 w-3.5" />
            编辑方案
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCreateReport}
            disabled={reporting || loading || total === 0}
          >
            {reporting ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileBarChart className="mr-1 h-3.5 w-3.5" />
            )}
            {reporting ? "生成中" : "一键报告"}
          </Button>
        </div>
      </div>

      <GlassCard variant="panel" padding="md" className="space-y-3">
        <FilterChips
          label="信息来源"
          options={channelChipOptions}
          value={platformAlias}
          onChange={setPlatformAlias}
        />

        <div className="flex flex-wrap items-center gap-2">
          <FilterChips
            label="发布时间"
            options={timeChipOptions}
            value={timeWindow === "all" ? undefined : timeWindow}
            onChange={(value) => {
              setTimeWindow((value as TimeWindow | undefined) ?? "all");
              if (value !== "custom") setDateRange(undefined);
            }}
          />
          {timeWindow === "custom" && (
            <DateRangePicker
              value={dateRange}
              onChange={setDateRange}
              placeholder="选择发布时间范围"
            />
          )}
        </div>

        {categoryChipOptions.length > 0 && (
          <FilterChips
            label="分类"
            options={categoryChipOptions}
            value={category}
            onChange={setCategory}
          />
        )}

        <FilterChips
          label="媒体分级"
          options={outletTierChipOptions}
          value={outletTier}
          onChange={setOutletTier}
        />

        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 shrink-0 text-xs text-muted-foreground">其他</span>
          <SearchInput
            className="w-72"
            placeholder="关键词搜索..."
            value={searchValue}
            onChange={(event) => handleSearchChange(event.target.value)}
          />
          <Select
            value={outletRegion ?? "__all__"}
            onValueChange={(value) => setOutletRegion(value === "__all__" ? undefined : value)}
          >
            <SelectTrigger className="w-28">
              <SelectValue placeholder="区域" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部区域</SelectItem>
              <SelectItem value="重庆">重庆</SelectItem>
              <SelectItem value="全国">全国</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={sourceType ?? "__all__"}
            onValueChange={(value) => setSourceType(value === "__all__" ? undefined : value)}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="源类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部源类型</SelectItem>
              {adapterMetas.map((meta) => (
                <SelectItem key={meta.type} value={meta.type}>
                  {meta.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <MediaAccountCombobox
            outlets={outlets}
            accounts={filterOptions.accounts}
            selectedOutletId={outletId}
            selectedAccount={author}
            onSelectAll={() => {
              setOutletId(undefined);
              setAuthor(undefined);
            }}
            onSelectOutlet={(nextOutletId) => {
              setOutletId(nextOutletId);
              setAuthor(undefined);
            }}
            onSelectAccount={(nextAuthor) => {
              setAuthor(nextAuthor);
              setOutletId(undefined);
            }}
          />

          <Select
            value={tag ?? "__all__"}
            onValueChange={(value) => setTag(value === "__all__" ? undefined : value)}
          >
            <SelectTrigger className="w-28">
              <SelectValue placeholder="标签" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部标签</SelectItem>
              {filterOptions.tags.map((tagOption) => (
                <SelectItem key={tagOption} value={tagOption}>
                  {tagOption}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={enrichmentStatus ?? "__all__"}
            onValueChange={(value) =>
              setEnrichmentStatus(value === "__all__" ? undefined : (value as EnrichmentStatus))
            }
          >
            <SelectTrigger className="w-28">
              <SelectValue placeholder="解析" />
            </SelectTrigger>
            <SelectContent>
              {ENRICHMENT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              disabled={exporting || loading || total === 0}
            >
              {exporting ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="mr-1 h-3.5 w-3.5" />
              )}
              {exporting ? "导出中" : "导出 Excel"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetAll}
              disabled={!hasActiveFilter}
            >
              重置
            </Button>
            <Button size="sm" onClick={handleQuery}>
              查询
            </Button>
          </div>
        </div>
      </GlassCard>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {loading && items.length === 0
            ? "加载中..."
            : total > 0
              ? `已加载 ${items.length} / ${total} 条命中`
              : "暂无命中"}
        </p>
        {selectedOutlet && (
          <span className="text-xs text-muted-foreground">
            当前媒体: {selectedOutlet.outletName}
          </span>
        )}
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>

      {loading && items.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          正在拉取命中结果...
        </div>
      ) : items.length === 0 ? (
        <GlassCard variant="panel" padding="none">
          <EmptyState
            icon={FileText}
            title="暂无命中"
            description="该主题当前筛选条件下没有命中的采集内容。"
          />
        </GlassCard>
      ) : (
        <>
          <DataTable
            rows={items}
            rowKey={(item) => item.id}
            framed={false}
            columns={[
              {
                key: "_seq",
                header: "序号",
                width: "2.25rem",
                align: "center",
                render: (item) => (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {items.findIndex((it) => it.id === item.id) + 1}
                  </span>
                ),
              },
              {
                key: "title",
                header: "标题/内容",
                width: "48%",
                render: (item) => (
                  <div className="min-w-0">
                    <div className="line-clamp-2 text-sm font-medium leading-5 text-gray-900 dark:text-gray-100">
                      {item.title}
                    </div>
                    {(item.summary ?? item.content) && (
                      <div className="mt-0.5 line-clamp-2 text-[11px] leading-5 text-gray-500 dark:text-gray-400">
                        {item.summary ?? item.content}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: "matched",
                header: "命中关键词",
                width: "5.75rem",
                render: (item) => <KeywordChips values={item.topicMatchedKeywords ?? []} />,
              },
              {
                key: "fields",
                header: "命中字段",
                width: "4.75rem",
                render: (item) => (
                  <span
                    className="block truncate text-xs text-gray-600 dark:text-gray-300"
                    title={(item.topicHitFields ?? []).join("、")}
                  >
                    {(item.topicHitFields ?? []).join("、") || "—"}
                  </span>
                ),
              },
              {
                key: "tags",
                header: "标签",
                width: "4.25rem",
                render: (item) => (
                  <span
                    className="block truncate text-xs text-gray-600 dark:text-gray-300"
                    title={(item.tags ?? []).join("、")}
                  >
                    {(item.tags ?? []).slice(0, 3).join("、") || "—"}
                  </span>
                ),
              },
              {
                key: "outlet",
                header: "媒体/账号",
                width: "6rem",
                render: (item) => (
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm text-gray-700 dark:text-gray-300">
                      {item.outletName ?? item.author ?? "未分类"}
                    </span>
                    {item.outletTier && (
                      <span className="truncate text-xs text-muted-foreground">
                        {OUTLET_TIER_LABELS[item.outletTier as OutletTier] ?? item.outletTier}
                      </span>
                    )}
                  </div>
                ),
              },
              {
                key: "platform",
                header: "平台",
                width: "3.75rem",
                render: (item) => {
                  const label = item.platform ?? formatChannelLabel(item.firstSeenChannel);
                  if (!label || label === "—") {
                    return <span className="text-xs text-muted-foreground">—</span>;
                  }
                  return (
                    <span
                      className={cn(
                        "inline-flex max-w-full items-center truncate rounded-md px-1.5 py-0.5 text-[11px]",
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
                width: "4.25rem",
                render: (item) => {
                  if (!item.sourceType) {
                    return <span className="text-xs text-gray-400 dark:text-gray-500">—</span>;
                  }
                  const meta = adapterMetas.find((m) => m.type === item.sourceType);
                  const label = meta?.displayName ?? item.sourceType;
                  const chip =
                    SOURCE_TYPE_COLOR[item.sourceType] ??
                    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
                  return (
                    <span
                      className={cn("inline-flex max-w-full items-center truncate rounded-md px-2 py-0.5 text-[11px]", chip)}
                      title={item.firstSeenChannel}
                    >
                      {label}
                    </span>
                  );
                },
              },
              {
                key: "publishedAt",
                header: "发布时间",
                width: "4.75rem",
                render: (item) => {
                  const time = item.publishedAt ?? item.firstSeenAt ?? null;
                  if (!time) return <span className="text-xs text-muted-foreground">—</span>;
                  return (
                    <span
                      className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400"
                      title={formatAbsoluteTime(time)}
                    >
                      {formatRelativeTime(time)}
                    </span>
                  );
                },
              },
            ]}
          />
          <div className="flex flex-col items-center gap-2 py-4">
            {loadingMore && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                加载中...
              </div>
            )}
            {!loadingMore && hasMore && (
              <Button variant="ghost" size="sm" onClick={handleLoadMore}>
                加载更多
              </Button>
            )}
            {!hasMore && (
              <span className="text-xs text-muted-foreground">已加载全部 {total} 条</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function KeywordChips({ values }: { values: string[] }) {
  if (values.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex min-w-0 flex-wrap gap-1">
      {values.slice(0, 3).map((value) => (
        <span
          key={value}
          className="inline-flex max-w-full items-center truncate rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary"
          title={value}
        >
          {value}
        </span>
      ))}
      {values.length > 3 && (
        <span className="text-[11px] text-muted-foreground">+{values.length - 3}</span>
      )}
    </div>
  );
}

interface MediaAccountComboboxProps {
  outlets: MediaOutletRow[];
  accounts: string[];
  selectedOutletId: string | undefined;
  selectedAccount: string | undefined;
  onSelectAll: () => void;
  onSelectOutlet: (outletId: string) => void;
  onSelectAccount: (account: string) => void;
}

function MediaAccountCombobox({
  outlets,
  accounts,
  selectedOutletId,
  selectedAccount,
  onSelectAll,
  onSelectOutlet,
  onSelectAccount,
}: MediaAccountComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const selectedOutlet = selectedOutletId
    ? outlets.find((outlet) => outlet.id === selectedOutletId)
    : undefined;
  const selectedLabel = selectedOutlet?.outletName ?? selectedAccount ?? "全部媒体/账号";

  const filteredOutlets = useMemo(() => {
    if (!normalizedQuery) return outlets.slice(0, 80);
    return outlets
      .filter((outlet) => {
        const haystack = [
          outlet.outletName,
          outlet.groupName ?? "",
          ...(outlet.publicAccountNames ?? []),
          ...(outlet.domains ?? []),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalizedQuery);
      })
      .slice(0, 80);
  }, [outlets, normalizedQuery]);

  const filteredAccounts = useMemo(() => {
    if (!normalizedQuery) return accounts.slice(0, 80);
    return accounts
      .filter((account) => account.toLowerCase().includes(normalizedQuery))
      .slice(0, 80);
  }, [accounts, normalizedQuery]);

  const closeWith = (fn: () => void) => {
    fn();
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ComboboxTrigger className="w-44">
          <span className="truncate">{selectedLabel}</span>
        </ComboboxTrigger>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-2">
        <div className="space-y-2">
          <SearchInput
            placeholder="搜索媒体或账号"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            inputClassName="h-8 text-xs"
          />
          <div className="h-80 overflow-y-auto">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto w-full justify-start px-2 py-2"
              onClick={() => closeWith(onSelectAll)}
            >
              全部媒体/账号
            </Button>

            {filteredOutlets.length > 0 && (
              <div className="px-2 pb-1 pt-2 text-[11px] font-medium text-muted-foreground">
                媒体
              </div>
            )}
            {filteredOutlets.map((outlet) => (
              <Button
                key={outlet.id}
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto w-full justify-start px-2 py-2 text-left"
                onClick={() => closeWith(() => onSelectOutlet(outlet.id))}
              >
                <span className="min-w-0 flex-1 truncate">{outlet.outletName}</span>
              </Button>
            ))}

            {filteredAccounts.length > 0 && (
              <div className="px-2 pb-1 pt-2 text-[11px] font-medium text-muted-foreground">
                账号
              </div>
            )}
            {filteredAccounts.map((account) => (
              <Button
                key={account}
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto w-full justify-start px-2 py-2 text-left"
                onClick={() => closeWith(() => onSelectAccount(account))}
              >
                <span className="min-w-0 flex-1 truncate">{account}</span>
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

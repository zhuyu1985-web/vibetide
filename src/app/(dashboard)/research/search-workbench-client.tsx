"use client";

import { useState, useTransition, useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/shared/date-picker";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { formatChannelLabel } from "@/lib/collection/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  ExternalLink,
  FileText,
  Database,
  Loader2,
  SlidersHorizontal,
  BookMarked,
} from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import {
  searchArticles,
  searchAdvanced,
  fetchHitItemIdsForReport,
} from "@/app/actions/research/collected-item-search";
import { createReportFromSearch } from "@/app/actions/research/reports";
import type { CqDistrict } from "@/lib/dal/research/cq-districts";
// Outlet summary shape — id + name used for filter dropdown
type MediaOutletSummary = { id: string; name: string };
import type {
  ResearchItemResult as ArticleSearchResult,
  ResearchSearchResponse as ArticleSearchResponse,
} from "@/app/actions/research/collected-item-search";
import { AdvancedSearchBuilder, type BuilderOptions } from "./advanced-search-builder";
import { AdvancedFiltersSidebar } from "./advanced-filters-sidebar";
import { TopicLibrarySearch } from "./topic-library-search";
import { ItemDetailDrawer } from "@/app/(dashboard)/data-collection/content/item-detail-drawer";
import type {
  AdvancedSearchCondition,
  SidebarFilter,
} from "./search-mode-types";
import { highlightKeyword } from "@/lib/research/keyword-highlight";
import type { CollectedItemWithAnnotations } from "@/lib/dal/research/collected-item-search";
import type { TopicSummary } from "@/lib/dal/research/research-topics";

const TIER_OPTIONS = [
  { value: "central", label: "中央级" },
  { value: "provincial_municipal", label: "省/市级" },
  { value: "industry", label: "行业级" },
  { value: "district_media", label: "区县融媒体" },
  { value: "self_media", label: "自媒体/热榜" },
];

const TIER_BADGE_CLASS: Record<string, string> = {
  central: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  provincial_municipal: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  industry: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  district_media: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  self_media: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
};

const TIER_LABELS: Record<string, string> = {
  central: "中央级",
  provincial_municipal: "省/市级",
  industry: "行业级",
  district_media: "区县融媒体",
  self_media: "自媒体/热榜",
};

/* ─── Advanced search constants ─── */
// 旧版 inline advanced builder（FIELD_OPTIONS / getOperatorsForField / ConditionRow / defaultCondition / renderValueInput）
// 已在 A4 Phase 3 移除，由 AdvancedSearchBuilder + AdvancedFiltersSidebar + searchAdvanced action 替代。

export interface ResearchSourceOption {
  id: string;
  name: string;
  sourceType: string;
  sourceTypeLabel: string;
}

export function SearchWorkbenchClient({
  districts,
  outlets,
  outletsFull,
  sources,
  topics,
  initialResult,
  builderOptions,
  channelLabels,
}: {
  districts: CqDistrict[];
  outlets: MediaOutletSummary[];
  /** 完整 MediaOutletRow,给点标题打开的详情 drawer 用 */
  outletsFull: import("@/db/schema/media-outlet-dictionary").MediaOutletRow[];
  sources: ResearchSourceOption[];
  topics: TopicSummary[];
  initialResult?: ArticleSearchResponse;
  builderOptions: BuilderOptions;
  channelLabels: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"simple" | "advanced" | "topic">("simple");
  // 2026-05-14: 点标题打开详情 drawer(simple / advanced 两种模式共用)
  const [detailItemId, setDetailItemId] = useState<string | null>(null);

  // A5 Phase 8 — "生成报告"入口 dialog state
  // reportContext 记录本次点击是来自 simple 还是 advanced，dialog 文案/确认逻辑据此分支
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportTitle, setReportTitle] = useState("");
  const [reportDesc, setReportDesc] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportContext, setReportContext] = useState<
    | { kind: "simple"; total: number }
    | { kind: "advanced"; total: number }
    | { kind: "topic"; topicId: string; topicName: string; total: number }
    | null
  >(null);

  // Simple search filters
  const [keyword, setKeyword] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("__all__");
  const [districtFilter, setDistrictFilter] = useState<string>("__all__");
  const [outletFilter, setOutletFilter] = useState<string>("__all__");
  const [channelFilter, setChannelFilter] = useState<string>("__all__");
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");

  // A4 Phase 3：新版高级检索 state（外置 AdvancedSearchBuilder + AdvancedFiltersSidebar）
  // 默认 3 行用字面量 id（避免 SSR ↔ client hydration mismatch）；新增行由 addRow 用 crypto.randomUUID（点击后才触发，已脱离 SSR）
  const [advConditions, setAdvConditions] = useState<AdvancedSearchCondition[]>([
    {
      id: "adv-row-1",
      field: "title",
      operator: "contains",
      value: "",
      logic: "and",
    },
    {
      id: "adv-row-2",
      field: "topic",
      operator: "equals",
      value: "",
      logic: "and",
    },
    {
      id: "adv-row-3",
      field: "publishedAt",
      operator: "between",
      value: "",
      logic: "and",
    },
  ]);
  const [advSidebarFilter, setAdvSidebarFilter] = useState<SidebarFilter>({});
  const [advResults, setAdvResults] = useState<{
    items: CollectedItemWithAnnotations[];
    total: number;
    page: number;
    pageSize: number;
  } | null>(null);

  // Results — pre-hydrate with latest articles so 首屏 has data without manual search.
  // items/total/loadedPage 是 simple mode 无限滚动专用,advanced/topic 模式各有独立 state。
  const [items, setItems] = useState<ArticleSearchResult[]>(initialResult?.articles ?? []);
  const [total, setTotal] = useState(initialResult?.total ?? 0);
  const [loadedPage, setLoadedPage] = useState(initialResult ? 1 : 0);
  const [pageSize] = useState(initialResult?.pageSize ?? 50);
  const [hasSearched, setHasSearched] = useState(Boolean(initialResult));
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Selection (shared)
  const [selected, setSelected] = useState<Set<string>>(new Set());

  /* ─── Simple search ─── */

  const buildSimpleParams = useCallback(
    (page: number): Parameters<typeof searchArticles>[0] => {
      const params: Record<string, unknown> = { page, pageSize };
      if (keyword.trim()) params.keyword = keyword.trim();
      if (tierFilter !== "__all__") params.tiers = [tierFilter];
      if (districtFilter !== "__all__") params.districtIds = [districtFilter];
      if (outletFilter !== "__all__") params.outletId = outletFilter;
      if (channelFilter !== "__all__") params.sourceChannels = [channelFilter];
      if (timeStart) params.timeStart = timeStart;
      if (timeEnd) params.timeEnd = timeEnd + "T23:59:59.999Z";
      return params as Parameters<typeof searchArticles>[0];
    },
    [keyword, tierFilter, districtFilter, outletFilter, channelFilter, timeStart, timeEnd, pageSize],
  );

  const itemsRef = useRef(items);
  itemsRef.current = items;

  // 首次/筛选后的全量重搜:重置 items + loadedPage
  const runFreshSearch = useCallback(() => {
    startTransition(async () => {
      setLoadError(null);
      try {
        const res = await searchArticles(buildSimpleParams(1));
        setItems(res.articles);
        setTotal(res.total);
        setLoadedPage(1);
        setHasSearched(true);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "检索失败");
      }
    });
  }, [buildSimpleParams]);

  // 滚动触发的追加加载
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasSearched) return;
    if (itemsRef.current.length >= total) return;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const nextPage = loadedPage + 1;
      const res = await searchArticles(buildSimpleParams(nextPage));
      setItems((prev) => {
        const seen = new Set(prev.map((it) => it.id));
        const fresh = res.articles.filter((it) => !seen.has(it.id));
        return [...prev, ...fresh];
      });
      setTotal(res.total);
      setLoadedPage(nextPage);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "加载失败,请重试");
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasSearched, total, loadedPage, buildSimpleParams]);

  function handleSearch() {
    setSelected(new Set());
    runFreshSearch();
  }

  // 序号映射 — id → 当前列表中的位置(1-based)
  const seqOfId = useMemo(
    () => new Map(items.map((it, i) => [it.id, i + 1])),
    [items],
  );

  // IntersectionObserver — sentinel 进视口时自动 loadMore
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  /* ─── 简单 filter → advanced conditions+sidebar 映射 ─── */
  // 用于"生成报告"，把 simple 模式的 7 个 filter 翻译成 advanced 的 conditions+sidebar 形态，
  // 复用同一个 createReportFromSearch 入口。snapshot.hitItemIds 锁定数据，
  // outletId → outletName contains 这种轻微 fuzzy 不影响后续重生。
  function simpleFiltersToAdvanced(): {
    conditions: AdvancedSearchCondition[];
    sidebarFilter: SidebarFilter;
  } {
    const conditions: AdvancedSearchCondition[] = [];
    const sidebarFilter: SidebarFilter = {};
    if (keyword.trim()) {
      conditions.push({
        id: "sim-kw",
        field: "title",
        operator: "contains",
        value: keyword.trim(),
        logic: "and",
      });
    }
    if (tierFilter !== "__all__") sidebarFilter.outletTiers = [tierFilter];
    if (districtFilter !== "__all__") sidebarFilter.districtIds = [districtFilter];
    if (outletFilter !== "__all__") {
      const outlet = outlets.find((o) => o.id === outletFilter);
      if (outlet) {
        conditions.push({
          id: "sim-outlet",
          field: "outletName",
          operator: "contains",
          value: outlet.name,
          logic: "and",
        });
      }
    }
    if (channelFilter !== "__all__") {
      conditions.push({
        id: "sim-channel",
        field: "platform",
        operator: "equals",
        value: channelFilter,
        logic: "and",
      });
    }
    if (timeStart && timeEnd) {
      conditions.push({
        id: "sim-time",
        field: "publishedAt",
        operator: "between",
        value: "",
        valueRange: { from: timeStart, to: timeEnd + "T23:59:59.999Z" },
        logic: "and",
      });
    }
    return { conditions, sidebarFilter };
  }

  /* ─── A4 Phase 3：新版 advanced 检索（用 searchAdvanced server action） ─── */

  async function handleAdvancedSearch() {
    const filtered = advConditions.filter(
      (c) => Boolean(c.value?.trim()) || Boolean(c.valueRange),
    );
    try {
      const res = await searchAdvanced({
        conditions: filtered,
        sidebarFilter: advSidebarFilter,
        page: 1,
        pageSize: 50,
      });
      setAdvResults(res);
    } catch (err) {
      toast.error(`检索失败：${(err as Error).message}`);
    }
  }

  /* ─── A6 Phase 3: deeplink hydrate (?apply_query_builder=<JSON>) ─── */
  // research_query_builder tool 的 ToolActionCard "一键填入 A4 高级检索" 按钮
  // 会跳到 /research?mode=advanced&apply_query_builder=<encoded JSON>。
  // 这里读 searchParams 解析 → 切到 advanced 模式 + 填入 conditions / sidebarFilter
  // → 自动触发一次检索。
  useEffect(() => {
    const raw = searchParams.get("apply_query_builder");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        conditions?: Array<{
          field: string;
          operator: string;
          value: string | string[];
          logic: "and" | "or";
        }>;
        sidebarFilter?: {
          districtIds?: string[];
          topicIds?: string[];
        } | null;
      };

      if (!Array.isArray(parsed.conditions) || parsed.conditions.length === 0) {
        toast.error("AI 检索助手返回的条件为空");
        return;
      }

      // 把 skill 输出形态映射到 AdvancedSearchCondition：
      //   between → 用 valueRange (from/to) 替代字符串
      //   其他 → 字符串 value
      const mapped: AdvancedSearchCondition[] = parsed.conditions.map(
        (c, i) => {
          if (
            c.operator === "between" &&
            Array.isArray(c.value) &&
            c.value.length === 2
          ) {
            return {
              id: `applied-${i}`,
              field: c.field as AdvancedSearchCondition["field"],
              operator: "between",
              value: "",
              valueRange: { from: c.value[0], to: c.value[1] },
              logic: c.logic ?? "and",
            };
          }
          return {
            id: `applied-${i}`,
            field: c.field as AdvancedSearchCondition["field"],
            operator: c.operator as AdvancedSearchCondition["operator"],
            value: Array.isArray(c.value) ? c.value.join(",") : c.value,
            logic: c.logic ?? "and",
          };
        },
      );

      setMode("advanced");
      setAdvConditions(mapped);
      setAdvSidebarFilter({
        districtIds: parsed.sidebarFilter?.districtIds,
        topicIds: parsed.sidebarFilter?.topicIds,
      });
      toast.success(`已应用 AI 检索助手的 ${mapped.length} 条条件`);
      // 自动跑一次检索；handleAdvancedSearch 自带 try/catch + toast.error
      void (async () => {
        try {
          const res = await searchAdvanced({
            conditions: mapped,
            sidebarFilter: {
              districtIds: parsed.sidebarFilter?.districtIds,
              topicIds: parsed.sidebarFilter?.topicIds,
            },
            page: 1,
            pageSize: 50,
          });
          setAdvResults(res);
        } catch (err) {
          toast.error(`AI 助手填入后检索失败：${(err as Error).message}`);
        }
      })();
    } catch (err) {
      toast.error(`AI 检索助手参数解析失败：${(err as Error).message}`);
    }
    // 仅在 mount 时跑一次（searchParams 引用稳定，看 next/navigation 文档）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── Selection helpers ─── */

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllOnPage() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const a of items) next.add(a.id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  const hasMore = items.length < total;

  return (
    <div className="max-w-[1400px] mx-auto w-full space-y-6">
      {/* Top bar */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">新闻研究工作台</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              检索数据库中的新闻文章，筛选后批量分析
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/research/admin/topics"
              className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition"
            >
              <FileText className="h-3.5 w-3.5" />
              主题词库
            </Link>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <Link
              href="/research/reports"
              className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition"
            >
              <Database className="h-3.5 w-3.5" />
              研究报告
            </Link>
          </div>
        </div>

        {/* Mode toggle */}
        <Tabs
          value={mode}
          onValueChange={(v) => setMode(v as "simple" | "advanced" | "topic")}
          className="mb-3"
        >
          <TabsList variant="line">
            <TabsTrigger value="simple">快速搜索</TabsTrigger>
            <TabsTrigger value="advanced">
              <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
              高级检索
            </TabsTrigger>
            <TabsTrigger value="topic">
              <BookMarked className="h-3.5 w-3.5 mr-1" />
              主题词库检索
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Simple mode */}
        {mode === "simple" && (
          <>
            <div className="flex gap-2">
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="输入关键词搜索新闻标题和正文..."
                className="flex-1"
              />
              <Button variant="ghost" onClick={handleSearch} disabled={pending}>
                <Search className="h-4 w-4 mr-1" />
                搜索
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select value={tierFilter} onValueChange={setTierFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="媒体层级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部层级</SelectItem>
                  {TIER_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={districtFilter} onValueChange={setDistrictFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="区县" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部区县</SelectItem>
                  {districts.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={outletFilter} onValueChange={setOutletFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="具体媒体" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部媒体</SelectItem>
                  {outlets.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger className="w-28">
                  <SelectValue placeholder="渠道" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部渠道</SelectItem>
                  {channelLabels.map((label) => (
                    <SelectItem key={label} value={label}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1">
                <DatePicker
                  value={timeStart ? new Date(timeStart) : null}
                  onChange={(d) => setTimeStart(d ? format(d, "yyyy-MM-dd") : "")}
                  placeholder="开始日期"
                />
                <span className="text-gray-500 dark:text-gray-400 text-xs">至</span>
                <DatePicker
                  value={timeEnd ? new Date(timeEnd) : null}
                  onChange={(d) => setTimeEnd(d ? format(d, "yyyy-MM-dd") : "")}
                  placeholder="结束日期"
                />
              </div>
            </div>
          </>
        )}

        {/* Advanced mode (A4 Phase 3：外置 AdvancedSearchBuilder + AdvancedFiltersSidebar) */}
        {mode === "advanced" && (
          <div className="flex gap-4">
            {/* min-w-0:让 flex-1 子项能收缩到 viewport 宽度,否则结果表格里的长标题会撑爆容器 */}
            <div className="flex-1 min-w-0 space-y-3">
              <AdvancedSearchBuilder
                conditions={advConditions}
                onChange={setAdvConditions}
                options={builderOptions}
              />
              <div className="flex items-center gap-2 pt-1">
                <div className="flex-1" />
                <Button variant="ghost" onClick={handleAdvancedSearch} disabled={pending}>
                  <Search className="h-4 w-4 mr-1" />
                  开始检索
                </Button>
              </div>

              {advResults && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-sm text-muted-foreground">
                      命中{" "}
                      <strong className="text-foreground">
                        {advResults.total}
                      </strong>{" "}
                      条
                      {advResults.total > 500 && (
                        <span className="ml-2 text-amber-600 dark:text-amber-400 text-xs">
                          超 500 条，无法生成报告，请缩小条件
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={
                        advResults.total === 0 ||
                        advResults.total > 500 ||
                        pending
                      }
                      onClick={() => {
                        setReportTitle("高级检索研究报告");
                        setReportDesc("");
                        setReportContext({
                          kind: "advanced",
                          total: advResults.total,
                        });
                        setReportDialogOpen(true);
                      }}
                    >
                      <FileText className="h-3.5 w-3.5 mr-1" />
                      生成报告
                    </Button>
                  </div>
                  <DataTable
                    rows={advResults.items}
                    rowKey={(r) => r.id}
                    columns={[
                      {
                        key: "title",
                        header: "标题",
                        render: (r) => {
                          const titleKw = advConditions.find(
                            (c) => c.field === "title" && c.operator === "contains",
                          )?.value;
                          return (
                            <Button
                              variant="ghost"
                              onClick={() => setDetailItemId(r.id)}
                              className="h-auto p-0 truncate w-full justify-start text-left text-sm font-normal hover:text-sky-600 hover:bg-transparent"
                              title={r.title}
                            >
                              <span className="truncate">{highlightKeyword(r.title, titleKw)}</span>
                            </Button>
                          );
                        },
                      },
                      {
                        key: "outlet",
                        header: "媒体",
                        width: "w-40",
                        render: (r) => (
                          <span className="text-muted-foreground truncate block">
                            {r.outletName ?? "未分类"}
                            {r.outletTier ? (
                              <span className="ml-1 text-xs">
                                ({TIER_LABELS[r.outletTier] ?? r.outletTier})
                              </span>
                            ) : null}
                          </span>
                        ),
                      },
                      {
                        key: "publishedAt",
                        header: "时间",
                        width: "w-28",
                        render: (r) => (
                          <span className="text-xs text-muted-foreground">
                            {r.publishedAt
                              ? new Date(r.publishedAt).toLocaleDateString("zh-CN")
                              : "-"}
                          </span>
                        ),
                      },
                      {
                        key: "url",
                        header: "原文",
                        width: "w-14",
                        align: "right",
                        render: (r) =>
                          r.url ? (
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-end text-sky-600 hover:text-sky-700"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          ),
                      },
                    ] satisfies DataTableColumn<CollectedItemWithAnnotations>[]}
                  />
                </div>
              )}
            </div>

            <AdvancedFiltersSidebar
              filter={advSidebarFilter}
              onChange={setAdvSidebarFilter}
              options={{
                districts: builderOptions.districts,
                topics: builderOptions.topics,
                sources,
              }}
            />
          </div>
        )}

        {/* Topic library mode */}
        {mode === "topic" && (
          <TopicLibrarySearch
            topics={topics}
            outletsFull={outletsFull}
            onRequestReport={(req) => {
              setReportTitle(`${req.topicName} · 主题研究报告`);
              setReportDesc("");
              setReportContext({
                kind: "topic",
                topicId: req.topicId,
                topicName: req.topicName,
                total: req.total,
              });
              setReportDialogOpen(true);
            }}
          />
        )}
      </div>

      {/* Results (shared, simple mode only — advanced/topic 各有独立结果区) */}
      <div hidden={mode !== "simple"}>
        {!hasSearched ? (
          <GlassCard variant="default" padding="lg">
            <div className="text-center text-gray-500 dark:text-gray-400 py-10">
              输入关键词或筛选条件后点击搜索，查询数据库中已采集的新闻
            </div>
          </GlassCard>
        ) : items.length === 0 ? (
          <GlassCard variant="default" padding="lg">
            <div className="text-center text-gray-500 dark:text-gray-400 py-10 space-y-2">
              <div>数据库中暂未检索到符合条件的文章</div>
              <div className="text-xs">
                研究工作台的数据来自 Collection Hub 统一采集池，可到{" "}
                <Link
                  href="/data-collection"
                  className="text-sky-600 dark:text-sky-400 hover:underline"
                >
                  数据采集
                </Link>{" "}
                模块补充数据
              </div>
            </div>
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {/* Count + 已加载进度 + 生成报告 */}
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 gap-3 flex-wrap">
              <span>
                已加载{" "}
                <strong className="text-foreground">{items.length}</strong> /{" "}
                {total} 条
                {total > 500 && (
                  <span className="ml-2 text-amber-600 dark:text-amber-400 text-xs">
                    超 500 条，无法生成报告，请缩小条件
                  </span>
                )}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={total === 0 || total > 500 || pending || loadingMore}
                onClick={() => {
                  setReportTitle("快速检索研究报告");
                  setReportDesc("");
                  setReportContext({ kind: "simple", total });
                  setReportDialogOpen(true);
                }}
              >
                <FileText className="h-3.5 w-3.5 mr-1" />
                生成报告
              </Button>
            </div>

            {/* Table */}
            <DataTable
              rows={items}
              rowKey={(a) => a.id}
              selectable
              selectedKeys={selected}
              onSelectionChange={setSelected}
              columns={[
                {
                  key: "_seq",
                  header: "序号",
                  width: "w-14",
                  align: "center",
                  render: (a) => (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {seqOfId.get(a.id)}
                    </span>
                  ),
                },
                {
                  key: "title",
                  header: "标题",
                  render: (a) => (
                    <Button
                      variant="ghost"
                      onClick={() => setDetailItemId(a.id)}
                      className="h-auto p-0 truncate w-full justify-start text-left text-sm font-normal hover:text-sky-600 hover:bg-transparent"
                      title={a.title}
                    >
                      <span className="truncate">{a.title}</span>
                    </Button>
                  ),
                },
                {
                  key: "outlet",
                  header: "媒体名",
                  width: "w-28",
                  render: (a) => (
                    <span className="text-muted-foreground truncate block">
                      {a.outletName ?? a.platformFallback ?? "-"}
                    </span>
                  ),
                },
                {
                  key: "tier",
                  header: "层级",
                  width: "w-24",
                  render: (a) =>
                    a.outletTier ? (
                      <Badge
                        className={
                          TIER_BADGE_CLASS[a.outletTier] ??
                          "bg-gray-100 text-gray-700"
                        }
                      >
                        {TIER_LABELS[a.outletTier] ?? a.outletTier}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    ),
                },
                {
                  key: "district",
                  header: "区县",
                  width: "w-20",
                  render: (a) => (
                    <span className="text-muted-foreground truncate block">{a.districtName ?? "-"}</span>
                  ),
                },
                {
                  key: "publishedAt",
                  header: "发布时间",
                  width: "w-28",
                  render: (a) => (
                    <span className="text-xs text-muted-foreground">
                      {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString("zh-CN") : "-"}
                    </span>
                  ),
                },
                {
                  key: "channel",
                  header: "渠道",
                  width: "w-32",
                  render: (a) => {
                    const raw = a.sourceChannels?.length
                      ? a.sourceChannels.map((c) => c.channel)
                      : [a.firstSeenChannel];
                    const labels = Array.from(new Set(raw.map(formatChannelLabel)));
                    const visible = labels.slice(0, 2);
                    const rest = labels.length - visible.length;
                    return (
                      <div
                        className="flex flex-wrap items-center gap-1"
                        title={labels.join("、")}
                      >
                        {visible.map((l) => (
                          <span
                            key={l}
                            className="inline-flex items-center rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-1.5 py-0.5 text-[11px]"
                          >
                            {l}
                          </span>
                        ))}
                        {rest > 0 && (
                          <span className="text-[11px] text-muted-foreground">
                            +{rest}
                          </span>
                        )}
                      </div>
                    );
                  },
                },
                {
                  key: "url",
                  header: "原链",
                  width: "w-14",
                  align: "right",
                  render: (a) => (
                    <a
                      href={a.url ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-end text-sky-600 hover:text-sky-700"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ),
                },
              ] satisfies DataTableColumn<ArticleSearchResult>[]}
            />

            {/* 无限滚动 sentinel + 加载状态 */}
            <div
              ref={sentinelRef}
              className="flex flex-col items-center gap-2 py-4"
            >
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
              {!hasMore && !loadingMore && !loadError && items.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  已加载全部 {total} 条
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* A5 Phase 8 — "生成报告"入口 2 dialog */}
      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>生成研究报告</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">报告标题</label>
              <Input
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                placeholder="自定义报告标题"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                主题描述（可选）
              </label>
              <Textarea
                value={reportDesc}
                onChange={(e) => setReportDesc(e.target.value)}
                placeholder="给 AI 写背景段提供线索"
                rows={3}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              将基于当前
              {reportContext?.kind === "simple"
                ? "快速搜索"
                : reportContext?.kind === "topic"
                  ? `主题词库「${reportContext.topicName}」`
                  : "高级检索"}
              {reportContext?.kind === "topic" ? "" : "条件"}命中的{" "}
              <strong className="text-foreground">
                {reportContext?.total ?? 0}
              </strong>{" "}
              条数据生成报告（最多 500 条）。
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setReportDialogOpen(false)}
              disabled={reportSubmitting}
            >
              取消
            </Button>
            <Button
              variant="ghost"
              disabled={reportSubmitting || !reportTitle.trim()}
              onClick={async () => {
                const t = reportTitle.trim();
                if (!t) {
                  toast.error("请输入报告标题");
                  return;
                }
                setReportSubmitting(true);
                try {
                  // 1) 根据 context 决定 conditions + sidebarFilter 来源
                  let conditions: AdvancedSearchCondition[];
                  let sidebarFilter: SidebarFilter;
                  if (reportContext?.kind === "simple") {
                    const mapped = simpleFiltersToAdvanced();
                    conditions = mapped.conditions;
                    sidebarFilter = mapped.sidebarFilter;
                  } else if (reportContext?.kind === "topic") {
                    conditions = [];
                    sidebarFilter = { topicIds: [reportContext.topicId] };
                  } else {
                    conditions = advConditions.filter(
                      (c) => Boolean(c.value?.trim()) || Boolean(c.valueRange),
                    );
                    sidebarFilter = advSidebarFilter;
                  }
                  // 2) 预拿全量 hitItemIds（≤ 500）
                  const { hitItemIds } = await fetchHitItemIdsForReport({
                    conditions,
                    sidebarFilter,
                  });
                  if (hitItemIds.length === 0) {
                    toast.error("没有命中数据可生成报告");
                    return;
                  }
                  if (hitItemIds.length > 500) {
                    toast.error("命中数据超过 500 条，请缩小检索条件");
                    return;
                  }
                  // 3) 创建报告 + 触发 Inngest
                  const r = await createReportFromSearch({
                    conditions,
                    sidebarFilter,
                    hitItemIds,
                    title: t,
                    topicDescription: reportDesc.trim() || undefined,
                  });
                  setReportDialogOpen(false);
                  toast.success("报告生成已启动，正在分析数据…");
                  router.push(`/research/reports/${r.reportId}`);
                } catch (err) {
                  toast.error(`生成报告失败：${(err as Error).message}`);
                } finally {
                  setReportSubmitting(false);
                }
              }}
            >
              {reportSubmitting ? "提交中…" : "确认生成"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bottom action bar (shared) */}
      {selected.size > 0 && (
        <div className="sticky bottom-0 bg-[var(--glass-panel-bg)] backdrop-blur-xl border-t border-gray-200 dark:border-white/5 px-6 py-3 flex items-center gap-3">
          <span className="text-sm font-medium">
            已选 {selected.size} 篇
          </span>
          <Button variant="ghost" size="sm" onClick={selectAllOnPage}>
            全选当前页
          </Button>
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            取消全选
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toast.info("S3 阶段接入综合分析功能")}
          >
            综合分析
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => toast.info("S6 阶段接入导出功能")}
          >
            导出选中
          </Button>
        </div>
      )}

      {/* 2026-05-14: 详情抽屉 — simple / advanced / topic 三个模式都通过 setDetailItemId 打开 */}
      <ItemDetailDrawer
        itemId={detailItemId}
        onClose={() => setDetailItemId(null)}
        outlets={outletsFull}
      />
    </div>
  );
}

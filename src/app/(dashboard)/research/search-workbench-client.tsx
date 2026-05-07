"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/shared/date-picker";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  ExternalLink,
  Settings,
  FileText,
  Database,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import {
  searchArticles,
  searchAdvanced,
} from "@/app/actions/research/collected-item-search";
import type { CqDistrict } from "@/lib/dal/research/cq-districts";
// Outlet summary shape — id + name used for filter dropdown
type MediaOutletSummary = { id: string; name: string };
import type {
  ResearchItemResult as ArticleSearchResult,
  ResearchSearchResponse as ArticleSearchResponse,
} from "@/app/actions/research/collected-item-search";
import { AdvancedSearchBuilder, type BuilderOptions } from "./advanced-search-builder";
import { AdvancedFiltersSidebar } from "./advanced-filters-sidebar";
import type {
  AdvancedSearchCondition,
  SidebarFilter,
} from "./search-mode-types";
import { highlightKeyword } from "@/lib/research/keyword-highlight";
import type { CollectedItemWithAnnotations } from "@/lib/dal/research/collected-item-search";

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

const CHANNEL_OPTIONS = [
  { value: "tavily", label: "全网搜索" },
  { value: "whitelist_crawl", label: "白名单" },
  { value: "manual_url", label: "手工URL" },
  { value: "hot_topic_crawler", label: "热榜采集" },
];

const CHANNEL_LABELS: Record<string, string> = {
  tavily: "全网搜索",
  whitelist_crawl: "白名单",
  manual_url: "手工URL",
  hot_topic_crawler: "热榜采集",
};

/* ─── Advanced search constants ─── */
// 旧版 inline advanced builder（FIELD_OPTIONS / getOperatorsForField / ConditionRow / defaultCondition / renderValueInput）
// 已在 A4 Phase 3 移除，由 AdvancedSearchBuilder + AdvancedFiltersSidebar + searchAdvanced action 替代。

export function SearchWorkbenchClient({
  districts,
  outlets,
  initialResult,
  builderOptions,
}: {
  districts: CqDistrict[];
  outlets: MediaOutletSummary[];
  initialResult?: ArticleSearchResponse;
  builderOptions: BuilderOptions;
}) {
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"simple" | "advanced">("simple");

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

  // Results (shared) — pre-hydrate with latest articles so 首屏 has data without manual search
  const [result, setResult] = useState<ArticleSearchResponse | null>(initialResult ?? null);
  const [currentPage, setCurrentPage] = useState(1);

  // Selection (shared)
  const [selected, setSelected] = useState<Set<string>>(new Set());

  /* ─── Simple search ─── */

  const doSimpleSearch = useCallback(
    (page: number) => {
      startTransition(async () => {
        const params: Record<string, unknown> = { page, pageSize: 50 };
        if (keyword.trim()) params.keyword = keyword.trim();
        if (tierFilter !== "__all__") params.tiers = [tierFilter];
        if (districtFilter !== "__all__") params.districtIds = [districtFilter];
        if (outletFilter !== "__all__") params.outletId = outletFilter;
        if (channelFilter !== "__all__")
          params.sourceChannels = [channelFilter];
        if (timeStart) params.timeStart = timeStart;
        if (timeEnd) params.timeEnd = timeEnd + "T23:59:59.999Z";

        const res = await searchArticles(params as Parameters<typeof searchArticles>[0]);
        setResult(res);
        setCurrentPage(page);
      });
    },
    [keyword, tierFilter, districtFilter, outletFilter, channelFilter, timeStart, timeEnd],
  );

  // A4 Phase 3：简单模式仍走 doSimpleSearch；高级模式由 handleAdvancedSearch 单独处理
  const doSearch = doSimpleSearch;

  function handleSearch() {
    setSelected(new Set());
    doSearch(1);
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
    if (!result) return;
    setSelected((prev) => {
      const next = new Set(prev);
      for (const a of result.articles) next.add(a.id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  const totalPages = result ? Math.ceil(result.total / result.pageSize) : 0;

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
              href="/research/admin/media-outlets"
              className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition"
            >
              <Settings className="h-3.5 w-3.5" />
              媒体源管理
            </Link>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <Link
              href="/research/admin/topics"
              className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition"
            >
              <FileText className="h-3.5 w-3.5" />
              主题词库
            </Link>
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <Link
              href="/research/admin/tasks"
              className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition"
            >
              <Database className="h-3.5 w-3.5" />
              检索快照
            </Link>
          </div>
        </div>

        {/* Mode toggle */}
        <Tabs value={mode} onValueChange={(v) => setMode(v as "simple" | "advanced")} className="mb-3">
          <TabsList variant="line">
            <TabsTrigger value="simple">快速搜索</TabsTrigger>
            <TabsTrigger value="advanced">
              <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
              高级检索
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
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="采集来源" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">全部来源</SelectItem>
                  {CHANNEL_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
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
            <div className="flex-1 space-y-3">
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
                  <div className="text-sm text-muted-foreground">
                    命中 <strong className="text-foreground">{advResults.total}</strong> 条
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
                            <span className="truncate block" title={r.title}>
                              {highlightKeyword(r.title, titleKw)}
                            </span>
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
              }}
            />
          </div>
        )}
      </div>

      {/* Results (shared, simple mode only — advanced has its own DataTable above) */}
      <div hidden={mode === "advanced"}>
        {!result ? (
          <GlassCard variant="default" padding="lg">
            <div className="text-center text-gray-500 dark:text-gray-400 py-10">
              输入关键词或筛选条件后点击搜索，查询数据库中已采集的新闻
            </div>
          </GlassCard>
        ) : result.articles.length === 0 ? (
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
                模块补充数据，或新建{" "}
                <Link
                  href="/research/admin/tasks/new"
                  className="text-sky-600 dark:text-sky-400 hover:underline"
                >
                  检索快照
                </Link>{" "}
                保存当前筛选条件
              </div>
            </div>
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {/* Count + pagination info */}
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>
                共 <strong className="text-foreground">{result.total}</strong> 条结果
                {totalPages > 1 &&
                  ` · 第 ${result.page}/${totalPages} 页`}
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={currentPage <= 1 || pending}
                    onClick={() => doSearch(currentPage - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    上一页
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={currentPage >= totalPages || pending}
                    onClick={() => doSearch(currentPage + 1)}
                  >
                    下一页
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Table */}
            <DataTable
              rows={result.articles as ArticleSearchResult[]}
              rowKey={(a) => a.id}
              selectable
              selectedKeys={selected}
              onSelectionChange={setSelected}
              columns={[
                {
                  key: "title",
                  header: "标题",
                  render: (a) => (
                    <span className="truncate block" title={a.title}>{a.title}</span>
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
                  header: "来源",
                  width: "w-20",
                  render: (a) => (
                    <span className="text-xs text-muted-foreground truncate block">
                      {CHANNEL_LABELS[a.sourceChannel] ?? a.sourceChannel}
                    </span>
                  ),
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
          </div>
        )}
      </div>

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
    </div>
  );
}

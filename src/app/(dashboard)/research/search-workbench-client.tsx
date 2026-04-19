"use client";

import { useState, useTransition, useCallback } from "react";
import Link from "next/link";
import { format } from "date-fns";
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
import {
  Search,
  ExternalLink,
  Settings,
  FileText,
  Database,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Plus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/shared/glass-card";
import { searchArticles, advancedSearchArticles } from "@/app/actions/research/article-search";
import type { CqDistrict } from "@/lib/dal/research/cq-districts";
import type { MediaOutletSummary } from "@/lib/dal/research/media-outlets";
import type {
  ArticleSearchResult,
  ArticleSearchResponse,
  AdvancedSearchField,
  AdvancedSearchOperator,
} from "@/lib/dal/research/news-article-search";

const TIER_OPTIONS = [
  { value: "central", label: "中央级" },
  { value: "provincial_municipal", label: "省/市级" },
  { value: "industry", label: "行业级" },
  { value: "district_media", label: "区县融媒体" },
];

const TIER_BADGE_CLASS: Record<string, string> = {
  central: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  provincial_municipal: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  industry: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  district_media: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
};

const TIER_LABELS: Record<string, string> = {
  central: "中央级",
  provincial_municipal: "省/市级",
  industry: "行业级",
  district_media: "区县融媒体",
};

const CHANNEL_OPTIONS = [
  { value: "tavily", label: "全网搜索" },
  { value: "whitelist_crawl", label: "白名单" },
  { value: "manual_url", label: "手工URL" },
];

const CHANNEL_LABELS: Record<string, string> = {
  tavily: "全网搜索",
  whitelist_crawl: "白名单",
  manual_url: "手工URL",
};

/* ─── Advanced search constants ─── */

const FIELD_OPTIONS: { value: AdvancedSearchField; label: string }[] = [
  { value: "keyword", label: "关键词（标题+正文）" },
  { value: "title", label: "标题" },
  { value: "content", label: "正文" },
  { value: "outletName", label: "媒体名" },
  { value: "tier", label: "媒体层级" },
  { value: "district", label: "区县" },
  { value: "channel", label: "采集来源" },
  { value: "publishedAt", label: "发布时间" },
];

function getOperatorsForField(
  field: AdvancedSearchField,
): { value: AdvancedSearchOperator; label: string }[] {
  switch (field) {
    case "keyword":
    case "title":
    case "content":
      return [
        { value: "contains", label: "包含" },
        { value: "not_contains", label: "不含" },
      ];
    case "outletName":
      return [
        { value: "contains", label: "包含" },
        { value: "not_contains", label: "不含" },
        { value: "equals", label: "等于" },
      ];
    case "tier":
    case "district":
    case "channel":
      return [
        { value: "equals", label: "等于" },
        { value: "not_equals", label: "不等于" },
      ];
    case "publishedAt":
      return [{ value: "between", label: "在...之间" }];
    default:
      return [{ value: "contains", label: "包含" }];
  }
}

type ConditionRow = {
  id: string;
  field: AdvancedSearchField;
  operator: AdvancedSearchOperator;
  value: string;
  value2: string;
  logic: "and" | "or";
};

let conditionIdCounter = 0;
function newConditionId() {
  return `cond_${++conditionIdCounter}_${Date.now()}`;
}

function defaultCondition(): ConditionRow {
  return {
    id: newConditionId(),
    field: "keyword",
    operator: "contains",
    value: "",
    value2: "",
    logic: "and",
  };
}

export function SearchWorkbenchClient({
  districts,
  outlets,
}: {
  districts: CqDistrict[];
  outlets: MediaOutletSummary[];
}) {
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

  // Advanced search conditions
  const [conditions, setConditions] = useState<ConditionRow[]>([defaultCondition()]);

  // Results (shared)
  const [result, setResult] = useState<ArticleSearchResponse | null>(null);
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

  /* ─── Advanced search ─── */

  const doAdvancedSearch = useCallback(
    (page: number) => {
      const validConditions = conditions
        .filter((c) => {
          if (c.field === "publishedAt") return c.value.trim() && c.value2.trim();
          return c.value.trim();
        })
        .map((c) => ({
          field: c.field,
          operator: c.operator,
          value: c.value.trim(),
          value2: c.value2.trim() || undefined,
          logic: c.logic,
        }));

      if (validConditions.length === 0) return;

      startTransition(async () => {
        const res = await advancedSearchArticles({
          conditions: validConditions,
          page,
          pageSize: 50,
        });
        setResult(res);
        setCurrentPage(page);
      });
    },
    [conditions],
  );

  const doSearch = mode === "simple" ? doSimpleSearch : doAdvancedSearch;

  function handleSearch() {
    setSelected(new Set());
    doSearch(1);
  }

  /* ─── Condition row helpers ─── */

  function updateCondition(id: string, patch: Partial<ConditionRow>) {
    setConditions((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  }

  function handleFieldChange(id: string, field: AdvancedSearchField) {
    const ops = getOperatorsForField(field);
    updateCondition(id, { field, operator: ops[0].value, value: "", value2: "" });
  }

  function addCondition() {
    if (conditions.length >= 10) return;
    setConditions((prev) => [...prev, defaultCondition()]);
  }

  function removeCondition(id: string) {
    setConditions((prev) => (prev.length <= 1 ? prev : prev.filter((c) => c.id !== id)));
  }

  function resetConditions() {
    setConditions([defaultCondition()]);
  }

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

  /* ─── Condition value input renderer ─── */

  function renderValueInput(row: ConditionRow) {
    switch (row.field) {
      case "tier":
        return (
          <Select value={row.value} onValueChange={(v) => updateCondition(row.id, { value: v })}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="选择层级" />
            </SelectTrigger>
            <SelectContent>
              {TIER_OPTIONS.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "district":
        return (
          <Select value={row.value} onValueChange={(v) => updateCondition(row.id, { value: v })}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="选择区县" />
            </SelectTrigger>
            <SelectContent>
              {districts.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "channel":
        return (
          <Select value={row.value} onValueChange={(v) => updateCondition(row.id, { value: v })}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="选择来源" />
            </SelectTrigger>
            <SelectContent>
              {CHANNEL_OPTIONS.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "publishedAt":
        return (
          <div className="flex items-center gap-1">
            <DatePicker
              value={row.value ? new Date(row.value) : null}
              onChange={(d) => updateCondition(row.id, { value: d ? format(d, "yyyy-MM-dd") : "" })}
              placeholder="开始"
            />
            <span className="text-xs text-muted-foreground">至</span>
            <DatePicker
              value={row.value2 ? new Date(row.value2) : null}
              onChange={(d) => updateCondition(row.id, { value2: d ? format(d, "yyyy-MM-dd") : "" })}
              placeholder="结束"
            />
          </div>
        );
      default:
        return (
          <Input
            value={row.value}
            onChange={(e) => updateCondition(row.id, { value: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="输入搜索值..."
            className="w-48"
          />
        );
    }
  }

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
              采集任务
            </Link>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1 mb-3">
          <button
            type="button"
            onClick={() => setMode("simple")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
              mode === "simple"
                ? "bg-gray-900 dark:bg-white/90 text-white dark:text-gray-900"
                : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
            )}
          >
            快速搜索
          </button>
          <button
            type="button"
            onClick={() => setMode("advanced")}
            className={cn(
              "inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
              mode === "advanced"
                ? "bg-gray-900 dark:bg-white/90 text-white dark:text-gray-900"
                : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5"
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
            高级检索
          </button>
        </div>

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

        {/* Advanced mode */}
        {mode === "advanced" && (
          <div className="space-y-2">
            {conditions.map((row, idx) => (
              <div key={row.id}>
                {/* Logic connector between rows */}
                {idx > 0 && (
                  <div className="flex items-center gap-2 my-1.5 ml-2">
                    <div className="flex gap-1">
                      {(["and", "or"] as const).map((logic) => (
                        <button
                          key={logic}
                          type="button"
                          onClick={() => updateCondition(row.id, { logic })}
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[11px] font-medium transition-all",
                            row.logic === logic
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                              : "text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5"
                          )}
                        >
                          {logic.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* Condition row */}
                <div className="flex items-center gap-2">
                  {/* Field */}
                  <Select
                    value={row.field}
                    onValueChange={(v) => handleFieldChange(row.id, v as AdvancedSearchField)}
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_OPTIONS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Operator */}
                  <Select
                    value={row.operator}
                    onValueChange={(v) =>
                      updateCondition(row.id, { operator: v as AdvancedSearchOperator })
                    }
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getOperatorsForField(row.field).map((op) => (
                        <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Value */}
                  {renderValueInput(row)}

                  {/* Remove */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCondition(row.id)}
                    disabled={conditions.length <= 1}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={addCondition}
                disabled={conditions.length >= 10}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                添加条件
              </Button>
              <Button variant="ghost" size="sm" onClick={resetConditions}>
                重置
              </Button>
              <div className="flex-1" />
              <Button variant="ghost" onClick={handleSearch} disabled={pending}>
                <Search className="h-4 w-4 mr-1" />
                检索
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Results (shared) */}
      <div>
        {!result ? (
          <GlassCard variant="default" padding="lg">
            <div className="text-center text-gray-500 dark:text-gray-400 py-10">
              输入关键词或筛选条件后点击搜索，查询数据库中已采集的新闻
            </div>
          </GlassCard>
        ) : result.articles.length === 0 ? (
          <GlassCard variant="default" padding="lg">
            <div className="text-center text-gray-500 dark:text-gray-400 py-10">
              未找到匹配的新闻文章，请调整搜索条件
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
                    <span className="text-muted-foreground truncate block">{a.outletName ?? "-"}</span>
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
                      href={a.url}
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
            onClick={() => alert("S3 阶段接入综合分析功能")}
          >
            综合分析
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => alert("S6 阶段接入导出功能")}
          >
            导出选中
          </Button>
        </div>
      )}
    </div>
  );
}

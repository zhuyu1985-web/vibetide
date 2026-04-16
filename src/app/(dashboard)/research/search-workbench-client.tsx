"use client";

import { useState, useTransition, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
} from "lucide-react";
import { searchArticles } from "@/app/actions/research/article-search";
import type { CqDistrict } from "@/lib/dal/research/cq-districts";
import type { MediaOutletSummary } from "@/lib/dal/research/media-outlets";
import type {
  ArticleSearchResult,
  ArticleSearchResponse,
} from "@/lib/dal/research/news-article-search";

const TIER_OPTIONS = [
  { value: "central", label: "中央级" },
  { value: "provincial_municipal", label: "省/市级" },
  { value: "industry", label: "行业级" },
  { value: "district_media", label: "区县融媒体" },
];

const TIER_BADGE_CLASS: Record<string, string> = {
  central: "bg-blue-100 text-blue-700",
  provincial_municipal: "bg-emerald-100 text-emerald-700",
  industry: "bg-amber-100 text-amber-700",
  district_media: "bg-violet-100 text-violet-700",
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

export function SearchWorkbenchClient({
  districts,
  outlets,
}: {
  districts: CqDistrict[];
  outlets: MediaOutletSummary[];
}) {
  const [pending, startTransition] = useTransition();

  // Search filters
  const [keyword, setKeyword] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("__all__");
  const [districtFilter, setDistrictFilter] = useState<string>("__all__");
  const [outletFilter, setOutletFilter] = useState<string>("__all__");
  const [channelFilter, setChannelFilter] = useState<string>("__all__");
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");

  // Results
  const [result, setResult] = useState<ArticleSearchResponse | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const doSearch = useCallback(
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

  function handleSearch() {
    setSelected(new Set());
    doSearch(1);
  }

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
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="p-6 pb-0 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">新闻研究工作台</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              检索数据库中的新闻文章，筛选后批量分析
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Link
              href="/research/admin/media-outlets"
              className="inline-flex items-center gap-1 hover:text-foreground transition"
            >
              <Settings className="h-3.5 w-3.5" />
              媒体源管理
            </Link>
            <span>·</span>
            <Link
              href="/research/admin/topics"
              className="inline-flex items-center gap-1 hover:text-foreground transition"
            >
              <FileText className="h-3.5 w-3.5" />
              主题词库
            </Link>
            <span>·</span>
            <Link
              href="/research/admin/tasks"
              className="inline-flex items-center gap-1 hover:text-foreground transition"
            >
              <Database className="h-3.5 w-3.5" />
              采集任务
            </Link>
          </div>
        </div>

        {/* Search bar */}
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

        {/* Filters */}
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
            <Input
              type="date"
              value={timeStart}
              onChange={(e) => setTimeStart(e.target.value)}
              className="w-36"
            />
            <span className="text-muted-foreground text-xs">至</span>
            <Input
              type="date"
              value={timeEnd}
              onChange={(e) => setTimeEnd(e.target.value)}
              className="w-36"
            />
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto p-6 pt-4">
        {!result ? (
          <div className="rounded-xl bg-card p-16 text-center text-muted-foreground">
            输入关键词或筛选条件后点击搜索，查询数据库中已采集的新闻
          </div>
        ) : result.articles.length === 0 ? (
          <div className="rounded-xl bg-card p-16 text-center text-muted-foreground">
            未找到匹配的新闻文章，请调整搜索条件
          </div>
        ) : (
          <div className="space-y-3">
            {/* Count + pagination info */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
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
            <div className="rounded-xl bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>标题</TableHead>
                    <TableHead className="w-28">媒体名</TableHead>
                    <TableHead className="w-24">层级</TableHead>
                    <TableHead className="w-20">区县</TableHead>
                    <TableHead className="w-28">发布时间</TableHead>
                    <TableHead className="w-20">来源</TableHead>
                    <TableHead className="w-14">原链</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.articles.map((a: ArticleSearchResult) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(a.id)}
                          onCheckedChange={() => toggleSelect(a.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium max-w-md">
                        <div className="truncate" title={a.title}>
                          {a.title}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {a.outletName ?? "-"}
                      </TableCell>
                      <TableCell>
                        {a.outletTier ? (
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
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {a.districtName ?? "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {a.publishedAt
                          ? new Date(a.publishedAt).toLocaleDateString("zh-CN")
                          : "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {CHANNEL_LABELS[a.sourceChannel] ?? a.sourceChannel}
                      </TableCell>
                      <TableCell>
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-primary hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      {selected.size > 0 && (
        <div className="sticky bottom-0 border-t bg-background/95 backdrop-blur px-6 py-3 flex items-center gap-3">
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

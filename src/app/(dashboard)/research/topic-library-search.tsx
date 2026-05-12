"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ExternalLink,
  FileText,
  BookMarked,
  Search as SearchIcon,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/shared/glass-card";
import { SearchInput } from "@/components/shared/search-input";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { cn } from "@/lib/utils";
import { searchByTopic } from "@/app/actions/research/topic-library-search";
import type { TopicSummary } from "@/lib/dal/research/research-topics";
import type { CollectedItemWithAnnotations } from "@/lib/dal/research/collected-item-search";

const TIER_LABELS: Record<string, string> = {
  central: "中央级",
  provincial_municipal: "省/市级",
  industry: "行业级",
  district_media: "区县融媒体",
  self_media: "自媒体/热榜",
};

type Result = {
  items: CollectedItemWithAnnotations[];
  total: number;
  page: number;
  pageSize: number;
} | null;

const PANEL_MIN_HEIGHT = "min-h-[640px]";

export interface TopicReportRequest {
  topicId: string;
  topicName: string;
  total: number;
}

export function TopicLibrarySearch({
  topics,
  onRequestReport,
}: {
  topics: TopicSummary[];
  onRequestReport?: (req: TopicReportRequest) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [topicFilter, setTopicFilter] = useState("");
  const [result, setResult] = useState<Result>(null);

  const filteredTopics = useMemo(() => {
    const q = topicFilter.trim().toLowerCase();
    if (!q) return topics;
    return topics.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.primaryKeyword?.toLowerCase().includes(q) ?? false) ||
        (t.description?.toLowerCase().includes(q) ?? false),
    );
  }, [topics, topicFilter]);

  const activeTopic = useMemo(
    () => topics.find((t) => t.id === activeTopicId) ?? null,
    [topics, activeTopicId],
  );

  function handleSelectTopic(topicId: string) {
    setActiveTopicId(topicId);
    setResult(null);
    startTransition(async () => {
      try {
        const res = await searchByTopic({ topicId, page: 1, pageSize: 50 });
        setResult(res);
      } catch (err) {
        toast.error(`检索失败：${(err as Error).message}`);
      }
    });
  }

  return (
    <div className="flex gap-4 items-stretch">
      {/* 左侧：主题词库面板 */}
      <aside className={cn("w-60 shrink-0", PANEL_MIN_HEIGHT)}>
        <GlassCard variant="panel" padding="none" className="h-full flex flex-col">
          {/* 面板头 */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-200/60 dark:border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
                <BookMarked className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                主题词库
              </div>
              <span className="text-xs text-muted-foreground">{topics.length}</span>
            </div>
            <SearchInput
              placeholder="搜索主题/共词..."
              value={topicFilter}
              onChange={(e) => setTopicFilter(e.target.value)}
              inputClassName="h-8 text-xs"
              className="mt-3"
            />
          </div>

          {/* 列表 */}
          {topics.length === 0 ? (
            <div className="px-4 py-10 text-center text-xs text-muted-foreground">
              还没有主题，先到{" "}
              <Link
                href="/research/admin/topics"
                className="text-sky-600 dark:text-sky-400 hover:underline"
              >
                主题词库管理
              </Link>{" "}
              创建
            </div>
          ) : (
            <nav
              role="listbox"
              aria-label="主题词库"
              className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5"
            >
              {filteredTopics.map((t) => {
                const isActive = t.id === activeTopicId;
                return (
                  <div
                    key={t.id}
                    role="option"
                    aria-selected={isActive}
                    tabIndex={0}
                    onClick={() => handleSelectTopic(t.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelectTopic(t.id);
                      }
                    }}
                    className={cn(
                      "group cursor-pointer rounded-md px-3 py-2 transition-colors",
                      "hover:bg-sky-50/70 dark:hover:bg-sky-900/20",
                      isActive &&
                        "bg-sky-100/80 dark:bg-sky-900/30 hover:bg-sky-100/80 dark:hover:bg-sky-900/30",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "text-sm truncate",
                          isActive
                            ? "font-semibold text-sky-700 dark:text-sky-300"
                            : "font-medium text-gray-800 dark:text-gray-200",
                        )}
                      >
                        {t.name}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {t.isPreset && (
                          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-[10px] px-1.5 py-0 leading-4">
                            预置
                          </Badge>
                        )}
                        <ChevronRight
                          className={cn(
                            "h-3.5 w-3.5 text-gray-300 dark:text-gray-600 transition-transform",
                            isActive && "text-sky-500 dark:text-sky-400 translate-x-0.5",
                          )}
                        />
                      </div>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="truncate">
                        {t.primaryKeyword ?? "无共词"}
                      </span>
                      <span className="text-gray-300 dark:text-gray-600">·</span>
                      <span className="shrink-0">
                        {t.aliasCount}/{t.sampleCount}
                      </span>
                    </div>
                  </div>
                );
              })}
              {filteredTopics.length === 0 && (
                <div className="text-center text-xs text-muted-foreground py-6">
                  无匹配主题
                </div>
              )}
            </nav>
          )}
        </GlassCard>
      </aside>

      {/* 右侧：内容主面板 */}
      <main className={cn("flex-1 min-w-0", PANEL_MIN_HEIGHT)}>
        {!activeTopic ? (
          <GlassCard variant="panel" padding="none" className="h-full flex items-center justify-center">
            <div className="text-center text-gray-500 dark:text-gray-400 py-20 px-6 space-y-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 dark:bg-sky-900/20">
                <BookMarked className="h-6 w-6 text-sky-500 dark:text-sky-400" />
              </div>
              <div className="text-sm">从左侧选择一个主题，查看该主题下已标注的稿件</div>
              <div className="text-xs">
                结果基于「主题自动标注」管线（
                <Link
                  href="/research/admin/topics"
                  className="text-sky-600 dark:text-sky-400 hover:underline"
                >
                  词库管理
                </Link>
                ）
              </div>
            </div>
          </GlassCard>
        ) : (
          <GlassCard variant="panel" padding="none" className="h-full flex flex-col">
            {/* 主题概览 header */}
            <div className="px-5 pt-4 pb-4 border-b border-gray-200/60 dark:border-white/5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {activeTopic.name}
                    </h2>
                    {activeTopic.isPreset && (
                      <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30">
                        预置
                      </Badge>
                    )}
                  </div>
                  {activeTopic.description && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {activeTopic.description}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    {activeTopic.primaryKeyword && (
                      <span>
                        共词
                        <strong className="ml-1 text-foreground">
                          {activeTopic.primaryKeyword}
                        </strong>
                      </span>
                    )}
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <span>别名 {activeTopic.aliasCount} 条</span>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <span>样本 {activeTopic.sampleCount} 条</span>
                  </div>
                </div>
                <Link
                  href="/research/admin/topics"
                  className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 shrink-0 transition-colors"
                >
                  <FileText className="h-3.5 w-3.5" />
                  编辑词库
                </Link>
              </div>
            </div>

            {/* 结果区 */}
            <div className="flex-1 px-5 py-4">
              {pending ? (
                <div className="h-full flex items-center justify-center text-center text-sm text-muted-foreground">
                  <div className="space-y-2">
                    <SearchIcon className="h-5 w-5 mx-auto animate-pulse" />
                    <div>正在检索...</div>
                  </div>
                </div>
              ) : !result ? null : result.items.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-gray-500 dark:text-gray-400 space-y-2">
                    <div className="text-sm">该主题下暂无标注稿件</div>
                    <div className="text-xs">
                      检查主题样本是否已完成 embedding，或到{" "}
                      <Link
                        href="/data-collection"
                        className="text-sky-600 dark:text-sky-400 hover:underline"
                      >
                        数据采集
                      </Link>{" "}
                      补充数据
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap text-xs text-muted-foreground">
                    <span>
                      命中{" "}
                      <strong className="text-foreground text-sm">
                        {result.total}
                      </strong>{" "}
                      条
                      {result.total > result.pageSize && (
                        <span className="ml-1 text-amber-600 dark:text-amber-400">
                          （仅展示前 {result.pageSize} 条）
                        </span>
                      )}
                      {result.total > 500 && (
                        <span className="ml-2 text-amber-600 dark:text-amber-400">
                          超 500 条，无法生成报告，请挑更聚焦的主题
                        </span>
                      )}
                    </span>
                    {onRequestReport && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={result.total === 0 || result.total > 500 || pending}
                        onClick={() =>
                          onRequestReport({
                            topicId: activeTopic.id,
                            topicName: activeTopic.name,
                            total: result.total,
                          })
                        }
                      >
                        <FileText className="h-3.5 w-3.5 mr-1" />
                        生成报告
                      </Button>
                    )}
                  </div>
                  <DataTable
                    rows={result.items}
                    rowKey={(r) => r.id}
                    columns={[
                      {
                        key: "title",
                        header: "标题",
                        render: (r) => (
                          <span
                            className="truncate block text-gray-800 dark:text-gray-200"
                            title={r.title}
                          >
                            {r.title}
                          </span>
                        ),
                      },
                      {
                        key: "outlet",
                        header: "媒体",
                        width: "w-36",
                        render: (r) => (
                          <div className="min-w-0">
                            <div className="text-xs text-foreground truncate">
                              {r.outletName ?? "未分类"}
                            </div>
                            {r.outletTier && (
                              <div className="text-[10px] text-muted-foreground truncate">
                                {TIER_LABELS[r.outletTier] ?? r.outletTier}
                              </div>
                            )}
                          </div>
                        ),
                      },
                      {
                        key: "publishedAt",
                        header: "时间",
                        width: "w-24",
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
          </GlassCard>
        )}
      </main>
    </div>
  );
}

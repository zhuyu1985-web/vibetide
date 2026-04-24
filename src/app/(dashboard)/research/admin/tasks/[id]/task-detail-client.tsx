"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ExternalLink, RefreshCw, XCircle } from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { cancelResearchTask } from "@/app/actions/research/research-tasks";
import { ResearchBreadcrumb } from "../../../research-breadcrumb";

const STATUS_LABELS: Record<string, string> = {
  pending: "排队中",
  crawling: "采集中",
  analyzing: "分析中",
  done: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

const STATUS_CLASS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/40",
  crawling: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30",
  analyzing: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30",
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30",
  cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-800/40 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800/40",
};

const TIER_LABELS: Record<string, string> = {
  central: "中央级",
  provincial_municipal: "省/市级",
  industry: "行业级",
  district_media: "区县融媒体",
  self_media: "自媒体/热榜",
};

const TIER_BADGE_CLASS: Record<string, string> = {
  central: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30",
  provincial_municipal: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30",
  industry: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30",
  district_media: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/30",
  self_media: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/30",
};

const CHANNEL_LABELS: Record<string, string> = {
  tavily: "全网搜索",
  whitelist_crawl: "白名单采集",
  manual_url: "手工 URL",
};

type Article = {
  id: string;
  title: string;
  url: string;
  publishedAt: Date | null;
  outletTierSnapshot: string | null;
  sourceChannel: string;
};

export function TaskDetailClient({
  task,
  articles,
}: {
  task: {
    id: string;
    name: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    timeRangeStart: Date;
    timeRangeEnd: Date;
    topicIds: string[];
    districtIds: string[];
    mediaTiers: string[];
    customUrls: string[];
    progress: unknown;
    errorMessage?: string | null;
  };
  articles: Article[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");

  const canCancel = task.status === "pending" || task.status === "crawling" || task.status === "analyzing";

  const filtered = articles.filter((a) => {
    if (tierFilter !== "all" && a.outletTierSnapshot !== tierFilter) return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const tierCounts: Record<string, number> = {};
  for (const a of articles) {
    const key = a.outletTierSnapshot ?? "unclassified";
    tierCounts[key] = (tierCounts[key] ?? 0) + 1;
  }

  const channelCounts: Record<string, number> = {};
  for (const a of articles) {
    channelCounts[a.sourceChannel] = (channelCounts[a.sourceChannel] ?? 0) + 1;
  }

  const [cancelOpen, setCancelOpen] = useState(false);
  function doCancel() {
    setCancelOpen(true);
  }
  function doCancelConfirmed() {
    setCancelOpen(false);
    startTransition(async () => {
      const res = await cancelResearchTask(task.id);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="max-w-[1400px] mx-auto w-full space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/research/admin/tasks"><ArrowLeft className="h-3.5 w-3.5 mr-1" />返回任务列表</Link>
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{task.name}</h1>
              <Badge className={STATUS_CLASS[task.status] ?? ""}>{STATUS_LABELS[task.status] ?? task.status}</Badge>
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              创建于 {task.createdAt.toLocaleString("zh-CN")} · 更新于 {task.updatedAt.toLocaleString("zh-CN")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => router.refresh()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />刷新
            </Button>
            {canCancel && (
              <Button variant="ghost" size="sm" onClick={doCancel} disabled={pending}
                className="text-destructive hover:text-destructive">
                <XCircle className="h-3.5 w-3.5 mr-1" />取消任务
              </Button>
            )}
          </div>
        </div>
        <div className="mt-3">
          <ResearchBreadcrumb />
        </div>
      </div>

      {task.errorMessage && (
        <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2">
          任务错误：{task.errorMessage}
        </div>
      )}

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <GlassCard variant="default" padding="md">
          <div className="text-xs text-gray-500 dark:text-gray-400">已采集文章</div>
          <div className="text-2xl font-semibold mt-1">{articles.length}</div>
        </GlassCard>
        <GlassCard variant="default" padding="md">
          <div className="text-xs text-gray-500 dark:text-gray-400">时间范围</div>
          <div className="text-sm mt-2 font-medium">
            {task.timeRangeStart.toLocaleDateString("zh-CN")} ~
          </div>
          <div className="text-sm font-medium">
            {task.timeRangeEnd.toLocaleDateString("zh-CN")}
          </div>
        </GlassCard>
        <GlassCard variant="default" padding="md">
          <div className="text-xs text-gray-500 dark:text-gray-400">研究范围</div>
          <div className="text-sm mt-1">{task.topicIds.length} 主题 · {task.districtIds.length} 区县</div>
          <div className="text-sm">{task.mediaTiers.length} 级媒体{task.customUrls.length > 0 ? ` · ${task.customUrls.length} 手工 URL` : ""}</div>
        </GlassCard>
        <GlassCard variant="default" padding="md">
          <div className="text-xs text-gray-500 dark:text-gray-400">分析结果</div>
          <div className="text-sm mt-2 text-gray-500 dark:text-gray-400">
            关键词命中、聚合统计将在 S3 阶段接入
          </div>
        </GlassCard>
      </div>

      {articles.length > 0 && (
        <GlassCard variant="default" padding="md">
          <div className="text-sm font-medium mb-3">已采集文章分布</div>
          <div className="flex flex-wrap gap-2 text-xs">
            {Object.entries(tierCounts).map(([tier, count]) => (
              <Badge key={tier} className={TIER_BADGE_CLASS[tier] ?? "bg-gray-100 text-gray-700"}>
                {TIER_LABELS[tier] ?? "未分类"} · {count}
              </Badge>
            ))}
            <span className="mx-2 text-muted-foreground">|</span>
            {Object.entries(channelCounts).map(([ch, count]) => (
              <Badge key={ch} className="bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/40">
                {CHANNEL_LABELS[ch] ?? ch} · {count}
              </Badge>
            ))}
          </div>
        </GlassCard>
      )}

      <div>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-sm font-medium">采集文章列表</h2>
          <Input placeholder="按标题搜索..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="层级" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部层级</SelectItem>
              {Object.entries(TIER_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
              <SelectItem value="unclassified">未分类</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-xs text-gray-500 dark:text-gray-400 ml-auto">显示 {filtered.length} / {articles.length} 条</div>
        </div>

        {articles.length === 0 ? (
          <GlassCard variant="default" padding="lg">
            <div className="text-center text-gray-500 dark:text-gray-400 py-10">
              {task.status === "pending" || task.status === "crawling"
                ? "任务采集中，请稍后刷新..."
                : "还没有采集到文章"}
            </div>
          </GlassCard>
        ) : (
          <DataTable
            rows={filtered}
            rowKey={(a) => a.id}
            columns={[
              {
                key: "title",
                header: "标题",
                render: (a) => (
                  <span className="truncate block" title={a.title}>{a.title}</span>
                ),
              },
              {
                key: "tier",
                header: "媒体层级",
                width: "w-32",
                render: (a) =>
                  a.outletTierSnapshot ? (
                    <Badge className={TIER_BADGE_CLASS[a.outletTierSnapshot] ?? ""}>
                      {TIER_LABELS[a.outletTierSnapshot]}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">未分类</span>
                  ),
              },
              {
                key: "channel",
                header: "采集来源",
                width: "w-32",
                render: (a) => (
                  <span className="text-muted-foreground truncate block">
                    {CHANNEL_LABELS[a.sourceChannel] ?? a.sourceChannel}
                  </span>
                ),
              },
              {
                key: "publishedAt",
                header: "发布时间",
                width: "w-40",
                render: (a) => (
                  <span className="text-xs text-muted-foreground">
                    {a.publishedAt ? a.publishedAt.toLocaleDateString("zh-CN") : "-"}
                  </span>
                ),
              },
              {
                key: "url",
                header: "原链",
                width: "w-16",
                align: "right",
                render: (a) => (
                  <a href={a.url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center justify-end text-sky-600 hover:text-sky-700">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ),
              },
            ] satisfies DataTableColumn<Article>[]}
          />
        )}
      </div>
    </div>
  );
}

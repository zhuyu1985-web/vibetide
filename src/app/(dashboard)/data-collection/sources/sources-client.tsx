"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Play,
  Pause,
  Trash2,
  RefreshCw,
  Loader2,
  Search,
  Radar,
} from "lucide-react";
import type { AdapterMeta } from "@/lib/collection/adapter-meta";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GlassCard } from "@/components/shared/glass-card";
import { toast } from "sonner";
import {
  toggleCollectionSourceEnabled,
  deleteCollectionSource,
  triggerCollectionSource,
  getLatestRunForSource,
  type LatestRunStatus,
} from "@/app/actions/collection";
import { EmptyState } from "@/components/shared/empty-state";
import { formatRelativeTime, formatAbsoluteTime, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface SourceListItem {
  id: string;
  name: string;
  sourceType: string;
  enabled: boolean;
  scheduleCron: string | null;
  targetModules: string[];
  lastRunAt: string | null;
  lastRunStatus: string | null;
  totalItemsCollected: number;
}

interface SourcesClientProps {
  initialSources: SourceListItem[];
  adapterMetas: AdapterMeta[];
}

const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 45;

// Source-type color palette — consistent with missions scenario colors
const SOURCE_TYPE_COLOR: Record<string, string> = {
  tophub: "bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400",
  tavily: "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400",
  jina_url: "bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400",
  list_scraper: "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400",
  rss: "bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
};

export function SourcesClient({ initialSources, adapterMetas }: SourcesClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("__all__");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const baselineRunIds = useRef<Map<string, string | null>>(new Map());

  const filtered = initialSources.filter((s) => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== "__all__" && s.sourceType !== typeFilter) return false;
    if (statusFilter === "enabled" && !s.enabled) return false;
    if (statusFilter === "disabled" && s.enabled) return false;
    return true;
  });

  const pollLatest = useCallback(async (sourceId: string) => {
    const baseline = baselineRunIds.current.get(sourceId) ?? null;
    let attempts = 0;
    const tick = async () => {
      attempts++;
      let latest: LatestRunStatus;
      try {
        latest = await getLatestRunForSource(sourceId);
      } catch {
        if (attempts < POLL_MAX_ATTEMPTS) setTimeout(tick, POLL_INTERVAL_MS);
        else finishPolling(sourceId, null);
        return;
      }
      if (
        latest.runId &&
        latest.runId !== baseline &&
        (latest.status === "success" ||
          latest.status === "partial" ||
          latest.status === "failed")
      ) {
        finishPolling(sourceId, latest);
        return;
      }
      if (attempts >= POLL_MAX_ATTEMPTS) {
        finishPolling(sourceId, null);
        return;
      }
      setTimeout(tick, POLL_INTERVAL_MS);
    };
    tick();
  }, []);

  const finishPolling = (sourceId: string, finalRun: LatestRunStatus | null) => {
    setRunningIds((prev) => {
      const next = new Set(prev);
      next.delete(sourceId);
      return next;
    });
    baselineRunIds.current.delete(sourceId);
    if (!finalRun) {
      toast.warning("采集超时,请稍后在详情页查看运行记录");
      return;
    }
    if (finalRun.status === "success") {
      toast.success(`采集完成:新增 ${finalRun.itemsInserted} · 合并 ${finalRun.itemsMerged}`);
    } else if (finalRun.status === "partial") {
      toast.warning(
        `部分失败:新增 ${finalRun.itemsInserted} · 合并 ${finalRun.itemsMerged} · 失败 ${finalRun.itemsFailed}`,
      );
    } else if (finalRun.status === "failed") {
      toast.error(`采集失败: ${finalRun.errorSummary ?? "未知错误"}`);
    }
    router.refresh();
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    setBusyId(id);
    try {
      await toggleCollectionSourceEnabled(id, !enabled);
      toast.success(!enabled ? "已启用" : "已暂停");
      router.refresh();
    } catch (err) {
      toast.error(`操作失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleTrigger = async (id: string) => {
    if (runningIds.has(id)) return;
    setBusyId(id);
    try {
      const before = await getLatestRunForSource(id);
      baselineRunIds.current.set(id, before.runId);
      await triggerCollectionSource(id);
      setRunningIds((prev) => new Set(prev).add(id));
      pollLatest(id);
      toast("已触发采集,等待完成...", { duration: 3000 });
    } catch (err) {
      toast.error(`触发失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确认删除源「${name}」?此操作不可撤销(已采集的数据保留)。`)) return;
    setBusyId(id);
    try {
      await deleteCollectionSource(id);
      toast.success("已删除");
      router.refresh();
    } catch (err) {
      toast.error(`删除失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusyId(null);
    }
  };

  useEffect(() => {
    return () => {
      baselineRunIds.current.clear();
    };
  }, []);

  const typeLabel = (type: string) =>
    adapterMetas.find((m) => m.type === type)?.displayName ?? type;

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="按名称搜索"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-72 rounded-md bg-white/60 dark:bg-gray-800/60 pl-8 pr-3 text-sm outline-none border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-500/30 transition"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 w-40 bg-white/60 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700">
              <SelectValue placeholder="源类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部类型</SelectItem>
              {adapterMetas.map((m) => (
                <SelectItem key={m.type} value={m.type}>
                  {m.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-32 bg-white/60 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部</SelectItem>
              <SelectItem value="enabled">启用</SelectItem>
              <SelectItem value="disabled">暂停</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            共 {filtered.length} 个源
          </span>
        </div>
        <Button asChild className="shadow-sm">
          <Link href="/data-collection/sources/new">
            <Plus className="mr-1.5 h-4 w-4" />
            新建源
          </Link>
        </Button>
      </div>

      {/* Table panel */}
      <GlassCard variant="panel" padding="none">
        {/* Header row (missions style) */}
        <div className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-200/60 dark:border-gray-700/40">
          <div className="flex-1 min-w-0 text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">名称</div>
          <div className="w-24 text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">类型</div>
          <div className="w-20 text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">调度</div>
          <div className="w-36 text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">归属模块</div>
          <div className="w-24 text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">最近运行</div>
          <div className="w-16 text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider text-right">已采集</div>
          <div className="w-20 text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">状态</div>
          <div className="w-24 text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider text-right">操作</div>
        </div>

        {/* Body */}
        {filtered.length === 0 ? (
          <div className="px-5">
            {initialSources.length === 0 ? (
              <EmptyState
                icon={Radar}
                title="还没有采集源"
                description="点击右上角「新建源」开始配置第一个采集源。支持 RSS / 站点列表 / 热榜聚合 / 关键词搜索等多种方式。"
                action={
                  <Button asChild size="sm">
                    <Link href="/data-collection/sources/new">
                      <Plus className="mr-1.5 h-4 w-4" />新建源
                    </Link>
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title="没有匹配的记录"
                description="尝试调整搜索或筛选条件。"
              />
            )}
          </div>
        ) : (
          filtered.map((s) => {
            const isRunning = runningIds.has(s.id);
            const typeChip = SOURCE_TYPE_COLOR[s.sourceType] ?? "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300";
            return (
              <div
                key={s.id}
                className={cn(
                  "group flex items-center gap-3 px-5 py-4 border-b border-gray-100/60 dark:border-gray-800/40 last:border-b-0 transition-colors duration-200",
                  isRunning ? "bg-blue-50/60 dark:bg-blue-950/20" : "hover:bg-gray-50/50 dark:hover:bg-gray-800/20",
                )}
              >
                {/* Name */}
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/data-collection/sources/${s.id}`}
                    className="text-sm text-gray-900 dark:text-gray-100 hover:text-primary transition-colors truncate block"
                  >
                    {s.name}
                  </Link>
                </div>
                {/* Type chip */}
                <div className="w-24 shrink-0">
                  <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[11px]", typeChip)}>
                    {typeLabel(s.sourceType)}
                  </span>
                </div>
                {/* Schedule */}
                <div className="w-20 shrink-0 text-xs font-mono text-gray-500 dark:text-gray-400">
                  {s.scheduleCron ?? (
                    <span className="text-gray-400 dark:text-gray-500 font-sans">手工</span>
                  )}
                </div>
                {/* Target modules */}
                <div className="w-36 shrink-0 overflow-hidden">
                  <div className="flex flex-wrap gap-1">
                    {s.targetModules.length === 0 ? (
                      <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
                    ) : (
                      s.targetModules.slice(0, 2).map((m) => (
                        <span
                          key={m}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                        >
                          {m}
                        </span>
                      ))
                    )}
                    {s.targetModules.length > 2 && (
                      <span className="text-[10px] text-gray-400">+{s.targetModules.length - 2}</span>
                    )}
                  </div>
                </div>
                {/* Last run */}
                <div
                  className="w-24 shrink-0 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap"
                  title={s.lastRunAt ? formatAbsoluteTime(s.lastRunAt) : ""}
                >
                  {s.lastRunAt ? formatRelativeTime(s.lastRunAt) : (
                    <span className="text-gray-400 dark:text-gray-500">未运行</span>
                  )}
                </div>
                {/* Items */}
                <div className="w-16 shrink-0 text-right">
                  <span
                    className={cn(
                      "text-sm tabular-nums",
                      s.totalItemsCollected > 0
                        ? "text-gray-700 dark:text-gray-200"
                        : "text-gray-300 dark:text-gray-600",
                    )}
                  >
                    {formatNumber(s.totalItemsCollected)}
                  </span>
                </div>
                {/* Status */}
                <div className="w-20 shrink-0">
                  <StatusIndicator
                    enabled={s.enabled}
                    lastRunStatus={s.lastRunStatus}
                    isRunning={isRunning}
                  />
                </div>
                {/* Actions */}
                <div className="w-24 shrink-0 flex justify-end gap-0.5 opacity-40 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    disabled={busyId === s.id || !s.enabled || isRunning}
                    onClick={() => handleTrigger(s.id)}
                    title="立即触发"
                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {isRunning ? (
                      <Loader2 className="h-4 w-4 text-blue-600 dark:text-blue-400 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === s.id || isRunning}
                    onClick={() => handleToggle(s.id, s.enabled)}
                    title={s.enabled ? "暂停" : "启用"}
                    className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {s.enabled ? (
                      <Pause className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    ) : (
                      <Play className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === s.id || isRunning}
                    onClick={() => handleDelete(s.id, s.name)}
                    title="删除"
                    className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors group/del"
                  >
                    <Trash2 className="h-4 w-4 text-gray-600 dark:text-gray-400 group-hover/del:text-red-600 dark:group-hover/del:text-red-400" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </GlassCard>
    </div>
  );
}

// ────────────────────────────────────────────────
// Status with leading dot — missions style
// ────────────────────────────────────────────────
function StatusIndicator({
  enabled,
  lastRunStatus,
  isRunning,
}: {
  enabled: boolean;
  lastRunStatus: string | null;
  isRunning: boolean;
}) {
  if (isRunning) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-blue-700 dark:text-blue-300">
        <Loader2 className="h-3 w-3 animate-spin" />
        采集中
      </span>
    );
  }
  if (!enabled) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500">
        <span className="h-1.5 w-1.5 rounded-full bg-gray-300 dark:bg-gray-600" />
        暂停
      </span>
    );
  }
  const config: Record<string, { color: string; label: string }> = {
    success: { color: "bg-emerald-500", label: "正常" },
    partial: { color: "bg-amber-500", label: "部分失败" },
    failed: { color: "bg-red-500", label: "失败" },
  };
  const c = (lastRunStatus ? config[lastRunStatus] : null) ?? { color: "bg-gray-300", label: "待运行" };
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
      <span className={cn("h-1.5 w-1.5 rounded-full", c.color)} />
      {c.label}
    </span>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Play, Pause, Trash2, RefreshCw, Loader2, Radar } from "lucide-react";
import type { AdapterMeta } from "@/lib/collection/adapter-meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
const POLL_MAX_ATTEMPTS = 45; // 45 * 2s = 90s ceiling

export function SourcesClient({ initialSources, adapterMetas }: SourcesClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("__all__");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  const [busyId, setBusyId] = useState<string | null>(null);
  /** Source IDs currently running (live-polled) */
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  /** Baseline run ID at trigger time — used to detect a new run completed */
  const baselineRunIds = useRef<Map<string, string | null>>(new Map());

  const filtered = initialSources.filter((s) => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== "__all__" && s.sourceType !== typeFilter) return false;
    if (statusFilter === "enabled" && !s.enabled) return false;
    if (statusFilter === "disabled" && s.enabled) return false;
    return true;
  });

  const pollLatest = useCallback(
    async (sourceId: string) => {
      const baseline = baselineRunIds.current.get(sourceId) ?? null;
      let attempts = 0;
      const tick = async () => {
        attempts++;
        let latest: LatestRunStatus;
        try {
          latest = await getLatestRunForSource(sourceId);
        } catch {
          // keep polling — transient errors
          if (attempts < POLL_MAX_ATTEMPTS) setTimeout(tick, POLL_INTERVAL_MS);
          else finishPolling(sourceId, null);
          return;
        }

        // A NEW run appeared AND finished — we're done
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
    },
    [],
  );

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
      const msg = `采集完成:新增 ${finalRun.itemsInserted} · 合并 ${finalRun.itemsMerged}`;
      toast.success(msg);
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
      // Snapshot baseline run (the run BEFORE trigger) so poller knows to wait for a new one
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

  // Clean up on unmount (avoid setState after unmount)
  useEffect(() => {
    return () => {
      baselineRunIds.current.clear();
    };
  }, []);

  const typeLabel = (type: string) =>
    adapterMetas.find((m) => m.type === type)?.displayName ?? type;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Input
            className="w-64"
            placeholder="按名称搜索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-44">
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
            <SelectTrigger className="w-32">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部</SelectItem>
              <SelectItem value="enabled">启用</SelectItem>
              <SelectItem value="disabled">暂停</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button asChild>
          <Link href="/data-collection/sources/new">
            <Plus className="mr-2 h-4 w-4" />
            新建源
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>调度</TableHead>
              <TableHead>归属模块</TableHead>
              <TableHead>最近运行</TableHead>
              <TableHead className="text-right">已采集</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="p-0">
                  {initialSources.length === 0 ? (
                    <EmptyState
                      icon={Radar}
                      title="还没有采集源"
                      description="点击右上角「新建源」开始配置第一个采集源（RSS/站点/热榜/关键词搜索都支持）。"
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
                </TableCell>
              </TableRow>
            )}
            {filtered.map((s) => {
              const isRunning = runningIds.has(s.id);
              return (
                <TableRow key={s.id} className={isRunning ? "bg-primary/5" : undefined}>
                  <TableCell>
                    <Link
                      href={`/data-collection/sources/${s.id}`}
                      className="text-primary hover:underline"
                    >
                      {s.name}
                    </Link>
                  </TableCell>
                  <TableCell>{typeLabel(s.sourceType)}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {s.scheduleCron ?? "手工"}
                  </TableCell>
                  <TableCell>{s.targetModules.join(", ") || "—"}</TableCell>
                  <TableCell
                    className="text-muted-foreground text-sm whitespace-nowrap"
                    title={s.lastRunAt ? formatAbsoluteTime(s.lastRunAt) : ""}
                  >
                    {s.lastRunAt ? formatRelativeTime(s.lastRunAt) : "未运行"}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={s.totalItemsCollected > 0 ? "font-medium tabular-nums" : "text-muted-foreground tabular-nums"}>
                      {formatNumber(s.totalItemsCollected)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {isRunning ? (
                      <Badge className="gap-1 bg-blue-50 text-blue-700 hover:bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        采集中
                      </Badge>
                    ) : !s.enabled ? (
                      <Badge variant="outline" className="text-muted-foreground">
                        暂停
                      </Badge>
                    ) : s.lastRunStatus === "failed" ? (
                      <Badge className="bg-red-50 text-red-700 hover:bg-red-50 dark:bg-red-950/40 dark:text-red-300">
                        失败
                      </Badge>
                    ) : s.lastRunStatus === "partial" ? (
                      <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300">
                        部分失败
                      </Badge>
                    ) : s.lastRunStatus === "success" ? (
                      <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300">
                        正常
                      </Badge>
                    ) : (
                      <Badge variant="outline">待运行</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={busyId === s.id || !s.enabled || isRunning}
                        onClick={() => handleTrigger(s.id)}
                        title="立即触发"
                      >
                        {isRunning ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={busyId === s.id || isRunning}
                        onClick={() => handleToggle(s.id, s.enabled)}
                        title={s.enabled ? "暂停" : "启用"}
                      >
                        {s.enabled ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={busyId === s.id || isRunning}
                        onClick={() => handleDelete(s.id, s.name)}
                        title="删除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

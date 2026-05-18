"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BulkImportDialog } from "./bulk-import-dialog";
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
import { DataTable } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import { toast } from "sonner";
import {
  toggleCollectionSourceEnabled,
  deleteCollectionSource,
  triggerCollectionSource,
  getLatestRunForSource,
  type LatestRunStatus,
} from "@/app/actions/collection";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatRelativeTime, formatAbsoluteTime, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SOURCE_TYPE_COLOR } from "@/lib/collection/constants";

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
  // A1 (2026-05-14): 给"按媒体筛"用
  outletId: string | null;
}

/** A1 (2026-05-14): 给"按媒体筛"的下拉选项,只透传必要字段(精简 payload) */
export interface SourceClientOutlet {
  id: string;
  outletName: string;
}

interface SourcesClientProps {
  initialSources: SourceListItem[];
  adapterMetas: AdapterMeta[];
  outlets: SourceClientOutlet[];
}

/** A1: 与新建 wizard 的 TARGET_MODULES 保持一致 */
const TARGET_MODULE_OPTIONS = [
  { value: "hot_topics", label: "热点 (hot_topics)" },
  { value: "news", label: "研究 (news)" },
  { value: "benchmarking", label: "对标 (benchmarking)" },
  { value: "knowledge", label: "知识库 (knowledge)" },
];

// Polling 2s × 150 = 5 分钟。覆盖整站采集等长任务(实测 cbg.cn 2 栏目 ≈ 3-6 分钟)。
// 真正"长跑超时"的 toast 是 info 提示,不是失败,run 在后台继续。
const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 150;

export function SourcesClient({ initialSources, adapterMetas, outlets }: SourcesClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("__all__");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");
  // A1 (2026-05-14)
  const [moduleFilter, setModuleFilter] = useState<string>("__all__");
  const [outletFilter, setOutletFilter] = useState<string>("__all__");
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set());
  const baselineRunIds = useRef<Map<string, string | null>>(new Map());

  const filtered = initialSources.filter((s) => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== "__all__" && s.sourceType !== typeFilter) return false;
    if (statusFilter === "enabled" && !s.enabled) return false;
    if (statusFilter === "disabled" && s.enabled) return false;
    // A1
    if (moduleFilter !== "__all__" && !s.targetModules.includes(moduleFilter)) return false;
    if (outletFilter === "__unbound__" && s.outletId !== null) return false;
    if (outletFilter !== "__all__" && outletFilter !== "__unbound__" && s.outletId !== outletFilter) return false;
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
      // 不是失败 — 仅仅是前端 polling 等不到完成。整站采集等长任务会超过 90s polling 上限,
      // run 在后台继续跑。给用户清晰提示,引导他去详情页看实时进度。
      toast.info("任务仍在后台运行,可关闭此提示继续操作,稍后到详情页「最近运行」查看结果");
      router.refresh();
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

  const handleDelete = (id: string, name: string) => {
    setDeleteTarget({ id, name });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setBusyId(id);
    setDeleteTarget(null);
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
          <SearchInput
            className="w-72"
            placeholder="按名称搜索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40">
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
          {/* A1: 归属模块 */}
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="归属模块" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部模块</SelectItem>
              {TARGET_MODULE_OPTIONS.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* A1: 绑定媒体 */}
          <Select value={outletFilter} onValueChange={setOutletFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="绑定媒体" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">全部媒体</SelectItem>
              <SelectItem value="__unbound__">未绑定</SelectItem>
              {outlets.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.outletName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            共 {filtered.length} 个源
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setBulkImportOpen(true)}>
            批量导入
          </Button>
          <Button asChild className="shadow-sm">
            <Link href="/data-collection/sources/new">
              <Plus className="mr-1.5 h-4 w-4" />
              新建源
            </Link>
          </Button>
        </div>
      </div>

      {/* Sources table — 与 /topic-compare 同款 DataTable 玻璃边框 */}
      <DataTable
        rows={filtered}
        rowKey={(s) => s.id}
        emptyMessage={
          initialSources.length === 0 ? (
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
          )
        }
        columns={[
          {
            key: "name",
            header: "名称",
            render: (s) => (
              <Link
                href={`/data-collection/sources/${s.id}`}
                className="text-sm text-gray-900 dark:text-gray-100 hover:text-primary transition-colors truncate block"
              >
                {s.name}
              </Link>
            ),
          },
          {
            key: "type",
            header: "类型",
            width: "w-24",
            render: (s) => {
              const typeChip = SOURCE_TYPE_COLOR[s.sourceType] ?? "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300";
              return (
                <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[11px]", typeChip)}>
                  {typeLabel(s.sourceType)}
                </span>
              );
            },
          },
          {
            key: "schedule",
            header: "调度",
            width: "w-20",
            render: (s) => (
              <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                {s.scheduleCron ?? (
                  <span className="text-gray-400 dark:text-gray-500 font-sans">手工</span>
                )}
              </span>
            ),
          },
          {
            key: "modules",
            header: "归属模块",
            width: "w-36",
            render: (s) => (
              <div className="flex flex-wrap gap-1 overflow-hidden">
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
            ),
          },
          {
            key: "lastRun",
            header: "最近运行",
            width: "w-24",
            render: (s) => (
              <span
                className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap"
                title={s.lastRunAt ? formatAbsoluteTime(s.lastRunAt) : ""}
              >
                {s.lastRunAt ? formatRelativeTime(s.lastRunAt) : (
                  <span className="text-gray-400 dark:text-gray-500">未运行</span>
                )}
              </span>
            ),
          },
          {
            key: "items",
            header: "已采集",
            width: "w-16",
            align: "right",
            render: (s) => (
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
            ),
          },
          {
            key: "status",
            header: "状态",
            width: "w-20",
            render: (s) => (
              <StatusIndicator
                enabled={s.enabled}
                lastRunStatus={s.lastRunStatus}
                isRunning={runningIds.has(s.id)}
              />
            ),
          },
          {
            key: "actions",
            header: "操作",
            width: "w-24",
            align: "right",
            render: (s) => {
              const isRunning = runningIds.has(s.id);
              return (
                <div className="flex justify-end gap-0.5">
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
              );
            },
          },
        ]}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="删除采集源"
        description={`确认删除源「${deleteTarget?.name ?? ""}」？此操作不可撤销（已采集的数据保留）。`}
        confirmText="删除"
        variant="danger"
        loading={busyId === deleteTarget?.id}
        onConfirm={confirmDelete}
      />

      <BulkImportDialog
        open={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        onComplete={() => {
          setBulkImportOpen(false);
          router.refresh();
        }}
      />
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

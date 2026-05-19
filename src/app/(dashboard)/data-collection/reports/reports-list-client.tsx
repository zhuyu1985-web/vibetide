"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Trash2, RefreshCw, Camera } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/shared/glass-card";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { deleteReportInline } from "@/app/actions/research/reports";

export type ReportListRow = {
  id: string;
  title: string;
  status: "pending" | "generating" | "ready" | "failed";
  isSnapshot: boolean;
  snapshotName: string | null;
  parentReportId: string | null;
  hitCount: number;
  createdAt: string; // ISO
  completedAt: string | null;
};

const STATUS_LABEL: Record<ReportListRow["status"], string> = {
  pending: "排队中",
  generating: "生成中",
  ready: "已完成",
  failed: "失败",
};

const STATUS_CLASS: Record<ReportListRow["status"], string> = {
  pending:
    "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50",
  generating:
    "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/30 animate-pulse",
  ready:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30",
  failed:
    "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/30",
};

export function ReportsListClient({ rows }: { rows: ReportListRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | ReportListRow["status"]
  >("all");
  const [deleteTarget, setDeleteTarget] = useState<ReportListRow | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (q && !r.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, statusFilter]);

  function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    startTransition(async () => {
      try {
        await deleteReportInline(id);
        toast.success("报告已删除");
        router.refresh();
      } catch (err) {
        toast.error(`删除失败：${(err as Error).message}`);
      }
    });
  }

  const counts = useMemo(() => {
    const c: Record<ReportListRow["status"] | "all", number> = {
      all: rows.length,
      pending: 0,
      generating: 0,
      ready: 0,
      failed: 0,
    };
    for (const r of rows) c[r.status]++;
    return c;
  }, [rows]);

  return (
    <div className="max-w-[1400px] mx-auto w-full space-y-6">
      <PageHeader
        title="研究报告"
        description="查看历史生成的研究报告，支持状态筛选、检索、快照与删除"
        actions={
          <Link
            href="/data-collection/content"
            className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            返回内容池
          </Link>
        }
      />

      <GlassCard variant="panel" padding="none">
        {/* 工具栏 */}
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-gray-200/60 dark:border-white/5">
          <SearchInput
            placeholder="搜索报告标题..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-64"
            inputClassName="h-8 text-xs"
          />
          <div className="flex items-center gap-1 text-xs">
            {(["all", "ready", "generating", "pending", "failed"] as const).map(
              (s) => (
                <Button
                  key={s}
                  variant={statusFilter === s ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setStatusFilter(s)}
                >
                  {s === "all" ? "全部" : STATUS_LABEL[s]}
                  <span className="ml-1 text-[10px] opacity-70">
                    {counts[s]}
                  </span>
                </Button>
              ),
            )}
          </div>
          <div className="flex-1" />
          <span className="text-xs text-muted-foreground">
            共 <strong className="text-foreground">{filtered.length}</strong>{" "}
            条
          </span>
        </div>

        {/* 表 */}
        <div className="px-5 py-4">
          {filtered.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400 py-16 space-y-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 dark:bg-sky-900/20">
                <FileText className="h-6 w-6 text-sky-500 dark:text-sky-400" />
              </div>
              <div className="text-sm">
                {rows.length === 0 ? "还没有生成过报告" : "无匹配报告"}
              </div>
              {rows.length === 0 && (
                <div className="text-xs">
                  到{" "}
                  <Link
                    href="/data-collection/content"
                    className="text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    内容池
                  </Link>{" "}
                  做检索后点「生成报告」即可创建
                </div>
              )}
            </div>
          ) : (
            <DataTable
              rows={filtered}
              rowKey={(r) => r.id}
              onRowClick={(r) => router.push(`/data-collection/reports/${r.id}`)}
              columns={[
                {
                  key: "title",
                  header: "标题",
                  render: (r) => (
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate"
                          title={r.title}
                        >
                          {r.title}
                        </span>
                        {r.isSnapshot && (
                          <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/30 shrink-0 text-[10px] px-1.5 py-0">
                            <Camera className="h-2.5 w-2.5 mr-0.5" />
                            快照
                          </Badge>
                        )}
                      </div>
                      {r.snapshotName && (
                        <div className="mt-0.5 text-[11px] text-muted-foreground truncate">
                          {r.snapshotName}
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  key: "status",
                  header: "状态",
                  width: "w-24",
                  render: (r) => (
                    <Badge className={STATUS_CLASS[r.status]}>
                      {STATUS_LABEL[r.status]}
                    </Badge>
                  ),
                },
                {
                  key: "hitCount",
                  header: "数据",
                  width: "w-20",
                  align: "right",
                  render: (r) => (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {r.hitCount}
                    </span>
                  ),
                },
                {
                  key: "createdAt",
                  header: "创建时间",
                  width: "w-40",
                  render: (r) => (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {new Date(r.createdAt).toLocaleString("zh-CN", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  ),
                },
                {
                  key: "actions",
                  header: "操作",
                  width: "w-28",
                  align: "right",
                  render: (r) => (
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          router.push(`/data-collection/reports/${r.id}`)
                        }
                      >
                        打开
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => setDeleteTarget(r)}
                        className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ),
                },
              ] satisfies DataTableColumn<ReportListRow>[]}
            />
          )}
        </div>
      </GlassCard>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="删除报告"
        description={
          deleteTarget
            ? `确定删除报告「${deleteTarget.title}」吗？关联快照将一并删除，不可恢复。`
            : ""
        }
        confirmText="删除"
        variant="danger"
        onConfirm={handleDelete}
      />
    </div>
  );
}

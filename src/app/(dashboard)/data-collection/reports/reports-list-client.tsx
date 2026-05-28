"use client";

import { useState, useTransition, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileText,
  Trash2,
  RefreshCw,
  Camera,
  Database,
  Plus,
  Calendar,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/shared/glass-card";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { deleteReportInline } from "@/app/actions/research/reports";
import { deleteEcologicalIndexReportAction } from "@/app/actions/research/ecological-index-reports";

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

export type EcoReportListRow = {
  id: string;
  title: string;
  status: "pending" | "generating" | "ready" | "failed";
  year: number;
  currentStep: string | null;
  errorMessage: string | null;
  generatedByName: string | null;
  createdAt: string; // ISO
  completedAt: string | null;
};

type SourceTab = "advanced_search" | "ecological_index";
type StatusKey = "pending" | "generating" | "ready" | "failed";

const STATUS_LABEL: Record<StatusKey, string> = {
  pending: "排队中",
  generating: "生成中",
  ready: "已完成",
  failed: "失败",
};

const STATUS_CLASS: Record<StatusKey, string> = {
  pending:
    "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50",
  generating:
    "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/30 animate-pulse",
  ready:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30",
  failed:
    "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/30",
};

interface Props {
  initialTab: SourceTab;
  advRows: ReportListRow[];
  ecoRows: EcoReportListRow[];
}

export function ReportsListClient({ initialTab, advRows, ecoRows }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<SourceTab>(initialTab);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | StatusKey>("all");
  const [deleteAdvTarget, setDeleteAdvTarget] = useState<ReportListRow | null>(
    null,
  );
  const [deleteEcoTarget, setDeleteEcoTarget] = useState<EcoReportListRow | null>(
    null,
  );

  const filteredAdv = useMemo(() => {
    const q = query.trim().toLowerCase();
    return advRows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (q && !r.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [advRows, query, statusFilter]);

  const filteredEco = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ecoRows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (q && !r.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [ecoRows, query, statusFilter]);

  const advCounts = useMemo(() => {
    const c: Record<StatusKey | "all", number> = {
      all: advRows.length,
      pending: 0,
      generating: 0,
      ready: 0,
      failed: 0,
    };
    for (const r of advRows) c[r.status]++;
    return c;
  }, [advRows]);

  const ecoCounts = useMemo(() => {
    const c: Record<StatusKey | "all", number> = {
      all: ecoRows.length,
      pending: 0,
      generating: 0,
      ready: 0,
      failed: 0,
    };
    for (const r of ecoRows) c[r.status]++;
    return c;
  }, [ecoRows]);

  const counts = tab === "advanced_search" ? advCounts : ecoCounts;
  const filteredCount =
    tab === "advanced_search" ? filteredAdv.length : filteredEco.length;

  function handleAdvDelete() {
    if (!deleteAdvTarget) return;
    const id = deleteAdvTarget.id;
    setDeleteAdvTarget(null);
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

  function handleEcoDelete() {
    if (!deleteEcoTarget) return;
    const id = deleteEcoTarget.id;
    setDeleteEcoTarget(null);
    startTransition(async () => {
      try {
        await deleteEcologicalIndexReportAction(id);
        toast.success("报告已删除");
        router.refresh();
      } catch (err) {
        toast.error(`删除失败：${(err as Error).message}`);
      }
    });
  }

  function handleNewClick() {
    if (tab === "advanced_search") {
      toast.info("检索报告需要在内容池完成检索后点「生成报告」创建");
    } else {
      // P4.2 才实现 Dialog,本 task 先 toast 占位
      toast.info("指数体系报告新建入口即将上线 (P4.2)");
    }
  }

  function handleTabChange(value: string) {
    const next = value === "ecological_index" ? "ecological_index" : "advanced_search";
    setTab(next);
    setStatusFilter("all");
    router.replace(`/data-collection/reports?type=${next}`);
  }

  const advColumns: DataTableColumn<ReportListRow>[] = [
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
        <Badge className={STATUS_CLASS[r.status]}>{STATUS_LABEL[r.status]}</Badge>
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
            onClick={() => router.push(`/data-collection/reports/${r.id}`)}
          >
            打开
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => setDeleteAdvTarget(r)}
            className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const ecoColumns: DataTableColumn<EcoReportListRow>[] = [
    {
      key: "title",
      header: "标题",
      render: (r) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-muted-foreground shrink-0" />
            <span
              className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate"
              title={r.title}
            >
              {r.title}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "year",
      header: "年份",
      width: "w-20",
      render: (r) => (
        <div className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
          <Calendar className="h-3 w-3" />
          {r.year}
        </div>
      ),
    },
    {
      key: "status",
      header: "状态",
      width: "w-32",
      render: (r) => (
        <div className="space-y-1">
          <Badge className={STATUS_CLASS[r.status]}>
            {STATUS_LABEL[r.status]}
          </Badge>
          {r.status === "generating" && r.currentStep && (
            <div className="text-[11px] text-muted-foreground truncate">
              {r.currentStep}
            </div>
          )}
          {r.status === "failed" && r.errorMessage && (
            <div
              className="text-[11px] text-rose-600 dark:text-rose-400 truncate"
              title={r.errorMessage}
            >
              {r.errorMessage.slice(0, 40)}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "generatedByName",
      header: "创建人",
      width: "w-24",
      render: (r) => (
        <span className="text-xs text-muted-foreground">
          {r.generatedByName ?? "—"}
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
            onClick={() => router.push(`/data-collection/reports/${r.id}`)}
          >
            打开
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => setDeleteEcoTarget(r)}
            className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-[1400px] mx-auto w-full space-y-6">
      <PageHeader
        title="研究报告"
        description="检索报告与指数体系报告统一管理，支持状态筛选、检索与删除"
        actions={
          <div className="flex items-center gap-3">
            <Link href="/data-collection/reports/resources">
              <Button variant="ghost" size="sm">
                <Database className="h-3.5 w-3.5 mr-1" />
                资源管理
              </Button>
            </Link>
            <Button size="sm" onClick={handleNewClick}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              新建报告
            </Button>
            <Link
              href="/data-collection/content"
              className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              返回内容池
            </Link>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList variant="line">
          <TabsTrigger value="advanced_search">
            检索报告
            <span className="ml-1 text-[11px] opacity-70">
              ({advRows.length})
            </span>
          </TabsTrigger>
          <TabsTrigger value="ecological_index">
            指数体系报告
            <span className="ml-1 text-[11px] opacity-70">
              ({ecoRows.length})
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="advanced_search">
          <GlassCard variant="panel" padding="none">
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
                共 <strong className="text-foreground">{filteredCount}</strong> 条
              </span>
            </div>

            <div className="px-5 py-4">
              {filteredAdv.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 py-16 space-y-3">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 dark:bg-sky-900/20">
                    <FileText className="h-6 w-6 text-sky-500 dark:text-sky-400" />
                  </div>
                  <div className="text-sm">
                    {advRows.length === 0 ? "还没有生成过检索报告" : "无匹配报告"}
                  </div>
                  {advRows.length === 0 && (
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
                  rows={filteredAdv}
                  rowKey={(r) => r.id}
                  onRowClick={(r) => router.push(`/data-collection/reports/${r.id}`)}
                  columns={advColumns}
                />
              )}
            </div>
          </GlassCard>
        </TabsContent>

        <TabsContent value="ecological_index">
          <GlassCard variant="panel" padding="none">
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
                共 <strong className="text-foreground">{filteredCount}</strong> 条
              </span>
            </div>

            <div className="px-5 py-4">
              {filteredEco.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 py-16 space-y-3">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 dark:bg-sky-900/20">
                    <FileText className="h-6 w-6 text-sky-500 dark:text-sky-400" />
                  </div>
                  <div className="text-sm">
                    {ecoRows.length === 0
                      ? "还没有生成过指数体系报告"
                      : "无匹配报告"}
                  </div>
                  {ecoRows.length === 0 && (
                    <div className="text-xs">
                      点击右上「新建报告」选择媒体范围与活动数据集创建
                    </div>
                  )}
                </div>
              ) : (
                <DataTable
                  rows={filteredEco}
                  rowKey={(r) => r.id}
                  onRowClick={(r) => router.push(`/data-collection/reports/${r.id}`)}
                  columns={ecoColumns}
                />
              )}
            </div>
          </GlassCard>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={Boolean(deleteAdvTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteAdvTarget(null);
        }}
        title="删除报告"
        description={
          deleteAdvTarget
            ? `确定删除报告「${deleteAdvTarget.title}」吗？关联快照将一并删除，不可恢复。`
            : ""
        }
        confirmText="删除"
        variant="danger"
        onConfirm={handleAdvDelete}
      />
      <ConfirmDialog
        open={Boolean(deleteEcoTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteEcoTarget(null);
        }}
        title="删除指数体系报告"
        description={
          deleteEcoTarget
            ? `确定删除「${deleteEcoTarget.title}」吗？关联的 xlsx/docx/数据源文件会一并清理，不可恢复。`
            : ""
        }
        confirmText="删除"
        variant="danger"
        onConfirm={handleEcoDelete}
      />
    </div>
  );
}

"use client";
//
// 活动数据集 tab - 列表 + 上传 + 详情 + 删除(普通/强制)
// Spec: docs/superpowers/specs/2026-05-26-ecological-index-report-design.md §7.2

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, Star, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { UploadDatasetDialog } from "./upload-dataset-dialog";
import { DatasetDetailDrawer } from "./dataset-detail-drawer";
import {
  setDefaultActivityDataset,
  deleteActivityDatasetAction,
} from "@/app/actions/research/activity-datasets";

export type DatasetRow = {
  id: string;
  name: string;
  year: number;
  sourceFileName: string | null;
  districtCount: number;
  totalActivities: number;
  activityThemes: string[];
  isDefault: boolean;
  createdAt: string; // ISO
  createdByName: string | null;
};

interface Props {
  rows: DatasetRow[];
}

export function DatasetsTab({ rows }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DatasetRow | null>(null);

  function handleSetDefault(datasetId: string) {
    startTransition(async () => {
      try {
        await setDefaultActivityDataset(datasetId);
        toast.success("已设为默认数据集");
        router.refresh();
      } catch (err) {
        toast.error(`设置失败:${(err as Error).message}`);
      }
    });
  }

  function handleDelete(force: boolean) {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    startTransition(async () => {
      try {
        await deleteActivityDatasetAction(id, force);
        toast.success("数据集已删除");
        router.refresh();
      } catch (err) {
        toast.error(`删除失败:${(err as Error).message}`);
      }
    });
  }

  const columns: DataTableColumn<DatasetRow>[] = [
    {
      key: "name",
      header: "数据集名称",
      render: (r) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate"
              title={r.name}
            >
              {r.name}
            </span>
            {r.isDefault && (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 shrink-0 text-[10px] px-1.5 py-0">
                默认
              </Badge>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "year",
      header: "年份",
      width: "w-20",
      align: "right",
      render: (r) => (
        <span className="text-xs tabular-nums text-muted-foreground">{r.year}</span>
      ),
    },
    {
      key: "districtCount",
      header: "区县数",
      width: "w-20",
      align: "right",
      render: (r) => (
        <span className="text-xs tabular-nums text-muted-foreground">{r.districtCount}</span>
      ),
    },
    {
      key: "totalActivities",
      header: "活动总场",
      width: "w-24",
      align: "right",
      render: (r) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {r.totalActivities}
        </span>
      ),
    },
    {
      key: "sourceFileName",
      header: "源文件",
      width: "w-40",
      render: (r) => (
        <span
          className="text-xs text-muted-foreground truncate block"
          title={r.sourceFileName ?? undefined}
        >
          {r.sourceFileName ?? "—"}
        </span>
      ),
    },
    {
      key: "createdByName",
      header: "上传人",
      width: "w-24",
      render: (r) => (
        <span className="text-xs text-muted-foreground">{r.createdByName ?? "—"}</span>
      ),
    },
    {
      key: "createdAt",
      header: "上传时间",
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
      width: "w-32",
      align: "right",
      render: (r) => (
        <div className="flex items-center justify-end gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDetailId(r.id)}
            title="查看详情"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          {!r.isDefault && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSetDefault(r.id)}
              disabled={pending}
              title="设为默认"
            >
              <Star className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteTarget(r)}
            disabled={pending}
            title="删除"
            className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Upload className="size-4 mr-1.5" />
          上传新数据集
        </Button>
      </div>

      <DataTable
        rows={rows}
        rowKey={(r) => r.id}
        columns={columns}
        emptyMessage={
          <div className="py-8 space-y-2">
            <div className="text-sm text-muted-foreground">暂无活动数据集</div>
            <div className="text-xs text-muted-foreground">
              点击右上角「上传新数据集」开始,支持 xlsx 格式 (5 主题 × 39 区县)
            </div>
          </div>
        }
      />

      <UploadDatasetDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onSuccess={() => router.refresh()}
      />

      {detailId && (
        <DatasetDetailDrawer datasetId={detailId} onClose={() => setDetailId(null)} />
      )}

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>删除活动数据集</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `确定删除「${deleteTarget.name}」?该数据集包含 ${deleteTarget.totalActivities} 场活动数据。`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            若该数据集已被报告引用,普通删除会被拒绝。如确认要删除,请用「强制删除」(已生成的报告快照会保留,但下次重生成会失败)。
          </p>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={pending}
            >
              取消
            </Button>
            <Button
              variant="outline"
              onClick={() => handleDelete(true)}
              disabled={pending}
              className="text-rose-700 dark:text-rose-400"
            >
              强制删除
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDelete(false)}
              disabled={pending}
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Power, AlertCircle } from "lucide-react";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  deleteScenario,
  toggleScenarioEnabled,
} from "@/app/actions/scenarios";
import { ScenarioEditorSheet } from "@/components/scenarios/scenario-editor-sheet";
import type { ScenarioAdminRow } from "@/lib/dal/scenarios";

interface ScenariosTabProps {
  employeeSlug: string;
  scenarios: ScenarioAdminRow[];
  /** Non-manager viewers see a read-only table and no CRUD buttons. */
  canManage: boolean;
}

export function ScenariosTab({
  employeeSlug,
  scenarios,
  canManage,
}: ScenariosTabProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingScenario, setEditingScenario] =
    useState<ScenarioAdminRow | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const nextSortOrder = useMemo(() => {
    if (scenarios.length === 0) return 0;
    return Math.max(...scenarios.map((s) => s.sortOrder)) + 1;
  }, [scenarios]);

  const handleCreate = () => {
    setEditingScenario(null);
    setEditorOpen(true);
  };

  const handleEdit = (s: ScenarioAdminRow) => {
    setEditingScenario(s);
    setEditorOpen(true);
  };

  const handleToggle = async (s: ScenarioAdminRow, enabled: boolean) => {
    setBusyId(s.id);
    try {
      await toggleScenarioEnabled(s.id, enabled);
      toast.success(enabled ? "已启用" : "已禁用");
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    setBusyId(confirmDeleteId);
    try {
      await deleteScenario(confirmDeleteId);
      toast.success("场景已删除");
      setConfirmDeleteId(null);
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground">
            预设场景
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            员工在首页和对话中心提供的预设任务入口。支持参数化指令与欢迎词。
          </div>
        </div>
        {canManage && (
          <Button size="sm" onClick={handleCreate}>
            <Plus size={14} className="mr-1" />
            新建场景
          </Button>
        )}
      </div>

      <DataTable<ScenarioAdminRow>
        rows={scenarios}
        rowKey={(r) => r.id}
        emptyMessage={
          canManage
            ? "还没有预设场景，点击右上角「新建场景」创建第一个"
            : "还没有预设场景"
        }
        columns={[
          {
            key: "name",
            header: "名称",
            render: (r) => (
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.name}</span>
                  {!r.enabled && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0"
                    >
                      已禁用
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground truncate max-w-md">
                  {r.description}
                </span>
              </div>
            ),
          },
          {
            key: "fields",
            header: "参数",
            width: "80px",
            align: "center",
            render: (r) => (
              <span className="text-xs text-muted-foreground">
                {r.inputFields.length}
              </span>
            ),
          },
          {
            key: "welcome",
            header: "欢迎词",
            width: "80px",
            align: "center",
            render: (r) =>
              r.welcomeMessage ? (
                <span className="text-emerald-600 dark:text-emerald-400 text-xs">
                  已配
                </span>
              ) : (
                <span className="text-muted-foreground text-xs">—</span>
              ),
          },
          {
            key: "enabled",
            header: "启用",
            width: "80px",
            align: "center",
            render: (r) => (
              <Switch
                checked={r.enabled}
                disabled={!canManage || busyId === r.id}
                onCheckedChange={(v) => handleToggle(r, v)}
              />
            ),
          },
          {
            key: "actions",
            header: "操作",
            width: "140px",
            align: "right",
            render: (r) =>
              canManage ? (
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(r)}
                    disabled={busyId === r.id}
                    aria-label="编辑"
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDeleteId(r.id)}
                    disabled={busyId === r.id}
                    aria-label="删除"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              ),
          },
        ]}
      />

      {!canManage && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground p-3 rounded-lg bg-muted/40">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>
            需要「AI 管理」权限才能编辑场景。请联系管理员。
          </span>
        </div>
      )}

      {/* Editor */}
      {canManage && (
        <ScenarioEditorSheet
          open={editorOpen}
          onOpenChange={setEditorOpen}
          employeeSlug={employeeSlug}
          scenario={editingScenario}
          defaultSortOrder={nextSortOrder}
          onSaved={() => {
            setEditorOpen(false);
            startTransition(() => router.refresh());
          }}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={Boolean(confirmDeleteId)}
        onOpenChange={(v) => !v && setConfirmDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除场景？</AlertDialogTitle>
            <AlertDialogDescription>
              场景删除后不可恢复，引用过该场景的历史对话记录会保留但指向失效。
              如果只是暂时停用，建议改为关闭「启用」开关。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete}>
              <Power size={14} className="mr-1" />
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Calendar, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DataTable } from "@/components/shared/data-table";
import { GlassCard } from "@/components/shared/glass-card";
import { ScheduleFormDialog } from "./schedule-form-dialog";
import {
  deleteWorkflowTemplateSchedule,
  toggleWorkflowTemplateSchedule,
} from "@/app/actions/workflow-template-schedules";
import type { ScheduledJob } from "@/db/schema/scheduled-jobs";
import type { WorkflowTemplateRow } from "@/db/types";

interface Props {
  workflow: WorkflowTemplateRow;
  schedules: ScheduledJob[];
  /**
   * 当列表发生增删改时回调,供外部(如编辑器 Trigger 卡片)同步 schedule 计数。
   * 不传则组件完全自管状态(详情页 tab 场景)。
   */
  onSchedulesChange?: (next: ScheduledJob[]) => void;
}

function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ScheduleListClient({
  workflow,
  schedules: initialSchedules,
  onSchedulesChange,
}: Props) {
  const [schedules, setSchedules] = useState<ScheduledJob[]>(initialSchedules);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduledJob | null>(null);
  const [isPending, startTransition] = useTransition();

  // 把 schedules 镜像给外部 listener(编辑器 TriggerCard 用) —— 必须放在 useEffect
  // 里,不能在 setSchedules updater 里调,否则会触发 React "Cannot update a component
  // while rendering a different component" 警告(parent 的 setState 在 child commit
  // phase 里运行被禁止)。
  // 初次渲染跳过避免无意义的 parent setState。
  const skipFirstRef = useRef(true);
  useEffect(() => {
    if (skipFirstRef.current) {
      skipFirstRef.current = false;
      return;
    }
    onSchedulesChange?.(schedules);
  }, [schedules, onSchedulesChange]);

  const handleToggle = (row: ScheduledJob, enabled: boolean) => {
    startTransition(async () => {
      const res = await toggleWorkflowTemplateSchedule(row.id, enabled);
      if (res.ok) {
        setSchedules((prev) =>
          prev.map((s) => (s.id === row.id ? { ...s, enabled } : s)),
        );
      }
    });
  };

  const handleDelete = (row: ScheduledJob) => {
    if (!confirm(`确认删除定时任务「${row.displayName}」?`)) return;
    startTransition(async () => {
      const res = await deleteWorkflowTemplateSchedule(row.id);
      if (res.ok) {
        setSchedules((prev) => prev.filter((s) => s.id !== row.id));
      }
    });
  };

  const handleOpenCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (row: ScheduledJob) => {
    setEditing(row);
    setDialogOpen(true);
  };

  const handleSaved = (saved: ScheduledJob) => {
    setSchedules((prev) => {
      const idx = prev.findIndex((s) => s.id === saved.id);
      if (idx === -1) return [saved, ...prev];
      const next = [...prev];
      next[idx] = saved;
      return next;
    });
    setDialogOpen(false);
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        {/* 当被 Sheet 嵌入时(onSchedulesChange 存在),Sheet 自带 description,
            这里不再重复,只渲染右侧 CTA */}
        {onSchedulesChange ? (
          <span />
        ) : (
          <p className="text-sm text-gray-600">
            为该场景挂载 0..N 条 cron 调度,到点自动按预设参数启动 mission。
            手动启动入口始终保留 — 定时与手动并存。
          </p>
        )}
        <Button onClick={handleOpenCreate} className="shrink-0 gap-1.5">
          <Plus size={14} />
          新建定时任务
        </Button>
      </div>

      {schedules.length === 0 ? (
        <GlassCard>
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Calendar size={32} className="text-gray-300" />
            <p className="text-sm text-gray-500">还没有定时任务</p>
            <Button variant="ghost" onClick={handleOpenCreate} className="gap-1.5">
              <Plus size={14} />
              新建第一条
            </Button>
          </div>
        </GlassCard>
      ) : (
        <DataTable
          rows={schedules}
          rowKey={(r) => r.id}
          columns={[
            {
              key: "enabled",
              header: "启用",
              width: "w-16",
              render: (r) => (
                <Switch
                  checked={r.enabled}
                  disabled={isPending}
                  onCheckedChange={(v) => handleToggle(r, v)}
                />
              ),
            },
            {
              key: "displayName",
              header: "名称",
              // 给 flex 列一个最小宽度兜底,避免 Sheet 内被其他固定列挤到 0
              width: "200px",
              render: (r) => (
                <div className="min-w-0">
                  <div className="truncate text-sm text-gray-900">
                    {r.displayName}
                  </div>
                  {r.description ? (
                    <div className="truncate text-xs text-gray-500">
                      {r.description}
                    </div>
                  ) : null}
                </div>
              ),
            },
            {
              key: "cron",
              header: "cron / 时区",
              width: "200px",
              render: (r) => (
                <div className="flex flex-col gap-0.5">
                  <code className="self-start rounded bg-gray-50 px-1.5 py-0.5 font-mono text-xs text-gray-700">
                    {r.cronExpression}
                  </code>
                  <span className="text-[11px] text-gray-400">{r.timezone}</span>
                </div>
              ),
            },
            {
              key: "lastRunAt",
              header: "上次执行",
              width: "w-36",
              render: (r) => (
                <div className="flex flex-col gap-0.5 text-xs text-gray-600">
                  <span>{formatDateTime(r.lastRunAt)}</span>
                  {r.lastRunStatus ? (
                    <span
                      className={
                        r.lastRunStatus === "success"
                          ? "text-emerald-600"
                          : "text-rose-600"
                      }
                    >
                      {r.lastRunStatus === "success" ? "成功" : "失败"}
                    </span>
                  ) : null}
                </div>
              ),
            },
            {
              key: "nextRunAt",
              header: "下次执行",
              width: "w-36",
              render: (r) => (
                <span className="text-xs text-gray-600">
                  {formatDateTime(r.nextRunAt)}
                </span>
              ),
            },
            {
              key: "actions",
              header: "操作",
              width: "w-20",
              align: "right",
              render: (r) => (
                <div className="flex items-center justify-end gap-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenEdit(r)}
                    title="编辑"
                    aria-label="编辑"
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(r)}
                    className="text-rose-600 hover:text-rose-700"
                    title="删除"
                    aria-label="删除"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ),
            },
          ]}
        />
      )}

      <ScheduleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        workflow={workflow}
        editing={editing}
        onSaved={handleSaved}
      />
    </>
  );
}

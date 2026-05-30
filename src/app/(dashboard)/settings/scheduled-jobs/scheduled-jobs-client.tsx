"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Clock, Loader2, Pause, Play, RefreshCw, Settings2, Zap } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  toggleScheduledJob,
  triggerScheduledJobNow,
  updateScheduledJobCron,
} from "@/app/actions/scheduled-jobs";
import type { ScheduledJobWithRelations } from "@/lib/dal/scheduled-jobs";

interface Props {
  jobs: ScheduledJobWithRelations[];
}

type KindFilter = "all" | "platform" | "workflow_template";

const CATEGORY_LABELS: Record<string, string> = {
  "account-analytics": "账号分析",
  cms: "CMS",
  collection: "数据采集",
  platform: "平台运营",
  "ai-engine": "AI 引擎",
  misc: "其他",
};

const CATEGORY_COLORS: Record<string, string> = {
  "account-analytics": "bg-sky-50 text-sky-700 border-sky-200",
  cms: "bg-purple-50 text-purple-700 border-purple-200",
  collection: "bg-emerald-50 text-emerald-700 border-emerald-200",
  platform: "bg-amber-50 text-amber-700 border-amber-200",
  "ai-engine": "bg-rose-50 text-rose-700 border-rose-200",
  misc: "bg-gray-50 text-gray-700 border-gray-200",
};

function formatDateTime(iso: Date | string | null): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relativeTime(iso: Date | string | null): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const diffMs = d.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const minutes = Math.round(absMs / 60_000);
  const future = diffMs > 0;
  if (minutes < 60) return future ? `${minutes} 分钟后` : `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return future ? `${hours} 小时后` : `${hours} 小时前`;
  const days = Math.round(hours / 24);
  return future ? `${days} 天后` : `${days} 天前`;
}

export function ScheduledJobsClient({ jobs: initialJobs }: Props) {
  const [jobs, setJobs] = useState<ScheduledJobWithRelations[]>(initialJobs);
  const [editingJob, setEditingJob] = useState<ScheduledJobWithRelations | null>(null);
  const [editCron, setEditCron] = useState("");
  const [editTimezone, setEditTimezone] = useState("Asia/Shanghai");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");

  const filteredJobs = useMemo(
    () => (kindFilter === "all" ? jobs : jobs.filter((j) => j.kind === kindFilter)),
    [jobs, kindFilter],
  );
  const enabledCount = useMemo(
    () => filteredJobs.filter((j) => j.enabled).length,
    [filteredJobs],
  );

  function openEdit(job: ScheduledJobWithRelations) {
    setEditingJob(job);
    setEditCron(job.cronExpression);
    setEditTimezone(job.timezone);
  }

  function handleSaveEdit() {
    if (!editingJob) return;
    setPendingId(editingJob.id);
    startTransition(async () => {
      const res = await updateScheduledJobCron({
        id: editingJob.id,
        cronExpression: editCron.trim(),
        timezone: editTimezone.trim() || "Asia/Shanghai",
      });
      setPendingId(null);
      if (!res.success) {
        toast.error(res.error ?? "保存失败");
        return;
      }
      toast.success(`已保存,下次执行:${formatDateTime(res.nextRunAt ?? null)}`);
      setJobs((prev) =>
        prev.map((j) =>
          j.id === editingJob.id
            ? {
                ...j,
                cronExpression: editCron.trim(),
                timezone: editTimezone.trim() || "Asia/Shanghai",
                nextRunAt: res.nextRunAt ? new Date(res.nextRunAt) : j.nextRunAt,
              }
            : j,
        ),
      );
      setEditingJob(null);
    });
  }

  function handleToggle(job: ScheduledJobWithRelations) {
    setPendingId(job.id);
    startTransition(async () => {
      const res = await toggleScheduledJob({ id: job.id, enabled: !job.enabled });
      setPendingId(null);
      if (!res.success) {
        toast.error(res.error ?? "操作失败");
        return;
      }
      toast.success(job.enabled ? "已禁用" : "已启用");
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, enabled: !job.enabled } : j)),
      );
    });
  }

  function handleRunNow(job: ScheduledJobWithRelations) {
    setPendingId(job.id);
    startTransition(async () => {
      const res = await triggerScheduledJobNow({ id: job.id });
      setPendingId(null);
      if (!res.success) {
        toast.error(res.error ?? "派发失败");
        return;
      }
      toast.success(`已派发 ${job.displayName},查看 Inngest 控制台跟踪执行`);
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="定时任务管理"
        description={`全项目 ${jobs.length} 个 cron 任务统一配置中心 · 启用中 ${enabledCount} 个 · 改 cron 表达式后下个分钟生效,无需重启`}
      />

      {/* 顶部说明 banner */}
      <GlassCard padding="lg">
        <div className="flex items-start gap-3 text-[13px] text-gray-700 dark:text-gray-300">
          <div className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEF4FB] text-[#2E75B6]">
            <Clock size={16} />
          </div>
          <div>
            <div className="font-semibold text-[#1F3864] dark:text-blue-200 mb-1">
              工作机制
            </div>
            <p className="leading-relaxed">
              每分钟 master scheduler 扫描本表 + 按 cron 表达式判断到点的 job,
              派发对应 Inngest 事件;业务函数订阅事件执行真正的工作。
              全项目仅 <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[12px]">scheduledJobsRunner</code> 一个函数保留硬编码 cron。
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Kind 筛选 */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-600">按类型筛选:</span>
        <Select
          value={kindFilter}
          onValueChange={(v) => setKindFilter(v as KindFilter)}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部 ({jobs.length})</SelectItem>
            <SelectItem value="platform">
              平台级 ({jobs.filter((j) => j.kind === "platform").length})
            </SelectItem>
            <SelectItem value="workflow_template">
              工作流模板 (
              {jobs.filter((j) => j.kind === "workflow_template").length})
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <GlassCard padding="lg">
        <DataTable
          rows={filteredJobs}
          rowKey={(j) => j.id}
          columns={[
            {
              key: "displayName",
              header: "任务",
              render: (j) => (
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[#1F3864] dark:text-blue-200">
                      {j.displayName}
                    </span>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px]",
                        CATEGORY_COLORS[j.category] ?? CATEGORY_COLORS.misc,
                      )}
                    >
                      {CATEGORY_LABELS[j.category] ?? j.category}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5 font-mono truncate" title={j.name}>
                    {j.name}
                  </div>
                  {j.description && (
                    <div className="text-[11px] text-gray-500 mt-1 line-clamp-2">
                      {j.description}
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: "kind",
              header: "类型 / 关联",
              width: "180px",
              render: (j) =>
                j.kind === "workflow_template" ? (
                  <div className="text-[11px]">
                    <div className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-violet-700">
                      工作流模板
                    </div>
                    <div className="mt-1 text-gray-500">
                      {j.organizationName ?? "—"}
                    </div>
                    {j.workflowTemplateId ? (
                      <Link
                        href={`/workflows/${j.workflowTemplateId}`}
                        className="mt-0.5 inline-block max-w-full truncate text-sky-600 hover:text-sky-700"
                        title={j.workflowTemplateName ?? "查看模板"}
                      >
                        {j.workflowTemplateName ?? "查看模板"}
                      </Link>
                    ) : null}
                  </div>
                ) : (
                  <div className="text-[11px] text-gray-500">
                    <div className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                      平台级
                    </div>
                  </div>
                ),
            },
            {
              key: "cronExpression",
              header: "Cron / 时区",
              width: "180px",
              render: (j) => (
                <div className="text-[12px] tabular-nums">
                  <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[#1F3864] dark:text-blue-200 font-mono">
                    {j.cronExpression}
                  </code>
                  <div className="text-[10px] text-gray-400 mt-1">{j.timezone}</div>
                </div>
              ),
            },
            {
              key: "nextRunAt",
              header: "下次执行",
              width: "160px",
              render: (j) =>
                j.enabled ? (
                  <div className="text-[12px]">
                    <div className="text-[#1F3864] dark:text-blue-200 tabular-nums">
                      {formatDateTime(j.nextRunAt)}
                    </div>
                    {j.nextRunAt && (
                      <div className="text-[10px] text-gray-400 mt-0.5">
                        {relativeTime(j.nextRunAt)}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-[12px] text-gray-400 italic">已暂停</span>
                ),
            },
            {
              key: "lastRunAt",
              header: "上次执行",
              width: "150px",
              render: (j) => (
                <div className="text-[12px]">
                  <div className="text-gray-700 dark:text-gray-300 tabular-nums">
                    {formatDateTime(j.lastRunAt)}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px]">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-1.5 py-0.5",
                        j.lastRunStatus === "success"
                          ? "bg-emerald-50 text-emerald-700"
                          : j.lastRunStatus === "failed"
                            ? "bg-rose-50 text-rose-700"
                            : "bg-gray-100 text-gray-500",
                      )}
                    >
                      {j.lastRunStatus ?? "未运行"}
                    </span>
                    {j.lastRunDurationMs != null && (
                      <span className="text-gray-400 tabular-nums">{j.lastRunDurationMs}ms</span>
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: "totalRuns",
              header: "统计",
              width: "90px",
              align: "right",
              render: (j) => (
                <div className="text-[11px] text-right tabular-nums">
                  <div className="text-gray-700 dark:text-gray-300">
                    成功 <span className="font-semibold">{j.totalRuns}</span>
                  </div>
                  {j.totalFailures > 0 && (
                    <div className="text-rose-600 mt-0.5">
                      失败 <span className="font-semibold">{j.totalFailures}</span>
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: "actions",
              header: "操作",
              width: "230px",
              render: (j) => {
                const busy = pendingId === j.id && isPending;
                return (
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(j)}
                      disabled={busy}
                      title="修改 cron 表达式"
                    >
                      <Settings2 size={13} className="mr-1" />
                      编辑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggle(j)}
                      disabled={busy}
                      title={j.enabled ? "暂停调度" : "启用调度"}
                      className={
                        j.enabled
                          ? "text-amber-700 hover:text-amber-800"
                          : "text-emerald-700 hover:text-emerald-800"
                      }
                    >
                      {j.enabled ? <Pause size={13} className="mr-1" /> : <Play size={13} className="mr-1" />}
                      {j.enabled ? "暂停" : "启用"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRunNow(j)}
                      disabled={busy || !j.enabled}
                      title={j.enabled ? "立即派发一次" : "请先启用"}
                      className="text-sky-700 hover:text-sky-800"
                    >
                      {busy ? (
                        <Loader2 size={13} className="mr-1 animate-spin" />
                      ) : (
                        <Zap size={13} className="mr-1" />
                      )}
                      立即运行
                    </Button>
                  </div>
                );
              },
            },
          ]}
          emptyMessage="还没有注册任何定时任务"
        />
      </GlassCard>

      {/* 编辑弹窗 */}
      <Dialog open={editingJob != null} onOpenChange={(open) => !open && setEditingJob(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw size={16} className="text-[#2E75B6]" />
              编辑 cron 表达式
            </DialogTitle>
            <DialogDescription>
              {editingJob?.displayName}{" "}
              <span className="text-[11px] text-gray-400 font-mono">({editingJob?.name})</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="block text-[12px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Cron 表达式(5 字段:分 时 日 月 周)
              </label>
              <Input
                value={editCron}
                onChange={(e) => setEditCron(e.target.value)}
                placeholder="0 5 * * *"
                className="font-mono text-[13px]"
              />
              <p className="mt-1.5 text-[11px] text-gray-500 leading-relaxed">
                示例:<code className="font-mono">0 5 * * *</code> = 每天 05:00 ·
                <code className="font-mono ml-1.5">*/30 * * * *</code> = 每 30 分钟 ·
                <code className="font-mono ml-1.5">0 9 * * 1</code> = 每周一 09:00 ·
                <code className="font-mono ml-1.5">0 5 1 * *</code> = 每月 1 号 05:00
              </p>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                时区
              </label>
              <Input
                value={editTimezone}
                onChange={(e) => setEditTimezone(e.target.value)}
                placeholder="Asia/Shanghai"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditingJob(null)}>
              取消
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleSaveEdit}
              disabled={isPending || !editCron.trim()}
            >
              {isPending && (
                <Loader2 size={13} className="mr-1 animate-spin" />
              )}
              保存并重算下次执行
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

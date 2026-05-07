"use client";

// src/app/(dashboard)/research/tasks/[id]/task-report-entry-client.tsx
//
// A5 Phase 8 入口 1 客户端：
// - 任务完成（status=done）+ 命中 ≤ 500 → "生成报告"按钮可点
// - 已存在母版报告 → "查看报告" + "重新生成"
// - 命中 > 500 → 按钮 disabled + 提示
// - 命中 0 → 按钮 disabled + 提示
//
// Dialog 收集自定义标题 / 主题描述（可选）→ createReportFromTask → router.push
// 共享 primitives：Button(variant="ghost") / Input / Textarea / Dialog / GlassCard

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, FileText, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/shared/glass-card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  createReportFromTask,
  regenerateReport,
} from "@/app/actions/research/reports";

const STATUS_LABELS: Record<string, string> = {
  pending: "待处理",
  crawling: "标注中",
  analyzing: "分析中",
  done: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

const REPORT_STATUS_LABELS: Record<string, string> = {
  pending: "排队中",
  generating: "生成中",
  ready: "已就绪",
  failed: "失败",
};

interface TaskMeta {
  id: string;
  name: string;
  status: string;
  timeRangeStart: string;
  timeRangeEnd: string;
}

interface ReportRow {
  id: string;
  title: string;
  status: string;
  isSnapshot: boolean;
  snapshotName: string | null;
  createdAt: string;
}

export function TaskReportEntryClient({
  task,
  hitItemIds,
  hitLimit,
  existingReports,
}: {
  task: TaskMeta;
  hitItemIds: string[];
  hitLimit: number;
  existingReports: ReportRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(`${task.name} - 研究报告`);
  const [desc, setDesc] = useState("");

  // 母版 = 非快照报告（每个任务通常只有 1 份母版；多份取最近一份展示）
  const masterReport =
    existingReports.find((r) => !r.isSnapshot) ?? null;

  const taskCompleted = task.status === "done";
  const hitOk = hitItemIds.length > 0 && hitItemIds.length <= hitLimit;
  const canGenerate = taskCompleted && hitOk;

  function openDialog() {
    if (!canGenerate) return;
    setOpen(true);
  }

  function submit() {
    const t = title.trim();
    if (!t) {
      toast.error("请输入报告标题");
      return;
    }
    startTransition(async () => {
      try {
        const r = await createReportFromTask({
          taskId: task.id,
          title: t,
          topicDescription: desc.trim() || undefined,
          hitItemIds,
        });
        setOpen(false);
        toast.success("报告生成已启动，正在分析数据…");
        router.push(`/research/reports/${r.reportId}`);
      } catch (err) {
        toast.error(`生成报告失败：${(err as Error).message}`);
      }
    });
  }

  function regenerate() {
    if (!masterReport) return;
    if (!confirm("确认重新生成母版报告？将覆盖现有报告内容。")) return;
    startTransition(async () => {
      try {
        await regenerateReport(masterReport.id);
        toast.success("已触发重新生成，正在分析数据…");
        router.push(`/research/reports/${masterReport.id}`);
      } catch (err) {
        toast.error(`重新生成失败：${(err as Error).message}`);
      }
    });
  }

  return (
    <div className="max-w-[1200px] mx-auto w-full space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/research">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            返回研究工作台
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {task.name}
              </h1>
              <Badge>
                {STATUS_LABELS[task.status] ?? task.status}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              时间范围：
              {new Date(task.timeRangeStart).toLocaleDateString("zh-CN")} ~{" "}
              {new Date(task.timeRangeEnd).toLocaleDateString("zh-CN")}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {masterReport ? (
              <>
                <Button
                  variant="ghost"
                  onClick={() =>
                    router.push(`/research/reports/${masterReport.id}`)
                  }
                >
                  <FileText className="h-3.5 w-3.5 mr-1" />
                  查看报告
                </Button>
                <Button
                  variant="ghost"
                  onClick={regenerate}
                  disabled={isPending || !canGenerate}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  重新生成
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                onClick={openDialog}
                disabled={!canGenerate || isPending}
              >
                <FileText className="h-3.5 w-3.5 mr-1" />
                生成报告
              </Button>
            )}
          </div>
        </div>
      </div>

      <GlassCard variant="default" padding="md" className="space-y-2 text-sm">
        <div>
          命中数据：
          <strong className="text-foreground">{hitItemIds.length}</strong> 条
          {hitItemIds.length > hitLimit && (
            <span className="ml-2 text-amber-600 dark:text-amber-400">
              超过 {hitLimit} 条上限，无法生成报告，请缩小研究任务范围
            </span>
          )}
          {hitItemIds.length === 0 && taskCompleted && (
            <span className="ml-2 text-muted-foreground">
              （任务已完成但暂无符合条件的命中文章）
            </span>
          )}
          {!taskCompleted && (
            <span className="ml-2 text-muted-foreground">
              （任务未完成，需等待状态变为「已完成」才能生成报告）
            </span>
          )}
        </div>
        <div>
          历史报告：
          <strong className="text-foreground">
            {existingReports.length}
          </strong>{" "}
          份
        </div>
      </GlassCard>

      {existingReports.length > 0 && (
        <GlassCard variant="default" padding="md">
          <div className="text-sm font-medium mb-3">报告列表</div>
          <div className="space-y-2">
            {existingReports.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-md hover:bg-gray-50 dark:hover:bg-white/5 transition cursor-pointer"
                onClick={() => router.push(`/research/reports/${r.id}`)}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">
                    {r.title}
                    {r.isSnapshot && r.snapshotName && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        （快照：{r.snapshotName}）
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(r.createdAt).toLocaleString("zh-CN")} ·{" "}
                    {r.isSnapshot ? "快照" : "母版"}
                  </div>
                </div>
                <Badge>
                  {REPORT_STATUS_LABELS[r.status] ?? r.status}
                </Badge>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>生成报告</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">报告标题</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="自定义报告标题"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                主题描述（可选）
              </label>
              <Textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="给 AI 写背景段提供线索，例如：本次研究关注重庆 39 区县暑期文旅消费报道趋势"
                rows={3}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              将基于命中的 {hitItemIds.length} 条数据生成分析报告，包含媒体分级、
              区县/主题分布、时间趋势等聚合视图。
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              variant="ghost"
              disabled={isPending || !title.trim()}
              onClick={submit}
            >
              {isPending ? "提交中…" : "确认生成"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  Ban,
  ListTree,
  ExternalLink,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMissionLive } from "@/lib/cowork/use-mission-live";

/**
 * cowork 右栏「任务执行」面板 —— **只做步骤清单**:把分解好的步骤列出来,每完成
 * 一步打勾(○ 待执行 / ⟳ 执行中 / ✓ 完成 / ✕ 失败)。每一步的核心概要与最终交付
 * **在对话流里流式呈现**(见 MissionStepStream),不在此重复堆详细输出。
 */
export function CoworkMissionPanel({
  missionId,
  onClose,
}: {
  missionId: string | null;
  onClose?: () => void;
}) {
  const { mission, loading } = useMissionLive(missionId);

  if (!missionId) {
    return (
      <aside className="flex w-72 flex-none flex-col items-center justify-center border-l border-border bg-muted/20 px-6 text-center">
        <ListTree className="size-7 text-muted-foreground/40" />
        <p className="mt-2 text-xs text-muted-foreground">
          选择一条任务消息,查看执行步骤清单
        </p>
      </aside>
    );
  }

  const tasks = mission?.tasks
    ? [...mission.tasks].sort(
        (a, b) =>
          (b.priority ?? 0) - (a.priority ?? 0) ||
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )
    : [];
  const doneCount = tasks.filter((t) => t.status === "completed").length;
  const teamMap = new Map<string, string>(
    (mission?.team ?? []).map((e) => [e.id as string, e.name]),
  );

  return (
    <aside className="flex w-72 flex-none flex-col border-l border-border bg-muted/20">
      {/* 头部 */}
      <div className="border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-medium">执行步骤</span>
          {tasks.length > 0 && (
            <span className="ml-auto rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
              {doneCount}/{tasks.length}
            </span>
          )}
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="关闭任务面板"
              className={cn(
                "size-6 text-muted-foreground",
                tasks.length === 0 && "ml-auto",
              )}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
        {mission && (
          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {mission.title} · {statusLabel(mission.status)}
          </p>
        )}
      </div>

      {loading && !mission ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* 步骤清单(每完成一步打勾) */}
          <div className="px-2.5 py-2">
            {tasks.length === 0 ? (
              <p className="px-1 py-2 text-[11px] text-muted-foreground/70">
                正在拆解执行步骤…
              </p>
            ) : (
              tasks.map((t) => (
                <div key={t.id} className="flex items-start gap-2 px-1 py-1.5">
                  <StatusIcon status={t.status} />
                  <div className="min-w-0">
                    <div className="text-[11.5px] leading-snug">{t.title}</div>
                    {t.assignedEmployeeId &&
                      teamMap.get(t.assignedEmployeeId) && (
                        <div className="text-[10px] text-muted-foreground">
                          {teamMap.get(t.assignedEmployeeId)}
                        </div>
                      )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 完整执行详情入口(任务中心富视图) */}
          {mission && (
            <div className="border-t border-border px-2.5 py-2">
              <Link
                href={`/missions/${mission.id}`}
                className="flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ExternalLink className="size-3 flex-none" /> 查看完整执行详情
              </Link>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "completed")
    return <CheckCircle2 className="mt-0.5 size-3.5 flex-none text-emerald-500" />;
  if (status === "in_progress")
    return <Loader2 className="mt-0.5 size-3.5 flex-none animate-spin text-primary" />;
  if (status === "failed")
    return <XCircle className="mt-0.5 size-3.5 flex-none text-red-500" />;
  if (status === "cancelled" || status === "blocked")
    return <Ban className="mt-0.5 size-3.5 flex-none text-muted-foreground/50" />;
  return <Circle className="mt-0.5 size-3.5 flex-none text-muted-foreground/50" />;
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    queued: "排队中",
    planning: "规划中",
    executing: "执行中",
    coordinating: "协调中",
    consolidating: "汇总中",
    completed: "已完成",
    failed: "失败",
    cancelled: "已取消",
  };
  return map[status] ?? status;
}

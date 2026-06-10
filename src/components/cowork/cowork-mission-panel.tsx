"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  Ban,
  ListTree,
  FileText,
  Image as ImageIcon,
  Video,
  AudioLines,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCoworkMissionDetail } from "@/app/actions/cowork-submit";
import type { MissionWithDetails } from "@/lib/types";

const TERMINAL = new Set(["completed", "failed", "cancelled"]);

export function CoworkMissionPanel({
  missionId,
  onClose,
}: {
  missionId: string | null;
  onClose?: () => void;
}) {
  const [mission, setMission] = useState<MissionWithDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  const refetch = useCallback(async (id: string) => {
    const m = await getCoworkMissionDetail(id);
    setMission(m);
    return m;
  }, []);

  useEffect(() => {
    esRef.current?.close();
    esRef.current = null;
    setMission(null);
    if (!missionId) return;

    let cancelled = false;
    setLoading(true);
    refetch(missionId).finally(() => {
      if (!cancelled) setLoading(false);
    });

    // 订阅进度:任何事件触发即重拉详情(MVP 简单稳健)。
    // 注意 progress 端点发的是具名事件(mission-init / mission-progress /
    // task-update),EventSource.onmessage 只接收无名 "message" 事件,收不到
    // 具名事件 —— 必须 addEventListener,否则首屏拉取后右栏再无更新、卡在
    // 初始态直到刷新。
    const es = new EventSource(`/api/missions/${missionId}/progress`);
    esRef.current = es;
    const onProgress = async () => {
      const m = await refetch(missionId);
      if (m && TERMINAL.has(m.status)) {
        es.close();
        esRef.current = null;
      }
    };
    es.addEventListener("mission-init", onProgress);
    es.addEventListener("mission-progress", onProgress);
    es.addEventListener("task-update", onProgress);
    es.onerror = () => {
      es.close();
      esRef.current = null;
    };

    return () => {
      cancelled = true;
      es.close();
      esRef.current = null;
    };
  }, [missionId, refetch]);

  if (!missionId) {
    return (
      <aside className="flex w-72 flex-none flex-col items-center justify-center border-l border-border bg-muted/20 px-6 text-center">
        <ListTree className="size-7 text-muted-foreground/40" />
        <p className="mt-2 text-xs text-muted-foreground">
          选择一条任务消息，查看执行步骤与产出
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
  const artifacts = mission?.artifacts ?? [];

  return (
    <aside className="flex w-72 flex-none flex-col border-l border-border bg-muted/20">
      {/* 头部 */}
      <div className="border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-medium">任务执行</span>
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
          {/* 步骤清单 */}
          <div className="px-2.5 py-2">
            {tasks.length === 0 ? (
              <p className="px-1 py-2 text-[11px] text-muted-foreground/70">
                正在生成执行步骤…
              </p>
            ) : (
              tasks.map((t) => (
                <div key={t.id} className="flex items-start gap-2 px-1 py-1.5">
                  <StatusIcon status={t.status} />
                  <div className="min-w-0">
                    <div className="text-[11.5px] leading-snug">{t.title}</div>
                    {t.assignedEmployeeId && teamMap.get(t.assignedEmployeeId) && (
                      <div className="text-[10px] text-muted-foreground">
                        {teamMap.get(t.assignedEmployeeId)}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 产出物 */}
          {artifacts.length > 0 && (
            <div className="border-t border-border px-2.5 py-2">
              <div className="px-1 pb-1.5 text-[10px] font-medium text-muted-foreground">
                产出物 · {artifacts.length}
              </div>
              <div className="space-y-1.5">
                {artifacts.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5"
                  >
                    <ArtifactIcon type={a.type} />
                    <span className="truncate text-[11px]">{a.title}</span>
                  </div>
                ))}
              </div>
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

function ArtifactIcon({ type }: { type: string }) {
  const cls = "size-3.5 flex-none text-muted-foreground";
  if (type === "image") return <ImageIcon className={cls} />;
  if (type === "video" || type === "video_script") return <Video className={cls} />;
  if (type === "audio") return <AudioLines className={cls} />;
  return <FileText className={cls} />;
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

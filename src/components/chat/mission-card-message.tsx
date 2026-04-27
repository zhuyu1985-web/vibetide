"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { useMissionProgress } from "@/lib/hooks/use-mission-progress";
import { GlassCard } from "@/components/shared/glass-card";

interface MissionCardMessageProps {
  missionId: string;
  templateName: string;
}

export function MissionCardMessage({
  missionId,
  templateName,
}: MissionCardMessageProps) {
  const state = useMissionProgress(missionId);

  // 1. 加载中（SSE 还没收到首条事件）
  if (state.isLoading) {
    return (
      <GlassCard
        padding="sm"
        className="flex items-center gap-2 text-sm text-muted-foreground"
      >
        <Loader2 size={14} className="animate-spin" />
        正在启动「{templateName}」…
      </GlassCard>
    );
  }

  // 2. mission 已删除
  if (state.notFound) {
    return (
      <GlassCard
        padding="sm"
        className="flex items-center gap-2 text-sm text-muted-foreground opacity-60"
      >
        <AlertCircle size={14} />
        任务「{templateName}」已被删除
      </GlassCard>
    );
  }

  // 3. 正常态（pending / running / completed / failed / cancelled）
  const tasks = Object.values(state.tasksById);

  return (
    <GlassCard padding="md" className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon status={state.status} />
          <span className="font-medium text-sm">{templateName}</span>
        </div>
        <Link
          href={`/missions/${missionId}`}
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          查看完整任务
          <ExternalLink size={12} />
        </Link>
      </div>
      {tasks.length > 0 && (
        <div className="space-y-1.5">
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </div>
      )}
      <div className="text-xs text-muted-foreground">
        进度 {state.progress}%
      </div>
    </GlassCard>
  );
}

function StatusIcon({
  status,
}: {
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
}) {
  if (status === "completed") {
    return <CheckCircle2 size={16} className="text-green-500" />;
  }
  if (status === "failed" || status === "cancelled") {
    return <XCircle size={16} className="text-red-500" />;
  }
  return <Loader2 size={16} className="text-sky-500 animate-spin" />;
}

function TaskRow({
  task,
}: {
  task: {
    title: string;
    status: "pending" | "running" | "completed" | "failed" | "skipped";
  };
}) {
  const icon =
    task.status === "completed" ? "✅" :
    task.status === "failed" ? "❌" :
    task.status === "running" ? "🔄" :
    task.status === "skipped" ? "⏭️" :
    "⏳";
  return (
    <div className="text-xs text-muted-foreground flex items-center gap-2">
      <span>{icon}</span>
      <span>{task.title}</span>
    </div>
  );
}

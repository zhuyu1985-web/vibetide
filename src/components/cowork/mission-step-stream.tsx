"use client";

import {
  CheckCircle2,
  Loader2,
  XCircle,
  Circle,
  PackageCheck,
  AlertCircle,
} from "lucide-react";
import { useTypewriter } from "@/lib/hooks/use-typewriter";
import { CollapsibleMessageContent } from "@/app/(dashboard)/employee/[id]/collapsible-markdown";
import { useMissionLive } from "@/lib/cowork/use-mission-live";
import { cn } from "@/lib/utils";
import type { MissionTask } from "@/lib/types";

const TERMINAL = new Set(["completed", "failed", "cancelled"]);

type FinalOutputShape = {
  summary?: string;
  message?: string;
  failureReasons?: string[];
  artifacts?: Array<{ content?: string }>;
};

function readFinalOutput(raw: unknown): FinalOutputShape | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as FinalOutputShape;
}

function deliverableText(fo: FinalOutputShape): string {
  const parts: string[] = [];
  for (const a of fo.artifacts ?? []) {
    if (typeof a.content === "string" && a.content.trim()) parts.push(a.content);
  }
  if (parts.length === 0 && typeof fo.summary === "string" && fo.summary.trim()) {
    parts.push(fo.summary);
  }
  return parts.join("\n\n");
}

/** 每步的"核心概要":优先 outputData.summary(够长),退化到 artifacts 正文,截断。 */
function stepSummary(task: MissionTask): string {
  const od = task.outputData as
    | { summary?: string; artifacts?: Array<{ content?: string }> }
    | null;
  let text = "";
  if (od && typeof od === "object") {
    if (typeof od.summary === "string" && od.summary.trim().length > 12) {
      text = od.summary.trim();
    } else {
      const c = od.artifacts?.find((a) => a.content?.trim())?.content;
      if (c) text = c.trim();
    }
  }
  if (!text && task.outputSummary?.trim()) text = task.outputSummary.trim();
  return text.length > 220 ? `${text.slice(0, 220)}…` : text;
}

/**
 * 对话流里的"任务执行步骤"流。订阅 mission 实时详情,把每一步渲染成气泡:
 * 执行中转圈、完成打勾并**流式打字**展示该步核心概要;mission 终态时追加一条
 * 「交付结果 / 执行失败」气泡。右侧面板只做步骤清单打勾,详细输出在此呈现。
 */
export function MissionStepStream({ missionId }: { missionId: string }) {
  const { mission } = useMissionLive(missionId);
  if (!mission) return null;

  const tasks = [...mission.tasks].sort(
    (a, b) =>
      (b.priority ?? 0) - (a.priority ?? 0) ||
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const stepNoOf = new Map(tasks.map((t, i) => [t.id, i + 1]));
  const teamMap = new Map<string, string>(
    mission.team.map((e) => [e.id as string, e.name]),
  );
  const started = tasks.filter((t) => t.status !== "pending");
  const isTerminal = TERMINAL.has(mission.status);
  const isFailed = mission.status === "failed";

  const fo = readFinalOutput(mission.finalOutput);
  const deliverable = fo ? deliverableText(fo) : "";
  const failureMsg =
    fo?.message?.trim() || (isFailed ? fo?.summary?.trim() : "") || "";
  const failureReasons = isFailed
    ? (fo?.failureReasons ?? []).filter((r) => typeof r === "string" && r.trim())
    : [];

  return (
    <div className="mt-2 space-y-2">
      {started.length === 0 && !isTerminal && (
        <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> 正在拆解任务、安排 AI 团队执行…
        </div>
      )}

      {started.map((t) => (
        <StepBubble
          key={t.id}
          task={t}
          stepNo={stepNoOf.get(t.id) ?? 0}
          total={tasks.length}
          employeeName={
            t.assignedEmployeeId
              ? teamMap.get(t.assignedEmployeeId)
              : undefined
          }
        />
      ))}

      {isTerminal &&
        (isFailed ? (
          <ResultBubble
            tone="fail"
            title="执行失败"
            body={failureMsg || "任务未能完成"}
            reasons={failureReasons}
          />
        ) : deliverable ? (
          <ResultBubble tone="ok" title="交付结果" markdown={deliverable} />
        ) : null)}
    </div>
  );
}

function StepIcon({
  done,
  running,
  failed,
}: {
  done: boolean;
  running: boolean;
  failed: boolean;
}) {
  if (done)
    return <CheckCircle2 className="mt-1 size-4 flex-none text-emerald-500" />;
  if (running)
    return (
      <Loader2 className="mt-1 size-4 flex-none animate-spin text-primary" />
    );
  if (failed) return <XCircle className="mt-1 size-4 flex-none text-red-500" />;
  return <Circle className="mt-1 size-4 flex-none text-muted-foreground/50" />;
}

function StepBubble({
  task,
  stepNo,
  total,
  employeeName,
}: {
  task: MissionTask;
  stepNo: number;
  total: number;
  employeeName?: string;
}) {
  const done = task.status === "completed";
  const running = task.status === "in_progress" || task.status === "in_review";
  const failed = task.status === "failed";
  const summary = done ? stepSummary(task) : "";
  // 完成后才流式打字,replayKey=task.id 保证同一会话内只播一次
  const shown = useTypewriter(summary, 90, done ? task.id : null);

  return (
    <div className="flex gap-2.5">
      <StepIcon done={done} running={running} failed={failed} />
      <div className="min-w-0 flex-1 rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5">
        <div className="flex items-center gap-2 text-[13px]">
          <span className="flex-none text-[11px] text-muted-foreground">
            步骤 {stepNo}/{total}
          </span>
          <span className="truncate font-medium text-foreground">
            {task.title}
          </span>
          {employeeName && (
            <span className="ml-auto flex-none text-[11px] text-muted-foreground">
              {employeeName}
            </span>
          )}
        </div>
        {running && (
          <p className="mt-1 text-xs text-muted-foreground">执行中…</p>
        )}
        {failed && <p className="mt-1 text-xs text-red-500">该步骤执行失败</p>}
        {done && shown && (
          <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/85">
            {shown}
          </p>
        )}
      </div>
    </div>
  );
}

function ResultBubble({
  tone,
  title,
  body,
  markdown,
  reasons = [],
}: {
  tone: "ok" | "fail";
  title: string;
  body?: string;
  markdown?: string;
  reasons?: string[];
}) {
  const Icon = tone === "ok" ? PackageCheck : AlertCircle;
  return (
    <div className="flex gap-2.5">
      <span
        className={cn(
          "mt-0.5 flex size-7 flex-none items-center justify-center rounded-xl",
          tone === "ok"
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "bg-red-500/10 text-red-600 dark:text-red-400",
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1 rounded-2xl rounded-bl-md bg-card px-3.5 py-2.5 shadow-sm ring-1 ring-inset ring-border/60">
        <div
          className={cn(
            "text-[11px] font-medium",
            tone === "ok"
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400",
          )}
        >
          {title}
        </div>
        {markdown ? (
          <div className="mt-1">
            <CollapsibleMessageContent markdown={markdown} />
          </div>
        ) : (
          <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/85">
            {body}
          </p>
        )}
        {reasons.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {reasons.map((r, i) => (
              <li
                key={i}
                className="text-[11.5px] leading-relaxed text-muted-foreground/80"
              >
                · {r}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

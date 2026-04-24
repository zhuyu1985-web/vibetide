"use client";

import { useState, useEffect, useMemo, useTransition, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as LucideIcons from "lucide-react";
import {
  CheckCircle,
  Circle,
  Loader2,
  XCircle,
  Clock,
  Crown,
  ArrowLeft,
  Ban,
  Eye,
  MessageSquare,
  FileText,
  Copy,
  Check,
  RefreshCw,
  Archive,
  Trash2,
  Zap,
  Lock,
  BarChart3,
  Package,
  Newspaper,
  Video,
  ClipboardCheck,
  TrendingUp,
  Lightbulb,
  Send,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/shared/glass-card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { EMPLOYEE_AVATAR_MAP } from "@/components/shared/employee-svg-avatars";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  EMPLOYEE_META,
  type EmployeeId,
  type EmployeeMeta,
} from "@/lib/constants";
import { cancelMission, retryMission, deleteMission, archiveMission } from "@/app/actions/missions";
import { DraftComparisonPanel } from "@/components/missions/draft-comparison-panel";
import { CollapsibleMessageContent } from "@/app/(dashboard)/employee/[id]/collapsible-markdown";
import type {
  MissionWithDetails,
  MissionTask,
  MissionTaskStatus,
  AIEmployee,
} from "@/lib/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TASK_STATUS: Record<
  MissionTaskStatus,
  { icon: typeof Circle; color: string; label: string; badgeCls: string }
> = {
  pending:     { icon: Circle,      color: "text-gray-400",    label: "等待中",  badgeCls: "bg-gray-500/20 text-gray-400" },
  ready:       { icon: Clock,       color: "text-blue-400",    label: "就绪",    badgeCls: "bg-blue-500/20 text-blue-400" },
  claimed:     { icon: Clock,       color: "text-blue-400",    label: "已认领",  badgeCls: "bg-blue-500/20 text-blue-400" },
  in_progress: { icon: Loader2,     color: "text-cyan-400",    label: "执行中",  badgeCls: "bg-cyan-500/20 text-cyan-400" },
  in_review:   { icon: Eye,         color: "text-purple-400",  label: "审核中",  badgeCls: "bg-purple-500/20 text-purple-400" },
  completed:   { icon: CheckCircle, color: "text-emerald-400", label: "已完成",  badgeCls: "bg-emerald-500/20 text-emerald-400" },
  failed:      { icon: XCircle,     color: "text-red-400",     label: "失败",    badgeCls: "bg-red-500/20 text-red-400" },
  cancelled:   { icon: XCircle,     color: "text-gray-500",    label: "已取消",  badgeCls: "bg-gray-500/20 text-gray-500" },
  blocked:     { icon: Lock,        color: "text-orange-400",  label: "未解锁",  badgeCls: "bg-orange-500/20 text-orange-400" },
};

const SOURCE_LABEL: Record<string, string> = {
  hot_topics: "灵感雷达", publishing: "全渠道发布", benchmarking: "对标监控",
  analytics: "数据分析", creation: "超级创作", inspiration: "热点发现",
};

const PHASE_STEPS = [
  { key: "assembling",   label: "组队" },
  { key: "decomposing",  label: "拆解" },
  { key: "executing",    label: "执行" },
  { key: "coordinating", label: "协调" },
  { key: "delivering",   label: "交付" },
] as const;

function getPhaseIdx(status: string, phase?: string): number {
  if (status === "completed") return 5;
  if (status === "failed" || status === "cancelled") {
    return phase ? PHASE_STEPS.findIndex((p) => p.key === phase) : 2;
  }
  if (phase) {
    const idx = PHASE_STEPS.findIndex((p) => p.key === phase);
    if (idx >= 0) return idx;
  }
  if (status === "queued") return 0;
  if (status === "planning") return 1;
  if (status === "executing") return 2;
  if (status === "consolidating") return 3;
  return 0;
}

function taskBorderColor(status: MissionTaskStatus): string {
  switch (status) {
    case "completed": return "border-l-emerald-500";
    case "in_progress": case "claimed": return "border-l-cyan-500";
    case "in_review": return "border-l-purple-500";
    case "failed": return "border-l-red-500";
    case "blocked": return "border-l-orange-500";
    default: return "border-l-gray-600";
  }
}

function taskProgressColor(status: MissionTaskStatus): string {
  switch (status) {
    case "completed": return "bg-emerald-500";
    case "in_progress": case "claimed": return "bg-cyan-500";
    case "in_review": return "bg-purple-500";
    case "failed": return "bg-red-500";
    default: return "bg-gray-600";
  }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function MissionConsoleClient({ mission }: { mission: MissionWithDetails }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [selectedTask, setSelectedTask] = useState<MissionTask | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Default tab: 完成后优先展示核心产出，其次执行摘要，否则任务看板。
  // "核心产出有内容"与下方 productionArtifacts 判定保持一致（按 DAG 深度取 top 2）。
  const [activeTab, setActiveTab] = useState(() => {
    if (mission.status !== "completed") return "kanban";
    const PLANNING_RE = /分解|分配|汇总|总结|综述|概述|摘要/;
    const candidates = mission.tasks.filter((t) => !PLANNING_RE.test(t.title));
    const hasCoreArtifacts = candidates.some((t) => {
      const out = t.outputData as { artifacts?: Array<{ content?: string }> } | null;
      return out?.artifacts?.some((a) => a.content?.trim());
    });
    if (hasCoreArtifacts) return "production";
    if (mission.finalOutput != null) return "output";
    return "kanban";
  });

  const isTerminated = ["completed", "failed", "cancelled"].includes(mission.status);
  const isActive = ["queued", "planning", "executing", "consolidating"].includes(mission.status);
  const hasFinalOutput = mission.finalOutput != null;

  // 核心产出：按依赖深度取 DAG 最深的 2 个任务的 artifact（通常是主生产步 + 复核/质检），
  // 并过滤掉计划/汇总类任务（分解 / 分配）。中间步骤（资料搜集、选题、对标等）在看板看。
  // "执行摘要"（mission.finalOutput）天然不在 missionTasks 里，不会进入此 Tab。
  const productionArtifacts = useMemo(() => {
    const PLANNING_KEYWORDS = /分解|分配|汇总|总结|综述|概述|摘要/;

    // 计算每个任务的 DAG 深度：无依赖 => 0，否则 1 + max(上游)
    const taskById = new Map(mission.tasks.map((t) => [t.id, t]));
    const depthCache = new Map<string, number>();
    const computeDepth = (taskId: string, visiting = new Set<string>()): number => {
      if (depthCache.has(taskId)) return depthCache.get(taskId)!;
      if (visiting.has(taskId)) return 0; // 防环
      visiting.add(taskId);
      const t = taskById.get(taskId);
      if (!t) return 0;
      const deps = t.dependencies ?? [];
      const d =
        deps.length === 0
          ? 0
          : 1 + Math.max(...deps.map((dep) => computeDepth(dep, visiting)));
      depthCache.set(taskId, d);
      return d;
    };

    const candidates = mission.tasks
      .filter((t) => !PLANNING_KEYWORDS.test(t.title))
      .map((t) => ({ task: t, depth: computeDepth(t.id) }))
      .sort((a, b) => b.depth - a.depth)
      .slice(0, 2); // 最深的 2 个

    const collected: Array<{
      id: string;
      type: string;
      title: string;
      content: string;
      employeeSlug?: string;
      qualityScore?: number;
      taskTitle: string;
    }> = [];
    for (const { task } of candidates) {
      const out = task.outputData as {
        artifacts?: Array<{ id: string; type: string; title: string; content: string }>;
        employeeSlug?: string;
        metrics?: { qualityScore?: number };
      } | null;
      if (!out?.artifacts) continue;
      for (const a of out.artifacts) {
        if (!a.content?.trim()) continue;
        collected.push({
          id: a.id,
          type: a.type,
          title: a.title,
          content: a.content,
          employeeSlug: out.employeeSlug,
          qualityScore: out.metrics?.qualityScore,
          taskTitle: task.title,
        });
      }
    }
    return collected;
  }, [mission.tasks]);
  const hasProductionOutput = productionArtifacts.length > 0;

  const completedCount = mission.tasks.filter((t) => t.status === "completed").length;
  const inProgressCount = mission.tasks.filter((t) => ["in_progress", "claimed", "in_review"].includes(t.status)).length;
  const pendingCount = mission.tasks.filter((t) => ["pending", "ready", "blocked"].includes(t.status)).length;
  const totalCount = mission.tasks.length;
  const progressPercent = isTerminated ? 100 : totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Real-time progress via SSE, with polling fallback
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!isActive) return;

    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    // Try SSE first
    const es = new EventSource(`/api/missions/${mission.id}/progress`);
    let sseConnected = false;

    es.addEventListener("mission-progress", () => {
      sseConnected = true;
      // SSE delivers updates — do a lightweight refresh to pick up new data
      startTransition(() => { router.refresh(); });
    });

    es.addEventListener("mission-completed", () => {
      startTransition(() => { router.refresh(); });
      es.close();
    });

    es.onerror = () => {
      // SSE failed — fall back to polling
      if (!sseConnected && !fallbackInterval) {
        es.close();
        fallbackInterval = setInterval(() => {
          try { startTransition(() => { router.refresh(); }); } catch { /* network error */ }
        }, 8000);
      }
    };

    return () => {
      es.close();
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, [isActive, mission.id, router, startTransition]);

  const scenarioLabel = mission.scenarioLabel;

  const taskTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of mission.tasks) map.set(t.id, t.title);
    return map;
  }, [mission.tasks]);

  // Task board keeps the template step order stable throughout execution —
  // sort by priority (== step.order from the template) ascending, with task id
  // as a deterministic tiebreaker. Previously this re-sorted by status (putting
  // `completed` on top), so each task that finished visibly jumped to the
  // front — disorienting when watching the mission progress top-to-bottom.
  const sortedTasks = useMemo(() => {
    return [...mission.tasks].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.id.localeCompare(b.id);
    });
  }, [mission.tasks]);

  const empTaskMap = useMemo(() => {
    const map = new Map<string, MissionTask>();
    for (const t of mission.tasks) {
      if (t.assignedEmployeeId && ["in_progress", "claimed"].includes(t.status)) {
        map.set(t.assignedEmployeeId, t);
      }
    }
    return map;
  }, [mission.tasks]);

  async function handleCancel() { await cancelMission(mission.id); router.refresh(); }
  async function handleRetry() { const m = await retryMission(mission.id); router.push(`/missions/${m.id}`); }
  async function handleArchive() { await archiveMission(mission.id); router.push("/missions"); }
  function handleDelete() {
    setDeleteOpen(true);
  }
  async function confirmDelete() {
    setDeleting(true);
    try {
      await deleteMission(mission.id);
      router.push("/missions");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }
  async function handleCopyOutput() {
    const text = extractReadableOutput(mission.finalOutput);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-5">
      {/* ═══ Header Bar ═══ */}
      <GlassCard padding="sm" className="!py-4 !px-5">
        <div className="flex items-center gap-4">
          <Link href="/missions" prefetch={true}
            className="inline-flex items-center justify-center size-9 shrink-0 -ml-1 relative z-10 rounded-md hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>

          <div className="flex-1 flex items-center gap-3 min-w-0">
            {isActive ? (
              <div className="relative w-4 h-4 shrink-0 flex items-center justify-center">
                <span className="absolute inset-0 rounded-full border-2 border-cyan-400 animate-[ping_1.5s_ease-in-out_infinite] opacity-40" />
                <span className="w-2 h-2 rounded-full bg-cyan-500" />
              </div>
            ) : (
              <div className={cn(
                "w-2.5 h-2.5 rounded-full shrink-0",
                isTerminated && mission.status !== "completed" ? "bg-red-400" : "bg-emerald-400"
              )} />
            )}
            <span className="text-xs text-muted-foreground shrink-0">{scenarioLabel}</span>
            <span className="text-gray-500 dark:text-gray-400">·</span>
            <h1 className="text-lg font-bold truncate">{mission.title}</h1>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {isActive && (
              <Button variant="ghost" size="sm" onClick={handleCancel} className="gap-1 text-muted-foreground text-xs h-7">
                <Ban size={12} /> 取消
              </Button>
            )}
            {isTerminated && (
              <>
                <Button variant="ghost" size="sm" onClick={handleRetry} className="gap-1 text-emerald-400 text-xs h-7">
                  <RefreshCw size={12} /> 重试
                </Button>
                <Button variant="ghost" size="sm" onClick={handleArchive} className="gap-1 text-muted-foreground text-xs h-7">
                  <Archive size={12} /> 归档
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDelete} className="gap-1 text-red-400 text-xs h-7">
                  <Trash2 size={12} /> 删除
                </Button>
              </>
            )}
          </div>

          {/* Progress circle */}
          <ProgressCircle percent={progressPercent} size={48} />
        </div>

        {/* Phase pipeline — inside header card */}
        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-white/5">
          <PhaseBar status={mission.status} phase={mission.phase} />
        </div>
      </GlassCard>

      {/* ═══ 3-Column Body ═══ */}
      <div className="flex gap-5 items-start">

        {/* ── Left: Team ── */}
        <div className="w-[280px] shrink-0">
          <GlassCard padding="none" className="overflow-hidden">
            {/* Section header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-white/5">
              <span className="text-sm font-semibold flex items-center gap-1.5">
                <Crown size={12} className="text-rose-400" />
                当前团队
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                {(mission.team.length + (mission.leader ? 1 : 0))} 人
              </span>
            </div>
            {/* Members */}
            <div className="p-2.5 space-y-1.5">
              {mission.leader && (
                <TeamMemberCard
                  employee={mission.leader}
                  isLeader
                  currentTask={empTaskMap.get(mission.leader.dbId ?? "")}
                  allTasksDone={mission.status === "completed"}
                />
              )}
              {mission.team.map((emp) => (
                <TeamMemberCard
                  key={emp.dbId}
                  employee={emp}
                  currentTask={empTaskMap.get(emp.dbId ?? "")}
                  allTasksDone={mission.status === "completed"}
                />
              ))}
            </div>
          </GlassCard>
        </div>

        {/* ── Center: Tasks / Messages ── */}
        <div className="flex-1 min-w-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="kanban" className="gap-1.5">
                <FileText size={13} />
                任务看板
              </TabsTrigger>
              <TabsTrigger value="messages" className="gap-1.5">
                <MessageSquare size={13} />
                协作消息
                {mission.messages.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4.5 min-w-5 px-1.5 text-xs font-bold">
                    {mission.messages.length}
                  </Badge>
                )}
              </TabsTrigger>
              {hasProductionOutput && (
                <TabsTrigger value="production" className="gap-1.5">
                  <Package size={13} className="text-cyan-500" />
                  核心产出
                  <Badge variant="secondary" className="ml-1 h-4.5 min-w-5 px-1.5 text-xs font-bold">
                    {productionArtifacts.length}
                  </Badge>
                </TabsTrigger>
              )}
              {hasFinalOutput && (
                <TabsTrigger value="output" className="gap-1.5">
                  <Crown size={13} className="text-rose-400" />
                  执行摘要
                  <span className="ml-1 w-2 h-2 rounded-full bg-emerald-400" />
                </TabsTrigger>
              )}
            </TabsList>

            {/* Task Board */}
            <TabsContent value="kanban" className="mt-0">
              {totalCount === 0 ? (
                <GlassCard className="p-16 text-center">
                  {mission.status === "queued" || mission.status === "planning" ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <Loader2 size={16} className="animate-spin" /> {mission.status === "queued" ? "任务排队中，等待资源分配..." : "队长正在分析任务并制定计划..."}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">暂无任务</p>
                  )}
                </GlassCard>
              ) : (
                <>
                  <div className="relative pl-14">
                    <div className="flex flex-col">
                      {sortedTasks.map((task, idx) => {
                        const effStatus: MissionTaskStatus =
                          isTerminated && ["pending", "blocked", "ready"].includes(task.status) ? "cancelled" : task.status;
                        const running = effStatus === "in_progress" || effStatus === "claimed";
                        const done = effStatus === "completed";
                        const isFirst = idx === 0;
                        const isLast = idx === sortedTasks.length - 1;
                        return (
                          <div key={task.id} className="relative py-1.5 first:pt-0 last:pb-0">
                            {/* 时间轴底层灰线（row 高度内连续，相邻 row 首尾相接） */}
                            <span
                              className={cn(
                                "pointer-events-none absolute left-[-28px] w-px -translate-x-1/2 bg-gray-200/70 dark:bg-white/[0.08]",
                                isFirst ? "top-1/2" : "top-0",
                                isLast ? "bottom-1/2" : "bottom-0"
                              )}
                              aria-hidden
                            />
                            {/* 已到达段彩色覆盖（已完成整条；进行中覆盖上半） */}
                            {(done || running) && (
                              <span
                                className={cn(
                                  "pointer-events-none absolute left-[-28px] w-px -translate-x-1/2 bg-primary/45",
                                  isFirst ? "top-1/2" : "top-0",
                                  done ? (isLast ? "bottom-1/2" : "bottom-0") : "bottom-1/2"
                                )}
                                aria-hidden
                              />
                            )}
                            {/* 时间轴圆点：双环（外圈 ring + 中心小实心点） */}
                            <span
                              className="absolute left-[-28px] top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5"
                              aria-hidden
                            >
                              {running && (
                                <>
                                  <span className="absolute inset-0 rounded-full border-2 border-primary/50 animate-ping" />
                                  <span className="absolute inset-[-4px] rounded-full border border-primary/30 animate-ping [animation-delay:300ms]" />
                                </>
                              )}
                              <span
                                className={cn(
                                  "relative flex items-center justify-center rounded-full border-2",
                                  running
                                    ? "w-4 h-4 border-primary bg-primary/10 shadow-[0_0_14px_2px_rgba(56,189,248,0.55)]"
                                    : done
                                      ? "w-3.5 h-3.5 border-primary/70 bg-transparent"
                                      : "w-3.5 h-3.5 border-gray-300 dark:border-white/20 bg-transparent"
                                )}
                              >
                                {running && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                                {done && <span className="w-1.5 h-1.5 rounded-full bg-primary/70" />}
                              </span>
                            </span>
                            <TaskCard task={task} taskTitleMap={taskTitleMap} missionDone={isTerminated} onClick={() => setSelectedTask(task)} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {/* Status legend */}
                  <div className="flex items-center justify-center gap-5 mt-4 py-2">
                    {[
                      { color: "bg-emerald-400", label: "已完成" },
                      { color: "bg-cyan-400", label: "执行中" },
                      { color: "bg-orange-400", label: "等待中" },
                      { color: "bg-gray-500", label: "未解锁" },
                    ].map((s) => (
                      <span key={s.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className={cn("w-2 h-2 rounded-full", s.color)} />{s.label}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            {/* Messages */}
            <TabsContent value="messages" className="mt-0">
              {mission.messages.length === 0 ? (
                <GlassCard className="p-16 text-center text-sm text-muted-foreground">暂无消息</GlassCard>
              ) : (
                <ScrollArea className="h-[620px]">
                  <div className="space-y-2.5">
                    {mission.messages.map((msg) => {
                      const fromMeta = msg.fromEmployee ? EMPLOYEE_META[msg.fromEmployee.id as EmployeeId] : null;
                      const toEmp = msg.toEmployeeId
                        ? mission.team.find((e) => e.dbId === msg.toEmployeeId) ?? (mission.leader?.dbId === msg.toEmployeeId ? mission.leader : null)
                        : null;
                      const toMeta = toEmp ? EMPLOYEE_META[toEmp.id as EmployeeId] : null;
                      const isBroadcast = !msg.toEmployeeId;
                      return (
                        <div key={msg.id} className="rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] hover:bg-gray-100 dark:hover:bg-white/[0.05] hover:border-gray-300 dark:hover:border-white/[0.1] transition-colors px-5 py-4">
                          {/* Sender → Recipient + time */}
                          <div className="flex items-center justify-between mb-2.5">
                            <div className="flex items-center gap-1.5">
                              <EmployeeChip meta={fromMeta} />
                              <span className="text-gray-400 dark:text-gray-500 dark:text-gray-400 text-xs">→</span>
                              {isBroadcast ? (
                                <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/[0.03] border border-gray-200 dark:border-transparent">
                                  <MessageSquare size={10} />全体
                                </span>
                              ) : (
                                <EmployeeChip meta={toMeta} />
                              )}
                            </div>
                            <span className="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400 font-mono tabular-nums">
                              {new Date(msg.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                            </span>
                          </div>
                          {/* Content */}
                          <p className="text-sm text-gray-700 dark:text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            {/* Production Output — 核心产出物（稿件/脚本/分析/数据报告） */}
            <TabsContent value="production" className="mt-0 space-y-4">
              <ProductionOutputRenderer
                artifacts={productionArtifacts}
                scenarioCategory={mission.scenarioCategory ?? null}
                scenario={mission.scenario}
              />
            </TabsContent>

            {/* Output */}
            <TabsContent value="output" className="mt-0 space-y-4">
              {/* 深度追踪 mission：草稿对比 + 入库面板（出现在最终输出上方） */}
              {mission.scenario === "深度追踪" && (
                <DraftComparisonPanel missionId={mission.id} tasks={mission.tasks} />
              )}
              {hasFinalOutput && (
                <GlassCard>
                  <div className="flex items-center justify-between mb-4">
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold flex items-center gap-2">
                        <Crown size={14} className="text-rose-400" />
                        {mission.scenario === "深度追踪" ? "Leader 任务总结" : "执行摘要"}
                      </h2>
                      {mission.scenario === "深度追踪" ? (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                          这是 Leader 对整个任务的二次概述。完整稿件请到上方"多维度草稿对比"卡片查看 / 入库。
                        </p>
                      ) : (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                          这是 Leader 对整个任务的汇总概述。完整稿件 / 产出详情请查看下方各子任务的产出卡片。
                        </p>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleCopyOutput} className="gap-1.5 h-7 text-xs">
                      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      {copied ? "已复制" : "复制"}
                    </Button>
                  </div>
                  <FinalOutputRenderer output={mission.finalOutput} />
                </GlassCard>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* ── Right: Activity + Stats ── */}
        <div className="w-[340px] shrink-0 space-y-4">
          {/* Activity Feed */}
          <GlassCard padding="none" className="overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-white/5">
              <span className="text-sm font-semibold flex items-center gap-1.5">
                <Zap size={12} className="text-cyan-400" />
                实时动态
              </span>
            </div>
            <ScrollArea className="h-[420px]">
              {mission.messages.length === 0 ? (
                <p className="text-xs text-gray-600 dark:text-gray-400 text-center py-12">暂无动态</p>
              ) : (
                <div className="p-3 space-y-0.5">
                  {[...mission.messages].reverse().map((msg) => {
                    const fromMeta = msg.fromEmployee ? EMPLOYEE_META[msg.fromEmployee.id as EmployeeId] : null;
                    return (
                      <div key={msg.id} className="flex gap-2.5 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.03] transition-colors">
                        <div className="w-1.5 h-1.5 rounded-full mt-[7px] shrink-0" style={{ backgroundColor: fromMeta?.color ?? "#6b7280" }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-xs font-semibold" style={{ color: fromMeta?.color }}>{fromMeta?.nickname ?? "未知"}</span>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2 leading-[1.5]">{msg.content}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-mono">
                            {new Date(msg.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </GlassCard>

          {/* Stats */}
          <GlassCard padding="none" className="overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-white/5">
              <span className="text-sm font-semibold flex items-center gap-1.5">
                <BarChart3 size={12} className="text-cyan-400" />
                任务统计
              </span>
            </div>
            <div className="grid grid-cols-2 gap-px bg-gray-200 dark:bg-white/[0.03]">
              {[
                { value: totalCount, label: "总任务", cls: "text-gray-800 dark:text-gray-100" },
                { value: completedCount, label: "已完成", cls: "text-emerald-400" },
                { value: inProgressCount, label: "进行中", cls: "text-cyan-400" },
                { value: pendingCount, label: "等待中", cls: "text-gray-400" },
              ].map((s) => (
                <div key={s.label} className="bg-background py-4 text-center">
                  <p className={cn("text-xl font-bold font-mono", s.cls)}>{s.value}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Scenario Info */}
          <ScenarioInfoCard mission={mission} />
        </div>
      </div>

      <TaskDetailSheet task={selectedTask} onClose={() => setSelectedTask(null)} />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="删除任务"
        description="确定要永久删除此任务？此操作不可恢复。"
        confirmText="删除"
        variant="danger"
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProgressCircle
// ---------------------------------------------------------------------------

function ProgressCircle({ percent, size = 48 }: { percent: number; size?: number }) {
  const sw = 3;
  const r = (size - sw * 2) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" className="text-gray-200 dark:text-white/5" strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#pg)" strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset} className="transition-[stroke-dashoffset] duration-700" />
        <defs><linearGradient id="pg" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#06b6d4" /><stop offset="100%" stopColor="#3b82f6" /></linearGradient></defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold font-mono text-cyan-400">{percent}%</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PhaseBar
// ---------------------------------------------------------------------------

function PhaseBar({ status, phase }: { status: string; phase?: string }) {
  const currentIdx = getPhaseIdx(status, phase);
  const isFailed = status === "failed" || status === "cancelled";

  return (
    <div className="flex items-center justify-center">
      {PHASE_STEPS.map((step, i) => {
        const isPast = status === "completed" || i < currentIdx;
        const isCurrent = status !== "completed" && i === currentIdx;
        const isErr = isCurrent && isFailed;

        return (
          <div key={step.key} className="flex items-center">
            <div className="flex items-center gap-1.5">
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
                isErr ? "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.25)]"
                : isPast ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
                : isCurrent ? "bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.25)]"
                : "bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-500 dark:text-gray-400"
              )}>
                {isErr ? <XCircle size={14} /> : isPast ? <CheckCircle size={14} />
                  : isCurrent ? <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 dark:bg-cyan-400 animate-pulse" /> : <Circle size={14} />}
              </div>
              <span className={cn(
                "text-sm whitespace-nowrap",
                isErr ? "text-red-600 dark:text-red-400 font-medium"
                : isPast ? "text-emerald-600 dark:text-emerald-400"
                : isCurrent ? "text-cyan-600 dark:text-cyan-400 font-medium"
                : "text-gray-400 dark:text-gray-500 dark:text-gray-400"
              )}>{step.label}</span>
            </div>
            {i < PHASE_STEPS.length - 1 && (
              <div className={cn(
                "w-12 h-0.5 rounded-full mx-2",
                isPast ? "bg-emerald-400/50 dark:bg-emerald-500/30" : isCurrent ? "bg-cyan-400/30 dark:bg-cyan-500/15" : "bg-gray-200 dark:bg-white/5"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TeamMemberCard
// ---------------------------------------------------------------------------

function TeamMemberCard({ employee, isLeader = false, currentTask, allTasksDone = false }: {
  employee: AIEmployee; isLeader?: boolean; currentTask?: MissionTask; allTasksDone?: boolean;
}) {
  const meta = EMPLOYEE_META[employee.id as EmployeeId];
  if (!meta) return null;

  const Icon = meta.icon;
  const SvgAvatar = EMPLOYEE_AVATAR_MAP[employee.id as EmployeeId];
  const hasTask = !!currentTask;

  return (
    <div className="rounded-xl p-3 bg-gray-50 dark:bg-white/[0.03] hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors space-y-2">
      <div className="flex items-center gap-2.5">
        <div
          className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shrink-0"
          style={SvgAvatar ? undefined : { backgroundColor: meta.bgColor }}
        >
          {SvgAvatar ? (
            <SvgAvatar className="w-full h-full" />
          ) : (
            <Icon size={17} style={{ color: meta.color }} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold" style={{ color: meta.color }}>{meta.nickname}</span>
            {isLeader && <Badge className="text-[10px] px-1.5 py-0 h-4 font-bold bg-rose-500/20 text-rose-400">Leader</Badge>}
          </div>
          <p className="text-xs text-muted-foreground truncate">{meta.title}</p>
        </div>
        {hasTask ? (
          <div className="relative w-4 h-4 shrink-0 flex items-center justify-center">
            <span className="absolute inset-0 rounded-full border-2 border-cyan-400 animate-[ping_1.5s_ease-in-out_infinite] opacity-40" />
            <span className="w-2 h-2 rounded-full bg-cyan-500" />
          </div>
        ) : (
          <div className={cn("w-2 h-2 rounded-full shrink-0", allTasksDone ? "bg-emerald-400" : "bg-gray-300 dark:bg-white/10")} />
        )}
      </div>

      {allTasksDone ? (
        <div className="pt-2 mt-1 border-t border-gray-200 dark:border-white/[0.06]">
          <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle size={10} />{isLeader ? "全部任务已完成" : "任务已完成"}</p>
        </div>
      ) : currentTask ? (
        <div className="pt-2 mt-1 border-t border-gray-200 dark:border-white/[0.06] space-y-1.5">
          <p className="text-xs text-gray-500 dark:text-gray-400">当前任务</p>
          <p className="text-sm font-medium truncate">{currentTask.title}</p>
          <div className="h-1.5 rounded-full bg-gray-200 dark:bg-white/5 overflow-hidden">
            <div className={cn("h-full rounded-full transition-[width] duration-500", taskProgressColor(currentTask.status))}
              style={{ width: `${currentTask.progress}%` }} />
          </div>
        </div>
      ) : (
        <div className="pt-2 mt-1 border-t border-gray-200 dark:border-white/[0.06]">
          <p className="text-xs text-gray-500 dark:text-gray-400">待命中</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TaskCard
// ---------------------------------------------------------------------------

function TaskCard({ task, taskTitleMap, missionDone = false, onClick }: {
  task: MissionTask; taskTitleMap: Map<string, string>; missionDone?: boolean; onClick: () => void;
}) {
  // When mission is done, treat remaining pending/blocked/ready tasks as cancelled (skipped)
  const effectiveStatus: MissionTaskStatus = (missionDone && ["pending", "blocked", "ready"].includes(task.status))
    ? "cancelled" : task.status;
  const config = TASK_STATUS[effectiveStatus];
  const empMeta = task.assignedEmployee ? EMPLOYEE_META[task.assignedEmployee.id as EmployeeId] : null;
  const isRunning = effectiveStatus === "in_progress" || effectiveStatus === "claimed";
  const isLocked = effectiveStatus === "pending" || effectiveStatus === "blocked";
  const depLabels = task.dependencies.map((id) => taskTitleMap.get(id)).filter(Boolean);

  if (isRunning) {
    return (
      <div className="running-task-border">
        <button
          onClick={onClick}
          className="relative z-10 w-full text-left rounded-[11px] px-5 py-4 bg-white dark:bg-[#0c0e14] transition-[transform] duration-150 hover:translate-x-0.5"
        >
          {renderTaskContent(task, config, empMeta, depLabels, taskTitleMap, isRunning, isLocked)}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl px-5 py-4 border-l-[3px] transition-[transform,background-color,box-shadow] duration-150 hover:translate-x-0.5",
        taskBorderColor(effectiveStatus),
        isLocked ? "bg-gray-50 dark:bg-white/[0.02] border-y border-r border-gray-200 dark:border-white/[0.06] opacity-60" : "glass-card-interactive",
        effectiveStatus === "in_review" && "ring-1 ring-purple-500/20 shadow-[0_0_16px_rgba(168,85,247,0.08)]"
      )}
    >
      {renderTaskContent(task, config, empMeta, depLabels, taskTitleMap, isRunning, isLocked)}
    </button>
  );
}

function renderTaskContent(
  task: MissionTask,
  config: { icon: typeof Circle; color: string; label: string; badgeCls: string },
  empMeta: EmployeeMeta | null,
  depLabels: (string | undefined)[],
  _taskTitleMap: Map<string, string>,
  isRunning: boolean,
  isLocked: boolean,
) {
  return (
    <>
      <div className="flex items-center justify-between mb-2.5">
        <Badge className={cn("text-xs font-semibold gap-1 px-2.5 py-0.5 rounded-md", config.badgeCls)}>
          {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
          {config.label}
        </Badge>
        {depLabels.length > 0 && (
          <span className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[200px] font-mono">← {depLabels.filter(Boolean).join(", ")}</span>
        )}
      </div>
      <p className={cn("text-sm font-semibold leading-snug", isLocked && "text-muted-foreground")}>{task.title}</p>
      <div className="flex items-center justify-between mt-3">
        {empMeta ? (
          <div className="flex items-center gap-1.5">
            <EmployeeAvatar employeeId={empMeta.id} size="xs" />
            <span className="text-xs font-medium" style={{ color: empMeta.color }}>{empMeta.nickname}</span>
          </div>
        ) : (
          <span className="text-xs text-gray-500 dark:text-gray-400">未分配</span>
        )}
        <div className="flex items-center gap-3">
          {task.phase != null && <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">Phase {task.phase}</span>}
          <div className="flex items-center gap-2 w-44">
            <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-white/5 overflow-hidden">
              <div className={cn("h-full rounded-full transition-[width] duration-500", taskProgressColor(task.status))}
                style={{ width: `${task.status === "completed" ? 100 : task.progress}%` }} />
            </div>
            <span className="text-xs font-mono text-gray-600 dark:text-gray-400 w-10 text-right">{task.status === "completed" ? 100 : task.progress}%</span>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// TaskDetailSheet
// ---------------------------------------------------------------------------

function TaskDetailSheet({ task, onClose }: { task: MissionTask | null; onClose: () => void }) {
  if (!task) return null;
  const config = TASK_STATUS[task.status];
  const StatusIcon = config.icon;
  const empMeta = task.assignedEmployee ? EMPLOYEE_META[task.assignedEmployee.id as EmployeeId] : null;
  // Prefer the artifact's full `content` (LLM's complete output, structured
  // per the SKILL.md) over the one-line `summary` (which is just the first
  // paragraph by parseStepOutput). Without this fall-through, even when the
  // LLM produced 【执行摘要】/【执行过程】/【产出结果】, the UI showed only
  // a single line like "周度热点聚合结果".
  type OutputShape = {
    summary?: string;
    artifacts?: Array<{ content?: string; title?: string }>;
  };
  const outputObj =
    task.outputData && typeof task.outputData === "object" && !Array.isArray(task.outputData)
      ? (task.outputData as OutputShape)
      : null;
  const artifactContent = outputObj?.artifacts?.[0]?.content ?? null;
  const fullSummary = outputObj?.summary ? String(outputObj.summary) : null;
  // Fall back to JSON stringify only if neither artifact nor summary exists.
  const fullOutputText = artifactContent
    ? null
    : task.outputData != null
      ? typeof task.outputData === "string"
        ? task.outputData
        : JSON.stringify(task.outputData, null, 2)
      : null;

  // inputContext is written by check-task-dependencies / mission-executor as
  // `[{ taskId, taskTitle, output }, ...]` — upstream task outputs that became
  // this task's input when its dependencies resolved.
  const upstreamInputs =
    Array.isArray(task.inputContext)
      ? (task.inputContext as Array<{ taskId?: string; taskTitle?: string; output?: unknown }>)
      : [];

  return (
    <Sheet open={!!task} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto p-0 gap-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-950 px-6 pt-6 pb-4 border-b border-gray-100 dark:border-white/5">
          <SheetHeader>
            <SheetTitle className="text-left text-base leading-snug">{task.title}</SheetTitle>
          </SheetHeader>
          <div className="flex items-center justify-between mt-3">
            <div className={cn("inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full", config.color, "bg-current/8")}>
              <StatusIcon size={12} />
              <span>{config.label}</span>
            </div>
            {empMeta ? (
              <div className="flex items-center gap-1.5">
                <EmployeeAvatar employeeId={empMeta.id} size="xs" />
                <span className="text-sm font-medium" style={{ color: empMeta.color }}>{empMeta.nickname}</span>
              </div>
            ) : <span className="text-xs text-muted-foreground">未分配</span>}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {task.description && <DetailSection label="任务描述" text={task.description} />}
          {task.expectedOutput && <DetailSection label="期望输出" text={task.expectedOutput} />}
          {task.acceptanceCriteria && <DetailSection label="验收标准" text={task.acceptanceCriteria} />}

          {upstreamInputs.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-sky-600 dark:text-sky-400 mb-2">上游输入</h3>
              <div className="space-y-2">
                {upstreamInputs.map((item, idx) => {
                  const title = item.taskTitle ?? `上游任务 ${idx + 1}`;
                  const outputText =
                    item.output == null
                      ? "（无输出）"
                      : typeof item.output === "string"
                        ? item.output
                        : (() => {
                            const obj = item.output as Record<string, unknown>;
                            if (obj && typeof obj === "object" && "summary" in obj && typeof obj.summary === "string") {
                              return obj.summary;
                            }
                            return JSON.stringify(item.output, null, 2);
                          })();
                  return (
                    <div
                      key={item.taskId ?? idx}
                      className="rounded-xl bg-sky-50/50 dark:bg-sky-500/5 border border-sky-100 dark:border-sky-500/10 p-3"
                    >
                      <div className="text-xs font-medium text-sky-700 dark:text-sky-300 mb-1.5">{title}</div>
                      <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-mono leading-relaxed max-h-60 overflow-y-auto">
                        {outputText}
                      </pre>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {artifactContent && (
            <div>
              <h3 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-2">执行结果</h3>
              <div className="rounded-xl bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/10 p-4">
                <CollapsibleMessageContent markdown={artifactContent} />
              </div>
            </div>
          )}
          {!artifactContent && fullSummary && (
            <div>
              <h3 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-2">执行结果</h3>
              <div className="rounded-xl bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/10 p-4">
                <CollapsibleMessageContent markdown={fullSummary} />
              </div>
            </div>
          )}
          {fullOutputText && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">输出数据</h3>
              <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/5 p-4 rounded-xl overflow-x-auto leading-relaxed">{fullOutputText}</pre>
            </div>
          )}
          {task.errorMessage && (
            <div>
              <h3 className="text-xs font-semibold text-red-500 dark:text-red-400 mb-2">错误信息</h3>
              <p className="text-sm text-red-600/80 dark:text-red-400/70 whitespace-pre-wrap bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/10 p-4 rounded-xl">{task.errorMessage}</p>
            </div>
          )}

          {/* Timeline */}
          <div className="pt-4 border-t border-gray-100 dark:border-white/5">
            <div className="space-y-2.5">
              {[
                { label: "创建", time: task.createdAt, dot: "bg-gray-300 dark:bg-gray-600" },
                task.startedAt ? { label: "开始", time: task.startedAt, dot: "bg-cyan-400" } : null,
                task.completedAt ? { label: "完成", time: task.completedAt, dot: "bg-emerald-400" } : null,
              ].filter(Boolean).map((item) => (
                <div key={item!.label} className="flex items-center gap-3">
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", item!.dot)} />
                  <span className="text-xs text-muted-foreground w-7">{item!.label}</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400 font-mono tabular-nums">
                    {new Date(item!.time).toLocaleString("zh-CN")}
                  </span>
                </div>
              ))}
              {task.retryCount > 0 && (
                <div className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-orange-400" />
                  <span className="text-xs text-muted-foreground w-7">重试</span>
                  <span className="text-xs text-gray-600 dark:text-gray-400 font-mono">{task.retryCount} 次</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailSection({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground mb-2">{label}</h3>
      <div className="rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/5 px-4 py-3">
        <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmployeeChip — compact sender/recipient tag with icon + name
// ---------------------------------------------------------------------------

function EmployeeChip({ meta }: { meta: EmployeeMeta | null }) {
  if (!meta) return <span className="text-xs text-muted-foreground">未知</span>;
  const Icon = meta.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg"
      style={{ backgroundColor: `${meta.color}18`, color: meta.color }}
    >
      <Icon size={12} />{meta.nickname}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ScenarioInfoCard — right sidebar scenario/meta info
// ---------------------------------------------------------------------------

function ScenarioInfoCard({ mission }: { mission: MissionWithDetails }) {
  // 从 lucide-react 动态解析 icon 名（mission.scenarioIcon 可能为 null）
  const ScenarioIcon = mission.scenarioIcon
    ? ((LucideIcons as unknown as Record<string, LucideIcon | undefined>)[
        // 转为 PascalCase：file-text → FileText
        mission.scenarioIcon
          .split("-")
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join("")
      ] ?? LucideIcons.FileText)
    : LucideIcons.FileText;

  const elapsedMs = mission.completedAt
    ? new Date(mission.completedAt).getTime() - new Date(mission.createdAt).getTime()
    : Date.now() - new Date(mission.createdAt).getTime();
  const elapsedMins = Math.max(1, Math.round(elapsedMs / 60000));

  const phaseLabels: Record<string, string> = {
    assembling: "组队中", decomposing: "任务拆解", executing: "并行执行",
    coordinating: "协调汇总", delivering: "交付中",
  };
  const statusLabels: Record<string, string> = {
    queued: "排队中", planning: "规划中", executing: "并行执行", consolidating: "协调汇总",
    completed: "已完成", failed: "异常中断", cancelled: "已取消",
  };
  const currentPhaseLabel = mission.phase
    ? phaseLabels[mission.phase] ?? mission.phase
    : statusLabels[mission.status] ?? mission.status;

  const statusColor: Record<string, string> = {
    queued: "text-gray-500 dark:text-gray-400", planning: "text-amber-600 dark:text-amber-400", executing: "text-cyan-600 dark:text-cyan-400", consolidating: "text-purple-600 dark:text-purple-400",
    completed: "text-emerald-600 dark:text-emerald-400", failed: "text-red-600 dark:text-red-400", cancelled: "text-gray-500 dark:text-gray-400",
  };

  return (
    <GlassCard padding="none" className="overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-white/5">
        <span className="text-sm font-semibold flex items-center gap-1.5">
          <ScenarioIcon size={12} className="text-sky-500" />
          场景信息
        </span>
      </div>
      <div className="px-4 py-3 space-y-2.5">
        <InfoRow label="场景模板" value={mission.scenarioLabel ?? mission.scenario} />
        {mission.sourceModule && (
          <InfoRow label="触发来源" value={SOURCE_LABEL[mission.sourceModule] ?? mission.sourceModule} />
        )}
        <InfoRow label="创建时间" value={new Date(mission.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} />
        <InfoRow label="预计耗时" value={`~${elapsedMins} 分钟`} />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">当前阶段</span>
          <span className={cn("text-xs font-semibold", statusColor[mission.status] ?? "text-gray-400")}>{currentPhaseLabel}</span>
        </div>
        {mission.userInstruction && (
          <div className="pt-2 border-t border-gray-200 dark:border-white/5">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">任务说明</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-3">{mission.userInstruction}</p>
          </div>
        )}
      </div>
    </GlassCard>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FinalOutputRenderer — render StepOutput as readable content, not raw JSON
// ---------------------------------------------------------------------------

function extractReadableOutput(output: unknown): string {
  if (typeof output === "string") return output;
  if (!output || typeof output !== "object") return String(output ?? "");

  const obj = output as Record<string, unknown>;

  // StepOutput structure: { summary, artifacts: [{ content }], ... }
  const parts: string[] = [];

  // Primary content from artifacts
  const artifacts = obj.artifacts as Array<{ content?: string; title?: string }> | undefined;
  if (artifacts?.length) {
    for (const a of artifacts) {
      if (a.content && typeof a.content === "string") parts.push(a.content);
    }
  }

  // Fallback to summary if no artifact content
  if (parts.length === 0 && obj.summary && typeof obj.summary === "string") {
    parts.push(obj.summary);
  }

  // Still empty — try to stringify
  if (parts.length === 0) return JSON.stringify(output, null, 2);

  return parts.join("\n\n");
}

function FinalOutputRenderer({ output }: { output: unknown }) {
  const text = extractReadableOutput(output);

  // Render as markdown-like content with paragraphs
  const paragraphs = text.split(/\n{2,}/).filter(Boolean);

  return (
    <div className="space-y-4">
      {paragraphs.map((p, i) => {
        const trimmed = p.trim();
        // Heading detection
        if (trimmed.startsWith("# ")) {
          return <h2 key={i} className="text-lg font-bold text-gray-800 dark:text-gray-100 mt-2">{trimmed.slice(2)}</h2>;
        }
        if (trimmed.startsWith("## ")) {
          return <h3 key={i} className="text-base font-bold text-gray-800 dark:text-gray-100 mt-1">{trimmed.slice(3)}</h3>;
        }
        if (trimmed.startsWith("### ")) {
          return <h4 key={i} className="text-sm font-bold text-gray-700 dark:text-gray-200">{trimmed.slice(4)}</h4>;
        }
        // List detection
        if (trimmed.split("\n").every(line => /^[-*•]\s/.test(line.trim()) || line.trim() === "")) {
          return (
            <ul key={i} className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {trimmed.split("\n").filter(l => l.trim()).map((line, j) => (
                <li key={j}>{line.replace(/^[-*•]\s*/, "")}</li>
              ))}
            </ul>
          );
        }
        // Numbered list
        if (trimmed.split("\n").every(line => /^\d+[.、)]\s/.test(line.trim()) || line.trim() === "")) {
          return (
            <ol key={i} className="list-decimal list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {trimmed.split("\n").filter(l => l.trim()).map((line, j) => (
                <li key={j}>{line.replace(/^\d+[.、)]\s*/, "")}</li>
              ))}
            </ol>
          );
        }
        // Regular paragraph
        return (
          <p key={i} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProductionOutputRenderer — 核心产出物渲染（按 artifact.type 分派）
// ---------------------------------------------------------------------------

interface ProductionArtifact {
  id: string;
  type: string;
  title: string;
  content: string;
  employeeSlug?: string;
  qualityScore?: number;
  taskTitle: string;
}

const ARTIFACT_META: Record<string, { label: string; icon: LucideIcon; tone: string }> = {
  article_draft: { label: "稿件", icon: Newspaper, tone: "text-blue-500" },
  video_script: { label: "脚本", icon: Video, tone: "text-purple-500" },
  review_report: { label: "审核报告", icon: ClipboardCheck, tone: "text-amber-500" },
  analytics_report: { label: "数据报告", icon: BarChart3, tone: "text-emerald-500" },
  hot_topic_list: { label: "热点榜单", icon: TrendingUp, tone: "text-rose-500" },
  topic_angles: { label: "选题角度", icon: Lightbulb, tone: "text-yellow-500" },
  material_brief: { label: "素材简报", icon: FileText, tone: "text-sky-500" },
  publish_plan: { label: "发布计划", icon: Send, tone: "text-indigo-500" },
  generic: { label: "产出", icon: Package, tone: "text-gray-500" },
};

function getArtifactMeta(type: string) {
  return ARTIFACT_META[type] ?? ARTIFACT_META.generic;
}

function tryParseJson<T = unknown>(content: string): T | null {
  const trimmed = content.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return null;
  }
}

function ProductionOutputRenderer({
  artifacts,
  scenarioCategory,
  scenario,
}: {
  artifacts: ProductionArtifact[];
  scenarioCategory: string | null;
  scenario: string;
}) {
  if (artifacts.length === 0) {
    return (
      <GlassCard className="p-16 text-center">
        <Package size={32} className="mx-auto mb-3 text-gray-400" />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          暂无核心产出物
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
          任务完成后，稿件 / 脚本 / 分析报告会在此处展示
        </p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-gray-500 dark:text-gray-400 px-1">
        共 {artifacts.length} 项产出 · 场景：{scenario}
        {scenarioCategory && ` · 分类：${scenarioCategory}`}
      </div>
      {artifacts.map((artifact) => (
        <ArtifactCard key={artifact.id} artifact={artifact} />
      ))}
    </div>
  );
}

function ArtifactCard({ artifact }: { artifact: ProductionArtifact }) {
  const meta = getArtifactMeta(artifact.type);
  const Icon = meta.icon;
  const fromMeta = artifact.employeeSlug
    ? EMPLOYEE_META[artifact.employeeSlug as EmployeeId]
    : null;
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(artifact.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleExpanded = () => setExpanded((v) => !v);
  const handleHeaderKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleExpanded();
    }
  };

  return (
    <GlassCard padding="none" className="overflow-hidden">
      {/* 外层不能是 <button>：复制按钮是 <Button>（本身就是 button），嵌套会触发
          "button cannot be descendant of button" hydration error。改用带 role 的 div。*/}
      <div
        role="button"
        tabIndex={0}
        onClick={toggleExpanded}
        onKeyDown={handleHeaderKeyDown}
        className="w-full flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-200 dark:border-white/5 hover:bg-gray-50/60 dark:hover:bg-white/[0.03] transition-colors text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <ChevronDown
            size={14}
            className={cn(
              "text-gray-400 transition-transform shrink-0",
              !expanded && "-rotate-90"
            )}
          />
          <Icon size={16} className={cn(meta.tone, "shrink-0")} />
          <span className="text-sm font-semibold truncate">{artifact.title}</span>
          <Badge variant="secondary" className="text-[10px] h-4.5 px-1.5 shrink-0">
            {meta.label}
          </Badge>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {fromMeta && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              by{" "}
              <span style={{ color: fromMeta.color }} className="font-medium">
                {fromMeta.nickname}
              </span>
            </span>
          )}
          {typeof artifact.qualityScore === "number" && (
            <Badge
              variant="secondary"
              className={cn(
                "text-[10px] h-4.5 px-1.5",
                artifact.qualityScore >= 80
                  ? "text-emerald-600 dark:text-emerald-400"
                  : artifact.qualityScore >= 60
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-red-600 dark:text-red-400"
              )}
            >
              质量 {artifact.qualityScore}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="gap-1 h-6 text-xs px-2"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            {copied ? "已复制" : "复制"}
          </Button>
        </div>
      </div>
      {expanded && (
        <>
          <div className="px-5 py-4">
            <ArtifactBody artifact={artifact} />
          </div>
          <div className="px-5 py-2 border-t border-gray-200 dark:border-white/5 bg-gray-50/40 dark:bg-white/[0.02]">
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              来自子任务：{artifact.taskTitle}
            </span>
          </div>
        </>
      )}
    </GlassCard>
  );
}

function ArtifactBody({ artifact }: { artifact: ProductionArtifact }) {
  // review_report / analytics_report：若是 JSON 结构，走结构化渲染
  if (artifact.type === "review_report") {
    const parsed = tryParseJson<{
      overallScore?: number;
      issues?: Array<{ claim?: string; issue?: string; severity?: string }>;
      summary?: string;
    }>(artifact.content);
    if (parsed) return <ReviewReportBody data={parsed} />;
  }
  if (artifact.type === "analytics_report") {
    const parsed = tryParseJson<{
      metrics?: Record<string, number | string>;
      summary?: string;
      insights?: string[];
    }>(artifact.content);
    if (parsed) return <AnalyticsReportBody data={parsed} />;
  }
  if (artifact.type === "hot_topic_list") {
    const parsed = tryParseJson<{
      topics?: Array<{ topic?: string; title?: string; url?: string; mentions?: number; source?: string }>;
    }>(artifact.content);
    if (parsed?.topics?.length) return <HotTopicListBody topics={parsed.topics} />;
  }

  // 稿件正文：长文阅读样式
  if (artifact.type === "article_draft") {
    return <ArticleBody content={artifact.content} />;
  }

  // 默认：复用 markdown-ish 渲染
  return <FinalOutputRenderer output={{ artifacts: [{ content: artifact.content }] }} />;
}

function ArticleBody({ content }: { content: string }) {
  const wordCount = content.length;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 pb-2 border-b border-gray-100 dark:border-white/5">
        <span>字数：{wordCount}</span>
      </div>
      <article className="prose-article">
        <FinalOutputRenderer output={{ artifacts: [{ content }] }} />
      </article>
    </div>
  );
}

function ReviewReportBody({
  data,
}: {
  data: {
    overallScore?: number;
    issues?: Array<{ claim?: string; issue?: string; severity?: string }>;
    summary?: string;
  };
}) {
  const score = data.overallScore ?? 0;
  const issues = data.issues ?? [];
  const severityClass = (s?: string) =>
    s === "high"
      ? "text-red-500 bg-red-50 dark:bg-red-500/10"
      : s === "medium"
        ? "text-amber-500 bg-amber-50 dark:bg-amber-500/10"
        : "text-gray-500 bg-gray-50 dark:bg-white/5";
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "text-2xl font-bold",
            score >= 80 ? "text-emerald-500" : score >= 60 ? "text-amber-500" : "text-red-500"
          )}
        >
          {score}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-500 dark:text-gray-400">综合评分</div>
          {data.summary && (
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5 line-clamp-2">
              {data.summary}
            </p>
          )}
        </div>
      </div>
      {issues.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
            发现 {issues.length} 条问题
          </div>
          <ul className="space-y-2">
            {issues.map((issue, i) => (
              <li key={i} className={cn("rounded-md px-3 py-2 text-xs", severityClass(issue.severity))}>
                <span className="font-semibold">[{issue.severity || "info"}] </span>
                {issue.claim && <span className="font-medium">{issue.claim}：</span>}
                <span>{issue.issue}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AnalyticsReportBody({
  data,
}: {
  data: {
    metrics?: Record<string, number | string>;
    summary?: string;
    insights?: string[];
  };
}) {
  const metrics = data.metrics ?? {};
  const metricEntries = Object.entries(metrics);
  return (
    <div className="space-y-4">
      {data.summary && (
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{data.summary}</p>
      )}
      {metricEntries.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {metricEntries.map(([key, value]) => (
            <div
              key={key}
              className="rounded-lg bg-gray-50 dark:bg-white/[0.03] px-3 py-2.5"
            >
              <div className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">
                {key}
              </div>
              <div className="text-base font-bold font-mono tabular-nums text-gray-800 dark:text-gray-100">
                {String(value)}
              </div>
            </div>
          ))}
        </div>
      )}
      {data.insights && data.insights.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
            关键洞察
          </div>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
            {data.insights.map((ins, i) => (
              <li key={i}>{ins}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function HotTopicListBody({
  topics,
}: {
  topics: Array<{ topic?: string; title?: string; url?: string; mentions?: number; source?: string }>;
}) {
  return (
    <ol className="space-y-2">
      {topics.map((t, i) => (
        <li
          key={i}
          className="flex items-start gap-3 rounded-md hover:bg-gray-50 dark:hover:bg-white/[0.03] px-2 py-1.5"
        >
          <span className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold font-mono bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400">
            {i + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
              {t.topic || t.title || "（未命名）"}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
              {t.source && <span>{t.source}</span>}
              {typeof t.mentions === "number" && <span>· 提及 {t.mentions}</span>}
              {t.url && (
                <a
                  href={t.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-500 hover:underline truncate"
                >
                  原文
                </a>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

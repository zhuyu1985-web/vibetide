"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Calendar, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/shared/data-table";
import { GlassCard } from "@/components/shared/glass-card";
import { SearchInput } from "@/components/shared/search-input";
import { toggleWorkflowTemplateSchedule } from "@/app/actions/workflow-template-schedules";
import {
  computeNextCronRun,
  describeCronExpression,
} from "@/lib/cron";

export interface OrgScheduleRow {
  id: string;
  displayName: string;
  description: string | null;
  cronExpression: string;
  timezone: string;
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  workflowTemplateId: string | null;
  templateName: string | null;
  templateIsBuiltin: boolean;
  templateCreatedBy: string | null;
  createdAt: string;
}

export type ScheduleScope = "mine" | "all";

function resolveNextRun(row: OrgScheduleRow): Date | null {
  if (row.nextRunAt) {
    const d = new Date(row.nextRunAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return computeNextCronRun(row.cronExpression, row.timezone);
}

function cronOrderKey(cronExpression: string): number {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length < 5) return Number.MAX_SAFE_INTEGER;
  const [minute, hour, , , dayOfWeek] = parts;
  const m = Number(minute) || 0;
  const h = Number(hour) || 0;
  const d = dayOfWeek === "*" ? 0 : Number(dayOfWeek) || 7;
  return d * 1440 + h * 60 + m;
}

function compareSchedulesStable(a: OrgScheduleRow, b: OrgScheduleRow): number {
  const cronDiff = cronOrderKey(a.cronExpression) - cronOrderKey(b.cronExpression);
  if (cronDiff !== 0) return cronDiff;
  const createdDiff = a.createdAt.localeCompare(b.createdAt);
  if (createdDiff !== 0) return createdDiff;
  return a.id.localeCompare(b.id);
}

function compareSchedulesByTime(a: OrgScheduleRow, b: OrgScheduleRow): number {
  return compareSchedulesStable(a, b);
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
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

export function SchedulesClient({
  schedules: initial,
  currentUserId,
  workflowSuggestions = [],
}: {
  schedules: OrgScheduleRow[];
  currentUserId: string;
  workflowSuggestions?: { id: string; name: string }[];
}) {
  const [schedules, setSchedules] = useState(initial);
  const [scope, setScope] = useState<ScheduleScope>("mine");
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const duplicateNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of schedules) {
      counts.set(s.displayName, (counts.get(s.displayName) ?? 0) + 1);
    }
    return new Set(
      [...counts.entries()].filter(([, c]) => c > 1).map(([name]) => name),
    );
  }, [schedules]);

  const scopedSchedules = useMemo(() => {
    if (scope === "all") return schedules;
    return schedules.filter(
      (s) => !s.templateIsBuiltin && s.templateCreatedBy === currentUserId,
    );
  }, [schedules, scope, currentUserId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? scopedSchedules.filter(
          (s) =>
            s.displayName.toLowerCase().includes(q) ||
            (s.templateName?.toLowerCase().includes(q) ?? false) ||
            s.cronExpression.toLowerCase().includes(q) ||
            describeCronExpression(s.cronExpression).toLowerCase().includes(q),
        )
      : scopedSchedules;
    return [...base].sort(compareSchedulesByTime);
  }, [scopedSchedules, query]);

  const enabledCount = useMemo(
    () => scopedSchedules.filter((s) => s.enabled).length,
    [scopedSchedules],
  );

  const mineCount = useMemo(
    () =>
      schedules.filter(
        (s) => !s.templateIsBuiltin && s.templateCreatedBy === currentUserId,
      ).length,
    [schedules, currentUserId],
  );

  function handleToggle(row: OrgScheduleRow, enabled: boolean) {
    const previousEnabled = row.enabled;
    setSchedules((prev) =>
      prev.map((s) => (s.id === row.id ? { ...s, enabled } : s)),
    );
    setPendingId(row.id);
    startTransition(async () => {
      const res = await toggleWorkflowTemplateSchedule(row.id, enabled);
      setPendingId(null);
      if (!res.ok) {
        setSchedules((prev) =>
          prev.map((s) =>
            s.id === row.id ? { ...s, enabled: previousEnabled } : s,
          ),
        );
        toast.error(res.errors._global ?? "切换失败");
        return;
      }
      toast.success(enabled ? "已启用" : "已停用");
    });
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            定时任务
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {scope === "mine"
              ? `我的工作流定时 · 共 ${scopedSchedules.length} 条 · 启用中 ${enabledCount} 条`
              : `本组织全部定时（含内置模板）· 共 ${scopedSchedules.length} 条 · 启用中 ${enabledCount} 条`}
          </p>
          {mineCount < schedules.length ? (
            <p className="mt-1 text-xs text-muted-foreground/80">
              与「工作流 → 我的工作流」对齐请看「我的」；另有 {schedules.length - mineCount}{" "}
              条来自内置模板迁移。
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <Tabs
            value={scope}
            onValueChange={(v) => setScope(v as ScheduleScope)}
          >
            <TabsList>
              <TabsTrigger value="mine">我的 ({mineCount})</TabsTrigger>
              <TabsTrigger value="all">全部 ({schedules.length})</TabsTrigger>
            </TabsList>
          </Tabs>
          <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索名称 / 工作流 / cron"
          className="w-full sm:w-64"
          inputClassName="h-9 text-sm"
        />
        </div>
      </div>

      {scopedSchedules.length === 0 ? (
        <GlassCard>
          <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
            <Calendar size={36} className="text-muted-foreground/40" />
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                {scope === "mine" ? "我的工作流还没有定时任务" : "还没有定时任务"}
              </p>
              <p className="max-w-md text-xs text-muted-foreground/80">
                {scope === "mine"
                  ? "只有「工作流 → 我的工作流」里配置了 cron 的副本会出现在这里。内置模板的定时在「全部」页签。"
                  : "此页展示工作流 cron 调度（到点自动启动 mission）。平台级后台任务不在此列表。"}
              </p>
            </div>
            {workflowSuggestions.length > 0 ? (
              <div className="w-full max-w-lg space-y-2 text-left">
                <p className="text-xs font-medium text-muted-foreground">
                  选一个工作流，在详情页「定时任务」页签新建：
                </p>
                <ul className="space-y-1">
                  {workflowSuggestions.map((w) => (
                    <li key={w.id}>
                      <Link
                        href={`/workflows/${w.id}?tab=schedules`}
                        className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-foreground/85 transition-colors hover:bg-muted"
                      >
                        <span className="truncate">{w.name}</span>
                        <span className="shrink-0 text-xs text-sky-600 dark:text-sky-400">
                          去配置
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <Button asChild variant="ghost" className="gap-1.5">
                <Link href="/workflows">
                  去工作流列表
                  <ExternalLink size={14} />
                </Link>
              </Button>
            )}
          </div>
        </GlassCard>
      ) : (
        <GlassCard padding="lg">
          <DataTable
            rows={filtered}
            rowKey={(r) => r.id}
            emptyMessage={
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                没有匹配的定时任务
              </div>
            }
            columns={[
              {
                key: "enabled",
                header: "启用",
                width: "w-16",
                render: (r) => (
                  <div
                    className="flex items-center gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Switch
                      checked={r.enabled}
                      disabled={isPending}
                      onCheckedChange={(v) => handleToggle(r, v)}
                    />
                    {isPending && pendingId === r.id ? (
                      <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                    ) : null}
                  </div>
                ),
              },
              {
                key: "displayName",
                header: "名称",
                width: "200px",
                render: (r) => (
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-sm text-foreground">
                        {r.displayName}
                      </span>
                      <span
                        className={
                          r.templateIsBuiltin
                            ? "shrink-0 rounded px-1 py-0.5 text-[10px] text-muted-foreground"
                            : "shrink-0 rounded px-1 py-0.5 text-[10px] text-sky-600 dark:text-sky-400"
                        }
                      >
                        {r.templateIsBuiltin ? "内置" : "自定义"}
                      </span>
                      {duplicateNames.has(r.displayName) ? (
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                          #{r.id.slice(0, 6)}
                        </span>
                      ) : null}
                    </div>
                    {r.description ? (
                      <div className="truncate text-xs text-muted-foreground">
                        {r.description}
                      </div>
                    ) : null}
                  </div>
                ),
              },
              {
                key: "workflow",
                header: "工作流",
                width: "160px",
                render: (r) =>
                  r.workflowTemplateId ? (
                    <Link
                      href={`/workflows/${r.workflowTemplateId}`}
                      className="inline-flex max-w-full items-center gap-1 truncate text-sm text-sky-600 hover:brightness-110 dark:text-sky-400"
                    >
                      <span className="truncate">
                        {r.templateName ?? "未命名工作流"}
                      </span>
                      <ExternalLink size={12} className="shrink-0 opacity-60" />
                    </Link>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  ),
              },
              {
                key: "schedule",
                header: "执行时间",
                width: "160px",
                render: (r) => (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm text-foreground">
                      {describeCronExpression(r.cronExpression)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {r.timezone}
                    </span>
                  </div>
                ),
              },
              {
                key: "nextRun",
                header: "下次运行",
                width: "140px",
                render: (r) => {
                  const next = resolveNextRun(r);
                  return (
                    <span className="text-xs text-muted-foreground">
                      {r.enabled
                        ? next
                          ? formatDateTime(next.toISOString())
                          : "—"
                        : "已停用"}
                    </span>
                  );
                },
              },
              {
                key: "lastRun",
                header: "上次运行",
                width: "140px",
                render: (r) => (
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(r.lastRunAt)}
                  </span>
                ),
              },
            ]}
          />
        </GlassCard>
      )}
    </div>
  );
}

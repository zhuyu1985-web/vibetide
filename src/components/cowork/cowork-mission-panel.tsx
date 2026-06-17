"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Check,
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
import { appendReturnTo } from "@/lib/navigation-return";
import { CRAFT_META, BUILTIN_SKILL_NAMES, type CraftType } from "@/lib/constants";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import type { MissionTask } from "@/lib/types";

/**
 * cowork 右栏「执行过程」面板 —— 只做步骤清单:把分解好的步骤按执行顺序
 * (priority 升序 = 步骤序)从上到下列出。每步参照设计稿呈现:状态图标
 * (✓ 完成 / ◉ 进行中 / 序号圈 等待)+ 步骤名 + 「执行者 · 状态」副行 +
 * 产物计数 badge,步骤间虚线分隔。每一步的核心概要与最终交付在对话流里
 * 流式呈现(见 MissionStepStream),不在此重复堆详细输出。
 */
export function CoworkMissionPanel({
  missionId,
  onClose,
}: {
  missionId: string | null;
  onClose?: () => void;
}) {
  const { mission, loading } = useMissionLive(missionId);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentHref = useMemo(() => {
    const qs = searchParams.toString();
    return `${pathname}${qs ? `?${qs}` : ""}`;
  }, [pathname, searchParams]);

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

  // priority = 步骤序(leader 伪任务 0、其余 1..N),升序即执行顺序,
  // 与对话流 MissionStepStream / 任务中心控制台保持同一排序。
  const tasks = mission?.tasks
    ? [...mission.tasks].sort(
        (a, b) =>
          (a.priority ?? 0) - (b.priority ?? 0) ||
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )
    : [];
  const doneCount = tasks.filter((t) => t.status === "completed").length;

  return (
    <aside className="flex w-72 flex-none flex-col border-l border-border bg-muted/20">
      {/* 头部 */}
      <div className="border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-xs font-medium">执行过程</span>
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
          {/* 步骤清单(执行顺序从上到下,步骤间虚线分隔) */}
          <div className="px-3 py-1.5">
            {tasks.length === 0 ? (
              <p className="px-1 py-2 text-[11px] text-muted-foreground/70">
                正在拆解执行步骤…
              </p>
            ) : (
              tasks.map((t, i) => (
                <div
                  key={t.id}
                  className={cn(
                    "flex items-start gap-2.5 py-2.5",
                    i > 0 && "border-t border-dashed border-border/70",
                  )}
                >
                  <StepStatusIcon status={t.status} stepNo={i + 1} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-medium leading-snug text-foreground">
                      {t.title}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      {/* 工种头像 + 徽章:体现"哪个工种做了这一步"(看得见的团队协作)。
                          头像用 employee slug —— 工种实例继承旧员工 SVG,历史任务用本人头像。 */}
                      {t.assignedEmployee && (
                        <EmployeeAvatar
                          employeeId={t.assignedEmployee.id}
                          size="xs"
                        />
                      )}
                      <CraftBadge roleType={t.assignedEmployee?.roleType} />
                      <span className="truncate text-[11px] text-muted-foreground">
                        {/* assignedEmployee 由 DAL 按全 org 员工表解析,覆盖
                            leader 伪任务(leader 不在 mission.teamMembers 里) */}
                        {[t.assignedEmployee?.name, taskStatusLabel(t.status)]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      <ArtifactBadge task={t} />
                    </div>
                    {/* 用了什么技能/工具(来自 outputData.usedSkills/usedTools,无则不渲染) */}
                    <SkillToolChips task={t} />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 完整执行详情入口(任务中心富视图) */}
          {mission && (
            <div className="border-t border-border px-2.5 py-2">
              <Link
                href={appendReturnTo(`/missions/${mission.id}`, currentHref)}
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

/**
 * 设计稿样式的步骤状态图标:
 *   完成 = 绿色实心圆白勾;进行中 = 琥珀色环+内心点(pulse);
 *   等待 = 灰圈内步骤序号;失败 = 红;取消/阻塞 = 禁止符。
 */
function StepStatusIcon({
  status,
  stepNo,
}: {
  status: string;
  stepNo: number;
}) {
  if (status === "completed")
    return (
      <span className="mt-0.5 flex size-5 flex-none items-center justify-center rounded-full bg-emerald-500 text-white">
        <Check className="size-3" strokeWidth={3} />
      </span>
    );
  if (status === "in_progress" || status === "in_review" || status === "claimed")
    return (
      <span className="mt-0.5 flex size-5 flex-none animate-pulse items-center justify-center rounded-full border-2 border-amber-500">
        <span className="size-2 rounded-full bg-amber-500" />
      </span>
    );
  if (status === "failed")
    return (
      <span className="mt-0.5 flex size-5 flex-none items-center justify-center">
        <XCircle className="size-5 text-red-500" />
      </span>
    );
  if (status === "cancelled" || status === "blocked")
    return (
      <span className="mt-0.5 flex size-5 flex-none items-center justify-center">
        <Ban className="size-4 text-muted-foreground/50" />
      </span>
    );
  // pending / ready —— 灰圈内显示步骤序号
  return (
    <span className="mt-0.5 flex size-5 flex-none items-center justify-center rounded-full border border-border bg-muted text-[10px] font-medium text-muted-foreground">
      {stepNo}
    </span>
  );
}

/**
 * 工种徽章 —— 把 assignedEmployee.roleType(工种 slug)映射成中文工种名 + 配色,
 * 让用户看清"这一步由哪个工种做"。历史/旧员工 roleType 不在 CRAFT_META 时不渲染。
 */
function CraftBadge({ roleType }: { roleType?: string }) {
  if (!roleType || !(roleType in CRAFT_META)) return null;
  const meta = CRAFT_META[roleType as CraftType];
  return (
    <span
      className="flex-none rounded px-1 py-px text-[10px] font-medium"
      style={{ color: meta.color, backgroundColor: meta.bgColor }}
    >
      {meta.name}
    </span>
  );
}

/**
 * "用了什么技能/工具" chips —— 来自执行期回写的 outputData.usedSkills(专业技能,
 * 实心)/ usedTools(通用工具,描边)。无数据则不渲染(优雅降级)。
 */
function SkillToolChips({ task }: { task: MissionTask }) {
  const od = task.outputData as
    | { usedSkills?: string[]; usedTools?: string[] }
    | null;
  const skills = Array.isArray(od?.usedSkills) ? od.usedSkills : [];
  const tools = Array.isArray(od?.usedTools) ? od.usedTools : [];
  if (skills.length === 0 && tools.length === 0) return null;
  const label = (slug: string) => BUILTIN_SKILL_NAMES[slug] ?? slug;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {skills.map((s) => (
        <span
          key={`s-${s}`}
          className="rounded bg-primary/10 px-1 py-px text-[10px] text-primary"
        >
          {label(s)}
        </span>
      ))}
      {tools.map((t) => (
        <span
          key={`t-${t}`}
          className="rounded border border-border px-1 py-px text-[10px] text-muted-foreground"
        >
          {label(t)}
        </span>
      ))}
    </div>
  );
}

/** 完成步骤的产物计数 badge(outputData.artifacts 非空时展示) */
function ArtifactBadge({ task }: { task: MissionTask }) {
  if (task.status !== "completed") return null;
  const od = task.outputData as
    | { artifacts?: Array<{ content?: string }> }
    | null;
  const count = Array.isArray(od?.artifacts)
    ? od.artifacts.filter(
        (a) => typeof a?.content === "string" && a.content.trim(),
      ).length
    : 0;
  if (count === 0) return null;
  return (
    <span className="flex-none rounded border border-amber-300/60 bg-amber-50 px-1 py-px text-[10px] text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
      产物 ×{count}
    </span>
  );
}

function taskStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: "等待上一步",
    ready: "等待执行",
    claimed: "进行中",
    in_progress: "进行中",
    in_review: "审核中",
    completed: "完成",
    failed: "失败",
    cancelled: "已取消",
    blocked: "已阻塞",
  };
  return map[status] ?? status;
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

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/shared/glass-card";
import { PageHeader } from "@/components/shared/page-header";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Filter,
  Zap,
  Timer,
  CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { approveWorkflowStep, batchApproveWorkflowSteps } from "@/app/actions/workflow-engine";
import { AUTO_SCENARIO_TEMPLATES, WORKFLOW_STEPS } from "@/lib/constants";
import type { EmployeeId } from "@/lib/constants";
import type {
  PendingApproval,
  ApprovalStats,
  ApprovalHistoryItem,
} from "@/lib/dal/approvals";
import type { Team } from "@/lib/types";

interface ApprovalsClientProps {
  pending: PendingApproval[];
  stats: ApprovalStats;
  history: ApprovalHistoryItem[];
  teams: Team[];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  const days = Math.floor(hours / 24);
  return `${days}天前`;
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
}) {
  return (
    <GlassCard padding="md">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center",
            color
          )}
        >
          <Icon size={20} className="text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        </div>
      </div>
    </GlassCard>
  );
}

export function ApprovalsClient({
  pending,
  stats,
  history,
  teams,
}: ApprovalsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [feedbackMap, setFeedbackMap] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredPending =
    teamFilter === "all"
      ? pending
      : pending.filter((p) => p.teamId === teamFilter);

  function handleApprove(item: PendingApproval) {
    startTransition(async () => {
      await approveWorkflowStep({
        workflowInstanceId: item.workflowInstanceId,
        stepId: item.stepId,
        approved: true,
        feedback: feedbackMap[item.stepId] || undefined,
      });
      router.refresh();
    });
  }

  function handleReject(item: PendingApproval) {
    startTransition(async () => {
      await approveWorkflowStep({
        workflowInstanceId: item.workflowInstanceId,
        stepId: item.stepId,
        approved: false,
        feedback: feedbackMap[item.stepId] || "审批驳回",
      });
      router.refresh();
    });
  }

  function handleBatchApprove() {
    const items = filteredPending
      .filter((p) => selectedIds.has(p.stepId))
      .map((p) => ({
        workflowInstanceId: p.workflowInstanceId,
        stepId: p.stepId,
        approved: true,
        feedback: feedbackMap[p.stepId] || undefined,
      }));

    if (items.length === 0) return;

    startTransition(async () => {
      await batchApproveWorkflowSteps({ items });
      setSelectedIds(new Set());
      router.refresh();
    });
  }

  function toggleSelect(stepId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredPending.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPending.map((p) => p.stepId)));
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader
        title="审批中心"
        description="集中管理所有工作流步骤的审批请求"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          label="待审批"
          value={stats.pending}
          icon={Clock}
          color="bg-amber-500"
        />
        <StatCard
          label="今日通过"
          value={stats.approvedToday}
          icon={ThumbsUp}
          color="bg-green-500"
        />
        <StatCard
          label="今日驳回"
          value={stats.rejectedToday}
          icon={ThumbsDown}
          color="bg-red-500"
        />
        <StatCard
          label="超时"
          value={stats.timedOut}
          icon={AlertTriangle}
          color="bg-orange-500"
        />
      </div>

      {/* Pending Approvals */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">待审批列表</h2>
            <Badge variant="secondary" className="text-xs">
              {filteredPending.length} 项
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            {selectedIds.size > 0 && (
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={handleBatchApprove}
                disabled={isPending}
              >
                <CheckCircle size={14} className="mr-1" />
                批量通过 ({selectedIds.size})
              </Button>
            )}
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="h-8 w-[160px] text-xs glass-input">
                <Filter size={12} className="mr-1" />
                <SelectValue placeholder="按团队筛选" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部团队</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {filteredPending.length === 0 ? (
          <GlassCard padding="lg">
            <div className="text-center py-8">
              <CheckCircle
                size={48}
                className="mx-auto mb-3 text-green-400"
              />
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                当前没有待审批的工作流步骤
              </p>
            </div>
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {/* Select All */}
            <div className="flex items-center gap-2 px-1">
              <input
                type="checkbox"
                checked={
                  selectedIds.size === filteredPending.length &&
                  filteredPending.length > 0
                }
                onChange={toggleSelectAll}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">全选</span>
            </div>

            {filteredPending.map((item) => (
              <GlassCard
                key={item.stepId}
                variant="interactive"
                padding="md"
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.stepId)}
                    onChange={() => toggleSelect(item.stepId)}
                    className="mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  {item.employeeSlug && (
                    <EmployeeAvatar
                      employeeId={item.employeeSlug as EmployeeId}
                      size="sm"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {item.workflowName}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {item.stepLabel}
                      </Badge>
                      {item.teamName && (
                        <Badge variant="secondary" className="text-[10px]">
                          {item.teamName}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-2">
                      {item.employeeNickname && (
                        <span>执行者: {item.employeeNickname}</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Timer size={11} />
                        {timeAgo(item.createdAt)}
                      </span>
                    </div>
                    {item.outputPreview && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50/80 dark:bg-gray-800/50 rounded-lg p-2 mb-2 line-clamp-3">
                        {item.outputPreview}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="审批意见（可选）"
                        value={feedbackMap[item.stepId] || ""}
                        onChange={(e) =>
                          setFeedbackMap((prev) => ({
                            ...prev,
                            [item.stepId]: e.target.value,
                          }))
                        }
                        className="flex-1 h-7 text-xs px-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/60 focus:outline-none focus:border-blue-300 dark:text-gray-200"
                      />
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-green-600 hover:bg-green-700"
                        onClick={() => handleApprove(item)}
                        disabled={isPending}
                      >
                        <CheckCircle size={12} className="mr-1" />
                        通过
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs"
                        onClick={() => handleReject(item)}
                        disabled={isPending}
                      >
                        <XCircle size={12} className="mr-1" />
                        驳回
                      </Button>
                    </div>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      {/* Auto Scenario Templates */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={18} className="text-amber-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            全自动场景模板
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">M4.F135</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(AUTO_SCENARIO_TEMPLATES).map(([key, tpl]) => (
            <GlassCard key={key} variant="interactive" padding="md">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {tpl.name}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {tpl.description}
                  </p>
                </div>
                {tpl.approvalRequired ? (
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    需审批
                  </Badge>
                ) : (
                  <Badge className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 shrink-0">
                    全自动
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                {tpl.steps.map((stepKey, idx) => {
                  const stepMeta = WORKFLOW_STEPS.find(
                    (s) => s.key === stepKey
                  );
                  return (
                    <div key={stepKey} className="flex items-center gap-1">
                      {idx > 0 && (
                        <span className="text-gray-300 dark:text-gray-600 text-xs">→</span>
                      )}
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400">
                        {stepMeta?.label || stepKey}
                      </span>
                    </div>
                  );
                })}
              </div>
              {tpl.cron && (
                <div className="flex items-center gap-1 mt-2 text-xs text-gray-400 dark:text-gray-500">
                  <CalendarClock size={11} />
                  <span>定时: {tpl.cron}</span>
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      </div>

      {/* Approval History */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            审批历史
          </h2>
          <Badge variant="secondary" className="text-xs">
            最近 {history.length} 条
          </Badge>
        </div>

        {history.length === 0 ? (
          <GlassCard padding="md">
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              暂无审批记录
            </p>
          </GlassCard>
        ) : (
          <GlassCard padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700/50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                      工作流
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                      步骤
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                      执行者
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                      团队
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                      状态
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                      完成时间
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr
                      key={item.stepId}
                      className="border-b border-gray-50 dark:border-gray-800 hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-colors"
                    >
                      <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                        {item.workflowName}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {item.stepLabel}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {item.employeeSlug && (
                            <EmployeeAvatar
                              employeeId={item.employeeSlug as EmployeeId}
                              size="xs"
                            />
                          )}
                          <span className="text-gray-600 dark:text-gray-400">
                            {item.employeeNickname || "-"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {item.teamName || "-"}
                      </td>
                      <td className="px-4 py-3">
                        {item.status === "completed" ? (
                          <Badge className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                            已通过
                          </Badge>
                        ) : (
                          <Badge className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                            已驳回
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500">
                        {item.completedAt
                          ? timeAgo(item.completedAt)
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        )}
      </div>
    </div>
  );
}

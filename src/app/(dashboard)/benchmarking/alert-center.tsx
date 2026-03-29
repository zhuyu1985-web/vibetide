"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatCard } from "@/components/shared/stat-card";
import { GlassCard } from "@/components/shared/glass-card";
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  Eye,
  XCircle,
} from "lucide-react";
import {
  acknowledgeAlert,
  actionAlert,
  dismissAlert,
} from "@/app/actions/benchmarking";
import type {
  BenchmarkAlertUI,
  AlertPriority,
  AlertType,
  AlertStatus,
} from "@/lib/types";

interface AlertCenterProps {
  alerts: BenchmarkAlertUI[];
  alertStats: {
    total: number;
    urgent: number;
    high: number;
    new: number;
    actioned: number;
  };
}

const priorityLabels: Record<AlertPriority, string> = {
  urgent: "紧急",
  high: "高",
  medium: "中",
  low: "低",
};

const priorityColors: Record<AlertPriority, string> = {
  urgent: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const priorityBorderColors: Record<AlertPriority, string> = {
  urgent: "border-l-red-500",
  high: "border-l-orange-500",
  medium: "border-l-blue-500",
  low: "border-l-gray-400",
};

const typeLabels: Record<AlertType, string> = {
  missed_topic: "漏报选题",
  competitor_highlight: "竞品亮点",
  gap_warning: "差距预警",
  trend_alert: "趋势提醒",
};

const typeColors: Record<AlertType, string> = {
  missed_topic: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  competitor_highlight: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  gap_warning: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
  trend_alert: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
};

const statusLabels: Record<AlertStatus, string> = {
  new: "新",
  acknowledged: "已读",
  actioned: "已跟进",
  dismissed: "已忽略",
};

export function AlertCenter({ alerts, alertStats }: AlertCenterProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const mediumCount =
    alertStats.total - alertStats.urgent - alertStats.high - alertStats.new;
  const lowCount = Math.max(0, mediumCount);

  const filteredAlerts = alerts.filter((alert) => {
    if (typeFilter !== "all" && alert.type !== typeFilter) return false;
    if (priorityFilter !== "all" && alert.priority !== priorityFilter)
      return false;
    if (statusFilter !== "all" && alert.status !== statusFilter) return false;
    return true;
  });

  function handleAction(alertId: string) {
    const alert = alerts.find((a) => a.id === alertId);
    startTransition(async () => {
      await actionAlert(alertId, {});
    });
    // Navigate to super-creation with pre-filled topic info
    const topic = alert?.title.replace("漏题预警：", "") || "";
    const params = new URLSearchParams({ topic, source: "benchmarking" });
    router.push(`/super-creation?${params.toString()}`);
  }

  function handleAcknowledge(alertId: string) {
    startTransition(async () => {
      await acknowledgeAlert(alertId);
    });
  }

  function handleDismiss(alertId: string) {
    startTransition(async () => {
      await dismissAlert(alertId);
    });
  }

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="紧急"
          value={alertStats.urgent}
          icon={<AlertTriangle className="size-4" />}
        />
        <StatCard
          label="高"
          value={alertStats.high}
          icon={<ArrowUpRight className="size-4" />}
        />
        <StatCard
          label="新增"
          value={alertStats.new}
          icon={<Bell className="size-4" />}
        />
        <StatCard
          label="已跟进"
          value={alertStats.actioned}
          icon={<CheckCircle2 className="size-4" />}
        />
      </div>

      {/* Filter bar */}
      <GlassCard padding="sm">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            筛选
          </span>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger size="sm">
              <SelectValue placeholder="类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              <SelectItem value="missed_topic">漏报选题</SelectItem>
              <SelectItem value="competitor_highlight">竞品亮点</SelectItem>
              <SelectItem value="gap_warning">差距预警</SelectItem>
              <SelectItem value="trend_alert">趋势提醒</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger size="sm">
              <SelectValue placeholder="优先级" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部优先级</SelectItem>
              <SelectItem value="urgent">紧急</SelectItem>
              <SelectItem value="high">高</SelectItem>
              <SelectItem value="medium">中</SelectItem>
              <SelectItem value="low">低</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger size="sm">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="new">新</SelectItem>
              <SelectItem value="acknowledged">已读</SelectItem>
              <SelectItem value="actioned">已跟进</SelectItem>
              <SelectItem value="dismissed">已忽略</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </GlassCard>

      {/* Alert list */}
      <ScrollArea className="h-[520px]">
        <div className="space-y-3">
          {filteredAlerts.length === 0 && (
            <GlassCard>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                暂无匹配的预警信息
              </p>
            </GlassCard>
          )}
          {filteredAlerts.map((alert) => (
            <GlassCard key={alert.id} padding="none">
              <div
                className={`border-l-4 ${priorityBorderColors[alert.priority]} rounded-lg p-4`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">
                    {alert.title}
                  </h4>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge
                      variant="secondary"
                      className={priorityColors[alert.priority]}
                    >
                      {priorityLabels[alert.priority]}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={typeColors[alert.type]}
                    >
                      {typeLabels[alert.type]}
                    </Badge>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                  {alert.description}
                </p>

                {/* Suggested action */}
                {alert.analysisData.suggestedAction && (
                  <div className="text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 rounded px-2.5 py-1.5 mb-3">
                    <span className="font-medium">建议操作：</span>
                    {alert.analysisData.suggestedAction}
                  </div>
                )}

                {/* Status + timestamp */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                    <Badge variant="secondary" className="text-[10px]">
                      {statusLabels[alert.status]}
                    </Badge>
                    <span>{new Date(alert.createdAt).toLocaleString("zh-CN")}</span>
                  </div>

                  {/* Action buttons - no borders */}
                  <div className="flex items-center gap-1">
                    {alert.status !== "actioned" && (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleAction(alert.id)}
                        disabled={isPending}
                      >
                        <ArrowUpRight className="size-3" />
                        发起跟进
                      </Button>
                    )}
                    {alert.status === "new" && (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleAcknowledge(alert.id)}
                        disabled={isPending}
                      >
                        <Eye className="size-3" />
                        标记已读
                      </Button>
                    )}
                    {alert.status !== "dismissed" && (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => handleDismiss(alert.id)}
                        disabled={isPending}
                      >
                        <XCircle className="size-3" />
                        忽略
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { StatCard } from "@/components/shared/stat-card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Shield,
  FileSearch,
  Filter,
  CheckCheck,
  Clock,
  Eye,
} from "lucide-react";
import { updateReviewStatus } from "@/app/actions/reviews";
import { runComplianceCheck } from "@/app/actions/compliance";
import type { ReviewResult } from "@/lib/types";

interface ComplianceHistoryItem {
  id: string;
  contentId: string | null;
  contentType: string | null;
  content: string;
  issues: {
    type: string;
    severity: "info" | "warning" | "critical";
    location: string;
    description: string;
    suggestion: string;
  }[];
  isClean: boolean;
  checkedAt: string;
}

interface BatchReviewClientProps {
  reviews: ReviewResult[];
  complianceHistory: ComplianceHistoryItem[];
}

const severityColors: Record<string, string> = {
  high: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200",
  medium: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200",
  low: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700",
  critical: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200",
  warning: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200",
  info: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-700/50",
};

const statusConfig: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  pending: {
    label: "待审核",
    color: "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-100",
    icon: <Clock size={12} />,
  },
  approved: {
    label: "已通过",
    color: "bg-green-50 dark:bg-green-950/50 text-green-600 dark:text-green-400 border-green-100",
    icon: <CheckCircle size={12} />,
  },
  rejected: {
    label: "已驳回",
    color: "bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border-red-100",
    icon: <XCircle size={12} />,
  },
  escalated: {
    label: "已升级",
    color: "bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 border-purple-100",
    icon: <AlertTriangle size={12} />,
  },
};

export function BatchReviewClient({
  reviews,
  complianceHistory,
}: BatchReviewClientProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("pending");
  const [isPending, startTransition] = useTransition();
  const [complianceText, setComplianceText] = useState("");
  const [complianceResult, setComplianceResult] = useState<{
    issues: { type: string; severity: string; location: string; description: string; suggestion: string }[];
    isClean: boolean;
  } | null>(null);

  // Filter reviews
  const filteredReviews = reviews.filter((r) => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (filterSeverity !== "all") {
      const hasMatchingSeverity = r.issues.some(
        (issue) => issue.severity === filterSeverity
      );
      if (!hasMatchingSeverity && r.issues.length > 0) return false;
    }
    return true;
  });

  // Stats
  const pendingCount = reviews.filter((r) => r.status === "pending").length;
  const approvedCount = reviews.filter((r) => r.status === "approved").length;
  const rejectedCount = reviews.filter((r) => r.status === "rejected").length;
  const escalatedCount = reviews.filter((r) => r.status === "escalated").length;

  // Total issues by severity
  const highIssues = reviews
    .flatMap((r) => r.issues)
    .filter((i) => i.severity === "high").length;
  const mediumIssues = reviews
    .flatMap((r) => r.issues)
    .filter((i) => i.severity === "medium").length;

  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredReviews.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredReviews.map((r) => r.id)));
    }
  };

  // Bulk actions
  const handleBulkApprove = () => {
    startTransition(async () => {
      for (const id of selectedIds) {
        await updateReviewStatus(id, "approved");
      }
      setSelectedIds(new Set());
    });
  };

  const handleBulkReject = () => {
    startTransition(async () => {
      for (const id of selectedIds) {
        await updateReviewStatus(id, "rejected");
      }
      setSelectedIds(new Set());
    });
  };

  const handleComplianceCheck = () => {
    if (!complianceText.trim()) return;
    startTransition(async () => {
      const result = await runComplianceCheck(complianceText);
      setComplianceResult(result);
    });
  };

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader
        title="批量审核看板"
        description="统一审核管理 · 批量操作 · 实时合规检查"
      />

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        <StatCard
          label="待审核"
          value={pendingCount}
          suffix="条"
          icon={<Clock size={18} />}
        />
        <StatCard
          label="已通过"
          value={approvedCount}
          suffix="条"
          icon={<CheckCircle size={18} />}
        />
        <StatCard
          label="已驳回"
          value={rejectedCount}
          suffix="条"
          icon={<XCircle size={18} />}
        />
        <StatCard
          label="已升级"
          value={escalatedCount}
          suffix="条"
          icon={<AlertTriangle size={18} />}
        />
        <StatCard
          label="高危问题"
          value={highIssues}
          suffix="个"
          icon={<Shield size={18} />}
        />
        <StatCard
          label="中危问题"
          value={mediumIssues}
          suffix="个"
          icon={<AlertTriangle size={18} />}
        />
      </div>

      <Tabs defaultValue="review" className="w-full">
        <TabsList>
          <TabsTrigger value="review">
            <FileSearch size={14} className="mr-1" />
            批量审核
          </TabsTrigger>
          <TabsTrigger value="compliance">
            <Shield size={14} className="mr-1" />
            实时合规检查
          </TabsTrigger>
        </TabsList>

        {/* ====== Tab 1: 批量审核 ====== */}
        <TabsContent value="review">
          {/* Filters and bulk actions */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <Filter size={14} className="text-gray-400 dark:text-gray-500" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="all">全部状态</option>
                <option value="pending">待审核</option>
                <option value="approved">已通过</option>
                <option value="rejected">已驳回</option>
                <option value="escalated">已升级</option>
              </select>

              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
              >
                <option value="all">全部严重度</option>
                <option value="high">高危</option>
                <option value="medium">中危</option>
                <option value="low">低危</option>
              </select>

              <Badge variant="outline" className="text-xs">
                共 {filteredReviews.length} 条
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={selectAll}
                className="text-xs h-8"
              >
                <CheckCheck size={14} className="mr-1" />
                {selectedIds.size === filteredReviews.length &&
                filteredReviews.length > 0
                  ? "取消全选"
                  : "全选"}
              </Button>

              {selectedIds.size > 0 && (
                <>
                  <Badge variant="secondary" className="text-xs">
                    已选 {selectedIds.size} 项
                  </Badge>
                  <Button
                    size="sm"
                    onClick={handleBulkApprove}
                    disabled={isPending}
                    className="text-xs h-8 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle size={14} className="mr-1" />
                    批量通过
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleBulkReject}
                    disabled={isPending}
                    className="text-xs h-8"
                  >
                    <XCircle size={14} className="mr-1" />
                    批量驳回
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Review items list */}
          <div className="space-y-3">
            {filteredReviews.length === 0 && (
              <GlassCard>
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                  暂无符合条件的审核记录
                </p>
              </GlassCard>
            )}

            {filteredReviews.map((review) => {
              const status = statusConfig[review.status] || statusConfig.pending;
              const maxSeverity = review.issues.length > 0
                ? review.issues.reduce(
                    (max, issue) =>
                      issue.severity === "high"
                        ? "high"
                        : max === "high"
                        ? "high"
                        : issue.severity === "medium"
                        ? "medium"
                        : max,
                    "low" as string
                  )
                : null;

              return (
                <GlassCard
                  key={review.id}
                  variant="interactive"
                  padding="sm"
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <div className="pt-1">
                      <Checkbox
                        checked={selectedIds.has(review.id)}
                        onCheckedChange={() => toggleSelect(review.id)}
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                          {review.contentId}
                        </h4>
                        <Badge variant="outline" className="text-[10px]">
                          {review.contentType}
                        </Badge>
                        {maxSeverity && (
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${severityColors[maxSeverity]}`}
                          >
                            {maxSeverity === "high"
                              ? "高危"
                              : maxSeverity === "medium"
                              ? "中危"
                              : "低危"}
                          </span>
                        )}
                      </div>

                      {/* Issues preview */}
                      {review.issues.length > 0 && (
                        <div className="space-y-1 mb-2">
                          {review.issues.slice(0, 3).map((issue, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 text-xs"
                            >
                              <span
                                className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] border shrink-0 ${
                                  severityColors[issue.severity]
                                }`}
                              >
                                {issue.severity === "high"
                                  ? "高"
                                  : issue.severity === "medium"
                                  ? "中"
                                  : "低"}
                              </span>
                              <span className="text-gray-600 dark:text-gray-400 truncate">
                                [{issue.type}] {issue.description}
                              </span>
                            </div>
                          ))}
                          {review.issues.length > 3 && (
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 pl-5">
                              还有 {review.issues.length - 3} 个问题...
                            </p>
                          )}
                        </div>
                      )}

                      {review.issues.length === 0 && (
                        <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 mb-2">
                          <CheckCircle size={12} />
                          未发现问题
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span>
                          审核员: {review.reviewerName || "AI"}
                        </span>
                        <span>
                          评分: {review.score ?? "-"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {new Date(review.createdAt).toLocaleString("zh-CN")}
                        </span>
                      </div>
                    </div>

                    {/* Status + Actions */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${status.color}`}
                      >
                        {status.icon}
                        {status.label}
                      </span>

                      {review.status === "pending" && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            className="text-xs h-7 px-2 bg-green-600 hover:bg-green-700"
                            disabled={isPending}
                            onClick={() =>
                              startTransition(() =>
                                updateReviewStatus(review.id, "approved")
                              )
                            }
                          >
                            <CheckCircle size={12} className="mr-0.5" />
                            通过
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="text-xs h-7 px-2"
                            disabled={isPending}
                            onClick={() =>
                              startTransition(() =>
                                updateReviewStatus(review.id, "rejected")
                              )
                            }
                          >
                            <XCircle size={12} className="mr-0.5" />
                            驳回
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </TabsContent>

        {/* ====== Tab 2: 实时合规检查 ====== */}
        <TabsContent value="compliance">
          <div className="grid grid-cols-12 gap-5">
            {/* Left: Compliance check tool */}
            <div className="col-span-7 space-y-4">
              <GlassCard>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Shield size={16} className="text-blue-500" />
                  内容合规检测
                </h3>
                <textarea
                  value={complianceText}
                  onChange={(e) => setComplianceText(e.target.value)}
                  placeholder="在此粘贴或输入需要检测的内容文本..."
                  className="w-full h-40 text-sm border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white/50 dark:bg-gray-900/60 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
                />
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {complianceText.length} 字
                  </span>
                  <Button
                    onClick={handleComplianceCheck}
                    disabled={isPending || !complianceText.trim()}
                    size="sm"
                  >
                    <Eye size={14} className="mr-1" />
                    开始检测
                  </Button>
                </div>
              </GlassCard>

              {/* Check result */}
              {complianceResult && (
                <GlassCard>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                      检测结果
                    </h4>
                    {complianceResult.isClean ? (
                      <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200">
                        <CheckCircle size={12} className="mr-1" />
                        内容合规
                      </Badge>
                    ) : (
                      <Badge className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200">
                        <AlertTriangle size={12} className="mr-1" />
                        发现 {complianceResult.issues.length} 个问题
                      </Badge>
                    )}
                  </div>

                  {complianceResult.issues.length > 0 ? (
                    <div className="space-y-2">
                      {complianceResult.issues.map((issue, i) => (
                        <div
                          key={i}
                          className="border border-gray-100 dark:border-gray-700/50 rounded-lg p-3 bg-white/50 dark:bg-gray-900/60"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                severityColors[issue.severity]
                              }`}
                            >
                              {issue.severity === "critical"
                                ? "严重"
                                : issue.severity === "warning"
                                ? "警告"
                                : "提示"}
                            </span>
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                              [{issue.type}]
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                            {issue.description}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            位置: {issue.location}
                          </p>
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            建议: {issue.suggestion}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2 py-4 justify-center">
                      <CheckCircle size={16} />
                      未检测到敏感内容，内容合规
                    </p>
                  )}
                </GlassCard>
              )}
            </div>

            {/* Right: Compliance history */}
            <div className="col-span-5 space-y-4">
              <GlassCard>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Clock size={16} className="text-gray-400" />
                  检测历史
                </h3>
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {complianceHistory.length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
                      暂无检测记录
                    </p>
                  )}
                  {complianceHistory.map((item) => (
                    <div
                      key={item.id}
                      className="border border-gray-100 dark:border-gray-700/50 rounded-lg p-2.5 bg-white/30 dark:bg-gray-900/30"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(item.checkedAt).toLocaleString("zh-CN")}
                        </span>
                        {item.isClean ? (
                          <span className="text-[10px] text-green-600 dark:text-green-400 flex items-center gap-0.5">
                            <CheckCircle size={10} />
                            合规
                          </span>
                        ) : (
                          <span className="text-[10px] text-red-600 dark:text-red-400 flex items-center gap-0.5">
                            <AlertTriangle size={10} />
                            {item.issues.length} 个问题
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        {item.content}
                      </p>
                      {item.contentType && (
                        <Badge
                          variant="outline"
                          className="text-[9px] mt-1"
                        >
                          {item.contentType}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

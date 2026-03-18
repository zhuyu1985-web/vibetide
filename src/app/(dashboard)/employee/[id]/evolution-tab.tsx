"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import {
  ThumbsUp,
  ThumbsDown,
  Pencil,
  Trash2,
  TrendingUp,
  Brain,
  MessageSquare,
  BarChart3,
  Eye,
  Heart,
  Share2,
  MessageCircle,
} from "lucide-react";
import { deleteLearnedPattern } from "@/app/actions/evolution";
import { triggerLearningFromFeedback } from "@/app/actions/learning";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EvolutionTabProps {
  employeeId: string;
  feedbackStats: {
    accepts: number;
    rejects: number;
    edits: number;
    rate: number;
  };
  patterns: Array<{
    key: string;
    count: number;
    lastSeen: string;
    source: string;
    confidence: "high" | "medium" | "low";
  }>;
  evolutionData: Array<{
    date: string;
    memories: number;
    patterns: number;
    acceptRate: number;
  }>;
  attributions: Array<{
    id: string;
    reach: Record<string, number> | null;
    engagement: Record<string, number> | null;
    qualityScore: Record<string, number> | null;
    attributedAt: string;
  }>;
}

// ---------------------------------------------------------------------------
// Confidence badge helper
// ---------------------------------------------------------------------------

function ConfidenceBadge({
  confidence,
}: {
  confidence: "high" | "medium" | "low";
}) {
  const config = {
    high: { label: "高", className: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" },
    medium: { label: "中", className: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" },
    low: { label: "低", className: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400" },
  };
  const c = config[confidence];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        c.className
      )}
    >
      {c.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Source label helper
// ---------------------------------------------------------------------------

function sourceLabel(source: string) {
  const map: Record<string, string> = {
    human_feedback: "用户反馈",
    quality_review: "质量审核",
    self_reflection: "自我反思",
  };
  return map[source] || source;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EvolutionTab({
  employeeId,
  feedbackStats,
  patterns: initialPatterns,
  evolutionData,
  attributions,
}: EvolutionTabProps) {
  const [patterns, setPatterns] = useState(initialPatterns);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [timeRange, setTimeRange] = useState<7 | 30 | 90>(30);
  const [learningTriggered, setLearningTriggered] = useState(false);

  // Filter evolution data by selected time range
  const filteredEvolution = evolutionData.slice(-timeRange);

  // Feedback distribution for bar chart
  const feedbackDistribution = [
    { name: "采纳", value: feedbackStats.accepts, fill: "#10b981" },
    { name: "拒绝", value: feedbackStats.rejects, fill: "#ef4444" },
    { name: "编辑", value: feedbackStats.edits, fill: "#f59e0b" },
  ];

  const totalFeedback =
    feedbackStats.accepts + feedbackStats.rejects + feedbackStats.edits;

  // Delete pattern handler
  function handleDeletePattern(patternKey: string) {
    startTransition(async () => {
      try {
        await deleteLearnedPattern(employeeId, patternKey);
        setPatterns((prev) => prev.filter((p) => p.key !== patternKey));
      } catch (err) {
        console.error("Failed to delete pattern:", err);
      }
      setDeleteTarget(null);
    });
  }

  return (
    <div className="space-y-6">
      {/* ================================================================= */}
      {/* Section 1: Feedback Stats (M4.F144) */}
      {/* ================================================================= */}
      <div>
        <h3 className="mb-3 text-base font-semibold text-gray-800 dark:text-gray-100">
          反馈统计
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <GlassCard className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
              <ThumbsUp className="size-4 text-emerald-500" />
              采纳率
            </div>
            <span className="text-2xl font-bold text-emerald-600">
              {feedbackStats.rate}%
            </span>
          </GlassCard>
          <GlassCard className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
              <MessageSquare className="size-4 text-blue-500" />
              总反馈数
            </div>
            <span className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              {totalFeedback}
            </span>
          </GlassCard>
          <GlassCard className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
              <Pencil className="size-4 text-amber-500" />
              编辑次数
            </div>
            <span className="text-2xl font-bold text-amber-600">
              {feedbackStats.edits}
            </span>
          </GlassCard>
        </div>

        {/* Mini bar chart */}
        {totalFeedback > 0 && (
          <GlassCard className="mt-4">
            <p className="mb-2 text-xs font-medium text-gray-500 dark:text-gray-400">
              反馈分布
            </p>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={feedbackDistribution} layout="vertical">
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f0f0f0"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "#6b7280" }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(255,255,255,0.95)",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>
        )}
      </div>

      {/* ================================================================= */}
      {/* Section 2: Learned Patterns (M4.F148 + M4.F149) */}
      {/* ================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
            <span className="inline-flex items-center gap-1.5">
              <Brain className="size-4 text-purple-500" />
              已学习模式
            </span>
            <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">
              ({patterns.length})
            </span>
          </h3>
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            disabled={learningTriggered}
            onClick={() => {
              setLearningTriggered(true);
              startTransition(async () => {
                try {
                  await triggerLearningFromFeedback(employeeId);
                } catch (err) {
                  console.error("Learning trigger failed:", err);
                } finally {
                  setLearningTriggered(false);
                }
              });
            }}
          >
            {learningTriggered ? (
              <Brain className="size-3.5 mr-1 animate-pulse" />
            ) : (
              <Brain className="size-3.5 mr-1" />
            )}
            触发学习
          </Button>
        </div>

        {patterns.length === 0 ? (
          <GlassCard>
            <p className="text-center text-sm text-gray-400 dark:text-gray-500">
              暂无已学习模式
            </p>
          </GlassCard>
        ) : (
          <div className="space-y-2">
            {patterns.map((p) => (
              <GlassCard
                key={p.key}
                variant="interactive"
                padding="sm"
                className="flex items-center justify-between"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-800 dark:text-gray-100 truncate">
                      {p.key}
                    </span>
                    <ConfidenceBadge confidence={p.confidence} />
                    <Badge variant="secondary" className="text-[10px]">
                      {sourceLabel(p.source)}
                    </Badge>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                    <span>频次: {p.count}</span>
                    <span>
                      最近:{" "}
                      {new Date(p.lastSeen).toLocaleDateString("zh-CN")}
                    </span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="shrink-0 text-gray-400 hover:text-red-500"
                  onClick={() => setDeleteTarget(p.key)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </GlassCard>
            ))}
          </div>
        )}

        {/* Delete confirmation dialog */}
        <Dialog
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>删除已学习模式</DialogTitle>
              <DialogDescription>
                确定要删除模式「{deleteTarget}」吗？该操作不可撤销，AI
                员工将不再使用此模式指导输出。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={isPending}>
                  取消
                </Button>
              </DialogClose>
              <Button
                variant="destructive"
                disabled={isPending}
                onClick={() => {
                  if (deleteTarget) handleDeletePattern(deleteTarget);
                }}
              >
                {isPending ? "删除中..." : "确认删除"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* ================================================================= */}
      {/* Section 3: Evolution Curve (M4.F151) */}
      {/* ================================================================= */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
            <span className="inline-flex items-center gap-1.5">
              <TrendingUp className="size-4 text-blue-500" />
              进化曲线
            </span>
          </h3>
          <div className="flex gap-1">
            {([7, 30, 90] as const).map((d) => (
              <Button
                key={d}
                variant={timeRange === d ? "default" : "ghost"}
                size="xs"
                onClick={() => setTimeRange(d)}
              >
                {d}天
              </Button>
            ))}
          </div>
        </div>

        <GlassCard>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={filteredEvolution}>
              <defs>
                <linearGradient
                  id="gradMemory"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient
                  id="gradPattern"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient
                  id="gradAccept"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: string) => v.slice(5)} // MM-DD
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(255,255,255,0.95)",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                labelFormatter={(v) => String(v)}
              />
              <Legend
                iconType="circle"
                wrapperStyle={{ fontSize: "12px" }}
              />
              <Area
                name="记忆数"
                type="monotone"
                dataKey="memories"
                stroke="#8b5cf6"
                strokeWidth={2}
                fill="url(#gradMemory)"
              />
              <Area
                name="模式数"
                type="monotone"
                dataKey="patterns"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#gradPattern)"
              />
              <Area
                name="采纳率%"
                type="monotone"
                dataKey="acceptRate"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#gradAccept)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>

      {/* ================================================================= */}
      {/* Section 4: Effect Attributions (M4.F146) */}
      {/* ================================================================= */}
      <div>
        <h3 className="mb-3 text-base font-semibold text-gray-800 dark:text-gray-100">
          <span className="inline-flex items-center gap-1.5">
            <BarChart3 className="size-4 text-orange-500" />
            效果归因
          </span>
        </h3>

        {attributions.length === 0 ? (
          <GlassCard>
            <p className="text-center text-sm text-gray-400 dark:text-gray-500">
              暂无效果归因数据
            </p>
          </GlassCard>
        ) : (
          <GlassCard padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700/50 text-left text-xs text-gray-500 dark:text-gray-400">
                    <th className="px-4 py-2.5 font-medium">时间</th>
                    <th className="px-4 py-2.5 font-medium">传播数据</th>
                    <th className="px-4 py-2.5 font-medium">互动数据</th>
                    <th className="px-4 py-2.5 font-medium">质量评分</th>
                  </tr>
                </thead>
                <tbody>
                  {attributions.map((a) => (
                    <tr
                      key={a.id}
                      className="border-b border-gray-50 dark:border-gray-800 last:border-0"
                    >
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {a.attributedAt
                          ? new Date(a.attributedAt).toLocaleDateString(
                              "zh-CN"
                            )
                          : "-"}
                      </td>
                      <td className="px-4 py-2.5">
                        {a.reach ? (
                          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                            <span className="inline-flex items-center gap-0.5">
                              <Eye className="size-3" />
                              {a.reach.views ?? 0}
                            </span>
                            <span className="inline-flex items-center gap-0.5">
                              <Share2 className="size-3" />
                              {a.reach.shares ?? 0}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {a.engagement ? (
                          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                            <span className="inline-flex items-center gap-0.5">
                              <Heart className="size-3" />
                              {a.engagement.likes ?? 0}
                            </span>
                            <span className="inline-flex items-center gap-0.5">
                              <MessageCircle className="size-3" />
                              {a.engagement.comments ?? 0}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {a.qualityScore ? (
                          <Badge
                            variant="secondary"
                            className={cn(
                              "text-xs",
                              (a.qualityScore.overall ?? 0) >= 80
                                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                                : (a.qualityScore.overall ?? 0) >= 60
                                  ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                                  : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                            )}
                          >
                            {a.qualityScore.overall ?? "-"}
                          </Badge>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Plus,
  FlaskConical,
  Trophy,
  X,
  BarChart3,
  Percent,
  Eye,
  Heart,
  Star,
  Loader2,
  Save,
  StopCircle,
} from "lucide-react";
import type { ChannelAdvisor } from "@/lib/types";
import {
  createAbTest,
  updateAbTestMetrics,
  completeAbTest,
} from "@/app/actions/advisor-tests";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AbTest {
  id: string;
  name: string;
  advisorAId: string;
  advisorBId: string;
  configDiff: Record<string, unknown> | null;
  status: "active" | "paused" | "completed";
  metrics: {
    a: { views: number; engagement: number; quality: number };
    b: { views: number; engagement: number; quality: number };
  } | null;
  sampleSize: { a: number; b: number } | null;
  winner: "a" | "b" | null;
  confidence: number | null;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
}

interface Props {
  advisors: ChannelAdvisor[];
  tests: AbTest[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusConfig: Record<
  string,
  { label: string; className: string }
> = {
  active: { label: "进行中", className: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
  paused: { label: "已暂停", className: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" },
  completed: { label: "已完成", className: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
};

function getAdvisorName(advisors: ChannelAdvisor[], id: string) {
  return advisors.find((a) => a.id === id)?.name || "未知顾问";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AbTestClient({ advisors, tests }: Props) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [formName, setFormName] = useState("");
  const [formAdvisorA, setFormAdvisorA] = useState("");
  const [formAdvisorB, setFormAdvisorB] = useState("");
  const [creating, setCreating] = useState(false);
  const [simulatingId, setSimulatingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  async function handleCreate() {
    if (!formName.trim() || !formAdvisorA || !formAdvisorB) return;
    if (formAdvisorA === formAdvisorB) return;
    setCreating(true);
    try {
      await createAbTest(formName, formAdvisorA, formAdvisorB);
      setShowCreate(false);
      setFormName("");
      setFormAdvisorA("");
      setFormAdvisorB("");
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  async function handleSimulate(test: AbTest) {
    setSimulatingId(test.id);
    try {
      // Generate random metrics for simulation
      const metrics = {
        a: {
          views: Math.floor(Math.random() * 10000) + 1000,
          engagement: Math.round((Math.random() * 15 + 2) * 100) / 100,
          quality: Math.round((Math.random() * 30 + 60) * 10) / 10,
        },
        b: {
          views: Math.floor(Math.random() * 10000) + 1000,
          engagement: Math.round((Math.random() * 15 + 2) * 100) / 100,
          quality: Math.round((Math.random() * 30 + 60) * 10) / 10,
        },
      };
      await updateAbTestMetrics(test.id, metrics);
      router.refresh();
    } finally {
      setSimulatingId(null);
    }
  }

  async function handleComplete(test: AbTest, winner: "a" | "b") {
    setCompletingId(test.id);
    try {
      await completeAbTest(test.id, winner);
      router.refresh();
    } finally {
      setCompletingId(null);
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <FlaskConical size={20} className="text-purple-500" />
            A/B 测试管理
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            对比不同顾问配置的效果，用数据驱动优化
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={14} className="mr-1" />
          创建测试
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <GlassCard variant="blue">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">
            创建 A/B 测试
          </h4>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                测试名称
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="例如：正式风格 vs 轻松风格"
                className="w-full h-8 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 text-xs outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                  顾问 A
                </label>
                <select
                  value={formAdvisorA}
                  onChange={(e) => setFormAdvisorA(e.target.value)}
                  className="w-full h-8 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 text-xs outline-none focus:border-blue-300"
                >
                  <option value="">选择顾问...</option>
                  {advisors.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.channelType})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1 block">
                  顾问 B
                </label>
                <select
                  value={formAdvisorB}
                  onChange={(e) => setFormAdvisorB(e.target.value)}
                  className="w-full h-8 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 text-xs outline-none focus:border-blue-300"
                >
                  <option value="">选择顾问...</option>
                  {advisors.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.channelType})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {formAdvisorA && formAdvisorB && formAdvisorA === formAdvisorB && (
              <p className="text-[10px] text-red-500">
                请选择两个不同的顾问进行对比
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreate(false)}
                className="text-xs h-7"
              >
                <X size={12} className="mr-1" />
                取消
              </Button>
              <Button
                size="sm"
                disabled={
                  !formName.trim() ||
                  !formAdvisorA ||
                  !formAdvisorB ||
                  formAdvisorA === formAdvisorB ||
                  creating
                }
                onClick={handleCreate}
                className="text-xs h-7"
              >
                {creating ? (
                  <Loader2 size={12} className="mr-1 animate-spin" />
                ) : (
                  <Save size={12} className="mr-1" />
                )}
                创建
              </Button>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Tests list */}
      {tests.length === 0 ? (
        <GlassCard className="text-center py-12">
          <FlaskConical
            size={32}
            className="text-gray-300 mx-auto mb-3"
          />
          <p className="text-sm text-gray-400 dark:text-gray-500">
            暂无 A/B 测试，点击&ldquo;创建测试&rdquo;开始
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {tests.map((test) => {
            const status = statusConfig[test.status] || statusConfig.active;
            const advisorAName = getAdvisorName(advisors, test.advisorAId);
            const advisorBName = getAdvisorName(advisors, test.advisorBId);

            return (
              <GlassCard key={test.id}>
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h4 className="text-sm font-bold text-gray-800 dark:text-gray-100">
                      {test.name}
                    </h4>
                    <Badge className={cn("text-[10px]", status.className)}>
                      {status.label}
                    </Badge>
                    {test.winner && (
                      <Badge className="text-[10px] bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400">
                        <Trophy size={8} className="mr-0.5" />
                        {test.winner === "a" ? advisorAName : advisorBName}{" "}
                        胜出
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {test.confidence !== null && test.confidence > 0 && (
                      <Badge variant="outline" className="text-[10px]">
                        <Percent size={8} className="mr-0.5" />
                        置信度 {Math.round(test.confidence * 100)}%
                      </Badge>
                    )}
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">
                      {new Date(test.startedAt).toLocaleDateString("zh-CN")}
                    </span>
                  </div>
                </div>

                {/* Metrics comparison */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {/* Advisor A */}
                  <div
                    className={cn(
                      "p-4 rounded-lg border",
                      test.winner === "a"
                        ? "border-amber-200 bg-amber-50/50 dark:bg-amber-950/25"
                        : "border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/25"
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-gray-800 dark:text-gray-100">
                        A: {advisorAName}
                      </span>
                      {test.winner === "a" && (
                        <Trophy size={14} className="text-amber-500" />
                      )}
                    </div>
                    {test.metrics?.a ? (
                      <div className="space-y-2">
                        <MetricRow
                          icon={<Eye size={12} />}
                          label="浏览量"
                          value={test.metrics.a.views.toLocaleString()}
                        />
                        <MetricRow
                          icon={<Heart size={12} />}
                          label="互动率"
                          value={`${test.metrics.a.engagement}%`}
                        />
                        <MetricRow
                          icon={<Star size={12} />}
                          label="质量分"
                          value={`${test.metrics.a.quality}`}
                        />
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">
                        暂无数据
                      </p>
                    )}
                    {test.sampleSize && (
                      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700/50">
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">
                          样本量: {test.sampleSize.a}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Advisor B */}
                  <div
                    className={cn(
                      "p-4 rounded-lg border",
                      test.winner === "b"
                        ? "border-amber-200 bg-amber-50/50 dark:bg-amber-950/25"
                        : "border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/25"
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-gray-800 dark:text-gray-100">
                        B: {advisorBName}
                      </span>
                      {test.winner === "b" && (
                        <Trophy size={14} className="text-amber-500" />
                      )}
                    </div>
                    {test.metrics?.b ? (
                      <div className="space-y-2">
                        <MetricRow
                          icon={<Eye size={12} />}
                          label="浏览量"
                          value={test.metrics.b.views.toLocaleString()}
                        />
                        <MetricRow
                          icon={<Heart size={12} />}
                          label="互动率"
                          value={`${test.metrics.b.engagement}%`}
                        />
                        <MetricRow
                          icon={<Star size={12} />}
                          label="质量分"
                          value={`${test.metrics.b.quality}`}
                        />
                      </div>
                    ) : (
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">
                        暂无数据
                      </p>
                    )}
                    {test.sampleSize && (
                      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700/50">
                        <span className="text-[10px] text-gray-400 dark:text-gray-500">
                          样本量: {test.sampleSize.b}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Visual comparison bar */}
                {test.metrics?.a && test.metrics?.b && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <BarChart3 size={12} className="text-gray-400 dark:text-gray-500" />
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">
                        综合得分对比
                      </span>
                    </div>
                    <div className="flex h-6 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                      {(() => {
                        const scoreA =
                          test.metrics.a.views / 100 +
                          test.metrics.a.engagement +
                          test.metrics.a.quality;
                        const scoreB =
                          test.metrics.b.views / 100 +
                          test.metrics.b.engagement +
                          test.metrics.b.quality;
                        const total = scoreA + scoreB || 1;
                        const pctA = Math.round((scoreA / total) * 100);
                        return (
                          <>
                            <div
                              className="bg-blue-400 flex items-center justify-center text-white text-[9px] font-bold"
                              style={{ width: `${pctA}%` }}
                            >
                              A {pctA}%
                            </div>
                            <div
                              className="bg-purple-400 flex items-center justify-center text-white text-[9px] font-bold"
                              style={{ width: `${100 - pctA}%` }}
                            >
                              B {100 - pctA}%
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* Actions */}
                {test.status === "active" && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      disabled={simulatingId === test.id}
                      onClick={() => handleSimulate(test)}
                    >
                      {simulatingId === test.id ? (
                        <Loader2
                          size={12}
                          className="mr-1 animate-spin"
                        />
                      ) : (
                        <BarChart3 size={12} className="mr-1" />
                      )}
                      模拟数据
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      disabled={
                        completingId === test.id || !test.metrics
                      }
                      onClick={() => handleComplete(test, "a")}
                    >
                      <Trophy size={12} className="mr-1 text-blue-500" />
                      A 胜出
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      disabled={
                        completingId === test.id || !test.metrics
                      }
                      onClick={() => handleComplete(test, "b")}
                    >
                      <Trophy
                        size={12}
                        className="mr-1 text-purple-500"
                      />
                      B 胜出
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 text-red-500 hover:text-red-600"
                      disabled={completingId === test.id}
                      onClick={() => {
                        // Determine winner based on metrics
                        if (!test.metrics) return;
                        const scoreA =
                          test.metrics.a.views / 100 +
                          test.metrics.a.engagement +
                          test.metrics.a.quality;
                        const scoreB =
                          test.metrics.b.views / 100 +
                          test.metrics.b.engagement +
                          test.metrics.b.quality;
                        handleComplete(
                          test,
                          scoreA >= scoreB ? "a" : "b"
                        );
                      }}
                    >
                      <StopCircle size={12} className="mr-1" />
                      结束测试
                    </Button>
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
        {icon}
        <span className="text-[10px]">{label}</span>
      </div>
      <span className="text-xs font-bold text-gray-800 dark:text-gray-100">{value}</span>
    </div>
  );
}

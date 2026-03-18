"use client";

import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { GlassCard } from "@/components/shared/glass-card";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Info } from "lucide-react";

interface PerformanceTrendPoint {
  date: string;
  tasksCompleted: number;
  accuracy: number;
  avgResponseTime: number;
  satisfaction: number;
  qualityAvg: number;
}

interface PerformanceChartsProps {
  trendData: PerformanceTrendPoint[];
}

type MetricKey = "tasksCompleted" | "accuracy" | "avgResponseTime" | "satisfaction" | "qualityAvg";

const METRICS: { key: MetricKey; label: string; color: string; unit: string }[] = [
  { key: "tasksCompleted", label: "任务完成", color: "#3b82f6", unit: "个" },
  { key: "accuracy", label: "准确率", color: "#10b981", unit: "%" },
  { key: "avgResponseTime", label: "平均响应", color: "#f59e0b", unit: "s" },
  { key: "satisfaction", label: "满意度", color: "#8b5cf6", unit: "%" },
  { key: "qualityAvg", label: "质量均值", color: "#ef4444", unit: "" },
];

export function PerformanceCharts({ trendData }: PerformanceChartsProps) {
  const [activeMetrics, setActiveMetrics] = useState<MetricKey[]>([
    "accuracy",
    "satisfaction",
  ]);
  const [showDataSource, setShowDataSource] = useState(false);

  const toggleMetric = (key: MetricKey) => {
    setActiveMetrics((prev) =>
      prev.includes(key)
        ? prev.length > 1
          ? prev.filter((k) => k !== key)
          : prev // keep at least one
        : [...prev, key]
    );
  };

  if (trendData.length === 0) {
    return (
      <GlassCard padding="md">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          绩效趋势
        </h3>
        <div className="flex items-center justify-center h-48 text-sm text-gray-400 dark:text-gray-500">
          暂无绩效快照数据，请先执行绩效快照采集
        </div>
      </GlassCard>
    );
  }

  // Format dates for display (MM-DD)
  const chartData = trendData.map((point) => ({
    ...point,
    displayDate: point.date.slice(5), // "2026-03-01" -> "03-01"
  }));

  return (
    <GlassCard padding="md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          绩效趋势
        </h3>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          最近 {trendData.length} 天
        </span>
      </div>

      {/* Metric toggles */}
      <div className="flex flex-wrap gap-2 mb-4">
        {METRICS.map((metric) => {
          const isActive = activeMetrics.includes(metric.key);
          return (
            <button
              key={metric.key}
              onClick={() => toggleMetric(metric.key)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-all",
                isActive
                  ? "text-white shadow-sm"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              )}
              style={
                isActive
                  ? { backgroundColor: metric.color }
                  : undefined
              }
            >
              {metric.label}
            </button>
          );
        })}
      </div>

      {/* Area chart */}
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={chartData}>
          <defs>
            {METRICS.filter((m) => activeMetrics.includes(m.key)).map(
              (metric) => (
                <linearGradient
                  key={metric.key}
                  id={`perfGradient-${metric.key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor={metric.color}
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="95%"
                    stopColor={metric.color}
                    stopOpacity={0}
                  />
                </linearGradient>
              )
            )}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="displayDate"
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
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
            labelFormatter={(label) => `日期: ${label}`}
            formatter={((value: number | undefined, name: string) => {
              const metric = METRICS.find((m) => m.key === name);
              const displayValue =
                typeof value === "number" ? value.toFixed(1) : "—";
              return [
                `${displayValue}${metric?.unit ?? ""}`,
                metric?.label ?? name,
              ];
            }) as never}
          />
          {METRICS.filter((m) => activeMetrics.includes(m.key)).map(
            (metric) => (
              <Area
                key={metric.key}
                type="monotone"
                dataKey={metric.key}
                stroke={metric.color}
                strokeWidth={2}
                fill={`url(#perfGradient-${metric.key})`}
              />
            )
          )}
        </AreaChart>
      </ResponsiveContainer>

      {/* Data source explanation */}
      <div className="mt-3 border-t border-gray-100 dark:border-gray-700/50 pt-3">
        <button
          className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          onClick={() => setShowDataSource(!showDataSource)}
        >
          <Info size={10} />
          数据来源说明
          {showDataSource ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </button>
        {showDataSource && (
          <div className="mt-2 space-y-1.5 text-[10px] text-gray-400 dark:text-gray-500">
            <p><span className="text-gray-600 dark:text-gray-400 font-medium">任务完成：</span>工作流步骤执行完成时 +1 (workflow_steps)</p>
            <p><span className="text-gray-600 dark:text-gray-400 font-medium">准确率：</span>从 execution_logs 计算成功率 (成功次数/总次数)</p>
            <p><span className="text-gray-600 dark:text-gray-400 font-medium">平均响应：</span>从 execution_logs 计算平均执行耗时</p>
            <p><span className="text-gray-600 dark:text-gray-400 font-medium">满意度：</span>从 user_feedback 计算采纳率 (accept/总反馈)</p>
            <p><span className="text-gray-600 dark:text-gray-400 font-medium">质量均值：</span>从 skill_usage_records 计算平均质量评分</p>
          </div>
        )}
      </div>
    </GlassCard>
  );
}

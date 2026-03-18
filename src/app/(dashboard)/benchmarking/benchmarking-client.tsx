"use client";

import { useState } from "react";
import { KPIComparisonBar } from "@/components/shared/kpi-comparison-bar";
import { RealTimeIndicator } from "@/components/shared/realtime-indicator";
import { CompareTable } from "@/components/shared/compare-table";
import type { CompareRow } from "@/components/shared/compare-table";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { StatCard } from "@/components/shared/stat-card";
import { RadarChartCard } from "@/components/charts/radar-chart-card";
import { GaugeChart } from "@/components/charts/gauge-chart";
import { DonutChartCard } from "@/components/charts/donut-chart-card";
import { AreaChartCard } from "@/components/charts/area-chart-card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search,
  Clock,
  Flame,
  AlertTriangle,
  CheckCircle,
  Crosshair,
  FileBarChart,
  Lightbulb,
  ArrowUpRight,
  Target,
  Shield,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import type { BenchmarkTopic, MissedTopic, WeeklyReport } from "@/lib/types";

const priorityColors: Record<string, string> = {
  high: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200",
  medium: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200",
  low: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700",
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  missed: {
    label: "未覆盖",
    color: "bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border-red-100",
    icon: <AlertTriangle size={12} />,
  },
  tracking: {
    label: "追踪中",
    color: "bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800/30",
    icon: <Crosshair size={12} />,
  },
  resolved: {
    label: "已补发",
    color: "bg-green-50 dark:bg-green-950/50 text-green-600 dark:text-green-400 border-green-100",
    icon: <CheckCircle size={12} />,
  },
};

interface BenchmarkingClientProps {
  benchmarkTopics: BenchmarkTopic[];
  missedTopics: MissedTopic[];
  weeklyReport: WeeklyReport | null;
  dimensions: string[];
  missedTypeDistribution: { name: string; value: number; color: string }[];
}

export function BenchmarkingClient({
  benchmarkTopics,
  missedTopics,
  weeklyReport,
  dimensions,
  missedTypeDistribution,
}: BenchmarkingClientProps) {
  const [selectedTopicId, setSelectedTopicId] = useState(benchmarkTopics[0]?.id || "");

  const selectedTopic = benchmarkTopics.find((t) => t.id === selectedTopicId) ?? benchmarkTopics[0];

  const compareRows: CompareRow[] = selectedTopic
    ? selectedTopic.mediaScores.map((ms) => ({
        media: ms.media,
        scores: ms.scores,
        total: ms.total,
        highlight: ms.isUs,
      }))
    : [];

  const radarData = selectedTopic
    ? selectedTopic.radarData.map((rd) => ({
        dimension: rd.dimension,
        us: rd.us,
        best: rd.best,
      }))
    : [];

  const interceptedCount = missedTopics.filter(
    (t) => t.status === "tracking" || t.status === "resolved"
  ).length;

  const report = weeklyReport || {
    period: "",
    overallScore: 0,
    missedRate: 0,
    responseSpeed: "",
    coverageRate: 0,
    trends: [],
    gapList: [],
  };

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader
        title="同题对标"
        description="竞品做了我没做的秒级预警 \u00b7 同题深度拆解"
      />

      <KPIComparisonBar
        items={[
          { label: "漏题率", before: "30%", after: "~0%", improvement: "-100%" },
          { label: "响应速度", before: "慢", after: "快", improvement: "+80%" },
          { label: "对标覆盖", before: "3家", after: "20+家", improvement: "6x" },
          { label: "分析深度", before: "基础", after: "四维度", improvement: "升级" },
        ]}
      />

      <div className="flex items-center justify-between mb-6">
        <RealTimeIndicator label="媒体" count={20} />
      </div>

      <Tabs defaultValue="compare" className="w-full">
        <TabsList>
          <TabsTrigger value="compare">
            <Target size={14} className="mr-1" />
            同题对标
          </TabsTrigger>
          <TabsTrigger value="missed">
            <Shield size={14} className="mr-1" />
            漏题筛查
          </TabsTrigger>
          <TabsTrigger value="report">
            <BarChart3 size={14} className="mr-1" />
            对标报告
          </TabsTrigger>
        </TabsList>

        {/* ====== Tab 1: 同题对标 ====== */}
        <TabsContent value="compare">
          {/* Topic selector */}
          <div className="mb-4 flex items-center gap-3">
            <Search size={14} className="text-gray-400 dark:text-gray-500" />
            <select
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {benchmarkTopics.map((topic) => (
                <option key={topic.id} value={topic.id}>
                  {topic.title}
                </option>
              ))}
            </select>
            {selectedTopic && (
              <Badge variant="secondary">{selectedTopic.category}</Badge>
            )}
          </div>

          <div className="grid grid-cols-12 gap-5">
            {/* Left: Compare Table + Timeline */}
            <div className="col-span-8 space-y-4">
              <CompareTable rows={compareRows} dimensions={dimensions} />

              {/* Publish Timeline */}
              {selectedTopic && (
                <GlassCard>
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                    <Clock size={14} className="text-gray-400 dark:text-gray-500" />
                    发布时间线
                  </h4>
                  <div className="relative">
                    <div className="absolute left-3 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />
                    {selectedTopic.mediaScores
                      .sort((a, b) => a.publishTime.localeCompare(b.publishTime))
                      .map((ms, i) => (
                        <div key={i} className="flex items-center gap-3 mb-3 last:mb-0 relative pl-7">
                          <div
                            className={`absolute left-1.5 w-3 h-3 rounded-full border-2 ${
                              ms.isUs
                                ? "bg-blue-500 border-blue-300"
                                : "bg-white dark:bg-gray-900 border-gray-300"
                            }`}
                          />
                          <span className="text-xs font-mono text-gray-500 dark:text-gray-400 w-12">
                            {ms.publishTime}
                          </span>
                          <span
                            className={`text-xs font-medium ${
                              ms.isUs ? "text-blue-700 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {ms.media}
                          </span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            总分 {ms.total}
                          </span>
                        </div>
                      ))}
                  </div>
                </GlassCard>
              )}
            </div>

            {/* Right: Radar + Improvements */}
            <div className="col-span-4 space-y-4">
              <RadarChartCard
                title="四维度对比"
                data={radarData}
                series={[
                  { dataKey: "us", name: "我方", color: "#3b82f6" },
                  { dataKey: "best", name: "最佳", color: "#ef4444" },
                ]}
                height={260}
              />

              {selectedTopic && (
                <GlassCard>
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
                    <Lightbulb size={14} className="text-amber-500" />
                    改进建议
                  </h4>
                  <ul className="space-y-2">
                    {selectedTopic.improvements.map((item, i) => (
                      <li
                        key={i}
                        className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed pl-3 border-l-2 border-blue-200 dark:border-blue-700/50"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </GlassCard>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ====== Tab 2: 漏题筛查 ====== */}
        <TabsContent value="missed">
          <div className="grid grid-cols-12 gap-5">
            {/* Left: Gauge + Stats + Donut */}
            <div className="col-span-4 space-y-4">
              <GaugeChart
                value={report.missedRate}
                label="漏题率"
              />

              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label="今日筛查"
                  value={missedTopics.length}
                  suffix="条"
                  icon={<Search size={18} />}
                />
                <StatCard
                  label="已拦截"
                  value={interceptedCount}
                  suffix="条"
                  icon={<Shield size={18} />}
                />
              </div>

              <GlassCard>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  漏题类型分布
                </h4>
                <DonutChartCard data={missedTypeDistribution} height={180} />
                <div className="flex flex-wrap gap-2 mt-2 justify-center">
                  {missedTypeDistribution.map((item, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">
                        {item.name} {item.value}%
                      </span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>

            {/* Right: Missed topics list */}
            <div className="col-span-8 space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  漏题列表
                </h3>
                <Badge variant="outline" className="text-xs">
                  共 {missedTopics.length} 条
                </Badge>
              </div>
              {missedTopics.map((topic) => {
                const status = statusConfig[topic.status];
                return (
                  <GlassCard
                    key={topic.id}
                    variant="interactive"
                    padding="sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${priorityColors[topic.priority]}`}
                          >
                            {topic.priority === "high"
                              ? "高优"
                              : topic.priority === "medium"
                              ? "中优"
                              : "低优"}
                          </span>
                          <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                            {topic.title}
                          </h4>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {topic.discoveredAt} 发现
                          </span>
                          <span className="flex items-center gap-1">
                            <Flame size={11} className="text-orange-400" />
                            热度 {topic.heatScore}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 mt-2">
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            竞品已发:
                          </span>
                          {topic.competitors.map((comp, i) => (
                            <Badge
                              key={i}
                              variant="secondary"
                              className="text-[10px] py-0"
                            >
                              {comp}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${status.color}`}
                        >
                          {status.icon}
                          {status.label}
                        </span>

                        {topic.status === "missed" && (
                          <Button
                            size="sm"
                            className="text-xs h-7 px-3"
                          >
                            <Crosshair size={12} className="mr-1" />
                            启动追踪
                          </Button>
                        )}
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* ====== Tab 3: 对标报告 ====== */}
        <TabsContent value="report">
          <div className="space-y-5">
            {/* Weekly Overview */}
            <GlassCard>
              <div className="flex items-center gap-2 mb-4">
                <FileBarChart size={16} className="text-blue-500" />
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  周报总览
                </h3>
                <Badge variant="outline" className="text-xs ml-auto">
                  {report.period}
                </Badge>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  label="综合评分"
                  value={report.overallScore}
                  suffix="分"
                  icon={<TrendingUp size={18} />}
                />
                <StatCard
                  label="漏题率"
                  value={`${report.missedRate}%`}
                  icon={<AlertTriangle size={18} />}
                />
                <StatCard
                  label="平均响应速度"
                  value={report.responseSpeed}
                  icon={<Clock size={18} />}
                />
                <StatCard
                  label="覆盖率"
                  value={`${report.coverageRate}%`}
                  icon={<Target size={18} />}
                />
              </div>
            </GlassCard>

            {/* Trends */}
            <div className="grid grid-cols-12 gap-5">
              <div className="col-span-6">
                <GlassCard>
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    综合评分趋势
                  </h4>
                  <AreaChartCard
                    data={report.trends}
                    dataKey="score"
                    xKey="week"
                    color="#3b82f6"
                    height={220}
                  />
                </GlassCard>
              </div>
              <div className="col-span-6">
                <GlassCard>
                  <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    漏题率趋势
                  </h4>
                  <AreaChartCard
                    data={report.trends}
                    dataKey="missedRate"
                    xKey="week"
                    color="#ef4444"
                    height={220}
                  />
                </GlassCard>
              </div>
            </div>

            {/* Gap List */}
            <GlassCard>
              <div className="flex items-center gap-2 mb-4">
                <ArrowUpRight size={16} className="text-amber-500" />
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  差距分析与改进建议
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/25">
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                        领域
                      </th>
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                        差距
                      </th>
                      <th className="text-left py-2.5 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                        改进建议
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.gapList.map((gap, i) => (
                      <tr
                        key={i}
                        className="border-b border-gray-50 dark:border-gray-800 hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-colors"
                      >
                        <td className="py-2.5 px-3 font-medium text-gray-800 dark:text-gray-100">
                          {gap.area}
                        </td>
                        <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">
                          <Badge variant="outline" className="text-xs">
                            {gap.gap}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400 text-xs leading-relaxed">
                          {gap.suggestion}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

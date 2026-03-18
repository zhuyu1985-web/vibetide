"use client";

import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { StatCard } from "@/components/shared/stat-card";
import { AreaChartCard } from "@/components/charts/area-chart-card";
import { BarChartCard } from "@/components/charts/bar-chart-card";
import { RadarChartCard } from "@/components/charts/radar-chart-card";
import { Badge } from "@/components/ui/badge";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import type {
  WeeklyAnalyticsStats,
  TopContentItem,
  SixDimensionScore,
} from "@/lib/types";
import type { AnomalyAlert } from "@/lib/dal/analytics";
import {
  Eye,
  Heart,
  UserPlus,
  FileText,
  TrendingUp,
  Trophy,
  Clock,
  Bell,
} from "lucide-react";

interface AnalyticsClientProps {
  stats: WeeklyAnalyticsStats;
  channelComparison: {
    name: string;
    views: number;
    likes: number;
    shares: number;
  }[];
  topContent: TopContentItem[];
  sixDimensionScores: SixDimensionScore[];
  viewsTrend: { date: string; views: number }[];
  anomalyAlerts: AnomalyAlert[];
}

export default function AnalyticsClient({
  stats,
  channelComparison,
  topContent,
  sixDimensionScores,
  viewsTrend,
  anomalyAlerts,
}: AnalyticsClientProps) {
  const radarData = sixDimensionScores.map((d) => ({
    dimension: d.dimension,
    score: d.score,
  }));

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader
        title="数据分析看板"
        description="全渠道内容表现数据一览 (F3.1.13-18)"
        actions={
          <div className="flex items-center gap-2">
            <EmployeeAvatar employeeId="xiaoshu" size="xs" />
            <span className="text-xs text-gray-500 dark:text-gray-400">小数 为你实时分析</span>
            <Badge variant="outline" className="text-xs">
              <Clock size={12} className="mr-1" />
              本周数据
            </Badge>
          </div>
        }
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard
          label="总阅读量"
          value={
            stats.totalViews >= 10000
              ? `${(stats.totalViews / 10000).toFixed(1)}万`
              : stats.totalViews.toLocaleString()
          }
          change={stats.totalViewsChange}
          icon={<Eye size={18} />}
        />
        <StatCard
          label="平均互动率"
          value={`${stats.avgEngagement}%`}
          change={stats.avgEngagementChange}
          icon={<Heart size={18} />}
        />
        <StatCard
          label="新增粉丝"
          value={
            stats.totalFollowersGain >= 10000
              ? `${(stats.totalFollowersGain / 10000).toFixed(2)}万`
              : stats.totalFollowersGain.toLocaleString()
          }
          change={stats.totalFollowersGainChange}
          icon={<UserPlus size={18} />}
        />
        <StatCard
          label="发布内容"
          value={stats.contentPublished}
          change={stats.contentPublishedChange}
          suffix="篇"
          icon={<FileText size={18} />}
        />
        <StatCard
          label="爆款率"
          value={`${stats.hitRate}%`}
          change={stats.hitRateChange}
          icon={<TrendingUp size={18} />}
        />
        <StatCard
          label="平均阅读时长"
          value={stats.avgReadTime}
          icon={<Clock size={18} />}
        />
      </div>

      {/* Anomaly Alerts (F3.1.17) */}
      {anomalyAlerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {anomalyAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
                alert.severity === "critical"
                  ? "bg-red-50 dark:bg-red-950/50 border-red-200"
                  : "bg-amber-50 dark:bg-amber-950/50 border-amber-200"
              }`}
            >
              <Bell
                size={16}
                className={
                  alert.severity === "critical"
                    ? "text-red-500"
                    : "text-amber-500"
                }
              />
              <div className="flex-1">
                <p
                  className={`text-sm font-medium ${
                    alert.severity === "critical"
                      ? "text-red-700 dark:text-red-400"
                      : "text-amber-700 dark:text-amber-400"
                  }`}
                >
                  {alert.message}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                  当前: {alert.currentValue.toLocaleString()} | 均值:{" "}
                  {alert.previousValue.toLocaleString()} | 变化:{" "}
                  {alert.changePercent > 0 ? "+" : ""}
                  {alert.changePercent}%
                </p>
              </div>
              <Badge
                variant="outline"
                className={`text-[10px] ${
                  alert.severity === "critical"
                    ? "text-red-600 dark:text-red-400 border-red-300"
                    : "text-amber-600 dark:text-amber-400 border-amber-300"
                }`}
              >
                {alert.severity === "critical" ? "严重" : "注意"}
              </Badge>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-12 gap-5">
        {/* Views Trend */}
        <div className="col-span-8">
          <GlassCard>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">
              阅读量趋势（全渠道）
            </h3>
            {viewsTrend.length > 0 ? (
              <AreaChartCard
                data={viewsTrend}
                dataKey="views"
                xKey="date"
                color="#3b82f6"
                height={240}
              />
            ) : (
              <div className="h-[240px] flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
                暂无数据
              </div>
            )}
          </GlassCard>
        </div>

        {/* Six-Dimension Radar (F3.1.15) */}
        <div className="col-span-4">
          <RadarChartCard
            title="六维传播评估"
            data={radarData}
            series={[
              {
                dataKey: "score",
                name: "评分",
                color: "#6366f1",
                fillOpacity: 0.3,
              },
            ]}
            height={280}
          />
        </div>

        {/* Channel Comparison */}
        <div className="col-span-6">
          <GlassCard>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">
              渠道阅读量对比
            </h3>
            {channelComparison.length > 0 ? (
              <BarChartCard
                data={channelComparison}
                dataKey="views"
                xKey="name"
                color="#8b5cf6"
                height={240}
              />
            ) : (
              <div className="h-[240px] flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
                暂无数据
              </div>
            )}
          </GlassCard>
        </div>

        {/* Channel Likes/Shares Comparison */}
        <div className="col-span-6">
          <GlassCard>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">
              渠道互动对比（点赞/分享）
            </h3>
            {channelComparison.length > 0 ? (
              <BarChartCard
                data={channelComparison}
                dataKey="likes"
                xKey="name"
                color="#f59e0b"
                height={240}
              />
            ) : (
              <div className="h-[240px] flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
                暂无数据
              </div>
            )}
          </GlassCard>
        </div>

        {/* Top Content */}
        <div className="col-span-12">
          <GlassCard>
            <div className="flex items-center gap-2 mb-4">
              <Trophy size={16} className="text-amber-500" />
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                TOP内容排行 (F3.1.18 内容效果评分)
              </h3>
            </div>
            {topContent.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-700/50">
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                        排名
                      </th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                        标题
                      </th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                        渠道
                      </th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                        阅读量
                      </th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                        点赞
                      </th>
                      <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                        效果评分
                      </th>
                      <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                        日期
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {topContent.map((item, i) => (
                      <tr
                        key={i}
                        className="border-b border-gray-50 dark:border-gray-800 hover:bg-blue-50/30 dark:hover:bg-blue-900/20 transition-colors"
                      >
                        <td className="py-2.5 px-3">
                          <span
                            className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold ${
                              i === 0
                                ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                                : i === 1
                                ? "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                                : i === 2
                                ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
                                : "text-gray-400 dark:text-gray-500"
                            }`}
                          >
                            {i + 1}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-gray-800 dark:text-gray-100">
                          {item.title}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge variant="secondary" className="text-xs">
                            {item.channel}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-gray-700 dark:text-gray-300">
                          {item.views >= 10000
                            ? `${(item.views / 10000).toFixed(1)}万`
                            : item.views.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-gray-700 dark:text-gray-300">
                          {item.likes >= 10000
                            ? `${(item.likes / 10000).toFixed(1)}万`
                            : item.likes.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {item.score !== undefined && (
                            <span
                              className={`inline-flex items-center justify-center w-8 h-5 rounded text-[10px] font-bold ${
                                item.score >= 80
                                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                                  : item.score >= 60
                                  ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                              }`}
                            >
                              {item.score}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-gray-400 dark:text-gray-500">
                          {item.date}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                暂无已发布内容数据
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

"use client";

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { GlassCard } from "@/components/shared/glass-card";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TeamMemberComparison {
  name: string;
  nickname: string;
  employeeId: string;
  tasksCompleted: number;
  accuracy: number;
  avgResponseTime: number;
  satisfaction: number;
  efficiencyScore: number;
}

interface TeamEfficiencyReport {
  totalTasks: number;
  avgQuality: number;
  avgResponseTime: number;
  avgAccuracy: number;
  avgSatisfaction: number;
  activeWorkflows: number;
  completedWorkflows: number;
  completionRate: number;
  memberCount: number;
}

interface TeamReportProps {
  comparison: TeamMemberComparison[];
  report: TeamEfficiencyReport;
}

// ---------------------------------------------------------------------------
// Color palette for up to 8 members
// ---------------------------------------------------------------------------

const MEMBER_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
];

const DIMENSION_LABELS: Record<string, string> = {
  tasksCompleted: "任务完成",
  accuracy: "准确率",
  avgResponseTime: "响应速度",
  satisfaction: "满意度",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TeamReport({ comparison, report }: TeamReportProps) {
  if (comparison.length === 0) {
    return (
      <GlassCard padding="md">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          团队效率报告
        </h3>
        <div className="flex items-center justify-center h-48 text-sm text-gray-400 dark:text-gray-500">
          该团队暂无 AI 成员数据
        </div>
      </GlassCard>
    );
  }

  // ----- Radar chart data -----
  // Normalize each dimension to 0-100 scale
  const maxTasks = Math.max(...comparison.map((m) => m.tasksCompleted), 1);
  const maxResponseTime = Math.max(...comparison.map((m) => m.avgResponseTime), 1);

  const dimensions = ["tasksCompleted", "accuracy", "avgResponseTime", "satisfaction"];

  const radarData = dimensions.map((dim) => {
    const point: Record<string, string | number> = {
      dimension: DIMENSION_LABELS[dim] || dim,
    };
    comparison.forEach((member) => {
      let value: number;
      switch (dim) {
        case "tasksCompleted":
          value = (member.tasksCompleted / maxTasks) * 100;
          break;
        case "accuracy":
          value = member.accuracy;
          break;
        case "avgResponseTime":
          // Invert: lower response time = better score
          value = Math.max(0, 100 - (member.avgResponseTime / maxResponseTime) * 100);
          break;
        case "satisfaction":
          value = member.satisfaction;
          break;
        default:
          value = 0;
      }
      point[member.nickname] = Math.round(value * 10) / 10;
    });
    return point;
  });

  // ----- Bar chart data (efficiency ranking) -----
  const barData = comparison.map((m) => ({
    name: m.nickname,
    效率分: m.efficiencyScore,
  }));

  // ----- Summary cards data -----
  const summaryCards = [
    {
      label: "总任务数",
      value: report.totalTasks.toString(),
      unit: "个",
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "平均质量",
      value: report.avgQuality.toFixed(1),
      unit: "分",
      color: "text-green-600 dark:text-green-400",
    },
    {
      label: "平均响应",
      value: report.avgResponseTime.toFixed(1),
      unit: "s",
      color: "text-amber-600 dark:text-amber-400",
    },
    {
      label: "完成率",
      value: `${report.completionRate}`,
      unit: "%",
      color: "text-purple-600 dark:text-purple-400",
    },
    {
      label: "进行中",
      value: report.activeWorkflows.toString(),
      unit: "个",
      color: "text-cyan-600 dark:text-cyan-400",
    },
    {
      label: "已完成",
      value: report.completedWorkflows.toString(),
      unit: "个",
      color: "text-emerald-600 dark:text-emerald-400",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          团队效率报告
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {summaryCards.map((card) => (
            <GlassCard key={card.label} padding="sm">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{card.label}</p>
              <p className={cn("text-xl font-bold", card.color)}>
                {card.value}
                <span className="text-xs font-normal text-gray-400 dark:text-gray-500 ml-0.5">
                  {card.unit}
                </span>
              </p>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar chart: team comparison */}
        <GlassCard padding="sm">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
            团队绩效对比
          </h4>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis
                dataKey="dimension"
                tick={{ fontSize: 11, fill: "#6b7280" }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 100]}
                tick={{ fontSize: 9, fill: "#9ca3af" }}
              />
              {comparison.map((member, idx) => (
                <Radar
                  key={member.employeeId}
                  name={member.nickname}
                  dataKey={member.nickname}
                  stroke={MEMBER_COLORS[idx % MEMBER_COLORS.length]}
                  fill={MEMBER_COLORS[idx % MEMBER_COLORS.length]}
                  fillOpacity={0.15}
                />
              ))}
              {comparison.length > 1 && (
                <Legend wrapperStyle={{ fontSize: 11 }} />
              )}
            </RadarChart>
          </ResponsiveContainer>
        </GlassCard>

        {/* Bar chart: efficiency ranking */}
        <GlassCard padding="sm">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
            效率排名
          </h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                type="number"
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: "#6b7280" }}
                axisLine={false}
                tickLine={false}
                width={60}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(255,255,255,0.95)",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number | undefined) => [
                  `${value ?? 0} 分`,
                  "效率分",
                ]}
              />
              <Bar
                dataKey="效率分"
                fill="#3b82f6"
                radius={[0, 4, 4, 0]}
                barSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>
      </div>

      {/* Member ranking table */}
      <GlassCard padding="md">
        <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3">
          成员排名详情
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                  排名
                </th>
                <th className="text-left py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                  成员
                </th>
                <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                  任务数
                </th>
                <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                  准确率
                </th>
                <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                  响应时间
                </th>
                <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                  满意度
                </th>
                <th className="text-right py-2 px-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                  效率分
                </th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((member, idx) => (
                <tr
                  key={member.employeeId}
                  className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/25 transition-colors"
                >
                  <td className="py-2.5 px-3">
                    <span
                      className={cn(
                        "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold",
                        idx === 0
                          ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                          : idx === 1
                            ? "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                            : idx === 2
                              ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"
                              : "bg-gray-50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500"
                      )}
                    >
                      {idx + 1}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div>
                      <span className="font-medium text-gray-800 dark:text-gray-100">
                        {member.nickname}
                      </span>
                      <span className="ml-1.5 text-xs text-gray-400 dark:text-gray-500">
                        {member.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right text-gray-700 dark:text-gray-300">
                    {member.tasksCompleted}
                  </td>
                  <td className="py-2.5 px-3 text-right text-gray-700 dark:text-gray-300">
                    {member.accuracy.toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-3 text-right text-gray-700 dark:text-gray-300">
                    {member.avgResponseTime.toFixed(1)}s
                  </td>
                  <td className="py-2.5 px-3 text-right text-gray-700 dark:text-gray-300">
                    {member.satisfaction.toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span
                      className={cn(
                        "font-semibold",
                        member.efficiencyScore >= 80
                          ? "text-green-600 dark:text-green-400"
                          : member.efficiencyScore >= 60
                            ? "text-blue-600 dark:text-blue-400"
                            : "text-amber-600 dark:text-amber-400"
                      )}
                    >
                      {member.efficiencyScore}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}

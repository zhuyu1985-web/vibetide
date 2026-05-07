"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface HorizontalBarChartCardProps {
  data: Record<string, unknown>[];
  dataKey: string;
  yKey?: string;
  color?: string;
  height?: number;
}

/**
 * 水平条形图（layout="vertical" 实现 — bars 沿 X 轴延伸，类目在 Y 轴）。
 * A5 报告：区县分布章节使用，类目数较多时比纵向 BarChart 更适合长名称。
 */
export function HorizontalBarChartCard({
  data,
  dataKey,
  yKey = "name",
  color = "#3b82f6",
  height = 280,
}: HorizontalBarChartCardProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey={yKey}
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          width={80}
        />
        <Tooltip
          contentStyle={{
            background: "rgba(255,255,255,0.95)",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            fontSize: "12px",
          }}
        />
        <Bar dataKey={dataKey} fill={color} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

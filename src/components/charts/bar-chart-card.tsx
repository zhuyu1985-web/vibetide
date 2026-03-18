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

interface BarChartCardProps {
  data: Record<string, unknown>[];
  dataKey: string;
  xKey?: string;
  color?: string;
  height?: number;
}

export function BarChartCard({
  data,
  dataKey,
  xKey = "name",
  color = "#3b82f6",
  height = 200,
}: BarChartCardProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{
            background: "rgba(255,255,255,0.95)",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            fontSize: "12px",
          }}
        />
        <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

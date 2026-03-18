"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface AreaChartCardProps {
  data: Record<string, unknown>[];
  dataKey: string;
  xKey?: string;
  color?: string;
  height?: number;
  showGrid?: boolean;
}

export function AreaChartCard({
  data,
  dataKey,
  xKey = "date",
  color = "#3b82f6",
  height = 200,
  showGrid = true,
}: AreaChartCardProps) {
  const gradientId = `areaGradient-${dataKey}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.2} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
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
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#${gradientId})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface HeatCurveChartProps {
  data: { time: string; value: number }[];
  height?: number;
}

export function HeatCurveChart({ data, height = 120 }: HeatCurveChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="heatGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="time"
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis hide domain={[0, 100]} />
        <Tooltip
          contentStyle={{
            background: "var(--color-gray-50, rgba(255,255,255,0.95))",
            border: "1px solid var(--color-gray-200, #e5e7eb)",
            borderRadius: "8px",
            fontSize: "12px",
            color: "var(--color-gray-700, #374151)",
          }}
          formatter={(value) => [`${value}`, "热度"]}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#ef4444"
          strokeWidth={2}
          fill="url(#heatGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

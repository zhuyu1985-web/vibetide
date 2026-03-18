"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface DonutChartCardProps {
  data: { name: string; value: number; color: string }[];
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
}

export function DonutChartCard({
  data,
  height = 200,
  innerRadius = 50,
  outerRadius = 80,
}: DonutChartCardProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "rgba(255,255,255,0.95)",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            fontSize: "12px",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

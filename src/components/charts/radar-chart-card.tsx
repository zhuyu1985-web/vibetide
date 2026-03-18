"use client";

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { GlassCard } from "@/components/shared/glass-card";

export interface RadarDataPoint {
  dimension: string;
  [key: string]: string | number;
}

export interface RadarSeries {
  dataKey: string;
  name: string;
  color: string;
  fillOpacity?: number;
}

export function RadarChartCard({
  title,
  data,
  series,
  height = 280,
}: {
  title: string;
  data: RadarDataPoint[];
  series: RadarSeries[];
  height?: number;
}) {
  return (
    <GlassCard padding="sm">
      <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">{title}</h4>
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={data}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fontSize: 11, fill: "#6b7280" }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 10]}
            tick={{ fontSize: 9, fill: "#9ca3af" }}
          />
          {series.map((s) => (
            <Radar
              key={s.dataKey}
              name={s.name}
              dataKey={s.dataKey}
              stroke={s.color}
              fill={s.color}
              fillOpacity={s.fillOpacity ?? 0.2}
            />
          ))}
          {series.length > 1 && (
            <Legend
              wrapperStyle={{ fontSize: 11 }}
            />
          )}
        </RadarChart>
      </ResponsiveContainer>
    </GlassCard>
  );
}

"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";

interface Props {
  data: Array<{ dimension: string; score: number }>;
  height?: number;
}

export function DimensionRadar({ data, height = 280 }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data}>
        <PolarGrid stroke="#e5e7eb" />
        <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11 }} />
        <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
        <Radar
          name="得分"
          dataKey="score"
          stroke="#0ea5e9"
          fill="#0ea5e9"
          fillOpacity={0.3}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

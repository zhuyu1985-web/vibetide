"use client";

import { GlassCard } from "@/components/shared/glass-card";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { TrendingUp, BarChart3, CheckCircle, AlertTriangle } from "lucide-react";

interface AIPredictionPanelProps {
  coverageOverview: {
    totalExternal: number;
    covered: number;
    missed: number;
    coverageRate: number;
  };
}

export function AIPredictionPanel({ coverageOverview }: AIPredictionPanelProps) {
  const { totalExternal, covered, missed, coverageRate } = coverageOverview;

  return (
    <GlassCard>
      <div className="flex items-center gap-2 mb-4">
        <EmployeeAvatar employeeId="xiaoshu" size="sm" />
        <div className="flex items-center gap-1.5">
          <TrendingUp size={14} className="text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            AI 趋势预测
          </h3>
        </div>
        <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-auto">
          小数
        </span>
      </div>

      {/* Coverage Overview Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg bg-gray-50/80 dark:bg-gray-800/50 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <BarChart3 size={12} className="text-gray-400" />
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              外部总内容
            </span>
          </div>
          <p className="text-lg font-bold text-gray-800 dark:text-gray-100">
            {totalExternal}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50/80 dark:bg-gray-800/50 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp size={12} className="text-blue-500" />
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              覆盖率
            </span>
          </div>
          <p
            className={`text-lg font-bold ${
              coverageRate >= 80
                ? "text-green-600 dark:text-green-400"
                : coverageRate >= 50
                ? "text-amber-600 dark:text-amber-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {coverageRate.toFixed(1)}%
          </p>
        </div>
        <div className="rounded-lg bg-gray-50/80 dark:bg-gray-800/50 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle size={12} className="text-green-500" />
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              已覆盖
            </span>
          </div>
          <p className="text-lg font-bold text-green-600 dark:text-green-400">
            {covered}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50/80 dark:bg-gray-800/50 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle size={12} className="text-red-500" />
            <span className="text-[10px] text-gray-500 dark:text-gray-400">
              未覆盖
            </span>
          </div>
          <p className="text-lg font-bold text-red-500 dark:text-red-400">
            {missed}
          </p>
        </div>
      </div>

      {/* Trend Prediction */}
      <div className="rounded-lg bg-blue-50/50 dark:bg-blue-950/30 p-3">
        <h4 className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2">
          趋势分析
        </h4>
        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
          {coverageRate >= 80
            ? "当前覆盖率表现良好，建议继续保持现有监控节奏，同时关注新增平台的内容变化趋势。"
            : coverageRate >= 50
            ? "覆盖率处于中等水平，建议加强对未覆盖内容的分析，优先处理高重要性的遗漏选题。"
            : "当前覆盖率偏低，建议立即启动漏题筛查，重点关注央媒和省媒的关键选题覆盖。"}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
          预计下周覆盖率趋势：
          <span
            className={`font-semibold ml-1 ${
              coverageRate >= 70
                ? "text-green-600 dark:text-green-400"
                : "text-amber-600 dark:text-amber-400"
            }`}
          >
            {coverageRate >= 70 ? "稳定上升" : "需重点关注"}
          </span>
        </p>
      </div>
    </GlassCard>
  );
}

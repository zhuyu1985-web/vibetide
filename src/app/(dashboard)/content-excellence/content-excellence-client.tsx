"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import { GaugeChart } from "@/components/charts/gauge-chart";
import type { HitPrediction, CompetitorHit } from "@/lib/types";
import {
  Flame,
  Target,
  TrendingUp,
  Lightbulb,
  BarChart3,
  ArrowRight,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

interface ContentExcellenceClientProps {
  hitPredictions: HitPrediction[];
  competitorHits: CompetitorHit[];
}

const dimensionLabels: Record<string, string> = {
  titleAppeal: "标题吸引力",
  topicRelevance: "选题相关度",
  contentDepth: "内容深度",
  emotionalHook: "情感钩子",
  timingFit: "时效匹配",
};

export default function ContentExcellenceClient({
  hitPredictions,
  competitorHits,
}: ContentExcellenceClientProps) {
  const [activeTab, setActiveTab] = useState("predictions");

  const avgPredicted =
    hitPredictions.length > 0
      ? Math.round(
          hitPredictions.reduce((sum, p) => sum + p.predictedScore, 0) /
            hitPredictions.length
        )
      : 0;

  const withActual = hitPredictions.filter((p) => p.actualScore !== null);
  const avgAccuracy =
    withActual.length > 0
      ? Math.round(
          withActual.reduce(
            (sum, p) =>
              sum +
              (100 -
                Math.abs((p.predictedScore - (p.actualScore || 0)) / p.predictedScore) *
                  100),
            0
          ) / withActual.length
        )
      : 0;

  return (
    <div className="max-w-[1200px] mx-auto">
      <PageHeader
        title="内容精品率提升"
        description="爆品指数预测 + 竞品爆款学习 + AI改进建议 (3.3)"
        actions={
          <div className="flex items-center gap-2">
            <EmployeeAvatar employeeId="xiaoshen" size="xs" />
            <span className="text-xs text-gray-500 dark:text-gray-400">小审 爆品预测</span>
            <EmployeeAvatar employeeId="xiaoshu" size="xs" />
            <span className="text-xs text-gray-500 dark:text-gray-400">小数 竞品分析</span>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <GlassCard padding="sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-950/50 flex items-center justify-center">
              <Flame size={16} className="text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">平均爆品指数</p>
              <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{avgPredicted}</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-950/50 flex items-center justify-center">
              <Target size={16} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">预测准确率</p>
              <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{avgAccuracy}%</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center">
              <TrendingUp size={16} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">竞品爆款</p>
              <p className="text-lg font-bold text-gray-800 dark:text-gray-100">
                {competitorHits.length}
              </p>
            </div>
          </div>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center">
              <Lightbulb size={16} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">改进建议</p>
              <p className="text-lg font-bold text-gray-800 dark:text-gray-100">
                {hitPredictions.reduce(
                  (sum, p) => sum + p.suggestions.length,
                  0
                )}
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="predictions" className="text-xs">
            <Flame size={14} className="mr-1" />
            爆品预测 (F3.3.03)
          </TabsTrigger>
          <TabsTrigger value="competitors" className="text-xs">
            <BarChart3 size={14} className="mr-1" />
            竞品爆款 (F3.3.01)
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="text-xs">
            <Lightbulb size={14} className="mr-1" />
            改进建议 (F3.3.04)
          </TabsTrigger>
        </TabsList>

        {/* Hit Predictions Tab */}
        <TabsContent value="predictions">
          <div className="space-y-4">
            {hitPredictions.length === 0 && (
              <GlassCard className="text-center py-12">
                <Flame size={40} className="mx-auto text-gray-300 mb-3" />
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  暂无爆品预测数据
                </h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  小审会在审核环节自动生成爆品指数预测
                </p>
              </GlassCard>
            )}
            {hitPredictions.map((pred) => (
              <GlassCard key={pred.id} variant="interactive">
                <div className="flex items-start gap-4">
                  {/* Score Gauge */}
                  <div className="flex-shrink-0 w-24 text-center">
                    <div
                      className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center text-xl font-bold ${
                        pred.predictedScore >= 80
                          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                          : pred.predictedScore >= 60
                          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                          : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                      }`}
                    >
                      {pred.predictedScore}
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">爆品指数</p>
                    {pred.actualScore !== null && (
                      <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">
                        实际: {pred.actualScore}
                      </p>
                    )}
                  </div>

                  {/* Content & Dimensions */}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-2">
                      内容ID: {pred.contentId}
                    </p>

                    {/* Dimension Bars */}
                    {pred.dimensions && (
                      <div className="space-y-1.5 mb-3">
                        {Object.entries(pred.dimensions).map(
                          ([key, value]) =>
                            value !== undefined && (
                              <div key={key} className="flex items-center gap-2">
                                <span className="text-[10px] text-gray-500 dark:text-gray-400 w-16 text-right">
                                  {dimensionLabels[key] || key}
                                </span>
                                <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      value >= 80
                                        ? "bg-green-500"
                                        : value >= 60
                                        ? "bg-amber-500"
                                        : "bg-red-500"
                                    }`}
                                    style={{ width: `${value}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-mono text-gray-600 dark:text-gray-400 w-8">
                                  {value}
                                </span>
                              </div>
                            )
                        )}
                      </div>
                    )}

                    {/* Suggestions Count */}
                    {pred.suggestions.length > 0 && (
                      <Badge variant="outline" className="text-[10px]">
                        <Lightbulb size={10} className="mr-1" />
                        {pred.suggestions.length} 条改进建议
                      </Badge>
                    )}
                  </div>

                  {/* Status */}
                  <div className="text-right">
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">
                      {new Date(pred.createdAt).toLocaleDateString("zh-CN")}
                    </p>
                    {pred.predictedScore >= 80 && (
                      <Badge className="mt-1 text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200">
                        <CheckCircle size={10} className="mr-1" />
                        高潜力
                      </Badge>
                    )}
                    {pred.predictedScore < 60 && (
                      <Badge className="mt-1 text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200">
                        <AlertTriangle size={10} className="mr-1" />
                        需优化
                      </Badge>
                    )}
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </TabsContent>

        {/* Competitor Hits Tab */}
        <TabsContent value="competitors">
          <div className="space-y-4">
            {competitorHits.length === 0 && (
              <GlassCard className="text-center py-12">
                <BarChart3 size={40} className="mx-auto text-gray-300 mb-3" />
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  暂无竞品爆款数据
                </h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  小数每周自动追踪竞品爆款内容
                </p>
              </GlassCard>
            )}
            {competitorHits.map((hit) => (
              <GlassCard key={hit.id} variant="interactive">
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="text-xs">
                        {hit.platform}
                      </Badge>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {hit.competitorName}
                      </span>
                    </div>
                    <h4 className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-2">
                      {hit.title}
                    </h4>

                    {/* Metrics */}
                    {hit.metrics && (
                      <div className="flex items-center gap-4 mb-2">
                        {hit.metrics.views && (
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            阅读{" "}
                            {hit.metrics.views >= 10000
                              ? `${(hit.metrics.views / 10000).toFixed(1)}万`
                              : hit.metrics.views.toLocaleString()}
                          </span>
                        )}
                        {hit.metrics.likes && (
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            点赞 {hit.metrics.likes.toLocaleString()}
                          </span>
                        )}
                        {hit.metrics.shares && (
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            分享 {hit.metrics.shares.toLocaleString()}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Success Factors */}
                    {hit.successFactors && (
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(hit.successFactors).map(
                          ([key, value]) =>
                            value && (
                              <div
                                key={key}
                                className="text-[10px] bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 px-2 py-1 rounded"
                              >
                                <span className="font-medium">
                                  {dimensionLabels[key] ||
                                    key.replace(/([A-Z])/g, " $1").trim()}
                                  :
                                </span>{" "}
                                {value}
                              </div>
                            )
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">
                    {new Date(hit.analyzedAt).toLocaleDateString("zh-CN")}
                  </p>
                </div>
              </GlassCard>
            ))}
          </div>
        </TabsContent>

        {/* Suggestions Tab */}
        <TabsContent value="suggestions">
          <div className="space-y-4">
            {hitPredictions.filter((p) => p.suggestions.length > 0).length ===
              0 && (
              <GlassCard className="text-center py-12">
                <Lightbulb size={40} className="mx-auto text-gray-300 mb-3" />
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  暂无改进建议
                </h3>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  小审+小数会在爆品指数低于60时自动生成改进建议
                </p>
              </GlassCard>
            )}
            {hitPredictions
              .filter((p) => p.suggestions.length > 0)
              .map((pred) => (
                <GlassCard key={pred.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className={`text-sm font-bold ${
                        pred.predictedScore >= 80
                          ? "text-green-600 dark:text-green-400"
                          : pred.predictedScore >= 60
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      爆品指数 {pred.predictedScore}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">|</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      内容: {pred.contentId}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {pred.suggestions.map((sug, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-2 rounded-lg bg-amber-50/50 dark:bg-amber-950/25 border border-amber-100"
                      >
                        <div className="w-5 h-5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                          {i + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-gray-800 dark:text-gray-100">
                            {sug.area}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-[10px]">
                            <span className="text-red-600 dark:text-red-400 line-through">
                              {sug.current}
                            </span>
                            <ArrowRight size={10} className="text-gray-400" />
                            <span className="text-green-600 dark:text-green-400 font-medium">
                              {sug.recommended}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                            预期影响: {sug.impact}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

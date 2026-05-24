"use client";

import { useCallback } from "react";
import { GlassCard } from "@/components/shared/glass-card";
import { cn } from "@/lib/utils";
import { useAccountAnalyticsURLState } from "./use-url-state";
import { MetricTrendChart } from "./metric-trend-chart";
import { PublishActivityCard } from "./publish-activity-card";
import { RecentTopPosts } from "./recent-top-posts";
import {
  getMetricAvailability,
  getSummaryCards,
  GRANULARITY_LABELS,
  type Granularity,
  type MetricKey,
} from "@/lib/account-analytics/platform-meta";
import {
  loadMetricSeriesAction,
  loadPublishActivityAction,
  loadRecentTopPostsAction,
} from "@/app/actions/account-analytics-tab1";
import type { TopSort } from "./use-url-state";

interface Props {
  accountId: string;
  platform: string;
}

const GRANULARITIES: Granularity[] = ["day", "week", "month"];

export function DataAnalysisTab({ accountId, platform }: Props) {
  const { granularity, metric, topSort, setGranularity, setMetric, setTopSort } =
    useAccountAnalyticsURLState();
  const availability = getMetricAvailability(platform);
  const summaryKeys = getSummaryCards(platform);

  // 三个 loader 用 useCallback 包,保证 metric-trend-chart 等 useEffect deps
  // 不会因 inline 闭包而每次 re-render 都重跑(组件内部已经按 reqId 兜底竞态)。
  const metricLoader = useCallback(
    (m: MetricKey, g: Granularity) =>
      loadMetricSeriesAction({ accountId, granularity: g, metric: m }),
    [accountId],
  );
  const publishLoader = useCallback(
    (g: Granularity) =>
      loadPublishActivityAction({ accountId, platform, granularity: g }),
    [accountId, platform],
  );
  const topLoader = useCallback(
    (m: TopSort) => loadRecentTopPostsAction({ accountId, mode: m }),
    [accountId],
  );

  return (
    <div className="space-y-6">
      {/* 顶部工具条 · 粒度切换 */}
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-full bg-gray-100 dark:bg-gray-800 p-0.5">
          {GRANULARITIES.map((g) => (
            // eslint-disable-next-line no-restricted-syntax
            <button
              key={g}
              type="button"
              onClick={() => setGranularity(g)}
              className={cn(
                "px-4 py-1.5 rounded-full text-[12px] font-medium border-0 cursor-pointer transition-colors",
                granularity === g
                  ? "bg-white text-[#FF5E37] shadow-sm"
                  : "text-gray-500",
              )}
            >
              {GRANULARITY_LABELS[g]}
            </button>
          ))}
        </div>
      </div>

      {/* 区块 A · 关键指标趋势 */}
      <GlassCard padding="lg">
        <MetricTrendChart
          platform={platform}
          availability={availability}
          granularity={granularity}
          metric={metric}
          onMetricChange={setMetric}
          loader={metricLoader}
        />
      </GlassCard>

      {/* 区块 B · 发布活跃度 */}
      <GlassCard padding="lg">
        <PublishActivityCard
          granularity={granularity}
          summaryKeys={summaryKeys}
          loader={publishLoader}
        />
      </GlassCard>

      {/* 区块 C · Phase 2 占位 */}
      <GlassCard padding="lg">
        <div className="text-center py-12 text-sm text-gray-400">
          内容分类与热门词云正在分析中,预计 24 小时内可见
        </div>
      </GlassCard>

      {/* 区块 D · 近期文章 TOP5 */}
      <GlassCard padding="lg">
        <RecentTopPosts
          mode={topSort}
          onModeChange={setTopSort}
          loader={topLoader}
        />
      </GlassCard>
    </div>
  );
}

"use client";

import { useCallback } from "react";
import dynamic from "next/dynamic";
import { GlassCard } from "@/components/shared/glass-card";
import { LineChartCard } from "@/components/charts/line-chart-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccountAnalyticsURLState } from "./use-url-state";
import { MetricTrendChart } from "./metric-trend-chart";
import { PublishActivityCard } from "./publish-activity-card";
import { RecentTopPosts } from "./recent-top-posts";
import { CategoryDistribution } from "./category-distribution";
// d3-cloud 主线程 O(n²) 布局成本大,改为 client-only 懒加载,首次进 tab 时再加载
const KeywordCloud = dynamic(
  () => import("./keyword-cloud").then((m) => m.KeywordCloud),
  { ssr: false },
);
import {
  getMetricAvailability,
  getSummaryCards,
  GRANULARITY_LABELS,
  type Granularity,
  type MetricKey,
} from "@/lib/account-analytics/platform-meta";
import {
  loadCategoryDistributionAction,
  loadKeywordCloudAction,
  loadMetricSeriesAction,
  loadPublishActivityAction,
  loadRecentTopPostsAction,
} from "@/app/actions/account-analytics-tab1";
import type { CloudRange, TopSort } from "./use-url-state";

interface TrendPoint {
  date: string;
  compositeScore: number;
}

interface Props {
  accountId: string;
  platform: string;
  trend: TrendPoint[];
}

const GRANULARITIES: Granularity[] = ["day", "week", "month"];

export function DataAnalysisTab({ accountId, platform, trend }: Props) {
  const {
    granularity,
    metric,
    topSort,
    cloudRange,
    setGranularity,
    setMetric,
    setTopSort,
    setCloudRange,
  } = useAccountAnalyticsURLState();
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
  const categoryLoader = useCallback(
    () => loadCategoryDistributionAction({ accountId }),
    [accountId],
  );
  const cloudLoader = useCallback(
    (r: CloudRange) => loadKeywordCloudAction({ accountId, range: r }),
    [accountId],
  );

  return (
    <div className="space-y-6">
      {/* 顶部工具条 · 粒度切换 */}
      <div className="flex items-center justify-between">
        <Tabs
          value={granularity}
          onValueChange={(v) => setGranularity(v as Granularity)}
        >
          <TabsList variant="default">
            {GRANULARITIES.map((g) => (
              <TabsTrigger key={g} value={g}>
                {GRANULARITY_LABELS[g]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* 30 天趋势图 · Tab 开篇 */}
      <GlassCard padding="lg">
        <div className="mb-4">
          <h3 className="text-[15px] font-semibold text-[#1F3864] dark:text-blue-200">
            综合得分趋势（近 30 天）
          </h3>
          <p className="text-[12px] text-gray-500 mt-0.5">
            按业务日（Asia/Shanghai）聚合
          </p>
        </div>
        <LineChartCard
          data={trend.map((p) => ({
            date: p.date.slice(5),
            综合得分: Math.round(p.compositeScore),
          }))}
          dataKey="综合得分"
          xKey="date"
          color="#2E75B6"
          height={260}
        />
      </GlassCard>

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

      {/* 区块 C · 类型占比 + 词云 */}
      <GlassCard padding="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CategoryDistribution loader={categoryLoader} />
          <KeywordCloud
            range={cloudRange}
            onRangeChange={setCloudRange}
            loader={cloudLoader}
          />
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

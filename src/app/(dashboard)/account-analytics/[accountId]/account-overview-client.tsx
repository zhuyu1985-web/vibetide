"use client";

import Link from "next/link";
import { useTransition } from "react";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@/components/shared/glass-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChartCard } from "@/components/charts/line-chart-card";
import { crawlAccountOnDemand } from "@/app/actions/account-analytics";
import { getPlatformMeta } from "@/lib/account-analytics/platform-meta";
import type {
  AccountAnalyticsOverview,
  AnalyzableAccountRow,
  ReportSummary,
} from "@/lib/dal/account-analytics";
import { DataAnalysisTab } from "./components/data-analysis-tab";
import { ReportsTab } from "./components/reports-tab";
import { useAccountAnalyticsURLState } from "./components/use-url-state";

interface Props {
  account: AnalyzableAccountRow;
  overview: AccountAnalyticsOverview;
  reports: ReportSummary[];
}

export function AccountOverviewClient({ account, overview, reports }: Props) {
  const platformLabel = getPlatformMeta(account.platform).label;

  const [crawling, startCrawl] = useTransition();
  const { tab, setTab } = useAccountAnalyticsURLState();

  function handleCrawlAndReport() {
    if (crawling) return;
    startCrawl(async () => {
      const res = await crawlAccountOnDemand({
        accountId: account.id,
        accountSource: account.source,
      });
      if (!res.success) {
        toast.error(res.error ?? "派发失败");
        return;
      }
      toast.success(
        "已派发抓取任务 · 预计 3-5 分钟后报告自动生成，可稍后刷新页面查看",
        { duration: 6000 },
      );
    });
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div>
        <Link
          href="/account-analytics"
          className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-[#2E75B6]"
        >
          <ArrowLeft size={14} />
          返回账号列表
        </Link>
      </div>

      <PageHeader
        title={`${account.name} · ${platformLabel}`}
        description={`@${account.handle} · ${account.region ?? "未知地区"} · 最近 ${overview.trend.length} 天数据`}
        actions={
          <Button
            variant="default"
            size="sm"
            onClick={handleCrawlAndReport}
            disabled={crawling}
            title="派发即时抓取并在 3 分钟后自动生成报告"
          >
            {crawling ? (
              <>
                <Loader2 size={14} className="mr-1.5 animate-spin" />
                派发中...
              </>
            ) : (
              <>
                <RefreshCw size={14} className="mr-1.5" />
                立即抓取并生成报告
              </>
            )}
          </Button>
        }
      />

      {/* 30 天累计 KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="发布视频" value={overview.totals.posts.toLocaleString("zh-CN")} />
        <StatCard
          label="综合得分"
          value={Math.round(overview.totals.compositeScore).toLocaleString("zh-CN")}
        />
        <StatCard label="点赞" value={overview.totals.likes.toLocaleString("zh-CN")} />
        <StatCard label="评论" value={overview.totals.comments.toLocaleString("zh-CN")} />
        <StatCard label="收藏" value={overview.totals.favorites.toLocaleString("zh-CN")} />
        <StatCard label="转发" value={overview.totals.shares.toLocaleString("zh-CN")} />
      </div>

      {/* 30 天趋势图 */}
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
          data={overview.trend.map((p) => ({
            date: p.date.slice(5),
            综合得分: Math.round(p.compositeScore),
          }))}
          dataKey="综合得分"
          xKey="date"
          color="#2E75B6"
          height={260}
        />
      </GlassCard>

      {/* Tabs · 数据分析 / 分析报告 */}
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "analytics" | "reports")}
      >
        <TabsList variant="line" className="mb-4">
          <TabsTrigger value="analytics">数据分析</TabsTrigger>
          <TabsTrigger value="reports">分析报告</TabsTrigger>
        </TabsList>
        <TabsContent value="analytics">
          <DataAnalysisTab accountId={account.id} platform={account.platform} />
        </TabsContent>
        <TabsContent value="reports">
          <ReportsTab account={account} reports={reports} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { crawlAccountOnDemand } from "@/app/actions/account-analytics";
import { CrawlRunStatusCard } from "@/components/account-analytics/crawl-run-status-card";
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
  const [refreshToken, setRefreshToken] = useState(0);
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
        "已派发抓取任务 · 下方进度卡会实时刷新；抓取完成后报告通常会在 1-3 分钟内生成",
        { duration: 6000 },
      );
      setRefreshToken((n) => n + 1);
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

      {/* 抓取进度卡 —— 显示最近一次 collection_run 状态 */}
      <CrawlRunStatusCard
        accountId={account.id}
        accountSource={account.source}
        refreshToken={refreshToken}
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
          <DataAnalysisTab
            accountId={account.id}
            platform={account.platform}
            trend={overview.trend}
          />
        </TabsContent>
        <TabsContent value="reports">
          <ReportsTab account={account} reports={reports} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

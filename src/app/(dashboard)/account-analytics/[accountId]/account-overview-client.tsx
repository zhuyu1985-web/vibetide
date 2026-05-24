"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { ArrowLeft, FileText, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { GlassCard } from "@/components/shared/glass-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LineChartCard } from "@/components/charts/line-chart-card";
import { crawlAccountOnDemand } from "@/app/actions/account-analytics";
import { getPlatformMeta } from "@/lib/account-analytics/platform-meta";
import type {
  AccountAnalyticsOverview,
  AnalyzableAccountRow,
  ReportSummary,
} from "@/lib/dal/account-analytics";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<ReportSummary["status"], string> = {
  pending: "排队中",
  crawling: "抓取中",
  scoring: "评分中",
  analyzing: "AI 分析中",
  ready: "已就绪",
  failed: "失败",
};

export const REPORT_TYPE_LABELS: Record<ReportSummary["reportType"], string> = {
  daily: "日报",
  weekly: "周报",
  monthly: "月报",
  custom: "自定义",
};

type ReportTypeFilter = "all" | ReportSummary["reportType"];

const REPORT_TYPE_FILTER_ORDER: ReportTypeFilter[] = [
  "all",
  "daily",
  "weekly",
  "monthly",
  "custom",
];

interface Props {
  account: AnalyzableAccountRow;
  overview: AccountAnalyticsOverview;
  reports: ReportSummary[];
}

export function AccountOverviewClient({ account, overview, reports }: Props) {
  const platformLabel = getPlatformMeta(account.platform).label;

  const [typeFilter, setTypeFilter] = useState<ReportTypeFilter>("all");
  const [crawling, startCrawl] = useTransition();

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

  const typeCounts = useMemo(() => {
    const map = new Map<ReportSummary["reportType"], number>();
    for (const r of reports) {
      map.set(r.reportType, (map.get(r.reportType) ?? 0) + 1);
    }
    return map;
  }, [reports]);

  const filteredReports = useMemo(
    () =>
      typeFilter === "all"
        ? reports
        : reports.filter((r) => r.reportType === typeFilter),
    [reports, typeFilter],
  );

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

      {/* 历史报告列表 */}
      <GlassCard padding="lg">
        <div className="mb-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-semibold text-[#1F3864] dark:text-blue-200">
              历史报告
            </h3>
            <p className="text-[12px] text-gray-500 mt-0.5">
              支持按周期类型筛选：日报 / 周报 / 月报 / 自定义
            </p>
          </div>
          {/* reportType 切换 chip */}
          <div className="flex flex-wrap gap-1.5">
            {REPORT_TYPE_FILTER_ORDER.map((t) => {
              const active = typeFilter === t;
              const count =
                t === "all"
                  ? reports.length
                  : (typeCounts.get(t as ReportSummary["reportType"]) ?? 0);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-medium transition-colors border-0 cursor-pointer",
                    active
                      ? "bg-[#2E75B6] text-white"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700",
                  )}
                >
                  {t === "all"
                    ? "全部"
                    : REPORT_TYPE_LABELS[t as ReportSummary["reportType"]]}
                  <span className="text-[10px] opacity-70">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
        {filteredReports.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-8">
            {reports.length === 0
              ? '暂无报告。点右上角"生成今日报告"开始。'
              : `当前筛选「${
                  typeFilter === "all"
                    ? "全部"
                    : REPORT_TYPE_LABELS[typeFilter as ReportSummary["reportType"]]
                }」下暂无报告，可切回其他类型查看。`}
          </p>
        ) : (
          <div className="space-y-2.5">
            {filteredReports.map((report) => (
              <Link
                key={report.id}
                href={`/account-analytics/${account.id}/reports/${report.id}`}
                className="block rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-white dark:bg-gray-900 p-4 hover:border-[#2E75B6] transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <FileText size={14} className="text-[#2E75B6]" />
                      <span className="text-[14px] font-semibold text-[#1F3864] dark:text-blue-200">
                        {report.periodStart === report.periodEnd
                          ? report.periodStart
                          : `${report.periodStart} ~ ${report.periodEnd}`}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] border-[#2E75B6] text-[#2E75B6]"
                      >
                        {REPORT_TYPE_LABELS[report.reportType]}
                      </Badge>
                      <Badge
                        variant={report.status === "ready" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {STATUS_LABELS[report.status]}
                      </Badge>
                    </div>
                    {report.executiveSummary && (
                      <p className="text-[12.5px] text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-2">
                        {report.executiveSummary}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-3 text-[11.5px] text-gray-500">
                      <span>📹 {report.kpis.videos}</span>
                      <span>👍 {report.kpis.likes.toLocaleString("zh-CN")}</span>
                      <span>💬 {report.kpis.comments.toLocaleString("zh-CN")}</span>
                      <span>⭐ {report.kpis.favorites.toLocaleString("zh-CN")}</span>
                      <span>↗ {report.kpis.shares.toLocaleString("zh-CN")}</span>
                    </div>
                  </div>
                  {report.generatedAt && (
                    <div className="shrink-0 text-[11px] text-gray-400 whitespace-nowrap">
                      {report.generatedAt.slice(5, 16).replace("T", " ")}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

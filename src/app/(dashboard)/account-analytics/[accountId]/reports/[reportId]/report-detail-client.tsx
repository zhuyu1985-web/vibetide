"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowLeft, Download, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/shared/glass-card";
import { DataTable } from "@/components/shared/data-table";
import { ChapterLabel } from "@/components/account-analytics/chapter-label";
import { ReportCover } from "@/components/account-analytics/report-cover";
import { RankingCard } from "@/components/account-analytics/ranking-card";
import { PatternTable } from "@/components/account-analytics/pattern-table";
import { SuggestionList } from "@/components/account-analytics/suggestion-list";
import { PeriodOverview } from "@/components/account-analytics/period-overview";
import { loadReportFullDataPage } from "@/app/actions/account-analytics";
import type { AccountReportDetail, FullDataRow } from "@/lib/dal/account-analytics";

const PLATFORM_LABELS: Record<string, string> = {
  douyin: "抖音",
  kuaishou: "快手",
  weibo: "微博",
  wechat: "微信",
  bilibili: "B 站",
  xiaohongshu: "小红书",
};

const REPORT_TYPE_LABELS: Record<string, string> = {
  daily: "日报",
  weekly: "周报",
  monthly: "月报",
  custom: "自定义",
};

interface Props {
  accountId: string;
  detail: AccountReportDetail;
}

export function ReportDetailClient({ accountId, detail }: Props) {
  const { report, topAttributions, patterns, recommendations, fullData, fullDataTotal, periodOverview } = detail;
  const platformLabel = PLATFORM_LABELS[report.platform] ?? report.platform;
  const reportTypeLabel = REPORT_TYPE_LABELS[report.reportType] ?? "报告";
  const isSingleDay = report.periodStart === report.periodEnd;
  const periodLabel = isSingleDay
    ? `${platformLabel}账号 · ${reportTypeLabel} · ${report.periodStart}`
    : `${platformLabel}账号 · ${reportTypeLabel} · ${report.periodStart} ~ ${report.periodEnd}`;

  // ─── 完整数据分页状态 ────────────────────────────────────────
  const [rows, setRows] = useState<FullDataRow[]>(fullData);
  const [total, setTotal] = useState<number>(fullDataTotal);
  const [hasMore, setHasMore] = useState<boolean>(fullData.length < fullDataTotal);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(() => {
    if (isPending || !hasMore) return;
    setLoadError(null);
    startTransition(async () => {
      const res = await loadReportFullDataPage({
        reportId: report.id,
        offset: rows.length,
        limit: 20,
      });
      if (!res.success) {
        setLoadError(res.error);
        return;
      }
      // 兜底去重（同一条不会重复 push）
      const knownIds = new Set(rows.map((r) => r.collectedItemId));
      const fresh = res.rows.filter((r) => !knownIds.has(r.collectedItemId));
      setRows((prev) => [...prev, ...fresh]);
      setTotal(res.total);
      setHasMore(res.hasMore);
    });
  }, [isPending, hasMore, rows, report.id]);

  // 触底自动加载
  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;
    const el = sentinelRef.current;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore]);

  return (
    <div className="space-y-6">
      {/* Back link only —— actions 移到 cover 右侧 */}
      <div className="flex items-center justify-between">
        <Link
          href={`/account-analytics/${accountId}?tab=reports`}
          className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-[#2E75B6]"
        >
          <ArrowLeft size={14} />
          返回账号概览
        </Link>
      </div>

      {/* Cover —— 紧凑版（账号信息 + 热度 + KPI 同卡片；徽章带平台 + 报告类型） */}
      <ReportCover
        badge={`${platformLabel} · ${reportTypeLabel}`}
        accountName={report.accountName}
        platform={report.platform}
        avatarUrl={report.accountAvatarUrl}
        periodLabel={periodLabel}
        highlightValue={(
          report.kpis.likes +
          report.kpis.comments * 5 +
          report.kpis.shares * 5 +
          report.kpis.favorites * 2
        ).toLocaleString("zh-CN")}
        highlightLabel="本期综合指数"
        actions={
          <>
            <Button variant="outline" size="sm">
              <RefreshCw size={14} className="mr-1.5" />
              重新生成
            </Button>
            <Button variant="outline" size="sm">
              <Download size={14} className="mr-1.5" />
              导出 PDF
            </Button>
          </>
        }
        kpis={[
          { label: "发布视频", value: report.kpis.videos.toLocaleString("zh-CN") },
          { label: "总点赞", value: report.kpis.likes.toLocaleString("zh-CN"), accent: "#E84057" },
          { label: "总评论", value: report.kpis.comments.toLocaleString("zh-CN"), accent: "#2E75B6" },
          { label: "总收藏", value: report.kpis.favorites.toLocaleString("zh-CN"), accent: "#2A9D8F" },
          { label: "总转发", value: report.kpis.shares.toLocaleString("zh-CN"), accent: "#E9A820" },
        ]}
      />

      {/* 报告主体 —— 用 GlassCard 包一层与 dashboard 视觉对齐 */}
      <GlassCard padding="lg">
        {/* Executive summary */}
        {report.executiveSummary && (
          <div className="rounded-xl border-l-[3px] border-[#FFD700] bg-[#FFF9E6] dark:bg-yellow-950/30 px-4 py-3 mb-4 text-[13.5px] text-gray-700 dark:text-gray-300 leading-relaxed">
            <span className="font-semibold text-[#1F3864] dark:text-blue-200">本日速读 · </span>
            {report.executiveSummary}
          </div>
        )}

        {/* Chapter 01 · 周期总览（标周期段 + 每日发布量柱状图 + Top10 排行 + 均值 footer） */}
        <ChapterLabel index={1} title="周期总览" />
        <div className="mb-8">
          <PeriodOverview overview={periodOverview} />
        </div>

        {/* Chapter 02 · Top N 高分视频 —— 直接渲染 LLM 已归因的全部条目，确保每条都有分析
            （之前按 periodOverview.top10 匹配会因新旧公式排序差异导致部分卡片无归因） */}
        <ChapterLabel index={2} title={`Top ${topAttributions.length} 高分视频`} />
        <div className="flex flex-col gap-4 mb-8">
          {topAttributions.map((attr) => (
            <RankingCard
              key={attr.id}
              rank={attr.rank}
              title={attr.title}
              metrics={attr.metrics}
              whyViralSummary={attr.whyViralSummary}
              attributionMarkdown={attr.attributionMarkdown}
              tags={[...attr.primaryTags, ...attr.secondaryTags]}
            />
          ))}
        </div>

        {/* Chapter 03 · 出圈内容共性规律 */}
        <ChapterLabel index={3} title="出圈内容六大共性规律" />
        <div className="mb-8">
          <PatternTable patterns={patterns} />
        </div>

        {/* Chapter 04 · 运营建议 */}
        <ChapterLabel index={4} title="五条运营建议" />
        <div className="mb-8">
          <SuggestionList items={recommendations} />
        </div>

        {/* Chapter 05 · 完整数据 —— 首页 20 条，触底/点击自动追加 */}
        <ChapterLabel index={5} title="完整数据" />
        <div>
          <DataTable
            framed={false}
            rows={rows}
            rowKey={(row) => row.collectedItemId}
            columns={[
              {
                key: "rank",
                header: "#",
                width: "60px",
                align: "center",
                render: (row) => (
                  <span
                    className={
                      row.isTop5
                        ? "font-semibold text-[#1F3864] dark:text-blue-300"
                        : "text-gray-500"
                    }
                  >
                    {row.rank}
                  </span>
                ),
              },
              {
                key: "title",
                header: "标题",
                render: (row) => (
                  <span
                    className={
                      row.isTop5
                        ? "font-medium text-[#1F3864] dark:text-blue-200"
                        : undefined
                    }
                    title={row.title}
                  >
                    {row.title}
                  </span>
                ),
              },
              {
                key: "likes",
                header: "赞",
                width: "70px",
                align: "right",
                render: (row) => row.likes.toLocaleString("zh-CN"),
              },
              {
                key: "comments",
                header: "评",
                width: "70px",
                align: "right",
                render: (row) => row.comments.toLocaleString("zh-CN"),
              },
              {
                key: "favorites",
                header: "藏",
                width: "70px",
                align: "right",
                render: (row) => row.favorites.toLocaleString("zh-CN"),
              },
              {
                key: "shares",
                header: "转",
                width: "70px",
                align: "right",
                render: (row) => row.shares.toLocaleString("zh-CN"),
              },
              {
                key: "score",
                header: "得分",
                width: "90px",
                align: "right",
                render: (row) => (
                  <span className="font-bold text-[#E84057]">
                    {row.compositeScore.toLocaleString("zh-CN")}
                  </span>
                ),
              },
            ]}
            emptyMessage="本期暂无视频数据"
          />

          {/* 分页加载更多 + 触底自动加载 */}
          {hasMore && (
            <div ref={sentinelRef} className="flex justify-center mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={loadMore}
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 size={14} className="mr-1.5 animate-spin" />
                    加载中...
                  </>
                ) : (
                  <>加载更多（剩 {Math.max(total - rows.length, 0)} 条）</>
                )}
              </Button>
            </div>
          )}

          {loadError && (
            <p className="mt-2 text-center text-[12px] text-red-500">{loadError}</p>
          )}

          <p className="mt-3 text-[11px] text-gray-400">
            已加载 {rows.length} / 共 {total} 条 · 金色行为 Top 5 · 综合得分 = 点赞×1 + 评论×5 + 转发×5 + 收藏×2
            {report.generatedAt &&
              ` · 报告生成时间 ${report.generatedAt.slice(0, 16).replace("T", " ")}`}
          </p>
        </div>
      </GlassCard>
    </div>
  );
}


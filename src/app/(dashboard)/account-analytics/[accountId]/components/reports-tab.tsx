"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  AnalyzableAccountRow,
  ReportSummary,
} from "@/lib/dal/account-analytics";

const STATUS_LABELS: Record<ReportSummary["status"], string> = {
  pending: "排队中",
  crawling: "抓取中",
  scoring: "评分中",
  analyzing: "AI 分析中",
  ready: "已就绪",
  failed: "失败",
};

const REPORT_TYPE_LABELS: Record<ReportSummary["reportType"], string> = {
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
  reports: ReportSummary[];
}

export function ReportsTab({ account, reports }: Props) {
  const [typeFilter, setTypeFilter] = useState<ReportTypeFilter>("all");

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
        {/* reportType 切换 */}
        <Tabs
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as ReportTypeFilter)}
        >
          <TabsList variant="default">
            {REPORT_TYPE_FILTER_ORDER.map((t) => {
              const count =
                t === "all"
                  ? reports.length
                  : (typeCounts.get(t as ReportSummary["reportType"]) ?? 0);
              return (
                <TabsTrigger key={t} value={t}>
                  {t === "all"
                    ? "全部"
                    : REPORT_TYPE_LABELS[t as ReportSummary["reportType"]]}
                  <span className="ml-1 text-[10px] opacity-70">{count}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
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
  );
}

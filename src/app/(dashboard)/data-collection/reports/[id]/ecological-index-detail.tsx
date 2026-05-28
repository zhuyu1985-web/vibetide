"use client";

// 生态文明传播指数报告详情页 - 4 tab
// Spec: docs/superpowers/specs/2026-05-26-ecological-index-report-design.md §7.4
//
// Tab 1: 概览 - 榜首/末位卡片 + 关键统计 + Top10 条形图 + 梯队分布 + 3 个下载按钮
// Tab 2: 综合排行 - 39 行完整表
// Tab 3: 指标明细 - 15 个二级指标 Collapse,每个显示该指标 Top 2 区县
// Tab 4: 资源快照 - scope / dataset / 时间窗 / 耗时

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronRight,
  Database,
  FileSpreadsheet,
  FileText,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/shared/glass-card";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DataTable } from "@/components/shared/data-table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { EcologicalIndexReportDetail } from "@/lib/dal/research/ecological-index-reports";

type StatusKey = "pending" | "generating" | "ready" | "failed";

const STATUS_LABEL: Record<StatusKey, string> = {
  pending: "排队中",
  generating: "生成中",
  ready: "已完成",
  failed: "失败",
};

const STATUS_CLASS: Record<StatusKey, string> = {
  pending: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300",
  generating:
    "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 animate-pulse",
  ready:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  failed: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

type MediaTier = "central" | "industry" | "municipal" | "district";

const DIM_LABEL: Record<MediaTier, string> = {
  central: "中央媒体",
  industry: "行业媒体",
  municipal: "市级媒体",
  district: "区县媒体",
};

type SubIndicator = "count" | "richness" | "freq";

const SUB_LABEL: Record<SubIndicator, string> = {
  count: "报道 / 活动数量",
  richness: "主题丰富度",
  freq: "传播速度",
};

const TIER_FILE_LABEL: Record<MediaTier, string> = {
  central: "中央",
  industry: "行业",
  municipal: "市级",
  district: "区县",
};

interface Props {
  report: EcologicalIndexReportDetail;
}

export function EcologicalIndexDetail({ report: initial }: Props) {
  const router = useRouter();
  const [report, setReport] = useState(initial);

  // 同步 server 端 props 变化(router.refresh 重渲染 server component 后 props 更新)
  useEffect(() => {
    setReport(initial);
  }, [initial]);

  // 生成中状态: 每 5 秒触发 server 端重新渲染拿最新进度
  useEffect(() => {
    if (report.status !== "generating" && report.status !== "pending") return;
    const tick = setInterval(() => {
      router.refresh();
    }, 5000);
    return () => clearInterval(tick);
  }, [report.status, router]);

  const agg = report.aggregatesJson;

  function handleDownload(
    url: string | null | undefined,
    filename: string,
  ): void {
    if (!url) {
      toast.warning("该文件尚未生成或生成失败");
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const statusKey = report.status as StatusKey;
  const headerMeta: string[] = [STATUS_LABEL[statusKey]];
  if (report.status === "generating" && report.currentStep) {
    headerMeta.push(`当前步骤:${report.currentStep}`);
  }
  if (report.status === "ready" && report.completedAt) {
    headerMeta.push(
      `完成于 ${new Date(report.completedAt).toLocaleString("zh-CN")}`,
    );
  }
  if (report.status === "failed" && report.errorMessage) {
    headerMeta.push(report.errorMessage);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={report.title}
        description={headerMeta.join(" · ")}
        actions={
          <Link href="/data-collection/reports?type=ecological_index">
            <Button variant="ghost">
              <ArrowLeft className="size-4 mr-1.5" />
              返回列表
            </Button>
          </Link>
        }
      />

      <div className="flex items-center gap-2 -mt-3 text-sm">
        <Badge variant="secondary" className={STATUS_CLASS[statusKey]}>
          {STATUS_LABEL[statusKey]}
        </Badge>
        <span className="text-muted-foreground">
          统计年份 {report.year} · 时间窗 {report.searchSnapshot.windowStart}{" "}
          ~ {report.searchSnapshot.windowEnd}
        </span>
      </div>

      {/* 生成中状态:轮询提示 */}
      {(report.status === "pending" || report.status === "generating") && (
        <GlassCard className="p-6 flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <div className="text-sm text-muted-foreground">
            报告生成中,当前步骤:
            <strong className="text-foreground">
              {report.currentStep ?? "排队中"}
            </strong>
          </div>
          <div className="text-xs text-muted-foreground">
            页面每 5 秒自动刷新
          </div>
        </GlassCard>
      )}

      {/* 失败状态 */}
      {report.status === "failed" && (
        <GlassCard className="p-6 border border-rose-300 dark:border-rose-700">
          <h3 className="font-medium text-rose-700 dark:text-rose-400">
            生成失败
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {report.errorMessage ?? "未知错误"}
          </p>
        </GlassCard>
      )}

      {/* ready 状态:完整 4 tab */}
      {report.status === "ready" && agg && agg.kind === "ecological_index" && (
        <Tabs defaultValue="overview" className="gap-2">
          <TabsList variant="line">
            <TabsTrigger value="overview">概览</TabsTrigger>
            <TabsTrigger value="ranking">综合排行</TabsTrigger>
            <TabsTrigger value="indicators">指标明细</TabsTrigger>
            <TabsTrigger value="snapshot">资源快照</TabsTrigger>
          </TabsList>

          {/* === Tab 1: 概览 === */}
          <TabsContent value="overview" className="mt-4 space-y-4">
            <OverviewTab report={report} agg={agg} onDownload={handleDownload} />
          </TabsContent>

          {/* === Tab 2: 综合排行 === */}
          <TabsContent value="ranking" className="mt-4">
            <RankingTab ranked={agg.ranked} />
          </TabsContent>

          {/* === Tab 3: 指标明细 === */}
          <TabsContent value="indicators" className="mt-4 space-y-2">
            <IndicatorsTab agg={agg} />
          </TabsContent>

          {/* === Tab 4: 资源快照 === */}
          <TabsContent value="snapshot" className="mt-4 space-y-4">
            <SnapshotTab report={report} />
          </TabsContent>
        </Tabs>
      )}

      {/* ready 但 agg 缺失/格式不对(理论上不该发生) */}
      {report.status === "ready" &&
        (!agg || agg.kind !== "ecological_index") && (
          <GlassCard className="p-6">
            <p className="text-sm text-muted-foreground">
              报告已完成,但聚合数据缺失或格式异常。请联系管理员重新生成。
            </p>
          </GlassCard>
        )}
    </div>
  );
}

// ============================================================================
// Tab 1: 概览
// ============================================================================

interface OverviewTabProps {
  report: EcologicalIndexReportDetail;
  agg: Extract<
    NonNullable<EcologicalIndexReportDetail["aggregatesJson"]>,
    { kind: "ecological_index" }
  >;
  onDownload: (url: string | null | undefined, filename: string) => void;
}

function OverviewTab({ report, agg, onDownload }: OverviewTabProps) {
  const top = agg.ranked[0];
  const bottom = agg.ranked[agg.ranked.length - 1];

  return (
    <>
      {/* 关键统计 + 榜首 / 末位 4 卡 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassCard className="p-4">
          <div className="text-xs text-muted-foreground">榜首区县</div>
          <div className="text-lg font-semibold mt-1">
            {top?.name ?? "—"}
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">
            {top ? top.composite.toFixed(2) : "—"}
          </div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-xs text-muted-foreground">末位区县</div>
          <div className="text-lg font-semibold mt-1">
            {bottom?.name ?? "—"}
          </div>
          <div className="text-2xl font-bold text-rose-600 mt-1">
            {bottom ? bottom.composite.toFixed(2) : "—"}
          </div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-xs text-muted-foreground">平均 / 中位</div>
          <div className="text-lg font-semibold mt-1">
            {agg.stats.mean.toFixed(2)} / {agg.stats.median.toFixed(2)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            标差 {agg.stats.stdev.toFixed(2)} · 分差{" "}
            {agg.stats.span.toFixed(2)}
          </div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="text-xs text-muted-foreground">梯队分布</div>
          <div className="text-sm font-semibold mt-1 space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-emerald-700 dark:text-emerald-400">
                高分 (≥80)
              </span>
              <span>{agg.stats.tier_high} 个</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sky-700 dark:text-sky-400">
                中分 (72-80)
              </span>
              <span>{agg.stats.tier_mid} 个</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">
                低分 (&lt;72)
              </span>
              <span>{agg.stats.tier_low} 个</span>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Top 10 横向条形图(纯 HTML / Tailwind 实现) */}
      <GlassCard className="p-4">
        <h3 className="font-semibold text-base mb-3">Top 10 综合得分</h3>
        <div className="space-y-1.5">
          {agg.ranked.slice(0, 10).map((r) => {
            // 按 [60, 100] 区间归一化条形宽度
            const pct = Math.max(
              0,
              Math.min(100, ((r.composite - 60) / 40) * 100),
            );
            const color =
              r.composite >= 80
                ? "bg-emerald-500"
                : r.composite >= 72
                  ? "bg-sky-400"
                  : "bg-gray-400";
            return (
              <div key={r.name} className="flex items-center gap-2 text-sm">
                <div className="w-8 text-right text-muted-foreground">
                  {r.rank}
                </div>
                <div className="w-20 truncate">{r.name}</div>
                <div className="flex-1 h-5 bg-muted/40 rounded overflow-hidden relative">
                  <div
                    className={cn("h-full transition-all", color)}
                    style={{ width: `${pct}%` }}
                  />
                  <div className="absolute right-2 top-0 h-full flex items-center text-xs font-medium">
                    {r.composite.toFixed(2)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          条形按 [60, 100] 区间归一化 · 平均{" "}
          {agg.stats.mean.toFixed(2)} · 中位{" "}
          {agg.stats.median.toFixed(2)}
        </p>
      </GlassCard>

      {/* 下载按钮区 */}
      <GlassCard className="p-4 space-y-2">
        <h3 className="font-semibold text-base mb-2">下载文件</h3>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              onDownload(
                report.excelFileUrl,
                `${report.title}-19sheet.xlsx`,
              )
            }
            disabled={!report.excelFileUrl}
          >
            <FileSpreadsheet className="size-4 mr-1.5" />
            19-sheet 可验证 xlsx
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              onDownload(report.wordFileUrl, `${report.title}.docx`)
            }
            disabled={!report.wordFileUrl}
          >
            <FileText className="size-4 mr-1.5" />
            排行榜及解读 docx
          </Button>
          {(
            ["central", "industry", "municipal", "district"] as MediaTier[]
          ).map((tier) => {
            const url = report.contentSourceFileUrls?.[tier];
            return (
              <Button
                key={tier}
                variant="outline"
                onClick={() =>
                  onDownload(
                    url,
                    `${report.title}-${TIER_FILE_LABEL[tier]}.xlsx`,
                  )
                }
                disabled={!url}
              >
                <Database className="size-4 mr-1.5" />
                内容源({TIER_FILE_LABEL[tier]})
              </Button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          文件链接有效期 24 小时,过期请刷新页面重新获取签名 URL。
        </p>
      </GlassCard>
    </>
  );
}

// ============================================================================
// Tab 2: 综合排行
// ============================================================================

interface RankingRow {
  rank: number;
  name: string;
  central: number;
  industry: number;
  municipal: number;
  district: number;
  public: number;
  composite: number;
}

function RankingTab({ ranked }: { ranked: RankingRow[] }) {
  return (
    <DataTable<RankingRow>
      rows={ranked}
      rowKey={(r) => `${r.rank}-${r.name}`}
      columns={[
        {
          key: "rank",
          header: "排名",
          width: "w-16",
          align: "center",
          render: (r) => r.rank,
        },
        {
          key: "name",
          header: "区县",
          width: "w-32",
          render: (r) => r.name,
        },
        {
          key: "central",
          header: "中央",
          width: "w-20",
          align: "right",
          render: (r) => r.central.toFixed(2),
        },
        {
          key: "industry",
          header: "行业",
          width: "w-20",
          align: "right",
          render: (r) => r.industry.toFixed(2),
        },
        {
          key: "municipal",
          header: "市级",
          width: "w-20",
          align: "right",
          render: (r) => r.municipal.toFixed(2),
        },
        {
          key: "district",
          header: "区县",
          width: "w-20",
          align: "right",
          render: (r) => r.district.toFixed(2),
        },
        {
          key: "public",
          header: "公众",
          width: "w-20",
          align: "right",
          render: (r) => r.public.toFixed(2),
        },
        {
          key: "composite",
          header: "综合",
          width: "w-24",
          align: "right",
          render: (r) => (
            <span
              className={cn(
                "font-semibold",
                r.composite >= 80
                  ? "text-emerald-600"
                  : r.composite >= 72
                    ? "text-sky-600"
                    : "text-gray-500",
              )}
            >
              {r.composite.toFixed(2)}
            </span>
          ),
        },
      ]}
      emptyMessage={
        <div className="py-8 text-center text-muted-foreground">
          无排名数据
        </div>
      }
    />
  );
}

// ============================================================================
// Tab 3: 指标明细 - 4 + 1 = 5 个 Collapse 块,共 15 个二级指标
// ============================================================================

interface IndicatorsTabProps {
  agg: Extract<
    NonNullable<EcologicalIndexReportDetail["aggregatesJson"]>,
    { kind: "ecological_index" }
  >;
}

function IndicatorsTab({ agg }: IndicatorsTabProps) {
  const mediaTiers: MediaTier[] = [
    "central",
    "industry",
    "municipal",
    "district",
  ];
  const subs: SubIndicator[] = ["count", "richness", "freq"];

  return (
    <>
      {mediaTiers.map((tier) => (
        <Collapsible key={tier} defaultOpen>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="w-full text-left p-3 rounded bg-muted/30 hover:bg-muted/50 flex items-center gap-2 group"
            >
              <ChevronRight className="size-4 transition-transform group-data-[state=open]:rotate-90 data-[state=open]:rotate-90" />
              <span className="font-medium">{DIM_LABEL[tier]}</span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="p-3 pl-9 space-y-3">
            {subs.map((sub) => {
              const top = agg.ranked
                .map((r) => ({
                  name: r.name,
                  raw: agg.rawMedia[r.name]?.[tier]?.[sub] ?? 0,
                  scaled: agg.scaledMedia[r.name]?.[tier]?.[sub] ?? 0,
                }))
                .sort((a, b) => b.scaled - a.scaled)
                .slice(0, 2);
              return (
                <div key={sub} className="text-sm">
                  <div className="font-medium text-muted-foreground">
                    {SUB_LABEL[sub]}
                  </div>
                  <div className="flex flex-wrap gap-4 mt-1">
                    {top.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        无数据
                      </span>
                    ) : (
                      top.map((t) => (
                        <span key={t.name} className="text-xs">
                          {t.name}:{" "}
                          <strong className="text-foreground">
                            {t.scaled.toFixed(2)}
                          </strong>
                          <span className="text-muted-foreground">
                            {" "}
                            (原始{" "}
                            {sub === "count"
                              ? Math.round(t.raw)
                              : t.raw.toFixed(2)}
                            )
                          </span>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </CollapsibleContent>
        </Collapsible>
      ))}

      {/* 公众类 */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full text-left p-3 rounded bg-muted/30 hover:bg-muted/50 flex items-center gap-2 group"
          >
            <ChevronRight className="size-4 transition-transform group-data-[state=open]:rotate-90 data-[state=open]:rotate-90" />
            <span className="font-medium">公众行为引导</span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="p-3 pl-9 space-y-3">
          {subs.map((sub) => {
            const top = agg.ranked
              .map((r) => ({
                name: r.name,
                raw: agg.rawPublic[r.name]?.[sub] ?? 0,
                scaled: agg.scaledPublic[r.name]?.[sub] ?? 0,
              }))
              .sort((a, b) => b.scaled - a.scaled)
              .slice(0, 2);
            return (
              <div key={sub} className="text-sm">
                <div className="font-medium text-muted-foreground">
                  {SUB_LABEL[sub]}
                </div>
                <div className="flex flex-wrap gap-4 mt-1">
                  {top.length === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      无数据
                    </span>
                  ) : (
                    top.map((t) => (
                      <span key={t.name} className="text-xs">
                        {t.name}:{" "}
                        <strong className="text-foreground">
                          {t.scaled.toFixed(2)}
                        </strong>
                        <span className="text-muted-foreground">
                          {" "}
                          (原始{" "}
                          {sub === "count"
                            ? Math.round(t.raw)
                            : t.raw.toFixed(2)}
                          )
                        </span>
                      </span>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}

// ============================================================================
// Tab 4: 资源快照
// ============================================================================

function SnapshotTab({ report }: { report: EcologicalIndexReportDetail }) {
  const durationSec =
    report.startedAt && report.completedAt
      ? Math.round(
          (new Date(report.completedAt).getTime() -
            new Date(report.startedAt).getTime()) /
            1000,
        )
      : null;

  return (
    <>
      <GlassCard className="p-4">
        <h3 className="font-semibold text-base mb-3">引用的资源</h3>
        <div className="text-sm space-y-2">
          <div>
            <span className="text-muted-foreground">媒体名单 scope:</span>{" "}
            <Link
              href="/data-collection/reports/resources?tab=scopes"
              className="text-primary hover:underline font-mono text-xs"
            >
              {report.scopeId}
            </Link>
          </div>
          <div>
            <span className="text-muted-foreground">活动数据集 dataset:</span>{" "}
            <Link
              href="/data-collection/reports/resources?tab=datasets"
              className="text-primary hover:underline font-mono text-xs"
            >
              {report.activityDatasetId}
            </Link>
          </div>
          <div>
            <span className="text-muted-foreground">统计年份:</span>{" "}
            <span className="font-medium">{report.year}</span>
          </div>
          <div>
            <span className="text-muted-foreground">时间窗口:</span>{" "}
            <span className="font-medium">
              {report.searchSnapshot.windowStart} ~{" "}
              {report.searchSnapshot.windowEnd}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">
              同时生成 4 tier 内容源 xlsx:
            </span>{" "}
            <span className="font-medium">
              {report.searchSnapshot.includeContentSource ? "是" : "否"}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">快照捕获时间:</span>{" "}
            <span className="font-medium">
              {new Date(report.searchSnapshot.capturedAt).toLocaleString(
                "zh-CN",
              )}
            </span>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-4">
        <h3 className="font-semibold text-base mb-3">生成耗时</h3>
        <div className="text-sm space-y-1 text-muted-foreground">
          <div>
            创建:{" "}
            <span className="text-foreground">
              {new Date(report.createdAt).toLocaleString("zh-CN")}
            </span>
          </div>
          <div>
            开始:{" "}
            <span className="text-foreground">
              {report.startedAt
                ? new Date(report.startedAt).toLocaleString("zh-CN")
                : "—"}
            </span>
          </div>
          <div>
            完成:{" "}
            <span className="text-foreground">
              {report.completedAt
                ? new Date(report.completedAt).toLocaleString("zh-CN")
                : "—"}
            </span>
          </div>
          {durationSec !== null && (
            <div>
              总耗时:{" "}
              <strong className="text-foreground">{durationSec} 秒</strong>
            </div>
          )}
          {report.generatedByName && (
            <div>
              触发人:{" "}
              <span className="text-foreground">
                {report.generatedByName}
              </span>
            </div>
          )}
        </div>
      </GlassCard>
    </>
  );
}

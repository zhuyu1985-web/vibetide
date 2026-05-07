"use client";

// src/app/(dashboard)/research/reports/[id]/report-client.tsx
//
// A5 Phase 5 — 报告详情 Client Component
//
// 负责：
//   1. 状态机 UI：pending / generating（spinner + currentStep）
//                  failed（错误信息 + 重试）
//                  ready（HTML + 顶栏操作 + AI fallback banner + 4 charts grid）
//   2. Polling：每 3s 调 server action `pollReport(reportId)` 直到 ready / failed
//   3. Chart hydration：把 server 端 HTML 里的 `<div data-chart=...>` 占位符
//      用 createRoot 替换为 Recharts 组件
//
// Phase 5 仅完成 UI 骨架；导出 / 快照 / 分享链接按钮留 Phase 8/9 接 server actions。

import { useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import Link from "next/link";
import { toast } from "sonner";
import { History, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlassCard } from "@/components/shared/glass-card";
import { PageHeader } from "@/components/shared/page-header";
import { BarChartCard } from "@/components/charts/bar-chart-card";
import { DonutChartCard } from "@/components/charts/donut-chart-card";
import { HorizontalBarChartCard } from "@/components/charts/horizontal-bar-chart-card";
import { LineChartCard } from "@/components/charts/line-chart-card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getSignedUrlForReport,
  pollReport,
  regenerateReport,
  saveAsSnapshot,
  type ReportPollStatus,
} from "@/app/actions/research/reports";
import type { AggregatesJson } from "@/db/schema/research/reports";

interface SnapshotSummary {
  id: string;
  snapshotName: string;
  createdAt: string;
}

interface Props {
  reportId: string;
  title: string;
  isSnapshot: boolean;
  initialStatus: ReportPollStatus;
  initialCurrentStep: string | null;
  initialErrorMessage: string | null;
  initialReportHtml: string | null;
  initialWordFileUrl: string | null;
  initialExcelFileUrl: string | null;
  initialAggregates: AggregatesJson | null;
  initialIsAiFallback: boolean;
  // Phase 9：母版报告加载的快照列表（快照报告恒为空数组）
  snapshots: SnapshotSummary[];
}

const POLL_INTERVAL_MS = 3000;

export function ReportClient(props: Props) {
  const [status, setStatus] = useState<ReportPollStatus>(props.initialStatus);
  const [currentStep, setCurrentStep] = useState<string | null>(
    props.initialCurrentStep,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(
    props.initialErrorMessage,
  );
  const [reportHtml, setReportHtml] = useState<string | null>(
    props.initialReportHtml,
  );
  const [wordFileUrl, setWordFileUrl] = useState<string | null>(
    props.initialWordFileUrl,
  );
  const [excelFileUrl, setExcelFileUrl] = useState<string | null>(
    props.initialExcelFileUrl,
  );
  const [aggregates, setAggregates] = useState<AggregatesJson | null>(
    props.initialAggregates,
  );
  const [isAiFallback, setIsAiFallback] = useState<boolean>(
    props.initialIsAiFallback,
  );
  const [regenerating, setRegenerating] = useState(false);

  // Phase 9：另存为快照 dialog 状态
  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false);
  const [snapshotName, setSnapshotName] = useState("");
  const [savingSnapshot, setSavingSnapshot] = useState(false);

  // Phase 9：快照列表展开 / 折叠
  const [snapshotsExpanded, setSnapshotsExpanded] = useState(false);

  // Phase 9：导出 / 分享 loading
  const [exporting, setExporting] = useState<"word" | "excel" | null>(null);

  // Polling — 仅在 pending/generating 时跑
  useEffect(() => {
    if (status !== "pending" && status !== "generating") return;
    const timer = setInterval(async () => {
      try {
        const r = await pollReport(props.reportId);
        setStatus(r.status);
        setCurrentStep(r.currentStep);
        setErrorMessage(r.errorMessage);
        setReportHtml(r.reportHtml);
        setWordFileUrl(r.wordFileUrl);
        setExcelFileUrl(r.excelFileUrl);
        setAggregates(r.aggregatesJson);
        setIsAiFallback(r.isAiFallback);
      } catch (err) {
        console.error("[report-client] poll failed", err);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [status, props.reportId]);

  async function handleRegenerate() {
    if (regenerating) return;
    if (!confirm("确认重新生成？现有报告内容将被覆盖。")) return;
    setRegenerating(true);
    try {
      await regenerateReport(props.reportId);
      // 立即切回 pending —— polling effect 会自动启动
      setStatus("pending");
      setCurrentStep(null);
      setErrorMessage(null);
      setReportHtml(null);
      setAggregates(null);
      setWordFileUrl(null);
      setExcelFileUrl(null);
      setIsAiFallback(false);
      toast.success("已提交重新生成，请稍候...");
    } catch (err) {
      console.error("[report-client] regenerate failed", err);
      const msg = err instanceof Error ? err.message : "重新生成失败";
      toast.error(msg);
    } finally {
      setRegenerating(false);
    }
  }

  // Phase 9：保存为快照
  async function handleSaveSnapshot() {
    const name = snapshotName.trim();
    if (!name || savingSnapshot) return;
    setSavingSnapshot(true);
    try {
      await saveAsSnapshot({
        parentReportId: props.reportId,
        snapshotName: name,
      });
      toast.success("快照已保存");
      setSnapshotDialogOpen(false);
      setSnapshotName("");
      // revalidatePath 已由 server action 触发；刷新当前页拿到最新 snapshots prop
      window.location.reload();
    } catch (err) {
      console.error("[report-client] saveAsSnapshot failed", err);
      const msg = err instanceof Error ? err.message : "保存快照失败";
      toast.error(msg);
    } finally {
      setSavingSnapshot(false);
    }
  }

  // Phase 9：复制分享链接
  async function handleCopyShareLink() {
    const url = `${window.location.origin}/research/reports/${props.reportId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(
        "已复制分享链接 — vibetide 内部用户可直接访问；非 vibetide 用户请通过 Word/Excel 文件链接查看",
      );
    } catch (err) {
      console.error("[report-client] copy share link failed", err);
      toast.error("复制失败，请手动复制地址栏 URL");
    }
  }

  // Phase 9：导出（Word / Excel）走 server action 重签 24h URL
  async function handleExport(kind: "word" | "excel") {
    if (exporting) return;
    setExporting(kind);
    try {
      const { url } = await getSignedUrlForReport(props.reportId, kind);
      window.open(url, "_blank");
    } catch (err) {
      console.error(`[report-client] export ${kind} failed`, err);
      const msg =
        err instanceof Error
          ? err.message
          : `${kind === "word" ? "Word" : "Excel"} 文件未生成或已失效，请重新生成`;
      toast.error(msg);
    } finally {
      setExporting(null);
    }
  }

  // ── pending / generating ─────────────────────────────────────────────
  if (status === "pending" || status === "generating") {
    return (
      <div className="p-6">
        <PageHeader title={props.title} description="生成中..." />
        <GlassCard className="p-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {currentStep ?? "排队中..."}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              通常 30-90 秒，可关闭页面，完成后回到本页查看。
            </p>
          </div>
        </GlassCard>
      </div>
    );
  }

  // ── failed ──────────────────────────────────────────────────────────
  if (status === "failed") {
    return (
      <div className="p-6">
        <PageHeader title={props.title} description="生成失败" />
        <GlassCard className="p-8">
          <div className="mb-4 p-3 rounded-md bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200 text-sm">
            <div className="font-medium mb-1">报告生成失败</div>
            <div className="text-xs opacity-90">
              {errorMessage ?? "未知错误，请重试或联系管理员"}
            </div>
          </div>
          {props.isSnapshot ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              快照报告不支持重新生成。
            </p>
          ) : (
            <Button
              variant="ghost"
              onClick={handleRegenerate}
              disabled={regenerating}
            >
              {regenerating ? "提交中..." : "重试"}
            </Button>
          )}
        </GlassCard>
      </div>
    );
  }

  // ── ready ───────────────────────────────────────────────────────────
  return (
    <div className="p-6 grid grid-cols-[220px_1fr] gap-6">
      <aside className="sticky top-4 self-start text-sm space-y-1">
        <a
          href="#chapter1"
          className="block py-1 text-gray-700 dark:text-gray-300 hover:text-sky-600 dark:hover:text-sky-400"
        >
          第一章 研究背景
        </a>
        <a
          href="#chapter2"
          className="block py-1 text-gray-700 dark:text-gray-300 hover:text-sky-600 dark:hover:text-sky-400"
        >
          第二章 数据来源与统计
        </a>
        <a
          href="#chapter3"
          className="block py-1 text-gray-700 dark:text-gray-300 hover:text-sky-600 dark:hover:text-sky-400"
        >
          第三章 研究发现
        </a>
        <a
          href="#appendix"
          className="block py-1 text-gray-700 dark:text-gray-300 hover:text-sky-600 dark:hover:text-sky-400"
        >
          附录
        </a>
      </aside>

      <div>
        <PageHeader
          title={props.title}
          description={props.isSnapshot ? "快照" : "母版"}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => handleExport("word")}
                disabled={!wordFileUrl || exporting !== null}
                title={
                  wordFileUrl
                    ? "下载 Word 文件"
                    : "Word 文件未生成或已失效，请重新生成"
                }
              >
                {exporting === "word" ? "导出中..." : "导出 Word"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => handleExport("excel")}
                disabled={!excelFileUrl || exporting !== null}
                title={
                  excelFileUrl
                    ? "下载 Excel 文件"
                    : "Excel 文件未生成或已失效，请重新生成"
                }
              >
                {exporting === "excel" ? "导出中..." : "导出 Excel"}
              </Button>
              <Button variant="ghost" onClick={handleCopyShareLink}>
                分享链接
              </Button>
              {!props.isSnapshot && (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => setSnapshotDialogOpen(true)}
                  >
                    另存为快照
                  </Button>
                  {props.snapshots.length > 0 && (
                    <Button
                      variant="ghost"
                      onClick={() => setSnapshotsExpanded((v) => !v)}
                    >
                      <History className="mr-1 h-4 w-4" />
                      快照 ({props.snapshots.length})
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    onClick={handleRegenerate}
                    disabled={regenerating}
                  >
                    {regenerating ? "提交中..." : "重新生成"}
                  </Button>
                </>
              )}
            </div>
          }
        />

        {isAiFallback && (
          <div className="mb-4 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-sm flex items-center justify-between gap-3">
            <span>
              AI 段落降级，已使用模板兜底。可点击「重新生成」重试。
            </span>
            {!props.isSnapshot && (
              <Button
                variant="ghost"
                onClick={handleRegenerate}
                disabled={regenerating}
                className="shrink-0"
              >
                {regenerating ? "提交中..." : "重新生成"}
              </Button>
            )}
          </div>
        )}

        {!props.isSnapshot &&
          snapshotsExpanded &&
          props.snapshots.length > 0 && (
            <GlassCard className="mb-4 p-4">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                历史快照 ({props.snapshots.length})
              </div>
              <ul className="space-y-1 text-sm">
                {props.snapshots.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <Link
                      href={`/research/reports/${s.id}`}
                      className="text-sky-600 dark:text-sky-400 hover:underline truncate"
                    >
                      {s.snapshotName}
                    </Link>
                    <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                      {new Date(s.createdAt).toLocaleString("zh-CN")}
                    </span>
                  </li>
                ))}
              </ul>
            </GlassCard>
          )}

        <ReportHtmlBody html={reportHtml ?? ""} />

        {aggregates && (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <GlassCard className="p-4">
              <h3 className="text-sm mb-2 text-gray-700 dark:text-gray-300">
                媒体层级分布
              </h3>
              <BarChartCard
                data={aggregates.mediaTierDistribution.map((m) => ({
                  name: m.tier,
                  count: m.count,
                }))}
                dataKey="count"
              />
            </GlassCard>
            <GlassCard className="p-4">
              <h3 className="text-sm mb-2 text-gray-700 dark:text-gray-300">
                区县分布
              </h3>
              <HorizontalBarChartCard
                data={aggregates.districtDistribution.map((d) => ({
                  name: d.districtName,
                  count: d.count,
                }))}
                dataKey="count"
              />
            </GlassCard>
            <GlassCard className="p-4">
              <h3 className="text-sm mb-2 text-gray-700 dark:text-gray-300">
                主题分布
              </h3>
              <DonutChartCard
                data={aggregates.topicDistribution.map((t, i) => ({
                  name: t.topicName,
                  value: t.count,
                  color: DONUT_COLORS[i % DONUT_COLORS.length]!,
                }))}
              />
            </GlassCard>
            <GlassCard className="p-4">
              <h3 className="text-sm mb-2 text-gray-700 dark:text-gray-300">
                时间趋势
              </h3>
              <LineChartCard
                data={aggregates.dailyTrend.map((d) => ({
                  date: d.date,
                  count: d.count,
                }))}
                dataKey="count"
              />
            </GlassCard>
          </div>
        )}
      </div>

      {/* Phase 9：另存为快照 dialog（仅母版报告挂载） */}
      {!props.isSnapshot && (
        <Dialog
          open={snapshotDialogOpen}
          onOpenChange={(open) => {
            setSnapshotDialogOpen(open);
            if (!open) setSnapshotName("");
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>另存为快照</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <label className="text-sm text-gray-700 dark:text-gray-300">
                快照名称
              </label>
              <Input
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                placeholder="例如：导师 v1 反馈版"
                disabled={savingSnapshot}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                快照会复制当前报告内容，方便保留多个版本对比。
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setSnapshotDialogOpen(false)}
                disabled={savingSnapshot}
              >
                取消
              </Button>
              <Button
                variant="ghost"
                onClick={handleSaveSnapshot}
                disabled={!snapshotName.trim() || savingSnapshot}
              >
                {savingSnapshot ? "保存中..." : "保存"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ── ReportHtmlBody ────────────────────────────────────────────────────
//
// 把 server 端 HTML 注入 + 找 `<div data-chart=... data-payload=...>` 占位符 →
// 用 createRoot 渲染对应 Recharts 组件。
//
// 占位符格式（来自 src/lib/research/report-html-renderer.tsx::renderChartPlaceholder）：
//   <div class="chart-placeholder"
//        data-chart="bar|hbar|donut|line"
//        data-source="..."
//        data-payload="<json escaped>"></div>
//
// data-payload 已在服务端 escapeHtml 过 — 这里 getAttribute 拿到的是原始 JSON 字符串。

interface ChartPayloadBar {
  name: string;
  value: number;
}
interface ChartPayloadLine {
  date: string;
  count: number;
  cumulative?: number;
}

// Donut chart 配色循环（DonutChartCard 强制要求 entry.color）
const DONUT_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#06b6d4",
  "#a855f7",
];

function ReportHtmlBody({ html }: { html: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !html) return;

    // 收集本次 effect 创建的 roots（cleanup 时统一 unmount）
    const cleanups: Root[] = [];

    const placeholders = container.querySelectorAll<HTMLElement>(
      "div.chart-placeholder[data-chart]",
    );

    for (const placeholder of placeholders) {
      const type = placeholder.getAttribute("data-chart");
      const payloadAttr = placeholder.getAttribute("data-payload");
      if (!type || !payloadAttr) continue;

      let payload: unknown;
      try {
        payload = JSON.parse(payloadAttr);
      } catch {
        continue;
      }
      if (!Array.isArray(payload)) continue;

      // 清空占位符内容（避免 hydration 残留）
      placeholder.innerHTML = "";

      const root = createRoot(placeholder);
      cleanups.push(root);

      switch (type) {
        case "bar": {
          const data = (payload as ChartPayloadBar[]).map((p) => ({
            name: p.name,
            value: p.value,
          }));
          root.render(<BarChartCard data={data} dataKey="value" />);
          break;
        }
        case "hbar": {
          const data = (payload as ChartPayloadBar[]).map((p) => ({
            name: p.name,
            value: p.value,
          }));
          root.render(<HorizontalBarChartCard data={data} dataKey="value" />);
          break;
        }
        case "donut": {
          const data = (payload as ChartPayloadBar[]).map((p, i) => ({
            name: p.name,
            value: p.value,
            color: DONUT_COLORS[i % DONUT_COLORS.length]!,
          }));
          root.render(<DonutChartCard data={data} />);
          break;
        }
        case "line": {
          const data = (payload as ChartPayloadLine[]).map((p) => ({
            date: p.date,
            count: p.count,
          }));
          root.render(<LineChartCard data={data} dataKey="count" />);
          break;
        }
        default:
          break;
      }
    }

    return () => {
      // React 要求 unmount 在下一个 tick，避免 "synchronously unmount a root
      // while React was already rendering" 警告
      const roots = cleanups.slice();
      queueMicrotask(() => {
        for (const r of roots) r.unmount();
      });
    };
  }, [html]);

  return (
    <article
      ref={containerRef}
      className="prose prose-sm dark:prose-invert max-w-none"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

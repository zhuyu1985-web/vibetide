"use client";

// src/app/(dashboard)/data-collection/reports/[id]/report-client.tsx
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
  // aggregates 由报告 HTML 的 chart-placeholder data-payload 直接驱动（server-render 时序列化进 HTML attr），
  // 不需要 client 端维护本地状态，pollReport 返回的 aggregatesJson 仅用于 poll 进度跟踪
  const [, setAggregates] = useState<AggregatesJson | null>(
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
    const url = `${window.location.origin}/data-collection/reports/${props.reportId}`;
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
      <div className="max-w-[1400px] mx-auto w-full space-y-6">
        <PageHeader title={props.title} description="生成中..." />
        <GlassCard variant="panel" padding="lg">
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-sky-500" />
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
      <div className="max-w-[1400px] mx-auto w-full space-y-6">
        <PageHeader title={props.title} description="生成失败" />
        <GlassCard variant="panel" padding="lg">
          <div className="mb-4 p-4 rounded-md bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200 text-sm">
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
  const tocItems = [
    { href: "#chapter1", label: "第一章 研究背景" },
    { href: "#chapter2", label: "第二章 数据来源与统计" },
    { href: "#chapter3", label: "第三章 研究发现" },
    { href: "#appendix", label: "附录" },
  ];

  return (
    <div className="max-w-[1400px] mx-auto w-full space-y-4">
      <PageHeader
        title={props.title}
        description={props.isSnapshot ? "快照报告" : "母版报告"}
        actions={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Link
              href="/data-collection/reports"
              className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              ← 全部报告
            </Link>
            <span className="text-gray-300 dark:text-gray-600 mx-1">·</span>
            <Button
              variant="ghost"
              size="sm"
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
              size="sm"
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
            <Button variant="ghost" size="sm" onClick={handleCopyShareLink}>
              分享链接
            </Button>
            {!props.isSnapshot && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSnapshotDialogOpen(true)}
                >
                  另存为快照
                </Button>
                {props.snapshots.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSnapshotsExpanded((v) => !v)}
                  >
                    <History className="mr-1 h-4 w-4" />
                    快照 ({props.snapshots.length})
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
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

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4 items-start">
        {/* TOC 面板 */}
        <aside className="lg:sticky lg:top-4">
          <GlassCard variant="panel" padding="none">
            <div className="px-4 py-3 border-b border-gray-200/60 dark:border-white/5 text-xs font-semibold text-gray-700 dark:text-gray-300">
              目录
            </div>
            <nav className="p-2 space-y-0.5">
              {tocItems.map((t) => (
                <a
                  key={t.href}
                  href={t.href}
                  className="block px-3 py-1.5 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-sky-50/70 dark:hover:bg-sky-900/20 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                >
                  {t.label}
                </a>
              ))}
            </nav>
          </GlassCard>
        </aside>

        {/* 主内容面板 */}
        <GlassCard variant="panel" padding="none" className="min-w-0">
          <div className="px-6 py-6 space-y-4">
            {isAiFallback && (
              <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-sm flex items-center justify-between gap-3 flex-wrap">
                <span>AI 段落降级，已使用模板兜底。可点击「重新生成」重试。</span>
                {!props.isSnapshot && (
                  <Button
                    variant="ghost"
                    size="sm"
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
                <div className="rounded-md border border-gray-200/60 dark:border-white/5 bg-white/40 dark:bg-white/5 p-4">
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
                          href={`/data-collection/reports/${s.id}`}
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
                </div>
              )}

            {/* 报告正文 — 样式用 inline <style> 注入，scope 到 .research-report
                类（report-html-renderer 注入的外层 article 已带该类）。
                之前放 globals.css 可能被 Tailwind v4 PostCSS 优化掉部分规则，
                改 inline 保证规则一定生效且 HMR 即时刷新。 */}
            <ReportStyleSheet />
            <ReportHtmlBody html={reportHtml ?? ""} />
          </div>
        </GlassCard>
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

  // 容器不再加 prose（typography 插件未安装），样式由 ReportStyleSheet inline <style> 控制
  return (
    <div
      ref={containerRef}
      className="research-report-container"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ── ReportStyleSheet ─────────────────────────────────────────────────
// 注入 .research-report scope 下的全部样式。放 inline <style> 是为了：
//   1. 保证 HMR 即时生效（不被 Tailwind v4 PostCSS 全局缓存影响）
//   2. 仅在报告详情页加载，不污染其它页面
//   3. 选择器特异性高于全局 reset，无需 !important
function ReportStyleSheet() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
.research-report {
  color: rgb(31 41 55);
  font-size: 14.5px;
  line-height: 2;
  word-break: break-word;
}
.dark .research-report { color: rgb(229 231 235); }

.research-report h1 {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.4;
  margin: 0 0 0.6em;
  letter-spacing: 0.02em;
}
.research-report h2 {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.5;
  margin: 2.4em 0 1em;
  padding-bottom: 0.5em;
  border-bottom: 1px solid rgb(229 231 235);
  letter-spacing: 0.02em;
}
.dark .research-report h2 { border-bottom-color: rgba(255,255,255,0.08); }

.research-report h3 {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
  margin: 2em 0 0.8em;
  color: rgb(55 65 81);
}
.dark .research-report h3 { color: rgb(209 213 219); }

.research-report p {
  margin: 0 0 1.6em;
  text-align: justify;
  text-justify: inter-ideograph;
  letter-spacing: 0.01em;
}
.research-report p:last-child { margin-bottom: 0; }

.research-report strong { font-weight: 600; color: rgb(15 23 42); }
.dark .research-report strong { color: rgb(248 250 252); }

.research-report .report-cover {
  margin-bottom: 2.4em;
  padding-bottom: 1.8em;
  border-bottom: 1px solid rgb(229 231 235);
}
.dark .research-report .report-cover { border-bottom-color: rgba(255,255,255,0.08); }
.research-report .report-cover .subtitle {
  font-size: 13px;
  color: rgb(107 114 128);
  margin: 0 0 1.2em;
}
.research-report .cover-meta {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.6em;
}
.research-report .cover-meta li {
  font-size: 13.5px;
  color: rgb(75 85 99);
  line-height: 1.7;
}
.dark .research-report .cover-meta li { color: rgb(156 163 175); }

.research-report .banner {
  padding: 0.85em 1.1em;
  border-radius: 8px;
  margin-bottom: 1.6em;
  font-size: 13px;
  line-height: 1.6;
}
.research-report .banner-warn {
  background: rgb(254 252 232);
  color: rgb(146 64 14);
  border: 1px solid rgb(253 230 138);
}
.research-report .banner-info {
  background: rgb(239 246 255);
  color: rgb(30 64 175);
  border: 1px solid rgb(191 219 254);
}

/* 通用 data-table — 强制 display:table，覆盖任何全局 reset */
.research-report table.data-table {
  display: table;
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  margin: 1.2em 0 2em;
  font-size: 13px;
  background: rgb(255 255 255 / 0.6);
  border: 1px solid rgb(229 231 235);
  border-radius: 8px;
  overflow: hidden;
  table-layout: auto;
}
.dark .research-report table.data-table {
  background: rgb(255 255 255 / 0.03);
  border-color: rgba(255,255,255,0.08);
}

.research-report table.data-table thead {
  display: table-header-group;
  background: rgb(243 244 246);
}
.dark .research-report table.data-table thead { background: rgba(255,255,255,0.04); }

.research-report table.data-table thead tr,
.research-report table.data-table tbody tr {
  display: table-row;
}
.research-report table.data-table thead th {
  display: table-cell;
  font-weight: 600;
  font-size: 12.5px;
  color: rgb(55 65 81);
  text-align: left;
  padding: 0.85em 1.1em;
  border-bottom: 1px solid rgb(229 231 235);
  white-space: nowrap;
}
.dark .research-report table.data-table thead th {
  color: rgb(209 213 219);
  border-bottom-color: rgba(255,255,255,0.08);
}
.research-report table.data-table tbody td {
  display: table-cell;
  padding: 0.75em 1.1em;
  border-top: 1px solid rgb(243 244 246);
  vertical-align: middle;
  line-height: 1.65;
  white-space: nowrap;
}
.dark .research-report table.data-table tbody td { border-top-color: rgba(255,255,255,0.06); }

/* 第 4 列（Top3 媒体 / Top3 主题 / Top3 区县）允许换行 */
.research-report table.data-table tbody td:nth-child(4) {
  white-space: normal;
  word-break: break-word;
}

.research-report table.data-table tbody tr:hover {
  background: rgb(249 250 251 / 0.7);
}
.dark .research-report table.data-table tbody tr:hover { background: rgba(255,255,255,0.03); }

/* 附录表 — 6 列固定布局 */
.research-report table.data-table-appendix {
  table-layout: fixed;
  font-size: 12.5px;
}
.research-report table.data-table-appendix thead th:nth-child(1),
.research-report table.data-table-appendix tbody td:nth-child(1) {
  width: 52px;
  text-align: center;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  color: rgb(107 114 128);
}
.research-report table.data-table-appendix thead th:nth-child(2),
.research-report table.data-table-appendix tbody td:nth-child(2) {
  width: auto;
  white-space: normal;
  word-break: break-word;
}
.research-report table.data-table-appendix thead th:nth-child(3),
.research-report table.data-table-appendix tbody td:nth-child(3) {
  width: 130px;
  white-space: normal;
  word-break: break-word;
}
.research-report table.data-table-appendix thead th:nth-child(4),
.research-report table.data-table-appendix tbody td:nth-child(4) {
  width: 96px;
  white-space: nowrap;
}
.research-report table.data-table-appendix thead th:nth-child(5),
.research-report table.data-table-appendix tbody td:nth-child(5) {
  width: 84px;
  white-space: nowrap;
}
.research-report table.data-table-appendix thead th:nth-child(6),
.research-report table.data-table-appendix tbody td:nth-child(6) {
  width: 106px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  color: rgb(75 85 99);
}

.research-report table.data-table-appendix a {
  color: rgb(2 132 199);
  text-decoration: none;
}
.research-report table.data-table-appendix a:hover { text-decoration: underline; }
.dark .research-report table.data-table-appendix a { color: rgb(56 189 248); }

/* 章节 sections 的间距 */
.research-report > section,
.research-report section[id^="chapter"],
.research-report section[id="appendix"] {
  display: block;
  margin-bottom: 1em;
}

/* 图表占位符 — 未 hydrate 时折叠 (0px) 不留白；hydrate 后由 Recharts 内部撑开 */
.research-report .chart-placeholder {
  margin: 1em 0 1.8em;
}
.research-report .chart-placeholder:empty {
  display: none;
}
/* Recharts ResponsiveContainer 需要父级有明确宽度 + 自身指定 height */
.research-report .chart-placeholder > * {
  width: 100%;
}

.research-report .empty-hint {
  font-size: 13px;
  color: rgb(156 163 175);
  font-style: italic;
  padding: 1em 0;
}
        `,
      }}
    />
  );
}

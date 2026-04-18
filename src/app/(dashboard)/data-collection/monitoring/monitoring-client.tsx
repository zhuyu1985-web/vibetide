"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { MonitoringSummary, CollectionTrendPoint } from "@/lib/dal/collected-items";

// ── Serialized types (Dates converted to ISO strings by server page) ──────

interface SerializedErrorSource {
  sourceId: string;
  sourceName: string;
  sourceType: string;
  failedCount: number;
  partialCount: number;
  lastFailedAt: string | null;
  lastErrorMessage: string | null;
}

interface SerializedRecentError {
  logId: number;
  loggedAt: string;
  sourceId: string;
  sourceName: string;
  level: "info" | "warn" | "error";
  message: string;
}

interface SourceDistributionPoint {
  type: string;
  count: number;
}

interface MonitoringClientProps {
  summary: MonitoringSummary;
  trend: CollectionTrendPoint[];
  errorSources: SerializedErrorSource[];
  recentErrors: SerializedRecentError[];
  sourceDistribution: SourceDistributionPoint[];
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function successRateColor(rate: number): string {
  if (rate > 0.95) return "text-green-500";
  if (rate >= 0.8) return "text-yellow-500";
  return "text-red-500";
}

const PIE_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444"];

// ── Component ─────────────────────────────────────────────────────────────

export function MonitoringClient({
  summary,
  trend,
  errorSources,
  recentErrors,
  sourceDistribution,
}: MonitoringClientProps) {
  const successPct = (summary.successRate24h * 100).toFixed(1);

  return (
    <div className="flex flex-col gap-6">
      {/* Section 1 — KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* 24h 采集量 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">24h 采集量</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{summary.itemsLast24h.toLocaleString()}</p>
            <p className="mt-1 text-xs text-muted-foreground">近 7 天: {summary.itemsLast7d.toLocaleString()}</p>
          </CardContent>
        </Card>

        {/* 24h 成功率 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">24h 成功率</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold tabular-nums ${successRateColor(summary.successRate24h)}`}>
              {successPct}%
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              共 {summary.totalRunsLast24h} 次运行
            </p>
          </CardContent>
        </Card>

        {/* 活跃源 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">活跃源</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">
              {summary.activeSources}
              <span className="text-xl text-muted-foreground">/{summary.totalSources}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">已启用 / 全部</p>
          </CardContent>
        </Card>

        {/* 24h 错误数 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">24h 错误数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold tabular-nums ${summary.failedRunsLast24h > 0 ? "text-red-500" : ""}`}>
              {summary.failedRunsLast24h}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">失败运行次数</p>
          </CardContent>
        </Card>
      </div>

      {/* Section 2 + 3 — Trend chart + Pie chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 7d trend line chart */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>最近 7 天采集趋势</CardTitle>
            </CardHeader>
            <CardContent>
              {trend.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                  暂无运行数据
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          // TODO: use hsl(var(--background)) once Tailwind v4 inline CSS var resolves reliably
                          backgroundColor: "#ffffff",
                          border: "1px solid #e5e7eb",
                        }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="inserted" stroke="#3b82f6" name="新增" dot={false} />
                      <Line type="monotone" dataKey="merged" stroke="#a1a1aa" name="合并" dot={false} />
                      <Line type="monotone" dataKey="failed" stroke="#ef4444" name="失败" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Source type distribution pie */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>源类型分布</CardTitle>
            </CardHeader>
            <CardContent>
              {sourceDistribution.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
                  暂无数据
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sourceDistribution}
                        dataKey="count"
                        nameKey="type"
                        outerRadius={80}
                        label={({ name, value }: { name?: string; value?: number }) => `${name ?? ""} ${value ?? ""}`}
                      >
                        {sourceDistribution.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section 4 — Error source table + Recent errors stream */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Error source table */}
        <Card>
          <CardHeader>
            <CardTitle>错误最多的源 (近 7 天)</CardTitle>
          </CardHeader>
          <CardContent>
            {errorSources.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">暂无错误数据</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>源名称</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead className="text-right">失败</TableHead>
                    <TableHead className="text-right">部分</TableHead>
                    <TableHead>最近失败</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errorSources.map((src) => (
                    <TableRow key={src.sourceId}>
                      <TableCell className="max-w-[140px] truncate font-medium">
                        {src.sourceName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {src.sourceType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-red-500 font-semibold">
                        {src.failedCount}
                      </TableCell>
                      <TableCell className="text-right text-yellow-500">
                        {src.partialCount}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {src.lastFailedAt ? formatDateTime(src.lastFailedAt) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent error log stream */}
        <Card>
          <CardHeader>
            <CardTitle>最近错误日志</CardTitle>
          </CardHeader>
          <CardContent>
            {recentErrors.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">暂无错误日志</p>
            ) : (
              <div className="max-h-72 overflow-y-auto flex flex-col gap-2 pr-1">
                {recentErrors.map((entry) => (
                  <div
                    key={entry.logId}
                    className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-medium text-foreground truncate max-w-[160px]">
                        {entry.sourceName}
                      </span>
                      <span className="text-muted-foreground shrink-0">
                        {formatDateTime(entry.loggedAt)}
                      </span>
                    </div>
                    <p className="text-muted-foreground line-clamp-2 break-words">
                      {entry.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { GlassCard } from "@/components/shared/glass-card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  BusinessSummary,
  ChannelTrendPoint,
  RecentBusinessItem,
} from "@/lib/dal/monitoring-business";

// ─── Types (serialized for client) ─────────────────────────────────────────

export interface SerializedRecentBusinessItem
  extends Omit<RecentBusinessItem, "firstSeenAt"> {
  firstSeenAt: string;
}

export interface BusinessTopicOption {
  id: string;
  name: string;
}

export interface BusinessChannelOption {
  slug: string;
  label: string;
}

export type BusinessTimeWindow = "24h" | "7d" | "30d" | "all";

export interface BusinessDashboardProps {
  summary: BusinessSummary;
  trend: ChannelTrendPoint[];
  recentItems: SerializedRecentBusinessItem[];
  topics: BusinessTopicOption[];
  channelOptions: BusinessChannelOption[];
  /** 当前 server 端解析后的筛选值,供 UI 回显 */
  initialFilters: {
    topicId?: string;
    channel?: string;
    timeWindow: BusinessTimeWindow;
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 100_000_000) return (n / 100_000_000).toFixed(2) + "亿";
  if (n >= 10_000) return (n / 10_000).toFixed(1) + "万";
  return n.toLocaleString("zh-CN");
}

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

function sentimentBadge(s: string | null): { label: string; className: string } | null {
  if (!s) return null;
  if (s === "敏感") return { label: "敏感", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" };
  if (s === "非敏感") return { label: "非敏感", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" };
  if (s === "中性") return { label: "中性", className: "bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300" };
  return { label: s, className: "bg-gray-100 text-gray-700" };
}

const TIME_WINDOW_LABEL: Record<BusinessTimeWindow, string> = {
  "24h": "近 24 小时",
  "7d": "近 7 天",
  "30d": "近 30 天",
  all: "全部",
};

// Line colors for channel trend (cycled)
const LINE_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
];

// ─── Component ─────────────────────────────────────────────────────────────

export function BusinessDashboard({
  summary,
  trend,
  recentItems,
  topics,
  channelOptions,
  initialFilters,
}: BusinessDashboardProps) {
  const [topicId, setTopicId] = useState<string>(initialFilters.topicId ?? "all");
  const [channel, setChannel] = useState<string>(initialFilters.channel ?? "all");
  const [timeWindow, setTimeWindow] = useState<BusinessTimeWindow>(
    initialFilters.timeWindow,
  );
  const [granularity, setGranularity] = useState<"hour" | "day">("day");
  const [, startTransition] = useTransition();

  // Filter changes → URL push so server can re-fetch
  const onFilterChange = (next: {
    topicId?: string;
    channel?: string;
    timeWindow?: BusinessTimeWindow;
  }) => {
    const params = new URLSearchParams();
    const t = next.topicId ?? topicId;
    const c = next.channel ?? channel;
    const w = next.timeWindow ?? timeWindow;
    if (t && t !== "all") params.set("topicId", t);
    if (c && c !== "all") params.set("channel", c);
    if (w && w !== "7d") params.set("window", w);
    if (next.topicId !== undefined) setTopicId(next.topicId);
    if (next.channel !== undefined) setChannel(next.channel);
    if (next.timeWindow !== undefined) setTimeWindow(next.timeWindow);
    startTransition(() => {
      const q = params.toString();
      // Use window.location to keep code simple; full reload triggers server re-fetch.
      window.location.search = q ? `?${q}` : "";
    });
  };

  // Transform trend points → wide-format rows for Recharts multi-line chart
  const trendChartData = useMemo(() => {
    if (trend.length === 0) return [] as Array<Record<string, string | number>>;
    const channels = Array.from(new Set(trend.map((p) => p.channel)));
    const byTs = new Map<string, Record<string, string | number>>();
    for (const p of trend) {
      const tsKey =
        granularity === "hour"
          ? new Date(p.ts).toLocaleString("zh-CN", {
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
            })
          : new Date(p.ts).toLocaleDateString("zh-CN", {
              month: "2-digit",
              day: "2-digit",
            });
      const row = byTs.get(tsKey) ?? { ts: tsKey };
      row[p.channel] = (Number(row[p.channel]) || 0) + p.count;
      byTs.set(tsKey, row);
    }
    // Ensure each row has all channel keys (0 fill)
    const rows = Array.from(byTs.values());
    for (const r of rows) {
      for (const c of channels) {
        if (r[c] === undefined) r[c] = 0;
      }
    }
    return rows;
  }, [trend, granularity]);

  const trendChannels = useMemo(
    () => Array.from(new Set(trend.map((p) => p.channel))),
    [trend],
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Filter bar */}
      <GlassCard padding="md">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">监测时间</span>
            <div className="flex items-center gap-1">
              {(["24h", "7d", "30d", "all"] as BusinessTimeWindow[]).map((w) => (
                <Button
                  key={w}
                  variant={timeWindow === w ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onFilterChange({ timeWindow: w })}
                >
                  {TIME_WINDOW_LABEL[w]}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">主题方案</span>
            <Select
              value={topicId}
              onValueChange={(v) => onFilterChange({ topicId: v })}
            >
              <SelectTrigger className="w-48 h-8">
                <SelectValue placeholder="全部主题" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部主题</SelectItem>
                {topics.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">信息来源</span>
            <Select
              value={channel}
              onValueChange={(v) => onFilterChange({ channel: v })}
            >
              <SelectTrigger className="w-56 h-8">
                <SelectValue placeholder="全部来源" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部来源</SelectItem>
                {channelOptions.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </GlassCard>

      {/* 3 metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 发文总量 */}
        <GlassCard padding="md">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-muted-foreground">发文总量</span>
            <span className="text-4xl font-bold tabular-nums">
              {formatNumber(summary.postCount.total)}
            </span>
            <div className="flex items-center justify-between gap-2 mt-2 text-xs">
              <div className="flex flex-col">
                <span className="text-red-500 font-semibold tabular-nums">
                  {formatNumber(summary.postCount.sensitive)}
                </span>
                <span className="text-muted-foreground">敏感</span>
              </div>
              <div className="flex flex-col">
                <span className="text-green-500 font-semibold tabular-nums">
                  {formatNumber(summary.postCount.nonSensitive)}
                </span>
                <span className="text-muted-foreground">非敏感</span>
              </div>
              <div className="flex flex-col">
                <span className="text-gray-500 font-semibold tabular-nums">
                  {formatNumber(summary.postCount.neutral)}
                </span>
                <span className="text-muted-foreground">中性</span>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* 互动声量 */}
        <GlassCard padding="md">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-muted-foreground">互动声量</span>
            <span className="text-4xl font-bold tabular-nums">
              {formatNumber(summary.engagement.total)}
            </span>
            <div className="grid grid-cols-3 gap-y-1.5 gap-x-2 mt-2 text-xs">
              <EngagementCell label="点赞" value={summary.engagement.likes} />
              <EngagementCell label="转发" value={summary.engagement.reposts} />
              <EngagementCell label="评论" value={summary.engagement.comments} />
              <EngagementCell label="收藏" value={summary.engagement.favorites} />
              <EngagementCell label="阅读" value={summary.engagement.views} />
              <EngagementCell label="回复" value={summary.engagement.replies} />
            </div>
          </div>
        </GlassCard>

        {/* 影响力值 */}
        <GlassCard padding="md">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-muted-foreground">影响力值</span>
            <span className="text-4xl font-bold tabular-nums">
              {formatNumber(summary.influence.followerSum)}
            </span>
            <span className="text-xs text-muted-foreground">粉丝总数</span>
            <div className="mt-2 text-xs">
              <span className="font-semibold tabular-nums">
                {formatNumber(summary.influence.authorCount)}
              </span>
              <span className="ml-1 text-muted-foreground">发帖人数</span>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Trend chart + recent list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <GlassCard padding="md">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">信息来源走势</h3>
              <div className="flex items-center gap-1">
                <Button
                  variant={granularity === "hour" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setGranularity("hour")}
                >
                  小时
                </Button>
                <Button
                  variant={granularity === "day" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setGranularity("day")}
                >
                  天
                </Button>
              </div>
            </div>
            {trendChartData.length === 0 || trendChannels.length === 0 ? (
              <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">
                暂无数据
              </div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="ts" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        border: "1px solid #e5e7eb",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {trendChannels.map((c, i) => (
                      <Line
                        key={c}
                        type="monotone"
                        dataKey={c}
                        name={c}
                        stroke={LINE_COLORS[i % LINE_COLORS.length]}
                        dot={false}
                        strokeWidth={2}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Recent items list */}
        <div>
          <GlassCard padding="md">
            <h3 className="text-base font-semibold mb-3">最近信息</h3>
            {recentItems.length === 0 ? (
              <div className="h-72 flex items-center justify-center text-muted-foreground text-sm">
                暂无数据
              </div>
            ) : (
              <div className="h-72 overflow-y-auto flex flex-col gap-2 pr-1">
                {recentItems.map((item) => {
                  const badge = sentimentBadge(item.sentiment);
                  return (
                    <div
                      key={item.id}
                      className="rounded-lg border border-gray-200/60 dark:border-gray-700/40 px-3 py-2 hover:bg-gray-50/50 dark:hover:bg-gray-800/20 transition-colors"
                    >
                      <div className="flex items-start gap-2 mb-1">
                        {badge ? (
                          <span
                            className={cn(
                              "shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium",
                              badge.className,
                            )}
                          >
                            {badge.label}
                          </span>
                        ) : null}
                        <p className="text-sm line-clamp-2 break-words flex-1">
                          {item.canonicalUrl ? (
                            <a
                              href={item.canonicalUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline"
                            >
                              {item.title}
                            </a>
                          ) : (
                            item.title
                          )}
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="truncate max-w-[120px]">
                          {item.platform ?? item.author ?? item.firstSeenChannel}
                        </span>
                        <span className="shrink-0">{formatDateTime(item.firstSeenAt)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function EngagementCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{formatNumber(value)}</span>
    </div>
  );
}

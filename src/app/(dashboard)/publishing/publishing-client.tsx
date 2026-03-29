"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { GlassCard } from "@/components/shared/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmployeeAvatar } from "@/components/shared/employee-avatar";
import type { ChannelConfig, PublishPlan, ReviewResult } from "@/lib/types";
import {
  Calendar,
  List,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Filter,
  Radio,
  Settings,
  Globe,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Tag,
  FileText,
  Pause,
  Play,
  Eye,
  Timer,
  CalendarDays,
} from "lucide-react";
import { updateChannelStatus } from "@/app/actions/publishing";
import { ChannelPreview } from "./channel-preview";
import { PublishCalendar } from "./publish-calendar";
import { OptimalTimes } from "./optimal-times";

interface CalendarPlanItem {
  id: string;
  title: string;
  channel: string;
  status: string;
  scheduledAt: string;
}

interface TimeSlotRecommendation {
  hour: number;
  label: string;
  avgEngagement: number;
  confidence: number;
}

interface HourlyEngagement {
  hour: number;
  label: string;
  avgEngagement: number;
  count: number;
}

interface PublishingClientProps {
  channels: ChannelConfig[];
  publishPlans: PublishPlan[];
  reviews: ReviewResult[];
  calendarData: Record<string, CalendarPlanItem[]>;
  calendarYear: number;
  calendarMonth: number;
  optimalTimeRecommendations: TimeSlotRecommendation[];
  optimalTimeHourlyData: HourlyEngagement[];
}

const reviewStatusConfig = {
  pending: { label: "审核中", icon: Shield, color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-700/50" },
  approved: { label: "已通过", icon: ShieldCheck, color: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50 border-green-200" },
  rejected: { label: "已驳回", icon: ShieldX, color: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border-red-200" },
  escalated: { label: "已升级", icon: ShieldAlert, color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200" },
};

const statusConfig = {
  scheduled: {
    label: "已排期",
    icon: Clock,
    color: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-700/50",
  },
  publishing: {
    label: "发布中",
    icon: Loader2,
    color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200",
  },
  published: {
    label: "已发布",
    icon: CheckCircle,
    color: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50 border-green-200",
  },
  failed: {
    label: "失败",
    icon: AlertCircle,
    color: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border-red-200",
  },
};

const platformIcons: Record<string, string> = {
  wechat: "💬",
  toutiao: "📰",
  douyin: "🎵",
  weibo: "🔥",
  baidu: "🌐",
  bilibili: "📺",
  xiaohongshu: "📕",
  zhihu: "❓",
};

export default function PublishingClient({
  channels,
  publishPlans,
  reviews,
  calendarData,
  calendarYear,
  calendarMonth,
  optimalTimeRecommendations,
  optimalTimeHourlyData,
}: PublishingClientProps) {
  // Build a map of contentId → review for quick lookup
  const reviewMap = new Map(reviews.map((r) => [r.contentId, r]));

  const [view, setView] = useState<
    "list" | "calendar" | "channels" | "preview" | "publish-calendar" | "optimal-times"
  >("list");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);

  const filtered = publishPlans
    .filter((p) => statusFilter === "all" || p.status === statusFilter)
    .filter((p) => channelFilter === "all" || p.channelId === channelFilter);

  // Group by date
  const grouped = filtered.reduce<Record<string, typeof publishPlans>>(
    (acc, plan) => {
      const date = plan.scheduledAt.split("T")[0];
      if (!acc[date]) acc[date] = [];
      acc[date].push(plan);
      return acc;
    },
    {}
  );

  const sortedDates = Object.keys(grouped).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  // Stats
  const totalScheduled = publishPlans.filter(
    (p) => p.status === "scheduled"
  ).length;
  const totalPublished = publishPlans.filter(
    (p) => p.status === "published"
  ).length;
  const totalFailed = publishPlans.filter((p) => p.status === "failed").length;
  const activeChannels = channels.filter((c) => c.status === "active").length;

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHeader
        title="全渠道发布台"
        description="统一管理所有渠道的内容发布计划"
        actions={
          <div className="flex items-center gap-2">
            <EmployeeAvatar employeeId="xiaofa" size="xs" />
            <span className="text-xs text-gray-500 dark:text-gray-400">小发 自动适配分发</span>
            <Tabs
              value={view}
              onValueChange={(v) =>
                setView(
                  v as
                    | "list"
                    | "calendar"
                    | "channels"
                    | "preview"
                    | "publish-calendar"
                    | "optimal-times"
                )
              }
            >
              <TabsList className="h-8">
                <TabsTrigger value="list" className="text-xs h-6 px-2">
                  <List size={14} className="mr-1" />
                  列表
                </TabsTrigger>
                <TabsTrigger value="calendar" className="text-xs h-6 px-2">
                  <Calendar size={14} className="mr-1" />
                  日历
                </TabsTrigger>
                <TabsTrigger value="channels" className="text-xs h-6 px-2">
                  <Globe size={14} className="mr-1" />
                  渠道
                </TabsTrigger>
                <TabsTrigger value="preview" className="text-xs h-6 px-2">
                  <Eye size={14} className="mr-1" />
                  适配预览
                </TabsTrigger>
                <TabsTrigger value="publish-calendar" className="text-xs h-6 px-2">
                  <CalendarDays size={14} className="mr-1" />
                  发布日历
                </TabsTrigger>
                <TabsTrigger value="optimal-times" className="text-xs h-6 px-2">
                  <Timer size={14} className="mr-1" />
                  时间推荐
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        }
      />

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <GlassCard padding="sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center">
              <Clock size={16} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">待发布</p>
              <p className="text-lg font-bold text-gray-800 dark:text-gray-100">
                {totalScheduled}
              </p>
            </div>
          </div>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-950/50 flex items-center justify-center">
              <CheckCircle size={16} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">已发布</p>
              <p className="text-lg font-bold text-gray-800 dark:text-gray-100">
                {totalPublished}
              </p>
            </div>
          </div>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/50 flex items-center justify-center">
              <AlertCircle size={16} className="text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">失败</p>
              <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{totalFailed}</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard padding="sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center">
              <Radio size={16} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">活跃渠道</p>
              <p className="text-lg font-bold text-gray-800 dark:text-gray-100">
                {activeChannels}
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Filters */}
      {(view === "list" || view === "calendar") && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <Filter size={14} className="text-gray-400 dark:text-gray-500" />
          <span className="text-xs text-gray-500 dark:text-gray-400">状态：</span>
          {[
            { value: "all", label: "全部" },
            { value: "scheduled", label: "已排期" },
            { value: "published", label: "已发布" },
            { value: "failed", label: "失败" },
          ].map((f) => (
            <Badge
              key={f.value}
              variant={statusFilter === f.value ? "default" : "outline"}
              className="text-xs cursor-pointer"
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
            </Badge>
          ))}
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-4">渠道：</span>
          <Badge
            variant={channelFilter === "all" ? "default" : "outline"}
            className="text-xs cursor-pointer"
            onClick={() => setChannelFilter("all")}
          >
            全部
          </Badge>
          {channels.map((ch) => (
            <Badge
              key={ch.id}
              variant={channelFilter === ch.id ? "default" : "outline"}
              className="text-xs cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20"
              onClick={() => setChannelFilter(ch.id)}
            >
              {platformIcons[ch.platform] || "📡"} {ch.name}
            </Badge>
          ))}
        </div>
      )}

      {/* List View */}
      {view === "list" && (
        <div className="space-y-6">
          {sortedDates.length === 0 && (
            <GlassCard className="text-center py-12">
              <Radio size={40} className="mx-auto text-gray-300 mb-3" />
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                暂无发布计划
              </h3>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                小发会在内容审核通过后自动生成发布计划
              </p>
            </GlassCard>
          )}
          {sortedDates.map((date) => {
            const plans = grouped[date];
            const dateObj = new Date(date);
            const isToday =
              dateObj.toDateString() === new Date().toDateString();
            return (
              <div key={date}>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    {isToday ? "今天" : ""}{" "}
                    {dateObj.toLocaleDateString("zh-CN", {
                      month: "long",
                      day: "numeric",
                      weekday: "short",
                    })}
                  </h3>
                  <Badge variant="secondary" className="text-xs">
                    {plans.length} 条
                  </Badge>
                </div>
                <div className="space-y-2">
                  {plans.map((plan) => {
                    const status = statusConfig[plan.status];
                    const StatusIcon = status.icon;
                    const channel = channels.find(
                      (c) => c.id === plan.channelId
                    );
                    const time = new Date(
                      plan.scheduledAt
                    ).toLocaleTimeString("zh-CN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    return (
                      <GlassCard
                        key={plan.id}
                        variant="interactive"
                        padding="sm"
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-mono text-gray-500 dark:text-gray-400 w-12">
                            {time}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${status.color}`}
                          >
                            <StatusIcon size={10} className="mr-0.5" />
                            {status.label}
                          </Badge>
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-100 flex-1">
                            {plan.title}
                          </span>
                          {/* Review status badge (F3.1.08-12) */}
                          {(() => {
                            const review = reviewMap.get(plan.title);
                            if (!review) return null;
                            const rs = reviewStatusConfig[review.status];
                            const RsIcon = rs.icon;
                            return (
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${rs.color}`}
                              >
                                <RsIcon size={10} className="mr-0.5" />
                                {rs.label}
                                {review.score !== null && (
                                  <span className="ml-1">{review.score}分</span>
                                )}
                              </Badge>
                            );
                          })()}
                          <Badge variant="secondary" className="text-xs">
                            {platformIcons[channel?.platform || ""] || "📡"}{" "}
                            {channel?.name || plan.channelName}
                          </Badge>
                          {plan.adaptedContent && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() =>
                                setExpandedPlan(
                                  expandedPlan === plan.id ? null : plan.id
                                )
                              }
                            >
                              {expandedPlan === plan.id ? (
                                <ChevronUp size={12} className="mr-1" />
                              ) : (
                                <ChevronDown size={12} className="mr-1" />
                              )}
                              适配详情
                            </Button>
                          )}
                        </div>
                        {/* Adapted Content Preview (F3.1.02) */}
                        {expandedPlan === plan.id && plan.adaptedContent && (
                          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/50 space-y-2">
                            <div className="flex items-center gap-2">
                              <FileText
                                size={12}
                                className="text-blue-500"
                              />
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                渠道适配版本
                              </span>
                              {plan.adaptedContent.format && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] h-4"
                                >
                                  {plan.adaptedContent.format}
                                </Badge>
                              )}
                            </div>
                            {plan.adaptedContent.headline && (
                              <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">
                                {plan.adaptedContent.headline}
                              </p>
                            )}
                            {plan.adaptedContent.body && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                                {plan.adaptedContent.body}
                              </p>
                            )}
                            {plan.adaptedContent.tags &&
                              plan.adaptedContent.tags.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap">
                                  <Tag size={10} className="text-gray-400 dark:text-gray-500" />
                                  {plan.adaptedContent.tags.map((tag) => (
                                    <Badge
                                      key={tag}
                                      variant="outline"
                                      className="text-[9px] h-4 px-1"
                                    >
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                          </div>
                        )}
                      </GlassCard>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Calendar View (F3.1.06) */}
      {view === "calendar" && (
        <GlassCard>
          <CalendarView plans={filtered} channels={channels} />
        </GlassCard>
      )}

      {/* Channels View (F3.1.07) */}
      {view === "channels" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {channels.map((ch) => {
            const planCount = publishPlans.filter(
              (p) => p.channelId === ch.id
            ).length;
            const publishedCount = publishPlans.filter(
              (p) => p.channelId === ch.id && p.status === "published"
            ).length;
            return (
              <GlassCard key={ch.id} variant="interactive">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">
                    {platformIcons[ch.platform] || "📡"}
                  </span>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                      {ch.name}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{ch.platform}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      ch.status === "active"
                        ? "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50 border-green-200"
                        : ch.status === "paused"
                        ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200"
                        : "text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    {ch.status === "active"
                      ? "活跃"
                      : ch.status === "paused"
                      ? "暂停"
                      : "配置中"}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center mb-3">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">粉丝</p>
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
                      {ch.followers >= 10000
                        ? `${(ch.followers / 10000).toFixed(1)}万`
                        : ch.followers.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">总计划</p>
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
                      {planCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">已发布</p>
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
                      {publishedCount}
                    </p>
                  </div>
                </div>
                {/* Channel status toggle (F3.1.07) */}
                <div className="flex gap-2">
                  {ch.status === "active" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 flex-1"
                      onClick={() => updateChannelStatus(ch.id, "paused")}
                    >
                      <Pause size={12} className="mr-1" />
                      暂停
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 flex-1"
                      onClick={() => updateChannelStatus(ch.id, "active")}
                    >
                      <Play size={12} className="mr-1" />
                      启用
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                  >
                    <Settings size={12} />
                  </Button>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Channel Preview View (M3.F02) */}
      {view === "preview" && (
        <ChannelPreview
          publishPlans={publishPlans.map((p) => {
            const ch = channels.find((c) => c.id === p.channelId);
            return {
              id: p.id,
              channel: ch?.name || p.channelName || "未知渠道",
              platform: ch?.platform || "unknown",
              title: p.title,
              adaptedContent: p.adaptedContent,
              status: p.status,
              scheduledAt: p.scheduledAt,
            };
          })}
        />
      )}

      {/* Publish Calendar View (M3.F06) */}
      {view === "publish-calendar" && (
        <GlassCard>
          <PublishCalendar
            calendarData={calendarData}
            year={calendarYear}
            month={calendarMonth}
          />
        </GlassCard>
      )}

      {/* Optimal Times View (M3.F03) */}
      {view === "optimal-times" && (
        <OptimalTimes
          recommendations={optimalTimeRecommendations}
          hourlyData={optimalTimeHourlyData}
          channels={channels}
        />
      )}
    </div>
  );
}

// Calendar View with month/week toggle and navigation (F3.1.06)
function CalendarView({
  plans,
  channels,
}: {
  plans: PublishPlan[];
  channels: ChannelConfig[];
}) {
  const [calMode, setCalMode] = useState<"month" | "week">("month");
  const [offset, setOffset] = useState(0); // months or weeks offset from today

  const today = new Date();
  const weekDays = ["日", "一", "二", "三", "四", "五", "六"];

  function renderDayCell(dateStr: string, day: number, isToday: boolean, height: string) {
    const dayPlans = plans.filter(
      (p) => p.scheduledAt.split("T")[0] === dateStr
    );
    const maxItems = calMode === "week" ? 6 : 3;

    return (
      <div
        key={dateStr}
        className={`${height} border border-gray-100 dark:border-gray-700/50 rounded-lg p-1 text-xs overflow-hidden ${
          isToday ? "bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-700/50" : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
        }`}
      >
        <span className={`font-medium ${isToday ? "text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-400"}`}>
          {day}
        </span>
        <div className="mt-0.5 space-y-0.5">
          {dayPlans.slice(0, maxItems).map((p) => {
            const ch = channels.find((c) => c.id === p.channelId);
            const time = new Date(p.scheduledAt).toLocaleTimeString("zh-CN", {
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <div
                key={p.id}
                className={`truncate text-[10px] px-1 rounded ${
                  p.status === "published"
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                    : p.status === "failed"
                    ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                    : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                }`}
              >
                {calMode === "week" && (
                  <span className="font-mono mr-1">{time}</span>
                )}
                {platformIcons[ch?.platform || ""] || ""}{" "}
                {p.title.slice(0, calMode === "week" ? 12 : 6)}
              </div>
            );
          })}
          {dayPlans.length > maxItems && (
            <div className="text-[10px] text-gray-400 dark:text-gray-500">
              +{dayPlans.length - maxItems}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Compute header label
  let headerLabel: string;
  if (calMode === "month") {
    const viewDate = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    headerLabel = `${viewDate.getFullYear()}年${viewDate.getMonth() + 1}月`;
  } else {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + offset * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    headerLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()} - ${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;
  }

  // Toolbar (shared between views)
  const toolbar = (
    <div className="flex items-center justify-between mb-4">
      <Button variant="ghost" size="sm" onClick={() => setOffset(offset - 1)}>
        <ChevronLeft size={14} />
      </Button>
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">{headerLabel}</h4>
        <div className="flex gap-1 ml-4">
          <Badge
            variant={calMode === "month" ? "default" : "outline"}
            className="text-[10px] cursor-pointer"
            onClick={() => { setCalMode("month"); setOffset(0); }}
          >
            月
          </Badge>
          <Badge
            variant={calMode !== "month" ? "default" : "outline"}
            className="text-[10px] cursor-pointer"
            onClick={() => { setCalMode("week"); setOffset(0); }}
          >
            周
          </Badge>
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={() => setOffset(offset + 1)}>
        <ChevronRight size={14} />
      </Button>
    </div>
  );

  // Month view
  if (calMode === "month") {
    const viewDate = new Date(today.getFullYear(), today.getMonth() + offset, 1);
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    return (
      <div>
        {toolbar}
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((d) => (
            <div key={d} className="text-center text-xs text-gray-400 dark:text-gray-500 py-1 font-medium">
              {d}
            </div>
          ))}
          {days.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} className="h-20" />;
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            return renderDayCell(dateStr, day, isToday, "h-20");
          })}
        </div>
      </div>
    );
  }

  // Week view
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + offset * 7);

  const weekDates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    weekDates.push(d);
  }

  return (
    <div>
      {toolbar}
      <div className="grid grid-cols-7 gap-1">
        {weekDates.map((d, i) => (
          <div key={i} className="text-center text-xs text-gray-400 dark:text-gray-500 py-1 font-medium">
            {weekDays[d.getDay()]}
          </div>
        ))}
        {weekDates.map((d) => {
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          const isToday = d.toDateString() === today.toDateString();
          return renderDayCell(dateStr, d.getDate(), isToday, "min-h-[160px]");
        })}
      </div>
    </div>
  );
}

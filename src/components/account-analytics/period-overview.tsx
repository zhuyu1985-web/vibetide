import { ExternalLink, Trophy } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import type { PeriodOverview } from "@/lib/dal/account-analytics";

interface PeriodOverviewProps {
  overview: PeriodOverview;
  className?: string;
}

/**
 * 周期总览 —— 对齐 BRTV HTML 样张的 Chapter 1 布局：
 *   1. 周期段标题（"5月10日 ~ 5月24日 / 共 15 天"）
 *   2. 每日发布量柱状图（蓝色渐变柱 + 顶部数字 + 底部日期）
 *   3. Top 10 综合得分排行榜（带金/银/铜 + ④⑤⑥... 序号；列按平台动态）
 *   4. 公式 + Top10 均值 vs 其他 N 条均值的 stat footer
 */
export function PeriodOverview({ overview, className }: PeriodOverviewProps) {
  const {
    dailyPosts,
    top10,
    stats,
    formulaLabel,
    periodLabel,
    showViews,
    showFavoritesAndShares,
  } = overview;
  // 折线图准备:用 MM-DD 形式作为 x 轴标签,保留原 ISO 给 tooltip
  const chartData = dailyPosts.map((d) => ({
    label: d.date.slice(5),
    fullDate: d.date,
    count: d.count,
  }));
  const peakCount = Math.max(0, ...dailyPosts.map((d) => d.count));
  const avgCount = dailyPosts.length === 0
    ? 0
    : Math.round(dailyPosts.reduce((s, d) => s + d.count, 0) / dailyPosts.length);
  const activeDays = dailyPosts.filter((d) => d.count > 0).length;

  return (
    <div className={cn("space-y-5", className)}>
      {/* 周期标题 */}
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <h4 className="text-[15px] font-semibold text-[#1F3864] dark:text-blue-200">
          周期总览
        </h4>
        <span className="text-[12px] text-gray-500 dark:text-gray-400">{periodLabel}</span>
      </div>

      {/* 每日发布量折线图(Recharts AreaChart + 渐变 fill) */}
      {dailyPosts.length > 0 && (
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <div className="text-[12px] text-gray-500">每日发布量趋势</div>
            <div className="text-[11px] text-gray-400 tabular-nums">
              峰值 <span className="text-[#1F3864] dark:text-blue-200 font-medium">{peakCount}</span>
              <span className="mx-2 text-gray-300">·</span>
              日均 <span className="text-[#1F3864] dark:text-blue-200 font-medium">{avgCount}</span>
              <span className="mx-2 text-gray-300">·</span>
              活跃 <span className="text-[#1F3864] dark:text-blue-200 font-medium">{activeDays}</span> / {dailyPosts.length} 天
            </div>
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 18, right: 16, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="period-overview-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2E75B6" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#2E75B6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5eef7" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  axisLine={{ stroke: "#E5E7EB" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  width={36}
                />
                <Tooltip
                  cursor={{ stroke: "#2E75B6", strokeWidth: 1, strokeDasharray: "3 3" }}
                  formatter={(v) => [`${Number(v ?? 0).toLocaleString("zh-CN")} 条`, "发布量"]}
                  labelFormatter={(_, payload) => {
                    const item = payload?.[0]?.payload as { fullDate?: string } | undefined;
                    return item?.fullDate ?? "";
                  }}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid #D0E4F5",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="发布量"
                  stroke="#2E75B6"
                  strokeWidth={2.5}
                  fill="url(#period-overview-gradient)"
                  dot={{ r: 3.5, stroke: "#2E75B6", strokeWidth: 2, fill: "#fff" }}
                  activeDot={{ r: 5, stroke: "#1F3864", strokeWidth: 2, fill: "#fff" }}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top 10 排行榜 —— 强化视觉权重：浅蓝背景 + 奖杯图标 + 大号标题 */}
      {top10.length > 0 && (
        <div className="rounded-xl bg-[#F5F9FF] dark:bg-blue-950/20 p-4 sm:p-5 border border-[#D0E4F5] dark:border-blue-900/40">
          <div className="flex items-center gap-2 mb-3">
            <Trophy size={16} className="text-[#E9A820]" />
            <h5 className="text-[14px] font-semibold text-[#1F3864] dark:text-blue-200">
              综合得分 Top 10 排行榜
            </h5>
            <span className="text-[11px] text-gray-500 ml-auto">
              共 {stats.totalCount} 条内容
            </span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-[#D0E4F5] dark:border-blue-900/40 bg-white dark:bg-slate-900">
            <table className="w-full text-[12.5px]">
              <thead className="bg-[#1F3864] text-white">
                <tr>
                  <th className="px-3 py-2 text-center font-semibold w-[68px] whitespace-nowrap">排名</th>
                  <th className="px-3 py-2 text-left font-semibold">视频标题</th>
                  {showViews && (
                    <th className="px-3 py-2 text-right font-semibold w-[80px]">播放</th>
                  )}
                  <th className="px-3 py-2 text-right font-semibold w-[70px]">点赞</th>
                  <th className="px-3 py-2 text-right font-semibold w-[70px]">评论</th>
                  {showFavoritesAndShares && (
                    <>
                      <th className="px-3 py-2 text-right font-semibold w-[70px]">收藏</th>
                      <th className="px-3 py-2 text-right font-semibold w-[70px]">转发</th>
                    </>
                  )}
                  <th className="px-3 py-2 text-right font-semibold w-[90px]">综合得分</th>
                </tr>
              </thead>
              <tbody>
                {top10.map((row) => (
                  <tr
                    key={row.collectedItemId}
                    className="odd:bg-white even:bg-[#F5F9FF] dark:odd:bg-slate-900 dark:even:bg-slate-950/40"
                  >
                    <td className="px-3 py-2 text-center">
                      <RankBadge rank={row.rank} />
                    </td>
                    <td
                      className="px-3 py-2 text-[#1F3864] dark:text-blue-200 max-w-0"
                      title={row.sourceUrl ? `${row.title} · 点击查看原文` : row.title}
                    >
                      {row.sourceUrl ? (
                        <a
                          href={row.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group inline-flex items-center gap-1 w-full min-w-0 hover:text-[#2E75B6] transition-colors"
                        >
                          <span className="flex-1 truncate">{row.title}</span>
                          <ExternalLink
                            size={12}
                            className="shrink-0 text-gray-400 group-hover:text-[#2E75B6] transition-colors"
                          />
                        </a>
                      ) : (
                        <div className="truncate">{row.title}</div>
                      )}
                    </td>
                    {showViews && (
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                        {row.views.toLocaleString("zh-CN")}
                      </td>
                    )}
                    <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {row.likes.toLocaleString("zh-CN")}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {row.comments.toLocaleString("zh-CN")}
                    </td>
                    {showFavoritesAndShares && (
                      <>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                          {row.favorites.toLocaleString("zh-CN")}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                          {row.shares.toLocaleString("zh-CN")}
                        </td>
                      </>
                    )}
                    <td className="px-3 py-2 text-right font-bold text-[#E84057] tabular-nums">
                      {row.score.toLocaleString("zh-CN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 公式 + 均值 footer */}
      <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
        {formulaLabel}　|
        Top10 均值：点赞 {stats.top10AvgLikes.toLocaleString("zh-CN")} / 评论{" "}
        {stats.top10AvgComments.toLocaleString("zh-CN")}
        {showViews && (
          <> / 播放 {stats.top10AvgViews.toLocaleString("zh-CN")}</>
        )}
        {showFavoritesAndShares && (
          <>
            {" "}/ 收藏 {stats.top10AvgFavorites.toLocaleString("zh-CN")} / 转发{" "}
            {stats.top10AvgShares.toLocaleString("zh-CN")}
          </>
        )}
        {stats.restCount > 0 && (
          <>
            　|　其他 {stats.restCount} 条均值：点赞{" "}
            {stats.restAvgLikes.toLocaleString("zh-CN")} / 评论{" "}
            {stats.restAvgComments.toLocaleString("zh-CN")}
            {showViews && (
              <> / 播放 {stats.restAvgViews.toLocaleString("zh-CN")}</>
            )}
            {showFavoritesAndShares && (
              <>
                {" "}/ 收藏 {stats.restAvgFavorites.toLocaleString("zh-CN")} / 转发{" "}
                {stats.restAvgShares.toLocaleString("zh-CN")}
              </>
            )}
          </>
        )}
      </p>
    </div>
  );
}

/**
 * Top 10 排名徽章 —— 1/2/3 金银铜渐变；4-10 用圆圈数字。
 */
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-white text-[12px] font-bold shadow"
        style={{ background: "linear-gradient(135deg,#FFD700,#FFA500)" }}
      >
        🥇
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-white text-[12px] font-bold shadow"
        style={{ background: "linear-gradient(135deg,#B0BEC5,#78909C)" }}
      >
        🥈
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-white text-[12px] font-bold shadow"
        style={{ background: "linear-gradient(135deg,#CD7F32,#A0522D)" }}
      >
        🥉
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#EEF4FB] dark:bg-blue-950/50 text-[#2E75B6] dark:text-blue-300 text-[12px] font-semibold">
      {rank}
    </span>
  );
}

import type { ChannelMetrics } from "@/lib/types";

// Generate 7 days of metrics for each channel
function generateMetrics(channelId: string, baseViews: number, baseLikes: number, baseShares: number, baseComments: number, baseFollowers: number): ChannelMetrics[] {
  const dates = ["2026-02-20", "2026-02-21", "2026-02-22", "2026-02-23", "2026-02-24", "2026-02-25", "2026-02-26"];
  return dates.map((date, i) => {
    const mult = 0.8 + Math.random() * 0.5;
    const growth = 1 + i * 0.03;
    return {
      channelId,
      date,
      views: Math.round(baseViews * mult * growth),
      likes: Math.round(baseLikes * mult * growth),
      shares: Math.round(baseShares * mult * growth),
      comments: Math.round(baseComments * mult * growth),
      followers: baseFollowers + Math.round(i * baseFollowers * 0.002),
      engagement: parseFloat((((baseLikes + baseShares + baseComments) * mult) / (baseViews * mult) * 100).toFixed(2)),
    };
  });
}

export const analyticsData: ChannelMetrics[] = [
  ...generateMetrics("ch1", 45000, 3200, 890, 420, 285000),
  ...generateMetrics("ch2", 68000, 4500, 1200, 310, 520000),
  ...generateMetrics("ch3", 185000, 12000, 5600, 2800, 1230000),
  ...generateMetrics("ch4", 32000, 2100, 780, 560, 380000),
  ...generateMetrics("ch5", 28000, 1800, 320, 180, 195000),
  ...generateMetrics("ch6", 42000, 3800, 1100, 890, 89000),
  ...generateMetrics("ch7", 56000, 5200, 2300, 670, 156000),
  ...generateMetrics("ch8", 15000, 980, 210, 340, 72000),
];

export const topContent = [
  { title: "GPT-5发布：AI再进一步", channel: "抖音", views: 523000, likes: 32100, date: "2026-02-25" },
  { title: "数字人民币跨境新突破", channel: "微信公众号", views: 186000, likes: 12400, date: "2026-02-24" },
  { title: "春季档票房破纪录解析", channel: "头条号", views: 145000, likes: 8900, date: "2026-02-23" },
  { title: "AI教育课标解读", channel: "知乎", views: 98000, likes: 6700, date: "2026-02-22" },
  { title: "健身行业AI革命", channel: "小红书", views: 87000, likes: 9200, date: "2026-02-21" },
];

export const weeklyStats = {
  totalViews: 1256000,
  totalViewsChange: 18.3,
  avgEngagement: 5.8,
  avgEngagementChange: 0.7,
  totalFollowersGain: 12800,
  totalFollowersGainChange: 23.1,
  contentPublished: 28,
  contentPublishedChange: 12.0,
  hitRate: 23,
  hitRateChange: 5,
  avgReadTime: "3:42",
};

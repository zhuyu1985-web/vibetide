import type { Competitor } from "@/lib/types";

export const competitors: Competitor[] = [
  {
    id: "comp1",
    name: "36氪",
    platform: "全平台",
    followers: 8500000,
    avgViews: 125000,
    publishFreq: "日均15篇",
    strengths: ["科技领域权威", "快讯速度快", "深度分析优质"],
    gaps: ["视频内容偏少", "互动率一般"],
  },
  {
    id: "comp2",
    name: "虎嗅",
    platform: "全平台",
    followers: 5200000,
    avgViews: 89000,
    publishFreq: "日均8篇",
    strengths: ["深度报道出色", "作者IP强", "评论质量高"],
    gaps: ["更新频率偏低", "短视频布局慢"],
  },
  {
    id: "comp3",
    name: "财新",
    platform: "微信+网站",
    followers: 3800000,
    avgViews: 156000,
    publishFreq: "日均12篇",
    strengths: ["独家信源多", "付费内容模式成熟", "政经分析深入"],
    gaps: ["年轻用户触达弱", "抖音/B站缺位"],
  },
  {
    id: "comp4",
    name: "澎湃新闻",
    platform: "全平台",
    followers: 12000000,
    avgViews: 210000,
    publishFreq: "日均50篇",
    strengths: ["时政新闻快", "调查报道强", "品牌影响力大"],
    gaps: ["科技垂直度不够", "内容同质化偏高"],
  },
  {
    id: "comp5",
    name: "第一财经",
    platform: "全平台",
    followers: 6100000,
    avgViews: 98000,
    publishFreq: "日均20篇",
    strengths: ["财经数据专业", "视频直播强", "国际视野"],
    gaps: ["技术类内容薄弱", "社交媒体运营一般"],
  },
];

export const competitiveInsights = [
  {
    type: "gap" as const,
    title: "短视频内容差距",
    description: "竞品平均短视频日更3条，我们仅1条。建议增加短视频产出。",
    priority: "high" as const,
  },
  {
    type: "opportunity" as const,
    title: "AI垂直赛道机会",
    description: "主要竞品尚未建立AI专题频道，我们可以率先占位。",
    priority: "high" as const,
  },
  {
    type: "gap" as const,
    title: "互动率需提升",
    description: "我们平均互动率5.8%，行业标杆达到8.2%，需优化互动策略。",
    priority: "medium" as const,
  },
  {
    type: "alert" as const,
    title: "漏题提醒",
    description: "「数字人民币跨境支付」话题竞品已全部覆盖，我们尚未发稿。",
    priority: "high" as const,
  },
  {
    type: "opportunity" as const,
    title: "知乎长文优势",
    description: "知乎平台竞品覆盖率仅40%，我们的深度内容在知乎表现突出。",
    priority: "medium" as const,
  },
];

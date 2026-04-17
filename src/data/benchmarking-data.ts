export interface BenchmarkTopic {
  id: string;
  title: string;
  category: string;
  mediaScores: {
    media: string;
    isUs: boolean;
    scores: { dimension: string; score: number }[];
    total: number;
    publishTime: string;
  }[];
  radarData: { dimension: string; us: number; best: number }[];
  improvements: string[];
}

export interface MissedTopic {
  id: string;
  title: string;
  priority: "high" | "medium" | "low";
  discoveredAt: string;
  competitors: string[];
  heatScore: number;
  category: string;
  type: "breaking" | "trending" | "analysis";
  status: "missed" | "tracking" | "resolved";
}

export interface WeeklyReport {
  period: string;
  overallScore: number;
  missedRate: number;
  responseSpeed: string;
  coverageRate: number;
  trends: { week: string; score: number; missedRate: number }[];
  gapList: { area: string; gap: string; suggestion: string }[];
}

export const dimensions = ["叙事角度", "视觉品质", "互动策略", "时效性"];

export const benchmarkTopics: BenchmarkTopic[] = [
  {
    id: "bt-1",
    title: "AI手机大战：三巨头旗舰同日发布",
    category: "科技",
    mediaScores: [
      {
        media: "我方（Vibe Media）",
        isUs: true,
        scores: [
          { dimension: "叙事角度", score: 7 },
          { dimension: "视觉品质", score: 8 },
          { dimension: "互动策略", score: 6 },
          { dimension: "时效性", score: 9 },
        ],
        total: 30,
        publishTime: "09:15",
      },
      {
        media: "36氪",
        isUs: false,
        scores: [
          { dimension: "叙事角度", score: 9 },
          { dimension: "视觉品质", score: 7 },
          { dimension: "互动策略", score: 8 },
          { dimension: "时效性", score: 8 },
        ],
        total: 32,
        publishTime: "08:30",
      },
      {
        media: "虎嗅",
        isUs: false,
        scores: [
          { dimension: "叙事角度", score: 8 },
          { dimension: "视觉品质", score: 6 },
          { dimension: "互动策略", score: 7 },
          { dimension: "时效性", score: 7 },
        ],
        total: 28,
        publishTime: "09:45",
      },
      {
        media: "澎湃新闻",
        isUs: false,
        scores: [
          { dimension: "叙事角度", score: 7 },
          { dimension: "视觉品质", score: 8 },
          { dimension: "互动策略", score: 5 },
          { dimension: "时效性", score: 9 },
        ],
        total: 29,
        publishTime: "08:00",
      },
    ],
    radarData: [
      { dimension: "叙事角度", us: 7, best: 9 },
      { dimension: "视觉品质", us: 8, best: 8 },
      { dimension: "互动策略", us: 6, best: 8 },
      { dimension: "时效性", us: 9, best: 9 },
    ],
    improvements: [
      "叙事角度：增加供应链视角的深度分析，参考36氪的多维度拆解方式",
      "互动策略：添加投票互动和评论引导，提升用户参与度",
      "标题优化：使用更具冲突性的标题结构",
    ],
  },
  {
    id: "bt-2",
    title: "新能源汽车降价潮",
    category: "汽车",
    mediaScores: [
      {
        media: "我方（Vibe Media）",
        isUs: true,
        scores: [
          { dimension: "叙事角度", score: 8 },
          { dimension: "视觉品质", score: 7 },
          { dimension: "互动策略", score: 7 },
          { dimension: "时效性", score: 6 },
        ],
        total: 28,
        publishTime: "10:30",
      },
      {
        media: "第一财经",
        isUs: false,
        scores: [
          { dimension: "叙事角度", score: 9 },
          { dimension: "视觉品质", score: 9 },
          { dimension: "互动策略", score: 6 },
          { dimension: "时效性", score: 8 },
        ],
        total: 32,
        publishTime: "08:00",
      },
      {
        media: "财新",
        isUs: false,
        scores: [
          { dimension: "叙事角度", score: 9 },
          { dimension: "视觉品质", score: 7 },
          { dimension: "互动策略", score: 5 },
          { dimension: "时效性", score: 7 },
        ],
        total: 28,
        publishTime: "09:00",
      },
    ],
    radarData: [
      { dimension: "叙事角度", us: 8, best: 9 },
      { dimension: "视觉品质", us: 7, best: 9 },
      { dimension: "互动策略", us: 7, best: 7 },
      { dimension: "时效性", us: 6, best: 8 },
    ],
    improvements: [
      "时效性：需提前预设模板，降价消息出来后15分钟内发布",
      "视觉品质：增加数据可视化图表，参考第一财经的交互式价格对比",
    ],
  },
  {
    id: "bt-3",
    title: "两会数字经济前瞻",
    category: "政策",
    mediaScores: [
      {
        media: "我方（Vibe Media）",
        isUs: true,
        scores: [
          { dimension: "叙事角度", score: 6 },
          { dimension: "视觉品质", score: 7 },
          { dimension: "互动策略", score: 8 },
          { dimension: "时效性", score: 8 },
        ],
        total: 29,
        publishTime: "07:30",
      },
      {
        media: "澎湃新闻",
        isUs: false,
        scores: [
          { dimension: "叙事角度", score: 9 },
          { dimension: "视觉品质", score: 8 },
          { dimension: "互动策略", score: 7 },
          { dimension: "时效性", score: 9 },
        ],
        total: 33,
        publishTime: "06:00",
      },
    ],
    radarData: [
      { dimension: "叙事角度", us: 6, best: 9 },
      { dimension: "视觉品质", us: 7, best: 8 },
      { dimension: "互动策略", us: 8, best: 8 },
      { dimension: "时效性", us: 8, best: 9 },
    ],
    improvements: [
      "叙事角度：需增加代表委员直接引用和独家观点",
      "时效性：建议提前24小时准备预测稿件",
    ],
  },
];

export const missedTopics: MissedTopic[] = [
  {
    id: "mt-1",
    title: "科技部发布AI安全白皮书",
    priority: "high",
    discoveredAt: "14:20",
    competitors: ["财新", "36氪", "澎湃"],
    heatScore: 78,
    category: "政策",
    type: "breaking",
    status: "missed",
  },
  {
    id: "mt-2",
    title: "字节跳动内部大模型曝光",
    priority: "high",
    discoveredAt: "11:30",
    competitors: ["虎嗅", "36氪"],
    heatScore: 85,
    category: "科技",
    type: "trending",
    status: "tracking",
  },
  {
    id: "mt-3",
    title: "海底捞推出AI服务员",
    priority: "medium",
    discoveredAt: "13:00",
    competitors: ["第一财经"],
    heatScore: 62,
    category: "商业",
    type: "trending",
    status: "missed",
  },
  {
    id: "mt-4",
    title: "某地自动驾驶事故引发讨论",
    priority: "high",
    discoveredAt: "10:15",
    competitors: ["澎湃", "财新", "第一财经"],
    heatScore: 91,
    category: "社会",
    type: "breaking",
    status: "resolved",
  },
  {
    id: "mt-5",
    title: "OpenAI推出企业版Agent平台",
    priority: "medium",
    discoveredAt: "15:30",
    competitors: ["36氪"],
    heatScore: 65,
    category: "科技",
    type: "analysis",
    status: "missed",
  },
  {
    id: "mt-6",
    title: "直播带货新监管规则生效",
    priority: "medium",
    discoveredAt: "09:00",
    competitors: ["澎湃"],
    heatScore: 58,
    category: "商业",
    type: "breaking",
    status: "tracking",
  },
  {
    id: "mt-7",
    title: "Z世代消费趋势报告发布",
    priority: "low",
    discoveredAt: "16:00",
    competitors: ["第一财经", "虎嗅"],
    heatScore: 45,
    category: "财经",
    type: "analysis",
    status: "missed",
  },
  {
    id: "mt-8",
    title: "全球芯片出口管制新动态",
    priority: "high",
    discoveredAt: "12:45",
    competitors: ["财新", "澎湃", "36氪", "第一财经"],
    heatScore: 88,
    category: "科技",
    type: "breaking",
    status: "tracking",
  },
];

export const weeklyReport: WeeklyReport = {
  period: "2026-02-24 ~ 2026-03-01",
  overallScore: 76,
  missedRate: 2.3,
  responseSpeed: "12分钟",
  coverageRate: 94.5,
  trends: [
    { week: "W1", score: 68, missedRate: 8.5 },
    { week: "W2", score: 71, missedRate: 6.2 },
    { week: "W3", score: 73, missedRate: 4.1 },
    { week: "W4", score: 76, missedRate: 2.3 },
  ],
  gapList: [
    { area: "政策类报道", gap: "深度不足", suggestion: "增加专家连线和政策解读模板" },
    { area: "突发事件", gap: "响应慢15分钟", suggestion: "启用预设模板+自动触发机制" },
    { area: "财经分析", gap: "数据可视化弱", suggestion: "引入自动图表生成工具" },
  ],
};

export const missedTypeDistribution = [
  { name: "突发新闻", value: 45, color: "#ef4444" },
  { name: "趋势话题", value: 30, color: "#f59e0b" },
  { name: "深度分析", value: 25, color: "#3b82f6" },
];

/* ═══════════════════════════════════════════════════════════
   Redesigned Benchmarking — Topic Compare & Missing Topics
   ═══════════════════════════════════════════════════════════ */

import type {
  TopicCompareArticle,
  MissingTopicClue,
  MissingTopicKPIs,
} from "@/lib/types";

export const topicCompareArticles: TopicCompareArticle[] = [
  {
    id: "tc-1",
    title: "AI手机大战：三巨头旗舰同日发布引发市场震动",
    publishedAt: "2026-04-17T09:30:00Z",
    channels: ["APP", "微信", "微博"],
    contentType: "text",
    readCount: 125000,
    likeCount: 3280,
    commentCount: 856,
    shareCount: 1204,
    benchmarkCount: 47,
    hasAnalysis: true,
  },
  {
    id: "tc-2",
    title: "新能源汽车降价潮：消费者持币观望还是立即入手",
    publishedAt: "2026-04-16T14:20:00Z",
    channels: ["APP", "微信"],
    contentType: "video",
    readCount: 83000,
    likeCount: 1560,
    commentCount: 423,
    shareCount: 678,
    benchmarkCount: 23,
    hasAnalysis: true,
  },
  {
    id: "tc-3",
    title: "两会数字经济前瞻：政策解读与产业趋势分析",
    publishedAt: "2026-04-15T08:00:00Z",
    channels: ["APP"],
    contentType: "text",
    readCount: 51000,
    likeCount: 890,
    commentCount: 234,
    shareCount: 345,
    benchmarkCount: 15,
    hasAnalysis: true,
  },
  {
    id: "tc-4",
    title: "春季招聘季：高校毕业生就业新趋势调查报告",
    publishedAt: "2026-04-14T16:45:00Z",
    channels: ["微信", "抖音"],
    contentType: "text",
    readCount: 38000,
    likeCount: 620,
    commentCount: 156,
    shareCount: 203,
    benchmarkCount: 0,
    hasAnalysis: false,
  },
];

export const missingTopicClues: MissingTopicClue[] = [
  {
    id: "mt-1",
    title: "科技部发布AI安全白皮书，业界反响强烈",
    sourceType: "sentiment_event",
    sourceDetail: "舆情系统·重大事件推送",
    heatScore: 92,
    discoveredAt: "2026-04-17T10:15:00Z",
    status: "suspected",
    urgency: "urgent",
    isMultiSource: true,
    competitors: ["人民日报", "新华社", "央视新闻"],
  },
  {
    id: "mt-2",
    title: "字节跳动内部大模型产品线全面曝光",
    sourceType: "social_hot",
    sourceDetail: "微博热搜 #5",
    heatScore: 75,
    discoveredAt: "2026-04-17T09:42:00Z",
    status: "suspected",
    urgency: "normal",
    isMultiSource: false,
    competitors: ["澎湃新闻", "第一财经"],
  },
  {
    id: "mt-3",
    title: "新华社深度报道：农村电商助力乡村振兴新模式",
    sourceType: "benchmark_media",
    sourceDetail: "新华社公众号",
    heatScore: 38,
    discoveredAt: "2026-04-17T08:30:00Z",
    status: "covered",
    urgency: "watch",
    isMultiSource: false,
    competitors: ["新华社"],
  },
  {
    id: "mt-4",
    title: "多地出台住房公积金新政策，利率下调",
    sourceType: "sentiment_event",
    sourceDetail: "舆情系统·热点事件",
    heatScore: 85,
    discoveredAt: "2026-04-17T07:20:00Z",
    status: "confirmed",
    urgency: "urgent",
    isMultiSource: false,
    competitors: ["人民日报", "经济日报", "各省党报"],
  },
  {
    id: "mt-5",
    title: "韩国综艺节目引发网络热议",
    sourceType: "social_hot",
    sourceDetail: "抖音热榜 TOP8",
    heatScore: 62,
    discoveredAt: "2026-04-17T09:00:00Z",
    status: "excluded",
    urgency: "watch",
    isMultiSource: false,
    competitors: [],
  },
];

export const missingTopicKPIs: MissingTopicKPIs = {
  totalClues: 156,
  suspectedMissed: 12,
  confirmedMissed: 5,
  handled: 3,
  coverageRate: 94.5,
};

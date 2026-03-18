import type { ChannelConfig, PublishPlan } from "@/lib/types";

export const channels: ChannelConfig[] = [
  { id: "ch1", name: "微信公众号", platform: "wechat", icon: "MessageSquare", followers: 285000, status: "active" },
  { id: "ch2", name: "头条号", platform: "toutiao", icon: "Newspaper", followers: 520000, status: "active" },
  { id: "ch3", name: "抖音", platform: "douyin", icon: "Play", followers: 1230000, status: "active" },
  { id: "ch4", name: "微博", platform: "weibo", icon: "AtSign", followers: 380000, status: "active" },
  { id: "ch5", name: "百家号", platform: "baidu", icon: "Globe", followers: 195000, status: "active" },
  { id: "ch6", name: "B站", platform: "bilibili", icon: "Tv", followers: 89000, status: "active" },
  { id: "ch7", name: "小红书", platform: "xiaohongshu", icon: "BookOpen", followers: 156000, status: "active" },
  { id: "ch8", name: "知乎", platform: "zhihu", icon: "HelpCircle", followers: 72000, status: "paused" },
];

export const publishPlans: PublishPlan[] = [
  { id: "pp1", taskId: "ct1", channelId: "ch1", scheduledAt: "2026-02-26T14:00:00Z", status: "scheduled", title: "AI手机大战：消费者的三重抉择" },
  { id: "pp2", taskId: "ct1", channelId: "ch2", scheduledAt: "2026-02-26T14:30:00Z", status: "scheduled", title: "AI手机大战：消费者的三重抉择" },
  { id: "pp3", taskId: "ct3", channelId: "ch3", scheduledAt: "2026-02-26T15:00:00Z", status: "scheduled", title: "60秒看懂AI手机大战" },
  { id: "pp4", taskId: "ct1", channelId: "ch4", scheduledAt: "2026-02-26T14:00:00Z", status: "scheduled", title: "AI手机大战：消费者的三重抉择" },
  { id: "pp5", taskId: "ct3", channelId: "ch6", scheduledAt: "2026-02-26T16:00:00Z", status: "scheduled", title: "60秒看懂AI手机大战" },
  { id: "pp6", taskId: "ct2", channelId: "ch1", scheduledAt: "2026-02-27T08:00:00Z", status: "scheduled", title: "新能源降价潮深度分析" },
  { id: "pp7", taskId: "ct2", channelId: "ch2", scheduledAt: "2026-02-27T08:30:00Z", status: "scheduled", title: "新能源降价潮深度分析" },
  { id: "pp8", taskId: "ct2", channelId: "ch7", scheduledAt: "2026-02-27T10:00:00Z", status: "scheduled", title: "新能源降价潮深度分析" },
  { id: "pp9", taskId: "ct4", channelId: "ch1", scheduledAt: "2026-02-27T14:00:00Z", status: "scheduled", title: "两会数字经济前瞻" },
  // Past published items
  { id: "pp10", taskId: "ct-old1", channelId: "ch1", scheduledAt: "2026-02-25T14:00:00Z", status: "published", title: "GPT-5发布：AI再进一步" },
  { id: "pp11", taskId: "ct-old1", channelId: "ch3", scheduledAt: "2026-02-25T15:00:00Z", status: "published", title: "GPT-5发布速览" },
  { id: "pp12", taskId: "ct-old2", channelId: "ch1", scheduledAt: "2026-02-24T14:00:00Z", status: "published", title: "数字人民币跨境新突破" },
];

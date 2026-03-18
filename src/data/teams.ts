import type { Team } from "@/lib/types";

export const teams: Team[] = [
  {
    id: "team1",
    name: "新闻快讯突击队",
    scenario: "breaking_news",
    members: ["xiaolei", "xiaoce", "xiaowen", "xiaoshen", "xiaofa"],
    humanMembers: ["张编辑"],
    rules: {
      approvalRequired: true,
      reportFrequency: "实时",
      sensitiveTopics: ["政治", "军事", "灾难"],
    },
    createdAt: "2026-01-15T10:00:00Z",
  },
  {
    id: "team2",
    name: "深度报道精英组",
    scenario: "deep_report",
    members: ["xiaolei", "xiaoce", "xiaozi", "xiaowen", "xiaoshen", "xiaoshu"],
    humanMembers: ["李主编", "王记者"],
    rules: {
      approvalRequired: true,
      reportFrequency: "每日",
      sensitiveTopics: ["政治", "法律", "伦理"],
    },
    createdAt: "2026-01-20T10:00:00Z",
  },
  {
    id: "team3",
    name: "新媒体运营全能队",
    scenario: "social_media",
    members: ["xiaolei", "xiaoce", "xiaozi", "xiaowen", "xiaojian", "xiaoshen", "xiaofa", "xiaoshu"],
    humanMembers: ["张编辑", "赵运营"],
    rules: {
      approvalRequired: false,
      reportFrequency: "每4小时",
      sensitiveTopics: ["政治", "低俗"],
    },
    createdAt: "2026-02-01T10:00:00Z",
  },
];

export const teamScenarios = [
  {
    id: "breaking_news",
    name: "新闻快讯",
    description: "快速响应突发新闻，15分钟内出稿",
    icon: "Zap",
    recommended: ["xiaolei", "xiaoce", "xiaowen", "xiaoshen", "xiaofa"] as const,
  },
  {
    id: "deep_report",
    name: "深度报道",
    description: "深度分析+数据调研，高质量长文",
    icon: "BookOpen",
    recommended: ["xiaolei", "xiaoce", "xiaozi", "xiaowen", "xiaoshen", "xiaoshu"] as const,
  },
  {
    id: "social_media",
    name: "新媒体运营",
    description: "全渠道内容生产+分发+数据闭环",
    icon: "Share2",
    recommended: ["xiaolei", "xiaoce", "xiaozi", "xiaowen", "xiaojian", "xiaoshen", "xiaofa", "xiaoshu"] as const,
  },
  {
    id: "custom",
    name: "自定义团队",
    description: "按需自由组合AI员工团队",
    icon: "Settings",
    recommended: [] as const,
  },
];

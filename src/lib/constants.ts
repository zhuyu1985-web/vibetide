import {
  Telescope,
  Lightbulb,
  Package,
  PenTool,
  Film,
  Search,
  Radio,
  BarChart3,
  Brain,
  Crown,
  FileSearch,
  type LucideIcon,
} from "lucide-react";

export type EmployeeId =
  | "xiaolei"
  | "xiaoce"
  | "xiaozi"
  | "xiaowen"
  | "xiaojian"
  | "xiaoshen"
  | "xiaofa"
  | "xiaoshu"
  | "xiaotan"
  | "advisor"
  | "leader";

export interface EmployeeMeta {
  id: EmployeeId;
  name: string;
  nickname: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
}

export const EMPLOYEE_META: Record<EmployeeId, EmployeeMeta> = {
  xiaolei: {
    id: "xiaolei",
    name: "热点分析师",
    nickname: "热点分析师",
    title: "热点分析师",
    description: "实时捕捉全网热点，第一时间发现新闻线索",
    icon: Telescope,
    color: "#f59e0b",
    bgColor: "rgba(245,158,11,0.12)",
  },
  xiaoce: {
    id: "xiaoce",
    name: "选题策划师",
    nickname: "选题策划师",
    title: "选题策划师",
    description: "挖掘独特选题角度，策划高价值内容主题",
    icon: Lightbulb,
    color: "#8b5cf6",
    bgColor: "rgba(139,92,246,0.12)",
  },
  xiaozi: {
    id: "xiaozi",
    name: "素材研究员",
    nickname: "素材研究员",
    title: "素材研究员",
    description: "整合多源素材资源，构建可检索媒资知识库",
    icon: Package,
    color: "#10b981",
    bgColor: "rgba(16,185,129,0.12)",
  },
  xiaowen: {
    id: "xiaowen",
    name: "内容创作师",
    nickname: "内容创作师",
    title: "内容创作师",
    description: "多风格内容生成，标题摘要脚本一键产出",
    icon: PenTool,
    color: "#3b82f6",
    bgColor: "rgba(59,130,246,0.12)",
  },
  xiaojian: {
    id: "xiaojian",
    name: "视频制片人",
    nickname: "视频制片人",
    title: "视频制片人",
    description: "视频剪辑方案设计，封面排版音频一体化",
    icon: Film,
    color: "#ef4444",
    bgColor: "rgba(239,68,68,0.12)",
  },
  xiaoshen: {
    id: "xiaoshen",
    name: "质量审核官",
    nickname: "质量审核官",
    title: "质量审核官",
    description: "多维内容审核，把关事实、质量与合规",
    icon: Search,
    color: "#6366f1",
    bgColor: "rgba(99,102,241,0.12)",
  },
  xiaofa: {
    id: "xiaofa",
    name: "渠道运营师",
    nickname: "渠道运营师",
    title: "渠道运营师",
    description: "渠道策略制定，多平台精准适配分发",
    icon: Radio,
    color: "#14b8a6",
    bgColor: "rgba(20,184,166,0.12)",
  },
  xiaoshu: {
    id: "xiaoshu",
    name: "数据分析师",
    nickname: "数据分析师",
    title: "数据分析师",
    description: "数据洞察分析，效果追踪与内容复盘",
    icon: BarChart3,
    color: "#f97316",
    bgColor: "rgba(249,115,22,0.12)",
  },
  xiaotan: {
    id: "xiaotan",
    name: "深度调查员",
    nickname: "深度调查员",
    title: "深度调查员",
    description: "深度调查与专题追踪，挖掘新闻背后的真相",
    icon: FileSearch,
    color: "#0ea5e9",
    bgColor: "rgba(14,165,233,0.12)",
  },
  advisor: {
    id: "advisor",
    name: "频道顾问",
    nickname: "顾问",
    title: "频道顾问",
    description: "频道运营策略咨询，内容方向智能建议",
    icon: Brain,
    color: "#ec4899",
    bgColor: "rgba(236,72,153,0.12)",
  },
  leader: {
    id: "leader",
    name: "任务总监",
    nickname: "任务总监",
    title: "智能项目管理与任务调度",
    description: "智能项目管理，多员工协同任务调度",
    icon: Crown,
    color: "#e11d48",
    bgColor: "rgba(225,29,72,0.12)",
  },
};

export const EMPLOYEE_SHORT_DESC: Record<EmployeeId, string> = {
  xiaolei: "全网热点实时捕捉，深度趋势分析",
  xiaoce: "洞察用户需求，策划高价值选题",
  xiaozi: "多源素材整合，构建可检索素材库",
  xiaowen: "多风格生成，标题摘要脚本一体化",
  xiaojian: "视频剪辑与封面、音频一体化制作",
  xiaoshen: "多维事实核查，质量合规全面把关",
  xiaofa: "多平台策略制定，精准分发与投放",
  xiaoshu: "实时数据洞察，追踪效果深度复盘",
  xiaotan: "深度调查专题追踪，挖掘事件真相",
  advisor: "频道运营策略咨询，内容方向建议",
  leader: "智能项目管理，多员工协同调度",
};

export const WORKFLOW_STEPS = [
  { key: "monitor", label: "热点监控", employeeId: "xiaolei" as EmployeeId },
  { key: "plan", label: "选题策划", employeeId: "xiaoce" as EmployeeId },
  { key: "material", label: "素材准备", employeeId: "xiaozi" as EmployeeId },
  { key: "create", label: "内容创作", employeeId: "xiaowen" as EmployeeId },
  { key: "produce", label: "视频制作", employeeId: "xiaojian" as EmployeeId },
  { key: "review", label: "质量审核", employeeId: "xiaoshen" as EmployeeId },
  { key: "publish", label: "渠道发布", employeeId: "xiaofa" as EmployeeId },
  { key: "analyze", label: "数据分析", employeeId: "xiaoshu" as EmployeeId },
] as const;

/**
 * F4.1.23: Work preference templates — one-click apply common configurations.
 */
export const WORK_PREFERENCE_TEMPLATES = {
  autonomous: {
    label: "高度自主",
    description: "AI员工自主决策，仅重大事项汇报",
    preferences: {
      proactivity: "aggressive",
      reportingFrequency: "daily",
      autonomyLevel: 90,
      communicationStyle: "concise",
      workingHours: "24/7",
    },
  },
  strict: {
    label: "严格审批",
    description: "每步操作都需要确认，频繁汇报",
    preferences: {
      proactivity: "conservative",
      reportingFrequency: "realtime",
      autonomyLevel: 20,
      communicationStyle: "detailed",
      workingHours: "business",
    },
  },
  balanced: {
    label: "均衡模式",
    description: "适度自主，定期汇报，标准工作流",
    preferences: {
      proactivity: "balanced",
      reportingFrequency: "hourly",
      autonomyLevel: 60,
      communicationStyle: "standard",
      workingHours: "business",
    },
  },
  creative: {
    label: "创意优先",
    description: "鼓励探索和创新，宽松约束",
    preferences: {
      proactivity: "aggressive",
      reportingFrequency: "hourly",
      autonomyLevel: 75,
      communicationStyle: "creative",
      workingHours: "flexible",
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Benchmarking: Preset Monitored Platforms
// ---------------------------------------------------------------------------

export const BENCHMARK_PRESET_PLATFORMS = [
  // 央级
  { name: "人民网", url: "people.com.cn", category: "central" as const, searchQuery: "site:people.com.cn" },
  { name: "新华网", url: "xinhuanet.com", category: "central" as const, searchQuery: "site:xinhuanet.com" },
  { name: "央视新闻", url: "news.cctv.com", category: "central" as const, searchQuery: "site:cctv.com 新闻" },
  { name: "光明网", url: "gmw.cn", category: "central" as const, searchQuery: "site:gmw.cn" },
  { name: "中国新闻网", url: "chinanews.com.cn", category: "central" as const, searchQuery: "site:chinanews.com.cn" },
  // 省级
  { name: "澎湃新闻", url: "thepaper.cn", category: "provincial" as const, province: "上海", searchQuery: "site:thepaper.cn" },
  { name: "红星新闻", url: "cdsb.com", category: "provincial" as const, province: "四川", searchQuery: "site:cdsb.com" },
] as const;

// ---------------------------------------------------------------------------
// Builtin Skill Names (lightweight slug→display name map for client components)
// Full skill definitions are loaded from skills/*/SKILL.md via skill-loader.ts
// ---------------------------------------------------------------------------

export const BUILTIN_SKILL_NAMES: Record<string, string> = {
  web_search: "全网搜索",
  web_deep_read: "网页深读",
  trending_topics: "热榜聚合",
  trend_monitor: "趋势监控",
  social_listening: "社交聆听",
  news_aggregation: "新闻聚合",
  sentiment_analysis: "情感分析",
  topic_extraction: "主题提取",
  competitor_analysis: "竞品分析",
  audience_analysis: "受众分析",
  fact_check: "事实核查",
  heat_scoring: "热度评分",
  content_generate: "内容生成",
  headline_generate: "标题生成",
  summary_generate: "摘要生成",
  script_generate: "脚本生成",
  style_rewrite: "风格改写",
  translation: "多语翻译",
  angle_design: "角度设计",
  video_edit_plan: "视频剪辑方案",
  thumbnail_generate: "封面生成",
  layout_design: "排版设计",
  audio_plan: "音频方案",
  quality_review: "质量审核",
  compliance_check: "合规检查",
  task_planning: "任务规划",
  publish_strategy: "发布策略",
  knowledge_retrieval: "知识检索",
  media_search: "媒资检索",
  case_reference: "案例参考",
  data_report: "数据报告",
};

// ---------------------------------------------------------------------------
// Employee Core Skills Mapping
// Core skills are auto-bound and cannot be unbound.
// ---------------------------------------------------------------------------

// Auto Scenario Templates (M4.F135)
export const AUTO_SCENARIO_TEMPLATES: Record<
  string,
  {
    name: string;
    description: string;
    steps: string[];
    approvalRequired: boolean;
    cron?: string;
  }
> = {
  breaking_news_auto: {
    name: "快讯自动推送",
    description: "热点触发→快速成稿→自动审核→即时发布",
    steps: ["monitor", "create", "review", "publish"],
    approvalRequired: false,
  },
  event_express: {
    name: "赛事速报",
    description: "赛事监控→自动裁剪→快速发布",
    steps: ["monitor", "create", "produce", "publish"],
    approvalRequired: false,
  },
  daily_briefing: {
    name: "每日新闻简报",
    description: "每日6点自动生产新闻简报",
    steps: ["monitor", "plan", "create", "review", "publish"],
    approvalRequired: true,
    cron: "0 6 * * *",
  },
  weekly_deep_report: {
    name: "周度深度报道",
    description: "每周一自动启动深度报道流程",
    steps: [
      "monitor",
      "plan",
      "material",
      "create",
      "produce",
      "review",
      "publish",
      "analyze",
    ],
    approvalRequired: true,
    cron: "0 9 * * 1",
  },
};

// ---------------------------------------------------------------------------
// Team Builder Scenarios (static UI config)
// ---------------------------------------------------------------------------

export interface TeamScenario {
  id: string;
  name: string;
  description: string;
  icon: string;
  recommended: readonly EmployeeId[];
}

export const TEAM_SCENARIOS: TeamScenario[] = [
  {
    id: "breaking_news",
    name: "新闻快讯",
    description: "快速响应突发新闻，15分钟内出稿",
    icon: "Zap",
    recommended: ["xiaolei", "xiaoce", "xiaowen", "xiaoshen", "xiaofa"],
  },
  {
    id: "deep_report",
    name: "深度报道",
    description: "深度分析+数据调研，高质量长文",
    icon: "BookOpen",
    recommended: ["xiaolei", "xiaoce", "xiaozi", "xiaowen", "xiaoshen", "xiaoshu"],
  },
  {
    id: "social_media",
    name: "新媒体运营",
    description: "全渠道内容生产+分发+数据闭环",
    icon: "Share2",
    recommended: ["xiaolei", "xiaoce", "xiaozi", "xiaowen", "xiaojian", "xiaoshen", "xiaofa", "xiaoshu"],
  },
  {
    id: "custom",
    name: "自定义团队",
    description: "按需自由组合AI员工团队",
    icon: "Settings",
    recommended: [],
  },
];

export const EMPLOYEE_CORE_SKILLS: Record<string, string[]> = {
  xiaolei: ["web_search", "web_deep_read", "trending_topics", "trend_monitor", "social_listening", "heat_scoring"],
  xiaoce: ["web_search", "web_deep_read", "trending_topics", "topic_extraction", "angle_design", "audience_analysis", "task_planning"],
  xiaozi: ["media_search", "knowledge_retrieval", "news_aggregation", "case_reference"],
  xiaowen: ["content_generate", "headline_generate", "summary_generate", "style_rewrite", "script_generate"],
  xiaojian: ["video_edit_plan", "thumbnail_generate", "layout_design", "audio_plan"],
  xiaoshen: ["quality_review", "compliance_check", "fact_check", "sentiment_analysis"],
  xiaofa: ["publish_strategy", "style_rewrite", "translation", "audience_analysis"],
  xiaoshu: ["data_report", "competitor_analysis", "audience_analysis", "heat_scoring"],
};

// Read-only tool names for advisor authority level
export const READ_ONLY_TOOL_NAMES = [
  "web_search", "web_deep_read", "trending_topics",
  "trend_monitor", "social_listening", "news_aggregation",
  "knowledge_retrieval", "media_search", "case_reference", "data_report",
  "sentiment_analysis", "topic_extraction", "competitor_analysis",
  "audience_analysis", "fact_check", "heat_scoring",
] as const;

// Tool descriptions for UI display
export const TOOL_DESCRIPTIONS: Record<string, string> = {
  web_search: "搜索互联网获取实时信息",
  web_deep_read: "抓取网页正文进行深度分析",
  trending_topics: "聚合多平台实时热榜",
  trend_monitor: "监控热点趋势和话题变化",
  social_listening: "社交媒体舆情监控",
  news_aggregation: "聚合多源新闻资讯",
  knowledge_retrieval: "检索知识库内容",
  media_search: "搜索媒资库素材",
  case_reference: "查询案例库参考",
  data_report: "生成数据分析报告",
  sentiment_analysis: "情感分析",
  topic_extraction: "话题提取和分析",
  competitor_analysis: "竞品分析",
  audience_analysis: "受众分析",
  fact_check: "事实核查",
  heat_scoring: "热度评分计算",
  content_generate: "生成内容文案",
  headline_generate: "生成标题",
  summary_generate: "生成摘要",
  style_rewrite: "风格改写",
  script_generate: "生成脚本",
  video_edit_plan: "视频剪辑方案",
  thumbnail_generate: "缩略图方案",
  layout_design: "排版设计方案",
  audio_plan: "音频配置方案",
  quality_review: "质量审核",
  compliance_check: "合规性检查",
  publish_strategy: "发布策略制定",
  translation: "内容翻译",
  task_planning: "任务规划",
  angle_design: "选题角度设计",
};

/**
 * 场景/工作流 category 在 UI tab 的展示顺序。
 * 顺序=阅读优先级，与 workflowCategoryEnum (12 values) 一一对应。
 * B.1 Unified Scenario Workflow spec §6.3.
 */
export const ORDERED_CATEGORIES = [
  "news",
  "deep",
  "social",
  "advanced",
  "livelihood",
  "podcast",
  "drama",
  "daily_brief",
  "video",
  "analytics",
  "distribution",
  "custom",
] as const;

export type OrderedCategory = (typeof ORDERED_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<OrderedCategory, string> = {
  news: "新闻",
  deep: "深度",
  social: "社交",
  advanced: "专项",
  livelihood: "民生",
  podcast: "播客",
  drama: "短剧",
  daily_brief: "日报",
  video: "视频",
  analytics: "分析",
  distribution: "分发",
  custom: "自定义",
};

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
  BookOpen,
  Newspaper,
  MessageSquareQuote,
  ShieldCheck,
  Mic,
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
  | "xiaoyan"
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
  xiaoyan: {
    id: "xiaoyan",
    name: "学术研究员",
    nickname: "学术研究员",
    title: "学术研究员",
    description: "客观中立的研究分析，论文级别的报告产出",
    icon: BookOpen,
    color: "#4f46e5",
    bgColor: "rgba(79,70,229,0.12)",
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
  xiaoyan: "数据驱动学术研究，论文级研报产出",
  xiaotan: "深度调查专题追踪，挖掘事件真相",
  advisor: "频道运营策略咨询，内容方向建议",
  leader: "智能项目管理，多员工协同调度",
};

/**
 * 热点深度追踪：可选行业改写维度库（24 个）。
 *
 * 用户在灵感池"深度追踪"按钮上选 1~5 个行业，系统对每个行业并行生成一份
 * 行业视角的稿件草稿，用户最终挑选 1 份入 articles 表 status=draft。
 *
 * 当前为代码常量；如果将来需要 admin 后台管理（增删行业），再迁到 DB 表。
 */
export const INDUSTRY_DIMENSIONS = [
  { key: "tech", label: "科技数码", angle: "技术突破解读、产业链冲击、用户体验视角" },
  { key: "society", label: "社会", angle: "民生影响、社会心态、群体诉求与制度反思" },
  { key: "education", label: "教育", angle: "对学生家长教育者的影响、教育公平与改革" },
  { key: "auto", label: "汽车", angle: "汽车产业链、消费者购车决策、新能源转型视角" },
  { key: "real_estate", label: "房产", angle: "楼市政策影响、刚需改善购房者视角、行业格局" },
  { key: "gaming", label: "游戏", angle: "玩家社区反应、游戏产业生态、版号与监管视角" },
  { key: "entertainment", label: "娱乐", angle: "舆论场分析、明星 IP 商业逻辑、行业生态" },
  { key: "travel", label: "旅游摄影", angle: "目的地营销、出行决策、文旅产业链视角" },
  { key: "career", label: "职场", angle: "打工人视角、企业管理启示、职业发展机会" },
  { key: "finance", label: "财经", angle: "数据深度解读、市场影响、投资者机会与风险" },
  { key: "science", label: "科学", angle: "权威专家解读、科学原理普及、前沿研究意义" },
  { key: "emotion", label: "情感", angle: "情感共鸣、人际关系启示、心理学视角" },
  { key: "parenting", label: "育儿", angle: "家长指南、孩子成长影响、亲子关系视角" },
  { key: "food", label: "美食", angle: "饮食文化、消费趋势、餐饮行业视角" },
  { key: "fashion", label: "时装美尚", angle: "流行趋势、品牌动态、消费者审美变化" },
  { key: "pet", label: "宠物", angle: "宠物经济、宠主关切、动物福利视角" },
  { key: "health", label: "健康医疗", angle: "权威医学解读、公众健康指南、医疗行业影响" },
  { key: "sports", label: "体育健身", angle: "赛事技术分析、运动员故事、体育产业商业视角" },
  { key: "rural", label: "三农", angle: "农民视角、乡村振兴政策、农业产业链" },
  { key: "history_culture", label: "历史与文化", angle: "历史镜鉴、文化传承、人文价值反思" },
  { key: "law", label: "法律司法", angle: "法律解读、司法实务、合规建议视角" },
  { key: "anime", label: "动漫", angle: "二次元社区反应、IP 商业化、亚文化趋势" },
  { key: "home_decor", label: "家居家装", angle: "家居消费、装修决策、生活方式视角" },
  { key: "other", label: "其他", angle: "综合视角，跨行业横向解读" },
] as const;

export type IndustryKey = (typeof INDUSTRY_DIMENSIONS)[number]["key"];

export const INDUSTRY_DIMENSION_MAP: Record<
  IndustryKey,
  (typeof INDUSTRY_DIMENSIONS)[number]
> = Object.fromEntries(
  INDUSTRY_DIMENSIONS.map((d) => [d.key, d]),
) as Record<IndustryKey, (typeof INDUSTRY_DIMENSIONS)[number]>;

export const MAX_INDUSTRIES_PER_TRACKING = 5;

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
  report_drafter: "学术报告草拟",
  research_query_builder: "研究检索构建",
  data_pivoter: "数据透视分析",
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

// EMPLOYEE_CORE_SKILLS 现在是 skills/*/SKILL.md frontmatter `compatibleEmployees`
// 的反向汇总（每个员工 = 出现在哪些 SKILL.md 的 compatibleEmployees 列表里）。
// SKILL.md 是 source of truth；这里的常量给 db:seed 用，DB 已存数据用
// `npx tsx scripts/sync-employee-skills-from-md.ts` 增量同步。
// xiaoyan（学术研究员）的 3 个 skill SKILL.md 没声明 compatibleEmployees，保留手工绑定。
export const EMPLOYEE_CORE_SKILLS: Record<string, string[]> = {
  xiaolei: [
    "angle_design",
    "heat_scoring",
    "news_aggregation",
    "social_listening",
    "tandian_script",
    "trend_monitor",
    "trending_topics",
    "web_deep_read",
    "web_search",
  ],
  xiaoce: [
    "angle_design",
    "audience_analysis",
    "case_reference",
    "competitor_analysis",
    "content_generate",
    "duanju_script",
    "fact_check",
    "headline_generate",
    "heat_scoring",
    "knowledge_retrieval",
    "news_aggregation",
    "summary_generate",
    "task_planning",
    "topic_extraction",
    "trending_topics",
    "web_deep_read",
    "web_search",
    "zongyi_highlight",
  ],
  xiaozi: [
    "competitor_analysis",
    "fact_check",
    "knowledge_retrieval",
    "media_search",
    "news_aggregation",
    "sentiment_analysis",
    "web_search",
  ],
  xiaowen: [
    "aigc_script_push",
    "angle_design",
    "case_reference",
    "content_generate",
    "headline_generate",
    "knowledge_retrieval",
    "layout_design",
    "media_search",
    "podcast_script",
    "script_generate",
    "style_rewrite",
    "summary_generate",
    "tandian_script",
    "thumbnail_generate",
    "topic_extraction",
    "translation",
    "web_deep_read",
    "web_search",
    "zhongcao_script",
    "zongyi_highlight",
  ],
  xiaojian: [
    "aigc_script_push",
    "audio_plan",
    "layout_design",
    "media_search",
    "script_generate",
    "tandian_script",
    "thumbnail_generate",
    "video_edit_plan",
    "zhongcao_script",
    "zongyi_highlight",
  ],
  xiaoshen: [
    "cms_publish",
    "compliance_check",
    "duanju_script",
    "fact_check",
    "knowledge_retrieval",
    "podcast_script",
    "quality_review",
    "sentiment_analysis",
    "social_listening",
    "translation",
    "web_deep_read",
    "web_search",
  ],
  xiaofa: [
    "aigc_script_push",
    "audience_analysis",
    "cms_catalog_sync",
    "cms_publish",
    "publish_strategy",
    "style_rewrite",
    "translation",
  ],
  xiaoshu: [
    "audience_analysis",
    "case_reference",
    "competitor_analysis",
    "data_report",
    "heat_scoring",
    "news_aggregation",
    "publish_strategy",
    "sentiment_analysis",
    "social_listening",
    "topic_extraction",
  ],
  xiaoyan: [
    "data_pivoter",
    "news_aggregation",
    "report_drafter",
    "research_query_builder",
    "web_deep_read",
    "web_search",
  ],
};

// ---------------------------------------------------------------------------
// 四层重构 (2026-06):工种(craft)= 能力模板。员工 = 工种的配置实例。
// ---------------------------------------------------------------------------
// "工种"对标真实媒体岗位,是跨"中心/领域"复用的工种(craft);员工 = 工种 +
// 领域知识库 + 额外技能 + 层级(authority) + 平台规格 配出来的具体岗位实例。
// 载体:ai_employees.roleType 存工种 slug;CRAFT_META 约束取值 + 提供模板元数据。
// 物理岗(摄像/摄影/导播/灯光/音频)不进体系。

export type CraftType =
  | "director" // 编导/策划
  | "reporter" // 记者
  | "editor" // 编辑
  | "commentator" // 评论员
  | "post_production" // 后期剪辑
  | "reviewer" // 审核
  | "operator" // 新媒体运营
  | "anchor" // 播报主持
  | "analyst" // 数据分析
  | "producer"; // 制片人/总编(编排器)

export interface CraftMeta {
  id: CraftType;
  name: string; // 工种中文名
  description: string; // 一句话职责边界
  icon: LucideIcon;
  color: string;
  bgColor: string;
  /** 该工种默认权限档:决定能否定稿/发布(层级维度的默认值) */
  defaultAuthority: "observer" | "advisor" | "executor" | "coordinator";
  /** 默认产出形态 */
  defaultOutput: string;
}

export const CRAFT_META: Record<CraftType, CraftMeta> = {
  director: {
    id: "director",
    name: "编导/策划",
    description: "定选题角度与镜头叙事,不负责定稿发布",
    icon: Lightbulb,
    color: "#8b5cf6",
    bgColor: "rgba(139,92,246,0.12)",
    defaultAuthority: "advisor",
    defaultOutput: "选题方案 / 分镜脚本",
  },
  reporter: {
    id: "reporter",
    name: "记者",
    description: "采写一手稿件,提供事实素材,不拍板审核",
    icon: Newspaper,
    color: "#f59e0b",
    bgColor: "rgba(245,158,11,0.12)",
    defaultAuthority: "advisor",
    defaultOutput: "稿件正文",
  },
  editor: {
    id: "editor",
    name: "编辑",
    description: "加工润色定形,不做最终合规审核",
    icon: PenTool,
    color: "#3b82f6",
    bgColor: "rgba(59,130,246,0.12)",
    defaultAuthority: "advisor",
    defaultOutput: "成稿 / 标题 / 摘要",
  },
  commentator: {
    id: "commentator",
    name: "评论员",
    description: "输出观点与深度研判,不负责采集与发布",
    icon: MessageSquareQuote,
    color: "#4f46e5",
    bgColor: "rgba(79,70,229,0.12)",
    defaultAuthority: "advisor",
    defaultOutput: "评论 / 深度研报",
  },
  post_production: {
    id: "post_production",
    name: "后期剪辑",
    description: "视听成品化方案,不写文字内容",
    icon: Film,
    color: "#ef4444",
    bgColor: "rgba(239,68,68,0.12)",
    defaultAuthority: "advisor",
    defaultOutput: "剪辑/音频/封面/排版方案",
  },
  reviewer: {
    id: "reviewer",
    name: "审核",
    description: "把关事实质量合规,拥有驳回权",
    icon: ShieldCheck,
    color: "#6366f1",
    bgColor: "rgba(99,102,241,0.12)",
    defaultAuthority: "executor",
    defaultOutput: "审核结论(过/驳回)",
  },
  operator: {
    id: "operator",
    name: "新媒体运营",
    description: "平台适配与分发策略,发布动作受 authority 控",
    icon: Radio,
    color: "#14b8a6",
    bgColor: "rgba(20,184,166,0.12)",
    defaultAuthority: "advisor",
    defaultOutput: "多平台适配稿 / 分发方案",
  },
  anchor: {
    id: "anchor",
    name: "播报主持",
    description: "口语化播报脚本,不做文字深加工",
    icon: Mic,
    color: "#ec4899",
    bgColor: "rgba(236,72,153,0.12)",
    defaultAuthority: "advisor",
    defaultOutput: "播报 / 口播脚本",
  },
  analyst: {
    id: "analyst",
    name: "数据分析",
    description: "效果洞察与复盘,不参与内容生产",
    icon: BarChart3,
    color: "#f97316",
    bgColor: "rgba(249,115,22,0.12)",
    defaultAuthority: "advisor",
    defaultOutput: "数据报告 / 复盘",
  },
  producer: {
    id: "producer",
    name: "制片人/总编",
    description: "拆解任务按技能→工种派单并终审拍板",
    icon: Crown,
    color: "#e11d48",
    bgColor: "rgba(225,29,72,0.12)",
    defaultAuthority: "coordinator",
    defaultOutput: "任务编排 / 终审定稿",
  },
};

export const ORDERED_CRAFTS = [
  "director",
  "reporter",
  "editor",
  "commentator",
  "post_production",
  "reviewer",
  "operator",
  "anchor",
  "analyst",
  "producer",
] as const satisfies readonly CraftType[];

// 工种默认绑定的"核心技能"(core,不可解绑)。= tool-kinds.ts SKILL_OWNER 表的反查。
// migration-craft-001 据此为每 org 的工种默认实例写 employee_skills(bindingType='core')。
// 注:仅当该 skill slug 在 DB 中实际存在时才绑定,不存在的(如 channel_rewrite /
// cross_language_rewrite 视 seed 而定)由迁移脚本跳过并记日志。
export const CRAFT_CORE_SKILLS: Record<CraftType, string[]> = {
  director: ["angle_design", "script_generate", "duanju_script", "zongyi_highlight"],
  reporter: ["content_generate"],
  editor: ["headline_generate", "summary_generate", "style_rewrite", "cross_language_rewrite"],
  commentator: ["report_drafter"],
  post_production: ["video_edit_plan", "audio_plan", "thumbnail_generate", "layout_design"],
  reviewer: ["quality_review", "compliance_check", "fact_check"],
  operator: ["channel_rewrite", "tandian_script", "zhongcao_script", "aigc_script_push", "publish_strategy"],
  anchor: ["podcast_script"],
  analyst: ["data_report"],
  producer: ["task_planning"],
};

// 头像移植:旧员工被工种实例取代(已 hidden),但其精致 SVG 头像移植到对应工种,
// 让新团队继承熟悉的形象。EmployeeAvatar 据此把工种 slug 解析到旧头像;未列出的
// 工种(anchor)回退用 CRAFT_META 的图标。头像是代码级 SVG,与 DB 行存废无关。
export const CRAFT_AVATAR_SOURCE: Partial<Record<CraftType, EmployeeId>> = {
  director: "xiaoce", // 选题策划师(灯泡)
  reporter: "xiaolei", // 热点分析师(雷达)
  editor: "xiaowen", // 内容创作师(笔)
  // commentator / anchor 用专属新拟人头像(EMPLOYEE_AVATAR_MAP 里按工种 slug 注册),
  // 不映射到旧员工,故不在此列。
  post_production: "xiaojian", // 视频制片人(胶片)
  reviewer: "xiaoshen", // 质量审核官(放大镜)
  operator: "xiaofa", // 渠道运营师(信号)
  analyst: "xiaoshu", // 数据分析师(图表)
  producer: "leader", // 任务总监(皇冠)
};

// Read-only tool names for advisor authority level
// 学术研究员 xiaoyan 的三件套 skill 也归 read-only：它们只生成配置/草稿文本，
// 不改写外部数据；这样 advisor 过滤不会把它们的 placeholder 全剔掉，
// chat/stream:160-179 的 createXiaoyanChatTools 注入逻辑才能命中。
export const READ_ONLY_TOOL_NAMES = [
  "web_search", "web_deep_read", "trending_topics",
  "trend_monitor", "social_listening", "news_aggregation",
  "knowledge_retrieval", "media_search", "case_reference", "data_report",
  "sentiment_analysis", "topic_extraction", "competitor_analysis",
  "audience_analysis", "fact_check", "heat_scoring",
  "report_drafter", "research_query_builder", "data_pivoter",
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

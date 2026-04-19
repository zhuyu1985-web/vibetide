import {
  SCENARIO_CONFIG,
  ADVANCED_SCENARIO_CONFIG,
} from "@/lib/constants";
import type {
  BuiltinSeedInput,
  WorkflowTemplateCategory,
} from "@/lib/dal/workflow-templates";

/**
 * B.1 Unified Scenario Workflow — Task 10
 *
 * 把 legacy SCENARIO_CONFIG (10) + ADVANCED_SCENARIO_CONFIG (6) 映射为
 * `BuiltinSeedInput[]`，供 `seedBuiltinTemplatesForOrg()` 幂等 upsert。
 *
 * 约定：
 *  - `legacyScenarioKey` 永远填源 config 的 key（用于 `getWorkflowTemplateByLegacyKey`
 *    在 startMission 时反查 template.id）。
 *  - `category` 必须是 workflow_category enum 的 12 个值之一。
 *  - `icon` 提取 Lucide React component 的 displayName/name 字符串（UI 层解析）。
 *  - `appChannelSlug` 按 spec §2.2/§2.3 的业务意图映射到 Phase 1 九大 APP 栏目之一；
 *    null 表示该场景不绑定具体发布栏目（社交/全平台类）。
 */

// ─── SCENARIO_CONFIG (10) ───

/**
 * SCENARIO_CONFIG.category (news/deep/social/custom) → workflow_category enum。
 */
const SCENARIO_CATEGORY_MAP: Record<string, WorkflowTemplateCategory> = {
  news: "news",
  deep: "deep",
  social: "social",
  custom: "custom",
};

/**
 * SCENARIO_CONFIG key → Phase 1 APP 栏目 slug 建议映射（spec §2.2）。
 * null 表示该场景不绑定发布栏目（社交/全平台类）。
 */
const SCENARIO_APP_CHANNEL_MAP: Record<string, string | null> = {
  breaking_news: "app_news",
  flash_report: "app_news",
  press_conference: "app_news",
  deep_report: "app_news",
  series_content: "app_news",
  data_journalism: "app_news",
  social_media: null,
  video_content: "app_variety",
  multi_platform: null,
  custom: null,
};

/**
 * SCENARIO_CONFIG (10 项) → BuiltinSeedInput[]。
 * SCENARIO_CONFIG 不带 workflowSteps 字段，steps 留空（后续编辑 UI 可补）。
 */
function scenarioConfigToSeeds(): BuiltinSeedInput[] {
  const seeds: BuiltinSeedInput[] = [];
  for (const [key, cfg] of Object.entries(SCENARIO_CONFIG)) {
    seeds.push({
      name: cfg.label,
      description: cfg.description,
      category: SCENARIO_CATEGORY_MAP[cfg.category] ?? "custom",
      icon: extractIconName(cfg.icon),
      defaultTeam: [...cfg.defaultTeam],
      appChannelSlug: SCENARIO_APP_CHANNEL_MAP[key] ?? null,
      systemInstruction: cfg.templateInstruction || null,
      legacyScenarioKey: key,
      steps: [],
    });
  }
  return seeds;
}

// ─── ADVANCED_SCENARIO_CONFIG (6) ───

/**
 * ADVANCED_SCENARIO_CONFIG key → category 映射（spec §2.3）
 */
const ADVANCED_CATEGORY_MAP: Record<string, WorkflowTemplateCategory> = {
  lianghui_coverage: "advanced",
  marathon_live: "advanced",
  emergency_response: "advanced",
  theme_promotion: "advanced",
  livelihood_service: "livelihood",
  quick_publish: "advanced",
};

/**
 * ADVANCED_SCENARIO_CONFIG key → Phase 1 APP 栏目 slug 建议映射。
 * quick_publish 为动态路由（按优先级），此处不绑定 slug。
 */
const ADVANCED_APP_CHANNEL_MAP: Record<string, string | null> = {
  lianghui_coverage: "app_politics",
  marathon_live: "app_sports",
  emergency_response: "app_news",
  theme_promotion: "app_variety",
  livelihood_service: "app_livelihood_zhongcao",
  quick_publish: null,
};

/**
 * ADVANCED_SCENARIO_CONFIG (6 项) → BuiltinSeedInput[]。
 * 字段差异说明：
 *  - 没有 `name` 字段，用 `label` 作为显示名。
 *  - 团队成员字段是 `teamMembers`（而非 `defaultTeam`）。
 *  - 没有 `templateInstruction`，systemInstruction 置 null。
 *  - 保留 `inputFields` 和 `workflowSteps` 的原始 JSON。
 */
function advancedScenarioConfigToSeeds(): BuiltinSeedInput[] {
  const seeds: BuiltinSeedInput[] = [];
  for (const [key, cfg] of Object.entries(ADVANCED_SCENARIO_CONFIG)) {
    seeds.push({
      name: cfg.label,
      description: cfg.description,
      category: ADVANCED_CATEGORY_MAP[key] ?? "advanced",
      icon: extractIconName(cfg.icon),
      inputFields: cfg.inputFields ? [...cfg.inputFields] : [],
      defaultTeam: cfg.teamMembers ? [...cfg.teamMembers] : [],
      appChannelSlug: ADVANCED_APP_CHANNEL_MAP[key] ?? null,
      systemInstruction: null,
      legacyScenarioKey: key,
      steps: cfg.workflowSteps ? [...cfg.workflowSteps] : [],
    });
  }
  return seeds;
}

/**
 * 把 Lucide React component 或 string 提取成 icon name 字符串，供 UI 层 DynamicIcon 解析。
 */
function extractIconName(icon: unknown): string | null {
  if (!icon) return null;
  if (typeof icon === "string") return icon;
  if (typeof icon === "function") {
    const fn = icon as { displayName?: string; name?: string };
    return fn.displayName ?? fn.name ?? null;
  }
  // Some Lucide variants are objects with a render / displayName field
  if (typeof icon === "object") {
    const obj = icon as { displayName?: string; name?: string };
    return obj.displayName ?? obj.name ?? null;
  }
  return null;
}

// ─── xiaolei employee scenarios (5) ───

/**
 * xiaolei employee scenarios (5 项)。从 employee_scenarios 表迁移到 workflow_templates。
 * systemInstruction 源自 src/db/seed.ts 的 xiaoleiScenarios 数组（迁移时完整保留原中文指令）。
 * B.1 完成后 employee_scenarios seed 停写，表保留但空（B.2 DROP）。
 */
const XIAOLEI_SCENARIOS: Array<{
  name: string;
  description: string;
  icon: string;
  systemInstruction: string;
  inputFields: unknown[];
}> = [
  {
    name: "全网热点扫描",
    description: "扫描各平台热点话题，生成热点速报",
    icon: "Radar",
    systemInstruction:
      "请对{{domain}}领域进行全网热点扫描，覆盖微博、百度、头条、抖音、知乎等主流平台。输出格式：按热度排序的 Top 10 热点列表，每个热点包含标题、热度值、来源平台、上升趋势、建议追踪角度。最后给出整体热点态势总结。",
    inputFields: [
      {
        name: "domain",
        label: "关注领域",
        type: "select",
        required: true,
        placeholder: "选择领域",
        options: [
          "全部",
          "科技",
          "财经",
          "娱乐",
          "体育",
          "社会",
          "教育",
          "汽车",
          "健康",
        ],
      },
    ],
  },
  {
    name: "话题深度追踪",
    description: "深入分析特定话题的发展脉络",
    icon: "Search",
    systemInstruction:
      "请对话题「{{topic}}」进行深度追踪分析。包含：1) 话题起源和发展时间线 2) 各平台传播路径 3) 关键节点和转折 4) 舆论情绪变化 5) 相关利益方观点汇总 6) 预测后续发展趋势 7) 建议的内容切入角度。",
    inputFields: [
      {
        name: "topic",
        label: "追踪话题",
        type: "text",
        required: true,
        placeholder: "输入要追踪的话题关键词",
      },
    ],
  },
  {
    name: "平台热榜查看",
    description: "查看指定平台的实时热榜",
    icon: "BarChart3",
    systemInstruction:
      "请查看{{platform}}平台的实时热榜数据，列出当前 Top 20 热门话题，每个话题标注热度指数、上榜时长、趋势（上升/下降/平稳）。对排名前 5 的话题给出简要分析和内容制作建议。",
    inputFields: [
      {
        name: "platform",
        label: "目标平台",
        type: "select",
        required: true,
        placeholder: "选择平台",
        options: [
          "微博",
          "百度",
          "头条",
          "抖音",
          "知乎",
          "B站",
          "微信",
        ],
      },
    ],
  },
  {
    name: "热点分析报告",
    description: "生成深度热点分析报告",
    icon: "FileText",
    systemInstruction:
      "请针对话题「{{topic}}」生成一份{{depth}}的热点分析报告。报告结构：1) 热点概述 2) 数据分析（热度趋势、平台分布、用户画像） 3) 舆情分析（正面/负面/中性占比、典型观点） 4) 竞品响应（主流媒体的报道角度） 5) 内容机会（建议的选题角度、体裁、发布时机） 6) 风险提示（敏感点、合规注意事项）",
    inputFields: [
      {
        name: "topic",
        label: "分析话题",
        type: "text",
        required: true,
        placeholder: "输入要分析的话题",
      },
      {
        name: "depth",
        label: "报告深度",
        type: "select",
        required: true,
        placeholder: "选择深度",
        options: ["快速摘要", "标准报告", "深度研报"],
      },
    ],
  },
  {
    name: "关键词热度监测",
    description: "监测关键词在各平台的热度变化",
    icon: "Activity",
    systemInstruction:
      "请监测关键词「{{keyword}}」在{{timeRange}}内的热度变化情况。输出：1) 各平台当前热度指数 2) 热度趋势变化曲线描述 3) 关联热词和话题 4) 主要讨论内容摘要 5) 情感倾向分析 6) 是否建议跟进及原因。",
    inputFields: [
      {
        name: "keyword",
        label: "监测关键词",
        type: "text",
        required: true,
        placeholder: "输入关键词",
      },
      {
        name: "timeRange",
        label: "时间范围",
        type: "select",
        required: true,
        placeholder: "选择时间范围",
        options: ["最近1小时", "最近24小时", "最近7天", "最近30天"],
      },
    ],
  },
];

/**
 * 为 xiaolei scenario legacyScenarioKey 生成稳定 slug。
 * 中文 name → base36 字符 code sum，保证幂等 seed（同一 name 永远生成同一 key）。
 * 仅内部使用，避免 legacyScenarioKey 冲突，便于 getWorkflowTemplateByLegacyKey 反查。
 */
function slugifyXiaoleiName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function xiaoleiScenariosToSeeds(): BuiltinSeedInput[] {
  return XIAOLEI_SCENARIOS.map((s) => ({
    name: s.name,
    description: s.description,
    category: "news" as const,
    icon: s.icon,
    inputFields: s.inputFields,
    defaultTeam: ["xiaolei"],
    systemInstruction: s.systemInstruction,
    legacyScenarioKey: `employee_scenario_xiaolei_${slugifyXiaoleiName(s.name)}`,
    steps: [],
  }));
}

// ─── Demo Daily Scenarios (2026-04-19，为 E2E 演示补齐) ───────────────
// 参考原 spec `2026-04-18-newsclaw-cms-aigc-scenario-design.md` §x dailyPlans。
// 这 10 条是用户核心演示场景：新闻热点 / 精品 / 本地 / 全国 / 种草 /
// 播客 / 探店 / 川超 / 每日 AI 资讯 / 科技周报。

type StepDef = {
  id: string;
  order: number;
  dependsOn: string[];
  name: string;
  type: "skill";
  config: {
    skillSlug: string;
    skillName: string;
    skillCategory: string;
    parameters: Record<string, unknown>;
  };
  key: string;
  label: string;
};

function step(
  order: number,
  name: string,
  skillSlug: string,
  skillName: string,
  skillCategory: string,
  key: string,
): StepDef {
  return {
    id: `step-${order}`,
    order,
    dependsOn: order > 1 ? [`step-${order - 1}`] : [],
    name,
    type: "skill" as const,
    config: { skillSlug, skillName, skillCategory, parameters: {} },
    key,
    label: name,
  };
}

const DEMO_DAILY_SCENARIOS: BuiltinSeedInput[] = [
  {
    name: "每日 AI 资讯",
    description: "每天聚合全网 AI / 大模型领域最新资讯，生成每日 AI 简报图文稿，发布到新闻 APP。",
    category: "daily_brief" as const,
    icon: "Brain",
    defaultTeam: ["xiaolei", "xiaowen", "xiaofa"],
    appChannelSlug: "app_news",
    systemInstruction:
      "围绕 AI / 大模型领域，聚合今日全网热点，生成一份每日 AI 资讯简报。结构：1) 今日头条 AI 事件（3-5 条）2) 技术突破 3) 商业动态 4) 监管政策 5) 行业观察。字数 1200-2000。风格：专业快讯，面向技术关注者。",
    inputFields: [
      { name: "topicTag", label: "话题标签", type: "text" as const, required: false, placeholder: "AI" },
      { name: "targetWordCount", label: "目标字数", type: "number" as const, required: false, placeholder: "1500" },
    ],
    legacyScenarioKey: "daily_ai_brief",
    steps: [
      step(1, "全网 AI 资讯聚合", "news_aggregation", "新闻聚合", "perception", "aggregate"),
      step(2, "热点价值评估", "topic_extraction", "选题提取", "analysis", "evaluate"),
      step(3, "AI 简报生成", "content_generate", "内容生成", "generation", "generate"),
      step(4, "质量审核", "quality_review", "质量审核", "management", "review"),
      step(5, "发布到新闻 APP", "publish_strategy", "发布策略", "management", "publish"),
    ],
  },
  {
    name: "科技周报",
    description: "每周深度整理科技行业重点事件，生成 3000+ 字深度解读周报，发布到新闻 APP。",
    category: "deep" as const,
    icon: "Newspaper",
    defaultTeam: ["xiaolei", "xiaoce", "xiaowen", "xiaoshen", "xiaofa"],
    appChannelSlug: "app_news",
    systemInstruction:
      "过去 7 天科技行业重点事件深度解读。结构：1) 本周十大事件排名 2) 重点事件深度分析 (3-5 篇) 3) 数据洞察 4) 下周预告。每事件 500+ 字，总篇幅 3000-5000 字。风格：专业深度，有观点。",
    inputFields: [
      { name: "weekRange", label: "本周时间范围", type: "text" as const, required: false, placeholder: "2026-04-14 至 2026-04-20" },
      { name: "focusSectors", label: "重点细分领域", type: "text" as const, required: false, placeholder: "AI, 新能源, 芯片" },
    ],
    legacyScenarioKey: "weekly_tech_report",
    steps: [
      step(1, "全周科技事件抓取", "news_aggregation", "新闻聚合", "perception", "crawl"),
      step(2, "事件筛选与排名", "topic_extraction", "选题提取", "analysis", "rank"),
      step(3, "数据洞察分析", "data_report", "数据报告", "analysis", "analyze"),
      step(4, "深度周报撰写", "content_generate", "内容生成", "generation", "write"),
      step(5, "质量与合规审核", "quality_review", "质量审核", "management", "review"),
      step(6, "发布到新闻 APP", "publish_strategy", "发布策略", "management", "publish"),
    ],
  },
  {
    name: "每日时政热点",
    description: "每天聚合时政领域重要动态，严档审核后生成时政图文稿，发布到时政 APP。",
    category: "news" as const,
    icon: "Landmark",
    defaultTeam: ["xiaolei", "xiaowen", "xiaoshen", "xiaofa"],
    appChannelSlug: "app_politics",
    systemInstruction:
      "聚合今日时政重要动态。结构：1) 今日时政要闻（3-5 条）2) 政策解读 3) 官方表态。字数 800-1500。**严档审核**：政治站位、敏感词、未授权信息一律拒。风格：严谨、客观、权威。",
    inputFields: [
      { name: "focusRegion", label: "重点地域", type: "select" as const, required: false, placeholder: "全国", options: ["全国", "深圳", "广东", "北京"] },
    ],
    legacyScenarioKey: "daily_politics",
    steps: [
      step(1, "官方信源采集", "news_aggregation", "新闻聚合", "perception", "collect"),
      step(2, "要闻筛选", "topic_extraction", "选题提取", "analysis", "filter"),
      step(3, "合规前置扫描", "compliance_check", "合规审核", "management", "compliance"),
      step(4, "时政稿件撰写", "content_generate", "内容生成", "generation", "write"),
      step(5, "严档质量审核", "quality_review", "质量审核", "management", "review"),
      step(6, "发布到时政 APP", "publish_strategy", "发布策略", "management", "publish"),
    ],
  },
  {
    name: "每日热点播客",
    description: "每日把今日全网热点整理成播客脚本（音频稿），推送到 AIGC 渲染后发布到播客 APP。",
    category: "podcast" as const,
    icon: "Mic",
    defaultTeam: ["xiaoce", "xiaowen", "xiaofa", "xiaojian"],
    appChannelSlug: "app_livelihood_podcast",
    systemInstruction:
      "把今日 5-7 条全网热点整理成 8-12 分钟的对话体播客脚本。结构：1) 开场白 30s 2) 热点逐条点评（每条 1-2 分钟）3) 结尾互动 30s。双主持对话，自然、有网感、口语化。",
    inputFields: [
      { name: "format", label: "播客格式", type: "select" as const, required: false, placeholder: "daily_brief", options: ["daily_brief", "deep_dive", "weekend_chat"] },
      { name: "targetMinutes", label: "目标时长（分钟）", type: "number" as const, required: false, placeholder: "10" },
    ],
    legacyScenarioKey: "daily_podcast",
    steps: [
      step(1, "今日热点聚合", "news_aggregation", "新闻聚合", "perception", "aggregate"),
      step(2, "热点筛选", "topic_extraction", "选题提取", "analysis", "filter"),
      step(3, "播客脚本生成", "podcast_script", "播客脚本", "generation", "script"),
      step(4, "TTS 合成（AIGC）", "audio_plan", "音频规划", "production", "tts"),
      step(5, "质量审核", "quality_review", "质量审核", "management", "review"),
      step(6, "发布到播客 APP", "publish_strategy", "发布策略", "management", "publish"),
    ],
  },
  {
    name: "每日探店",
    description: "每天从本地热门探店话题中选出 1 个生成探店脚本，推送到 AIGC 生成视频后发布到民生-探店 APP。",
    category: "livelihood" as const,
    icon: "UtensilsCrossed",
    defaultTeam: ["xiaoce", "xiaowen", "xiaojian", "xiaofa"],
    appChannelSlug: "app_livelihood_tandian",
    systemInstruction:
      "生成一份探店脚本。6 阶段流程：店门外 → 环境氛围 → 招牌菜品 → 试吃反应 → 人均消费 → 结尾推荐。每段配镜头/贴字/配音建议。字数 600-900。风格：真实、有人情味、有画面感。**合规**：广告法禁极限词；合作类内容必须声明。",
    inputFields: [
      { name: "city", label: "城市", type: "select" as const, required: true, placeholder: "成都", options: ["成都", "深圳", "重庆", "上海", "北京"] },
      { name: "category", label: "店型", type: "select" as const, required: false, placeholder: "餐饮", options: ["餐饮", "茶饮", "烘焙", "甜品", "夜市"] },
    ],
    legacyScenarioKey: "daily_tandian",
    steps: [
      step(1, "本地探店话题聚合", "trending_topics", "热榜聚合", "perception", "aggregate"),
      step(2, "热门店铺筛选", "topic_extraction", "选题提取", "analysis", "filter"),
      step(3, "探店脚本生成", "tandian_script", "探店脚本", "generation", "script"),
      step(4, "合规扫描", "compliance_check", "合规审核", "management", "compliance"),
      step(5, "AIGC 视频生成", "video_edit_plan", "视频剪辑方案", "production", "render"),
      step(6, "发布到探店 APP", "publish_strategy", "发布策略", "management", "publish"),
    ],
  },
  {
    name: "每日川超战报",
    description: "每天 22:30 赛后聚合当日川超联赛数据，生成战报并发布到体育 APP。",
    category: "news" as const,
    icon: "Trophy",
    defaultTeam: ["xiaolei", "xiaowen", "xiaoshu", "xiaofa"],
    appChannelSlug: "app_sports",
    systemInstruction:
      "赛后生成当日川超战报。结构：1) 比赛结果速报 2) 核心数据（射门/控球/关键球员）3) 精彩瞬间回顾 4) 赛后点评。字数 800-1200。风格：激情专业，数据说话。",
    inputFields: [
      { name: "matchDate", label: "比赛日期", type: "text" as const, required: false, placeholder: "2026-04-19" },
    ],
    legacyScenarioKey: "daily_sports_report",
    steps: [
      step(1, "赛事数据采集", "news_aggregation", "新闻聚合", "perception", "collect"),
      step(2, "关键数据提取", "data_report", "数据报告", "analysis", "analyze"),
      step(3, "战报生成", "content_generate", "内容生成", "generation", "write"),
      step(4, "质量审核", "quality_review", "质量审核", "management", "review"),
      step(5, "发布到体育 APP", "publish_strategy", "发布策略", "management", "publish"),
    ],
  },
  {
    name: "种草日更",
    description: "每天从全网热门商品/趋势中提取素材生成种草文案，推送到民生-种草 APP。",
    category: "livelihood" as const,
    icon: "Heart",
    defaultTeam: ["xiaoce", "xiaowen", "xiaofa", "xiaoshu"],
    appChannelSlug: "app_livelihood_zhongcao",
    systemInstruction:
      "每日生成 1 篇种草文案，平台差异化（小红书 / 抖音 / B 站 / 视频号）。结构：钩子 → 痛点 → 解决方案（产品）→ 细节展示 → CTA。字数按平台 400-1200 浮动。**合规**：广告法极限词严禁；合作披露按《互联网广告管理办法》执行。",
    inputFields: [
      { name: "platform", label: "目标平台", type: "select" as const, required: true, placeholder: "xiaohongshu", options: ["xiaohongshu", "douyin", "bilibili", "video_channel"] },
      { name: "productCategory", label: "品类", type: "select" as const, required: false, placeholder: "美妆", options: ["美妆", "数码", "家居", "食品", "穿搭", "母婴"] },
    ],
    legacyScenarioKey: "daily_zhongcao",
    steps: [
      step(1, "热门商品/趋势聚合", "trending_topics", "热榜聚合", "perception", "aggregate"),
      step(2, "品类筛选", "topic_extraction", "选题提取", "analysis", "filter"),
      step(3, "种草脚本生成", "zhongcao_script", "种草脚本", "generation", "script"),
      step(4, "广告法合规扫描", "compliance_check", "合规审核", "management", "compliance"),
      step(5, "发布到种草 APP", "publish_strategy", "发布策略", "management", "publish"),
    ],
  },
  {
    name: "精品内容",
    description: "精心策划的高质量深度稿件：长文深度 + 多维度调研 + 数据图表，发布到新闻 APP 头条。",
    category: "deep" as const,
    icon: "Gem",
    defaultTeam: ["xiaolei", "xiaoce", "xiaozi", "xiaowen", "xiaoshen", "xiaofa"],
    appChannelSlug: "app_news",
    systemInstruction:
      "围绕用户指定的精品主题，生成 3000+ 字的深度稿件。结构：1) 悬念开头 2) 事件全景回顾 3) 多方观点（至少 3 方）4) 数据支撑 5) 深度洞察与展望。配 3-5 张图表。风格：高质量长文，有思辨深度。",
    inputFields: [
      { name: "topic", label: "精品选题", type: "text" as const, required: true, placeholder: "深圳 AI 产业新政 200 亿解读" },
      { name: "angles", label: "分析角度", type: "text" as const, required: false, placeholder: "政策/市场/从业者三视角" },
      { name: "targetWordCount", label: "目标字数", type: "number" as const, required: false, placeholder: "3500" },
    ],
    legacyScenarioKey: "premium_content",
    steps: [
      step(1, "多维度背景调研", "news_aggregation", "新闻聚合", "perception", "research"),
      step(2, "核心观点萃取", "topic_extraction", "选题提取", "analysis", "extract"),
      step(3, "数据支撑分析", "data_report", "数据报告", "analysis", "analyze"),
      step(4, "多角度深度撰写", "content_generate", "内容生成", "generation", "write"),
      step(5, "事实核查", "fact_check", "事实核查", "management", "fact_check"),
      step(6, "高级质量审核", "quality_review", "质量审核", "management", "review"),
      step(7, "发布到头条", "publish_strategy", "发布策略", "management", "publish"),
    ],
  },
  {
    name: "本地新闻",
    description: "每日聚合本地（城市/区）新闻要闻，生成本地新闻图文稿，发布到新闻 APP 本地频道。",
    category: "news" as const,
    icon: "MapPin",
    defaultTeam: ["xiaolei", "xiaowen", "xiaofa"],
    appChannelSlug: "app_news",
    systemInstruction:
      "聚合指定城市/区域的今日要闻。结构：1) 城市要闻 3-5 条 2) 民生动态 3) 政府公告 4) 本地活动预告。字数 800-1500。风格：贴近本地、实用导向。",
    inputFields: [
      { name: "city", label: "城市", type: "select" as const, required: true, placeholder: "深圳", options: ["深圳", "广州", "北京", "上海", "成都", "杭州"] },
      { name: "district", label: "区（可选）", type: "text" as const, required: false, placeholder: "南山区" },
    ],
    legacyScenarioKey: "local_news",
    steps: [
      step(1, "本地信源聚合", "news_aggregation", "新闻聚合", "perception", "aggregate"),
      step(2, "本地要闻筛选", "topic_extraction", "选题提取", "analysis", "filter"),
      step(3, "本地新闻撰写", "content_generate", "内容生成", "generation", "write"),
      step(4, "质量审核", "quality_review", "质量审核", "management", "review"),
      step(5, "发布到本地频道", "publish_strategy", "发布策略", "management", "publish"),
    ],
  },
  {
    name: "全国热点图文",
    description: "每日聚合全国性热点话题，生成全国热点图文稿，发布到首页 APP 头条位。",
    category: "daily_brief" as const,
    icon: "Flame",
    defaultTeam: ["xiaolei", "xiaowen", "xiaofa", "xiaoce"],
    appChannelSlug: "app_home",
    systemInstruction:
      "聚合今日全国性热点。结构：1) 今日头条（1 条最大）2) 十大热点排名（带一句摘要）3) 聚焦深度解读 1-2 条。字数 1500-2500。风格：权威聚合、高质量摘要。",
    inputFields: [
      { name: "topNCount", label: "Top N", type: "number" as const, required: false, placeholder: "10" },
    ],
    legacyScenarioKey: "national_daily_brief",
    steps: [
      step(1, "全网热榜聚合", "trending_topics", "热榜聚合", "perception", "aggregate"),
      step(2, "热点排名与筛选", "topic_extraction", "选题提取", "analysis", "rank"),
      step(3, "聚合图文生成", "content_generate", "内容生成", "generation", "write"),
      step(4, "质量审核", "quality_review", "质量审核", "management", "review"),
      step(5, "发布到首页头条", "publish_strategy", "发布策略", "management", "publish"),
    ],
  },
];

function demoDailyScenariosToSeeds(): BuiltinSeedInput[] {
  return DEMO_DAILY_SCENARIOS;
}

// ─── 员工专属日常工作流（2026-04-20，8 位默认数字员工各一个代表性场景）──
// 对应 EMPLOYEE_META 8 位员工的核心能力：
//   xiaolei 热点分析师 / xiaoce 选题策划师 / xiaozi 素材研究员 /
//   xiaowen 内容创作师 / xiaojian 视频制片人 / xiaoshen 质量审核官 /
//   xiaofa 渠道运营师 / xiaoshu 数据分析师
// 每个 workflow 第一个 defaultTeam 就是该员工本人，用作员工详情页"我的专属场景"。

const EMPLOYEE_DAILY_SCENARIOS: BuiltinSeedInput[] = [
  {
    name: "热点分析师·每日全网热点",
    description: "xiaolei 的日常工作流：全网热点监控 → 深度趋势分析 → 输出每日热点洞察简报。",
    category: "news" as const,
    icon: "Radar",
    defaultTeam: ["xiaolei"],
    appChannelSlug: "app_news",
    systemInstruction:
      "以热点分析师身份产出每日热点洞察。结构：1) 今日 Top 10 热点榜（含热度/趋势）2) 3 条值得追踪的深度选题 3) 舆情风向 4) 建议跟进动作。字数 800-1500。",
    inputFields: [
      { name: "domain", label: "关注领域", type: "select" as const, required: false, placeholder: "全部", options: ["全部", "科技", "财经", "文娱", "体育", "民生"] },
    ],
    legacyScenarioKey: "employee_daily_xiaolei",
    steps: [
      step(1, "全网热点采集", "news_aggregation", "新闻聚合", "perception", "aggregate"),
      step(2, "热度趋势分析", "trend_monitor", "趋势监控", "perception", "trend"),
      step(3, "深度洞察提取", "topic_extraction", "选题提取", "analysis", "insight"),
      step(4, "热点简报生成", "content_generate", "内容生成", "generation", "write"),
    ],
  },
  {
    name: "选题策划师·每日选题会",
    description: "xiaoce 的日常工作流：挖掘用户需求 → 多角度选题策划 → 输出可落地选题清单。",
    category: "deep" as const,
    icon: "Lightbulb",
    defaultTeam: ["xiaoce", "xiaolei"],
    appChannelSlug: "app_news",
    systemInstruction:
      "以选题策划师身份产出每日选题会内容。结构：1) 3-5 个核心候选选题（含背景/价值/受众）2) 每个选题的 3 个差异化角度 3) 推荐形态（图文/视频/播客）4) 预估完成周期。",
    inputFields: [
      { name: "focusArea", label: "聚焦领域", type: "text" as const, required: false, placeholder: "可留空，自动从热点推导" },
      { name: "targetCount", label: "期望选题数", type: "number" as const, required: false, placeholder: "5" },
    ],
    legacyScenarioKey: "employee_daily_xiaoce",
    steps: [
      step(1, "热点背景调研", "news_aggregation", "新闻聚合", "perception", "research"),
      step(2, "用户需求洞察", "audience_analysis", "受众分析", "analysis", "audience"),
      step(3, "多角度选题生成", "topic_extraction", "选题提取", "analysis", "extract"),
      step(4, "选题价值评估", "heat_scoring", "热度评分", "analysis", "score"),
      step(5, "选题清单输出", "content_generate", "内容生成", "generation", "write"),
    ],
  },
  {
    name: "素材研究员·素材库归集",
    description: "xiaozi 的日常工作流：指定主题 → 多源素材搜索 → 整合打标入库构建可检索媒资。",
    category: "analytics" as const,
    icon: "Library",
    defaultTeam: ["xiaozi"],
    appChannelSlug: null,
    systemInstruction:
      "以素材研究员身份为指定主题归集素材库。输出：1) 素材清单（文/图/视/音 分类）2) 每条素材的来源/时效/版权状态 3) 相关性评分 4) 建议用法。字段结构化便于检索。",
    inputFields: [
      { name: "topic", label: "主题关键词", type: "text" as const, required: true, placeholder: "深圳 AI 产业新政" },
      { name: "sourceScope", label: "素材范围", type: "select" as const, required: false, placeholder: "全网", options: ["全网", "官方", "国内媒体", "海外媒体", "社交平台"] },
    ],
    legacyScenarioKey: "employee_daily_xiaozi",
    steps: [
      step(1, "主题背景分析", "topic_extraction", "选题提取", "analysis", "parse"),
      step(2, "多源素材搜索", "web_search", "全网搜索", "perception", "search"),
      step(3, "网页深度抓取", "web_deep_read", "网页深读", "perception", "crawl"),
      step(4, "素材打标入库", "media_search", "媒资搜索", "knowledge", "tag"),
    ],
  },
  {
    name: "内容创作师·多版本内容",
    description: "xiaowen 的日常工作流：主题 → 多风格标题/正文/摘要 → A/B 备选方案。",
    category: "news" as const,
    icon: "PenLine",
    defaultTeam: ["xiaowen"],
    appChannelSlug: "app_news",
    systemInstruction:
      "以内容创作师身份产出多版本稿件。结构：1) 3 个标题（专业/网感/悬念）2) 完整正文（1 个主版本 + 2 个风格变体）3) 分享摘要（≤80 字）4) 社交媒体版（≤ 200 字）。",
    inputFields: [
      { name: "topic", label: "创作主题", type: "text" as const, required: true, placeholder: "主题或选题 ID" },
      { name: "style", label: "主风格", type: "select" as const, required: false, placeholder: "news_standard", options: ["news_standard", "deep_analysis", "casual", "zhongcao"] },
      { name: "targetWordCount", label: "目标字数", type: "number" as const, required: false, placeholder: "1500" },
    ],
    legacyScenarioKey: "employee_daily_xiaowen",
    steps: [
      step(1, "主题素材梳理", "topic_extraction", "选题提取", "analysis", "parse"),
      step(2, "多风格标题生成", "headline_generate", "标题生成", "generation", "headline"),
      step(3, "主版本正文撰写", "content_generate", "内容生成", "generation", "body"),
      step(4, "风格变体生成", "style_rewrite", "风格改写", "generation", "variants"),
      step(5, "摘要与分享版", "summary_generate", "摘要生成", "generation", "summary"),
    ],
  },
  {
    name: "视频制片人·视频制作方案",
    description: "xiaojian 的日常工作流：脚本 → 分镜方案 + 封面 + 音频 + 剪辑指导一体化。",
    category: "video" as const,
    icon: "Clapperboard",
    defaultTeam: ["xiaojian", "xiaowen"],
    appChannelSlug: "app_variety",
    systemInstruction:
      "以视频制片人身份为指定脚本产出制作方案。结构：1) 完整分镜表（镜头号/时长/内容/贴字/配音/音效）2) 封面设计思路（3 版）3) 音频方案（BGM+配音风格）4) 剪辑节奏建议。",
    inputFields: [
      { name: "script", label: "脚本 / 主题", type: "textarea" as const, required: true, placeholder: "粘贴脚本或输入视频主题" },
      { name: "duration", label: "目标时长", type: "select" as const, required: false, placeholder: "90s", options: ["30s", "60s", "90s", "3min", "5min"] },
    ],
    legacyScenarioKey: "employee_daily_xiaojian",
    steps: [
      step(1, "脚本结构分析", "topic_extraction", "选题提取", "analysis", "parse"),
      step(2, "分镜方案设计", "video_edit_plan", "视频剪辑方案", "production", "shotlist"),
      step(3, "封面设计", "layout_design", "版式设计", "production", "cover"),
      step(4, "音频配乐规划", "audio_plan", "音频规划", "production", "audio"),
      step(5, "缩略图生成", "thumbnail_generate", "封面生成", "generation", "thumbnail"),
    ],
  },
  {
    name: "质量审核官·事实质量审核",
    description: "xiaoshen 的日常工作流：稿件 → 事实核查 + 合规扫描 + 质量评分 + 修改建议。",
    category: "custom" as const,
    icon: "ShieldCheck",
    defaultTeam: ["xiaoshen"],
    appChannelSlug: null,
    systemInstruction:
      "以质量审核官身份对稿件做全面审核。输出：1) 事实核查结果（真伪/出处）2) 合规扫描（政治/广告法/法律/伦理）3) 质量评分（结构/文字/深度/可读性 4 维 0-100）4) 具体修改建议。",
    inputFields: [
      { name: "articleText", label: "待审稿件", type: "textarea" as const, required: true, placeholder: "粘贴稿件内容" },
      { name: "reviewTier", label: "审核档位", type: "select" as const, required: false, placeholder: "standard", options: ["relaxed", "standard", "strict"] },
    ],
    legacyScenarioKey: "employee_daily_xiaoshen",
    steps: [
      step(1, "事实核查", "fact_check", "事实核查", "management", "fact"),
      step(2, "合规扫描", "compliance_check", "合规审核", "management", "compliance"),
      step(3, "情感立场分析", "sentiment_analysis", "情感分析", "analysis", "sentiment"),
      step(4, "质量综合评分", "quality_review", "质量审核", "management", "score"),
    ],
  },
  {
    name: "渠道运营师·多渠道分发策略",
    description: "xiaofa 的日常工作流：稿件 → 平台适配改写 + 发布时机 + 渠道路由。",
    category: "distribution" as const,
    icon: "Send",
    defaultTeam: ["xiaofa", "xiaowen"],
    appChannelSlug: null,
    systemInstruction:
      "以渠道运营师身份制定多渠道分发策略。输出：1) 各平台适配版（微博/微信/抖音/小红书/视频号/APP）2) 最佳发布时机表 3) 标签/话题/@建议 4) 预期效果预估。",
    inputFields: [
      { name: "articleId", label: "稿件 ID", type: "text" as const, required: false, placeholder: "可留空，从上下文读取" },
      { name: "targetPlatforms", label: "目标平台", type: "text" as const, required: false, placeholder: "weibo, wechat, douyin" },
    ],
    legacyScenarioKey: "employee_daily_xiaofa",
    steps: [
      step(1, "平台特性分析", "audience_analysis", "受众分析", "analysis", "audience"),
      step(2, "多平台适配", "style_rewrite", "风格改写", "generation", "adapt"),
      step(3, "时机与触达策略", "publish_strategy", "发布策略", "management", "strategy"),
      step(4, "渠道路由编排", "publish_strategy", "发布策略", "management", "route"),
    ],
  },
  {
    name: "数据分析师·数据复盘报告",
    description: "xiaoshu 的日常工作流：稿件/项目 → 数据洞察 + 效果追踪 + 下一步建议。",
    category: "analytics" as const,
    icon: "ChartColumn",
    defaultTeam: ["xiaoshu"],
    appChannelSlug: "app_home",
    systemInstruction:
      "以数据分析师身份产出复盘报告。结构：1) 核心指标摘要（阅读/互动/转化）2) 趋势分析（日/周/月）3) 渠道对比 4) 用户画像 5) 优化建议。用图表描述（文本形式）。",
    inputFields: [
      { name: "targetType", label: "复盘对象", type: "select" as const, required: true, placeholder: "article", options: ["article", "mission", "daily_brief", "weekly"] },
      { name: "targetId", label: "对象 ID（可选）", type: "text" as const, required: false },
    ],
    legacyScenarioKey: "employee_daily_xiaoshu",
    steps: [
      step(1, "数据拉取", "data_report", "数据报告", "analysis", "fetch"),
      step(2, "趋势对比分析", "data_report", "数据报告", "analysis", "trend"),
      step(3, "受众画像分析", "audience_analysis", "受众分析", "analysis", "audience"),
      step(4, "复盘报告撰写", "content_generate", "内容生成", "generation", "write"),
    ],
  },
];

function employeeDailyScenariosToSeeds(): BuiltinSeedInput[] {
  return EMPLOYEE_DAILY_SCENARIOS;
}

/**
 * 汇总 builtin seeds：
 *   SCENARIO_CONFIG (10) + ADVANCED_SCENARIO_CONFIG (6) + xiaoleiScenarios (5)
 *   + DEMO_DAILY_SCENARIOS (10, 2026-04-19)
 *   + EMPLOYEE_DAILY_SCENARIOS (8, 2026-04-20 每位员工一个专属场景)
 *   = 39 条。
 */
export function buildBuiltinScenarioSeeds(): BuiltinSeedInput[] {
  return [
    ...scenarioConfigToSeeds(),
    ...advancedScenarioConfigToSeeds(),
    ...xiaoleiScenariosToSeeds(),
    ...demoDailyScenariosToSeeds(),
    ...employeeDailyScenariosToSeeds(),
  ];
}

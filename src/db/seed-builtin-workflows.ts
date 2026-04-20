/**
 * Builtin Workflow Seeds — Phase 1 Chunk A (2026-04-20 realignment)
 *
 * 新架构预设场景数据源（替代 SCENARIO_CONFIG + ADVANCED_SCENARIO_CONFIG + XIAOLEI_SCENARIOS
 * + DEMO_DAILY_SCENARIOS + EMPLOYEE_DAILY_SCENARIOS）。
 *
 * 本 Chunk A 交付：脚手架 + 9 条主流水线员工预设（xiaolei / xiaoce / xiaozi 各 3）
 * Chunk B 将补：xiaowen 2 / xiaojian 3 / xiaoshen 2 / xiaofa 2 / xiaoshu 3 = 12 条
 * Chunk C 将补：5 条公共场景 + seedBuiltinTemplatesForOrg 写入新 4 列 + 验证
 *
 * 新字段（相对 BuiltinSeedInput）：
 *  - ownerEmployeeId：员工专属场景的归属，公共场景为 null
 *  - launchMode："form" 需表单输入；"direct" 一键启动
 *  - promptTemplate：Mustache 风格 prompt 模板
 *
 * 向后兼容：保留 `buildBuiltinScenarioSeeds()` export，返回 BuiltinSeedInput[]。
 * Chunk C 会在 `seedBuiltinTemplatesForOrg` 内读取新列并替换调用路径。
 */

import type { EmployeeId } from "@/lib/constants";
import type { WorkflowStepDef } from "@/db/schema/workflows";
import type { InputFieldDef } from "@/lib/types";
import type {
  BuiltinSeedInput,
  WorkflowTemplateCategory,
} from "@/lib/dal/workflow-templates";

// ─── Types ────────────────────────────────────────────────────────────────

export interface BuiltinWorkflowSeed {
  /** legacy_scenario_key —— 全局唯一，用于 startMission 反查 template.id */
  slug: string;
  name: string;
  description: string;
  /** lucide 图标名，UI 层通过 DynamicIcon 解析 */
  icon: string;
  category: WorkflowTemplateCategory;
  /** 员工专属场景归属；null = 公共场景 */
  ownerEmployeeId: EmployeeId | null;
  /** 默认团队（第一个一般是 owner / 主执行员工） */
  defaultTeam: EmployeeId[];
  /** Phase 1 九大 APP 栏目之一；null = 不绑定发布栏目 */
  appChannelSlug: string | null;
  /** form = 需填输入字段；direct = 一键启动 */
  launchMode: "form" | "direct";
  inputFields: InputFieldDef[];
  steps: WorkflowStepDef[];
  systemInstruction?: string;
  /** Mustache 风格 prompt 模板，含 {{field_name}} 占位 */
  promptTemplate?: string;
}

// ─── Step builder helper ──────────────────────────────────────────────────

function step(
  order: number,
  name: string,
  skillSlug: string,
  skillName: string,
  skillCategory: string,
  key: string,
): WorkflowStepDef {
  return {
    id: `step-${order}`,
    order,
    dependsOn: order > 1 ? [`step-${order - 1}`] : [],
    name,
    type: "skill",
    config: {
      skillSlug,
      skillName,
      skillCategory,
      parameters: {},
    },
    key,
    label: name,
  };
}

// ─── BUILTIN_WORKFLOWS ────────────────────────────────────────────────────

export const BUILTIN_WORKFLOWS: BuiltinWorkflowSeed[] = [
  // ════════════════════════════════════════════════════════════════════════
  // xiaolei 热点分析师 · 3 条（选题 / 热点）
  // ════════════════════════════════════════════════════════════════════════

  {
    slug: "breaking_news",
    name: "突发新闻追踪",
    description: "第一时间捕捉突发事件，快速聚合多源信息生成突发简讯。",
    icon: "zap",
    category: "news",
    ownerEmployeeId: "xiaolei",
    defaultTeam: ["xiaolei", "xiaowen", "xiaofa"],
    appChannelSlug: "app_news",
    launchMode: "form",
    inputFields: [
      {
        name: "event_keywords",
        label: "事件关键词",
        type: "text",
        required: true,
        placeholder: "如：某地地震、某公司重大事故",
      },
      {
        name: "urgency_level",
        label: "紧急程度",
        type: "select",
        required: true,
        placeholder: "选择紧急程度",
        options: [
          { value: "critical", label: "特急（10 分钟内发布）" },
          { value: "urgent", label: "紧急（30 分钟内发布）" },
          { value: "normal", label: "一般（2 小时内发布）" },
        ],
      },
      {
        name: "event_time",
        label: "事件发生时间",
        type: "date",
        required: false,
      },
    ],
    systemInstruction:
      "围绕 {{event_keywords}} 追踪突发事件。极高时效要求（{{urgency_level}}），必须核对多源信息交叉印证。产出结构：1) 事件速报（200 字内）2) 已知事实列表 3) 信源置信度标注 4) 进展追踪钩子。",
    promptTemplate:
      "请针对「{{event_keywords}}」进行突发新闻追踪，紧急程度 {{urgency_level}}，产出可直发的简讯稿。",
    steps: [
      step(1, "多源信息聚合", "news_aggregation", "新闻聚合", "perception", "aggregate"),
      step(2, "全网深度搜索", "web_search", "全网搜索", "perception", "search"),
      step(3, "事实交叉核查", "fact_check", "事实核查", "management", "verify"),
      step(4, "突发简讯撰写", "content_generate", "内容生成", "generation", "write"),
      step(5, "合规快扫", "compliance_check", "合规审核", "management", "compliance"),
    ],
  },

  {
    slug: "hot_radar",
    name: "全网热点雷达",
    description: "扫描微博/抖音/头条等主流平台热榜，输出 Top N 热点洞察与选题建议。",
    icon: "radar",
    category: "news",
    ownerEmployeeId: "xiaolei",
    defaultTeam: ["xiaolei", "xiaoce"],
    appChannelSlug: "app_news",
    launchMode: "form",
    inputFields: [
      {
        name: "platforms",
        label: "监测平台",
        type: "multiselect",
        required: true,
        placeholder: "选择一个或多个平台",
        options: [
          { value: "weibo", label: "微博" },
          { value: "douyin", label: "抖音" },
          { value: "toutiao", label: "头条" },
          { value: "baidu", label: "百度" },
          { value: "zhihu", label: "知乎" },
          { value: "bilibili", label: "B 站" },
        ],
      },
      {
        name: "domain",
        label: "关注领域",
        type: "select",
        required: false,
        placeholder: "全部",
        options: ["全部", "科技", "财经", "文娱", "体育", "社会", "民生"],
      },
      {
        name: "top_n",
        label: "Top N",
        type: "number",
        required: false,
        defaultValue: 10,
        validation: { min: 3, max: 50 },
      },
    ],
    systemInstruction:
      "扫描 {{platforms}} 的 {{domain}} 领域热榜，输出 Top {{top_n}} 热点雷达。每条含：标题、热度值、来源平台、上升趋势、建议切入角度。末尾给出整体态势总结与 3 个推荐跟进选题。",
    promptTemplate:
      "对 {{platforms}} 做全网热点雷达扫描，聚焦 {{domain}}，输出 Top {{top_n}}。",
    steps: [
      step(1, "多平台热榜抓取", "trending_topics", "热榜聚合", "perception", "fetch"),
      step(2, "热度趋势分析", "trend_monitor", "趋势监控", "perception", "trend"),
      step(3, "热点价值评分", "heat_scoring", "热度评分", "analysis", "score"),
      step(4, "雷达报告生成", "content_generate", "内容生成", "generation", "report"),
    ],
  },

  {
    slug: "press_conference",
    name: "发布会追踪",
    description: "针对指定发布会进行事前预研、事中速记、事后分析一体化追踪。",
    icon: "mic",
    category: "news",
    ownerEmployeeId: "xiaolei",
    defaultTeam: ["xiaolei", "xiaozi", "xiaowen"],
    appChannelSlug: "app_news",
    launchMode: "form",
    inputFields: [
      {
        name: "conference_name",
        label: "发布会名称",
        type: "text",
        required: true,
        placeholder: "如：苹果 2026 春季新品发布会",
      },
      {
        name: "conference_date",
        label: "发布会日期",
        type: "date",
        required: true,
      },
      {
        name: "focus_angles",
        label: "重点关注角度",
        type: "text",
        required: false,
        placeholder: "产品/战略/业绩（多选以逗号分隔）",
      },
    ],
    systemInstruction:
      "针对 {{conference_name}}（{{conference_date}}）进行追踪报道。阶段：1) 事前预研（背景/预期亮点）2) 速记要点（发布内容结构化）3) 事后分析（亮点/争议/影响）。关注角度：{{focus_angles}}。",
    promptTemplate:
      "追踪「{{conference_name}}」（{{conference_date}}），重点看 {{focus_angles}}。",
    steps: [
      step(1, "发布会背景预研", "web_search", "全网搜索", "perception", "research"),
      step(2, "同类发布会参考", "case_reference", "案例参考", "analysis", "case"),
      step(3, "要点提取与结构化", "topic_extraction", "选题提取", "analysis", "extract"),
      step(4, "追踪稿件撰写", "content_generate", "内容生成", "generation", "write"),
      step(5, "事实核查", "fact_check", "事实核查", "management", "verify"),
    ],
  },

  // ════════════════════════════════════════════════════════════════════════
  // xiaoce 选题策划师 · 3 条（策划）
  // ════════════════════════════════════════════════════════════════════════

  {
    slug: "topic_package",
    name: "选题打包",
    description: "围绕主题产出多维度、差异化的选题方案包，含角度/形态/受众建议。",
    icon: "book-open",
    category: "deep",
    ownerEmployeeId: "xiaoce",
    defaultTeam: ["xiaoce", "xiaolei"],
    appChannelSlug: "app_news",
    launchMode: "form",
    inputFields: [
      {
        name: "main_topic",
        label: "主题",
        type: "text",
        required: true,
        placeholder: "如：AI 新政策对行业的影响",
      },
      {
        name: "topic_count",
        label: "目标选题数",
        type: "number",
        required: false,
        defaultValue: 5,
        validation: { min: 3, max: 12 },
      },
      {
        name: "target_formats",
        label: "目标形态",
        type: "multiselect",
        required: false,
        options: [
          { value: "news_article", label: "新闻图文" },
          { value: "deep_report", label: "深度报道" },
          { value: "video", label: "短视频" },
          { value: "podcast", label: "播客" },
          { value: "social", label: "社交媒体" },
        ],
      },
    ],
    systemInstruction:
      "围绕「{{main_topic}}」产出 {{topic_count}} 个差异化选题方案。每个方案含：1) 选题标题 2) 核心角度 3) 推荐形态 4) 目标受众 5) 预估完成周期 6) 差异化价值说明。目标形态范围：{{target_formats}}。",
    promptTemplate:
      "为主题「{{main_topic}}」打包 {{topic_count}} 个选题，形态含 {{target_formats}}。",
    steps: [
      step(1, "主题背景调研", "web_search", "全网搜索", "perception", "research"),
      step(2, "受众需求分析", "audience_analysis", "受众分析", "analysis", "audience"),
      step(3, "多角度选题生成", "topic_extraction", "选题提取", "analysis", "extract"),
      step(4, "选题价值评分", "heat_scoring", "热度评分", "analysis", "score"),
      step(5, "选题清单输出", "content_generate", "内容生成", "generation", "output"),
    ],
  },

  {
    slug: "series_planning",
    name: "系列策划",
    description: "针对长期主题产出系列大纲，含节奏排期/差异化定位/素材规划。",
    icon: "scroll",
    category: "deep",
    ownerEmployeeId: "xiaoce",
    defaultTeam: ["xiaoce", "xiaozi", "xiaowen"],
    appChannelSlug: "app_news",
    launchMode: "form",
    inputFields: [
      {
        name: "series_theme",
        label: "系列主题",
        type: "text",
        required: true,
        placeholder: "如：中国 AI 产业深度观察",
      },
      {
        name: "episode_count",
        label: "计划期数",
        type: "number",
        required: true,
        defaultValue: 6,
        validation: { min: 3, max: 24 },
      },
      {
        name: "publish_range",
        label: "发布周期",
        type: "daterange",
        required: false,
      },
      {
        name: "target_depth",
        label: "深度档位",
        type: "select",
        required: false,
        placeholder: "standard",
        options: [
          { value: "light", label: "轻度科普" },
          { value: "standard", label: "标准深度" },
          { value: "heavy", label: "重度研报" },
        ],
      },
    ],
    systemInstruction:
      "为系列「{{series_theme}}」规划 {{episode_count}} 期大纲，发布周期 {{publish_range}}，深度档位 {{target_depth}}。结构：1) 系列定位与差异化 2) 每期标题/核心角度/关键内容 3) 节奏排期 4) 素材准备清单 5) 预期影响力指标。",
    promptTemplate:
      "为系列「{{series_theme}}」规划 {{episode_count}} 期，周期 {{publish_range}}。",
    steps: [
      step(1, "系列主题背景调研", "web_search", "全网搜索", "perception", "research"),
      step(2, "同类系列参考对标", "case_reference", "案例参考", "analysis", "benchmark"),
      step(3, "受众画像分析", "audience_analysis", "受众分析", "analysis", "audience"),
      step(4, "系列大纲生成", "content_generate", "内容生成", "generation", "outline"),
      step(5, "选题差异化校验", "topic_extraction", "选题提取", "analysis", "dedup"),
    ],
  },

  {
    slug: "livelihood_brief",
    name: "民生线索汇编",
    description: "汇聚本地民生热点线索，整理为可落地的民生报道选题库。",
    icon: "map-pin",
    category: "livelihood",
    ownerEmployeeId: "xiaoce",
    defaultTeam: ["xiaoce", "xiaolei", "xiaowen"],
    appChannelSlug: "app_livelihood_zhongcao",
    launchMode: "form",
    inputFields: [
      {
        name: "city",
        label: "城市",
        type: "select",
        required: true,
        placeholder: "选择城市",
        options: ["深圳", "广州", "成都", "重庆", "上海", "北京", "杭州", "武汉"],
      },
      {
        name: "brief_date",
        label: "汇编日期",
        type: "date",
        required: false,
      },
      {
        name: "topic_scope",
        label: "话题范围",
        type: "multiselect",
        required: false,
        options: [
          { value: "policy", label: "民生政策" },
          { value: "service", label: "公共服务" },
          { value: "consumer", label: "消费物价" },
          { value: "transport", label: "交通出行" },
          { value: "health", label: "医疗健康" },
          { value: "education", label: "教育升学" },
        ],
      },
    ],
    systemInstruction:
      "汇编 {{city}} 在 {{brief_date}} 的民生线索库。范围：{{topic_scope}}。结构：1) 今日线索 Top 10（含来源/紧急程度）2) 推荐跟进选题 3) 市民关注热词 4) 舆情风向提示。",
    promptTemplate:
      "汇编 {{city}} 在 {{brief_date}} 的民生线索，覆盖 {{topic_scope}}。",
    steps: [
      step(1, "本地民生信源聚合", "news_aggregation", "新闻聚合", "perception", "aggregate"),
      step(2, "社交平台舆情扫描", "social_listening", "社交舆情", "perception", "listen"),
      step(3, "线索筛选去重", "topic_extraction", "选题提取", "analysis", "filter"),
      step(4, "民生线索汇编", "content_generate", "内容生成", "generation", "compile"),
    ],
  },

  // ════════════════════════════════════════════════════════════════════════
  // xiaozi 素材研究员 · 3 条（写稿 / 素材研究）
  // ════════════════════════════════════════════════════════════════════════

  {
    slug: "news_write",
    name: "新闻稿撰写",
    description: "基于指定选题快速产出规范新闻稿，含多版本标题与分享摘要。",
    icon: "newspaper",
    category: "news",
    ownerEmployeeId: "xiaozi",
    defaultTeam: ["xiaozi", "xiaowen", "xiaofa"],
    appChannelSlug: "app_news",
    launchMode: "form",
    inputFields: [
      {
        name: "topic",
        label: "选题",
        type: "text",
        required: true,
        placeholder: "输入选题或粘贴素材",
      },
      {
        name: "word_count",
        label: "目标字数",
        type: "number",
        required: false,
        defaultValue: 1200,
        validation: { min: 300, max: 5000 },
      },
      {
        name: "tone",
        label: "风格",
        type: "select",
        required: false,
        placeholder: "news_standard",
        options: [
          { value: "news_standard", label: "标准新闻" },
          { value: "serious", label: "严肃权威" },
          { value: "casual", label: "轻松叙事" },
        ],
      },
    ],
    systemInstruction:
      "基于「{{topic}}」撰写 {{word_count}} 字新闻稿，风格 {{tone}}。产出：1) 3 个候选标题（专业/网感/悬念）2) 完整正文 3) ≤80 字分享摘要 4) 关键字标签。",
    promptTemplate:
      "就「{{topic}}」写 {{word_count}} 字新闻稿，风格 {{tone}}。",
    steps: [
      step(1, "选题素材梳理", "topic_extraction", "选题提取", "analysis", "parse"),
      step(2, "多源素材搜索", "web_search", "全网搜索", "perception", "search"),
      step(3, "多风格标题生成", "headline_generate", "标题生成", "generation", "headline"),
      step(4, "新闻稿正文撰写", "content_generate", "内容生成", "generation", "write"),
      step(5, "分享摘要生成", "summary_generate", "摘要生成", "generation", "summary"),
    ],
  },

  {
    slug: "deep_report",
    name: "深度报道",
    description: "针对重大选题产出 3000+ 字深度长文，含多方观点与数据支撑。",
    icon: "edit-3",
    category: "deep",
    ownerEmployeeId: "xiaozi",
    defaultTeam: ["xiaozi", "xiaoce", "xiaowen", "xiaoshen"],
    appChannelSlug: "app_news",
    launchMode: "form",
    inputFields: [
      {
        name: "topic",
        label: "深度选题",
        type: "text",
        required: true,
        placeholder: "如：中国 AI 产业政策变迁与从业者众生相",
      },
      {
        name: "angles",
        label: "分析维度",
        type: "text",
        required: false,
        placeholder: "政策/市场/从业者（多维以逗号分隔）",
      },
      {
        name: "word_count",
        label: "目标字数",
        type: "number",
        required: false,
        defaultValue: 3500,
        validation: { min: 2000, max: 10000 },
      },
    ],
    systemInstruction:
      "针对「{{topic}}」产出 {{word_count}} 字深度报道，维度 {{angles}}。结构：1) 悬念开头 2) 事件全景回顾 3) 多方观点（≥3 方） 4) 数据支撑 5) 深度洞察与展望。必须经过事实核查。",
    promptTemplate:
      "就「{{topic}}」写 {{word_count}} 字深度报道，维度 {{angles}}。",
    steps: [
      step(1, "多维度背景调研", "web_search", "全网搜索", "perception", "research"),
      step(2, "网页深度抓取", "web_deep_read", "网页深读", "perception", "crawl"),
      step(3, "核心观点萃取", "topic_extraction", "选题提取", "analysis", "extract"),
      step(4, "数据支撑分析", "data_report", "数据报告", "analysis", "data"),
      step(5, "多角度深度撰写", "content_generate", "内容生成", "generation", "write"),
      step(6, "事实核查", "fact_check", "事实核查", "management", "verify"),
    ],
  },

  {
    slug: "social_post",
    name: "社交平台帖子",
    description: "为社交平台产出适配化帖子，含平台差异化改写与话题标签建议。",
    icon: "share-2",
    category: "social",
    ownerEmployeeId: "xiaozi",
    defaultTeam: ["xiaozi", "xiaowen", "xiaofa"],
    appChannelSlug: null,
    launchMode: "form",
    inputFields: [
      {
        name: "content_source",
        label: "内容素材 / 主题",
        type: "textarea",
        required: true,
        placeholder: "粘贴源稿件或输入主题",
      },
      {
        name: "platforms",
        label: "目标平台",
        type: "multiselect",
        required: true,
        options: [
          { value: "weibo", label: "微博" },
          { value: "wechat", label: "微信公众号" },
          { value: "xiaohongshu", label: "小红书" },
          { value: "douyin", label: "抖音" },
          { value: "video_channel", label: "视频号" },
        ],
      },
      {
        name: "post_tone",
        label: "帖子语气",
        type: "select",
        required: false,
        placeholder: "friendly",
        options: [
          { value: "professional", label: "专业" },
          { value: "friendly", label: "亲切" },
          { value: "edgy", label: "犀利" },
          { value: "humorous", label: "幽默" },
        ],
      },
    ],
    systemInstruction:
      "基于「{{content_source}}」为 {{platforms}} 各平台产出适配帖子，语气 {{post_tone}}。每平台含：1) 主文案（按平台字数限制）2) 推荐 3-5 个话题 tag 3) @/引导互动话术 4) 最佳发布时段建议。",
    promptTemplate:
      "把「{{content_source}}」改写为 {{platforms}} 各平台的帖子，语气 {{post_tone}}。",
    steps: [
      step(1, "素材结构分析", "topic_extraction", "选题提取", "analysis", "parse"),
      step(2, "平台受众分析", "audience_analysis", "受众分析", "analysis", "audience"),
      step(3, "平台差异化改写", "style_rewrite", "风格改写", "generation", "adapt"),
      step(4, "话题标签推荐", "publish_strategy", "发布策略", "management", "tags"),
    ],
  },
];

// ─── 向后兼容 export ──────────────────────────────────────────────────────
// Chunk C 将进一步让 `seedBuiltinTemplatesForOrg` 直接消费 BUILTIN_WORKFLOWS
// 并写入新的 4 列（isPublic / ownerEmployeeId / launchMode / promptTemplate）。
// 当前 chunk 保留同名函数以维持 seed.ts 与 scripts/seed-demo-workflows.ts 可用。

/**
 * Map a `BuiltinWorkflowSeed` to the legacy `BuiltinSeedInput` shape consumed
 * by `seedBuiltinTemplatesForOrg`. Extended fields (ownerEmployeeId / launchMode
 * / promptTemplate / isPublic) are dropped here — Chunk C will extend the DAL
 * signature to carry them through.
 */
function toBuiltinSeedInput(w: BuiltinWorkflowSeed): BuiltinSeedInput {
  return {
    name: w.name,
    description: w.description,
    category: w.category,
    icon: w.icon,
    inputFields: w.inputFields,
    defaultTeam: w.defaultTeam,
    appChannelSlug: w.appChannelSlug,
    systemInstruction: w.systemInstruction ?? null,
    legacyScenarioKey: w.slug,
    steps: w.steps,
  };
}

/**
 * 汇总 builtin seeds。
 *
 * Phase 1 Chunk A：9 条（xiaolei 3 + xiaoce 3 + xiaozi 3）
 * Phase 1 Chunk B：+ 12 条（xiaowen 2 + xiaojian 3 + xiaoshen 2 + xiaofa 2 + xiaoshu 3）
 * Phase 1 Chunk C：+ 5 条公共场景 = 26 条最终规模
 */
export function buildBuiltinScenarioSeeds(): BuiltinSeedInput[] {
  return BUILTIN_WORKFLOWS.map(toBuiltinSeedInput);
}

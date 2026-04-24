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
  /** form = 需填输入字段；direct = 一键启动 */
  launchMode: "form" | "direct";
  inputFields: InputFieldDef[];
  steps: WorkflowStepDef[];
  systemInstruction?: string;
  /** Mustache 风格 prompt 模板，含 {{field_name}} 占位 */
  promptTemplate?: string;
  /** 主流场景 tab 标记；默认 false。 */
  isFeatured?: boolean;
  /** 触发方式：manual 人工启动；scheduled 需配 cron */
  triggerType?: "manual" | "scheduled";
  /** 定时触发配置（triggerType=scheduled 时生效） */
  triggerConfig?: { cron?: string; timezone?: string };
}

// ─── Step builder helper ──────────────────────────────────────────────────

function step(
  order: number,
  name: string,
  skillSlug: string,
  skillName: string,
  skillCategory: string,
  key: string,
  parameters: Record<string, unknown> = {},
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
      parameters,
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
      step(1, "多源信息聚合", "news_aggregation", "新闻聚合", "data_collection", "aggregate"),
      step(2, "全网深度搜索", "web_search", "全网搜索", "web_search", "search"),
      step(3, "事实交叉核查", "fact_check", "事实核查", "quality_review", "verify"),
      step(4, "突发简讯撰写", "content_generate", "内容生成", "content_gen", "write"),
      step(5, "合规快扫", "compliance_check", "合规审核", "quality_review", "compliance"),
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
      step(1, "多平台热榜抓取", "trending_topics", "热榜聚合", "data_collection", "fetch"),
      step(2, "热度趋势分析", "trend_monitor", "趋势监控", "data_collection", "trend"),
      step(3, "热点价值评分", "heat_scoring", "热度评分", "data_analysis", "score"),
      step(4, "雷达报告生成", "content_generate", "内容生成", "content_gen", "report"),
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
      step(1, "发布会背景预研", "web_search", "全网搜索", "web_search", "research"),
      step(2, "同类发布会参考", "case_reference", "案例参考", "other", "case"),
      step(3, "要点提取与结构化", "topic_extraction", "选题提取", "content_analysis", "extract"),
      step(4, "追踪稿件撰写", "content_generate", "内容生成", "content_gen", "write"),
      step(5, "事实核查", "fact_check", "事实核查", "quality_review", "verify"),
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
      step(1, "主题背景调研", "web_search", "全网搜索", "web_search", "research"),
      step(2, "受众需求分析", "audience_analysis", "受众分析", "data_analysis", "audience"),
      step(3, "多角度选题生成", "topic_extraction", "选题提取", "content_analysis", "extract"),
      step(4, "选题价值评分", "heat_scoring", "热度评分", "data_analysis", "score"),
      step(5, "选题清单输出", "content_generate", "内容生成", "content_gen", "output"),
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
      step(1, "系列主题背景调研", "web_search", "全网搜索", "web_search", "research"),
      step(2, "同类系列参考对标", "case_reference", "案例参考", "other", "benchmark"),
      step(3, "受众画像分析", "audience_analysis", "受众分析", "data_analysis", "audience"),
      step(4, "系列大纲生成", "content_generate", "内容生成", "content_gen", "outline"),
      step(5, "选题差异化校验", "topic_extraction", "选题提取", "content_analysis", "dedup"),
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
      step(1, "本地民生信源聚合", "news_aggregation", "新闻聚合", "data_collection", "aggregate"),
      step(2, "社交平台舆情扫描", "social_listening", "社交舆情", "data_collection", "listen"),
      step(3, "线索筛选去重", "topic_extraction", "选题提取", "content_analysis", "filter"),
      step(4, "民生线索汇编", "content_generate", "内容生成", "content_gen", "compile"),
    ],
  },

  // ════════════════════════════════════════════════════════════════════════
  // xiaowen 内容创作师 · 写作核心场景（从 xiaozi 重归属 2026-04-20）
  // ════════════════════════════════════════════════════════════════════════

  {
    slug: "news_write",
    name: "新闻稿撰写",
    description: "基于指定选题快速产出规范新闻稿，含多版本标题与分享摘要。",
    icon: "newspaper",
    category: "news",
    ownerEmployeeId: "xiaowen",
    defaultTeam: ["xiaowen", "xiaozi", "xiaofa"],
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
      step(1, "选题素材梳理", "topic_extraction", "选题提取", "content_analysis", "parse"),
      step(2, "多源素材搜索", "web_search", "全网搜索", "web_search", "search"),
      step(3, "多风格标题生成", "headline_generate", "标题生成", "content_gen", "headline"),
      step(4, "新闻稿正文撰写", "content_generate", "内容生成", "content_gen", "write"),
      step(5, "分享摘要生成", "summary_generate", "摘要生成", "content_gen", "summary"),
    ],
  },

  {
    slug: "deep_report",
    name: "深度报道",
    description: "针对重大选题产出 3000+ 字深度长文，含多方观点与数据支撑。",
    icon: "edit-3",
    category: "deep",
    ownerEmployeeId: "xiaowen",
    defaultTeam: ["xiaowen", "xiaoce", "xiaozi", "xiaoshen"],
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
      step(1, "多维度背景调研", "web_search", "全网搜索", "web_search", "research"),
      step(2, "网页深度抓取", "web_deep_read", "网页深读", "web_search", "crawl"),
      step(3, "核心观点萃取", "topic_extraction", "选题提取", "content_analysis", "extract"),
      step(4, "数据支撑分析", "data_report", "数据报告", "data_analysis", "data"),
      step(5, "多角度深度撰写", "content_generate", "内容生成", "content_gen", "write"),
      step(6, "事实核查", "fact_check", "事实核查", "quality_review", "verify"),
    ],
  },

  {
    slug: "social_post",
    name: "社交平台帖子",
    description: "为社交平台产出适配化帖子，含平台差异化改写与话题标签建议。",
    icon: "share-2",
    category: "social",
    ownerEmployeeId: "xiaowen",
    defaultTeam: ["xiaowen", "xiaozi", "xiaofa"],
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
      step(1, "素材结构分析", "topic_extraction", "选题提取", "content_analysis", "parse"),
      step(2, "平台受众分析", "audience_analysis", "受众分析", "data_analysis", "audience"),
      step(3, "平台差异化改写", "style_rewrite", "风格改写", "content_gen", "adapt"),
      step(4, "话题标签推荐", "publish_strategy", "发布策略", "distribution", "tags"),
    ],
  },

  // ════════════════════════════════════════════════════════════════════════
  // xiaozi 素材研究员 · 4 条（素材整合 / 媒资库）2026-04-20 新增
  // ════════════════════════════════════════════════════════════════════════

  {
    slug: "hot_material_capture",
    name: "热点素材抓取",
    description: "围绕热点关键词批量抓取全网图文/视频/音频素材，自动去重归档。",
    icon: "radar",
    category: "news",
    ownerEmployeeId: "xiaozi",
    defaultTeam: ["xiaozi", "xiaolei"],
    launchMode: "form",
    inputFields: [
      {
        name: "keywords",
        label: "关键词",
        type: "text",
        required: true,
        placeholder: "多个关键词用逗号分隔",
      },
      {
        name: "media_types",
        label: "素材类型",
        type: "multiselect",
        required: false,
        options: [
          { value: "text", label: "图文" },
          { value: "image", label: "图片" },
          { value: "video", label: "视频" },
          { value: "audio", label: "音频" },
        ],
      },
      {
        name: "time_range",
        label: "时间范围",
        type: "select",
        required: false,
        placeholder: "24h",
        options: [
          { value: "24h", label: "近 24 小时" },
          { value: "7d", label: "近 7 天" },
          { value: "30d", label: "近 30 天" },
        ],
      },
    ],
    systemInstruction:
      "围绕「{{keywords}}」在 {{time_range}} 内抓取 {{media_types}} 类型素材。输出：1) 素材清单（含标题/来源/时间/URL）2) 相似度去重标记 3) 素材质量打分 4) 建议入库的 Top 列表。",
    promptTemplate:
      "抓取「{{keywords}}」在 {{time_range}} 内的 {{media_types}} 素材。",
    steps: [
      step(1, "多源全网搜索", "web_search", "全网搜索", "web_search", "search"),
      step(2, "素材深度爬取", "web_deep_read", "网页深读", "web_search", "crawl"),
      step(3, "素材去重与打分", "topic_extraction", "素材整合", "content_analysis", "dedupe"),
    ],
  },

  {
    slug: "media_library_build",
    name: "媒资库构建",
    description: "对批量素材做结构化标注（主题/标签/实体），入库形成可检索知识库。",
    icon: "folder-open",
    category: "news",
    ownerEmployeeId: "xiaozi",
    defaultTeam: ["xiaozi"],
    launchMode: "form",
    inputFields: [
      {
        name: "source_batch",
        label: "素材批次",
        type: "textarea",
        required: true,
        placeholder: "粘贴素材 URL 列表或批次 ID",
      },
      {
        name: "tag_strategy",
        label: "标注策略",
        type: "select",
        required: false,
        placeholder: "auto",
        options: [
          { value: "auto", label: "自动标注（主题+实体）" },
          { value: "hybrid", label: "自动+人工复核" },
          { value: "manual", label: "仅人工" },
        ],
      },
    ],
    systemInstruction:
      "对素材批次「{{source_batch}}」按 {{tag_strategy}} 策略做结构化标注。输出：1) 每条素材的标签（主题/实体/情感/版权） 2) 入库结构化 JSON 3) 可能的重复与冲突提示。",
    promptTemplate:
      "对「{{source_batch}}」按 {{tag_strategy}} 做结构化标注入库。",
    steps: [
      step(1, "素材主题识别", "topic_extraction", "选题提取", "content_analysis", "extract"),
      step(2, "实体与标签生成", "summary_generate", "摘要生成", "content_gen", "tag"),
      step(3, "入库结构化", "data_report", "数据报告", "data_analysis", "index"),
    ],
  },

  {
    slug: "material_copyright_check",
    name: "素材版权核验",
    description: "核验素材来源授权状态，输出版权风险评级与替代建议。",
    icon: "shield",
    category: "news",
    ownerEmployeeId: "xiaozi",
    defaultTeam: ["xiaozi", "xiaoshen"],
    launchMode: "form",
    inputFields: [
      {
        name: "material_urls",
        label: "素材 URL 列表",
        type: "textarea",
        required: true,
        placeholder: "每行一个 URL",
      },
      {
        name: "usage_scene",
        label: "使用场景",
        type: "select",
        required: false,
        placeholder: "commercial",
        options: [
          { value: "commercial", label: "商业发布" },
          { value: "editorial", label: "新闻编辑" },
          { value: "internal", label: "内部研究" },
        ],
      },
    ],
    systemInstruction:
      "核验「{{material_urls}}」的版权情况，使用场景 {{usage_scene}}。输出：1) 每条素材的版权状态（CC/商用/需授权/禁用） 2) 风险评级 3) 替代无版权风险的素材建议。",
    promptTemplate:
      "核验「{{material_urls}}」在 {{usage_scene}} 下的版权风险。",
    steps: [
      step(1, "素材来源溯源", "web_deep_read", "网页深读", "web_search", "trace"),
      step(2, "版权规则匹配", "compliance_check", "合规审核", "quality_review", "copyright"),
      step(3, "替代素材推荐", "web_search", "全网搜索", "web_search", "alternative"),
    ],
  },

  {
    slug: "topic_material_pack",
    name: "选题素材包",
    description: "围绕指定选题快速打包配套素材（背景/数据/图片/引语），直接交付给写作环节。",
    icon: "package",
    category: "news",
    ownerEmployeeId: "xiaozi",
    defaultTeam: ["xiaozi", "xiaoce", "xiaowen"],
    launchMode: "form",
    inputFields: [
      {
        name: "topic",
        label: "选题",
        type: "text",
        required: true,
        placeholder: "如：AI 眼镜新品发布",
      },
      {
        name: "pack_contents",
        label: "素材构成",
        type: "multiselect",
        required: false,
        options: [
          { value: "background", label: "背景资料" },
          { value: "data", label: "关键数据" },
          { value: "quotes", label: "引语" },
          { value: "images", label: "配图" },
          { value: "timeline", label: "时间线" },
        ],
      },
    ],
    systemInstruction:
      "围绕「{{topic}}」打包 {{pack_contents}} 素材。输出：1) 分类归档的素材清单 2) 每项含来源与可信度 3) 即用型引语与数据表 4) 可直接交付给 xiaowen 写作的素材包摘要。",
    promptTemplate:
      "就「{{topic}}」打包 {{pack_contents}} 素材，交付写作环节。",
    steps: [
      step(1, "选题背景调研", "web_search", "全网搜索", "web_search", "research"),
      step(2, "关键数据提取", "data_report", "数据报告", "data_analysis", "data"),
      step(3, "素材包整理", "topic_extraction", "素材整合", "content_analysis", "pack"),
    ],
  },

  // ════════════════════════════════════════════════════════════════════════
  // xiaowen 内容创作师 · 深度写作
  // ════════════════════════════════════════════════════════════════════════

  {
    slug: "analysis",
    name: "深度分析稿",
    description: "围绕选题产出多维度深度分析稿，含情感倾向与多方观点融合。",
    icon: "file-text",
    category: "deep",
    ownerEmployeeId: "xiaowen",
    defaultTeam: ["xiaowen", "xiaoce", "xiaoshen"],
    launchMode: "form",
    inputFields: [
      {
        name: "topic",
        label: "主题",
        type: "text",
        required: true,
        placeholder: "如:新能源汽车出口新政解读",
      },
      {
        name: "angle",
        label: "分析角度",
        type: "select",
        required: true,
        placeholder: "选择分析角度",
        options: [
          { value: "policy", label: "政策解读" },
          { value: "data", label: "数据洞察" },
          { value: "industry", label: "产业视角" },
          { value: "impact", label: "社会影响" },
        ],
      },
      {
        name: "deadline",
        label: "截稿日期",
        type: "date",
        required: false,
      },
    ],
    systemInstruction:
      "围绕「{{topic}}」从 {{angle}} 视角产出深度分析稿,截稿 {{deadline}}。结构:1) 现象 / 事实速览 2) 核心矛盾梳理 3) 多方观点对比 4) 情感倾向分析 5) 结论与行动建议。",
    promptTemplate:
      "就「{{topic}}」从 {{angle}} 做深度分析稿,{{deadline}} 前交稿。",
    steps: [
      step(1, "多源网页深读", "web_deep_read", "网页深读", "web_search", "read"),
      step(2, "情感倾向分析", "sentiment_analysis", "情感分析", "content_analysis", "sentiment"),
      step(3, "深度分析稿撰写", "content_generate", "内容生成", "content_gen", "write"),
      step(4, "成稿质量复核", "quality_review", "质量审核", "quality_review", "review"),
    ],
  },

  {
    slug: "data_journalism",
    name: "数据新闻",
    description: "以数据驱动的新闻叙事,含数据清洗、可视化选型与解读。",
    icon: "bar-chart",
    category: "deep",
    ownerEmployeeId: "xiaowen",
    defaultTeam: ["xiaowen", "xiaoshu", "xiaozi"],
    launchMode: "form",
    inputFields: [
      {
        name: "data_topic",
        label: "数据主题",
        type: "text",
        required: true,
        placeholder: "如:2026 Q1 中国电动车销量地图",
      },
      {
        name: "data_source_url",
        label: "数据源 URL",
        type: "url",
        required: false,
        placeholder: "https://...",
      },
      {
        name: "presentation_forms",
        label: "呈现形式",
        type: "multiselect",
        required: false,
        options: [
          { value: "table", label: "数据表格" },
          { value: "chart", label: "图表可视化" },
          { value: "timeline", label: "时间轴叙事" },
        ],
      },
    ],
    systemInstruction:
      "针对「{{data_topic}}」产出数据新闻,数据来源 {{data_source_url}},呈现形式 {{presentation_forms}}。结构:1) 核心结论 2) 数据表格 3) 图表建议(注明图种 / 字段映射) 4) 记者解读 5) 数据局限性说明。",
    promptTemplate:
      "基于「{{data_topic}}」({{data_source_url}}) 产出数据新闻,呈现 {{presentation_forms}}。",
    steps: [
      step(1, "数据源背景搜索", "web_search", "全网搜索", "web_search", "search"),
      step(2, "数据报告生成", "data_report", "数据报告", "data_analysis", "data"),
      step(3, "排版布局设计", "layout_design", "排版设计", "content_gen", "layout"),
      step(4, "数据新闻撰写", "content_generate", "内容生成", "content_gen", "write"),
    ],
  },

  // ════════════════════════════════════════════════════════════════════════
  // xiaojian 视频剪辑师 · 3 条(视频)
  // ════════════════════════════════════════════════════════════════════════

  {
    slug: "vlog_edit",
    name: "Vlog 剪辑",
    description: "面向博主 / 记者 Vlog 的剪辑方案,含节奏、配乐与封面一条龙。",
    icon: "film",
    category: "video",
    ownerEmployeeId: "xiaojian",
    defaultTeam: ["xiaojian", "xiaozi"],
    launchMode: "form",
    inputFields: [
      {
        name: "topic",
        label: "主题",
        type: "text",
        required: true,
        placeholder: "如:我的一天 · 深圳科技展打卡",
      },
      {
        name: "duration_sec",
        label: "时长(秒)",
        type: "number",
        required: true,
        defaultValue: 180,
        validation: { min: 10, max: 1800 },
      },
      {
        name: "pace_style",
        label: "剪辑节奏",
        type: "select",
        required: false,
        placeholder: "选择节奏",
        options: [
          { value: "fast", label: "快节奏卡点" },
          { value: "smooth", label: "舒适平滑" },
          { value: "cinematic", label: "电影感慢镜" },
        ],
      },
    ],
    systemInstruction:
      "为 Vlog「{{topic}}」(时长 {{duration_sec}} 秒,节奏 {{pace_style}}) 出剪辑方案。结构:1) 分镜表(含时长 / 景别 / 转场) 2) 配乐建议(BPM / 情绪) 3) 封面设计方向 4) 字幕与花字节奏。",
    promptTemplate:
      "为 Vlog「{{topic}}」出 {{duration_sec}} 秒 {{pace_style}} 剪辑方案。",
    steps: [
      step(1, "视频剪辑分镜规划", "video_edit_plan", "视频剪辑规划", "av_script", "plan"),
      step(2, "配乐与音效规划", "audio_plan", "音频规划", "av_script", "audio"),
      step(3, "封面生成方案", "thumbnail_generate", "封面生成", "content_gen", "thumbnail"),
    ],
  },

  {
    slug: "short_video",
    name: "短视频",
    description: "面向抖音 / 视频号的竖屏短视频剪辑方案,强调前 3 秒钩子。",
    icon: "video",
    category: "video",
    ownerEmployeeId: "xiaojian",
    defaultTeam: ["xiaojian", "xiaozi", "xiaofa"],
    launchMode: "form",
    inputFields: [
      {
        name: "topic",
        label: "主题",
        type: "text",
        required: true,
        placeholder: "如:30 秒看懂新能源补贴新政",
      },
      {
        name: "duration_sec",
        label: "时长(秒)",
        type: "number",
        required: true,
        defaultValue: 45,
        validation: { min: 10, max: 1800 },
      },
      {
        name: "music_style",
        label: "配乐风格",
        type: "select",
        required: false,
        placeholder: "选择配乐风格",
        options: [
          { value: "trending", label: "热门卡点" },
          { value: "emotional", label: "情绪感染" },
          { value: "news", label: "新闻陈述" },
        ],
      },
    ],
    systemInstruction:
      "为短视频「{{topic}}」(时长 {{duration_sec}} 秒,配乐 {{music_style}}) 出剪辑方案。必须:1) 前 3 秒钩子 2) 竖屏构图 3) 字幕驱动信息密度 4) 结尾引导互动。",
    promptTemplate:
      "为短视频「{{topic}}」出 {{duration_sec}} 秒竖屏方案,配乐 {{music_style}}。",
    steps: [
      step(1, "分镜与钩子规划", "video_edit_plan", "视频剪辑规划", "av_script", "plan"),
      step(2, "配乐规划", "audio_plan", "音频规划", "av_script", "audio"),
      step(3, "竖屏封面生成", "thumbnail_generate", "封面生成", "content_gen", "thumbnail"),
    ],
  },

  {
    slug: "doc_video",
    name: "纪录片",
    description: "中长篇纪录片剪辑方案,含章节结构、叙事弧与配乐分层。",
    icon: "file-video",
    category: "video",
    ownerEmployeeId: "xiaojian",
    defaultTeam: ["xiaojian", "xiaowen", "xiaozi"],
    launchMode: "form",
    inputFields: [
      {
        name: "topic",
        label: "主题",
        type: "text",
        required: true,
        placeholder: "如:一座城市的夜:深圳凌晨 3 点",
      },
      {
        name: "duration_sec",
        label: "时长(秒)",
        type: "number",
        required: true,
        defaultValue: 900,
        validation: { min: 10, max: 1800 },
      },
      {
        name: "narrative_style",
        label: "叙事风格",
        type: "select",
        required: false,
        placeholder: "选择叙事风格",
        options: [
          { value: "observational", label: "观察式" },
          { value: "expository", label: "解说式" },
          { value: "poetic", label: "诗意化" },
        ],
      },
    ],
    systemInstruction:
      "为纪录片「{{topic}}」(时长 {{duration_sec}} 秒,风格 {{narrative_style}}) 出剪辑方案。结构:1) 章节(≥3 幕) 2) 叙事弧与高潮设计 3) 分层配乐(环境 / 主题 / 情绪) 4) 关键画面封面。",
    promptTemplate:
      "为纪录片「{{topic}}」出 {{duration_sec}} 秒 {{narrative_style}} 方案。",
    steps: [
      step(1, "章节与分镜规划", "video_edit_plan", "视频剪辑规划", "av_script", "plan"),
      step(2, "分层配乐规划", "audio_plan", "音频规划", "av_script", "audio"),
      step(3, "代表画面封面", "thumbnail_generate", "封面生成", "content_gen", "thumbnail"),
      step(4, "成片质量复核", "quality_review", "质量审核", "quality_review", "review"),
    ],
  },

  // ════════════════════════════════════════════════════════════════════════
  // xiaoshen 质量审核官 · 7 条（审核 / 合规 / 风控）2026-04-20 扩充
  // ════════════════════════════════════════════════════════════════════════

  {
    slug: "fact_check",
    name: "事实核查",
    description: "针对待核查文本做多源交叉验证,输出信源置信度报告。",
    icon: "shield-check",
    category: "news",
    ownerEmployeeId: "xiaoshen",
    defaultTeam: ["xiaoshen", "xiaolei"],
    launchMode: "form",
    inputFields: [
      {
        name: "text_to_check",
        label: "待核查文本",
        type: "textarea",
        required: true,
        placeholder: "粘贴需要核查的文本内容",
      },
      {
        name: "check_depth",
        label: "核查深度",
        type: "select",
        required: false,
        placeholder: "standard",
        options: [
          { value: "fast", label: "快速(关键事实)" },
          { value: "standard", label: "标准(逐条核查)" },
          { value: "deep", label: "深度(含引文溯源)" },
        ],
      },
    ],
    systemInstruction:
      "针对待核查文本做 {{check_depth}} 层核查。输出:1) 事实清单(含可疑项标红) 2) 多源交叉验证结果 3) 信源置信度打分 4) 修正建议摘要。",
    promptTemplate:
      "对下述文本做 {{check_depth}} 核查:\n\n{{text_to_check}}",
    steps: [
      step(1, "多源网络搜索取证", "web_search", "全网搜索", "web_search", "search"),
      step(2, "事实逐条核查", "fact_check", "事实核查", "quality_review", "verify"),
      step(3, "核查报告摘要", "summary_generate", "摘要生成", "content_gen", "summary"),
    ],
  },

  {
    slug: "compliance_review",
    name: "合规审查",
    description: "对待发内容做政治 / 广告 / 敏感词多维合规审查。",
    icon: "shield-alert",
    category: "news",
    ownerEmployeeId: "xiaoshen",
    defaultTeam: ["xiaoshen", "xiaofa"],
    launchMode: "form",
    inputFields: [
      {
        name: "content_to_review",
        label: "待审内容",
        type: "textarea",
        required: true,
        placeholder: "粘贴需要合规审查的内容",
      },
      {
        name: "review_dimensions",
        label: "审查维度",
        type: "multiselect",
        required: false,
        options: [
          { value: "politics", label: "政治导向" },
          { value: "advertising", label: "广告法合规" },
          { value: "sensitive", label: "敏感词过滤" },
        ],
      },
    ],
    systemInstruction:
      "对待审内容按 {{review_dimensions}} 维度做合规审查。输出:1) 总体评级(通过 / 修改后通过 / 不通过) 2) 问题清单(含原文定位 / 风险等级 / 整改建议) 3) 替代表达建议。",
    promptTemplate:
      "对下述内容做 {{review_dimensions}} 合规审查:\n\n{{content_to_review}}",
    steps: [
      step(1, "合规多维扫描", "compliance_check", "合规审核", "quality_review", "compliance"),
      step(2, "整改建议复核", "quality_review", "质量审核", "quality_review", "review"),
    ],
  },

  {
    slug: "sensitive_word_scan",
    name: "敏感词扫描",
    description: "对文本批量扫描敏感词/违禁词/负面词，输出命中位置与替换建议。",
    icon: "shield-alert",
    category: "news",
    ownerEmployeeId: "xiaoshen",
    defaultTeam: ["xiaoshen"],
    launchMode: "form",
    inputFields: [
      {
        name: "content",
        label: "待扫描文本",
        type: "textarea",
        required: true,
        placeholder: "粘贴待扫描的文本",
      },
      {
        name: "dict_level",
        label: "词库等级",
        type: "select",
        required: false,
        placeholder: "standard",
        options: [
          { value: "strict", label: "严格（政策+违禁+负面）" },
          { value: "standard", label: "标准（政策+违禁）" },
          { value: "loose", label: "宽松（仅违禁）" },
        ],
      },
    ],
    systemInstruction:
      "按 {{dict_level}} 词库扫描「{{content}}」。输出：1) 命中词清单（含所属分类/风险等级/位置索引） 2) 每处替换建议 3) 整体通过率评分。",
    promptTemplate:
      "以 {{dict_level}} 词库扫描「{{content}}」。",
    steps: [
      step(1, "敏感词匹配", "compliance_check", "合规审核", "quality_review", "scan"),
      step(2, "替换建议生成", "summary_generate", "摘要生成", "content_gen", "replace"),
    ],
  },

  {
    slug: "political_stance_review",
    name: "政治立场审核",
    description: "针对时政/涉外稿件做政治导向审核，关注口径、立场与表述规范。",
    icon: "shield-check",
    category: "news",
    ownerEmployeeId: "xiaoshen",
    defaultTeam: ["xiaoshen", "xiaowen"],
    launchMode: "form",
    inputFields: [
      {
        name: "content",
        label: "待审稿件",
        type: "textarea",
        required: true,
        placeholder: "粘贴涉政稿件全文",
      },
      {
        name: "topic_domain",
        label: "议题域",
        type: "select",
        required: false,
        placeholder: "domestic",
        options: [
          { value: "domestic", label: "国内时政" },
          { value: "diplomatic", label: "外交/国际" },
          { value: "taiwan", label: "涉台" },
          { value: "hongkong", label: "涉港澳" },
          { value: "ethnic", label: "民族宗教" },
        ],
      },
    ],
    systemInstruction:
      "对 {{topic_domain}} 议题稿件「{{content}}」做政治立场审核。输出：1) 立场合规评级 2) 口径问题清单（含官方标准表述对照） 3) 高风险段落整改建议 4) 需上报的争议点。",
    promptTemplate:
      "对「{{content}}」做 {{topic_domain}} 政治立场审核。",
    steps: [
      step(1, "政治敏感识别", "compliance_check", "合规审核", "quality_review", "politics"),
      step(2, "口径核对", "fact_check", "事实核查", "quality_review", "verify"),
      step(3, "审核报告生成", "summary_generate", "摘要生成", "content_gen", "report"),
    ],
  },

  {
    slug: "legal_compliance_review",
    name: "法律合规审查",
    description: "针对广告法/著作权法/未成年人保护等法律维度审查内容合规性。",
    icon: "shield",
    category: "news",
    ownerEmployeeId: "xiaoshen",
    defaultTeam: ["xiaoshen", "xiaofa"],
    launchMode: "form",
    inputFields: [
      {
        name: "content",
        label: "待审内容",
        type: "textarea",
        required: true,
      },
      {
        name: "legal_dimensions",
        label: "法律维度",
        type: "multiselect",
        required: false,
        options: [
          { value: "advertising", label: "广告法（极限词/虚假宣传）" },
          { value: "copyright", label: "著作权法（引用/转载）" },
          { value: "minor", label: "未成年人保护" },
          { value: "privacy", label: "个人信息保护" },
          { value: "food_drug", label: "药品/食品宣传" },
        ],
      },
    ],
    systemInstruction:
      "按 {{legal_dimensions}} 法律维度审查「{{content}}」。输出：1) 每条违规命中（引用法条+原文位置+风险等级） 2) 整改建议（保留商业表达力的前提下） 3) 需法务会签的重大风险点。",
    promptTemplate:
      "按 {{legal_dimensions}} 审查「{{content}}」的法律合规性。",
    steps: [
      step(1, "法律条款匹配", "compliance_check", "合规审核", "quality_review", "legal"),
      step(2, "风险分级", "quality_review", "质量审核", "quality_review", "risk"),
      step(3, "整改方案生成", "summary_generate", "摘要生成", "content_gen", "fix"),
    ],
  },

  {
    slug: "source_credibility_rating",
    name: "信源可信度评级",
    description: "对稿件引用的信源做权威性/偏向性/时效性评级，输出引用建议。",
    icon: "book-open",
    category: "news",
    ownerEmployeeId: "xiaoshen",
    defaultTeam: ["xiaoshen", "xiaolei"],
    launchMode: "form",
    inputFields: [
      {
        name: "sources",
        label: "信源列表",
        type: "textarea",
        required: true,
        placeholder: "每行一个信源（URL 或媒体名）",
      },
      {
        name: "topic_type",
        label: "选题类型",
        type: "select",
        required: false,
        placeholder: "news",
        options: [
          { value: "news", label: "时政新闻" },
          { value: "tech", label: "科技" },
          { value: "finance", label: "财经" },
          { value: "health", label: "医疗健康" },
          { value: "social", label: "社会民生" },
        ],
      },
    ],
    systemInstruction:
      "对 {{topic_type}} 选题下的信源「{{sources}}」做可信度评级。输出：1) 每条信源的权威等级（央级/省级/行业/自媒体）+ 偏向性（中立/倾向性/争议） 2) 在该选题下的可引用建议 3) 推荐补充的高可信信源。",
    promptTemplate:
      "对 {{topic_type}} 下「{{sources}}」做可信度评级。",
    steps: [
      step(1, "信源背景调研", "web_search", "全网搜索", "web_search", "research"),
      step(2, "权威性打分", "data_report", "数据报告", "data_analysis", "rate"),
      step(3, "引用建议生成", "summary_generate", "摘要生成", "content_gen", "advice"),
    ],
  },

  {
    slug: "final_review",
    name: "稿件终审把关",
    description: "发稿前全维度终审：事实+合规+语法+风格+SEO，出具一次性质检报告。",
    icon: "check-circle",
    category: "news",
    ownerEmployeeId: "xiaoshen",
    defaultTeam: ["xiaoshen", "xiaowen", "xiaofa"],
    launchMode: "form",
    inputFields: [
      {
        name: "article_id",
        label: "稿件 ID",
        type: "text",
        required: false,
        placeholder: "可选：粘贴稿件 ID 直接拉取",
      },
      {
        name: "content",
        label: "稿件全文",
        type: "textarea",
        required: false,
        placeholder: "或直接粘贴全文",
      },
      {
        name: "publish_channel",
        label: "目标发布渠道",
        type: "select",
        required: false,
        placeholder: "app_news",
        options: [
          { value: "app_news", label: "APP 新闻" },
          { value: "app_politics", label: "APP 时政" },
          { value: "wechat", label: "微信公众号" },
          { value: "weibo", label: "微博" },
        ],
      },
    ],
    systemInstruction:
      "对稿件 {{article_id}}（或正文「{{content}}」）发布到 {{publish_channel}} 前做一次性终审。输出统一报告：1) 事实核查结果 2) 合规审查结果 3) 语法/错别字 4) 风格一致性 5) 标题/SEO 建议 6) 总体评级（直接发布/轻改/重改/退稿）。",
    promptTemplate:
      "对稿件 {{article_id}} 发布到 {{publish_channel}} 前做终审，输出一次性质检报告。",
    steps: [
      step(1, "事实核查", "fact_check", "事实核查", "quality_review", "facts"),
      step(2, "合规扫描", "compliance_check", "合规审核", "quality_review", "compliance"),
      step(3, "语法错别字", "quality_review", "质量审核", "quality_review", "grammar"),
      step(4, "终审报告汇总", "summary_generate", "摘要生成", "content_gen", "final_report"),
    ],
  },

  // ════════════════════════════════════════════════════════════════════════
  // xiaofa 渠道运营师 · 4 条（分发 / 适配 / 策略）2026-04-20 扩充
  // ════════════════════════════════════════════════════════════════════════

  {
    slug: "multi_platform",
    name: "全平台分发",
    description: "基于既有稿件按各平台规则自动改写并生成发布策略。",
    icon: "send",
    category: "distribution",
    ownerEmployeeId: "xiaofa",
    defaultTeam: ["xiaofa", "xiaozi"],
    launchMode: "direct",
    inputFields: [],
    systemInstruction:
      "针对当前待分发稿件,自动识别可分发平台(APP / 微信 / 微博 / 抖音 / 视频号),按各平台规则改写文案并生成发布时序与策略。输出:1) 各平台改写稿 2) 发布时序 3) 互动引导 4) 风险提示。",
    promptTemplate:
      "把当前稿件按各平台规则自动改写并生成分发策略。",
    steps: [
      step(1, "多平台差异化改写", "style_rewrite", "风格改写", "content_gen", "rewrite"),
      step(2, "发布策略生成", "publish_strategy", "发布策略", "distribution", "strategy"),
    ],
  },

  {
    slug: "channel_adapt",
    name: "单渠道适配",
    description: "针对指定平台做深度文案适配,含平台化标题与发布策略。",
    icon: "share",
    category: "distribution",
    ownerEmployeeId: "xiaofa",
    defaultTeam: ["xiaofa", "xiaozi"],
    launchMode: "form",
    inputFields: [
      {
        name: "target_platform",
        label: "目标平台",
        type: "select",
        required: true,
        placeholder: "选择目标平台",
        options: [
          { value: "app", label: "APP" },
          { value: "wechat", label: "微信公众号" },
          { value: "weibo", label: "微博" },
          { value: "douyin", label: "抖音" },
        ],
      },
      {
        name: "source_article_id",
        label: "原稿件 ID",
        type: "text",
        required: false,
        placeholder: "粘贴已有稿件 ID(可选)",
      },
    ],
    systemInstruction:
      "将原稿件 {{source_article_id}} 深度适配为 {{target_platform}} 平台版本。产出:1) 3 个平台化候选标题 2) 平台风格改写稿 3) 发布时段与话题建议。",
    promptTemplate:
      "把稿件 {{source_article_id}} 深度适配为 {{target_platform}} 版本。",
    steps: [
      step(1, "平台风格改写", "style_rewrite", "风格改写", "content_gen", "rewrite"),
      step(2, "平台化标题生成", "headline_generate", "标题生成", "content_gen", "headline"),
      step(3, "发布策略生成", "publish_strategy", "发布策略", "distribution", "strategy"),
    ],
  },

  {
    slug: "multi_platform_headlines",
    name: "多平台标题优化",
    description: "为同一内容生成各平台最优标题（微博短、公众号深、抖音钩子、小红书种草）。",
    icon: "type",
    category: "distribution",
    ownerEmployeeId: "xiaofa",
    defaultTeam: ["xiaofa", "xiaowen"],
    launchMode: "form",
    inputFields: [
      {
        name: "core_message",
        label: "核心信息",
        type: "textarea",
        required: true,
        placeholder: "粘贴稿件摘要或核心卖点",
      },
      {
        name: "target_platforms",
        label: "目标平台",
        type: "multiselect",
        required: true,
        options: [
          { value: "weibo", label: "微博" },
          { value: "wechat", label: "微信公众号" },
          { value: "xiaohongshu", label: "小红书" },
          { value: "douyin", label: "抖音" },
          { value: "video_channel", label: "视频号" },
          { value: "toutiao", label: "今日头条" },
        ],
      },
    ],
    systemInstruction:
      "针对核心信息「{{core_message}}」为 {{target_platforms}} 各平台生成 3 组候选标题。每组含：标题正文 + 命中要点（情绪/悬念/数字/痛点）+ 预估点击率特征。不同平台风格差异化（微博短钩/公众号深度/抖音口语/小红书种草）。",
    promptTemplate:
      "为「{{core_message}}」生成 {{target_platforms}} 的平台化标题各 3 组。",
    steps: [
      step(1, "平台受众分析", "audience_analysis", "受众分析", "data_analysis", "audience"),
      step(2, "平台化标题生成", "headline_generate", "标题生成", "content_gen", "headline"),
    ],
  },

  {
    slug: "publish_timing_advisor",
    name: "发布时机推荐",
    description: "根据平台活跃时段+受众画像+内容类型推荐最佳发布时段与频率。",
    icon: "calendar-days",
    category: "distribution",
    ownerEmployeeId: "xiaofa",
    defaultTeam: ["xiaofa", "xiaoshu"],
    launchMode: "form",
    inputFields: [
      {
        name: "content_type",
        label: "内容类型",
        type: "select",
        required: true,
        placeholder: "选择类型",
        options: [
          { value: "breaking", label: "突发新闻" },
          { value: "deep", label: "深度长文" },
          { value: "video", label: "短视频" },
          { value: "lifestyle", label: "生活/种草" },
          { value: "tech", label: "科技" },
        ],
      },
      {
        name: "target_platforms",
        label: "目标平台",
        type: "multiselect",
        required: true,
        options: [
          { value: "weibo", label: "微博" },
          { value: "wechat", label: "微信公众号" },
          { value: "xiaohongshu", label: "小红书" },
          { value: "douyin", label: "抖音" },
          { value: "app", label: "APP 推送" },
        ],
      },
      {
        name: "audience_region",
        label: "受众地域",
        type: "select",
        required: false,
        placeholder: "nationwide",
        options: [
          { value: "nationwide", label: "全国" },
          { value: "north", label: "北方" },
          { value: "south", label: "南方" },
          { value: "tier1", label: "一线城市" },
        ],
      },
    ],
    systemInstruction:
      "针对 {{content_type}} 内容在 {{target_platforms}} 面向 {{audience_region}} 受众，推荐最佳发布时段与频率。输出：1) 每平台的 Top3 时段（含预估触达） 2) 本周发布日历 3) 错峰策略（避免同类内容堆叠） 4) 推送频率建议。",
    promptTemplate:
      "为 {{content_type}} 在 {{target_platforms}} ({{audience_region}}) 推荐最佳发布时机。",
    steps: [
      step(1, "平台活跃数据拉取", "data_report", "数据报告", "data_analysis", "data"),
      step(2, "受众画像匹配", "audience_analysis", "受众分析", "data_analysis", "audience"),
      step(3, "时机策略生成", "publish_strategy", "发布策略", "distribution", "timing"),
    ],
  },

  // ════════════════════════════════════════════════════════════════════════
  // xiaoshu 数据分析师 · 3 条(数)
  // ════════════════════════════════════════════════════════════════════════

  {
    slug: "daily_brief",
    name: "每日数据日报",
    description: "每日定时生成核心数据日报,覆盖阅读 / 互动 / 转化 / 舆情。",
    icon: "trending-up",
    category: "daily_brief",
    ownerEmployeeId: "xiaoshu",
    defaultTeam: ["xiaoshu", "xiaowen"],
    launchMode: "direct",
    inputFields: [],
    systemInstruction:
      "生成今日数据日报。结构:1) 核心指标速览(阅读 / 互动 / 转化) 2) 热点舆情摘要 3) 同环比趋势 4) 异动预警 5) 明日关注点。",
    promptTemplate:
      "生成今日数据日报,覆盖核心指标与舆情速览。",
    steps: [
      step(1, "数据指标拉取", "data_report", "数据报告", "data_analysis", "data"),
      step(2, "日报摘要生成", "summary_generate", "摘要生成", "content_gen", "summary"),
      step(3, "日报排版设计", "layout_design", "排版设计", "content_gen", "layout"),
    ],
  },

  {
    slug: "weekly_report",
    name: "周度数据周报",
    description: "按周产出数据周报,含受众分析与多指标趋势对比。",
    icon: "calendar",
    category: "daily_brief",
    ownerEmployeeId: "xiaoshu",
    defaultTeam: ["xiaoshu", "xiaowen", "xiaoce"],
    launchMode: "form",
    inputFields: [
      {
        name: "period",
        label: "数据周期",
        type: "daterange",
        required: true,
      },
      {
        name: "metrics",
        label: "关注指标",
        type: "multiselect",
        required: false,
        options: [
          { value: "reading", label: "阅读" },
          { value: "interaction", label: "互动" },
          { value: "conversion", label: "转化" },
          { value: "sentiment", label: "舆情" },
        ],
      },
    ],
    systemInstruction:
      "针对 {{period}} 产出数据周报,关注指标 {{metrics}}。结构:1) 本周关键数据 2) 受众画像变化 3) Top 稿件 / 话题榜 4) 异动解读 5) 下周行动建议。",
    promptTemplate:
      "针对 {{period}} 产出周报,关注 {{metrics}}。",
    steps: [
      step(1, "周度数据拉取", "data_report", "数据报告", "data_analysis", "data"),
      step(2, "受众画像分析", "audience_analysis", "受众分析", "data_analysis", "audience"),
      step(3, "周报摘要生成", "summary_generate", "摘要生成", "content_gen", "summary"),
      step(4, "周报排版设计", "layout_design", "排版设计", "content_gen", "layout"),
    ],
  },

  {
    slug: "benchmark_analysis",
    name: "同题对标分析",
    description: "围绕指定主题对标竞品账号,输出多维度差距分析。",
    icon: "target",
    category: "analytics",
    ownerEmployeeId: "xiaoshu",
    defaultTeam: ["xiaoshu", "xiaolei", "xiaoce"],
    launchMode: "form",
    inputFields: [
      {
        name: "analysis_topic",
        label: "分析主题",
        type: "text",
        required: true,
        placeholder: "如:AI 新政报道对标",
      },
      {
        name: "competitor_accounts",
        label: "竞品账号",
        type: "textarea",
        required: false,
        placeholder: "一行一个账号,可带平台前缀(weibo: xxx)",
      },
      {
        name: "dimensions",
        label: "分析维度",
        type: "multiselect",
        required: false,
        options: [
          { value: "headline", label: "标题" },
          { value: "cover", label: "配图" },
          { value: "timing", label: "时效" },
          { value: "interaction", label: "互动" },
        ],
      },
    ],
    systemInstruction:
      "围绕「{{analysis_topic}}」对标 {{competitor_accounts}},从 {{dimensions}} 维度分析。输出:1) 对标矩阵表 2) 我方表现评分 3) 差距 Top 3 4) 可复用的优秀做法 5) 改进行动清单。",
    promptTemplate:
      "就「{{analysis_topic}}」对标 {{competitor_accounts}},分析 {{dimensions}}。",
    steps: [
      step(1, "竞品媒资搜索", "media_search", "媒资搜索", "data_collection", "search"),
      step(2, "受众对比分析", "audience_analysis", "受众分析", "data_analysis", "audience"),
      step(3, "热度评分对比", "heat_scoring", "热度评分", "data_analysis", "score"),
      step(4, "对标报告摘要", "summary_generate", "摘要生成", "content_gen", "summary"),
    ],
  },

  // ════════════════════════════════════════════════════════════════════════
  // 公共协作模板 · 5 条（ownerEmployeeId = null）
  // ════════════════════════════════════════════════════════════════════════

  {
    slug: "pub.daily_news_push",
    name: "每日要闻推送",
    description: "每日早晨自动聚合要闻并产出推送稿件，支持一键启动。",
    icon: "rss",
    category: "news",
    ownerEmployeeId: null,
    defaultTeam: ["xiaolei", "xiaozi", "xiaofa"],
    launchMode: "direct",
    inputFields: [],
    systemInstruction:
      "生成今日要闻推送包。流程：1) 扫描全网热榜 2) 多源聚合今日要闻 3) 按重要性排序产出 Top 5~8 条 4) 每条含一句话摘要 / 延伸阅读 / 推荐发布时段。",
    promptTemplate:
      "生成今日要闻推送包，包含 Top 热点 + 摘要 + 发布策略。",
    steps: [
      step(1, "热榜扫描", "trending_topics", "热榜聚合", "data_collection", "fetch"),
      step(2, "要闻聚合", "news_aggregation", "新闻聚合", "data_collection", "aggregate"),
      step(3, "推送稿撰写", "content_generate", "内容生成", "content_gen", "write"),
      step(4, "发布策略规划", "publish_strategy", "发布策略", "distribution", "strategy"),
    ],
  },

  {
    slug: "pub.press_conf_relay",
    name: "发布会直播联动",
    description: "围绕发布会做联动直播 + 快讯 + 长稿 + 短视频 + 海报全链路协同。",
    icon: "calendar-check",
    category: "news",
    ownerEmployeeId: null,
    defaultTeam: ["xiaolei", "xiaoce", "xiaozi", "xiaojian", "xiaofa"],
    launchMode: "form",
    inputFields: [
      {
        name: "conference_name",
        label: "发布会名称",
        type: "text",
        required: true,
        placeholder: "如：华栖云 2026 春季产品发布会",
      },
      {
        name: "go_live_at",
        label: "开播时间",
        type: "date",
        required: true,
      },
      {
        name: "deliverables",
        label: "需要的产物",
        type: "multiselect",
        required: false,
        options: [
          { value: "flash", label: "快讯" },
          { value: "long_form", label: "长稿" },
          { value: "short_video", label: "短视频" },
          { value: "poster", label: "海报" },
        ],
      },
    ],
    systemInstruction:
      "围绕「{{conference_name}}」（{{go_live_at}} 开播）做直播联动。按需产出 {{deliverables}}：快讯（第一时间）/ 长稿（事后深度）/ 短视频（高光混剪）/ 海报（关键信息图）。注意时序协同与文案一致。",
    promptTemplate:
      "为「{{conference_name}}」（{{go_live_at}}）做直播联动，产出 {{deliverables}}。",
    steps: [
      step(1, "发布会背景预研", "web_search", "全网搜索", "web_search", "research"),
      step(2, "联动文案撰写", "content_generate", "内容生成", "content_gen", "write"),
      step(3, "短视频分镜规划", "video_edit_plan", "视频剪辑规划", "av_script", "plan"),
      step(4, "海报排版设计", "layout_design", "排版设计", "content_gen", "layout"),
      step(5, "多平台发布策略", "publish_strategy", "发布策略", "distribution", "strategy"),
    ],
  },

  {
    slug: "pub.viral_video_kit",
    name: "爆款短视频生产",
    description: "爆款公式驱动的短视频生产套件，从选题到分镜一站式。",
    icon: "video",
    category: "video",
    ownerEmployeeId: null,
    defaultTeam: ["xiaoce", "xiaozi", "xiaojian"],
    launchMode: "form",
    inputFields: [
      {
        name: "topic",
        label: "话题",
        type: "text",
        required: true,
        placeholder: "如：AI 新政策 30 秒速看",
      },
      {
        name: "reference_accounts",
        label: "参考账号",
        type: "textarea",
        required: false,
        placeholder: "一行一个，可带平台前缀（douyin: xxx）",
      },
      {
        name: "duration_sec",
        label: "目标时长（秒）",
        type: "number",
        required: false,
        defaultValue: 45,
        validation: { min: 10, max: 120 },
      },
    ],
    systemInstruction:
      "围绕「{{topic}}」生产爆款短视频（目标 {{duration_sec}} 秒）。参考 {{reference_accounts}} 的节奏与钩子。产出：1) 热度洞察 2) 3 版种草脚本（前 3 秒钩子 / 中段高潮 / 结尾引导） 3) 分镜与字幕 4) 封面方向。",
    promptTemplate:
      "为「{{topic}}」生产 {{duration_sec}} 秒爆款短视频，参考 {{reference_accounts}}。",
    steps: [
      step(1, "热点趋势抓取", "trending_topics", "热榜聚合", "data_collection", "fetch"),
      step(2, "种草脚本生成", "zhongcao_script", "种草脚本", "av_script", "script"),
      step(3, "分镜与钩子规划", "video_edit_plan", "视频剪辑规划", "av_script", "plan"),
      step(4, "爆款封面生成", "thumbnail_generate", "封面生成", "content_gen", "thumbnail"),
    ],
  },

  {
    slug: "pub.feature_story_pipeline",
    name: "精品内容（深度大稿）",
    description: "重大热点或指定选题的 6 人协同深度大稿生产，覆盖调研→撰写→核查→合规全链路，发布到 APP 首页精品内容栏目。",
    icon: "pen-tool",
    category: "deep",
    ownerEmployeeId: "xiaowen",
    defaultTeam: ["xiaowen", "xiaolei", "xiaoce", "xiaozi", "xiaoshen", "xiaofa"],
    isFeatured: true,
    launchMode: "form",
    inputFields: [
      {
        name: "feature_topic",
        label: "特稿主题",
        type: "text",
        required: true,
        placeholder: "如：中国芯片产业十年回望",
      },
      {
        name: "background_materials",
        label: "背景资料",
        type: "textarea",
        required: false,
        placeholder: "粘贴已有背景资料、链接或素材要点",
      },
      {
        name: "deadline",
        label: "截稿时间",
        type: "date",
        required: true,
      },
      {
        name: "depth_level",
        label: "深度等级",
        type: "select",
        required: false,
        placeholder: "选择深度等级",
        options: [
          { value: "standard", label: "标准" },
          { value: "deep", label: "深度" },
          { value: "investigative", label: "调查" },
        ],
      },
    ],
    systemInstruction:
      "围绕「{{feature_topic}}」产出 {{depth_level}} 档次特稿，{{deadline}} 前交稿。背景资料：{{background_materials}}。链路：深读→情感→撰写→核查→合规。结构：1) 悬念开篇 2) 事件全景 3) 多方观点 4) 数据支撑 5) 深度洞察。",
    promptTemplate:
      "为「{{feature_topic}}」产出 {{depth_level}} 特稿，{{deadline}} 前完成。",
    steps: [
      step(1, "多源网页深读", "web_deep_read", "网页深读", "web_search", "read"),
      step(2, "情感倾向分析", "sentiment_analysis", "情感分析", "content_analysis", "sentiment"),
      step(3, "特稿正文撰写", "content_generate", "内容生成", "content_gen", "write"),
      step(4, "事实核查", "fact_check", "事实核查", "quality_review", "verify"),
      step(5, "合规审核", "compliance_check", "合规审核", "quality_review", "compliance"),
    ],
  },

  {
    slug: "pub.incident_rapid_response",
    name: "突发应急响应",
    description: "突发事件的快速响应链路，从核实到合规过审一气呵成。",
    icon: "siren",
    category: "news",
    ownerEmployeeId: null,
    defaultTeam: ["xiaolei", "xiaozi", "xiaoshen", "xiaofa"],
    launchMode: "form",
    inputFields: [
      {
        name: "incident_location",
        label: "事件地点",
        type: "text",
        required: true,
        placeholder: "如：四川成都 · 武侯区",
      },
      {
        name: "incident_type",
        label: "事件性质",
        type: "select",
        required: true,
        placeholder: "选择事件性质",
        options: [
          { value: "natural_disaster", label: "自然灾害" },
          { value: "public_health", label: "公共卫生" },
          { value: "social", label: "社会" },
          { value: "transport", label: "交通" },
        ],
      },
      {
        name: "urgent_deliverables",
        label: "急需产物",
        type: "multiselect",
        required: true,
        options: [
          { value: "flash", label: "快讯" },
          { value: "statement", label: "说明" },
          { value: "debunk", label: "辟谣" },
        ],
      },
    ],
    systemInstruction:
      "针对 {{incident_location}} 的 {{incident_type}} 突发事件，快速响应。急需产物：{{urgent_deliverables}}。链路：搜索取证→核查→撰写→合规→分发。强调多源交叉印证与风险提示。",
    promptTemplate:
      "响应 {{incident_location}} 的 {{incident_type}}，产出 {{urgent_deliverables}}。",
    steps: [
      step(1, "多源快速搜索", "web_search", "全网搜索", "web_search", "search"),
      step(2, "关键事实核查", "fact_check", "事实核查", "quality_review", "verify"),
      step(3, "应急稿件撰写", "content_generate", "内容生成", "content_gen", "write"),
      step(4, "合规快扫", "compliance_check", "合规审核", "quality_review", "compliance"),
      step(5, "多平台紧急分发", "publish_strategy", "发布策略", "distribution", "strategy"),
    ],
  },

  // ════════════════════════════════════════════════════════════════════════
  // 主流场景 · 10 条（isFeatured=true，双重归类：owner tab + featured tab）
  // 对应 spec: 2026-04-20-homepage-scenario-tabs-redesign-design.md §5
  // ════════════════════════════════════════════════════════════════════════

  {
    slug: "daily_ai_news",
    name: "每日 AI 资讯",
    description:
      "每日 08:30 自动从热点发现线索模块匹配今日 AI 相关资讯，逐条生成新闻概要后合并成稿，并定时发布到 CMS-APP「每日 AI 资讯」栏目。",
    icon: "sparkles",
    category: "news",
    ownerEmployeeId: "xiaolei",
    defaultTeam: ["xiaolei", "xiaozi", "xiaofa"],
    isFeatured: true,
    launchMode: "form",
    triggerType: "scheduled",
    triggerConfig: { cron: "30 8 * * *", timezone: "Asia/Shanghai" },
    inputFields: [
      {
        name: "focus_subdomain",
        label: "AI 子方向",
        type: "select",
        required: false,
        defaultValue: "all",
        options: [
          { value: "all", label: "全部 AI" },
          { value: "llm", label: "大模型" },
          { value: "agent", label: "智能体" },
          { value: "hardware", label: "AI 硬件" },
          { value: "policy", label: "AI 政策" },
        ],
      },
      {
        name: "item_count",
        label: "条目数",
        type: "number",
        required: false,
        defaultValue: 8,
        validation: { min: 3, max: 20 },
      },
      {
        name: "publish_channel_slug",
        label: "发布栏目",
        type: "select",
        required: false,
        defaultValue: "app_news",
        options: [
          { value: "app_news", label: "APP - 新闻（每日 AI 资讯）" },
          { value: "app_home", label: "APP - 首页" },
        ],
      },
    ],
    systemInstruction:
      "聚焦今日 AI（{{focus_subdomain}}）资讯：① 从热点发现线索模块匹配 AI 相关线索；② 筛选/去重得 Top {{item_count}} 条代表性新闻；③ 每条产出 80-120 字概要（事实 + 影响）；④ 合并为一篇《每日 AI 资讯》稿件（导语 / 分条目列表 / 收尾观察）；⑤ 审核通过后定时发布到 CMS APP 的 {{publish_channel_slug}} 栏目。",
    promptTemplate:
      "从热点线索匹配今日 AI 资讯（聚焦 {{focus_subdomain}}），Top {{item_count}} 条逐条摘要后合并成稿，并定时发布到 {{publish_channel_slug}}。",
    steps: [
      step(1, "AI 热点线索匹配", "trending_topics", "热榜聚合", "data_collection", "match"),
      step(2, "AI 话题筛选去重", "topic_extraction", "选题提取", "data_analysis", "filter"),
      step(3, "多源资讯补全", "news_aggregation", "新闻聚合", "data_collection", "aggregate"),
      step(4, "逐条摘要生成", "summary_generate", "摘要生成", "content_gen", "summary"),
      step(5, "合并成稿", "content_generate", "内容生成", "content_gen", "write"),
      step(6, "定时发布到 APP", "cms_publish", "CMS 文稿入库发布", "distribution", "publish", {
        appChannelSlug: "{{publish_channel_slug}}",
        triggerSource: "scheduled",
      }),
    ],
  },

  {
    slug: "tech_weekly",
    name: "科技周报（深度长文）",
    description: "围绕指定科技主题范围产出一篇深度长文周报，含趋势洞察、数据支撑与多方观点。",
    icon: "newspaper",
    category: "deep",
    ownerEmployeeId: "xiaowen",
    defaultTeam: ["xiaowen", "xiaoce", "xiaozi"],
    isFeatured: true,
    launchMode: "form",
    inputFields: [
      {
        name: "topic_scope",
        label: "主题范围",
        type: "text",
        required: true,
        placeholder: "如：大模型应用 / 半导体产业链 / 机器人产业",
      },
      {
        name: "week_range",
        label: "周期范围",
        type: "daterange",
        required: false,
      },
      {
        name: "word_count",
        label: "目标字数",
        type: "number",
        required: false,
        defaultValue: 4500,
        validation: { min: 2500, max: 10000 },
      },
      {
        name: "depth_level",
        label: "深度档位",
        type: "select",
        required: false,
        defaultValue: "standard",
        options: [
          { value: "light", label: "轻度速览" },
          { value: "standard", label: "标准深度" },
          { value: "heavy", label: "重度研报" },
        ],
      },
    ],
    systemInstruction:
      "产出一篇围绕「{{topic_scope}}」（覆盖周期 {{week_range}}）的科技周报深度长文，目标 {{word_count}} 字，档位 {{depth_level}}。结构：1) 本周关键事件速览 2) 趋势主题归纳（2-3 条）3) 多方观点 4) 数据支撑 5) 下周看点。",
    promptTemplate:
      "写一篇「{{topic_scope}}」科技周报深度长文（{{week_range}}，{{word_count}} 字，{{depth_level}}）。",
    steps: [
      step(1, "主题背景调研", "web_search", "全网搜索", "web_search", "research"),
      step(2, "周度热点聚合", "news_aggregation", "新闻聚合", "data_collection", "aggregate"),
      step(3, "同业对标参考", "case_reference", "案例参考", "other", "case"),
      step(4, "深度周报撰写", "content_generate", "内容生成", "content_gen", "write"),
      step(5, "成稿质量复核", "quality_review", "质量审核", "quality_review", "review"),
    ],
  },

  {
    slug: "daily_politics",
    name: "每日时政热点",
    description: "按区域 / 紧急程度聚合每日时政热点，经事实核查与合规扫描后产出可发布的时政稿件。",
    icon: "landmark",
    category: "news",
    ownerEmployeeId: "xiaolei",
    defaultTeam: ["xiaolei", "xiaowen", "xiaoshen"],
    isFeatured: true,
    launchMode: "form",
    inputFields: [
      {
        name: "region",
        label: "关注区域",
        type: "select",
        required: true,
        defaultValue: "national",
        options: [
          { value: "national", label: "全国" },
          { value: "sichuan", label: "四川" },
          { value: "chengdu", label: "成都" },
          { value: "international", label: "国际" },
        ],
      },
      {
        name: "urgency_level",
        label: "紧急程度",
        type: "select",
        required: false,
        defaultValue: "normal",
        options: [
          { value: "urgent", label: "紧急（优先发布）" },
          { value: "normal", label: "常规" },
        ],
      },
      {
        name: "item_count",
        label: "条目数",
        type: "number",
        required: false,
        defaultValue: 5,
        validation: { min: 1, max: 10 },
      },
    ],
    systemInstruction:
      "产出 {{region}} 区域的每日时政热点（紧急程度 {{urgency_level}}），{{item_count}} 条。每条含：1) 100 字内事实摘要 2) 政策背景一句话 3) 影响与走向。全文必经事实核查与合规扫描。",
    promptTemplate:
      "为 {{region}} 产出 {{item_count}} 条每日时政热点（{{urgency_level}}），含核查与合规。",
    steps: [
      step(1, "时政信源聚合", "news_aggregation", "新闻聚合", "data_collection", "aggregate"),
      step(2, "多源全网搜索", "web_search", "全网搜索", "web_search", "search"),
      step(3, "事实核查", "fact_check", "事实核查", "quality_review", "verify"),
      step(4, "时政稿件撰写", "content_generate", "内容生成", "content_gen", "write"),
      step(5, "合规审查", "compliance_check", "合规审核", "quality_review", "compliance"),
    ],
  },

  {
    slug: "daily_podcast",
    name: "每日热点播客",
    description: "自动锁定今日热点，输出 1-3 集播客脚本（开场 / 主讲 / 互动 / 收尾），可发送至 AIGC 播客加工。",
    icon: "mic",
    category: "podcast",
    ownerEmployeeId: "xiaowen",
    defaultTeam: ["xiaowen", "xiaolei", "xiaojian"],
    isFeatured: true,
    launchMode: "direct",
    inputFields: [],
    systemInstruction:
      "从今日热榜挑选 1-3 个适合播客节奏的选题，每个输出一集播客脚本。结构：开场钩子（30 秒）/ 主讲（6-8 分钟，口语化）/ 互动问答（2-3 个）/ 收尾金句。末尾给出音频节奏建议（BPM / 音乐风格）。",
    promptTemplate:
      "基于今日热榜生成 1-3 集每日热点播客脚本，含 4 段结构与音频节奏建议。",
    steps: [
      step(1, "今日热榜扫描", "trending_topics", "热榜聚合", "data_collection", "fetch"),
      step(2, "选题价值评分", "heat_scoring", "热度评分", "data_analysis", "score"),
      step(3, "播客脚本撰写", "content_generate", "内容生成", "content_gen", "write"),
      step(4, "音频节奏规划", "audio_plan", "音频规划", "av_script", "audio"),
    ],
  },

  {
    slug: "daily_tandian",
    name: "每日探店",
    description: "按城市 + 店型生成 6 阶段探店脚本 + 图文稿件，含广告法合规扫描。",
    icon: "map-pin",
    category: "livelihood",
    ownerEmployeeId: "xiaojian",
    defaultTeam: ["xiaojian", "xiaowen", "xiaoshen"],
    isFeatured: true,
    launchMode: "form",
    inputFields: [
      {
        name: "city",
        label: "城市",
        type: "select",
        required: true,
        defaultValue: "成都",
        options: ["成都", "重庆", "深圳", "广州", "上海", "北京", "杭州", "武汉"],
      },
      {
        name: "shop_type",
        label: "店型",
        type: "select",
        required: true,
        defaultValue: "餐饮",
        options: ["餐饮", "茶饮", "咖啡", "烘焙", "美妆", "亲子", "夜生活"],
      },
      {
        name: "shop_name",
        label: "具体门店",
        type: "text",
        required: false,
        placeholder: "留空则由系统在该城市 × 店型中挑选热门店",
      },
    ],
    systemInstruction:
      "为 {{city}} 的 {{shop_type}}（具体门店：{{shop_name}}）产出「每日探店」。视频脚本必须含 6 阶段：到店 / 环境 / 招牌菜 / 试吃 / 服务 / 回味，每段标注时长与景别。配套图文稿 600-900 字。全文经广告法极限词扫描。",
    promptTemplate:
      "为 {{city}} 的 {{shop_type}}（{{shop_name}}）产出 6 阶段探店脚本 + 图文 + 合规扫描。",
    steps: [
      step(1, "门店信息检索", "web_search", "全网搜索", "web_search", "search"),
      step(2, "本地口碑聚合", "social_listening", "社交舆情", "data_collection", "listen"),
      step(3, "探店脚本生成（6 阶段）", "video_edit_plan", "视频剪辑规划", "av_script", "plan"),
      step(4, "图文稿撰写", "content_generate", "内容生成", "content_gen", "write"),
      step(5, "广告法合规扫描", "compliance_check", "合规审核", "quality_review", "compliance"),
    ],
  },

  {
    slug: "daily_chuanchao",
    name: "每日川超战报",
    description: "通过热点检索匹配近期川超热门比赛，输出赛事简介 / 进球集锦 / 赛前花絮 / 赛后影响的图文新闻。",
    icon: "trophy",
    category: "news",
    ownerEmployeeId: "xiaolei",
    defaultTeam: ["xiaolei", "xiaozi", "xiaowen"],
    isFeatured: true,
    launchMode: "direct",
    inputFields: [],
    systemInstruction:
      "检索近期川超热门比赛（优先最近 3 天），挑选 1-2 场重点赛事。每场产出：1) 赛事简介（对阵 / 比分 / 关键时刻）2) 进球集锦要点（含时间点）3) 赛前准备 / 花絮 4) 赛后影响（积分 / 舆情）。图文可直发体育频道。",
    promptTemplate:
      "检索近期川超热门比赛，产出每日川超战报（4 段结构图文）。",
    steps: [
      step(1, "川超赛事热点扫描", "trending_topics", "热榜聚合", "data_collection", "fetch"),
      step(2, "赛事信息深读", "web_deep_read", "网页深读", "web_search", "crawl"),
      step(3, "同类赛事案例参考", "case_reference", "案例参考", "other", "case"),
      step(4, "战报图文撰写", "content_generate", "内容生成", "content_gen", "write"),
    ],
  },

  {
    slug: "zhongcao_daily",
    name: "种草日更",
    description: "针对指定平台产出种草内容（含广告法极限词扫描），经合规审核后可一键分发到 APP 种草栏目。",
    icon: "sprout",
    category: "social",
    ownerEmployeeId: "xiaowen",
    defaultTeam: ["xiaowen", "xiaoshen", "xiaofa"],
    isFeatured: true,
    launchMode: "form",
    inputFields: [
      {
        name: "platform",
        label: "目标平台",
        type: "select",
        required: true,
        defaultValue: "xiaohongshu",
        options: [
          { value: "xiaohongshu", label: "小红书" },
          { value: "douyin", label: "抖音" },
          { value: "bilibili", label: "B 站" },
          { value: "video_channel", label: "视频号" },
        ],
      },
      {
        name: "product_type",
        label: "种草品类",
        type: "text",
        required: true,
        placeholder: "如：平价彩妆 / 3C 数码 / 儿童图书",
      },
      {
        name: "post_count",
        label: "条目数",
        type: "number",
        required: false,
        defaultValue: 3,
        validation: { min: 1, max: 8 },
      },
    ],
    systemInstruction:
      "为 {{platform}} 产出 {{post_count}} 条关于「{{product_type}}」的种草内容。每条含：1) 钩子标题 2) 3-5 段种草正文（痛点 / 体验 / 对比 / 推荐理由）3) 推荐 tag 4) 发布时段建议。全文经广告法极限词扫描。",
    promptTemplate:
      "为 {{platform}} 产出 {{post_count}} 条「{{product_type}}」种草，含合规扫描与发布策略。",
    steps: [
      step(1, "平台趋势扫描", "trending_topics", "热榜聚合", "data_collection", "fetch"),
      step(2, "种草脚本生成", "zhongcao_script", "种草脚本", "av_script", "script"),
      step(3, "广告法合规扫描", "compliance_check", "合规审核", "quality_review", "compliance"),
      step(4, "发布策略生成", "publish_strategy", "发布策略", "distribution", "strategy"),
    ],
  },

  {
    slug: "local_news",
    name: "本地新闻",
    description: "按本地区域 + 范围匹配全网与内部数据源内容，多篇改写后产出本地新闻稿件。",
    icon: "map",
    category: "news",
    ownerEmployeeId: "xiaoce",
    defaultTeam: ["xiaoce", "xiaolei", "xiaowen"],
    isFeatured: true,
    launchMode: "form",
    inputFields: [
      {
        name: "region",
        label: "本地区域",
        type: "text",
        required: true,
        defaultValue: "成都",
        placeholder: "如：成都 / 成都·武侯区",
      },
      {
        name: "topic_scope",
        label: "新闻范围",
        type: "multiselect",
        required: true,
        options: [
          { value: "food", label: "美食" },
          { value: "travel", label: "旅游" },
          { value: "livelihood", label: "民生" },
          { value: "culture", label: "文化" },
          { value: "transport", label: "交通" },
        ],
      },
      {
        name: "article_count",
        label: "产出条数",
        type: "number",
        required: false,
        defaultValue: 3,
        validation: { min: 1, max: 6 },
      },
    ],
    systemInstruction:
      "围绕 {{region}} 在 {{topic_scope}} 范围的本地新闻，通过全网检索 + 内部数据源匹配素材，产出 {{article_count}} 篇改写稿件。每篇：1) 本地化标题 2) 800-1500 字正文（含本地视角）3) 引用信源标注。",
    promptTemplate:
      "为 {{region}} 产出 {{article_count}} 篇 {{topic_scope}} 范围的本地新闻改写稿。",
    steps: [
      step(1, "本地新闻聚合", "news_aggregation", "新闻聚合", "data_collection", "aggregate"),
      step(2, "全网搜索补充", "web_search", "全网搜索", "web_search", "search"),
      step(3, "多源素材改写", "style_rewrite", "风格改写", "content_gen", "rewrite"),
      step(4, "本地新闻成稿", "content_generate", "内容生成", "content_gen", "write"),
    ],
  },

  {
    slug: "national_hotspot",
    name: "全国热点图文",
    description: "输入关注的热点范围（苏超 / AI 发展 / ...），通过全网检索 + 数据源匹配，多篇内容改写输出全国热点图文。",
    icon: "flame",
    category: "news",
    ownerEmployeeId: "xiaolei",
    defaultTeam: ["xiaolei", "xiaozi", "xiaowen"],
    isFeatured: true,
    launchMode: "form",
    inputFields: [
      {
        name: "topic_range",
        label: "热点范围",
        type: "text",
        required: true,
        placeholder: "如：苏超 / AI 发展 / 新能源政策",
      },
      {
        name: "article_count",
        label: "产出条数",
        type: "number",
        required: false,
        defaultValue: 3,
        validation: { min: 1, max: 6 },
      },
      {
        name: "rewrite_tone",
        label: "改写风格",
        type: "select",
        required: false,
        defaultValue: "news_standard",
        options: [
          { value: "news_standard", label: "标准新闻" },
          { value: "serious", label: "严肃权威" },
          { value: "casual", label: "轻松叙事" },
        ],
      },
    ],
    systemInstruction:
      "围绕「{{topic_range}}」做全网热点匹配（外网检索 + 内部数据源），产出 {{article_count}} 篇 {{rewrite_tone}} 风格的改写稿件，每篇 600-1200 字。含：钩子标题 / 事实回顾 / 多方观点 / 延伸阅读。",
    promptTemplate:
      "为「{{topic_range}}」产出 {{article_count}} 篇全国热点图文（{{rewrite_tone}}）。",
    steps: [
      step(1, "全网热点扫描", "trending_topics", "热榜聚合", "data_collection", "fetch"),
      step(2, "多源新闻聚合", "news_aggregation", "新闻聚合", "data_collection", "aggregate"),
      step(3, "多篇素材改写", "style_rewrite", "风格改写", "content_gen", "rewrite"),
      step(4, "热点图文成稿", "content_generate", "内容生成", "content_gen", "write"),
    ],
  },
];

// ─── Seed input 映射 ──────────────────────────────────────────────────────
// Chunk C：`toBuiltinSeedInput` 现携带新 4 列（isPublic / ownerEmployeeId
// / launchMode / promptTemplate），由 `seedBuiltinTemplatesForOrg` 写入 DB。

/**
 * Map a `BuiltinWorkflowSeed` to `BuiltinSeedInput` shape consumed by
 * `seedBuiltinTemplatesForOrg`. 新 4 列（isPublic / ownerEmployeeId / launchMode
 * / promptTemplate）以原样透传；`isPublic` 默认 true。
 */
function toBuiltinSeedInput(w: BuiltinWorkflowSeed): BuiltinSeedInput {
  return {
    name: w.name,
    description: w.description,
    category: w.category,
    icon: w.icon,
    inputFields: w.inputFields,
    defaultTeam: w.defaultTeam,
    systemInstruction: w.systemInstruction ?? null,
    legacyScenarioKey: w.slug,
    steps: w.steps,
    triggerType: w.triggerType ?? "manual",
    triggerConfig: w.triggerConfig ?? {},
    // 2026-04-20 realignment — 新 4 列
    isPublic: true,
    ownerEmployeeId: w.ownerEmployeeId,
    launchMode: w.launchMode,
    promptTemplate: w.promptTemplate ?? null,
    // 2026-04-20 homepage
    isFeatured: w.isFeatured ?? false,
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

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

/**
 * 汇总 Task 10 + Task 11 的 builtin seeds：
 *   SCENARIO_CONFIG (10) + ADVANCED_SCENARIO_CONFIG (6) + xiaoleiScenarios (5) = 21 条。
 */
export function buildBuiltinScenarioSeeds(): BuiltinSeedInput[] {
  return [
    ...scenarioConfigToSeeds(),
    ...advancedScenarioConfigToSeeds(),
    ...xiaoleiScenariosToSeeds(),
  ];
}

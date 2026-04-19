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

/**
 * 汇总 Task 10 的 builtin seeds：SCENARIO_CONFIG (10) + ADVANCED_SCENARIO_CONFIG (6) = 16 条。
 * Task 11 会在 src/db/seed.ts 里追加 xiaoleiScenarios(5) → 21 条。
 */
export function buildBuiltinScenarioSeeds(): BuiltinSeedInput[] {
  return [
    ...scenarioConfigToSeeds(),
    ...advancedScenarioConfigToSeeds(),
  ];
}

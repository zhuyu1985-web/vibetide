/**
 * 四层重构 (2026-06) — 工具(tool) vs 技能(skill) 的【单一真相源】。
 *
 * - 工具(tool):通用能力,所有 agent 无条件可调(写工具仍受 authority 门控),不归属工种。
 * - 技能(skill):岗位强相关的专业能力,必须经 employee_skills 绑定到某工种才能被该工种 agent
 *   调用(硬边界)。
 *
 * 两处共用本文件,杜绝"两份清单 drift":
 *   1) `scripts/migration-craft-001.ts` 据此回填 `skills.kind` 与 `skills.compatibleRoles`。
 *   2) `src/lib/agent/assembly.ts` 据此在装配期"无条件注入通用工具 + 专业技能硬绑"。
 *
 * 判定规则:换个工种来用、逻辑和产物都一样 → 工具;代表某工种专业判断、换人变味 → 技能。
 *
 * 注:`fact_check` 按已锁定模型示例归为【技能】(owner=reviewer, shared reporter),
 * 不在工具清单内。框架协作工具(send_message/read_messages/create_task/check_progress/
 * kb_search)由 mission 上下文动态注入,不入 skills 表;kb_search 仍列入通用工具白名单,
 * 以便装配期对所有 agent 可用。
 */
import type { CraftType } from "@/lib/constants";

/** 通用读工具:数据获取/检索/可复算分析。确定性,换工种产物不变。 */
export const UNIVERSAL_READ_TOOL_SLUGS = [
  "web_search",
  "web_deep_read",
  "batch_deep_read",
  "trending_topics",
  "trend_monitor",
  "social_listening",
  "news_aggregation",
  "media_search",
  "knowledge_retrieval",
  "kb_search",
  "case_reference",
  "translation",
  "heat_scoring",
  "sentiment_analysis",
  "topic_extraction",
  "topic_classifier",
  "audience_analysis",
  "competitor_analysis",
  "data_pivoter",
  "research_query_builder",
  // 新闻 URL 导入闭环复用能力 (2026-06-26)：视频源抽取 / 稿件结构化分析（读，秒级）
  "video_extract",
  "analyze_article",
] as const;

/** 通用写工具:确定性状态变更。通用(不绑工种),但执行受 authorityLevel 门控。 */
export const UNIVERSAL_WRITE_TOOL_SLUGS = [
  "cms_publish",
  "cms_batch_publish",
  "archive_to_drafts",
  // 通义听悟视频分析（触发付费异步任务，有副作用 → 写）(2026-06-26)
  "tingwu_analyze",
  "cms_catalog_sync",
] as const;

/** 全部通用工具(读 + 写)= skills.kind='tool' 的集合。 */
export const UNIVERSAL_TOOL_SLUGS: readonly string[] = [
  ...UNIVERSAL_READ_TOOL_SLUGS,
  ...UNIVERSAL_WRITE_TOOL_SLUGS,
];

const UNIVERSAL_TOOL_SET = new Set<string>(UNIVERSAL_TOOL_SLUGS);
const UNIVERSAL_WRITE_SET = new Set<string>(UNIVERSAL_WRITE_TOOL_SLUGS);

export function isUniversalTool(slug: string): boolean {
  return UNIVERSAL_TOOL_SET.has(slug);
}

/** 通用写工具 — 需 authority 门控(executor/coordinator 才放行)。 */
export function isUniversalWriteTool(slug: string): boolean {
  return UNIVERSAL_WRITE_SET.has(slug);
}

/**
 * 专业技能 → 工种归属。`core` = 主人工种(不可解绑);`shared` = 可选共享的其他工种。
 * `compatibleRoles` = [core, ...shared]。覆盖全部判为 skill 的能力。
 */
export interface SkillOwnership {
  core: CraftType;
  shared: CraftType[];
}

export const SKILL_OWNER: Record<string, SkillOwnership> = {
  // 编导/策划
  angle_design: { core: "director", shared: ["reporter", "editor"] },
  script_generate: { core: "director", shared: ["post_production"] },
  duanju_script: { core: "director", shared: ["post_production"] },
  zongyi_highlight: { core: "director", shared: ["post_production"] },
  // 记者
  content_generate: { core: "reporter", shared: ["editor", "commentator"] },
  // 编辑
  headline_generate: { core: "editor", shared: ["reporter", "operator"] },
  summary_generate: { core: "editor", shared: ["reporter", "analyst"] },
  style_rewrite: { core: "editor", shared: ["operator"] },
  cross_language_rewrite: { core: "editor", shared: ["operator", "reporter"] },
  // 评论员
  report_drafter: { core: "commentator", shared: ["analyst"] },
  // 后期剪辑
  video_edit_plan: { core: "post_production", shared: ["director"] },
  audio_plan: { core: "post_production", shared: ["anchor"] },
  thumbnail_generate: { core: "post_production", shared: ["operator"] },
  layout_design: { core: "post_production", shared: ["editor"] },
  // 审核
  quality_review: { core: "reviewer", shared: [] },
  compliance_check: { core: "reviewer", shared: [] },
  fact_check: { core: "reviewer", shared: ["reporter"] },
  // 新媒体运营
  channel_rewrite: { core: "operator", shared: ["editor"] },
  tandian_script: { core: "operator", shared: ["director"] },
  zhongcao_script: { core: "operator", shared: [] },
  aigc_script_push: { core: "operator", shared: ["post_production"] },
  publish_strategy: { core: "operator", shared: ["analyst"] },
  // 播报主持
  podcast_script: { core: "anchor", shared: ["director"] },
  // 数据分析
  data_report: { core: "analyst", shared: [] },
  // 编排器
  task_planning: { core: "producer", shared: [] },
};

/** 某技能的兼容工种列表(core 优先),用于回填 skills.compatibleRoles。 */
export function compatibleRolesFor(slug: string): CraftType[] {
  const owner = SKILL_OWNER[slug];
  if (!owner) return [];
  return [owner.core, ...owner.shared];
}

/** 该 slug 是否为专业技能(在归属表内)。 */
export function isProfessionalSkill(slug: string): boolean {
  return slug in SKILL_OWNER;
}

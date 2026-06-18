import type { EmployeeId } from "@/lib/constants";
import type { AuthorityLevel, SkillCategory } from "@/lib/types";

// ---------------------------------------------------------------------------
// Model Configuration
// ---------------------------------------------------------------------------

export type ModelProvider = "openai" | "zhipu";

export interface ModelConfig {
  provider: ModelProvider;
  model: string;
  temperature: number;
  maxTokens: number;
}

// ---------------------------------------------------------------------------
// Agent Tool
// ---------------------------------------------------------------------------

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute?: (args: Record<string, unknown>) => Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Assembled Agent (ready to execute)
// ---------------------------------------------------------------------------

export interface EmployeeMemoryEntry {
  content: string;
  memoryType: string;
  importance: number;
}

export interface AssembledAgent {
  employeeId: string;
  slug: EmployeeId;
  name: string;
  nickname: string;
  title: string;
  systemPrompt: string;
  tools: AgentTool[];
  modelConfig: ModelConfig;
  knowledgeContext: string;
  authorityLevel: AuthorityLevel;
  skillCategories: SkillCategory[];
  memories: EmployeeMemoryEntry[];
  proficiencyLevel: number; // average skill level 0-100
  workPreferences?: {
    proactivity: string;
    reportingFrequency: string;
    autonomyLevel: number;
    communicationStyle: string;
    workingHours: string;
    /** Custom instructions for custom employees — appended to Identity layer */
    customInstructions?: string;
  } | null;
  sensitiveTopics?: string[];
  skillContents?: Record<string, string>;
  pluginConfigs?: Map<string, { description: string; config: {
    endpoint: string;
    method?: "GET" | "POST";
    headers?: Record<string, string>;
    authType?: "none" | "api_key" | "bearer";
    authKey?: string;
    requestTemplate?: string;
    responseMapping?: Record<string, string>;
    timeoutMs?: number;
  } }>;
  /**
   * IDs of knowledge bases bound to this employee.
   * When non-empty, the kb_search tool is auto-injected at execution time.
   */
  knowledgeBaseIds?: string[];

  // ── 四层重构:工种 + 三修饰维度,注入系统提示让产物真正按工种/领域/形态/层级变化 ──
  /** 工种(craft)slug = ai_employees.roleType,用于身份层显式标注工种。 */
  craftType?: string;
  /** 领域标签(时政/财经/法治…),来自 instanceConfig.domainTags → 领域层(改"内容/术语/口径")。 */
  domainTags?: string[];
  /** 领域口径包：专属提示词 → Layer 4.5（有则替代通用模板）。来自 domains.prompt_guidance。 */
  domainGuidance?: string;
  /** 领域权威源域名白名单 → web_search includeDomains。来自 domains.authority_sources。 */
  domainAuthoritySources?: string[];
  /** 媒体形态(news/newmedia/convergence),来自 instanceConfig.mediaForm → 形态层。 */
  mediaForm?: string;
  /** 平台规格,来自 instanceConfig.platformSpecs → 形态层(改"形式/语态/平台")。 */
  platformSpecs?: { channels?: string[]; formatRules?: Record<string, unknown> };
}

// ---------------------------------------------------------------------------
// Step I/O
// ---------------------------------------------------------------------------

export type ArtifactType =
  | "hot_topic_list"
  | "topic_angles"
  | "material_brief"
  | "article_draft"
  | "video_script"
  | "review_report"
  | "publish_plan"
  | "analytics_report"
  | "generic";

export interface StepArtifact {
  id: string;
  type: ArtifactType;
  title: string;
  content: string;
}

export interface StepOutput {
  stepKey: string;
  employeeSlug: EmployeeId;
  summary: string;
  artifacts: StepArtifact[];
  metrics?: {
    qualityScore?: number;
    wordCount?: number;
  };
  status: "success" | "partial" | "needs_approval" | "failed";
  /**
   * Filled by executeAgent when any tool call returned `{ success: false }`.
   * Mission-executor reads this to set the task to "failed" instead of
   * trusting the LLM's text narrative (which may either lie about success
   * or honestly admit failure but still get parsed as "success" by
   * parseStepOutput). Phase 2 of 2026-05-30-tool-context-injection-fix-plan.
   */
  errorMessage?: string;
  errorCode?: string;
  /** 四层重构:本步骤实际"用了什么"——供执行面板渲染工种/技能/工具 chip。 */
  usedSkills?: string[];
  usedTools?: string[];
  // 工具/LLM-skill 真实结果直出场景（mission-executor 短路分支）会把
  // invocation.result 的结构化字段（topics / results / articles 等）spread 进
  // outputData，让下游步骤的 {{stepN.field}} 模板能引用。Index signature 让
  // 这些额外字段在类型层合法。
  [extraField: string]: unknown;
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export interface AgentExecutionInput {
  stepKey: string;
  stepLabel: string;
  scenario: string;
  topicTitle: string;
  previousSteps: StepOutput[];
  userInstructions?: string;
  /**
   * Body of the SKILL.md that this step must execute. When set, it's appended
   * to the agent's system prompt as "必须遵守的当前步骤执行规范" so the LLM
   * follows the skill's workflow checklist + output schema as a hard constraint
   * rather than an "additional instruction" buried in the user message.
   */
  skillSpec?: string;
  /** 当前步骤对应的 skill slug（如 "layout_design"），用于触发 SKILL_MODEL_OVERRIDES */
  skillSlug?: string;
}

export interface AgentExecutionResult {
  output: StepOutput;
  tokensUsed: { input: number; output: number };
  durationMs: number;
  toolCallCount: number;
}

export type ProgressCallback = (progress: {
  percent: number;
  message: string;
}) => void;

// ---------------------------------------------------------------------------
// Intent Recognition (extracted here so client components can import types
// without pulling in server-only modules like skill-loader)
// ---------------------------------------------------------------------------

export type ChatIntentType =
  | "information_retrieval"
  | "content_creation"
  | "deep_analysis"
  | "data_analysis"
  | "content_review"
  | "media_production"
  | "publishing"
  | "general_chat";

export interface IntentStep {
  employeeSlug: EmployeeId;
  employeeName: string;
  skills: string[];
  taskDescription: string;
  dependsOn?: number;
}

export interface IntentResult {
  intentType: ChatIntentType;
  summary: string;
  confidence: number;
  steps: IntentStep[];
  reasoning: string;
  /** If the intent matches a configured workflow, these fields are populated */
  workflowId?: string;
  workflowName?: string;
  executionMode?: "skill" | "workflow";
}

export const INTENT_TYPE_LABELS: Record<ChatIntentType, string> = {
  information_retrieval: "信息检索",
  content_creation: "内容创作",
  deep_analysis: "深度分析",
  data_analysis: "数据分析",
  content_review: "内容审核",
  media_production: "媒体制作",
  publishing: "发布运营",
  general_chat: "自由对话",
};

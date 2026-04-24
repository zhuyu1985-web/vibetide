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
  status: "success" | "partial" | "needs_approval";
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

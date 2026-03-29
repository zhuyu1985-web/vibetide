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

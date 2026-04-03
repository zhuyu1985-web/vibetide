/**
 * Cognitive Engine — shared type definitions.
 * Phase 1: VerifyLearner + basic SkillManager types.
 */

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export type VerificationLevel = "simple" | "important" | "critical";
export type VerifierType = "self_eval" | "cross_review" | "human";

export interface VerificationInput {
  output: string;
  taskTitle: string;
  taskDescription: string;
  expectedOutput?: string;
  employeeId: string;
  employeeSlug: string;
  missionId?: string;
  taskId?: string;
  organizationId: string;
  intentType?: string;
}

export interface VerificationIssue {
  type: "accuracy" | "completeness" | "style" | "compliance";
  description: string;
  severity: "low" | "medium" | "high";
}

export interface GeneratedMemory {
  type: "success_pattern" | "failure_lesson" | "user_preference" | "skill_insight";
  content: string;
  importance: number;
}

export interface VerificationResult {
  passed: boolean;
  qualityScore: number;
  level: VerificationLevel;
  verifierType: VerifierType;
  feedback: string;
  issues: VerificationIssue[];
  memoriesGenerated: GeneratedMemory[];
}

// ---------------------------------------------------------------------------
// Skill Learning
// ---------------------------------------------------------------------------

export interface ProficiencyUpdate {
  employeeId: string;
  skillId: string;
  oldLevel: number;
  newLevel: number;
  reason: string;
}

export interface SkillLearningInput {
  employeeId: string;
  skillIds: string[];
  qualityScore: number;
  passed: boolean;
  taskId?: string;
  organizationId: string;
}

export interface SkillLearningResult {
  proficiencyUpdates: ProficiencyUpdate[];
}

// ---------------------------------------------------------------------------
// Verification Level Determination
// ---------------------------------------------------------------------------

export const VERIFICATION_LEVEL_MAP: Record<string, VerificationLevel> = {
  general_chat: "simple",
  information_retrieval: "simple",
  content_creation: "important",
  deep_analysis: "important",
  data_analysis: "important",
  content_review: "important",
  media_production: "important",
  publishing: "critical",
};

export function determineVerificationLevel(
  intentType?: string,
  isFinalStep?: boolean,
): VerificationLevel {
  if (isFinalStep) return "critical";
  if (!intentType) return "simple";
  return VERIFICATION_LEVEL_MAP[intentType] ?? "simple";
}

import { db } from "@/db";
import { auditRecords } from "@/db/schema/audit";
import { missions } from "@/db/schema/missions";
import { eq, and, desc } from "drizzle-orm";
import { getAuditRules } from "@/lib/dal/audit";
import type { AuditStage, AuditMode, AuditRuleRow } from "@/lib/dal/audit";
import {
  createAuditRecordInternal,
  logTrailEntry,
} from "@/app/actions/audit";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReviewTaskCompletionParams = {
  missionId: string;
  taskId: string;
  organizationId: string;
  /** The text output from the review task (xiaoshen) */
  contentOutput: string;
  /** AI-generated dimension scores, e.g. { factual_accuracy: "90", ... } */
  reviewDimensions: Record<string, string>;
  /** Issues found during the AI review */
  issues: Array<{
    type: string;
    severity: string;
    description: string;
    suggestion?: string;
  }>;
};

export type ReviewTaskCompletionResult = {
  needsHumanReview: boolean;
  auditRecordId: string;
  nextStage: "review_2" | "review_3" | null;
  overallResult: "pass" | "warning" | "fail";
};

// ---------------------------------------------------------------------------
// Stage order
// ---------------------------------------------------------------------------

const STAGE_ORDER: AuditStage[] = ["review_1", "review_2", "review_3"];

// ---------------------------------------------------------------------------
// Main integration function
// ---------------------------------------------------------------------------

/**
 * Called when a mission task assigned to the review employee (xiaoshen) completes.
 * Creates audit records and determines if human review is needed.
 *
 * Flow:
 * 1. Determine current audit stage based on existing audit records for this task
 * 2. Get audit rules for the mission's scenario
 * 3. Create audit_record with AI results
 * 4. Log trail entry
 * 5. Check if human review is needed for this stage
 * 6. Determine next stage if applicable
 */
export async function handleReviewTaskCompletion(
  params: ReviewTaskCompletionParams
): Promise<ReviewTaskCompletionResult> {
  const {
    missionId,
    taskId,
    organizationId,
    contentOutput,
    reviewDimensions,
    issues,
  } = params;

  // ── 1. Determine current audit stage ──────────────────────────────────
  const existingRecords = await db
    .select({ stage: auditRecords.stage })
    .from(auditRecords)
    .where(
      and(
        eq(auditRecords.organizationId, organizationId),
        eq(auditRecords.contentId, taskId),
        eq(auditRecords.contentType, "mission_task")
      )
    )
    .orderBy(desc(auditRecords.createdAt));

  let currentStage: AuditStage;
  if (existingRecords.length === 0) {
    currentStage = "review_1";
  } else {
    const latestStage = existingRecords[0].stage as AuditStage;
    const latestIdx = STAGE_ORDER.indexOf(latestStage);
    if (latestIdx < STAGE_ORDER.length - 1) {
      currentStage = STAGE_ORDER[latestIdx + 1];
    } else {
      // Already at review_3; shouldn't happen, but handle gracefully
      currentStage = "review_3";
    }
  }

  // ── 2. Get audit rules for the mission's scenario ─────────────────────
  const mission = await db.query.missions.findFirst({
    where: eq(missions.id, missionId),
    columns: { scenario: true },
  });

  const rules = await getAuditRules(organizationId, mission?.scenario);
  // Prefer scenario-specific rule; fall back to default
  const rule: AuditRuleRow | undefined =
    rules.find((r) => r.scenarioKey === mission?.scenario) ??
    rules.find((r) => r.isDefault) ??
    rules[0];

  // Mode for the current stage
  const modeForStage = rule
    ? getModeForStage(rule, currentStage)
    : ("auto" as AuditMode);

  // ── 3. Compute overall result from issues ─────────────────────────────
  const overallResult = computeOverallResult(issues);

  // ── 4. Create audit record ────────────────────────────────────────────
  const created = await createAuditRecordInternal({
    organizationId,
    missionId,
    contentType: "mission_task",
    contentId: taskId,
    stage: currentStage,
    mode: modeForStage,
    reviewerType: "ai",
    reviewerId: "xiaoshen",
    dimensions: reviewDimensions as Record<string, unknown>,
    overallResult,
    issues: issues.map((i) => ({
      type: i.type,
      severity: i.severity,
      location: "",
      description: i.description,
      suggestion: i.suggestion ?? "",
    })),
    comment: contentOutput.slice(0, 500), // truncate for comment field
    contentSnapshot: contentOutput,
  });

  const auditRecordId = created.id;

  // ── 5. Log trail entry ────────────────────────────────────────────────
  await logTrailEntry({
    organizationId,
    contentId: taskId,
    contentType: "mission_task",
    operator: "xiaoshen",
    operatorType: "ai",
    action: "review",
    stage: currentStage,
    contentSnapshot: contentOutput,
    comment: `AI 审核完成，结果: ${overallResult}`,
    metadata: {
      auditRecordId,
      overallResult,
      issueCount: issues.length,
      missionId,
    },
  });

  // ── 6. Determine if human review is needed ────────────────────────────
  let needsHumanReview = false;

  if (modeForStage === "human") {
    // Human mode: always requires human review
    needsHumanReview = true;
  } else if (modeForStage === "hybrid") {
    // Hybrid mode: need human if AI found issues
    needsHumanReview = overallResult !== "pass";
  }
  // Auto mode: no human review needed

  // ── 7. Determine next stage ───────────────────────────────────────────
  let nextStage: "review_2" | "review_3" | null = null;

  if (!needsHumanReview && overallResult === "pass") {
    // Auto-pass: check if next stage is configured
    const currentIdx = STAGE_ORDER.indexOf(currentStage);
    if (currentIdx < STAGE_ORDER.length - 1 && rule) {
      const nextStageName = STAGE_ORDER[currentIdx + 1] as
        | "review_2"
        | "review_3";
      const nextMode = getModeForStage(rule, nextStageName);
      // Only proceed to next stage if the rule has a meaningful mode set
      // (i.e. not null — though our schema always has a mode, treat "auto" as optional)
      if (nextMode) {
        nextStage = nextStageName;
      }
    }
  }

  return {
    needsHumanReview,
    auditRecordId,
    nextStage,
    overallResult,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getModeForStage(rule: AuditRuleRow, stage: AuditStage): AuditMode {
  switch (stage) {
    case "review_1":
      return rule.review1Mode;
    case "review_2":
      return rule.review2Mode;
    case "review_3":
      return rule.review3Mode;
    default:
      return "auto";
  }
}

function computeOverallResult(
  issues: Array<{ severity: string }>
): "pass" | "warning" | "fail" {
  if (issues.length === 0) return "pass";

  const hasCritical = issues.some(
    (i) => i.severity === "critical" || i.severity === "error"
  );
  if (hasCritical) return "fail";

  const hasWarning = issues.some(
    (i) => i.severity === "warning" || i.severity === "medium"
  );
  if (hasWarning) return "warning";

  return "pass";
}

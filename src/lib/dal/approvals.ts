import { db } from "@/db";
import {
  workflowSteps,
  workflowInstances,
} from "@/db/schema/workflows";
import { teams } from "@/db/schema/teams";
import { aiEmployees } from "@/db/schema/ai-employees";
import { eq, and, sql, gte, inArray } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PendingApproval {
  stepId: string;
  stepKey: string;
  stepLabel: string;
  workflowInstanceId: string;
  workflowName: string;
  teamId: string | null;
  teamName: string | null;
  employeeSlug: string | null;
  employeeName: string | null;
  employeeNickname: string | null;
  createdAt: string;
  outputPreview: string | null;
}

export interface ApprovalStats {
  pending: number;
  approvedToday: number;
  rejectedToday: number;
  timedOut: number;
}

export interface ApprovalHistoryItem {
  stepId: string;
  stepKey: string;
  stepLabel: string;
  workflowInstanceId: string;
  workflowName: string;
  teamName: string | null;
  employeeSlug: string | null;
  employeeNickname: string | null;
  status: string;
  completedAt: string | null;
  outputPreview: string | null;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Get all workflow steps currently waiting for approval.
 */
export async function getPendingApprovals(
  orgId: string
): Promise<PendingApproval[]> {
  const rows = await db
    .select({
      stepId: workflowSteps.id,
      stepKey: workflowSteps.key,
      stepLabel: workflowSteps.label,
      workflowInstanceId: workflowInstances.id,
      workflowName: workflowInstances.topicTitle,
      teamId: workflowInstances.teamId,
      teamName: teams.name,
      employeeSlug: aiEmployees.slug,
      employeeName: aiEmployees.name,
      employeeNickname: aiEmployees.nickname,
      startedAt: workflowSteps.startedAt,
      output: workflowSteps.output,
    })
    .from(workflowSteps)
    .innerJoin(
      workflowInstances,
      eq(workflowSteps.workflowInstanceId, workflowInstances.id)
    )
    .leftJoin(teams, eq(workflowInstances.teamId, teams.id))
    .leftJoin(aiEmployees, eq(workflowSteps.employeeId, aiEmployees.id))
    .where(eq(workflowSteps.status, "waiting_approval"))
    .orderBy(workflowSteps.startedAt);

  return rows.map((r) => ({
    stepId: r.stepId,
    stepKey: r.stepKey,
    stepLabel: r.stepLabel,
    workflowInstanceId: r.workflowInstanceId,
    workflowName: r.workflowName,
    teamId: r.teamId,
    teamName: r.teamName,
    employeeSlug: r.employeeSlug,
    employeeName: r.employeeName,
    employeeNickname: r.employeeNickname,
    createdAt: r.startedAt?.toISOString() || new Date().toISOString(),
    outputPreview: r.output ? r.output.slice(0, 200) : null,
  }));
}

/**
 * Get approval statistics: pending count, approved today, rejected today, timed out.
 */
export async function getApprovalStats(orgId: string): Promise<ApprovalStats> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Pending count
  const [pendingResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(workflowSteps)
    .where(eq(workflowSteps.status, "waiting_approval"));

  // Approved today (completed steps that were likely approved)
  const [approvedResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(workflowSteps)
    .where(
      and(
        eq(workflowSteps.status, "completed"),
        gte(workflowSteps.completedAt, todayStart)
      )
    );

  // Rejected today (failed steps completed today)
  const [rejectedResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(workflowSteps)
    .where(
      and(
        eq(workflowSteps.status, "failed"),
        gte(workflowSteps.completedAt, todayStart)
      )
    );

  // Timed out: steps that have been waiting_approval for > 24 hours
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [timedOutResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(workflowSteps)
    .where(
      and(
        eq(workflowSteps.status, "waiting_approval"),
        sql`${workflowSteps.startedAt} < ${twentyFourHoursAgo.toISOString()}`
      )
    );

  return {
    pending: pendingResult?.count ?? 0,
    approvedToday: approvedResult?.count ?? 0,
    rejectedToday: rejectedResult?.count ?? 0,
    timedOut: timedOutResult?.count ?? 0,
  };
}

/**
 * Get recent approval history (completed or failed steps).
 */
export async function getApprovalHistory(
  orgId: string,
  limit: number = 20
): Promise<ApprovalHistoryItem[]> {
  const rows = await db
    .select({
      stepId: workflowSteps.id,
      stepKey: workflowSteps.key,
      stepLabel: workflowSteps.label,
      workflowInstanceId: workflowInstances.id,
      workflowName: workflowInstances.topicTitle,
      teamName: teams.name,
      employeeSlug: aiEmployees.slug,
      employeeNickname: aiEmployees.nickname,
      status: workflowSteps.status,
      completedAt: workflowSteps.completedAt,
      output: workflowSteps.output,
    })
    .from(workflowSteps)
    .innerJoin(
      workflowInstances,
      eq(workflowSteps.workflowInstanceId, workflowInstances.id)
    )
    .leftJoin(teams, eq(workflowInstances.teamId, teams.id))
    .leftJoin(aiEmployees, eq(workflowSteps.employeeId, aiEmployees.id))
    .where(
      inArray(workflowSteps.status, ["completed", "failed"])
    )
    .orderBy(sql`${workflowSteps.completedAt} desc nulls last`)
    .limit(limit);

  return rows.map((r) => ({
    stepId: r.stepId,
    stepKey: r.stepKey,
    stepLabel: r.stepLabel,
    workflowInstanceId: r.workflowInstanceId,
    workflowName: r.workflowName,
    teamName: r.teamName,
    employeeSlug: r.employeeSlug,
    employeeNickname: r.employeeNickname,
    status: r.status,
    completedAt: r.completedAt?.toISOString() || null,
    outputPreview: r.output ? r.output.slice(0, 200) : null,
  }));
}

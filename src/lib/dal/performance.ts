import { db } from "@/db";
import { performanceSnapshots } from "@/db/schema/performance-snapshots";
import { aiEmployees } from "@/db/schema/ai-employees";
import { executionLogs } from "@/db/schema/execution-logs";
import { skillUsageRecords } from "@/db/schema/skill-usage-records";
import { userFeedback } from "@/db/schema/user-feedback";
import { teamMembers } from "@/db/schema/teams";
import { workflowInstances, workflowSteps } from "@/db/schema/workflows";
import { eq, and, gte, desc, sql, count, avg } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types for chart data
// ---------------------------------------------------------------------------

export interface PerformanceTrendPoint {
  date: string;
  tasksCompleted: number;
  accuracy: number;
  avgResponseTime: number;
  satisfaction: number;
  qualityAvg: number;
}

export interface TeamMemberComparison {
  name: string;
  nickname: string;
  employeeId: string;
  tasksCompleted: number;
  accuracy: number;
  avgResponseTime: number;
  satisfaction: number;
  efficiencyScore: number;
}

export interface TeamEfficiencyReport {
  totalTasks: number;
  avgQuality: number;
  avgResponseTime: number;
  avgAccuracy: number;
  avgSatisfaction: number;
  activeWorkflows: number;
  completedWorkflows: number;
  completionRate: number;
  memberCount: number;
}

// ---------------------------------------------------------------------------
// M4.F26 - Employee performance trend (time series)
// ---------------------------------------------------------------------------

export async function getPerformanceTrend(
  employeeId: string,
  days: number = 30
): Promise<PerformanceTrendPoint[]> {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);
  const sinceDateStr = sinceDate.toISOString().split("T")[0];

  const rows = await db
    .select({
      snapshotDate: performanceSnapshots.snapshotDate,
      tasksCompleted: performanceSnapshots.tasksCompleted,
      accuracy: performanceSnapshots.accuracy,
      avgResponseTime: performanceSnapshots.avgResponseTime,
      satisfaction: performanceSnapshots.satisfaction,
      qualityAvg: performanceSnapshots.qualityAvg,
    })
    .from(performanceSnapshots)
    .where(
      and(
        eq(performanceSnapshots.employeeId, employeeId),
        gte(performanceSnapshots.snapshotDate, sinceDateStr)
      )
    )
    .orderBy(performanceSnapshots.snapshotDate);

  return rows.map((r) => ({
    date: r.snapshotDate,
    tasksCompleted: r.tasksCompleted ?? 0,
    accuracy: r.accuracy ?? 0,
    avgResponseTime: r.avgResponseTime ?? 0,
    satisfaction: r.satisfaction ?? 0,
    qualityAvg: r.qualityAvg ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// M4.F27 - Team performance comparison (radar chart data)
// ---------------------------------------------------------------------------

export async function getTeamPerformanceComparison(
  teamId: string
): Promise<TeamMemberComparison[]> {
  // Get AI team members for this team
  const members = await db
    .select({
      aiEmployeeId: teamMembers.aiEmployeeId,
    })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.teamId, teamId),
        sql`${teamMembers.aiEmployeeId} IS NOT NULL`
      )
    );

  const result: TeamMemberComparison[] = [];

  for (const member of members) {
    if (!member.aiEmployeeId) continue;

    const emp = await db
      .select({
        name: aiEmployees.name,
        nickname: aiEmployees.nickname,
        tasksCompleted: aiEmployees.tasksCompleted,
        accuracy: aiEmployees.accuracy,
        avgResponseTime: aiEmployees.avgResponseTime,
        satisfaction: aiEmployees.satisfaction,
      })
      .from(aiEmployees)
      .where(eq(aiEmployees.id, member.aiEmployeeId))
      .limit(1);

    if (emp.length === 0) continue;

    const e = emp[0];
    // Parse avgResponseTime string like "2.5s" to a number
    const responseTimeNum = parseFloat(e.avgResponseTime.replace(/[^0-9.]/g, "")) || 0;

    // Compute an efficiency score (0-100) as a composite metric
    // Higher tasks, accuracy, satisfaction = better; lower response time = better
    const efficiencyScore = Math.min(
      100,
      Math.round(
        e.accuracy * 0.3 +
        e.satisfaction * 0.3 +
        Math.max(0, 100 - responseTimeNum * 10) * 0.2 +
        Math.min(100, e.tasksCompleted) * 0.2
      )
    );

    result.push({
      name: e.name,
      nickname: e.nickname,
      employeeId: member.aiEmployeeId,
      tasksCompleted: e.tasksCompleted,
      accuracy: e.accuracy,
      avgResponseTime: responseTimeNum,
      satisfaction: e.satisfaction,
      efficiencyScore,
    });
  }

  // Sort by efficiency score descending
  result.sort((a, b) => b.efficiencyScore - a.efficiencyScore);

  return result;
}

// ---------------------------------------------------------------------------
// M4.F65 - Team efficiency report (comprehensive stats)
// ---------------------------------------------------------------------------

export async function getTeamEfficiencyReport(
  teamId: string
): Promise<TeamEfficiencyReport> {
  // Get all AI members' stats
  const comparison = await getTeamPerformanceComparison(teamId);
  const memberCount = comparison.length;

  const totalTasks = comparison.reduce((sum, m) => sum + m.tasksCompleted, 0);
  const avgAccuracy =
    memberCount > 0
      ? comparison.reduce((sum, m) => sum + m.accuracy, 0) / memberCount
      : 0;
  const avgSatisfaction =
    memberCount > 0
      ? comparison.reduce((sum, m) => sum + m.satisfaction, 0) / memberCount
      : 0;
  const avgResponseTime =
    memberCount > 0
      ? comparison.reduce((sum, m) => sum + m.avgResponseTime, 0) / memberCount
      : 0;
  const avgQuality =
    memberCount > 0
      ? comparison.reduce((sum, m) => sum + m.efficiencyScore, 0) / memberCount
      : 0;

  // Workflow stats for this team
  const workflowRows = await db
    .select({
      status: workflowInstances.status,
      cnt: count(),
    })
    .from(workflowInstances)
    .where(eq(workflowInstances.teamId, teamId))
    .groupBy(workflowInstances.status);

  let activeWorkflows = 0;
  let completedWorkflows = 0;
  let totalWorkflows = 0;

  for (const row of workflowRows) {
    const c = Number(row.cnt);
    totalWorkflows += c;
    if (row.status === "active") activeWorkflows = c;
    if (row.status === "completed") completedWorkflows = c;
  }

  const completionRate =
    totalWorkflows > 0
      ? Math.round((completedWorkflows / totalWorkflows) * 100)
      : 0;

  return {
    totalTasks,
    avgQuality: Math.round(avgQuality * 10) / 10,
    avgResponseTime: Math.round(avgResponseTime * 10) / 10,
    avgAccuracy: Math.round(avgAccuracy * 10) / 10,
    avgSatisfaction: Math.round(avgSatisfaction * 10) / 10,
    activeWorkflows,
    completedWorkflows,
    completionRate,
    memberCount,
  };
}

// ---------------------------------------------------------------------------
// Compute performance metrics from execution data
// ---------------------------------------------------------------------------

export async function computePerformanceFromExecutionData(
  employeeId: string
): Promise<{
  accuracy: number;
  avgResponseTime: string;
  satisfaction: number;
  qualityAvg: number;
}> {
  // 1. From executionLogs: success rate → accuracy, avg duration → avgResponseTime
  const logStats = await db
    .select({
      totalLogs: count(),
      successLogs: sql<number>`count(*) filter (where ${executionLogs.status} = 'success')`,
      avgDuration: avg(executionLogs.durationMs),
    })
    .from(executionLogs)
    .where(eq(executionLogs.employeeId, employeeId));

  const totalLogs = logStats[0]?.totalLogs ?? 0;
  const successLogs = Number(logStats[0]?.successLogs ?? 0);
  const avgDurationMs = Number(logStats[0]?.avgDuration ?? 0);

  // 2. From skillUsageRecords: avg qualityScore → qualityAvg
  const qualityStats = await db
    .select({
      avgQuality: avg(skillUsageRecords.qualityScore),
    })
    .from(skillUsageRecords)
    .where(eq(skillUsageRecords.employeeId, employeeId));

  const qualityAvg = Number(qualityStats[0]?.avgQuality ?? 0);

  // 3. From userFeedback: accept rate → satisfaction
  const feedbackStats = await db
    .select({
      totalFeedback: count(),
      accepts: sql<number>`count(*) filter (where ${userFeedback.feedbackType} = 'accept')`,
    })
    .from(userFeedback)
    .where(eq(userFeedback.employeeId, employeeId));

  const totalFeedback = feedbackStats[0]?.totalFeedback ?? 0;
  const accepts = Number(feedbackStats[0]?.accepts ?? 0);

  const accuracy = totalLogs > 0 ? Math.round((successLogs / totalLogs) * 100) : 0;
  const avgResponseTimeSec = avgDurationMs > 0 ? (avgDurationMs / 1000).toFixed(1) : "0";
  const satisfaction = totalFeedback > 0 ? Math.round((accepts / totalFeedback) * 100) : 0;

  // Update the employee record with computed values if we have data
  if (totalLogs > 0 || totalFeedback > 0) {
    await db
      .update(aiEmployees)
      .set({
        accuracy: accuracy || undefined,
        avgResponseTime: `${avgResponseTimeSec}s`,
        satisfaction: satisfaction || undefined,
        updatedAt: new Date(),
      })
      .where(eq(aiEmployees.id, employeeId));
  }

  return {
    accuracy,
    avgResponseTime: `${avgResponseTimeSec}s`,
    satisfaction,
    qualityAvg: Math.round(qualityAvg * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// Snapshot helper (for cron / server action)
// ---------------------------------------------------------------------------

export async function snapshotPerformance(employeeId: string): Promise<void> {
  // First, compute metrics from real execution data
  const computed = await computePerformanceFromExecutionData(employeeId);

  const emp = await db
    .select({
      tasksCompleted: aiEmployees.tasksCompleted,
      accuracy: aiEmployees.accuracy,
      avgResponseTime: aiEmployees.avgResponseTime,
      satisfaction: aiEmployees.satisfaction,
    })
    .from(aiEmployees)
    .where(eq(aiEmployees.id, employeeId))
    .limit(1);

  if (emp.length === 0) return;

  const e = emp[0];
  const today = new Date().toISOString().split("T")[0];
  const responseTimeNum = parseFloat(e.avgResponseTime.replace(/[^0-9.]/g, "")) || 0;

  // Upsert: delete existing snapshot for today then insert
  await db
    .delete(performanceSnapshots)
    .where(
      and(
        eq(performanceSnapshots.employeeId, employeeId),
        eq(performanceSnapshots.snapshotDate, today)
      )
    );

  await db.insert(performanceSnapshots).values({
    employeeId,
    snapshotDate: today,
    tasksCompleted: e.tasksCompleted,
    accuracy: e.accuracy,
    avgResponseTime: responseTimeNum,
    satisfaction: e.satisfaction,
    qualityAvg: computed.qualityAvg || Math.round(((e.accuracy + e.satisfaction) / 2) * 10) / 10,
  });
}

export async function snapshotAllPerformance(): Promise<number> {
  const employees = await db
    .select({ id: aiEmployees.id })
    .from(aiEmployees);

  for (const emp of employees) {
    await snapshotPerformance(emp.id);
  }

  return employees.length;
}

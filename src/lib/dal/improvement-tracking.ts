import { db } from "@/db";
import { improvementTrackings } from "@/db/schema/improvement-tracking";
import { eq, desc, sql } from "drizzle-orm";

export interface ImprovementTrackingItem {
  id: string;
  suggestionSource: string;
  suggestion: string;
  adoptedAt: string | null;
  baselineMetrics: Record<string, number> | null;
  currentMetrics: Record<string, number> | null;
  effectScore: number | null;
  status: string;
  trackUntil: string | null;
  createdAt: string;
}

/**
 * List improvement trackings, optionally filtered by status.
 */
export async function getImprovementTrackings(
  orgId: string,
  status?: string
): Promise<ImprovementTrackingItem[]> {
  const whereCondition = status
    ? sql`${improvementTrackings.organizationId} = ${orgId} AND ${improvementTrackings.status} = ${status}`
    : eq(improvementTrackings.organizationId, orgId);

  const rows = await db
    .select()
    .from(improvementTrackings)
    .where(whereCondition)
    .orderBy(desc(improvementTrackings.createdAt));

  return rows.map((r) => ({
    id: r.id,
    suggestionSource: r.suggestionSource || "unknown",
    suggestion: r.suggestion,
    adoptedAt: r.adoptedAt?.toISOString() || null,
    baselineMetrics: (r.baselineMetrics as Record<string, number>) || null,
    currentMetrics: (r.currentMetrics as Record<string, number>) || null,
    effectScore: r.effectScore,
    status: r.status || "pending",
    trackUntil: r.trackUntil?.toISOString() || null,
    createdAt: r.createdAt.toISOString(),
  }));
}

/**
 * Aggregate improvement effects for the organization.
 */
export async function getTrackingEffects(orgId: string) {
  const rows = await db
    .select({
      status: improvementTrackings.status,
      count: sql<number>`count(*)::int`,
      avgEffect: sql<number>`coalesce(avg(${improvementTrackings.effectScore}), 0)::real`,
    })
    .from(improvementTrackings)
    .where(eq(improvementTrackings.organizationId, orgId))
    .groupBy(improvementTrackings.status);

  const statusLabels: Record<string, string> = {
    pending: "待采纳",
    adopted: "已采纳",
    tracking: "效果追踪中",
    completed: "已完成",
  };

  const totalCount = rows.reduce((sum, r) => sum + r.count, 0);
  const adoptedCount = rows
    .filter((r) => r.status !== "pending")
    .reduce((sum, r) => sum + r.count, 0);

  return {
    statusDistribution: rows.map((r) => ({
      status: r.status || "pending",
      label: statusLabels[r.status || "pending"] || r.status || "pending",
      count: r.count,
      avgEffect: Math.round(r.avgEffect * 100) / 100,
    })),
    totalCount,
    adoptedCount,
    adoptionRate:
      totalCount > 0 ? Math.round((adoptedCount / totalCount) * 100) : 0,
    avgEffectScore:
      Math.round(
        (rows
          .filter((r) => r.status === "completed")
          .reduce((sum, r) => sum + r.avgEffect, 0) /
          Math.max(
            1,
            rows.filter((r) => r.status === "completed").length
          )) *
          100
      ) / 100,
  };
}

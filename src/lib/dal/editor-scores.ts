import { db } from "@/db";
import { editorScores, pointTransactions } from "@/db/schema/editor-scores";
import { eq, and, desc, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EditorScoreItem {
  id: string;
  userId: string;
  userName: string;
  totalPoints: number;
  level: number;
  achievements: Array<{ name: string; icon: string; earnedAt: string }>;
  monthlyPoints: number;
  weeklyPoints: number;
}

export interface PointTransactionItem {
  id: string;
  userId: string;
  points: number;
  reason: string;
  referenceId: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// getEditorLeaderboard — 排行榜 (M3.F29)
// ---------------------------------------------------------------------------

export async function getEditorLeaderboard(
  orgId: string,
  period: "weekly" | "monthly" | "all" = "all"
): Promise<EditorScoreItem[]> {
  const pointsColumn =
    period === "weekly"
      ? editorScores.weeklyPoints
      : period === "monthly"
      ? editorScores.monthlyPoints
      : editorScores.totalPoints;

  const rows = await db
    .select()
    .from(editorScores)
    .where(eq(editorScores.organizationId, orgId))
    .orderBy(desc(pointsColumn));

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    userName: r.userName,
    totalPoints: r.totalPoints ?? 0,
    level: r.level ?? 1,
    achievements: (r.achievements as Array<{ name: string; icon: string; earnedAt: string }>) || [],
    monthlyPoints: r.monthlyPoints ?? 0,
    weeklyPoints: r.weeklyPoints ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// getEditorScore — 单个编辑的积分详情 (M3.F29)
// ---------------------------------------------------------------------------

export async function getEditorScore(
  userId: string,
  orgId: string
): Promise<EditorScoreItem | null> {
  const row = await db
    .select()
    .from(editorScores)
    .where(
      and(
        eq(editorScores.userId, userId),
        eq(editorScores.organizationId, orgId)
      )
    )
    .limit(1);

  if (row.length === 0) return null;

  const r = row[0];
  return {
    id: r.id,
    userId: r.userId,
    userName: r.userName,
    totalPoints: r.totalPoints ?? 0,
    level: r.level ?? 1,
    achievements: (r.achievements as Array<{ name: string; icon: string; earnedAt: string }>) || [],
    monthlyPoints: r.monthlyPoints ?? 0,
    weeklyPoints: r.weeklyPoints ?? 0,
  };
}

// ---------------------------------------------------------------------------
// getPointTransactions — 积分变动历史 (M3.F29)
// ---------------------------------------------------------------------------

export async function getPointTransactions(
  userId: string,
  orgId: string,
  limit = 20
): Promise<PointTransactionItem[]> {
  const rows = await db
    .select()
    .from(pointTransactions)
    .where(
      and(
        eq(pointTransactions.userId, userId),
        eq(pointTransactions.organizationId, orgId)
      )
    )
    .orderBy(desc(pointTransactions.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    points: r.points,
    reason: r.reason,
    referenceId: r.referenceId,
    createdAt: r.createdAt?.toISOString() ?? new Date().toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// awardPoints — 发放积分 (M3.F29)
// ---------------------------------------------------------------------------

export async function awardPoints(
  userId: string,
  orgId: string,
  userName: string,
  points: number,
  reason: string,
  referenceId?: string
) {
  // Insert transaction record
  await db.insert(pointTransactions).values({
    organizationId: orgId,
    userId,
    points,
    reason,
    referenceId: referenceId || null,
  });

  // Upsert editor score
  const existing = await db
    .select()
    .from(editorScores)
    .where(
      and(
        eq(editorScores.userId, userId),
        eq(editorScores.organizationId, orgId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(editorScores)
      .set({
        totalPoints: sql`${editorScores.totalPoints} + ${points}`,
        monthlyPoints: sql`${editorScores.monthlyPoints} + ${points}`,
        weeklyPoints: sql`${editorScores.weeklyPoints} + ${points}`,
        level: sql`GREATEST(1, (${editorScores.totalPoints} + ${points}) / 100 + 1)`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(editorScores.userId, userId),
          eq(editorScores.organizationId, orgId)
        )
      );
  } else {
    await db.insert(editorScores).values({
      organizationId: orgId,
      userId,
      userName,
      totalPoints: points,
      monthlyPoints: points,
      weeklyPoints: points,
      level: Math.max(1, Math.floor(points / 100) + 1),
    });
  }
}

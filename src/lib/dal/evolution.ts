import { db } from "@/db";
import {
  userFeedback,
  effectAttributions,
} from "@/db/schema/user-feedback";
import { aiEmployees } from "@/db/schema/ai-employees";
import { employeeMemories } from "@/db/schema/employee-memories";
import { eq, and, desc, sql, gte, count } from "drizzle-orm";
import { getCurrentUserOrg } from "./auth";

// ---------------------------------------------------------------------------
// M4.F144 — Feedback stats for an employee
// ---------------------------------------------------------------------------

export async function getUserFeedbackStats(
  employeeId: string,
  orgId: string
): Promise<{
  accepts: number;
  rejects: number;
  edits: number;
  rate: number;
}> {
  const rows = await db
    .select({
      feedbackType: userFeedback.feedbackType,
      cnt: count(),
    })
    .from(userFeedback)
    .where(
      and(
        eq(userFeedback.employeeId, employeeId),
        eq(userFeedback.organizationId, orgId)
      )
    )
    .groupBy(userFeedback.feedbackType);

  let accepts = 0;
  let rejects = 0;
  let edits = 0;

  for (const r of rows) {
    if (r.feedbackType === "accept") accepts = r.cnt;
    else if (r.feedbackType === "reject") rejects = r.cnt;
    else if (r.feedbackType === "edit") edits = r.cnt;
  }

  const total = accepts + rejects + edits;
  const rate = total > 0 ? Math.round((accepts / total) * 100) : 0;

  return { accepts, rejects, edits, rate };
}

// ---------------------------------------------------------------------------
// M4.F148 — Learned patterns with confidence
// ---------------------------------------------------------------------------

export async function getLearnedPatterns(
  employeeId: string
): Promise<
  Array<{
    key: string;
    count: number;
    lastSeen: string;
    source: string;
    confidence: "high" | "medium" | "low";
  }>
> {
  // employeeId here is the DB uuid
  const emp = await db.query.aiEmployees.findFirst({
    where: eq(aiEmployees.id, employeeId),
    columns: { learnedPatterns: true },
  });

  if (!emp || !emp.learnedPatterns) return [];

  const patterns = emp.learnedPatterns as Record<
    string,
    { source: string; count: number; lastSeen: string }
  >;

  return Object.entries(patterns).map(([key, val]) => ({
    key,
    count: val.count,
    lastSeen: val.lastSeen,
    source: val.source,
    confidence:
      val.count >= 5 ? "high" : val.count >= 3 ? "medium" : "low",
  }));
}

// ---------------------------------------------------------------------------
// M4.F146 — Effect attributions for an employee
// ---------------------------------------------------------------------------

export async function getEffectAttributions(
  employeeId: string,
  orgId: string,
  limit = 20
): Promise<
  Array<{
    id: string;
    reach: Record<string, number> | null;
    engagement: Record<string, number> | null;
    qualityScore: Record<string, number> | null;
    attributedAt: string;
  }>
> {
  const rows = await db
    .select()
    .from(effectAttributions)
    .where(
      and(
        eq(effectAttributions.employeeId, employeeId),
        eq(effectAttributions.organizationId, orgId)
      )
    )
    .orderBy(desc(effectAttributions.attributedAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    reach: r.reach as Record<string, number> | null,
    engagement: r.engagement as Record<string, number> | null,
    qualityScore: r.qualityScore as Record<string, number> | null,
    attributedAt: r.attributedAt?.toISOString() ?? "",
  }));
}

// ---------------------------------------------------------------------------
// M4.F151 — Evolution curve data
// ---------------------------------------------------------------------------

export async function getEvolutionCurve(
  employeeId: string,
  days: number
): Promise<
  Array<{ date: string; memories: number; patterns: number; acceptRate: number }>
> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  // 1. Memory count per day (cumulative-ish: count created <= each date)
  const memoryRows = await db
    .select({
      day: sql<string>`to_char(${employeeMemories.createdAt}, 'YYYY-MM-DD')`,
      cnt: count(),
    })
    .from(employeeMemories)
    .where(
      and(
        eq(employeeMemories.employeeId, employeeId),
        gte(employeeMemories.createdAt, since)
      )
    )
    .groupBy(sql`to_char(${employeeMemories.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${employeeMemories.createdAt}, 'YYYY-MM-DD')`);

  // 2. Feedback acceptance rate per day
  const feedbackRows = await db
    .select({
      day: sql<string>`to_char(${userFeedback.createdAt}, 'YYYY-MM-DD')`,
      feedbackType: userFeedback.feedbackType,
      cnt: count(),
    })
    .from(userFeedback)
    .where(
      and(
        eq(userFeedback.employeeId, employeeId),
        gte(userFeedback.createdAt, since)
      )
    )
    .groupBy(
      sql`to_char(${userFeedback.createdAt}, 'YYYY-MM-DD')`,
      userFeedback.feedbackType
    )
    .orderBy(sql`to_char(${userFeedback.createdAt}, 'YYYY-MM-DD')`);

  // 3. Learned patterns count — snapshot (we only have current state)
  const emp = await db.query.aiEmployees.findFirst({
    where: eq(aiEmployees.id, employeeId),
    columns: { learnedPatterns: true },
  });
  const currentPatternCount = emp?.learnedPatterns
    ? Object.keys(
        emp.learnedPatterns as Record<string, unknown>
      ).length
    : 0;

  // Build date series
  const dateMap = new Map<
    string,
    { memories: number; accepts: number; total: number }
  >();

  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const key = d.toISOString().slice(0, 10);
    dateMap.set(key, { memories: 0, accepts: 0, total: 0 });
  }

  for (const r of memoryRows) {
    const entry = dateMap.get(r.day);
    if (entry) entry.memories = r.cnt;
  }

  for (const r of feedbackRows) {
    const entry = dateMap.get(r.day);
    if (entry) {
      entry.total += r.cnt;
      if (r.feedbackType === "accept") entry.accepts += r.cnt;
    }
  }

  // Convert to cumulative memories & running acceptance rate
  let cumulativeMemories = 0;
  const result: Array<{
    date: string;
    memories: number;
    patterns: number;
    acceptRate: number;
  }> = [];

  for (const [date, v] of dateMap) {
    cumulativeMemories += v.memories;
    const acceptRate = v.total > 0 ? Math.round((v.accepts / v.total) * 100) : 0;
    result.push({
      date,
      memories: cumulativeMemories,
      patterns: currentPatternCount, // snapshot — same for all dates
      acceptRate,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Feedback history
// ---------------------------------------------------------------------------

export async function getFeedbackHistory(
  employeeId: string,
  orgId: string,
  limit = 20
): Promise<
  Array<{
    id: string;
    feedbackType: "accept" | "reject" | "edit";
    originalContent: string | null;
    editedContent: string | null;
    createdAt: string;
  }>
> {
  const rows = await db
    .select()
    .from(userFeedback)
    .where(
      and(
        eq(userFeedback.employeeId, employeeId),
        eq(userFeedback.organizationId, orgId)
      )
    )
    .orderBy(desc(userFeedback.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    feedbackType: r.feedbackType,
    originalContent: r.originalContent,
    editedContent: r.editedContent,
    createdAt: r.createdAt?.toISOString() ?? "",
  }));
}

import { db } from "@/db";
import { advisorCompareTests, advisorAbTests } from "@/db/schema/advisor-tests";
import { eq, desc, and } from "drizzle-orm";

export async function getCompareTests(orgId: string, limit = 20) {
  const rows = await db
    .select()
    .from(advisorCompareTests)
    .where(eq(advisorCompareTests.organizationId, orgId))
    .orderBy(desc(advisorCompareTests.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    testInput: r.testInput,
    advisorIds: r.advisorIds as string[],
    results: r.results as
      | {
          advisorId: string;
          advisorName: string;
          output: string;
          responseTime: number;
          tokenCount: number;
        }[]
      | null,
    selectedWinner: r.selectedWinner,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getAbTests(orgId: string, status?: string) {
  const conditions = [eq(advisorAbTests.organizationId, orgId)];
  if (status) {
    conditions.push(eq(advisorAbTests.status, status));
  }

  const rows = await db
    .select()
    .from(advisorAbTests)
    .where(and(...conditions))
    .orderBy(desc(advisorAbTests.createdAt));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    advisorAId: r.advisorAId,
    advisorBId: r.advisorBId,
    configDiff: r.configDiff as Record<string, unknown> | null,
    status: r.status as "active" | "paused" | "completed",
    metrics: r.metrics as {
      a: { views: number; engagement: number; quality: number };
      b: { views: number; engagement: number; quality: number };
    } | null,
    sampleSize: r.sampleSize as { a: number; b: number } | null,
    winner: r.winner as "a" | "b" | null,
    confidence: r.confidence,
    startedAt: r.startedAt?.toISOString() ?? "",
    endedAt: r.endedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getAbTest(id: string) {
  const rows = await db
    .select()
    .from(advisorAbTests)
    .where(eq(advisorAbTests.id, id))
    .limit(1);

  const r = rows[0];
  if (!r) return undefined;

  return {
    id: r.id,
    name: r.name,
    advisorAId: r.advisorAId,
    advisorBId: r.advisorBId,
    configDiff: r.configDiff as Record<string, unknown> | null,
    status: r.status as "active" | "paused" | "completed",
    metrics: r.metrics as {
      a: { views: number; engagement: number; quality: number };
      b: { views: number; engagement: number; quality: number };
    } | null,
    sampleSize: r.sampleSize as { a: number; b: number } | null,
    winner: r.winner as "a" | "b" | null,
    confidence: r.confidence,
    startedAt: r.startedAt?.toISOString() ?? "",
    endedAt: r.endedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

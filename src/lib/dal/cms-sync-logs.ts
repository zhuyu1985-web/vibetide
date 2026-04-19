import { db } from "@/db";
import { cmsSyncLogs } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export interface StartSyncLogInput {
  triggerSource?: "manual" | "scheduled" | "auto_repair" | "first_time_setup";
  operatorId?: string;
}

export async function startCmsSyncLog(
  organizationId: string,
  input: StartSyncLogInput = {},
): Promise<string> {
  const [row] = await db
    .insert(cmsSyncLogs)
    .values({
      organizationId,
      state: "running",
      triggerSource: input.triggerSource ?? "manual",
      operatorId: input.operatorId ?? null,
      startedAt: new Date(),
    })
    .returning({ id: cmsSyncLogs.id });
  return row.id;
}

export async function completeCmsSyncLog(
  id: string,
  payload: { stats: Record<string, number>; warnings: string[] },
): Promise<void> {
  const now = new Date();
  const existing = await getSyncLogById(id);
  const duration = existing ? now.getTime() - existing.startedAt.getTime() : 0;

  await db
    .update(cmsSyncLogs)
    .set({
      state: "done",
      stats: payload.stats,
      warnings: payload.warnings,
      completedAt: now,
      durationMs: duration,
    })
    .where(eq(cmsSyncLogs.id, id));
}

export async function failCmsSyncLog(id: string, errorMessage: string): Promise<void> {
  const now = new Date();
  const existing = await getSyncLogById(id);
  const duration = existing ? now.getTime() - existing.startedAt.getTime() : 0;

  await db
    .update(cmsSyncLogs)
    .set({
      state: "failed",
      errorMessage,
      completedAt: now,
      durationMs: duration,
    })
    .where(eq(cmsSyncLogs.id, id));
}

export async function getSyncLogById(id: string) {
  const row = await db.query.cmsSyncLogs.findFirst({ where: eq(cmsSyncLogs.id, id) });
  return row ?? null;
}

export async function listRecentSyncLogs(
  organizationId: string,
  options: { limit?: number } = {},
) {
  return await db.query.cmsSyncLogs.findMany({
    where: eq(cmsSyncLogs.organizationId, organizationId),
    orderBy: [desc(cmsSyncLogs.startedAt)],
    limit: options.limit ?? 20,
  });
}

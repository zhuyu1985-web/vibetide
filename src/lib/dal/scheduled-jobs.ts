/**
 * DAL — scheduled_jobs 表读操作(平台级,不分 org)。
 */
import { db } from "@/db";
import { scheduledJobs, type ScheduledJob } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export async function listScheduledJobs(): Promise<ScheduledJob[]> {
  return db
    .select()
    .from(scheduledJobs)
    .orderBy(asc(scheduledJobs.category), asc(scheduledJobs.displayName));
}

export async function getScheduledJobById(id: string): Promise<ScheduledJob | null> {
  const [row] = await db
    .select()
    .from(scheduledJobs)
    .where(eq(scheduledJobs.id, id))
    .limit(1);
  return row ?? null;
}

export async function getScheduledJobByName(name: string): Promise<ScheduledJob | null> {
  const [row] = await db
    .select()
    .from(scheduledJobs)
    .where(eq(scheduledJobs.name, name))
    .limit(1);
  return row ?? null;
}

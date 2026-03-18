"use server";

import { db } from "@/db";
import { batchJobs, batchItems, conversionTasks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function createBatchJob(data: {
  organizationId: string;
  goalDescription: string;
  items: {
    topicTitle: string;
    channel?: string;
    format?: string;
  }[];
  scheduledAt?: Date;
}) {
  await requireAuth();

  const [job] = await db
    .insert(batchJobs)
    .values({
      organizationId: data.organizationId,
      goalDescription: data.goalDescription,
      totalItems: data.items.length,
      scheduledAt: data.scheduledAt,
    })
    .returning();

  for (const item of data.items) {
    await db.insert(batchItems).values({
      batchJobId: job.id,
      topicTitle: item.topicTitle,
      channel: item.channel,
      format: item.format,
    });
  }

  revalidatePath("/video-batch");
  return job;
}

export async function updateBatchItemStatus(
  itemId: string,
  status: "pending" | "processing" | "done" | "failed",
  outputUrl?: string
) {
  await requireAuth();

  await db
    .update(batchItems)
    .set({ status, outputUrl: outputUrl || null })
    .where(eq(batchItems.id, itemId));

  // Update parent job's completed count
  const item = await db.query.batchItems.findFirst({
    where: eq(batchItems.id, itemId),
  });

  if (item && status === "done") {
    const job = await db.query.batchJobs.findFirst({
      where: eq(batchJobs.id, item.batchJobId),
      with: { items: true },
    });

    if (job) {
      const completedCount = job.items.filter((i) => i.status === "done").length;
      await db
        .update(batchJobs)
        .set({
          completedItems: completedCount,
          status: completedCount >= job.totalItems ? "completed" : "processing",
          updatedAt: new Date(),
        })
        .where(eq(batchJobs.id, job.id));
    }
  }

  revalidatePath("/video-batch");
}

export async function createConversionTask(data: {
  organizationId: string;
  sourceRatio: string;
  targetRatio: string;
  settings?: Record<string, unknown>;
  batchItemId?: string;
}) {
  await requireAuth();

  const [task] = await db
    .insert(conversionTasks)
    .values(data)
    .returning();

  revalidatePath("/video-batch");
  return task;
}

export async function updateConversionTaskStatus(
  taskId: string,
  status: "pending" | "processing" | "done" | "failed"
) {
  await requireAuth();

  await db
    .update(conversionTasks)
    .set({ status })
    .where(eq(conversionTasks.id, taskId));

  revalidatePath("/video-batch");
}

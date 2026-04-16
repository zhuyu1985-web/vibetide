"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { researchTasks } from "@/db/schema/research/research-tasks";
import { eq, and } from "drizzle-orm";
import { requirePermission, PERMISSIONS } from "@/lib/rbac";
import { inngest } from "@/inngest/client";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  timeRangeStart: z.string().datetime(),
  timeRangeEnd: z.string().datetime(),
  topicIds: z.array(z.string().uuid()).min(1),
  districtIds: z.array(z.string().uuid()).default([]),
  mediaTiers: z
    .array(z.enum(["central", "provincial_municipal", "industry", "district_media"]))
    .min(1),
  customUrls: z.array(z.string().url()).default([]),
  semanticEnabled: z.boolean().default(true),
  semanticThreshold: z.number().min(0.5).max(0.95).default(0.72),
  dedupLevel: z.enum(["keyword", "district", "both"]).default("district"),
});

export async function createResearchTask(
  input: z.infer<typeof createSchema>,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const { userId, organizationId } = await requirePermission(
      PERMISSIONS.RESEARCH_TASK_CREATE,
    );
    const data = createSchema.parse(input);

    const [task] = await db
      .insert(researchTasks)
      .values({
        organizationId,
        userId,
        name: data.name,
        timeRangeStart: new Date(data.timeRangeStart),
        timeRangeEnd: new Date(data.timeRangeEnd),
        topicIds: data.topicIds,
        districtIds: data.districtIds,
        mediaTiers: data.mediaTiers,
        customUrls: data.customUrls,
        semanticEnabled: data.semanticEnabled,
        semanticThreshold: String(data.semanticThreshold),
        dedupLevel: data.dedupLevel,
        status: "pending",
      })
      .returning({ id: researchTasks.id });

    await inngest.send({
      name: "research/task.submitted",
      data: { taskId: task.id },
    });

    revalidatePath("/research/admin/tasks");
    return { ok: true, id: task.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function cancelResearchTask(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const { organizationId } = await requirePermission(
      PERMISSIONS.RESEARCH_TASK_CREATE,
    );
    await db
      .update(researchTasks)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(researchTasks.id, id),
          eq(researchTasks.organizationId, organizationId),
        ),
      );

    await inngest.send({
      name: "research/task.cancelled",
      data: { taskId: id },
    });

    revalidatePath("/research/admin/tasks");
    revalidatePath(`/research/admin/tasks/${id}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

"use server";

import { db } from "@/db";
import { workflowInstances, workflowSteps } from "@/db/schema";
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

export async function createWorkflowInstance(data: {
  teamId?: string;
  templateId?: string;
  topicTitle: string;
  topicId?: string;
  estimatedCompletion?: string;
  steps: {
    key: string;
    label: string;
    employeeId?: string;
    stepOrder: number;
  }[];
}) {
  await requireAuth();

  const [instance] = await db
    .insert(workflowInstances)
    .values({
      teamId: data.teamId,
      templateId: data.templateId,
      topicTitle: data.topicTitle,
      topicId: data.topicId,
      estimatedCompletion: data.estimatedCompletion
        ? new Date(data.estimatedCompletion)
        : null,
    })
    .returning();

  for (const step of data.steps) {
    await db.insert(workflowSteps).values({
      workflowInstanceId: instance.id,
      key: step.key,
      label: step.label,
      employeeId: step.employeeId,
      stepOrder: step.stepOrder,
    });
  }

  revalidatePath("/team-hub");
  return instance;
}

export async function updateWorkflowStepStatus(
  stepId: string,
  status: "completed" | "active" | "pending" | "skipped" | "waiting_approval" | "failed",
  progress: number,
  output?: string
) {
  await requireAuth();

  const updates: Record<string, unknown> = { status, progress };
  if (output) updates.output = output;
  if (status === "active" && !updates.startedAt) {
    updates.startedAt = new Date();
  }
  if (status === "completed") {
    updates.completedAt = new Date();
  }

  await db
    .update(workflowSteps)
    .set(updates)
    .where(eq(workflowSteps.id, stepId));

  revalidatePath("/team-hub");
}

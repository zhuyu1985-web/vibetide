"use server";

import { db } from "@/db";
import { workflowInstances, workflowSteps, workflowTemplates, aiEmployees } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { inngest } from "@/inngest/client";
import { parseUserIntent } from "@/lib/agent";

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

/**
 * Start a new workflow: creates DB records then triggers Inngest execution.
 * When autoPlanning is true, uses AI intent parser to determine optimal steps.
 */
export async function startWorkflow(data: {
  topicTitle: string;
  scenario: string;
  teamId: string;
  templateId?: string;
  organizationId: string;
  autoPlanning?: boolean;
  steps?: {
    key: string;
    label: string;
    employeeId?: string;
    stepOrder: number;
  }[];
}) {
  await requireAuth();

  let steps = data.steps || [];

  // Auto-planning: use AI intent parser to determine steps
  if (data.autoPlanning && steps.length === 0) {
    const employees = await db
      .select({
        slug: aiEmployees.slug,
        name: aiEmployees.name,
        title: aiEmployees.title,
        id: aiEmployees.id,
      })
      .from(aiEmployees)
      .where(eq(aiEmployees.organizationId, data.organizationId));

    const intent = await parseUserIntent(
      data.topicTitle,
      data.scenario,
      employees.map((e) => ({ slug: e.slug, name: e.name, title: e.title }))
    );

    steps = intent.suggestedSteps.map((s, i) => {
      const emp = employees.find((e) => e.slug === s.employeeSlug);
      return {
        key: s.key,
        label: s.label,
        employeeId: emp?.id,
        stepOrder: i + 1,
      };
    });
  }

  // 1. Create workflow instance
  const [instance] = await db
    .insert(workflowInstances)
    .values({
      teamId: data.teamId,
      templateId: data.templateId,
      topicTitle: data.topicTitle,
      status: "active",
    })
    .returning();

  // 2. Create steps
  for (const step of steps) {
    await db.insert(workflowSteps).values({
      workflowInstanceId: instance.id,
      key: step.key,
      label: step.label,
      employeeId: step.employeeId,
      stepOrder: step.stepOrder,
    });
  }

  // 3. Trigger Inngest workflow
  await inngest.send({
    name: "workflow/started",
    data: {
      workflowInstanceId: instance.id,
      teamId: data.teamId,
      organizationId: data.organizationId,
      topicTitle: data.topicTitle,
      scenario: data.scenario,
    },
  });

  revalidatePath("/team-hub");
  return instance;
}

/**
 * Approve or reject a workflow step that is waiting for approval.
 */
export async function approveWorkflowStep(data: {
  workflowInstanceId: string;
  stepId: string;
  approved: boolean;
  feedback?: string;
}) {
  const user = await requireAuth();

  await inngest.send({
    name: "workflow/step-approved",
    data: {
      workflowInstanceId: data.workflowInstanceId,
      stepId: data.stepId,
      approved: data.approved,
      feedback: data.feedback,
      approvedBy: user.id,
    },
  });

  revalidatePath("/team-hub");
}

/**
 * F4.S.05: Batch approve/reject multiple workflow steps at once.
 */
export async function batchApproveWorkflowSteps(data: {
  items: {
    workflowInstanceId: string;
    stepId: string;
    approved: boolean;
    feedback?: string;
  }[];
}) {
  const user = await requireAuth();

  for (const item of data.items) {
    await inngest.send({
      name: "workflow/step-approved",
      data: {
        workflowInstanceId: item.workflowInstanceId,
        stepId: item.stepId,
        approved: item.approved,
        feedback: item.feedback,
        approvedBy: user.id,
      },
    });
  }

  revalidatePath("/team-hub");
}

/**
 * Cancel a running workflow.
 */
export async function cancelWorkflow(workflowInstanceId: string) {
  const user = await requireAuth();

  // Update DB status immediately
  await db
    .update(workflowInstances)
    .set({
      status: "cancelled",
      completedAt: new Date(),
    })
    .where(eq(workflowInstances.id, workflowInstanceId));

  // Send cancel event to Inngest
  await inngest.send({
    name: "workflow/cancelled",
    data: {
      workflowInstanceId,
      cancelledBy: user.id,
    },
  });

  revalidatePath("/team-hub");
}

/**
 * Create a custom workflow template.
 */
export async function createWorkflowTemplate(data: {
  organizationId: string;
  name: string;
  description?: string;
  steps: { key: string; label: string; employeeSlug: string; order: number }[];
}) {
  await requireAuth();

  const [template] = await db
    .insert(workflowTemplates)
    .values({
      organizationId: data.organizationId,
      name: data.name,
      description: data.description,
      steps: data.steps,
    })
    .returning();

  revalidatePath("/team-hub");
  revalidatePath("/team-builder");
  return template;
}

/**
 * Update an existing workflow template.
 */
export async function updateWorkflowTemplate(
  templateId: string,
  data: {
    name?: string;
    description?: string;
    steps?: { key: string; label: string; employeeSlug: string; order: number }[];
  }
) {
  await requireAuth();

  await db
    .update(workflowTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(workflowTemplates.id, templateId));

  revalidatePath("/team-hub");
  revalidatePath("/team-builder");
}

/**
 * Delete a workflow template.
 */
export async function deleteWorkflowTemplate(templateId: string) {
  await requireAuth();

  await db.delete(workflowTemplates).where(eq(workflowTemplates.id, templateId));

  revalidatePath("/team-hub");
  revalidatePath("/team-builder");
}

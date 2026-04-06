"use server";

import { db } from "@/db";
import { workflowTemplates, aiEmployees } from "@/db/schema";
import type { WorkflowStepDef } from "@/db/schema/workflows";
import { eq, and, sql } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { startMission } from "@/app/actions/missions";

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

// ─── Legacy CRUD (kept for backward compatibility) ───

/**
 * Create a custom workflow template.
 */
export async function createWorkflowTemplate(data: {
  organizationId: string;
  name: string;
  description?: string;
  steps: WorkflowStepDef[];
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

  revalidatePath("/missions");
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
    steps?: WorkflowStepDef[];
  }
) {
  await requireAuth();

  await db
    .update(workflowTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(workflowTemplates.id, templateId));

  revalidatePath("/missions");
}

/**
 * Delete a workflow template.
 */
export async function deleteWorkflowTemplate(templateId: string) {
  await requireAuth();

  await db
    .delete(workflowTemplates)
    .where(eq(workflowTemplates.id, templateId));

  revalidatePath("/missions");
}

// ─── New Workflow Actions ───

/**
 * Create a user copy from a builtin template.
 * The new workflow is non-builtin and owned by the current user.
 */
export async function createWorkflowFromTemplate(templateId: string) {
  const user = await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("用户未关联组织");

  const template = await db.query.workflowTemplates.findFirst({
    where: eq(workflowTemplates.id, templateId),
  });
  if (!template) throw new Error("模板不存在");

  const [newWorkflow] = await db
    .insert(workflowTemplates)
    .values({
      organizationId: orgId,
      name: `${template.name}（副本）`,
      description: template.description,
      steps: template.steps,
      category: template.category,
      triggerType: template.triggerType ?? "manual",
      triggerConfig: template.triggerConfig,
      isBuiltin: false,
      isEnabled: false,
      createdBy: user.id,
    })
    .returning();

  revalidatePath("/workflows");
  return newWorkflow;
}

/**
 * Save a new custom workflow template.
 */
export async function saveWorkflow(data: {
  name: string;
  description?: string;
  category?: "news" | "video" | "analytics" | "distribution" | "custom";
  triggerType?: "manual" | "scheduled";
  triggerConfig?: { cron?: string; timezone?: string } | null;
  steps: WorkflowStepDef[];
}) {
  const user = await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("用户未关联组织");

  const [workflow] = await db
    .insert(workflowTemplates)
    .values({
      organizationId: orgId,
      name: data.name,
      description: data.description,
      steps: data.steps,
      category: data.category ?? "custom",
      triggerType: data.triggerType ?? "manual",
      triggerConfig: data.triggerConfig ?? null,
      isBuiltin: false,
      isEnabled: false,
      createdBy: user.id,
    })
    .returning();

  revalidatePath("/workflows");
  return workflow;
}

/**
 * Update an existing non-builtin workflow.
 */
export async function updateWorkflow(
  id: string,
  data: {
    name?: string;
    description?: string;
    category?: "news" | "video" | "analytics" | "distribution" | "custom";
    triggerType?: "manual" | "scheduled";
    triggerConfig?: { cron?: string; timezone?: string } | null;
    steps?: WorkflowStepDef[];
  }
) {
  await requireAuth();

  // Verify the workflow exists and is not builtin
  const existing = await db.query.workflowTemplates.findFirst({
    where: eq(workflowTemplates.id, id),
  });
  if (!existing) throw new Error("工作流不存在");
  if (existing.isBuiltin) throw new Error("内置工作流不可修改");

  await db
    .update(workflowTemplates)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(workflowTemplates.id, id));

  revalidatePath("/workflows");
}

/**
 * Delete a non-builtin workflow.
 */
export async function deleteWorkflow(id: string) {
  await requireAuth();

  const existing = await db.query.workflowTemplates.findFirst({
    where: eq(workflowTemplates.id, id),
  });
  if (!existing) throw new Error("工作流不存在");
  if (existing.isBuiltin) throw new Error("内置工作流不可删除");

  await db.delete(workflowTemplates).where(eq(workflowTemplates.id, id));

  revalidatePath("/workflows");
}

/**
 * Toggle the isEnabled flag on a workflow.
 */
export async function toggleWorkflowEnabled(id: string, enabled: boolean) {
  await requireAuth();

  await db
    .update(workflowTemplates)
    .set({ isEnabled: enabled, updatedAt: new Date() })
    .where(eq(workflowTemplates.id, id));

  revalidatePath("/workflows");
}

/**
 * Execute a workflow by creating a Mission from its template steps.
 *
 * Flow:
 * 1. Load the workflow template
 * 2. Resolve employee nicknames for each step
 * 3. Build a userInstruction describing the workflow
 * 4. Call startMission() to create and execute the mission
 * 5. Update workflow run stats (lastRunAt, runCount)
 * 6. Return the created mission ID
 */
export async function executeWorkflow(id: string) {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("用户未关联组织");

  // 1. Load workflow template
  const workflow = await db.query.workflowTemplates.findFirst({
    where: eq(workflowTemplates.id, id),
  });
  if (!workflow) throw new Error("工作流不存在");

  // 2. Resolve employee nicknames for instruction text
  const steps = workflow.steps as WorkflowStepDef[];
  const employeeSlugs = [
    ...new Set(
      steps
        .map((s) => s.config?.employeeSlug ?? s.employeeSlug)
        .filter((slug): slug is string => !!slug)
    ),
  ];

  const nicknameMap = new Map<string, string>();
  if (employeeSlugs.length > 0) {
    const employees = await db
      .select({ slug: aiEmployees.slug, nickname: aiEmployees.nickname })
      .from(aiEmployees)
      .where(eq(aiEmployees.organizationId, orgId));
    for (const emp of employees) {
      nicknameMap.set(emp.slug, emp.nickname);
    }
  }

  // 3. Build structured instruction
  const stepDescriptions = steps
    .sort((a, b) => a.order - b.order)
    .map((step, idx) => {
      const slug = step.config?.employeeSlug ?? step.employeeSlug;
      const nickname = slug ? nicknameMap.get(slug) ?? slug : "自动分配";
      return `${idx + 1}. ${step.name} — ${nickname}`;
    })
    .join("\n");

  const userInstruction = `请按照以下工作流执行：\n${stepDescriptions}${
    workflow.description ? `\n\n工作流说明：${workflow.description}` : ""
  }`;

  // 4. Create mission via startMission
  const mission = await startMission({
    title: workflow.name,
    scenario: "custom",
    userInstruction,
  });

  // 5. Update workflow run stats
  await db
    .update(workflowTemplates)
    .set({
      lastRunAt: new Date(),
      runCount: sql`${workflowTemplates.runCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(workflowTemplates.id, id));

  // 6. Revalidate both pages
  revalidatePath("/workflows");
  revalidatePath("/missions");

  return mission.id;
}

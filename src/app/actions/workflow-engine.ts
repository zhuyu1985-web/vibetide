"use server";

import { db } from "@/db";
import { workflowTemplates } from "@/db/schema";
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
    steps?: { key: string; label: string; employeeSlug: string; order: number }[];
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

  await db.delete(workflowTemplates).where(eq(workflowTemplates.id, templateId));

  revalidatePath("/missions");
}

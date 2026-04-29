"use server";

import { db } from "@/db";
import { productionTemplates } from "@/db/schema/production-templates";
import type {
  TemplateStructure,
  TemplateVariable,
} from "@/db/schema/production-templates";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { revalidatePath } from "next/cache";
/**
 * Create a new production template.
 */
export async function createProductionTemplate(data: {
  name: string;
  description?: string;
  category?: string;
  structure: TemplateStructure;
  variables?: TemplateVariable[];
}) {
  const user = await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("No organization");

  const [row] = await db
    .insert(productionTemplates)
    .values({
      organizationId: orgId,
      name: data.name,
      description: data.description || null,
      category: data.category || null,
      structure: data.structure,
      variables: data.variables || [],
      createdBy: user.id,
    })
    .returning();

  revalidatePath("/production-templates");
  return row;
}

/**
 * Update an existing production template.
 */
export async function updateProductionTemplate(
  id: string,
  data: {
    name?: string;
    description?: string;
    category?: string;
    structure?: TemplateStructure;
    variables?: TemplateVariable[];
  }
) {
  await requireAuth();

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  };
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.category !== undefined) updates.category = data.category;
  if (data.structure !== undefined) updates.structure = data.structure;
  if (data.variables !== undefined) updates.variables = data.variables;

  await db
    .update(productionTemplates)
    .set(updates)
    .where(eq(productionTemplates.id, id));

  revalidatePath("/production-templates");
}

/**
 * Delete a production template.
 */
export async function deleteProductionTemplate(id: string) {
  await requireAuth();

  await db
    .delete(productionTemplates)
    .where(eq(productionTemplates.id, id));

  revalidatePath("/production-templates");
}

/**
 * Apply a production template with variables, returning the generated structure.
 * Increments the usage count.
 */
export async function applyProductionTemplate(
  templateId: string,
  variables: Record<string, string>
) {
  await requireAuth();

  const templateRows = await db
    .select()
    .from(productionTemplates)
    .where(eq(productionTemplates.id, templateId))
    .limit(1);

  const template = templateRows[0];

  if (!template) throw new Error("Template not found");

  // Increment usage count
  await db
    .update(productionTemplates)
    .set({
      usageCount: sql`${productionTemplates.usageCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(productionTemplates.id, templateId));

  // Apply variable substitution to the template structure
  const structure = template.structure as TemplateStructure;
  const appliedSections = structure.sections.map((section) => {
    let prompt = section.prompt;
    let title = section.title;

    // Replace {{variableName}} with actual values
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      prompt = prompt.replace(regex, value);
      title = title.replace(regex, value);
    }

    return {
      ...section,
      title,
      prompt,
    };
  });

  revalidatePath("/production-templates");

  return {
    templateId,
    templateName: template.name,
    sections: appliedSections,
    mediaTypes: structure.mediaTypes,
    targetChannels: structure.targetChannels,
    variables,
  };
}

"use server";

import { db } from "@/db";
import { tagSchemas } from "@/db/schema/tag-schemas";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { revalidatePath } from "next/cache";
export async function createTagSchema(data: {
  name: string;
  category: string;
  description?: string;
  options?: { value: string; label: string }[];
}) {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("No organization");

  const [schema] = await db
    .insert(tagSchemas)
    .values({
      organizationId: orgId,
      name: data.name,
      category: data.category,
      description: data.description || null,
      options: data.options || [],
      isCustom: true,
      isActive: true,
    })
    .returning();

  revalidatePath("/asset-intelligence");
  return { id: schema.id };
}

export async function updateTagSchema(
  id: string,
  data: {
    name?: string;
    category?: string;
    description?: string;
    options?: { value: string; label: string }[];
    isActive?: boolean;
  }
) {
  await requireAuth();

  await db
    .update(tagSchemas)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(tagSchemas.id, id));

  revalidatePath("/asset-intelligence");
}

export async function deleteTagSchema(id: string) {
  await requireAuth();
  // Soft delete: set isActive = false
  await db
    .update(tagSchemas)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(tagSchemas.id, id));

  revalidatePath("/asset-intelligence");
}

export async function reorderTagSchemas(ids: string[]) {
  await requireAuth();

  for (let i = 0; i < ids.length; i++) {
    await db
      .update(tagSchemas)
      .set({ sortOrder: i, updatedAt: new Date() })
      .where(eq(tagSchemas.id, ids[i]));
  }

  revalidatePath("/asset-intelligence");
}

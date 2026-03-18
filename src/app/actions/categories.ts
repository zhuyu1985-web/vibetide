"use server";

import { db } from "@/db";
import { categories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function createCategory(data: {
  organizationId: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  level?: number;
  sortOrder?: number;
}) {
  await requireAuth();
  const [cat] = await db.insert(categories).values(data).returning();
  revalidatePath("/categories");
  return { categoryId: cat.id };
}

export async function updateCategory(categoryId: string, data: {
  name?: string;
  slug?: string;
  description?: string;
  parentId?: string | null;
  sortOrder?: number;
}) {
  await requireAuth();
  await db.update(categories).set({ ...data, updatedAt: new Date() }).where(eq(categories.id, categoryId));
  revalidatePath("/categories");
}

export async function deleteCategory(categoryId: string) {
  await requireAuth();
  await db.update(categories).set({ isActive: false, updatedAt: new Date() }).where(eq(categories.id, categoryId));
  revalidatePath("/categories");
}

export async function reorderCategories(orderedIds: { id: string; sortOrder: number }[]) {
  await requireAuth();
  for (const item of orderedIds) {
    await db.update(categories).set({ sortOrder: item.sortOrder, updatedAt: new Date() }).where(eq(categories.id, item.id));
  }
  revalidatePath("/categories");
}

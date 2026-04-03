"use server";

import { db } from "@/db";
import { categories, mediaAssets, categoryPermissions } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { revalidatePath } from "next/cache";
import { getCategoryPermissions, getOrgUsers } from "@/lib/dal/assets";
import type { CategoryPermissionType, PermissionGranteeType } from "@/lib/types";

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

async function requireAuthWithOrg() {
  await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) throw new Error("No organization found");
  return orgId;
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

// ── Media category actions (scope = "media") ──────────────────────

export async function createMediaCategory(data: {
  name: string;
  parentId?: string;
}) {
  const orgId = await requireAuthWithOrg();

  // Compute level from parent
  let level = 0;
  if (data.parentId) {
    const parent = await db.query.categories.findFirst({
      where: eq(categories.id, data.parentId),
      columns: { level: true },
    });
    if (parent) level = parent.level + 1;
  }

  // Auto-generate slug from name + timestamp
  const slug = `media-${Date.now()}`;

  // Get max sortOrder among siblings
  const siblings = await db.query.categories.findMany({
    where: and(
      eq(categories.organizationId, orgId),
      eq(categories.scope, "media"),
      eq(categories.isActive, true),
      data.parentId
        ? eq(categories.parentId, data.parentId)
        : eq(categories.level, 0),
    ),
    columns: { sortOrder: true },
  });
  const maxSort = siblings.reduce((m, s) => Math.max(m, s.sortOrder), -1);

  const [cat] = await db.insert(categories).values({
    organizationId: orgId,
    name: data.name,
    slug,
    scope: "media",
    parentId: data.parentId || null,
    level,
    sortOrder: maxSort + 1,
  }).returning();

  revalidatePath("/media-assets");
  return { categoryId: cat.id };
}

export async function renameMediaCategory(categoryId: string, newName: string) {
  await requireAuthWithOrg();
  await db.update(categories).set({
    name: newName,
    updatedAt: new Date(),
  }).where(eq(categories.id, categoryId));
  revalidatePath("/media-assets");
}

export async function deleteMediaCategory(categoryId: string) {
  const orgId = await requireAuthWithOrg();

  // Check for children
  const children = await db.query.categories.findMany({
    where: and(
      eq(categories.parentId, categoryId),
      eq(categories.isActive, true),
    ),
    columns: { id: true },
  });
  if (children.length > 0) {
    return { error: "该栏目下有子栏目，无法删除" };
  }

  // Check for assets
  const [assetCount] = await db
    .select({ value: count() })
    .from(mediaAssets)
    .where(and(
      eq(mediaAssets.categoryId, categoryId),
      eq(mediaAssets.isDeleted, false),
    ));
  if (assetCount.value > 0) {
    return { error: "该栏目下有资源，无法删除" };
  }

  await db.update(categories).set({
    isActive: false,
    updatedAt: new Date(),
  }).where(eq(categories.id, categoryId));

  revalidatePath("/media-assets");
  return { success: true };
}

// ── Category Permission Actions ──────────────────────

export async function setCategoryPermission(data: {
  categoryId: string;
  granteeType: PermissionGranteeType;
  granteeId: string;
  permissionType: CategoryPermissionType;
  inherited?: boolean;
}) {
  const orgId = await requireAuthWithOrg();
  const user = await requireAuth();

  // Upsert: insert or update on conflict
  await db
    .insert(categoryPermissions)
    .values({
      organizationId: orgId,
      categoryId: data.categoryId,
      granteeType: data.granteeType,
      granteeId: data.granteeId,
      permissionType: data.permissionType,
      inherited: data.inherited ?? true,
      createdBy: user.id,
    })
    .onConflictDoUpdate({
      target: [
        categoryPermissions.categoryId,
        categoryPermissions.granteeType,
        categoryPermissions.granteeId,
        categoryPermissions.permissionType,
      ],
      set: {
        inherited: data.inherited ?? true,
        updatedAt: new Date(),
      },
    });

  revalidatePath("/media-assets");
}

export async function removeCategoryPermission(permissionId: string) {
  await requireAuthWithOrg();
  await db.delete(categoryPermissions).where(eq(categoryPermissions.id, permissionId));
  revalidatePath("/media-assets");
}

export async function batchSetCategoryPermissions(
  categoryId: string,
  permissions: {
    granteeType: PermissionGranteeType;
    granteeId: string;
    permissionType: CategoryPermissionType;
  }[],
) {
  const orgId = await requireAuthWithOrg();
  const user = await requireAuth();

  // Remove existing permissions for this category
  await db.delete(categoryPermissions).where(
    eq(categoryPermissions.categoryId, categoryId),
  );

  // Insert new ones
  if (permissions.length > 0) {
    await db.insert(categoryPermissions).values(
      permissions.map((p) => ({
        organizationId: orgId,
        categoryId,
        granteeType: p.granteeType,
        granteeId: p.granteeId,
        permissionType: p.permissionType,
        inherited: true,
        createdBy: user.id,
      })),
    );
  }

  revalidatePath("/media-assets");
}

// ── Fetch actions (callable from client) ──────────────────────

export async function fetchCategoryPermissions(categoryId: string) {
  await requireAuth();
  return getCategoryPermissions(categoryId);
}

export async function fetchOrgUsers() {
  await requireAuth();
  return getOrgUsers();
}

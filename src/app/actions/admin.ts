"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import {
  organizations,
  userProfiles,
  roles,
  userRoles,
} from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import { requirePermission, PERMISSIONS } from "@/lib/rbac";
import { hashPassword } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Organization CRUD
// ---------------------------------------------------------------------------

export async function createOrganization(data: {
  name: string;
  slug: string;
}) {
  await requirePermission(PERMISSIONS.SYSTEM_MANAGE_ORGS);

  const [org] = await db
    .insert(organizations)
    .values({ name: data.name, slug: data.slug })
    .returning();

  revalidatePath("/admin/organizations");
  return { id: org.id };
}

export async function updateOrganization(
  id: string,
  data: { name?: string; slug?: string }
) {
  await requirePermission(PERMISSIONS.SYSTEM_MANAGE_ORGS);

  await db
    .update(organizations)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(organizations.id, id));

  revalidatePath("/admin/organizations");
}

export async function deleteOrganization(id: string) {
  await requirePermission(PERMISSIONS.SYSTEM_MANAGE_ORGS);

  // Prevent deleting org with active users
  const [memberCount] = await db
    .select({ count: count() })
    .from(userProfiles)
    .where(eq(userProfiles.organizationId, id));

  if (Number(memberCount.count) > 0) {
    throw new Error("无法删除有成员的组织，请先移除所有用户");
  }

  await db.delete(organizations).where(eq(organizations.id, id));
  revalidatePath("/admin/organizations");
}

// ---------------------------------------------------------------------------
// User management
// ---------------------------------------------------------------------------

export async function createUser(data: {
  email: string;
  password: string;
  displayName: string;
  organizationId: string;
  roleId: string;
}) {
  await requirePermission(PERMISSIONS.SYSTEM_MANAGE_USERS);

  if (data.password.length < 8) {
    throw new Error("密码至少 8 位");
  }

  const email = data.email.trim().toLowerCase();
  const existing = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.email, email),
  });
  if (existing) throw new Error("该邮箱已被注册");

  const userId = randomUUID();
  const passwordHash = await hashPassword(data.password);

  await db.insert(userProfiles).values({
    id: userId,
    organizationId: data.organizationId,
    displayName: data.displayName,
    email,
    passwordHash,
    passwordHashAlgo: "argon2id",
  });

  await db.insert(userRoles).values({
    userId,
    roleId: data.roleId,
    organizationId: data.organizationId,
  });

  revalidatePath("/admin/users");
  return { id: userId };
}

export async function updateUser(
  userId: string,
  data: {
    displayName?: string;
    organizationId?: string;
  }
) {
  await requirePermission(PERMISSIONS.SYSTEM_MANAGE_USERS);

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (data.displayName) updates.displayName = data.displayName;
  if (data.organizationId) updates.organizationId = data.organizationId;

  await db
    .update(userProfiles)
    .set(updates)
    .where(eq(userProfiles.id, userId));

  // If org changed, update user_roles org too
  if (data.organizationId) {
    await db
      .update(userRoles)
      .set({ organizationId: data.organizationId })
      .where(eq(userRoles.userId, userId));
  }

  revalidatePath("/admin/users");
}

export async function deactivateUser(userId: string) {
  await requirePermission(PERMISSIONS.SYSTEM_MANAGE_USERS);

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, userId),
  });
  if (profile?.isSuperAdmin) {
    throw new Error("无法停用超级管理员账号");
  }

  // 清空密码即停用 — 用户无法登录但 user_profile 保留
  await db
    .update(userProfiles)
    .set({ passwordHash: null, updatedAt: new Date() })
    .where(eq(userProfiles.id, userId));

  revalidatePath("/admin/users");
}

// ---------------------------------------------------------------------------
// Role management
// ---------------------------------------------------------------------------

export async function assignUserRole(
  userId: string,
  roleId: string,
  organizationId: string
) {
  await requirePermission(PERMISSIONS.SYSTEM_MANAGE_ROLES);

  const ctx = await requirePermission(PERMISSIONS.SYSTEM_MANAGE_ROLES);

  await db
    .insert(userRoles)
    .values({
      userId,
      roleId,
      organizationId,
      assignedBy: ctx.userId,
    })
    .onConflictDoNothing();

  revalidatePath("/admin/users");
}

export async function removeUserRole(userId: string, roleId: string) {
  await requirePermission(PERMISSIONS.SYSTEM_MANAGE_ROLES);

  await db
    .delete(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)));

  revalidatePath("/admin/users");
}

export async function createRole(data: {
  name: string;
  slug: string;
  description?: string;
  permissions: string[];
  organizationId: string;
}) {
  await requirePermission(PERMISSIONS.SYSTEM_MANAGE_ROLES);

  const [role] = await db
    .insert(roles)
    .values({
      organizationId: data.organizationId,
      name: data.name,
      slug: data.slug,
      description: data.description,
      permissions: data.permissions,
      isSystem: false,
    })
    .returning();

  revalidatePath("/admin/roles");
  return { id: role.id };
}

export async function updateRole(
  roleId: string,
  data: { name?: string; description?: string; permissions?: string[] }
) {
  await requirePermission(PERMISSIONS.SYSTEM_MANAGE_ROLES);

  // Prevent editing system role metadata (but allow permission updates)
  const [role] = await db
    .select()
    .from(roles)
    .where(eq(roles.id, roleId))
    .limit(1);
  if (!role) throw new Error("角色不存在");

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (!role.isSystem && data.name) updates.name = data.name;
  if (!role.isSystem && data.description !== undefined)
    updates.description = data.description;
  if (data.permissions) updates.permissions = data.permissions;

  await db.update(roles).set(updates).where(eq(roles.id, roleId));

  revalidatePath("/admin/roles");
}

export async function deleteRole(roleId: string) {
  await requirePermission(PERMISSIONS.SYSTEM_MANAGE_ROLES);

  const [role] = await db
    .select()
    .from(roles)
    .where(eq(roles.id, roleId))
    .limit(1);
  if (!role) throw new Error("角色不存在");
  if (role.isSystem) throw new Error("系统角色不可删除");

  // Check if any users are assigned this role
  const [assignmentCount] = await db
    .select({ count: count() })
    .from(userRoles)
    .where(eq(userRoles.roleId, roleId));

  if (Number(assignmentCount.count) > 0) {
    throw new Error("该角色下还有用户，请先移除角色分配");
  }

  await db.delete(roles).where(eq(roles.id, roleId));
  revalidatePath("/admin/roles");
}

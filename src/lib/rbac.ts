import { cache } from "react";
import { db } from "@/db";
import { userProfiles, userRoles, roles } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUserAndOrg } from "@/lib/dal/auth";

// Re-export constants so server code can import everything from "@/lib/rbac"
export {
  PERMISSIONS,
  ALL_PERMISSIONS,
  DEFAULT_ROLES,
  PERMISSION_GROUPS,
  type Permission,
} from "./rbac-constants";

import { ALL_PERMISSIONS } from "./rbac-constants";

// ---------------------------------------------------------------------------
// Core permission queries (cached per-request)
// ---------------------------------------------------------------------------

export const isSuperAdmin = cache(
  async (userId: string): Promise<boolean> => {
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, userId),
    });
    return profile?.isSuperAdmin === true;
  }
);

export const getUserPermissions = cache(
  async (userId: string, orgId: string): Promise<string[]> => {
    if (await isSuperAdmin(userId)) return [...ALL_PERMISSIONS];

    const assignments = await db
      .select({ permissions: roles.permissions })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(
        and(eq(userRoles.userId, userId), eq(userRoles.organizationId, orgId))
      );

    const permSet = new Set<string>();
    for (const row of assignments) {
      const perms = row.permissions as string[];
      if (perms) perms.forEach((p) => permSet.add(p));
    }
    return [...permSet];
  }
);

export async function hasPermission(
  userId: string,
  orgId: string,
  permission: string
): Promise<boolean> {
  const perms = await getUserPermissions(userId, orgId);
  return perms.includes(permission);
}

export async function hasAnyPermission(
  userId: string,
  orgId: string,
  permissions: string[]
): Promise<boolean> {
  const perms = await getUserPermissions(userId, orgId);
  return permissions.some((p) => perms.includes(p));
}

/**
 * Guard for server actions and page.tsx — throws if user lacks the permission.
 * Returns the authenticated user context on success.
 */
export async function requirePermission(
  permission: string
): Promise<{ userId: string; organizationId: string }> {
  const ctx = await getCurrentUserAndOrg();
  if (!ctx) throw new Error("未登录");

  const allowed = await hasPermission(
    ctx.userId,
    ctx.organizationId,
    permission
  );
  if (!allowed) throw new Error("无权限执行此操作");

  return ctx;
}

import { cache } from "react";
import { db } from "@/db";
import {
  organizations,
  userProfiles,
  roles,
  userRoles,
} from "@/db/schema";
import { eq, and, count, isNull, or, desc } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Organization queries
// ---------------------------------------------------------------------------

export const getOrganizations = cache(async () => {
  const orgs = await db.query.organizations.findMany({
    orderBy: [desc(organizations.createdAt)],
  });

  // Fetch member counts in one pass
  const memberCounts = await db
    .select({
      organizationId: userProfiles.organizationId,
      count: count(),
    })
    .from(userProfiles)
    .groupBy(userProfiles.organizationId);

  const countMap = new Map(
    memberCounts.map((r) => [r.organizationId, Number(r.count)])
  );

  return orgs.map((o) => ({
    ...o,
    memberCount: countMap.get(o.id) || 0,
  }));
});

export const getOrganization = cache(async (id: string) => {
  return db.query.organizations.findFirst({
    where: eq(organizations.id, id),
  });
});

// ---------------------------------------------------------------------------
// User queries (with roles)
// ---------------------------------------------------------------------------

export type UserWithRoles = {
  id: string;
  displayName: string;
  email: string | null;
  role: string;
  isSuperAdmin: boolean;
  organizationId: string | null;
  organizationName: string | null;
  avatarUrl: string | null;
  createdAt: string;
  roles: { id: string; name: string; slug: string }[];
};

export const getOrgMembers = cache(
  async (orgId: string): Promise<UserWithRoles[]> => {
    const users = await db.query.userProfiles.findMany({
      where: eq(userProfiles.organizationId, orgId),
      orderBy: [desc(userProfiles.createdAt)],
      with: { organization: true },
    });

    const userIds = users.map((u) => u.id);
    if (userIds.length === 0) return [];

    // Fetch role assignments for all users in this org
    const assignments = await db
      .select({
        userId: userRoles.userId,
        roleId: roles.id,
        roleName: roles.name,
        roleSlug: roles.slug,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.organizationId, orgId));

    const roleMap = new Map<string, { id: string; name: string; slug: string }[]>();
    for (const a of assignments) {
      const list = roleMap.get(a.userId) || [];
      list.push({ id: a.roleId, name: a.roleName, slug: a.roleSlug });
      roleMap.set(a.userId, list);
    }

    return users.map((u) => ({
      id: u.id,
      displayName: u.displayName,
      email: null, // email is in auth.users, not user_profiles
      role: u.role,
      isSuperAdmin: u.isSuperAdmin,
      organizationId: u.organizationId,
      organizationName: u.organization?.name || null,
      avatarUrl: u.avatarUrl,
      createdAt: u.createdAt.toISOString(),
      roles: roleMap.get(u.id) || [],
    }));
  }
);

export const getAllUsers = cache(async (): Promise<UserWithRoles[]> => {
  const users = await db.query.userProfiles.findMany({
    orderBy: [desc(userProfiles.createdAt)],
    with: { organization: true },
  });

  // Fetch all role assignments
  const assignments = await db
    .select({
      userId: userRoles.userId,
      roleId: roles.id,
      roleName: roles.name,
      roleSlug: roles.slug,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id));

  const roleMap = new Map<string, { id: string; name: string; slug: string }[]>();
  for (const a of assignments) {
    const list = roleMap.get(a.userId) || [];
    list.push({ id: a.roleId, name: a.roleName, slug: a.roleSlug });
    roleMap.set(a.userId, list);
  }

  return users.map((u) => ({
    id: u.id,
    displayName: u.displayName,
    email: null,
    role: u.role,
    isSuperAdmin: u.isSuperAdmin,
    organizationId: u.organizationId,
    organizationName: u.organization?.name || null,
    avatarUrl: u.avatarUrl,
    createdAt: u.createdAt.toISOString(),
    roles: roleMap.get(u.id) || [],
  }));
});

// ---------------------------------------------------------------------------
// Role queries
// ---------------------------------------------------------------------------

export const getOrgRoles = cache(async (orgId: string) => {
  // System-wide roles (organizationId IS NULL) + org-specific roles
  return db.query.roles.findMany({
    where: or(isNull(roles.organizationId), eq(roles.organizationId, orgId)),
    orderBy: [desc(roles.isSystem), roles.name],
  });
});

export const getAllRoles = cache(async () => {
  return db.query.roles.findMany({
    orderBy: [desc(roles.isSystem), roles.name],
  });
});

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export const getSystemStats = cache(async () => {
  const [orgCount] = await db.select({ count: count() }).from(organizations);
  const [userCount] = await db.select({ count: count() }).from(userProfiles);
  const [roleCount] = await db.select({ count: count() }).from(roles);

  return {
    orgCount: Number(orgCount.count),
    userCount: Number(userCount.count),
    roleCount: Number(roleCount.count),
  };
});

"use server";

import { cache } from "react";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { userProfiles, userRoles, roles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

// Retry a DB query up to `n` times with exponential backoff
async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries) throw err;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error("unreachable");
}

// cache() deduplicates per-request
export const getCurrentUserAndOrg = cache(
  async (): Promise<{ userId: string; organizationId: string } | null> => {
    try {
      const user = await getCurrentUser();
      if (!user) return null;

      // Trust the session for org id, but fall back to DB lookup for safety
      if (user.organizationId) {
        return { userId: user.id, organizationId: user.organizationId };
      }

      const profile = await withRetry(() =>
        db.query.userProfiles.findFirst({
          where: eq(userProfiles.id, user.id),
        })
      );
      if (profile?.organizationId) {
        return { userId: user.id, organizationId: profile.organizationId };
      }
      return null;
    } catch {
      console.warn("[auth] getCurrentUserAndOrg failed, returning null");
      return null;
    }
  }
);

export const getCurrentUserOrg = cache(async (): Promise<string | null> => {
  const ctx = await getCurrentUserAndOrg();
  return ctx?.organizationId ?? null;
});

/**
 * Full user context including permissions. Used by layout/sidebar to decide
 * which navigation items to show.
 */
export type UserContext = {
  userId: string;
  organizationId: string;
  displayName: string;
  role: string;
  isSuperAdmin: boolean;
  permissions: string[];
};

export const getCurrentUserProfile = cache(
  async (): Promise<UserContext | null> => {
    try {
      const ctx = await getCurrentUserAndOrg();
      if (!ctx) return null;

      const profile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, ctx.userId),
      });
      if (!profile) return null;

      let permissions: string[] = [];

      if (profile.isSuperAdmin) {
        const { ALL_PERMISSIONS } = await import("@/lib/rbac");
        permissions = [...ALL_PERMISSIONS];
      } else {
        const assignments = await db
          .select({ permissions: roles.permissions })
          .from(userRoles)
          .innerJoin(roles, eq(userRoles.roleId, roles.id))
          .where(
            and(
              eq(userRoles.userId, ctx.userId),
              eq(userRoles.organizationId, ctx.organizationId)
            )
          );

        const permSet = new Set<string>();
        for (const row of assignments) {
          const perms = row.permissions as string[];
          if (perms) perms.forEach((p) => permSet.add(p));
        }
        permissions = [...permSet];
      }

      return {
        userId: ctx.userId,
        organizationId: ctx.organizationId,
        displayName: profile.displayName,
        role: profile.role,
        isSuperAdmin: profile.isSuperAdmin,
        permissions,
      };
    } catch {
      console.warn("[auth] getCurrentUserProfile failed");
      return null;
    }
  }
);

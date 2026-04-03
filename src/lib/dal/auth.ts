"use server";

import { cache } from "react";
import { db } from "@/db";
import { userProfiles, organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";

// Auto-provision a user_profiles record linked to the default org.
async function ensureUserProfile(userId: string, displayName: string): Promise<string | null> {
  const defaultOrg = await db.query.organizations.findFirst({
    orderBy: (o, { asc }) => [asc(o.createdAt)],
  });
  if (!defaultOrg) return null;

  await db
    .insert(userProfiles)
    .values({
      id: userId,
      organizationId: defaultOrg.id,
      displayName,
    })
    .onConflictDoNothing();

  return defaultOrg.id;
}

// Retry a DB query up to `n` times with exponential backoff
async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries) throw err;
      // Wait 1s, then 2s before retrying
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error("unreachable");
}

// cache() deduplicates per-request: multiple DAL functions calling this
// in the same render pass share one Supabase auth round-trip.
export const getCurrentUserAndOrg = cache(
  async (): Promise<{ userId: string; organizationId: string } | null> => {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return null;

      const profile = await withRetry(() =>
        db.query.userProfiles.findFirst({
          where: eq(userProfiles.id, user.id),
        })
      );

      if (profile?.organizationId)
        return { userId: user.id, organizationId: profile.organizationId };

      const name = user.user_metadata?.display_name || user.email || "用户";
      const orgId = await ensureUserProfile(user.id, name);
      if (!orgId) return null;
      return { userId: user.id, organizationId: orgId };
    } catch {
      console.warn("[auth] getCurrentUserAndOrg failed, returning null");
      return null;
    }
  }
);

export const getCurrentUserOrg = cache(
  async (): Promise<string | null> => {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return null;

      // Retry DB query if circuit breaker is recovering
      const profile = await withRetry(() =>
        db.query.userProfiles.findFirst({
          where: eq(userProfiles.id, user.id),
        })
      );

      if (profile?.organizationId) return profile.organizationId;

      const name = user.user_metadata?.display_name || user.email || "用户";
      return ensureUserProfile(user.id, name);
    } catch (err) {
      console.error("[auth] user_profiles query failed:", err);
      return null;
    }
  }
);

"use server";

import { cache } from "react";
import { db } from "@/db";
import { userProfiles, organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";

// Auto-provision a user_profiles record linked to the default org.
// Called when a logged-in user has no profile yet (e.g. first login after signup).
async function ensureUserProfile(userId: string, displayName: string): Promise<string | null> {
  // Find any existing org (the first one created)
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

// cache() deduplicates per-request: multiple DAL functions calling this
// in the same render pass share one Supabase auth round-trip.
// Internal 3s timeout prevents hanging when Supabase is unreachable.
export const getCurrentUserOrg = cache(
  async (): Promise<string | null> => {
    try {
      return await Promise.race([
        (async () => {
          const supabase = await createClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (!user) return null;

          const profile = await db.query.userProfiles.findFirst({
            where: eq(userProfiles.id, user.id),
          });

          if (profile?.organizationId) return profile.organizationId;

          // Auto-provision profile for users who signed up but have no profile
          const name = user.user_metadata?.display_name || user.email || "用户";
          return ensureUserProfile(user.id, name);
        })(),
        new Promise<string | null>((resolve) =>
          setTimeout(() => resolve(null), 10000)
        ),
      ]);
    } catch {
      console.warn("[auth] user_profiles query failed, returning null org");
      return null;
    }
  }
);

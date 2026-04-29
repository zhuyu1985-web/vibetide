"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { upsertSubscriptions } from "@/lib/dal/topic-subscriptions";
import { revalidatePath } from "next/cache";
export async function updateSubscriptionsAction(
  categories: string[],
  eventTypes: string[]
) {
  const user = await requireAuth();
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });
  if (!profile?.organizationId) throw new Error("No organization");
  await upsertSubscriptions(user.id, profile.organizationId, categories, eventTypes);
  revalidatePath("/inspiration");
}

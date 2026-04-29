"use server";

import { requireAuth } from "@/lib/auth";
import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { markTopicsAsRead, updateLastViewedAt } from "@/lib/dal/topic-reads";
import { revalidatePath } from "next/cache";
async function getUserOrg(userId: string) {
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, userId),
  });
  if (!profile?.organizationId) throw new Error("No organization");
  return profile.organizationId;
}

export async function markAsReadAction(topicIds: string[]) {
  const user = await requireAuth();
  const orgId = await getUserOrg(user.id);
  await markTopicsAsRead(user.id, orgId, topicIds);
  revalidatePath("/inspiration");
}

export async function markAllAsReadAction(topicIds: string[]) {
  const user = await requireAuth();
  const orgId = await getUserOrg(user.id);
  await markTopicsAsRead(user.id, orgId, topicIds);
  revalidatePath("/inspiration");
}

export async function updateLastViewedAtAction() {
  const user = await requireAuth();
  const orgId = await getUserOrg(user.id);
  await updateLastViewedAt(user.id, orgId);
}

"use server";

import { requireAuth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  markAsRead,
  markAllAsRead,
  getUnreadCount,
} from "@/lib/dal/notifications";
import { db } from "@/db";
import { userProfiles } from "@/db/schema/users";
import { eq } from "drizzle-orm";
export async function markMessageRead(messageId: string) {
  const user = await requireAuth();
  await markAsRead(user.id, messageId);
  revalidatePath("/missions");
}

export async function markAllMessagesRead(teamId: string) {
  const user = await requireAuth();
  await markAllAsRead(user.id, teamId);
  revalidatePath("/missions");
}

export async function fetchUnreadCount(): Promise<number> {
  const user = await requireAuth();

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
  });

  const orgId = profile?.organizationId;
  if (!orgId) return 0;

  return getUnreadCount(orgId, user.id);
}

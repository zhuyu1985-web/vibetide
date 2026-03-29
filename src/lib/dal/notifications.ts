import { db } from "@/db";
import { messageReads } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Mark a specific message as read for a user.
 */
export async function markAsRead(userId: string, messageId: string) {
  // Upsert — ignore if already exists
  await db
    .insert(messageReads)
    .values({ userId, messageId })
    .onConflictDoNothing();
}

/**
 * Mark all messages in a mission as read for a user.
 * (Previously teamId-based; now a no-op placeholder until mission-scoped reads are implemented.)
 */
export async function markAllAsRead(
  _userId: string,
  _scopeId: string
) {
  // TODO: implement mission-scoped bulk read marking
}

/**
 * Get unread message count for a user within an organization.
 */
export async function getUnreadCount(
  _organizationId: string,
  _userId: string
): Promise<number> {
  // TODO: implement with mission_messages join
  return 0;
}

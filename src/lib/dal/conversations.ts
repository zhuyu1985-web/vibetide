import { db } from "@/db";
import { savedConversations } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";

/**
 * Get saved conversations for a user, optionally filtered by employee slug.
 * Ordered by most recently updated first.
 */
export async function getSavedConversations(
  userId: string,
  employeeSlug?: string
) {
  const conditions = [eq(savedConversations.userId, userId)];
  if (employeeSlug) {
    conditions.push(eq(savedConversations.employeeSlug, employeeSlug));
  }

  return db
    .select()
    .from(savedConversations)
    .where(and(...conditions))
    .orderBy(desc(savedConversations.updatedAt));
}

/**
 * Get a single saved conversation by ID, scoped to the requesting user.
 */
export async function getSavedConversationById(id: string, userId: string) {
  const row = await db.query.savedConversations.findFirst({
    where: and(
      eq(savedConversations.id, id),
      eq(savedConversations.userId, userId)
    ),
  });
  return row ?? null;
}

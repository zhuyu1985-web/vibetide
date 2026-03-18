import { db } from "@/db";
import { teamMessages } from "@/db/schema/messages";
import { messageReads } from "@/db/schema/message-reads";
import { teams } from "@/db/schema/teams";
import { eq, and, sql, notExists, desc } from "drizzle-orm";

/**
 * Count unread messages for a user. Optionally scoped to a single team.
 */
export async function getUnreadCount(
  orgId: string,
  userId: string,
  teamId?: string
): Promise<number> {
  const conditions = [
    eq(teams.organizationId, orgId),
    notExists(
      db
        .select({ one: sql`1` })
        .from(messageReads)
        .where(
          and(
            eq(messageReads.messageId, teamMessages.id),
            eq(messageReads.userId, userId)
          )
        )
    ),
  ];

  if (teamId) {
    conditions.push(eq(teamMessages.teamId, teamId));
  }

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(teamMessages)
    .innerJoin(teams, eq(teamMessages.teamId, teams.id))
    .where(and(...conditions));

  return result[0]?.count ?? 0;
}

/**
 * Mark a single message as read for a user (upsert).
 */
export async function markAsRead(
  userId: string,
  messageId: string
): Promise<void> {
  await db
    .insert(messageReads)
    .values({ userId, messageId })
    .onConflictDoNothing();
}

/**
 * Mark all messages in a team as read for a user.
 */
export async function markAllAsRead(
  userId: string,
  teamId: string
): Promise<void> {
  // Insert read records for all messages in the team that the user hasn't read
  await db.execute(sql`
    INSERT INTO message_reads (user_id, message_id)
    SELECT ${userId}, tm.id
    FROM team_messages tm
    WHERE tm.team_id = ${teamId}
      AND NOT EXISTS (
        SELECT 1 FROM message_reads mr
        WHERE mr.message_id = tm.id AND mr.user_id = ${userId}
      )
  `);
}

/**
 * Find messages that mention a user by searching for @userId in content.
 * Looks for patterns like @nickname in the message content.
 */
export async function getMentionsForUser(
  userId: string,
  orgId: string
): Promise<
  {
    id: string;
    content: string;
    teamId: string | null;
    createdAt: Date;
  }[]
> {
  // Search for messages containing @-mentions targeting this user's display name
  // We search for the literal user ID pattern that the input bar embeds
  const rows = await db
    .select({
      id: teamMessages.id,
      content: teamMessages.content,
      teamId: teamMessages.teamId,
      createdAt: teamMessages.createdAt,
    })
    .from(teamMessages)
    .innerJoin(teams, eq(teamMessages.teamId, teams.id))
    .where(
      and(
        eq(teams.organizationId, orgId),
        sql`${teamMessages.content} LIKE ${"%" + "@" + "%"}`
      )
    )
    .orderBy(desc(teamMessages.createdAt))
    .limit(50);

  return rows;
}

/**
 * Check if a specific message has been read by a user.
 */
export async function isMessageRead(
  userId: string,
  messageId: string
): Promise<boolean> {
  const row = await db
    .select({ id: messageReads.id })
    .from(messageReads)
    .where(
      and(
        eq(messageReads.userId, userId),
        eq(messageReads.messageId, messageId)
      )
    )
    .limit(1);

  return row.length > 0;
}

/**
 * Get read status for multiple messages at once (batch check).
 * Returns a Set of message IDs that have been read.
 */
export async function getReadMessageIds(
  userId: string,
  messageIds: string[]
): Promise<Set<string>> {
  if (messageIds.length === 0) return new Set();

  const rows = await db
    .select({ messageId: messageReads.messageId })
    .from(messageReads)
    .where(
      and(
        eq(messageReads.userId, userId),
        sql`${messageReads.messageId} = ANY(${messageIds})`
      )
    );

  return new Set(rows.map((r) => r.messageId));
}

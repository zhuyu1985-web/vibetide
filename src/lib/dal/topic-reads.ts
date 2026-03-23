import { db } from "@/db";
import { userTopicReads, hotTopics } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import type { TopicReadState } from "@/lib/types";

export async function getTopicReadState(
  userId: string,
  organizationId: string
): Promise<TopicReadState> {
  const result = await db
    .select()
    .from(userTopicReads)
    .where(
      and(
        eq(userTopicReads.userId, userId),
        eq(userTopicReads.organizationId, organizationId)
      )
    )
    .limit(1);

  if (result.length === 0) {
    return { lastViewedAt: new Date().toISOString(), readTopicIds: [] };
  }

  return {
    lastViewedAt: result[0].lastViewedAt.toISOString(),
    readTopicIds: (result[0].readTopicIds as string[]) || [],
  };
}

export async function markTopicsAsRead(
  userId: string,
  organizationId: string,
  topicIds: string[]
): Promise<void> {
  const existing = await getTopicReadState(userId, organizationId);
  const mergedIds = [...new Set([...existing.readTopicIds, ...topicIds])];

  // Clean up IDs older than 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const validTopics = await db
    .select({ id: hotTopics.id })
    .from(hotTopics)
    .where(gt(hotTopics.discoveredAt, sevenDaysAgo));
  const validIds = new Set(validTopics.map((t) => t.id));
  const cleanedIds = mergedIds.filter((id) => validIds.has(id));

  await db
    .insert(userTopicReads)
    .values({
      userId,
      organizationId,
      readTopicIds: cleanedIds,
      lastViewedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [userTopicReads.userId, userTopicReads.organizationId],
      set: { readTopicIds: cleanedIds, updatedAt: new Date() },
    });
}

export async function updateLastViewedAt(
  userId: string,
  organizationId: string
): Promise<void> {
  await db
    .insert(userTopicReads)
    .values({ userId, organizationId, lastViewedAt: new Date() })
    .onConflictDoUpdate({
      target: [userTopicReads.userId, userTopicReads.organizationId],
      set: { lastViewedAt: new Date(), updatedAt: new Date() },
    });
}

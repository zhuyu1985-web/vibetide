import { db } from "@/db";
import { userTopicSubscriptions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { UserTopicSubscription } from "@/lib/types";

export async function getUserSubscriptions(
  userId: string,
  organizationId: string
): Promise<UserTopicSubscription | null> {
  const result = await db
    .select()
    .from(userTopicSubscriptions)
    .where(
      and(
        eq(userTopicSubscriptions.userId, userId),
        eq(userTopicSubscriptions.organizationId, organizationId)
      )
    )
    .limit(1);

  if (result.length === 0) return null;

  return {
    subscribedCategories: (result[0].subscribedCategories as string[]) || [],
    subscribedEventTypes: (result[0].subscribedEventTypes as string[]) || [],
  };
}

export async function upsertSubscriptions(
  userId: string,
  organizationId: string,
  categories: string[],
  eventTypes: string[]
): Promise<void> {
  await db
    .insert(userTopicSubscriptions)
    .values({
      userId,
      organizationId,
      subscribedCategories: categories,
      subscribedEventTypes: eventTypes,
    })
    .onConflictDoUpdate({
      target: [userTopicSubscriptions.userId, userTopicSubscriptions.organizationId],
      set: {
        subscribedCategories: categories,
        subscribedEventTypes: eventTypes,
        updatedAt: new Date(),
      },
    });
}

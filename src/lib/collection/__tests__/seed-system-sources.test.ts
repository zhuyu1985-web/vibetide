import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { collectionSources, organizations } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import {
  ensureHotTopicSystemSource,
  SYSTEM_HOT_TOPIC_SOURCE_NAME,
} from "../seed-system-sources";

const touchedOrgIds: string[] = [];

afterAll(async () => {
  for (const orgId of touchedOrgIds) {
    await db.delete(collectionSources).where(eq(collectionSources.organizationId, orgId));
    await db.delete(organizations).where(eq(organizations.id, orgId));
  }
});

describe("ensureHotTopicSystemSource", () => {
  it("does not re-enable a paused system TopHub source", async () => {
    const now = Date.now();
    const [org] = await db
      .insert(organizations)
      .values({ name: "seed-system-paused", slug: `seed-system-paused-${now}` })
      .returning();
    touchedOrgIds.push(org.id);

    const [source] = await db
      .insert(collectionSources)
      .values({
        organizationId: org.id,
        name: SYSTEM_HOT_TOPIC_SOURCE_NAME,
        sourceType: "tophub",
        config: { platforms: ["weibo"] },
        targetModules: ["hot_topics"],
        enabled: false,
        scheduleCron: "0 * * * *",
      })
      .returning();

    const ensured = await ensureHotTopicSystemSource(org.id);

    const [row] = await db
      .select({
        id: collectionSources.id,
        enabled: collectionSources.enabled,
        deletedAt: collectionSources.deletedAt,
      })
      .from(collectionSources)
      .where(
        and(
          eq(collectionSources.organizationId, org.id),
          eq(collectionSources.name, SYSTEM_HOT_TOPIC_SOURCE_NAME),
        ),
      )
      .limit(1);

    expect(ensured).toEqual({ sourceId: source.id, enabled: false });
    expect(row).toMatchObject({
      id: source.id,
      enabled: false,
      deletedAt: null,
    });
  });
});

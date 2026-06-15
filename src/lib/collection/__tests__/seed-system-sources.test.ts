import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { collectionSources, organizations } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import {
  ensureHotTopicSystemSource,
  SYSTEM_HOT_TOPIC_SOURCE_NAME,
} from "../seed-system-sources";

const touchedOrgIds: string[] = [];
let orgId: string;
let sourceId: string;

// DB 写入放 beforeAll：无本地 DB 时这里抛错 → vitest 将整个 suite 标记为
// skipped(与 collection.test.ts 等兄弟集成测试一致),而不是 hard-fail 阻塞 commit。
beforeAll(async () => {
  const now = Date.now();
  const [org] = await db
    .insert(organizations)
    .values({ name: "seed-system-paused", slug: `seed-system-paused-${now}` })
    .returning();
  touchedOrgIds.push(org.id);
  orgId = org.id;

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
  sourceId = source.id;
});

afterAll(async () => {
  for (const id of touchedOrgIds) {
    await db.delete(collectionSources).where(eq(collectionSources.organizationId, id));
    await db.delete(organizations).where(eq(organizations.id, id));
  }
});

describe("ensureHotTopicSystemSource", () => {
  it("does not re-enable a paused system TopHub source", async () => {
    const ensured = await ensureHotTopicSystemSource(orgId);

    const [row] = await db
      .select({
        id: collectionSources.id,
        enabled: collectionSources.enabled,
        deletedAt: collectionSources.deletedAt,
      })
      .from(collectionSources)
      .where(
        and(
          eq(collectionSources.organizationId, orgId),
          eq(collectionSources.name, SYSTEM_HOT_TOPIC_SOURCE_NAME),
        ),
      )
      .limit(1);

    expect(ensured).toEqual({ sourceId, enabled: false });
    expect(row).toMatchObject({
      id: sourceId,
      enabled: false,
      deletedAt: null,
    });
  });
});

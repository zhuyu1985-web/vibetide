import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { db } from "@/db";
import { collectedItems, collectionRuns, collectionSources, organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { writeItems } from "../writer";

// Mock Inngest send to observe event emission without actually dispatching
vi.mock("@/inngest/client", () => ({
  inngest: { send: vi.fn().mockResolvedValue({ ids: ["evt-1"] }) },
}));
import { inngest } from "@/inngest/client";

let orgId: string;
let sourceId: string;
const slug = "test-writer-" + Date.now();

beforeAll(async () => {
  const [org] = await db.insert(organizations).values({
    name: "test-writer-org",
    slug,
  }).returning();
  orgId = org.id;

  const [src] = await db.insert(collectionSources).values({
    organizationId: orgId,
    name: "test-source-" + Date.now(),
    sourceType: "tophub",
    config: { platforms: ["weibo"] },
    targetModules: ["hot_topics"],
  }).returning();
  sourceId = src.id;
});

afterAll(async () => {
  await db.delete(collectedItems).where(eq(collectedItems.organizationId, orgId));
  await db.delete(collectionRuns).where(eq(collectionRuns.organizationId, orgId));
  await db.delete(collectionSources).where(eq(collectionSources.organizationId, orgId));
  await db.delete(organizations).where(eq(organizations.id, orgId));
});

beforeEach(async () => {
  vi.clearAllMocks();
  await db.delete(collectedItems).where(eq(collectedItems.organizationId, orgId));
});

async function makeRun(): Promise<string> {
  const [run] = await db.insert(collectionRuns).values({
    sourceId,
    organizationId: orgId,
    trigger: "manual",
    startedAt: new Date(),
    status: "running",
  }).returning({ id: collectionRuns.id });
  return run.id;
}

describe("writeItems", () => {
  it("inserts new items on first write", async () => {
    const runId = await makeRun();
    const result = await writeItems({
      runId,
      sourceId,
      organizationId: orgId,
      items: [
        { title: "Hello world A", url: "https://a.com/1", channel: "tophub/weibo" },
        { title: "Hello world B", url: "https://a.com/2", channel: "tophub/weibo" },
      ],
      source: { targetModules: ["hot_topics"], defaultCategory: null, defaultTags: null },
    });
    expect(result).toMatchObject({ inserted: 2, merged: 0, failed: 0 });
    expect(result.insertedItemIds).toHaveLength(2);
    const rows = await db.select().from(collectedItems).where(eq(collectedItems.organizationId, orgId));
    expect(rows).toHaveLength(2);
    expect(inngest.send).toHaveBeenCalledTimes(2);
  });

  it("merges same URL captured twice", async () => {
    const runId = await makeRun();
    await writeItems({
      runId, sourceId, organizationId: orgId,
      items: [{ title: "Hello", url: "https://a.com/x", channel: "tophub/weibo" }],
      source: { targetModules: [], defaultCategory: null, defaultTags: null },
    });
    vi.clearAllMocks();
    const runId2 = await makeRun();
    const result = await writeItems({
      runId: runId2, sourceId, organizationId: orgId,
      items: [{ title: "Hello", url: "https://a.com/x", channel: "tophub/zhihu" }],
      source: { targetModules: [], defaultCategory: null, defaultTags: null },
    });
    expect(result).toMatchObject({ inserted: 0, merged: 1, failed: 0 });
    expect(result.insertedItemIds).toEqual([]);
    const [row] = await db.select().from(collectedItems).where(eq(collectedItems.organizationId, orgId));
    expect((row.sourceChannels as unknown as unknown[]).length).toBe(2);
    // merge should NOT emit event
    expect(inngest.send).not.toHaveBeenCalled();
  });

  it("merges by content fingerprint when URLs differ but title+day match", async () => {
    const runId = await makeRun();
    await writeItems({
      runId, sourceId, organizationId: orgId,
      items: [{
        title: "Breaking news X",
        url: "https://a.com/v1?utm_source=t",
        publishedAt: new Date("2026-04-18T10:00:00Z"),
        channel: "tophub/weibo",
      }],
      source: { targetModules: [], defaultCategory: null, defaultTags: null },
    });
    const result = await writeItems({
      runId: await makeRun(), sourceId, organizationId: orgId,
      items: [{
        title: "Breaking News X!",  // title normalization collapses to same form
        url: "https://a.com/v2",     // different URL
        publishedAt: new Date("2026-04-18T18:00:00Z"),  // same UTC day
        channel: "tophub/zhihu",
      }],
      source: { targetModules: [], defaultCategory: null, defaultTags: null },
    });
    expect(result).toMatchObject({ inserted: 0, merged: 1, failed: 0 });
    expect(result.insertedItemIds).toEqual([]);
    const rows = await db.select().from(collectedItems).where(eq(collectedItems.organizationId, orgId));
    expect(rows).toHaveLength(1);
  });

  it("emits item.created event only for new inserts", async () => {
    const runId = await makeRun();
    await writeItems({
      runId, sourceId, organizationId: orgId,
      items: [{ title: "evt test", url: "https://e.com/1", channel: "tophub/weibo" }],
      source: { targetModules: ["hot_topics"], defaultCategory: null, defaultTags: null },
    });
    expect(inngest.send).toHaveBeenCalledWith(expect.objectContaining({
      name: "collection/item.created",
      data: expect.objectContaining({
        sourceId,
        organizationId: orgId,
        targetModules: ["hot_topics"],
      }),
    }));
  });
});

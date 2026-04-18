import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/db";
import { collectionSources, collectedItems, collectionRuns, organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  listCollectionSources,
  getCollectionSourceById,
  assertSourceOwnership,
  listRecentRunsBySource,
  listRecentItemsBySource,
  getOrgCollectionSummary,
} from "../collection";

let orgA: string;
let orgB: string;
let sourceA1: string;

beforeAll(async () => {
  const now = Date.now();
  const [a] = await db.insert(organizations).values({ name: "dal-test-A", slug: `dal-test-a-${now}` }).returning();
  const [b] = await db.insert(organizations).values({ name: "dal-test-B", slug: `dal-test-b-${now}` }).returning();
  orgA = a.id;
  orgB = b.id;
  const [s1] = await db.insert(collectionSources).values({
    organizationId: orgA,
    name: "dal-source-1",
    sourceType: "tophub",
    config: { platforms: ["weibo"] },
    targetModules: ["hot_topics"],
  }).returning();
  sourceA1 = s1.id;
  await db.insert(collectionSources).values({
    organizationId: orgA,
    name: "dal-source-2",
    sourceType: "tavily",
    config: { keywords: ["x"], timeRange: "7d", maxResults: 8 },
    targetModules: ["news"],
  });
  await db.insert(collectionSources).values({
    organizationId: orgB,
    name: "dal-source-B",
    sourceType: "tophub",
    config: { platforms: ["weibo"] },
    targetModules: [],
  });
});

afterAll(async () => {
  await db.delete(collectedItems).where(eq(collectedItems.organizationId, orgA));
  await db.delete(collectedItems).where(eq(collectedItems.organizationId, orgB));
  await db.delete(collectionRuns).where(eq(collectionRuns.organizationId, orgA));
  await db.delete(collectionRuns).where(eq(collectionRuns.organizationId, orgB));
  await db.delete(collectionSources).where(eq(collectionSources.organizationId, orgA));
  await db.delete(collectionSources).where(eq(collectionSources.organizationId, orgB));
  await db.delete(organizations).where(eq(organizations.id, orgA));
  await db.delete(organizations).where(eq(organizations.id, orgB));
});

describe("listCollectionSources", () => {
  it("returns only sources for given org", async () => {
    const rowsA = await listCollectionSources(orgA);
    expect(rowsA.length).toBeGreaterThanOrEqual(2);
    expect(rowsA.every((r) => r.organizationId === orgA)).toBe(true);
  });

  it("filters by sourceType", async () => {
    const rows = await listCollectionSources(orgA, { sourceType: "tavily" });
    expect(rows.every((r) => r.sourceType === "tavily")).toBe(true);
  });

  it("filters by targetModule via array contains", async () => {
    const rows = await listCollectionSources(orgA, { targetModule: "hot_topics" });
    expect(rows.every((r) => r.targetModules.includes("hot_topics"))).toBe(true);
  });
});

describe("getCollectionSourceById / assertSourceOwnership", () => {
  it("returns the source when in same org", async () => {
    const row = await getCollectionSourceById(sourceA1, orgA);
    expect(row?.name).toBe("dal-source-1");
  });

  it("returns null when in different org", async () => {
    const row = await getCollectionSourceById(sourceA1, orgB);
    expect(row).toBeNull();
  });

  it("assertSourceOwnership throws across orgs", async () => {
    await expect(assertSourceOwnership(sourceA1, orgB)).rejects.toThrow();
  });
});

describe("listRecentRunsBySource + listRecentItemsBySource", () => {
  it("return empty arrays when nothing exists", async () => {
    expect(await listRecentRunsBySource(sourceA1, orgA)).toEqual([]);
    expect(await listRecentItemsBySource(sourceA1, orgA)).toEqual([]);
  });
});

describe("getOrgCollectionSummary", () => {
  it("counts only this org", async () => {
    const summary = await getOrgCollectionSummary(orgA);
    expect(summary.totalSources).toBeGreaterThanOrEqual(2);
    expect(summary.enabledSources).toBeGreaterThanOrEqual(2);
  });
});

/**
 * Test script for the hot topic crawl pipeline.
 * Run with: npx tsx scripts/test-crawl.ts
 *
 * IMPORTANT: load env BEFORE any DB imports.
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { desc } from "drizzle-orm";
import {
  fetchTrendingFromApi,
  buildCrossPlatformTopics,
  normalizeHeatScore,
  normalizeTitleKey,
  parseChineseNumber,
  TOPHUB_DEFAULT_NODES,
} from "../src/lib/trending-api";
import crypto from "crypto";

async function main() {
  // Dynamic imports AFTER env is loaded so DATABASE_URL is available
  const { db } = await import("../src/db");
  const { hotTopics, hotTopicCrawlLogs, organizations, topicAngles, commentInsights, competitorResponses } = await import("../src/db/schema");
  console.log("DATABASE_URL set:", !!process.env.DATABASE_URL);
  console.log("TRENDING_API_KEY set:", !!process.env.TRENDING_API_KEY);

  // 0. Clear old data
  console.log("\n--- Step 0: Clear old data ---");
  await db.delete(topicAngles);
  await db.delete(commentInsights);
  await db.delete(competitorResponses);
  await db.delete(hotTopicCrawlLogs);
  await db.delete(hotTopics);
  console.log("Cleared all hot topic data");

  // 1. Test DB connection
  console.log("\n--- Step 1: Test DB connection ---");
  try {
    const orgs = await db.select({ id: organizations.id }).from(organizations).limit(3);
    console.log("Organizations found:", orgs.length);
    if (orgs.length > 0) {
      console.log("First org ID:", orgs[0].id);
    }
  } catch (e) {
    console.error("DB connection failed:", e);
    process.exit(1);
  }

  // 2. Test TopHub API
  console.log("\n--- Step 2: Test TopHub API (微博 only) ---");
  try {
    const items = await fetchTrendingFromApi("platforms", { platforms: ["微博"], limit: 5 });
    console.log("微博 items:", items.length);
    if (items.length > 0) {
      console.log("Sample:", items[0].title, "| heat:", items[0].heat);
    }
  } catch (e) {
    console.error("TopHub API failed:", e);
    process.exit(1);
  }

  // 3. Full crawl test (all platforms)
  console.log("\n--- Step 3: Full crawl (all 10 platforms) ---");
  const orgs = await db.select({ id: organizations.id }).from(organizations).limit(1);
  if (orgs.length === 0) {
    console.error("No organization in DB, cannot proceed");
    process.exit(1);
  }
  const orgId = orgs[0].id;

  const platformEntries = Object.entries(TOPHUB_DEFAULT_NODES);
  const allItems: typeof items = [];
  type Items = Awaited<ReturnType<typeof fetchTrendingFromApi>>;
  let items: Items = [];

  const results = await Promise.allSettled(
    platformEntries.map(async ([name]) => {
      const fetched = await fetchTrendingFromApi("platforms", { platforms: [name], limit: 30 });
      return { name, items: fetched };
    })
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const [name, nodeId] = platformEntries[i];
    if (result.status === "fulfilled") {
      allItems.push(...result.value.items);
      console.log(`  ✓ ${name}: ${result.value.items.length} items`);
      await db.insert(hotTopicCrawlLogs).values({
        organizationId: orgId,
        platformName: name,
        platformNodeId: nodeId,
        status: "success",
        topicsFound: result.value.items.length,
      });
    } else {
      console.log(`  ✗ ${name}: ${result.reason}`);
      await db.insert(hotTopicCrawlLogs).values({
        organizationId: orgId,
        platformName: name,
        platformNodeId: nodeId,
        status: "error",
        topicsFound: 0,
        errorMessage: String(result.reason),
      });
    }
  }

  console.log("\nTotal items crawled:", allItems.length);

  // 4. Dedup and persist
  console.log("\n--- Step 4: Dedup and persist ---");
  const crossPlatform = buildCrossPlatformTopics(allItems);
  console.log("Cross-platform topics:", crossPlatform.length);

  // Build topic map — track max heat per topic
  const topicAgg = new Map<string, {
    title: string;
    platforms: Set<string>;
    maxHeat: number;
    url: string;
    category?: string;
  }>();

  for (const cp of crossPlatform) {
    const key = normalizeTitleKey(cp.title);
    topicAgg.set(key, {
      title: cp.title,
      platforms: new Set(cp.platforms),
      maxHeat: cp.totalHeat,
      url: "",
    });
  }

  for (const item of allItems) {
    const key = normalizeTitleKey(item.title);
    const numericHeat = parseChineseNumber(item.heat);
    if (!topicAgg.has(key)) {
      topicAgg.set(key, {
        title: item.title,
        platforms: new Set([item.platform]),
        maxHeat: numericHeat,
        url: item.url,
        category: item.category,
      });
    } else {
      const existing = topicAgg.get(key)!;
      existing.platforms.add(item.platform);
      if (numericHeat > existing.maxHeat) existing.maxHeat = numericHeat;
    }
  }

  const now = new Date();
  const timeLabel = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  let newCount = 0;

  for (const [, agg] of topicAgg) {
    const titleHash = crypto.createHash("md5").update(normalizeTitleKey(agg.title)).digest("hex");
    const platformCount = agg.platforms.size;
    const heatScore = normalizeHeatScore(agg.maxHeat, platformCount);
    const platformsArray = Array.from(agg.platforms);

    const priority = platformCount >= 3 || heatScore > 85
      ? "P0"
      : platformCount >= 2 || heatScore >= 50
        ? "P1"
        : "P2";

    await db.insert(hotTopics).values({
      organizationId: orgId,
      title: agg.title,
      titleHash,
      sourceUrl: agg.url || null,
      priority,
      heatScore,
      trend: "rising",
      source: platformsArray[0] || "",
      category: agg.category || null,
      platforms: platformsArray,
      heatCurve: [{ time: timeLabel, value: heatScore }],
      discoveredAt: now,
    });
    newCount++;
  }

  console.log("New topics inserted:", newCount);

  // 5. Verify
  console.log("\n--- Step 5: Verify ---");
  const topicsInDb = await db.select({ id: hotTopics.id, title: hotTopics.title, priority: hotTopics.priority, heatScore: hotTopics.heatScore }).from(hotTopics).orderBy(desc(hotTopics.heatScore)).limit(5);
  console.log("Top 5 topics in DB:");
  for (const t of topicsInDb) {
    console.log(`  [${t.priority}] heat=${t.heatScore} | ${t.title.slice(0, 50)}`);
  }

  const logCount = await db.select({ id: hotTopicCrawlLogs.id }).from(hotTopicCrawlLogs).limit(100);
  console.log("\nCrawl logs count:", logCount.length);

  console.log("\n✅ Done! Restart dev server and visit /inspiration to see real data.");
  process.exit(0);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});

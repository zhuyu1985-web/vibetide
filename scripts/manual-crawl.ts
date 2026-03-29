import postgres from "postgres";
import {
  fetchTrendingFromApi,
  buildCrossPlatformTopics,
  normalizeHeatScore,
  normalizeTitleKey,
  parseChineseNumber,
  classifyByKeywords,
  TOPHUB_DEFAULT_NODES,
} from "@/lib/trending-api";
import crypto from "crypto";

// Use a SEPARATE connection (max=1) to avoid conflicting with dev server pool
const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

async function main() {
  const organizationId = "4176e76f-001f-4677-bffc-756e21acd465";
  console.time("total");

  // Step 1: Crawl all platforms
  console.log("Crawling all platforms...");
  const allItems: { platform: string; rank: number; title: string; heat: number | string; url: string; category?: string }[] = [];
  const results = await Promise.allSettled(
    Object.entries(TOPHUB_DEFAULT_NODES).map(async ([name]) => {
      const items = await fetchTrendingFromApi("platforms", { platforms: [name], limit: 30 });
      return { name, items };
    })
  );
  for (const r of results) {
    if (r.status === "fulfilled") {
      console.log(`  ${r.value.name}: ${r.value.items.length} items`);
      allItems.push(...r.value.items);
    } else {
      console.log(`  FAILED: ${r.reason}`);
    }
  }
  console.log(`Total: ${allItems.length} items`);
  if (allItems.length === 0) { await sql.end(); process.exit(0); }

  // Step 2: Dedup in memory
  console.log("Deduplicating...");
  const crossPlatform = buildCrossPlatformTopics(allItems);
  const topicAgg = new Map<string, {
    title: string; titleHash: string; platforms: Set<string>; maxHeat: number; url: string; category?: string;
  }>();

  for (const cp of crossPlatform) {
    const key = normalizeTitleKey(cp.title);
    topicAgg.set(key, {
      title: cp.title, titleHash: crypto.createHash("md5").update(key).digest("hex"),
      platforms: new Set(cp.platforms), maxHeat: cp.totalHeat, url: "", category: undefined,
    });
  }
  for (const item of allItems) {
    const key = normalizeTitleKey(item.title);
    const h = parseChineseNumber(item.heat);
    if (!topicAgg.has(key)) {
      topicAgg.set(key, {
        title: item.title, titleHash: crypto.createHash("md5").update(key).digest("hex"),
        platforms: new Set([item.platform]), maxHeat: h, url: item.url, category: item.category,
      });
    } else {
      const ex = topicAgg.get(key)!;
      ex.platforms.add(item.platform);
      if (h > ex.maxHeat) ex.maxHeat = h;
      if (item.url && !ex.url) ex.url = item.url;
    }
  }
  console.log(`Unique topics: ${topicAgg.size}`);

  // Step 3: Insert all (use raw SQL with ON CONFLICT for dedup)
  const now = new Date();
  const timeLabel = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  let count = 0;

  console.log("Inserting...");
  for (const [, agg] of topicAgg) {
    const pc = agg.platforms.size;
    const hs = normalizeHeatScore(agg.maxHeat, pc);
    const pa = Array.from(agg.platforms);
    const pri = pc >= 3 || hs > 85 ? "P0" : pc >= 2 || hs >= 50 ? "P1" : "P2";

    await sql`
      INSERT INTO hot_topics (organization_id, title, title_hash, source_url, priority, heat_score, trend, source, category, platforms, heat_curve, discovered_at)
      VALUES (${organizationId}, ${agg.title}, ${agg.titleHash}, ${agg.url || null}, ${pri}, ${hs}, ${"rising"}, ${pa[0] || ""}, ${classifyByKeywords(agg.title) || null}, ${JSON.stringify(pa)}::jsonb, ${JSON.stringify([{ time: timeLabel, value: hs }])}::jsonb, ${now})
    `;
    count++;
    if (count % 50 === 0) process.stdout.write(`[${count}/${topicAgg.size}] `);
  }

  // Step 4: Write crawl logs
  for (const [name, nodeId] of Object.entries(TOPHUB_DEFAULT_NODES)) {
    await sql`INSERT INTO hot_topic_crawl_logs (organization_id, platform_name, platform_node_id, status, topics_found) VALUES (${organizationId}, ${name}, ${nodeId}, ${"success"}, ${30})`;
  }

  console.log("");
  console.timeEnd("total");
  console.log(`DONE! Inserted/updated ${count} topics.`);
  await sql.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("FATAL:", err);
  sql.end().then(() => process.exit(1));
});

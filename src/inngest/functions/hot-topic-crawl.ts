import { inngest } from "../client";
import { db } from "@/db";
import { hotTopics, hotTopicCrawlLogs, organizations } from "@/db/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import crypto from "crypto";
import {
  fetchTrendingFromApi,
  buildCrossPlatformTopics,
  normalizeHeatScore,
  normalizeTitleKey,
  parseChineseNumber,
  classifyByKeywords,
  TOPHUB_DEFAULT_NODES,
  type TrendingItem,
} from "@/lib/trending-api";

/**
 * Cron scheduler: every hour on the hour.
 * Dispatches crawl events for all organizations.
 */
export const hotTopicCrawlScheduler = inngest.createFunction(
  { id: "hot-topic-crawl-scheduler", name: "Hot Topic Crawl Scheduler" },
  { cron: "0 * * * *" },
  async ({ step }) => {
    const orgs = await step.run("find-organizations", async () => {
      return db
        .select({ id: organizations.id })
        .from(organizations);
    });

    if (orgs.length === 0) return { message: "No organizations found" };

    await step.run("dispatch-crawl-events", async () => {
      const events = orgs.map((org) => ({
        name: "hot-topics/crawl-triggered" as const,
        data: {
          organizationId: org.id,
          triggeredBy: "cron" as const,
        },
      }));
      await inngest.send(events);
    });

    return { dispatched: orgs.length };
  }
);

/**
 * Event-driven crawler: fetches all 10 platforms via TopHub API,
 * deduplicates, and persists to hotTopics table.
 */
export const hotTopicCrawler = inngest.createFunction(
  {
    id: "hot-topic-crawler",
    name: "Hot Topic Crawler",
    concurrency: { limit: 2 },
  },
  { event: "hot-topics/crawl-triggered" },
  async ({ event, step }) => {
    const { organizationId } = event.data;

    // Step 1: Crawl all platforms
    const crawlResult = await step.run("crawl-all-platforms", async () => {
      const platformEntries = Object.entries(TOPHUB_DEFAULT_NODES);
      const allItems: TrendingItem[] = [];
      const logs: { platformName: string; nodeId: string; status: string; count: number; error?: string }[] = [];

      // Fetch each platform individually for per-platform logging
      const results = await Promise.allSettled(
        platformEntries.map(async ([name, nodeId]) => {
          const items = await fetchTrendingFromApi("platforms", {
            platforms: [name],
            limit: 30,
          });
          return { name, nodeId, items };
        })
      );

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const [name, nodeId] = platformEntries[i];

        if (result.status === "fulfilled") {
          const { items } = result.value;
          allItems.push(...items);
          logs.push({ platformName: name, nodeId, status: "success", count: items.length });
        } else {
          const errMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
          logs.push({ platformName: name, nodeId, status: "error", count: 0, error: errMsg });
        }
      }

      // Write crawl logs
      for (const log of logs) {
        await db.insert(hotTopicCrawlLogs).values({
          organizationId,
          platformName: log.platformName,
          platformNodeId: log.nodeId,
          status: log.status,
          topicsFound: log.count,
          errorMessage: log.error || null,
        });
      }

      return { items: allItems, totalPlatforms: logs.length, successCount: logs.filter((l) => l.status === "success").length };
    });

    if (crawlResult.items.length === 0) {
      return { message: "No items crawled", platforms: crawlResult.totalPlatforms };
    }

    // Step 2: Dedup and persist
    const persistResult = await step.run("dedup-and-persist", async () => {
      const items = crawlResult.items as TrendingItem[];
      const crossPlatform = buildCrossPlatformTopics(items);

      // Build a map: normalized title key → aggregated info (track max heat)
      const topicAgg = new Map<string, {
        title: string;
        platforms: Set<string>;
        maxHeat: number;
        url: string;
        category?: string;
      }>();

      // First add cross-platform topics
      for (const cp of crossPlatform) {
        const key = normalizeTitleKey(cp.title);
        topicAgg.set(key, {
          title: cp.title,
          platforms: new Set(cp.platforms),
          maxHeat: cp.totalHeat,
          url: "",
          category: undefined,
        });
      }

      // Then add remaining single-platform items (if not already in map)
      for (const item of items) {
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
          if (item.url && !existing.url) existing.url = item.url;
        }
      }

      const now = new Date();
      const timeLabel = now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
      const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      let newCount = 0;
      let updatedCount = 0;
      const newTopicIds: string[] = [];

      for (const [, agg] of topicAgg) {
        const titleHash = crypto
          .createHash("md5")
          .update(normalizeTitleKey(agg.title))
          .digest("hex");

        const platformCount = agg.platforms.size;
        const heatScore = normalizeHeatScore(agg.maxHeat, platformCount);
        const platformsArray = Array.from(agg.platforms);

        // Check for existing topic within 24h
        const existing = await db
          .select({
            id: hotTopics.id,
            heatCurve: hotTopics.heatCurve,
            platforms: hotTopics.platforms,
          })
          .from(hotTopics)
          .where(
            and(
              eq(hotTopics.organizationId, organizationId),
              eq(hotTopics.titleHash, titleHash),
              gte(hotTopics.discoveredAt, cutoff)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          // Update existing topic
          const row = existing[0];
          const oldCurve = (row.heatCurve as { time: string; value: number }[]) || [];
          const newCurve = [...oldCurve, { time: timeLabel, value: heatScore }].slice(-48);

          const oldPlatforms = (row.platforms as string[]) || [];
          const mergedPlatforms = Array.from(new Set([...oldPlatforms, ...platformsArray]));

          // Determine trend from heat curve
          const trend = determineTrend(newCurve);

          await db
            .update(hotTopics)
            .set({
              heatScore,
              heatCurve: newCurve,
              platforms: mergedPlatforms,
              trend,
              updatedAt: now,
            })
            .where(eq(hotTopics.id, row.id));

          updatedCount++;
        } else {
          // Insert new topic — priority assignment
          // P0 (必追): 跨3+平台且热度>90, 或热度>95 (真正全网爆点)
          // P1 (建议跟进): 跨2+平台, 或热度>75
          // P2 (持续关注): 其余
          const priority =
            (platformCount >= 3 && heatScore > 90) || heatScore > 95
              ? "P0"
              : platformCount >= 2 || heatScore > 75
                ? "P1"
                : "P2";

          const [inserted] = await db
            .insert(hotTopics)
            .values({
              organizationId,
              title: agg.title,
              titleHash,
              sourceUrl: agg.url || null,
              priority,
              heatScore,
              trend: "rising",
              source: platformsArray[0] || "",
              category: classifyByKeywords(agg.title) || null,
              platforms: platformsArray,
              heatCurve: [{ time: timeLabel, value: heatScore }],
              discoveredAt: now,
            })
            .returning({ id: hotTopics.id });

          newTopicIds.push(inserted.id);
          newCount++;
        }
      }

      return { newCount, updatedCount, newTopicIds };
    });

    // Step 3: Percentile-based priority re-ranking within this batch
    if (persistResult.newTopicIds.length > 0) {
      await step.run("percentile-rerank", async () => {
        const newTopics = await db
          .select({ id: hotTopics.id, heatScore: hotTopics.heatScore })
          .from(hotTopics)
          .where(sql`${hotTopics.id} = ANY(${persistResult.newTopicIds})`)
          .orderBy(desc(hotTopics.heatScore));

        if (newTopics.length < 5) return; // too few to re-rank

        const total = newTopics.length;
        for (let i = 0; i < total; i++) {
          const percentile = ((total - i) / total) * 100;
          let newPriority: "P0" | "P1" | "P2";
          if (percentile >= 90) newPriority = "P0";       // top 10%
          else if (percentile >= 70) newPriority = "P1";  // top 30%
          else newPriority = "P2";

          await db
            .update(hotTopics)
            .set({ priority: newPriority })
            .where(eq(hotTopics.id, newTopics[i].id));
        }
      });
    }

    // Step 4: Dispatch enrichment for P0, P1, and high-heat P2 topics
    if (persistResult.newTopicIds.length > 0) {
      await step.run("dispatch-enrichment", async () => {
        const topicsToEnrich = await db
          .select({ id: hotTopics.id })
          .from(hotTopics)
          .where(
            and(
              eq(hotTopics.organizationId, organizationId),
              sql`${hotTopics.id} = ANY(${persistResult.newTopicIds})`,
              sql`(${hotTopics.priority} IN ('P0', 'P1') OR ${hotTopics.heatScore} >= 30)`
            )
          );

        if (topicsToEnrich.length > 0) {
          await inngest.send({
            name: "hot-topics/enrich-requested",
            data: {
              organizationId,
              topicIds: topicsToEnrich.map((t) => t.id),
            },
          });
        }
      });
    }

    return {
      platforms: crawlResult.totalPlatforms,
      success: crawlResult.successCount,
      newTopics: persistResult.newCount,
      updatedTopics: persistResult.updatedCount,
    };
  }
);

/**
 * Determine trend direction from heat curve data points.
 */
function determineTrend(curve: { time: string; value: number }[]): "rising" | "surging" | "plateau" | "declining" {
  if (curve.length < 2) return "rising";

  const recent = curve.slice(-4);
  const previous = curve.slice(-8, -4);

  if (previous.length === 0) return "rising";

  const recentAvg = recent.reduce((s, p) => s + p.value, 0) / recent.length;
  const previousAvg = previous.reduce((s, p) => s + p.value, 0) / previous.length;

  if (previousAvg === 0) return recentAvg > 0 ? "surging" : "plateau";

  const changeRate = (recentAvg - previousAvg) / previousAvg;

  if (changeRate > 0.2) return "surging";
  if (changeRate > 0.05) return "rising";
  if (changeRate < -0.05) return "declining";
  return "plateau";
}

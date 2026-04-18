import crypto from "node:crypto";
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { collectedItems, hotTopics } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import {
  normalizeHeatScore,
  classifyByKeywords,
  normalizeTitleKey,
} from "@/lib/trending-api";

interface SourceChannelEntry {
  channel: string;
  url?: string;
  sourceId: string;
  runId: string;
  capturedAt: string;
}

/**
 * Recompute hot_topics.titleHash using the LEGACY formula (not the
 * collection-hub content_fingerprint). This ensures the bridge's upsert
 * can dedup against existing rows inserted by the old hotTopicCrawler
 * during parallel operation or after migration.
 *
 * OLD formula (see src/lib/trending-api.ts normalizeTitleKey):
 *   MD5(normalizeTitleKey(title))  // lowercase, strip punct, truncate to 20 chars
 *
 * NEW collected_items.content_fingerprint formula (see normalize.ts):
 *   MD5(normalizeTitle(title) + ":" + date_bucket)  // different stripping + date bucket
 *
 * These hash different inputs — incompatible.
 */
function computeLegacyTitleHash(title: string): string {
  return crypto.createHash("md5").update(normalizeTitleKey(title)).digest("hex");
}

/**
 * Subscriber: when a new collected_item arrives with targetModules including
 * "hot_topics", bridge it to the legacy hot_topics table and dispatch the
 * existing hot-topics/enrich-requested event to preserve the LLM enrichment
 * pipeline.
 */
export const collectionHotTopicBridge = inngest.createFunction(
  {
    id: "collection-hot-topic-bridge",
    name: "Collection Hub - Hot Topic Bridge",
    concurrency: { limit: 4 },
    retries: 2,
  },
  { event: "collection/item.created" },
  async ({ event, step }) => {
    if (!event.data.targetModules.includes("hot_topics")) {
      return { skipped: true, reason: "targetModules missing hot_topics" };
    }

    const itemId = event.data.itemId;
    const organizationId = event.data.organizationId;

    // Step 1: Load collected_item
    const item = await step.run("load-item", async () => {
      const [row] = await db
        .select()
        .from(collectedItems)
        .where(eq(collectedItems.id, itemId))
        .limit(1);
      if (!row) throw new Error(`collected_item ${itemId} not found`);
      return row;
    });

    // Step 2: Aggregate channels → platforms list + derive heat/priority/category
    const aggregated = await step.run("aggregate", () => {
      const channels = (item.sourceChannels as SourceChannelEntry[]) ?? [];
      const platforms = Array.from(
        new Set(
          channels
            .map((c) => (c.channel.startsWith("tophub/") ? c.channel.slice(7) : null))
            .filter((p): p is string => Boolean(p)),
        ),
      );

      const rawHeat = (item.rawMetadata as { heat?: number | string } | null)?.heat;
      const heatScore =
        rawHeat !== undefined && rawHeat !== null ? normalizeHeatScore(rawHeat) : 50;

      const priority: "P0" | "P1" | "P2" =
        platforms.length >= 3
          ? "P0"
          : platforms.length >= 2
            ? "P1"
            : heatScore >= 75
              ? "P1"
              : "P2";

      const category = classifyByKeywords(item.title);

      return { platforms, heatScore, priority, category };
    });

    // Step 3: Upsert hot_topics using LEGACY titleHash formula
    const hotTopicId = await step.run("upsert-hot-topic", async () => {
      const legacyTitleHash = computeLegacyTitleHash(item.title);

      const [existing] = await db
        .select({ id: hotTopics.id })
        .from(hotTopics)
        .where(
          and(
            eq(hotTopics.organizationId, organizationId),
            eq(hotTopics.titleHash, legacyTitleHash),
          ),
        )
        .limit(1);

      if (existing) {
        await db
          .update(hotTopics)
          .set({
            platforms: aggregated.platforms,
            heatScore: aggregated.heatScore,
            priority: aggregated.priority,
            collectedItemId: itemId,
            updatedAt: new Date(),
          })
          .where(eq(hotTopics.id, existing.id));
        return existing.id;
      }

      const [inserted] = await db
        .insert(hotTopics)
        .values({
          organizationId,
          title: item.title,
          titleHash: legacyTitleHash,
          sourceUrl: item.canonicalUrl,
          priority: aggregated.priority,
          heatScore: aggregated.heatScore,
          trend: "plateau",
          source: aggregated.platforms[0] ?? item.firstSeenChannel,
          category: aggregated.category,
          platforms: aggregated.platforms,
          heatCurve: [],
          // item.firstSeenAt comes through step.run serialization as ISO string — rehydrate to Date
          discoveredAt: new Date(item.firstSeenAt),
          collectedItemId: itemId,
        })
        .returning({ id: hotTopics.id });

      return inserted.id;
    });

    // Step 4: Dispatch enrichment for P0/P1 or high heat (mirrors old crawler gate)
    const shouldEnrich =
      aggregated.priority === "P0" ||
      aggregated.priority === "P1" ||
      aggregated.heatScore >= 30;

    if (shouldEnrich) {
      await step.run("dispatch-enrichment", async () => {
        await inngest.send({
          name: "hot-topics/enrich-requested",
          data: {
            organizationId,
            topicIds: [hotTopicId],
          },
        });
      });
    }

    return {
      itemId,
      hotTopicId,
      platforms: aggregated.platforms.length,
      enriched: shouldEnrich,
    };
  },
);

import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { collectedItems, collectionSources } from "@/db/schema";
import { eq, and, isNotNull, desc } from "drizzle-orm";

const BATCH_SIZE = 50;

/**
 * 一次性 Backfill：扫描 researchBridgeEnabled=true 源的存量 collected_items，
 * 分批发 collection/item.created 事件，复用 collectionResearchBridge 主链路。
 *
 * 去重完全依赖 ingestArticle 的 urlHash onConflictDoNothing——重复触发是
 * 廉价的 no-op，同时 bridge 只在 inserted=true 时 fire content-fetch，所以
 * Jina 不会被重复打。
 *
 * 触发：inngest.send({ name: "research/bridge.backfill.trigger", data: {...} })
 *
 * data:
 *   organizationId?: 单租户回溯；不传则跨所有 org
 *   limit?: 最多扫描的 collected_items 行数（默认 500）
 */
export const researchBridgeBackfill = inngest.createFunction(
  {
    id: "research-bridge-backfill",
    name: "Research - Bridge Backfill (one-shot)",
    concurrency: { limit: 1 },
  },
  { event: "research/bridge.backfill.trigger" },
  async ({ event, step }) => {
    const { organizationId, limit } = event.data;
    const maxLimit = limit ?? 500;

    const items = await step.run("scan-enabled-items", async () => {
      const baseWhere = and(
        eq(collectionSources.researchBridgeEnabled, true),
        isNotNull(collectedItems.canonicalUrl),
        organizationId ? eq(collectedItems.organizationId, organizationId) : undefined,
      );

      const rows = await db
        .select({
          id: collectedItems.id,
          organizationId: collectedItems.organizationId,
          sourceId: collectedItems.firstSeenSourceId,
          firstSeenChannel: collectedItems.firstSeenChannel,
        })
        .from(collectedItems)
        .innerJoin(collectionSources, eq(collectionSources.id, collectedItems.firstSeenSourceId))
        .where(baseWhere)
        .orderBy(desc(collectedItems.firstSeenAt))
        .limit(maxLimit);

      return rows;
    });

    if (items.length === 0) return { bridged: 0, batches: 0 };

    const batches: (typeof items)[] = [];
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      batches.push(items.slice(i, i + BATCH_SIZE));
    }

    for (const [idx, batch] of batches.entries()) {
      await step.sendEvent(
        `fan-out-${idx}`,
        batch.map((item) => ({
          name: "collection/item.created" as const,
          data: {
            itemId: item.id,
            sourceId: item.sourceId ?? "",
            organizationId: item.organizationId,
            targetModules: [],
            firstSeenChannel: item.firstSeenChannel,
          },
        })),
      );
    }

    return { scanned: items.length, batches: batches.length };
  },
);

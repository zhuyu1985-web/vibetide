import { inngest } from "@/inngest/client";
import { bridgeCollectedItemToHotTopic } from "@/lib/collection/bridge-hot-topic";

/**
 * Subscriber: when a new collected_item arrives with targetModules including
 * "hot_topics", bridge it to the legacy hot_topics table and dispatch the
 * existing hot-topics/enrich-requested event to preserve the LLM enrichment
 * pipeline.
 *
 * 桥接核心逻辑抽到 src/lib/collection/bridge-hot-topic.ts，inspiration crawl
 * route 同步路径与本 handler 共用，避免行为漂移。
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

    const { itemId, organizationId } = event.data;

    const result = await step.run("bridge-to-hot-topic", () =>
      bridgeCollectedItemToHotTopic(itemId, organizationId),
    );

    if (result.shouldEnrich) {
      await step.run("dispatch-enrichment", async () => {
        await inngest.send({
          name: "hot-topics/enrich-requested",
          data: {
            organizationId,
            topicIds: [result.hotTopicId],
          },
        });
      });
    }

    return {
      itemId,
      hotTopicId: result.hotTopicId,
      isNew: result.isNew,
      priority: result.priority,
      heatScore: result.heatScore,
      enriched: result.shouldEnrich,
    };
  },
);

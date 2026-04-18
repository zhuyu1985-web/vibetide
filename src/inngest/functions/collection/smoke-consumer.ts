import { inngest } from "@/inngest/client";

/**
 * Phase 0 smoke consumer: proves the event bus works end-to-end.
 * Will be deleted in Phase 2 when real subscribers (hot-topics-enricher, etc.) take over.
 */
export const collectionSmokeConsumer = inngest.createFunction(
  { id: "collection-smoke-consumer", concurrency: { limit: 5 } },
  { event: "collection/item.created" },
  async ({ event, logger }) => {
    logger.info("[collection-smoke] received item.created", {
      itemId: event.data.itemId,
      sourceId: event.data.sourceId,
      channel: event.data.firstSeenChannel,
      targetModules: event.data.targetModules,
    });
    return { received: event.data.itemId };
  },
);

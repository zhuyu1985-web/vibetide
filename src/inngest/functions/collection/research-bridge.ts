import { inngest } from "@/inngest/client";
import { bridgeCollectedItemToResearch } from "@/lib/collection/bridge-research";

/**
 * Subscriber: 和 collectionHotTopicBridge 并列订阅 collection/item.created。
 *
 * 当源开启 researchBridgeEnabled 时把 item 桥接到 research_news_articles，
 * 然后派发 research/article.content-fetch 事件让 Jina 异步拉正文。
 *
 * 和 hot-topic 桥接彼此独立——一个失败不影响另一个。
 */
export const collectionResearchBridge = inngest.createFunction(
  {
    id: "collection-research-bridge",
    name: "Collection Hub - Research Bridge",
    concurrency: { limit: 4 },
    retries: 2,
  },
  { event: "collection/item.created" },
  async ({ event, step }) => {
    const { itemId, organizationId } = event.data;

    const result = await step.run("bridge-to-research", () =>
      bridgeCollectedItemToResearch(itemId, organizationId),
    );

    if (result.skipped) {
      return { skipped: true, reason: result.reason };
    }

    if (result.inserted && result.articleId) {
      await step.sendEvent("fire-content-fetch", {
        name: "research/article.content-fetch",
        data: { articleId: result.articleId },
      });
    }

    return {
      itemId,
      articleId: result.articleId,
      inserted: result.inserted,
    };
  },
);

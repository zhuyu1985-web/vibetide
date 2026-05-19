import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { ensureHotTopicSystemSource } from "@/lib/collection/seed-system-sources";

/**
 * 每小时 cron: 遍历所有组织,确保各自的系统热榜源存在并派发一次采集。
 * 取代旧的 hotTopicCrawlScheduler + hotTopicCrawler。
 */
export const collectionHotTopicCron = inngest.createFunction(
  { id: "collection-hot-topic-cron", name: "Collection Hub - Hot Topic Cron" },
  { cron: "0 * * * *" },
  async ({ step }) => {
    const orgs = await step.run("find-organizations", async () => {
      return db.select({ id: organizations.id }).from(organizations);
    });

    if (orgs.length === 0) return { message: "No organizations found" };

    const result = await step.run("seed-and-dispatch", async () => {
      let dispatched = 0;
      let skipped = 0;
      for (const org of orgs) {
        const source = await ensureHotTopicSystemSource(org.id);
        if (!source.enabled) {
          skipped++;
          continue;
        }
        await inngest.send({
          name: "collection/source.run-requested",
          data: {
            sourceId: source.sourceId,
            organizationId: org.id,
            trigger: "cron",
          },
        });
        dispatched++;
      }
      return { dispatched, skipped };
    });

    return result;
  },
);

import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { researchTasks } from "@/db/schema/research/research-tasks";
import { researchTopicKeywords } from "@/db/schema/research/research-topics";
import { eq, inArray } from "drizzle-orm";

// NOTE: mediaOutlets / mediaOutletCrawlConfigs removed in A1 Phase 0.
// Steps 4 (load-outlets) and 6 (whitelist fan-out) are stubbed.
// A3 阶段迁到 Collection Hub Adapter 架构。

export const researchTaskStart = inngest.createFunction(
  { id: "research-task-start", concurrency: { limit: 5 } },
  { event: "research/task.submitted" },
  async ({ event, step }) => {
    const { taskId } = event.data as { taskId: string };

    // 1. Load task (inline, not in step.run — returns non-serializable Date fields)
    const [task] = await db
      .select()
      .from(researchTasks)
      .where(eq(researchTasks.id, taskId));
    if (!task) return { skipped: true };

    // 2. Mark as crawling
    await step.run("mark-crawling", async () => {
      await db
        .update(researchTasks)
        .set({ status: "crawling", updatedAt: new Date() })
        .where(eq(researchTasks.id, taskId));
    });

    // 3. Load topic keywords (plain data — safe to go through step.run)
    const topicKeywords = await step.run("load-keywords", async () =>
      db
        .select({
          topicId: researchTopicKeywords.topicId,
          keyword: researchTopicKeywords.keyword,
        })
        .from(researchTopicKeywords)
        .where(inArray(researchTopicKeywords.topicId, task.topicIds)),
    );
    const keywordsByTopic = new Map<string, string[]>();
    for (const row of topicKeywords) {
      const arr = keywordsByTopic.get(row.topicId) ?? [];
      arr.push(row.keyword);
      keywordsByTopic.set(row.topicId, arr);
    }

    // 4. stub: outlet/domain include_domains 不再从 mediaOutlets 表读取
    // A3 阶段迁到 Collection Hub list_scraper Adapter
    const includeDomains: string[] = [];

    // 5. Fan out — Tavily per topic
    const timeStartIso = task.timeRangeStart.toISOString();
    const timeEndIso = task.timeRangeEnd.toISOString();

    for (const [topicId, keywords] of keywordsByTopic) {
      await step.sendEvent(`tavily-${topicId}`, {
        name: "research/tavily.crawl",
        data: {
          taskId,
          topicId,
          keywords,
          timeRangeStart: timeStartIso,
          timeRangeEnd: timeEndIso,
          includeDomains,
        },
      });
    }

    // 6. stub: whitelist crawler fan-out 暂停；A3 阶段迁到 Collection Hub
    // (previously fanned out research/whitelist.crawl per outlet crawl config)

    // 7. Fan out — manual URLs
    if (task.customUrls.length > 0) {
      await step.sendEvent("manual-urls", {
        name: "research/manual-url.ingest",
        data: { taskId, urls: task.customUrls },
      });
    }

    return {
      dispatched: {
        tavily: keywordsByTopic.size,
        whitelist: 0, // stubbed
        manual: task.customUrls.length > 0 ? 1 : 0,
      },
    };
  },
);

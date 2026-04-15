import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { researchTasks } from "@/db/schema/research/research-tasks";
import { researchTopicKeywords } from "@/db/schema/research/research-topics";
import {
  mediaOutlets,
  mediaOutletCrawlConfigs,
} from "@/db/schema/research/media-outlets";
import { eq, and, inArray, isNotNull } from "drizzle-orm";

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

    // 4. Load active outlets matching selected tiers — build include_domains
    const outletsWithUrls = await step.run("load-outlets", async () =>
      db
        .select({
          id: mediaOutlets.id,
          tier: mediaOutlets.tier,
          districtId: mediaOutlets.districtId,
          officialUrl: mediaOutlets.officialUrl,
        })
        .from(mediaOutlets)
        .where(
          and(
            eq(mediaOutlets.organizationId, task.organizationId),
            eq(mediaOutlets.status, "active"),
            inArray(mediaOutlets.tier, task.mediaTiers as any),
            isNotNull(mediaOutlets.officialUrl),
          ),
        ),
    );

    const filteredOutlets = outletsWithUrls.filter((o) => {
      if (o.tier !== "district_media") return true;
      if (task.districtIds.length === 0) return true;
      return o.districtId && task.districtIds.includes(o.districtId);
    });

    const includeDomains: string[] = [];
    for (const o of filteredOutlets) {
      try {
        const h = new URL(o.officialUrl!)
          .hostname.toLowerCase()
          .replace(/^www\./, "");
        includeDomains.push(h);
      } catch {}
    }

    // 5. Fan out — Tavily per topic
    // Note: task.timeRangeStart/End are Date objects (loaded inline, not via step.run)
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

    // 6. Fan out — whitelist per outlet (only those with crawl config)
    const crawlConfigs = await step.run("load-crawl-configs", async () =>
      db
        .select({ outletId: mediaOutletCrawlConfigs.outletId })
        .from(mediaOutletCrawlConfigs)
        .where(
          and(
            eq(mediaOutletCrawlConfigs.enabled, true),
            inArray(
              mediaOutletCrawlConfigs.outletId,
              filteredOutlets.map((o) => o.id),
            ),
          ),
        ),
    );
    for (const c of crawlConfigs) {
      await step.sendEvent(`whitelist-${c.outletId}`, {
        name: "research/whitelist.crawl",
        data: { taskId, outletId: c.outletId },
      });
    }

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
        whitelist: crawlConfigs.length,
        manual: task.customUrls.length > 0 ? 1 : 0,
      },
    };
  },
);

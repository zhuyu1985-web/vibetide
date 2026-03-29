import { inngest } from "../client";
import { db } from "@/db";
import { monitoredPlatforms, platformContent } from "@/db/schema";
import { eq, and, sql, lt } from "drizzle-orm";
import { searchViaTavily, truncateContent } from "@/lib/web-fetch";
import crypto from "crypto";

/**
 * Cron scheduler: daily at 8:00 AM (configurable per-platform via crawlFrequencyMinutes).
 * Checks for platforms that are due for crawling and dispatches crawl events.
 */
export const benchmarkingCrawlScheduler = inngest.createFunction(
  { id: "benchmarking-crawl-scheduler", name: "Benchmarking Crawl Scheduler" },
  { cron: "0 8 * * *" },
  async ({ step }) => {
    const platforms = await step.run("find-due-platforms", async () => {
      const now = new Date();

      // Find active platforms whose lastCrawledAt + crawlFrequencyMinutes < now
      const rows = await db
        .select({
          id: monitoredPlatforms.id,
          organizationId: monitoredPlatforms.organizationId,
          crawlFrequencyMinutes: monitoredPlatforms.crawlFrequencyMinutes,
        })
        .from(monitoredPlatforms)
        .where(
          and(
            eq(monitoredPlatforms.status, "active"),
            sql`(${monitoredPlatforms.lastCrawledAt} IS NULL OR ${monitoredPlatforms.lastCrawledAt} + (${monitoredPlatforms.crawlFrequencyMinutes} || ' minutes')::interval < ${now})`
          )
        );

      return rows;
    });

    if (platforms.length === 0) return { message: "No platforms due for crawl" };

    // Send events for each platform
    await step.run("dispatch-crawl-events", async () => {
      const events = platforms.map((p) => ({
        name: "benchmarking/crawl-triggered" as const,
        data: {
          organizationId: p.organizationId!,
          platformId: p.id,
          triggeredBy: "cron" as const,
        },
      }));

      await inngest.send(events);
    });

    return { dispatched: platforms.length };
  }
);

/**
 * Individual platform crawler: triggered by crawl-triggered event.
 * Uses Tavily to search for content on the platform, dedupes, and stores.
 */
export const benchmarkingPlatformCrawler = inngest.createFunction(
  {
    id: "benchmarking-platform-crawler",
    name: "Benchmarking Platform Crawler",
    concurrency: { limit: 3 },
  },
  { event: "benchmarking/crawl-triggered" },
  async ({ event, step }) => {
    const { organizationId, platformId } = event.data;

    if (!platformId) {
      return { error: "No platformId specified" };
    }

    // Load platform config
    const platform = await step.run("load-platform", async () => {
      return db.query.monitoredPlatforms.findFirst({
        where: and(
          eq(monitoredPlatforms.id, platformId),
          eq(monitoredPlatforms.organizationId, organizationId)
        ),
      });
    });

    if (!platform) {
      return { error: "Platform not found" };
    }

    // Crawl via Tavily
    const newContentIds = await step.run("crawl-content", async () => {
      try {
        const config = platform.crawlConfig as {
          searchQuery?: string;
          categories?: string[];
        } | null;

        const searchQuery = config?.searchQuery || `site:${platform.url}`;

        const { items } = await searchViaTavily(searchQuery, {
          maxResults: 20,
          topic: "news",
          include_domains: [platform.url],
        });

        if (items.length === 0) return [];

        // Dedupe by content hash
        const contentIds: string[] = [];

        for (const item of items) {
          const hashInput = `${item.title}::${item.url}`;
          const contentHash = crypto
            .createHash("md5")
            .update(hashInput)
            .digest("hex");

          // Check if already exists
          const existing = await db
            .select({ id: platformContent.id })
            .from(platformContent)
            .where(
              and(
                eq(platformContent.organizationId, organizationId),
                eq(platformContent.contentHash, contentHash)
              )
            )
            .limit(1);

          if (existing.length > 0) continue;

          const body = item.snippet
            ? truncateContent(item.snippet, 5000)
            : undefined;

          const [inserted] = await db
            .insert(platformContent)
            .values({
              organizationId,
              platformId: platform.id,
              title: item.title,
              summary: item.snippet?.slice(0, 500),
              body,
              sourceUrl: item.url,
              author: item.source,
              publishedAt: item.publishedAt
                ? new Date(item.publishedAt)
                : undefined,
              contentHash,
            })
            .returning({ id: platformContent.id });

          contentIds.push(inserted.id);
        }

        // Update platform stats
        await db
          .update(monitoredPlatforms)
          .set({
            lastCrawledAt: new Date(),
            lastErrorMessage: null,
            totalContentCount: sql`${monitoredPlatforms.totalContentCount} + ${contentIds.length}`,
            updatedAt: new Date(),
          })
          .where(eq(monitoredPlatforms.id, platform.id));

        return contentIds;
      } catch (err) {
        // Update platform with error
        await db
          .update(monitoredPlatforms)
          .set({
            lastErrorMessage:
              err instanceof Error ? err.message : String(err),
            status: "error",
            updatedAt: new Date(),
          })
          .where(eq(monitoredPlatforms.id, platform.id));

        throw err;
      }
    });

    // If new content found, dispatch analysis event
    if (newContentIds.length > 0) {
      await step.run("dispatch-analysis", async () => {
        await inngest.send({
          name: "benchmarking/content-detected",
          data: {
            organizationId,
            platformContentIds: newContentIds,
            platformId: platform.id,
            contentCount: newContentIds.length,
          },
        });
      });
    }

    return {
      platform: platform.name,
      newContent: newContentIds.length,
    };
  }
);

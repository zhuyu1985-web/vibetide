import { inngest } from "@/inngest/client";
import { crawlTavilyForKeyword } from "@/lib/research/tavily-crawler";
import { fetchArticleContent } from "@/lib/research/jina-fetch";
import { ingestArticle } from "@/lib/research/article-ingest";
import { db } from "@/db";
import { researchTasks } from "@/db/schema/research/research-tasks";
import { eq, sql } from "drizzle-orm";

export const researchTavilyCrawl = inngest.createFunction(
  { id: "research-tavily-crawl", concurrency: { limit: 3 } },
  { event: "research/tavily.crawl" },
  async ({ event, step }) => {
    const { taskId, topicId, keywords, timeRangeStart, timeRangeEnd, includeDomains } =
      event.data;

    const [task] = await db
      .select({ orgId: researchTasks.organizationId })
      .from(researchTasks)
      .where(eq(researchTasks.id, taskId));
    if (!task) return { skipped: true };

    const start = new Date(timeRangeStart);
    const end = new Date(timeRangeEnd);

    let totalHits = 0;
    let totalInserted = 0;

    for (const keyword of keywords) {
      const hits = await step.run(`tavily-${keyword}`, () =>
        crawlTavilyForKeyword({
          keyword,
          includeDomains,
          timeRangeStart: start,
          timeRangeEnd: end,
          maxResults: 30,
        }),
      );
      totalHits += hits.length;

      for (const h of hits) {
        const ingestResult = await step.run(`ingest-${h.url}`, async () => {
          const article = await fetchArticleContent(h.url);
          const content = article?.content ?? h.snippet;
          return await ingestArticle({
            url: h.url,
            title: article?.title ?? h.title,
            content,
            publishedAt: h.publishedAt ? new Date(h.publishedAt) : null,
            sourceChannel: "tavily",
            organizationId: task.orgId,
            firstSeenResearchTaskId: taskId,
            rawMetadata: h.rawMetadata,
          });
        });
        if (ingestResult.inserted) totalInserted += 1;

        if (ingestResult.inserted) {
          await step.sendEvent(`fanout-${ingestResult.id}`, {
            name: "research/article.ingested",
            data: { articleId: ingestResult.id, taskId, outletId: null },
          });
        }
      }
    }

    await step.run("progress", async () => {
      await db
        .update(researchTasks)
        .set({
          progress: sql`coalesce(${researchTasks.progress}, '{}'::jsonb)
            || jsonb_build_object('crawled', coalesce((${researchTasks.progress} ->> 'crawled')::int, 0) + ${totalInserted})`,
          updatedAt: new Date(),
        })
        .where(eq(researchTasks.id, taskId));
    });

    return { totalHits, totalInserted, topicId };
  },
);

import { inngest } from "@/inngest/client";
import { db } from "@/db";
import {
  mediaOutlets,
  mediaOutletCrawlConfigs,
} from "@/db/schema/research/media-outlets";
import { researchTasks } from "@/db/schema/research/research-tasks";
import { eq } from "drizzle-orm";
import { fetchArticleContent } from "@/lib/research/jina-fetch";
import { ingestArticle } from "@/lib/research/article-ingest";

export const researchWhitelistCrawl = inngest.createFunction(
  { id: "research-whitelist-crawl", concurrency: { limit: 2 } },
  { event: "research/whitelist.crawl" },
  async ({ event, step }) => {
    const { taskId, outletId } = event.data;

    const [ctx] = await db
      .select({
        orgId: researchTasks.organizationId,
        tier: mediaOutlets.tier,
        listUrl: mediaOutletCrawlConfigs.listUrlTemplate,
        articlePattern: mediaOutletCrawlConfigs.articleUrlPattern,
      })
      .from(researchTasks)
      .innerJoin(mediaOutlets, eq(mediaOutlets.id, outletId))
      .leftJoin(
        mediaOutletCrawlConfigs,
        eq(mediaOutletCrawlConfigs.outletId, outletId),
      )
      .where(eq(researchTasks.id, taskId));

    if (!ctx?.listUrl) return { skipped: true, reason: "no_crawl_config" };

    // Fetch list page via Jina → extract article URLs from content
    const urls = await step.run("fetch-list", async () => {
      const page = await fetchArticleContent(ctx.listUrl!.replace("{page}", "1"));
      if (!page) return [] as string[];
      const matches = page.content.match(/https?:\/\/[^\s)]+/g) ?? [];
      const pattern = ctx.articlePattern ? new RegExp(ctx.articlePattern) : null;
      return [...new Set(matches)].filter((u) => (pattern ? pattern.test(u) : true));
    });

    let inserted = 0;
    for (const url of urls.slice(0, 50)) {
      const r = await step.run(`ingest-${url}`, async () => {
        const a = await fetchArticleContent(url);
        if (!a) return { inserted: false, id: null as string | null };
        const ing = await ingestArticle({
          url,
          title: a.title,
          content: a.content,
          sourceChannel: "whitelist_crawl",
          organizationId: ctx.orgId,
          firstSeenResearchTaskId: taskId,
        });
        return { inserted: ing.inserted, id: ing.id };
      });
      if (r.inserted) {
        inserted += 1;
        if (r.id) {
          await step.sendEvent(`fanout-${r.id}`, {
            name: "research/article.ingested",
            data: { articleId: r.id, taskId, outletId },
          });
        }
      }
    }

    return { totalDiscovered: urls.length, inserted };
  },
);

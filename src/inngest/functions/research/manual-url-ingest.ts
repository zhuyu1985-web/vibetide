import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { researchTasks } from "@/db/schema/research/research-tasks";
import { eq } from "drizzle-orm";
import { fetchArticleContent } from "@/lib/research/jina-fetch";
import { ingestArticle } from "@/lib/research/article-ingest";

export const researchManualUrlIngest = inngest.createFunction(
  { id: "research-manual-url-ingest", concurrency: { limit: 3 } },
  { event: "research/manual-url.ingest" },
  async ({ event, step }) => {
    const { taskId, urls } = event.data;

    const [task] = await db
      .select({ orgId: researchTasks.organizationId })
      .from(researchTasks)
      .where(eq(researchTasks.id, taskId));
    if (!task) return { skipped: true };

    let inserted = 0;
    for (const url of urls) {
      const r = await step.run(`ingest-${url}`, async () => {
        const a = await fetchArticleContent(url);
        if (!a) return { inserted: false, id: null as string | null };
        const ing = await ingestArticle({
          url,
          title: a.title,
          content: a.content,
          sourceChannel: "manual_url",
          organizationId: task.orgId,
          firstSeenResearchTaskId: taskId,
        });
        return { inserted: ing.inserted, id: ing.id };
      });
      if (r.inserted) {
        inserted += 1;
        if (r.id) {
          await step.sendEvent(`fanout-${r.id}`, {
            name: "research/article.ingested",
            data: { articleId: r.id, taskId, outletId: null },
          });
        }
      }
    }

    return { totalRequested: urls.length, inserted };
  },
);

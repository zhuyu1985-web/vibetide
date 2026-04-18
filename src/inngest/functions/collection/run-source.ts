import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { collectionSources, collectionRuns, collectionLogs } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getAdapter } from "@/lib/collection/registry";
import { writeItems } from "@/lib/collection/writer";
import "@/lib/collection/adapters"; // ensure adapters are registered at module load

export const runCollectionSource = inngest.createFunction(
  {
    id: "collection-run-source",
    concurrency: { limit: 3 },
    retries: 2,
  },
  { event: "collection/source.run-requested" },
  async ({ event, step }) => {
    const { sourceId, organizationId, trigger } = event.data;

    // 1. Load source
    const source = await step.run("load-source", async () => {
      const [s] = await db
        .select()
        .from(collectionSources)
        .where(eq(collectionSources.id, sourceId))
        .limit(1);
      if (!s) throw new Error(`source ${sourceId} not found`);
      if (!s.enabled) throw new Error(`source ${sourceId} disabled`);
      return s;
    });

    // 2. Create run row
    const runId = await step.run("create-run", async () => {
      const [run] = await db
        .insert(collectionRuns)
        .values({
          sourceId,
          organizationId,
          trigger,
          startedAt: new Date(),
          status: "running",
        })
        .returning({ id: collectionRuns.id });
      return run.id;
    });

    try {
      // 3. Resolve adapter + validate config
      const adapter = getAdapter(source.sourceType);
      const parsed = adapter.configSchema.safeParse(source.config);
      if (!parsed.success) {
        throw new Error(`config validation failed: ${parsed.error.message}`);
      }

      // 4 + 5. Execute adapter AND write items in a single step to avoid
      // Date serialization issues when Inngest serializes step outputs
      // (RawItem.publishedAt is a Date; passing through step boundary would stringify it)
      const result = await step.run("execute-and-write", async () => {
        const adapterResult = await adapter.execute({
          config: parsed.data,
          sourceId,
          organizationId,
          runId,
          log: (level, message, meta) => {
            // fire-and-forget log write; don't block adapter flow
            db.insert(collectionLogs)
              .values({ runId, sourceId, level, message, metadata: meta ?? null })
              .then(() => {})
              .catch(() => {});
          },
        });

        const writeResult = await writeItems({
          runId,
          sourceId,
          organizationId,
          items: adapterResult.items,
          source: {
            targetModules: source.targetModules,
            defaultCategory: source.defaultCategory,
            defaultTags: source.defaultTags,
          },
        });

        return {
          writeResult,
          partialFailures: adapterResult.partialFailures ?? [],
        };
      });

      // 6. Finalize run
      const hasFailures =
        result.writeResult.failed > 0 || result.partialFailures.length > 0;
      await step.run("finalize-run", async () => {
        await db
          .update(collectionRuns)
          .set({
            finishedAt: new Date(),
            status: hasFailures ? "partial" : "success",
            errorSummary:
              result.partialFailures.map((f) => f.message).join("; ") || null,
          })
          .where(eq(collectionRuns.id, runId));

        await db
          .update(collectionSources)
          .set({
            lastRunAt: new Date(),
            lastRunStatus: hasFailures ? "partial" : "success",
            totalItemsCollected: sql`${collectionSources.totalItemsCollected} + ${result.writeResult.inserted}`,
            totalRuns: sql`${collectionSources.totalRuns} + 1`,
          })
          .where(eq(collectionSources.id, sourceId));
      });

      return { sourceId, runId, ...result.writeResult };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db
        .update(collectionRuns)
        .set({ finishedAt: new Date(), status: "failed", errorSummary: message })
        .where(eq(collectionRuns.id, runId));
      await db
        .update(collectionSources)
        .set({
          lastRunAt: new Date(),
          lastRunStatus: "failed",
          totalRuns: sql`${collectionSources.totalRuns} + 1`,
        })
        .where(eq(collectionSources.id, sourceId));
      throw err;
    }
  },
);

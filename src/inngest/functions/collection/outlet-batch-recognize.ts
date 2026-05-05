import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { collectedItems } from "@/db/schema/collection";
import { isNull, and, eq } from "drizzle-orm";
import { listOutletsByOrg } from "@/lib/dal/media-outlet-dictionary";
import { recognizeOutlet } from "@/lib/collection/outlet-recognizer";

export const outletBatchRecognize = inngest.createFunction(
  { id: "collection-outlet-batch-recognize", concurrency: { limit: 1 } },
  { event: "collection/outlet-batch-recognize.requested" },
  async ({ event, step }) => {
    const { organizationId } = event.data;

    // Count unrecognized items first to decide if there's work to do
    const totalUnrecognized = await step.run("count-unrecognized", async () => {
      const rows = await db
        .select({ id: collectedItems.id })
        .from(collectedItems)
        .where(
          and(
            eq(collectedItems.organizationId, organizationId),
            isNull(collectedItems.outletId),
          ),
        )
        .limit(1);
      return rows.length;
    });

    if (totalUnrecognized === 0) {
      return { processed: 0, message: "no unrecognized items" };
    }

    let processed = 0;
    let batchIndex = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const batchProcessed = await step.run(`process-batch-${batchIndex}`, async () => {
        // Load dict fresh inside step to avoid Date serialization across step boundaries
        const dict = await listOutletsByOrg(organizationId, { includeInactive: false });

        const batch = await db
          .select()
          .from(collectedItems)
          .where(
            and(
              eq(collectedItems.organizationId, organizationId),
              isNull(collectedItems.outletId),
            ),
          )
          .limit(500);

        if (batch.length === 0) return 0;

        for (const item of batch) {
          const recognized = recognizeOutlet(
            {
              canonicalUrl: item.canonicalUrl,
              rawMetadata: item.rawMetadata as Record<string, unknown> | null,
            },
            { outletId: null, defaultOutletTier: null, defaultOutletRegion: null },
            dict,
          );
          if (recognized) {
            await db
              .update(collectedItems)
              .set({
                outletId: recognized.outletId,
                outletTier: recognized.outletTier,
                outletRegion: recognized.outletRegion,
                updatedAt: new Date(),
              })
              .where(eq(collectedItems.id, item.id));
          }
        }

        return batch.length;
      });

      processed += batchProcessed;
      if (batchProcessed < 500) break;
      batchIndex++;
    }

    return { processed };
  },
);

/**
 * Phase 0 smoke test: end-to-end collection hub flow.
 *
 * Usage:
 *   npx tsx scripts/phase0-smoke-run.ts <orgId>
 *
 * Prerequisite: `npm run dev` must be running (Inngest dev server auto-starts).
 *
 * What it does:
 *   1. Creates a TopHub source (platforms: [weibo])
 *   2. Sends "collection/source.run-requested" event
 *   3. Waits for Inngest to process
 *   4. Reads back collected_items + collection_runs
 *   5. Prints results, exits 0 on success / 1 on failure
 */
import { db } from "@/db";
import {
  collectedItems,
  collectionRuns,
  collectionSources,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { inngest } from "@/inngest/client";

const orgId = process.argv[2];
if (!orgId) {
  console.error("Usage: npx tsx scripts/phase0-smoke-run.ts <orgId>");
  process.exit(1);
}

async function main() {
  console.log("[smoke] creating test source...");
  const [src] = await db
    .insert(collectionSources)
    .values({
      organizationId: orgId,
      name: `smoke-test-${Date.now()}`,
      sourceType: "tophub",
      config: { platforms: ["weibo"] },
      targetModules: [],
    })
    .returning();
  console.log(`[smoke] source created: ${src.id}`);

  console.log("[smoke] sending Inngest event...");
  const evt = await inngest.send({
    name: "collection/source.run-requested",
    data: {
      sourceId: src.id,
      organizationId: orgId,
      trigger: "manual",
    },
  });
  console.log(`[smoke] event sent: ${JSON.stringify(evt.ids)}`);

  console.log("[smoke] waiting 15s for Inngest to process...");
  await new Promise((r) => setTimeout(r, 15_000));

  const runs = await db
    .select()
    .from(collectionRuns)
    .where(eq(collectionRuns.sourceId, src.id))
    .orderBy(desc(collectionRuns.startedAt));
  console.log(`[smoke] runs: ${JSON.stringify(runs, null, 2)}`);

  const items = await db
    .select()
    .from(collectedItems)
    .where(
      and(
        eq(collectedItems.organizationId, orgId),
        eq(collectedItems.firstSeenSourceId, src.id),
      ),
    );
  console.log(`[smoke] ${items.length} items collected.`);
  console.log(
    "[smoke] sample:",
    items.slice(0, 3).map((i) => ({ title: i.title, channel: i.firstSeenChannel })),
  );

  if (runs.length === 0 || runs[0].status !== "success") {
    console.error("[smoke] ❌ FAILED: run did not succeed");
    process.exit(1);
  }
  if (items.length === 0) {
    console.error("[smoke] ❌ FAILED: no items collected");
    process.exit(1);
  }
  console.log("[smoke] ✅ PASSED");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[smoke] error:", err);
    process.exit(1);
  });

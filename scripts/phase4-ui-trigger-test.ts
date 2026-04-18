/**
 * Phase 4.5 probe: simulate what happens when user clicks "立即触发" in the UI.
 *
 * The server action `triggerCollectionSource(sourceId)` calls inngest.send(...).
 * This script mimics that exact call path to verify the dev server's
 * inngest.send pipeline works.
 *
 * Usage: npx tsx --env-file=.env.local scripts/phase4-ui-trigger-test.ts <sourceId>
 */
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { collectionSources, collectionRuns } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

const sourceId = process.argv[2];
if (!sourceId) {
  console.error("Usage: <sourceId>");
  process.exit(1);
}

async function main() {
  const [src] = await db.select().from(collectionSources).where(eq(collectionSources.id, sourceId)).limit(1);
  if (!src) {
    console.error("source not found");
    process.exit(1);
  }
  console.log(`[probe] source: ${src.name} (${src.sourceType})`);

  const sent = await inngest.send({
    name: "collection/source.run-requested",
    data: { sourceId, organizationId: src.organizationId, trigger: "manual" },
  });
  console.log(`[probe] event sent: ${sent.ids.join(",")}`);

  console.log(`[probe] waiting 25s for processing...`);
  await new Promise((r) => setTimeout(r, 25_000));

  const runs = await db
    .select()
    .from(collectionRuns)
    .where(eq(collectionRuns.sourceId, sourceId))
    .orderBy(desc(collectionRuns.startedAt))
    .limit(1);

  if (runs.length === 0) {
    console.error("[probe] ❌ NO run was created — inngest.send may have failed silently");
    process.exit(1);
  }
  const r = runs[0];
  console.log(`[probe] latest run: status=${r.status}, inserted=${r.itemsInserted}, merged=${r.itemsMerged}, failed=${r.itemsFailed}, finishedAt=${r.finishedAt?.toISOString() ?? "null"}`);
  if (r.status === "success" || (r.status === "running" && r.itemsAttempted > 0)) {
    console.log("[probe] ✅ PASSED");
  } else {
    console.error("[probe] ❌ status =", r.status);
    process.exit(1);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

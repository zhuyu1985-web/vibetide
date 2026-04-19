/**
 * One-time cleanup: merge duplicate missions.
 *
 * Two pass:
 *   1. Source-entity duplicates: missions with the same (organization_id,
 *      source_module, source_entity_id). Keep the earliest createdAt row,
 *      reparent tasks/messages/artifacts to it, then delete the others.
 *      This empties the table of the rows the new partial unique index
 *      `missions_source_dedup_uidx` would reject.
 *
 *   2. User-submit duplicates: missions with identical (organization_id,
 *      title, user_instruction) created within 30 seconds of each other and
 *      no source_entity_id. Same merge logic. This catches the double-click
 *      races that existed before the 30-second soft window was added.
 *
 * Usage:
 *   npx tsx scripts/dedupe-missions.ts             # dry run — reports counts
 *   npx tsx scripts/dedupe-missions.ts --execute   # actually delete
 *   npx tsx scripts/dedupe-missions.ts --execute --aggressive
 *     # same as --execute, but user-submit dedup drops the 30-second window.
 *     # Any two missions with identical (org, title, user_instruction) are
 *     # merged, regardless of when they were created. Use when you have
 *     # visible duplicates from repeated test runs, not just double-clicks.
 *
 * Run this AFTER deploying migration 0026 (the new unique index) but BEFORE
 * inserting the unique index itself — the index will fail to build if
 * duplicates still exist. See README / CLAUDE.md runbook for deploy order.
 */
import { db } from "@/db";
import {
  missions,
  missionTasks,
  missionMessages,
  missionArtifacts,
} from "@/db/schema";
import { sql, inArray, eq } from "drizzle-orm";

const DRY_RUN = !process.argv.includes("--execute");
const AGGRESSIVE = process.argv.includes("--aggressive");

async function findSourceEntityDuplicates() {
  // Group by (org, module, entity) and keep rows where count > 1.
  const rows = await db.execute<{
    organization_id: string;
    source_module: string;
    source_entity_id: string;
    ids: string[];
  }>(sql`
    SELECT organization_id,
           source_module,
           source_entity_id,
           array_agg(id ORDER BY created_at ASC) AS ids
    FROM missions
    WHERE source_entity_id IS NOT NULL
    GROUP BY organization_id, source_module, source_entity_id
    HAVING COUNT(*) > 1
  `);
  return rows;
}

async function findUserSubmitDuplicates() {
  // Default: window of 30 seconds (double-click races).
  // `--aggressive`: drop the window entirely — any repeat (org, title,
  // instruction) gets merged regardless of when it was created. Used for
  // cleaning up accumulated test-run duplicates.
  const rows = await db.execute<{
    organization_id: string;
    title: string;
    user_instruction: string;
    ids: string[];
  }>(
    AGGRESSIVE
      ? sql`
          SELECT organization_id,
                 title,
                 user_instruction,
                 array_agg(id ORDER BY created_at ASC) AS ids
          FROM missions
          WHERE source_entity_id IS NULL
          GROUP BY organization_id, title, user_instruction
          HAVING COUNT(*) > 1
        `
      : sql`
          SELECT organization_id,
                 title,
                 user_instruction,
                 array_agg(id ORDER BY created_at ASC) AS ids
          FROM missions
          WHERE source_entity_id IS NULL
          GROUP BY organization_id, title, user_instruction
          HAVING COUNT(*) > 1
             AND EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) < 30
        `,
  );
  return rows;
}

async function mergeDuplicateGroup(ids: string[]): Promise<void> {
  if (ids.length < 2) return;
  const [keeper, ...losers] = ids;

  // Reparent child rows to the keeper mission.
  await db
    .update(missionTasks)
    .set({ missionId: keeper })
    .where(inArray(missionTasks.missionId, losers));
  await db
    .update(missionMessages)
    .set({ missionId: keeper })
    .where(inArray(missionMessages.missionId, losers));
  await db
    .update(missionArtifacts)
    .set({ missionId: keeper })
    .where(inArray(missionArtifacts.missionId, losers));

  // Delete the loser missions. Cascading FKs are ON DELETE CASCADE for tasks/
  // messages/artifacts — but we already moved them, so cascade will not touch
  // any rows.
  await db.delete(missions).where(inArray(missions.id, losers));
}

async function main() {
  console.log(
    `[dedupe-missions] mode = ${DRY_RUN ? "DRY RUN" : "EXECUTE"}${AGGRESSIVE ? " (aggressive: no time window)" : ""}`,
  );

  const sourceGroups = await findSourceEntityDuplicates();
  console.log(
    `[dedupe-missions] source-entity duplicate groups: ${sourceGroups.length}`,
  );
  let sourceLoserCount = 0;
  for (const g of sourceGroups) {
    const losers = g.ids.length - 1;
    sourceLoserCount += losers;
    console.log(
      `  • (${g.organization_id}, ${g.source_module}, ${g.source_entity_id}) — ${g.ids.length} rows, merging ${losers}`,
    );
  }

  const userGroups = await findUserSubmitDuplicates();
  console.log(
    `[dedupe-missions] user-submit duplicate groups (within 30s): ${userGroups.length}`,
  );
  let userLoserCount = 0;
  for (const g of userGroups) {
    const losers = g.ids.length - 1;
    userLoserCount += losers;
    console.log(
      `  • (${g.organization_id}, ${g.title.slice(0, 40)}) — ${g.ids.length} rows, merging ${losers}`,
    );
  }

  console.log(
    `[dedupe-missions] total rows to merge: ${sourceLoserCount + userLoserCount}`,
  );

  if (DRY_RUN) {
    console.log("[dedupe-missions] dry run — no changes made. Re-run with --execute to apply.");
    return;
  }

  for (const g of sourceGroups) {
    await mergeDuplicateGroup(g.ids);
  }
  for (const g of userGroups) {
    await mergeDuplicateGroup(g.ids);
  }
  console.log("[dedupe-missions] done");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

/**
 * One-time cleanup: merge duplicate employee_scenarios rows.
 *
 * Root cause: `src/db/seed.ts` used plain INSERT without onConflictDoNothing,
 * so every `npm run db:seed` re-run appended fresh copies. Combined with no
 * unique constraint on (org, slug, name), we accumulated N-way duplicates.
 *
 * Fix:
 *   1. This script removes existing duplicates, keeping the earliest `id`
 *      per (org, slug, name) group and repointing any saved_conversations
 *      rows that referenced losing IDs.
 *   2. Migration 0027 adds a unique index so the DB blocks future dupes.
 *   3. seed.ts now uses onConflictDoUpdate.
 *
 * Usage:
 *   npx tsx scripts/dedupe-employee-scenarios.ts            # dry run
 *   npx tsx scripts/dedupe-employee-scenarios.ts --execute  # actually delete
 *
 * Order of operations when deploying:
 *   1. Run this script in `--execute` mode (clears existing duplicates)
 *   2. `npm run db:migrate` (adds the unique index — would fail without step 1)
 *   3. Deploy code (seed.ts upsert + schema change)
 */
import { db } from "@/db";
import { employeeScenarios, savedConversations } from "@/db/schema";
import { sql, inArray, eq } from "drizzle-orm";

const DRY_RUN = !process.argv.includes("--execute");

async function findDuplicateGroups() {
  const rows = await db.execute<{
    organization_id: string;
    employee_slug: string;
    name: string;
    ids: string[];
  }>(sql`
    SELECT organization_id,
           employee_slug,
           name,
           array_agg(id ORDER BY created_at ASC) AS ids
    FROM employee_scenarios
    GROUP BY organization_id, employee_slug, name
    HAVING COUNT(*) > 1
  `);
  return rows;
}

async function mergeGroup(ids: string[]) {
  const [keeper, ...losers] = ids;
  if (losers.length === 0) return;

  // Repoint any saved_conversations that referenced the losing scenario IDs.
  // `saved_conversations.scenario_id` is a plain uuid column (no FK), so
  // nothing cascades automatically.
  await db
    .update(savedConversations)
    .set({ scenarioId: keeper })
    .where(inArray(savedConversations.scenarioId, losers));

  // Delete the loser scenarios.
  await db.delete(employeeScenarios).where(inArray(employeeScenarios.id, losers));
}

async function main() {
  console.log(
    `[dedupe-employee-scenarios] mode = ${DRY_RUN ? "DRY RUN" : "EXECUTE"}`,
  );

  const groups = await findDuplicateGroups();
  console.log(
    `[dedupe-employee-scenarios] duplicate groups: ${groups.length}`,
  );

  let totalLosers = 0;
  for (const g of groups) {
    const losers = g.ids.length - 1;
    totalLosers += losers;
    console.log(
      `  • (${g.employee_slug}, ${g.name}) — ${g.ids.length} rows, merging ${losers}`,
    );
  }
  console.log(
    `[dedupe-employee-scenarios] total rows to delete: ${totalLosers}`,
  );

  if (DRY_RUN) {
    console.log(
      "[dedupe-employee-scenarios] dry run — no changes made. Re-run with --execute to apply.",
    );
    return;
  }

  for (const g of groups) {
    await mergeGroup(g.ids);
  }
  console.log("[dedupe-employee-scenarios] done");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

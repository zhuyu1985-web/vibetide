// sync-workflows-to-md.ts
// Reverse direction: database workflow_templates.content →
// workflows/<slug>/SKILL.md files.
//
// Usage:  npx tsx scripts/sync-workflows-to-md.ts
//         npx tsx scripts/sync-workflows-to-md.ts --dry-run

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { writeWorkflowMdBody } from "../src/lib/skill-md-sync";

import { config } from "dotenv";
config({ path: ".env.local" });
config();

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { schema });

  const org = await db.query.organizations.findFirst({
    orderBy: (o, { asc }) => [asc(o.createdAt)],
  });
  if (!org) {
    console.error("No organization found.");
    process.exit(1);
  }
  console.log(`Using org as source: ${org.name} (${org.id})\n`);
  if (DRY_RUN) console.log(">>> DRY RUN — no files will be written\n");

  // Only export workflows with non-empty legacyScenarioKey + non-empty content
  const rows = await db.query.workflowTemplates.findMany({
    where: (w, { and, eq, isNotNull }) =>
      and(eq(w.organizationId, org.id), isNotNull(w.legacyScenarioKey)),
    orderBy: (w, { asc }) => [asc(w.legacyScenarioKey)],
  });

  let written = 0;
  let skipped = 0;
  for (const row of rows) {
    if (!row.legacyScenarioKey || !row.content) {
      console.log(`  SKIP  ${row.legacyScenarioKey ?? "(no slug)"} — empty content`);
      skipped++;
      continue;
    }
    if (DRY_RUN) {
      console.log(
        `  WOULD WRITE  workflows/${row.legacyScenarioKey}/SKILL.md — ${row.content.length} chars`,
      );
      written++;
      continue;
    }
    const ok = writeWorkflowMdBody(row.legacyScenarioKey, row.content);
    if (ok) {
      console.log(
        `  WROTE  workflows/${row.legacyScenarioKey}/SKILL.md — ${row.content.length} chars`,
      );
      written++;
    } else {
      console.log(
        `  FAILED  ${row.legacyScenarioKey} — workflows/${row.legacyScenarioKey}/ directory missing`,
      );
      skipped++;
    }
  }

  console.log(`\nDone: ${written} ${DRY_RUN ? "would be" : ""} written, ${skipped} skipped.`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

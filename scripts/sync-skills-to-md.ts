// sync-skills-to-md.ts
// Reverse direction: database skills.content → skills/<slug>/SKILL.md files.
//
// When to use:
// - After making bulk UI edits and wanting to persist them to git
// - As part of a one-time export / backup
// - When DB and filesystem have diverged (use this to make filesystem match DB)
//
// Preserves existing frontmatter in SKILL.md; only replaces the body.
//
// Usage:  npx tsx scripts/sync-skills-to-md.ts
//         npx tsx scripts/sync-skills-to-md.ts --dry-run  (preview only)

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { writeSkillMdBody } from "../src/lib/skill-md-sync";

import { config } from "dotenv";
config({ path: ".env.local" });
config();

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { schema });

  // Use the oldest org as canonical source (skills are per-org but builtin
  // skills have the same content across orgs).
  const org = await db.query.organizations.findFirst({
    orderBy: (o, { asc }) => [asc(o.createdAt)],
  });
  if (!org) {
    console.error("No organization found.");
    process.exit(1);
  }
  console.log(`Using org as source: ${org.name} (${org.id})\n`);
  if (DRY_RUN) console.log(">>> DRY RUN — no files will be written\n");

  // Only export skills with non-empty slug + non-empty content
  const rows = await db.query.skills.findMany({
    where: (s, { and, eq, isNotNull }) =>
      and(eq(s.organizationId, org.id), isNotNull(s.slug)),
    orderBy: (s, { asc }) => [asc(s.slug)],
  });

  let written = 0;
  let skipped = 0;
  for (const row of rows) {
    if (!row.slug || !row.content) {
      console.log(`  SKIP  ${row.slug ?? "(no slug)"} — empty content`);
      skipped++;
      continue;
    }
    if (DRY_RUN) {
      console.log(`  WOULD WRITE  skills/${row.slug}/SKILL.md — ${row.content.length} chars`);
      written++;
      continue;
    }
    const ok = writeSkillMdBody(row.slug, row.content);
    if (ok) {
      console.log(`  WROTE  skills/${row.slug}/SKILL.md — ${row.content.length} chars`);
      written++;
    } else {
      console.log(`  FAILED  ${row.slug} — skills/${row.slug}/ directory missing`);
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

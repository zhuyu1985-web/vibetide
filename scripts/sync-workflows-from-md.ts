// sync-workflows-from-md.ts
// Reads workflows/<slug>/SKILL.md files and syncs content to the database
// workflow_templates table. Maps via `legacy_scenario_key` to find DB records.
// Mirrors scripts/sync-skills-from-md.ts for the workflow side.
//
// Usage:  npx tsx scripts/sync-workflows-from-md.ts

import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import * as fs from "node:fs";
import * as path from "node:path";

import { config } from "dotenv";
config({ path: ".env.local" });
config();

const WORKFLOWS_DIR = path.resolve(__dirname, "../workflows");

// Parse SKILL.md: strip YAML frontmatter, return body content + extracted fields
function parseSkillMd(filePath: string): {
  name: string | null;
  displayName: string | null;
  description: string | null;
  content: string;
} {
  const raw = fs.readFileSync(filePath, "utf-8");

  if (!raw.startsWith("---")) {
    return { name: null, displayName: null, description: null, content: raw.trim() };
  }

  const endIdx = raw.indexOf("---", 3);
  if (endIdx === -1) {
    return { name: null, displayName: null, description: null, content: raw.trim() };
  }

  const frontmatter = raw.slice(3, endIdx).trim();
  const body = raw.slice(endIdx + 3).trim();

  let name: string | null = null;
  let displayName: string | null = null;
  let description: string | null = null;
  for (const line of frontmatter.split("\n")) {
    const nameMatch = line.match(/^name:\s*(.+)/);
    if (nameMatch) name = nameMatch[1].trim().replace(/^["']|["']$/g, "");

    const displayMatch = line.match(/^displayName:\s*(.+)/);
    if (displayMatch) displayName = displayMatch[1].trim().replace(/^["']|["']$/g, "");

    const descMatch = line.match(/^description:\s*(.+)/);
    if (descMatch) description = descMatch[1].trim().replace(/^["']|["']$/g, "");
  }

  return { name, displayName, description, content: body };
}

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { schema });

  // Iterate over all orgs (workflow_templates 是 multi-tenant)
  const orgs = await db.query.organizations.findMany({
    orderBy: (o, { asc }) => [asc(o.createdAt)],
  });
  if (orgs.length === 0) {
    console.error("No organization found. Run db:seed first.");
    process.exit(1);
  }
  console.log(`Found ${orgs.length} organization(s). Syncing to all…\n`);

  // Read all workflow directories
  const dirs = fs.readdirSync(WORKFLOWS_DIR).filter((d) => {
    const stat = fs.statSync(path.join(WORKFLOWS_DIR, d));
    return stat.isDirectory();
  });

  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalNotFound = 0;

  for (const org of orgs) {
    console.log(`\n━━━ Organization: ${org.name} (${org.id}) ━━━`);
    let updated = 0;
    let skipped = 0;
    let notFound = 0;

    for (const slug of dirs) {
      const mdPath = path.join(WORKFLOWS_DIR, slug, "SKILL.md");
      if (!fs.existsSync(mdPath)) {
        console.log(`  SKIP  ${slug} — no SKILL.md`);
        skipped++;
        continue;
      }

      const { description, content } = parseSkillMd(mdPath);

      // Find the workflow_templates row by legacyScenarioKey + org
      // The slug in workflows/<slug>/ directory matches legacy_scenario_key.
      const dbRow = await db.query.workflowTemplates.findFirst({
        where: (w, { eq, and }) =>
          and(
            eq(w.organizationId, org.id),
            eq(w.legacyScenarioKey, slug),
          ),
      });

      if (!dbRow) {
        console.log(`  NOT FOUND  ${slug} — not in database (need seed first)`);
        notFound++;
        continue;
      }

      const updateData: Record<string, unknown> = {
        content,
        updatedAt: new Date(),
      };
      if (description) {
        updateData.description = description;
      }

      await db
        .update(schema.workflowTemplates)
        .set(updateData)
        .where(eq(schema.workflowTemplates.id, dbRow.id));

      console.log(`  UPDATED  ${slug} — ${content.length} chars`);
      updated++;
    }

    console.log(`  Org summary: ${updated} updated, ${skipped} skipped, ${notFound} not found`);
    totalUpdated += updated;
    totalSkipped += skipped;
    totalNotFound += notFound;
  }

  console.log(`\n━━━ TOTAL: ${totalUpdated} updated, ${totalSkipped} skipped, ${totalNotFound} not found ━━━`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

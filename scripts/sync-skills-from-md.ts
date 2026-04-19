// sync-skills-from-md.ts
// Reads skills/*/SKILL.md files and syncs content to the database skills table.
// Maps via skill-loader slug -> name to find DB records, then updates content.
// Usage: npx tsx scripts/sync-skills-from-md.ts

import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { getBuiltinSkillSlugToName } from "../src/lib/skill-loader";
import * as fs from "node:fs";
import * as path from "node:path";

import { config } from "dotenv";
config({ path: ".env.local" });
config();

const SKILLS_DIR = path.resolve(__dirname, "../skills");

// Build slug -> name map from skill-loader
const slugToName = getBuiltinSkillSlugToName();

// Parse SKILL.md: strip YAML frontmatter, return body content
function parseSkillMd(filePath: string): { name: string | null; description: string | null; content: string } {
  const raw = fs.readFileSync(filePath, "utf-8");

  // Check for frontmatter
  if (!raw.startsWith("---")) {
    return { name: null, description: null, content: raw.trim() };
  }

  const endIdx = raw.indexOf("---", 3);
  if (endIdx === -1) {
    return { name: null, description: null, content: raw.trim() };
  }

  const frontmatter = raw.slice(3, endIdx).trim();
  const body = raw.slice(endIdx + 3).trim();

  // Extract name and description from frontmatter
  let name: string | null = null;
  let description: string | null = null;
  for (const line of frontmatter.split("\n")) {
    const nameMatch = line.match(/^name:\s*(.+)/);
    if (nameMatch) name = nameMatch[1].trim().replace(/^["']|["']$/g, "");

    const descMatch = line.match(/^description:\s*(.+)/);
    if (descMatch) description = descMatch[1].trim().replace(/^["']|["']$/g, "");
  }

  return { name, description, content: body };
}

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { schema });

  // Find the default organization (oldest one — matches main seed behavior).
  // Previously hard-coded to "vibe-media-demo"; that slug no longer exists
  // after consolidating to a single tenant (华栖云传媒集团).
  const org = await db.query.organizations.findFirst({
    orderBy: (o, { asc }) => [asc(o.createdAt)],
  });
  if (!org) {
    console.error("No organization found. Run db:seed first.");
    process.exit(1);
  }
  console.log(`Organization: ${org.name} (${org.id})\n`);

  // Read all skill directories
  const dirs = fs.readdirSync(SKILLS_DIR).filter((d) => {
    const stat = fs.statSync(path.join(SKILLS_DIR, d));
    return stat.isDirectory() && d !== "page-qa-fix"; // skip non-builtin skills
  });

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const slug of dirs) {
    const mdPath = path.join(SKILLS_DIR, slug, "SKILL.md");
    if (!fs.existsSync(mdPath)) {
      console.log(`  SKIP  ${slug} — no SKILL.md`);
      skipped++;
      continue;
    }

    const { description, content } = parseSkillMd(mdPath);

    // Find the Chinese name for this slug
    const chineseName = slugToName.get(slug);
    if (!chineseName) {
      console.log(`  SKIP  ${slug} — not a builtin skill`);
      skipped++;
      continue;
    }

    // Find the skill in the database by name + organization
    const dbSkill = await db.query.skills.findFirst({
      where: (s, { eq, and }) =>
        and(eq(s.organizationId, org.id), eq(s.name, chineseName)),
    });

    if (!dbSkill) {
      console.log(`  NOT FOUND  ${slug} (${chineseName}) — not in database`);
      notFound++;
      continue;
    }

    // Update content (and description if available from SKILL.md)
    const updateData: Record<string, unknown> = {
      content,
      updatedAt: new Date(),
    };
    if (description) {
      updateData.description = description;
    }

    await db
      .update(schema.skills)
      .set(updateData)
      .where(eq(schema.skills.id, dbSkill.id));

    console.log(`  UPDATED  ${slug} (${chineseName}) — ${content.length} chars`);
    updated++;
  }

  console.log(`\nDone: ${updated} updated, ${skipped} skipped, ${notFound} not found`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

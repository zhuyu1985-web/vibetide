// Cross-reference _journal.json entries with __drizzle_migrations DB table.
// Drizzle stores SHA-256 of the SQL file content (without breakpoint comments)
// in `hash` column. We compute the same hash and identify the gap.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { config } from "dotenv";
config({ path: ".env.local" });

const MIGRATIONS_DIR = "supabase/migrations";

async function main() {
  const journalPath = join(MIGRATIONS_DIR, "meta/_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf-8"));

  // For each entry in journal, compute its hash
  const journalRows: { idx: number; tag: string; hash: string }[] = [];
  for (const entry of journal.entries) {
    const sqlPath = join(MIGRATIONS_DIR, `${entry.tag}.sql`);
    let sql: string;
    try {
      sql = readFileSync(sqlPath, "utf-8");
    } catch (e) {
      console.warn(`SKIP ${entry.tag}: file not found`);
      continue;
    }
    // Drizzle hashes the file content as-is (does not strip statement breakpoints).
    // See: drizzle-orm/src/migrator.ts → readMigrationFiles
    const hash = createHash("sha256").update(sql).digest("hex");
    journalRows.push({ idx: entry.idx, tag: entry.tag, hash });
  }

  // Read DB applied hashes
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL not set");
  const sql = postgres(dbUrl);
  const dbRows = await sql<{ id: number; hash: string; created_at: string }[]>`
    SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id
  `;
  const applied = new Set(dbRows.map((r) => r.hash));

  console.log("\n=== APPLIED in DB but missing from journal? ===");
  const journalHashes = new Set(journalRows.map((r) => r.hash));
  for (const r of dbRows) {
    if (!journalHashes.has(r.hash)) {
      console.log(`  DB id=${r.id} hash=${r.hash.slice(0, 12)} NOT in journal`);
    }
  }

  console.log("\n=== In JOURNAL but missing from DB (will be re-applied) ===");
  for (const r of journalRows) {
    if (!applied.has(r.hash)) {
      console.log(`  idx=${r.idx} tag=${r.tag} hash=${r.hash.slice(0, 12)} NOT APPLIED`);
    }
  }

  console.log(`\nJournal entries: ${journalRows.length}`);
  console.log(`DB applied:      ${dbRows.length}`);

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

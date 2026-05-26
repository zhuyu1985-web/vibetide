// scripts/mark-pending-migrations-applied.ts
// 解决问题：drizzle journal 有 N 条 entry，但 __drizzle_migrations 表少 7+ 条；
//          这些 "pending" migration 早就被手工 psql 直接应用到 DB；
//          再跑 db:migrate 会因 "already exists" 报错。
//
// 行为：对 journal 里 NOT in __drizzle_migrations 的 entry（除 EXCEPT_TAGS 外），
//      按 drizzle 的 sha256(file_content) 算法 INSERT 到 __drizzle_migrations。
//      跑完后 db:migrate 会跳过它们，只应用 EXCEPT_TAGS 列出的（通常是新写的 idempotent catchup）。
//
// 用法：tsx scripts/mark-pending-migrations-applied.ts [--except <tag1>,<tag2>,...]
// 默认 --except 0039_catchup_post_scheduled_jobs

import postgres from "postgres";
import * as fs from "node:fs";
import * as path from "node:path";
import crypto from "node:crypto";
import { config } from "dotenv";

config({ path: ".env.local" });

const args = process.argv.slice(2);
const exceptArgIdx = args.indexOf("--except");
const exceptTags = new Set(
  exceptArgIdx >= 0 && args[exceptArgIdx + 1]
    ? args[exceptArgIdx + 1].split(",").map((s) => s.trim())
    : ["0039_catchup_post_scheduled_jobs"],
);

const migrationsFolder = path.resolve(process.cwd(), "supabase/migrations");
const journalPath = path.join(migrationsFolder, "meta/_journal.json");

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface Journal {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

async function main() {
  const journal: Journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });

  try {
    const existingRows = await client<{ hash: string; created_at: bigint }[]>`
      SELECT hash, created_at FROM drizzle.__drizzle_migrations
    `;
    const existingHashes = new Set(existingRows.map((r) => r.hash));
    const existingByTimestamp = new Set(existingRows.map((r) => Number(r.created_at)));

    let inserted = 0;
    let skipped = 0;

    for (const entry of journal.entries) {
      if (exceptTags.has(entry.tag)) {
        console.log(`[skip-by-except] ${entry.tag}`);
        skipped++;
        continue;
      }
      // 已有 timestamp 的 entry 就算 applied
      if (existingByTimestamp.has(entry.when)) {
        skipped++;
        continue;
      }
      // 计算 hash
      const filePath = path.join(migrationsFolder, `${entry.tag}.sql`);
      if (!fs.existsSync(filePath)) {
        console.warn(`[missing-file] ${entry.tag}.sql — skipping`);
        skipped++;
        continue;
      }
      const content = fs.readFileSync(filePath, "utf-8");
      const hash = crypto.createHash("sha256").update(content).digest("hex");
      if (existingHashes.has(hash)) {
        skipped++;
        continue;
      }
      await client`
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES (${hash}, ${entry.when})
      `;
      console.log(`[marked-applied] ${entry.tag} hash=${hash.slice(0, 12)}...`);
      inserted++;
    }

    console.log(`\n✓ ${inserted} inserted, ${skipped} skipped`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

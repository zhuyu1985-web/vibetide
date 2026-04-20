// run-catchup-migration.ts
// 执行 0029_catchup_hand_written_migrations.sql 到远程 Supabase DB
// 验证幂等性（已有所有对象时应完全 no-op）。

import postgres from "postgres";
import * as fs from "node:fs";
import * as path from "node:path";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  const sqlPath = path.resolve(
    __dirname,
    "../supabase/migrations/0029_catchup_hand_written_migrations.sql",
  );
  const sql = fs.readFileSync(sqlPath, "utf-8");

  const client = postgres(process.env.DATABASE_URL!, { prepare: false });

  try {
    console.log("执行 0029_catchup_hand_written_migrations.sql...");
    // 按 --> statement-breakpoint 拆分并逐条执行
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith("--") && s !== "");

    console.log(`共 ${statements.length} 条 DDL statements`);
    let success = 0;
    let skipped = 0;
    let failed = 0;

    for (const [i, stmt] of statements.entries()) {
      try {
        await client.unsafe(stmt);
        success++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes("already exists") ||
          msg.includes("does not exist") ||
          msg.includes("duplicate")
        ) {
          skipped++;
        } else {
          failed++;
          console.error(`✗ Statement ${i + 1} failed: ${msg}`);
          console.error(`  SQL: ${stmt.slice(0, 100)}...`);
        }
      }
    }

    console.log(`\n✓ ${success} succeeded, ${skipped} idempotent-skipped, ${failed} failed`);
    if (failed > 0) process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

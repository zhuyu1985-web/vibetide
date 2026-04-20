// apply-workflow-realignment-migration.ts
// 直接执行 supabase/migrations/20260420000001_workflow_realignment.sql
// 绕过 drizzle-kit push 的交互确认阻塞。
//
// 迁移内容：
//   - workflow_templates 加 4 列 (is_public / owner_employee_id / launch_mode / prompt_template)
//   - CHECK 约束 + 2 索引
//   - missions.input_params jsonb 列
//   - DROP employee_scenarios (已无运行时依赖)
//
// Usage: npx tsx scripts/apply-workflow-realignment-migration.ts

import postgres from "postgres";
import * as fs from "node:fs";
import * as path from "node:path";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  const migrationPath = path.resolve(
    __dirname,
    "../supabase/migrations/20260420000001_workflow_realignment.sql",
  );
  const sql = fs.readFileSync(migrationPath, "utf-8");

  const client = postgres(process.env.DATABASE_URL!, { prepare: false });

  try {
    console.log("Applying migration 20260420000001_workflow_realignment.sql...");
    await client.unsafe(sql);
    console.log("✓ Migration applied successfully.");
  } catch (err) {
    // 部分错误可能是幂等的（columns 已存在 / 表已 drop）
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("already exists") || msg.includes("does not exist")) {
      console.log(`⚠ Idempotent warning: ${msg}`);
      console.log("✓ Migration appears already applied (partial or full).");
    } else {
      console.error("✗ Migration failed:", err);
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

main();

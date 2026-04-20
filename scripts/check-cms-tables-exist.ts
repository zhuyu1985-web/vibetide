// check-cms-tables-exist.ts
// 检查 CMS 相关表在 DB 中是否存在（cms_mapping.ts schema 有定义但可能没有迁移 SQL）

import postgres from "postgres";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });

  // 列出 schema 中定义、需要检查的表
  const tablesToCheck = [
    "cms_channels",
    "cms_apps",
    "cms_catalogs",
    "cms_sync_logs",
    "cms_publications",
    "app_channels",
  ];

  const existing = await client<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = ANY(${tablesToCheck})
    ORDER BY table_name
  `;

  const existingSet = new Set(existing.map((r) => r.table_name));

  console.log("\n━━━ CMS 相关表存在性检查 ━━━\n");
  for (const t of tablesToCheck) {
    const ok = existingSet.has(t);
    console.log(`${ok ? "✅" : "❌"} ${t}`);
  }

  const missing = tablesToCheck.filter((t) => !existingSet.has(t));
  console.log(
    `\n━━━ ${existing.length}/${tablesToCheck.length} 存在，${missing.length} 缺失 ━━━`,
  );
  if (missing.length > 0) {
    console.log(`缺失的表: ${missing.join(", ")}`);
  }

  await client.end();
  if (missing.length > 0) process.exit(1);
}

main();

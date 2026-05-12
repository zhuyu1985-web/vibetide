// mark-employees-as-custom.ts
//
// 把 xiaoyan（学术研究员）和 xiaotan（深度调查员）在所有 org 的
// `ai_employees.is_preset` 字段从 1 改成 0，让它们在 UI 的"AI 员工"列表里
// 落到"自定义员工"分组。Idempotent —— 反复跑结果一致。
//
// Usage:
//   npx tsx scripts/mark-employees-as-custom.ts

import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray, and } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { config } from "dotenv";

config({ path: ".env.local" });
config();

const SLUGS_TO_MARK_CUSTOM = ["xiaoyan", "xiaotan"] as const;

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client, { schema });

  const before = await db
    .select({
      id: schema.aiEmployees.id,
      slug: schema.aiEmployees.slug,
      name: schema.aiEmployees.name,
      organizationId: schema.aiEmployees.organizationId,
      isPreset: schema.aiEmployees.isPreset,
    })
    .from(schema.aiEmployees)
    .where(inArray(schema.aiEmployees.slug, [...SLUGS_TO_MARK_CUSTOM]));

  console.log(`Found ${before.length} rows for ${SLUGS_TO_MARK_CUSTOM.join(", ")}`);
  for (const row of before) {
    console.log(
      `  [${row.organizationId.slice(0, 8)}] ${row.slug} (${row.name}) — isPreset=${row.isPreset}`,
    );
  }

  if (before.length === 0) {
    console.log("Nothing to update.");
    await client.end();
    return;
  }

  const result = await db
    .update(schema.aiEmployees)
    .set({ isPreset: 0 })
    .where(
      and(
        inArray(schema.aiEmployees.slug, [...SLUGS_TO_MARK_CUSTOM]),
        eq(schema.aiEmployees.isPreset, 1),
      ),
    )
    .returning({
      id: schema.aiEmployees.id,
      slug: schema.aiEmployees.slug,
    });

  console.log(`\nUpdated ${result.length} row(s) to is_preset=0`);
  for (const row of result) {
    console.log(`  ${row.slug} (${row.id})`);
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

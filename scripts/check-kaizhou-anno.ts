import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();
async function main() {
  const { db } = await import("@/db");
  const { sql } = await import("drizzle-orm");
  const orgId = "a0000000-0000-4000-8000-000000000001";
  const r = await db.execute(sql`
    SELECT
      COUNT(DISTINCT ci.id)::int AS total_items,
      COUNT(DISTINCT ict.collected_item_id)::int AS has_topic,
      COUNT(DISTINCT icd.collected_item_id)::int AS has_district
    FROM collected_items ci
    LEFT JOIN research_collected_item_topics ict ON ict.collected_item_id = ci.id
    LEFT JOIN research_collected_item_districts icd ON icd.collected_item_id = ci.id
    WHERE ci.organization_id = ${orgId} AND ci.author = '帅开州'
      AND ci.published_at >= '2025-01-01' AND ci.published_at < '2026-01-01'
  `);
  console.log(`author='帅开州' annotation 状态: ${JSON.stringify((r as any)[0])}`);
  process.exit(0);
}
main();

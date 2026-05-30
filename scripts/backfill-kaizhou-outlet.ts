import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();
async function main() {
  const { db } = await import("@/db");
  const { sql } = await import("drizzle-orm");
  
  const orgId = "a0000000-0000-4000-8000-000000000001";
  
  // 找出开州融媒的 outlet
  const olRow = await db.execute(sql`
    SELECT id, outlet_tier, outlet_region FROM media_outlet_dictionary WHERE outlet_name = '开州融媒'
  `);
  const ol = (olRow as any)[0];
  console.log(`开州融媒 outlet id=${ol.id}, tier=${ol.outlet_tier}, region=${ol.outlet_region}`);
  
  // 检查 author='帅开州' 在 2025 内的 items 数 + 有多少缺 outlet_id
  const before = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(CASE WHEN outlet_id IS NULL THEN 1 END)::int AS null_outlet,
      COUNT(CASE WHEN outlet_id IS NOT NULL THEN 1 END)::int AS has_outlet
    FROM collected_items
    WHERE organization_id = ${orgId}
      AND author = '帅开州'
      AND published_at >= '2025-01-01' AND published_at < '2026-01-01'
  `);
  console.log(`author='帅开州' 2025: ${JSON.stringify((before as any)[0])}`);
  
  // 回填
  const upd = await db.execute(sql`
    UPDATE collected_items
    SET outlet_id = ${ol.id}::uuid,
        outlet_tier = ${ol.outlet_tier},
        outlet_region = ${ol.outlet_region}
    WHERE organization_id = ${orgId}
      AND author = '帅开州'
      AND outlet_id IS NULL
    RETURNING id
  `);
  console.log(`✓ 已回填 ${(upd as any).length} 条 items 的 outlet_id`);
  
  process.exit(0);
}
main();

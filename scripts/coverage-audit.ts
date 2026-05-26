/**
 * 盘点 2025 年数据覆盖率
 * 1) 总 items / 有 outletId / 有 topic annotation / 有 district annotation
 * 2) 按 outlet_tier 分组的 items 数
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

async function main() {
  const { db } = await import("@/db");
  const { sql } = await import("drizzle-orm");

  const orgRows = await db.execute(sql`SELECT id, name FROM organizations LIMIT 5`);
  const orgId = (orgRows as any)[0].id;
  console.log(`org: ${orgId} (${(orgRows as any)[0].name})`);

  // 总览
  const overview = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(outlet_id)::int AS with_outlet,
      COUNT(CASE WHEN published_at >= '2025-01-01' AND published_at < '2026-01-01' THEN 1 END)::int AS in_2025,
      COUNT(CASE WHEN published_at >= '2025-01-01' AND published_at < '2026-01-01' AND outlet_id IS NOT NULL THEN 1 END)::int AS in_2025_with_outlet
    FROM collected_items
    WHERE organization_id = ${orgId}
  `);
  console.log("\n=== collected_items 总览 ===");
  for (const r of overview as any) {
    console.log(`  total=${r.total}, with_outlet=${r.with_outlet}, in_2025=${r.in_2025}, in_2025+outlet=${r.in_2025_with_outlet}`);
  }

  // 按 tier 分组（2025 年 + 有 outlet）
  const byTier = await db.execute(sql`
    SELECT mod.outlet_tier, COUNT(*)::int AS n
    FROM collected_items ci
    JOIN media_outlet_dictionary mod ON ci.outlet_id = mod.id
    WHERE ci.organization_id = ${orgId}
      AND ci.published_at >= '2025-01-01' AND ci.published_at < '2026-01-01'
    GROUP BY mod.outlet_tier
    ORDER BY n DESC
  `);
  console.log("\n=== 2025 年 按 outlet_tier 分组 ===");
  for (const r of byTier as any) {
    console.log(`  ${r.outlet_tier ?? "(null)"}: ${r.n}`);
  }

  // annotation 覆盖率
  const annStats = await db.execute(sql`
    SELECT
      (SELECT COUNT(DISTINCT collected_item_id)::int FROM research_collected_item_topics) AS items_with_topic,
      (SELECT COUNT(DISTINCT collected_item_id)::int FROM research_collected_item_districts) AS items_with_district,
      (SELECT COUNT(*)::int FROM research_collected_item_topics) AS topic_annotations,
      (SELECT COUNT(*)::int FROM research_collected_item_districts) AS district_annotations
  `);
  console.log("\n=== annotation 覆盖率 ===");
  for (const r of annStats as any) {
    console.log(`  items_with_topic=${r.items_with_topic}, items_with_district=${r.items_with_district}`);
    console.log(`  topic_annotations=${r.topic_annotations}, district_annotations=${r.district_annotations}`);
  }

  // topic 名单
  console.log("\n=== research_topics 列表（看是不是体系 docx 中的 16 个主题）===");
  const topics = await db.execute(sql`
    SELECT name, id FROM research_topics WHERE organization_id = ${orgId} ORDER BY name
  `);
  for (const r of topics as any) console.log(`  - ${r.name}`);
  console.log(`  共 ${(topics as any).length}`);

  // cq_districts 名单
  console.log("\n=== cq_districts 列表 ===");
  const districts = await db.execute(sql`SELECT name, id FROM cq_districts ORDER BY name`);
  for (const r of districts as any) console.log(`  - ${r.name}`);
  console.log(`  共 ${(districts as any).length}`);

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

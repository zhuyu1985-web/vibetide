import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();
async function main() {
  const { db } = await import("@/db");
  const { sql } = await import("drizzle-orm");
  const orgRows = await db.execute(sql`SELECT id, name FROM organizations LIMIT 5`);
  const orgId = (orgRows as any)[0].id;
  console.log(`org=${orgId}`);

  const a = await db.execute(sql`
    SELECT COUNT(*)::int AS c FROM collected_items
    WHERE organization_id = ${orgId} AND published_at >= '2025-01-01' AND published_at < '2026-01-01'
  `);
  console.log(`2025 items: ${(a as any)[0].c}`);

  const b = await db.execute(sql`
    SELECT COUNT(*)::int AS c FROM collected_items ci
    JOIN media_outlet_dictionary mod ON ci.outlet_id = mod.id
    WHERE ci.organization_id = ${orgId} AND ci.published_at >= '2025-01-01' AND ci.published_at < '2026-01-01'
  `);
  console.log(`2025 + outlet: ${(b as any)[0].c}`);

  const c = await db.execute(sql`SELECT COUNT(*)::int AS c FROM research_collected_item_districts`);
  console.log(`district annotations: ${(c as any)[0].c}`);

  const d = await db.execute(sql`SELECT COUNT(*)::int AS c FROM research_collected_item_topics`);
  console.log(`topic annotations: ${(d as any)[0].c}`);

  // 真正的 4-way JOIN
  const e = await db.execute(sql`
    SELECT COUNT(*)::int AS c
    FROM collected_items ci
    JOIN research_collected_item_districts icd ON icd.collected_item_id = ci.id
    JOIN research_collected_item_topics ict ON ict.collected_item_id = ci.id
    JOIN media_outlet_dictionary mod ON ci.outlet_id = mod.id
    WHERE ci.organization_id = ${orgId}
      AND ci.published_at >= '2025-01-01' AND ci.published_at < '2026-01-01'
  `);
  console.log(`4-way JOIN (无 tier 过滤): ${(e as any)[0].c}`);

  const f = await db.execute(sql`
    SELECT mod.outlet_tier, COUNT(*)::int AS c
    FROM collected_items ci
    JOIN research_collected_item_districts icd ON icd.collected_item_id = ci.id
    JOIN research_collected_item_topics ict ON ict.collected_item_id = ci.id
    JOIN media_outlet_dictionary mod ON ci.outlet_id = mod.id
    WHERE ci.organization_id = ${orgId}
      AND ci.published_at >= '2025-01-01' AND ci.published_at < '2026-01-01'
    GROUP BY mod.outlet_tier
  `);
  console.log(`4-way JOIN by tier:`);
  for (const r of f as any) console.log(`  ${r.outlet_tier}: ${r.c}`);

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

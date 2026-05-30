/**
 * 为可验证版 xlsx 采集元数据 :
 *   - 各 tier 的真实 outlet 清单
 *   - 数据范围审计
 * 输出 /tmp/audit-meta.json
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

async function main() {
  const { db } = await import("@/db");
  const { sql } = await import("drizzle-orm");
  const fs = await import("node:fs");

  const orgRows = await db.execute(sql`SELECT id, name FROM organizations LIMIT 1`);
  const orgId = (orgRows as any)[0].id;

  // 各 tier outlet 清单
  const outlets: Record<string, Array<{ name: string; region: string | null; pa: string[] }>> = {};
  for (const tier of ["central", "industry", "provincial_municipal", "district_media", "government_self_media"]) {
    const rows = await db.execute(sql`
      SELECT outlet_name, outlet_region, public_account_names
      FROM media_outlet_dictionary
      WHERE outlet_tier = ${tier} ORDER BY outlet_region NULLS LAST, outlet_name
    `);
    outlets[tier] = (rows as any).map((r: any) => ({
      name: r.outlet_name, region: r.outlet_region,
      pa: r.public_account_names ?? [],
    }));
  }

  // 数据范围审计
  const audit: Record<string, any> = {};
  const a = await db.execute(sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(outlet_id)::int AS with_outlet,
      COUNT(CASE WHEN published_at >= '2025-01-01' AND published_at < '2026-01-01' THEN 1 END)::int AS in_2025,
      COUNT(CASE WHEN published_at >= '2025-01-01' AND published_at < '2026-01-01' AND outlet_id IS NOT NULL THEN 1 END)::int AS in_2025_with_outlet
    FROM collected_items WHERE organization_id = ${orgId}
  `);
  audit.items = (a as any)[0];

  // 各 tier 在 2025 + 有 outlet 的 items 数
  const b = await db.execute(sql`
    SELECT mod.outlet_tier, COUNT(*)::int AS n
    FROM collected_items ci
    JOIN media_outlet_dictionary mod ON ci.outlet_id = mod.id
    WHERE ci.organization_id = ${orgId}
      AND ci.published_at >= '2025-01-01' AND ci.published_at < '2026-01-01'
    GROUP BY mod.outlet_tier ORDER BY n DESC
  `);
  audit.by_tier = b as any;

  // annotation 覆盖
  const c = await db.execute(sql`
    SELECT
      (SELECT COUNT(DISTINCT collected_item_id)::int FROM research_collected_item_topics) AS items_w_topic,
      (SELECT COUNT(DISTINCT collected_item_id)::int FROM research_collected_item_districts) AS items_w_district,
      (SELECT COUNT(*)::int FROM research_collected_item_topics) AS topic_n,
      (SELECT COUNT(*)::int FROM research_collected_item_districts) AS district_n
  `);
  audit.annotations = (c as any)[0];

  // 每个区县的 items 数(2025 年 + 有 outlet)
  const d = await db.execute(sql`
    SELECT cqd.name, COUNT(DISTINCT ci.id)::int AS n
    FROM research_cq_districts cqd
    LEFT JOIN research_collected_item_districts icd ON icd.district_id = cqd.id
    LEFT JOIN collected_items ci ON ci.id = icd.collected_item_id
      AND ci.organization_id = ${orgId}
      AND ci.published_at >= '2025-01-01' AND ci.published_at < '2026-01-01'
      AND ci.outlet_id IS NOT NULL
    GROUP BY cqd.name ORDER BY n DESC
  `);
  audit.by_district = d as any;

  const out = { org_id: orgId, outlets, audit, captured_at: new Date().toISOString() };
  fs.writeFileSync("/tmp/audit-meta.json", JSON.stringify(out, null, 2));
  console.log("✓ 写: /tmp/audit-meta.json");
  console.log(`  - outlets: 中央 ${outlets.central.length} / 行业 ${outlets.industry.length} / 市级 ${outlets.provincial_municipal.length} / 区县 ${outlets.district_media.length} / 政务 ${outlets.government_self_media.length}`);
  console.log(`  - audit.items: ${JSON.stringify(audit.items)}`);
  console.log(`  - audit.by_tier 行数: ${audit.by_tier.length}`);
  console.log(`  - audit.annotations: ${JSON.stringify(audit.annotations)}`);
  console.log(`  - audit.by_district 行数: ${audit.by_district.length}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

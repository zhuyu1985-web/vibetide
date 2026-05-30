/**
 * 排查为什么政务 41 家和开州融媒 items=0
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

async function main() {
  const { db } = await import("@/db");
  const { sql } = await import("drizzle-orm");

  const orgId = "a0000000-0000-4000-8000-000000000001";

  // 1. 看 DB 中 outlet_tier='government_self_media' 的 outlet 有几个 items
  console.log("=== 政务新媒体 outlet 在 DB 中的 items 数 ===");
  const gov = await db.execute(sql`
    SELECT mod.outlet_name, COUNT(ci.id)::int AS n
    FROM media_outlet_dictionary mod
    LEFT JOIN collected_items ci ON ci.outlet_id = mod.id
      AND ci.organization_id = ${orgId}
      AND ci.published_at >= '2025-01-01' AND ci.published_at < '2026-01-01'
    WHERE mod.outlet_tier = 'government_self_media'
    GROUP BY mod.outlet_name
    ORDER BY n DESC
  `);
  let totalGov = 0;
  for (const r of gov as any) {
    totalGov += r.n;
    if (r.n > 0) console.log(`  ${r.outlet_name}: ${r.n}`);
  }
  console.log(`  政务总 items: ${totalGov}`);

  // 2. 看开州融媒情况
  console.log("\n=== 开州 区县融媒 outlet 详情 ===");
  const kz = await db.execute(sql`
    SELECT id, outlet_name, outlet_tier, public_account_names, domains
    FROM media_outlet_dictionary
    WHERE outlet_name LIKE '%开州%' OR public_account_names @> ARRAY['开州融媒']::text[]
       OR public_account_names @> ARRAY['开州日报']::text[]
  `);
  for (const r of kz as any) {
    console.log(`  ${r.outlet_name} (${r.outlet_tier}) PA=${JSON.stringify(r.public_account_names)}`);
    const cnt = await db.execute(sql`
      SELECT COUNT(*)::int AS n FROM collected_items
      WHERE organization_id = ${orgId}
        AND published_at >= '2025-01-01' AND published_at < '2026-01-01'
        AND outlet_id = ${r.id}::uuid
    `);
    console.log(`    → items: ${(cnt as any)[0].n}`);
  }

  // 3. 看 collected_items 里有没有 author='开州融媒' 但 outlet_id IS NULL 的
  console.log("\n=== collected_items 中 author 含'开州' 的 items ===");
  const kzItems = await db.execute(sql`
    SELECT author, COUNT(*)::int AS n
    FROM collected_items
    WHERE organization_id = ${orgId}
      AND author LIKE '%开州%'
    GROUP BY author ORDER BY n DESC LIMIT 20
  `);
  for (const r of kzItems as any) console.log(`  author='${r.author}': ${r.n}`);

  // 4. 政务号(生态环境)字典里 outlet_name 抽样
  console.log("\n=== 政务字典里前 5 个 + 其 publicAccountNames ===");
  const govDict = await db.execute(sql`
    SELECT outlet_name, public_account_names
    FROM media_outlet_dictionary
    WHERE outlet_tier = 'government_self_media' LIMIT 5
  `);
  for (const r of govDict as any) {
    console.log(`  ${r.outlet_name}  PA=${JSON.stringify(r.public_account_names)}`);
  }

  // 5. collected_items 中有 author 含'生态环境' 的吗?
  console.log("\n=== collected_items 中 author 含'生态环境' 的 items ===");
  const eItems = await db.execute(sql`
    SELECT author, COUNT(*)::int AS n
    FROM collected_items
    WHERE organization_id = ${orgId}
      AND author LIKE '%生态环境%'
    GROUP BY author ORDER BY n DESC LIMIT 20
  `);
  console.log(`  共 ${(eItems as any).length} 种 author`);
  for (const r of eItems as any) console.log(`  '${r.author}': ${r.n}`);

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

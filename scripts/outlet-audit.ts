/**
 * 摸底 media_outlet_dictionary 里各 tier 的 outlet 分布
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

async function main() {
  const { db } = await import("@/db");
  const { sql } = await import("drizzle-orm");

  // schema info
  const cols = await db.execute(sql`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_name = 'media_outlet_dictionary'
    ORDER BY ordinal_position
  `);
  console.log("=== 表结构 ===");
  for (const r of cols as any) console.log(`  ${r.column_name}: ${r.data_type}`);

  // tier 分布
  const tierAgg = await db.execute(sql`
    SELECT outlet_tier, COUNT(*)::int AS n FROM media_outlet_dictionary
    GROUP BY outlet_tier ORDER BY n DESC
  `);
  console.log("\n=== outlet_tier 分布 ===");
  for (const r of tierAgg as any) console.log(`  ${r.outlet_tier ?? "(null)"}: ${r.n}`);

  // 按 tier 列详情
  for (const tier of ["central", "industry", "provincial_municipal", "district_media", "government_self_media"]) {
    console.log(`\n=== tier='${tier}' outlet 列表 ===`);
    const rows = await db.execute(sql`
      SELECT outlet_name, outlet_region, public_account_names
      FROM media_outlet_dictionary
      WHERE outlet_tier = ${tier}
      ORDER BY outlet_region NULLS LAST, outlet_name
    `);
    console.log(`  共 ${(rows as any).length}`);
    for (const r of rows as any) {
      const pa = ((r.public_account_names ?? []) as string[]).slice(0, 3).join(", ");
      const more = ((r.public_account_names ?? []) as string[]).length > 3 ? ", ..." : "";
      console.log(`  [${r.outlet_region ?? "-"}] ${r.outlet_name}  pa=[${pa}${more}]`);
    }
  }

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();
async function main() {
  const { db } = await import("@/db");
  const { sql } = await import("drizzle-orm");
  const orgRows = await db.execute(sql`SELECT id FROM organizations LIMIT 1`);
  const orgId = (orgRows as any)[0].id;
  const a = await db.execute(sql`
    SELECT COUNT(*)::int AS total, COUNT(outlet_id)::int AS with_outlet
    FROM collected_items WHERE organization_id = ${orgId}
  `);
  console.log(`total=${(a as any)[0].total}, with_outlet=${(a as any)[0].with_outlet}`);
  process.exit(0);
}
main();

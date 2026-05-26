import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();
async function main() {
  const { db } = await import("@/db");
  const { sql } = await import("drizzle-orm");
  const rows = await db.execute(sql`SELECT name FROM research_cq_districts ORDER BY name`);
  console.log(`共 ${(rows as any).length}`);
  for (const r of rows as any) console.log(`  - ${r.name}`);
  process.exit(0);
}
main();

import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();
async function main() {
  const { db } = await import("@/db");
  const { sql } = await import("drizzle-orm");
  const r = await db.execute(sql`
    SELECT id, outlet_name, outlet_tier, public_account_names
    FROM media_outlet_dictionary
    WHERE outlet_name LIKE '%开州%'
  `);
  for (const x of r as any) {
    console.log(`${x.outlet_name} [${x.outlet_tier}]  PA=${JSON.stringify(x.public_account_names)}  id=${x.id}`);
  }
  process.exit(0);
}
main();

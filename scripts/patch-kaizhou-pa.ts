import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();
async function main() {
  const { db } = await import("@/db");
  const { sql } = await import("drizzle-orm");
  // 给开州融媒的 PA 加「帅开州」(数组追加,去重)
  await db.execute(sql`
    UPDATE media_outlet_dictionary
    SET public_account_names = ARRAY(SELECT DISTINCT UNNEST(public_account_names || ARRAY['帅开州']))
    WHERE outlet_name = '开州融媒'
  `);
  // 校验
  const r = await db.execute(sql`
    SELECT outlet_name, public_account_names FROM media_outlet_dictionary
    WHERE outlet_name = '开州融媒'
  `);
  for (const x of r as any) {
    console.log(`✓ ${x.outlet_name} → PA=${JSON.stringify(x.public_account_names)}`);
  }
  process.exit(0);
}
main();

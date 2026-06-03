import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { myPosts } from "@/db/schema";
import { sql } from "drizzle-orm";

// Create a fresh connection without prepared statements to avoid PgBouncer issues
const client = postgres(process.env.DATABASE_URL || "", {
  prepare: false,
  connect_timeout: 10,
});
const db = drizzle(client, { schema });

async function main() {
  const dupes = await db
    .select({
      organizationId: myPosts.organizationId,
      fingerprint: myPosts.contentFingerprint,
      count: sql<number>`count(*)::int`,
    })
    .from(myPosts)
    .where(sql`${myPosts.contentFingerprint} IS NOT NULL`)
    .groupBy(myPosts.organizationId, myPosts.contentFingerprint)
    .having(sql`count(*) > 1`);

  if (dupes.length === 0) {
    console.log("✅ 无 (organization_id, content_fingerprint) 重复，可安全升级 unique constraint");
    process.exit(0);
  }

  console.error(`❌ 发现 ${dupes.length} 组重复 fingerprint，升级 unique 前需合并：`);
  for (const d of dupes) {
    console.error(`  org=${d.organizationId} fingerprint=${d.fingerprint} count=${d.count}`);
  }
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { syncCmsCatalogs } from "@/lib/cms";
import { db } from "@/db";
import { organizations } from "@/db/schema";

async function main() {
  const orgs = await db.select().from(organizations);
  for (const org of orgs) {
    console.log(`\n=== Syncing org ${org.id} (${org.name}) ===`);
    const result = await syncCmsCatalogs(org.id, {
      triggerSource: "first_time_setup",
      deleteMissing: false,  // 不删本地，稳妥起见
    });
    console.log(JSON.stringify({
      success: result.success,
      stats: result.stats,
      warnings: result.warnings?.slice(0, 3),
      error: result.error,
    }, null, 2));
  }
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });

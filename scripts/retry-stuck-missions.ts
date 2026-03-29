/**
 * Retry stuck missions — uses dynamic import to avoid heavy module init.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

async function main() {
  // Dynamic imports to control load order
  const { db } = await import("../src/db");
  const { missions } = await import("../src/db/schema");
  const { eq, and } = await import("drizzle-orm");
  const { executeMissionDirect } = await import("../src/lib/mission-executor");

  const stuck = await db.query.missions.findMany({
    where: and(eq(missions.status, "planning"), eq(missions.tokensUsed, 0)),
    orderBy: (m, { desc }) => [desc(m.createdAt)],
  });

  console.log(`Found ${stuck.length} stuck missions\n`);

  for (const m of stuck) {
    console.log(`─── Executing: ${m.title} ───`);
    console.log(`    ID: ${m.id}`);
    try {
      const result = await executeMissionDirect(m.id, m.organizationId);
      console.log(`    ✓ Completed: ${JSON.stringify(result)}\n`);
    } catch (err) {
      console.error(`    ✗ Failed: ${err instanceof Error ? err.message.slice(0, 200) : err}\n`);
      await db.update(missions).set({ status: "failed" }).where(eq(missions.id, m.id)).catch(() => {});
    }
  }

  process.exit(0);
}

main().catch(console.error);

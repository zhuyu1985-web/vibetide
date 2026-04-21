// scripts/enable-research-bridge-for-existing-sources.ts
// 一次性：把系统热榜源 + 所有名字包含"微博"的源的 researchBridgeEnabled 打开。
// 用法：npx tsx scripts/enable-research-bridge-for-existing-sources.ts
import { config } from "dotenv";
config({ path: ".env.local" });
config();

async function main() {
  const { db } = await import("@/db");
  const { organizations, collectionSources } = await import("@/db/schema");
  const { ensureHotTopicSystemSource } = await import(
    "@/lib/collection/seed-system-sources"
  );
  const { eq, isNull, and, like } = await import("drizzle-orm");

  const orgs = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations);

  console.log(`Found ${orgs.length} orgs`);

  for (const org of orgs) {
    console.log(`\n=== Org: ${org.name} (${org.id}) ===`);

    // 1. ensure system hot topic source + set flag
    const sourceId = await ensureHotTopicSystemSource(org.id);
    console.log(`  ✓ hot-topic-crawler source: ${sourceId}`);

    // 2. Enable flag on any source with "微博" in the name
    const result = await db
      .update(collectionSources)
      .set({ researchBridgeEnabled: true, updatedAt: new Date() })
      .where(
        and(
          eq(collectionSources.organizationId, org.id),
          isNull(collectionSources.deletedAt),
          like(collectionSources.name, "%微博%"),
        ),
      )
      .returning({ id: collectionSources.id, name: collectionSources.name });

    if (result.length > 0) {
      console.log(`  ✓ enabled flag on ${result.length} 微博-named source(s):`);
      for (const r of result) console.log(`    - ${r.name} (${r.id})`);
    }
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

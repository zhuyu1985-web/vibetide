/**
 * 只 upsert 2 个海外热榜搬运相关 workflow templates，跳过完整 db:seed 跑到死的
 * step 7 起点（快讯工作流 INSERT ECONNREFUSED）。
 *
 * 关键技巧：先用本脚本自己创建的稳定 postgres client 预填 globalForDb，
 * 再 dynamic import @/db，让 dal 函数共用同一个 client，绕开 tsx 环境里
 * @/db module-load 预热 SELECT 1 引发的 stale-connection bug。
 *
 * Usage: npx tsx scripts/seed-overseas-workflows-only.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

const TARGET_SLUGS = new Set([
  "hot_topics_overseas_en",
  "hot_topic_single_overseas_repost",
]);

async function main() {
  // 1. 创建脚本自己的 client，跟 db/seed.ts 同款配置
  const url = process.env.DATABASE_URL!;
  if (!url) throw new Error("DATABASE_URL not set");
  const client = postgres(url, {
    prepare: false,
    connect_timeout: 10,
    max: 1,
  });

  // 2. 注入 globalForDb，让后续 import "@/db" 复用这个 client
  const schema = await import("@/db/schema");
  const dbInstance = drizzle(client, { schema });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__db_client = client;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__db_instance = dbInstance;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__db_warmed = true; // 跳过 @/db 的 module-load 预热 SELECT 1

  // 3. 现在再 import @/db 和 dal —— 它们会读到 globalForDb 上的预填值
  const { db } = await import("@/db");
  const { organizations } = await import("@/db/schema");
  const { buildBuiltinScenarioSeeds } = await import("@/db/seed-builtin-workflows");
  const { seedBuiltinTemplatesForOrg } = await import("@/lib/dal/workflow-templates");

  const allSeeds = buildBuiltinScenarioSeeds();
  const targetSeeds = allSeeds.filter(
    (s) => s.legacyScenarioKey && TARGET_SLUGS.has(s.legacyScenarioKey),
  );

  console.log(
    `Filtered ${targetSeeds.length} target workflow(s):`,
    targetSeeds.map((s) => s.legacyScenarioKey),
  );

  const orgs = await db.select({ id: organizations.id, name: organizations.name }).from(organizations);
  console.log(`Found ${orgs.length} organization(s).`);

  for (const org of orgs) {
    console.log(`[${org.name}] upserting ${targetSeeds.length} workflow(s)...`);
    await seedBuiltinTemplatesForOrg(org.id, targetSeeds);
    console.log(`[${org.name}] done.`);
  }

  console.log("All organizations done.");
  await client.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error("Failed:", err);
  process.exit(1);
});

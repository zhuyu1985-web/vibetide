// reseed-workflow-owners.ts
// 2026-04-20 垂类归属重分配（ownerEmployeeId 对齐）：对所有 org 重新 upsert
// builtin workflow_templates。
//
// 生效依赖：`seedBuiltinTemplatesForOrg` 的 onConflictDoUpdate.set 已在
// 2026-04-20 修订加入 `ownerEmployeeId`（之前被排除在覆盖列表外，导致
// 修改 seed 的归属不会同步到已存在的 DB 行）。
//
// 变更摘要：
//   - news_write / deep_report / social_post：xiaozi → xiaowen（写作归内容创作师）
//   - xiaozi 新增 4 条素材类场景（热点素材抓取/媒资库/版权核验/素材包）
//   - xiaoshen 新增 5 条审核类场景（敏感词/政治立场/法律合规/信源评级/终审）
//   - xiaofa 新增 2 条分发类场景（多平台标题优化/发布时机推荐）
//
// 安全性：幂等。不会覆盖 org admin 手动改过的 is_enabled / is_public。
//
// Usage: npx tsx scripts/reseed-workflow-owners.ts

import { config } from "dotenv";

// ！必须在 import @/db 之前加载 .env.local，否则 DATABASE_URL 还未注入，
// postgres 客户端会用默认 localhost:5432 连接导致 ECONNREFUSED。
config({ path: ".env.local" });
config();

async function main() {
  // 动态 import，确保在 dotenv 之后才初始化 DB 连接
  const { db } = await import("@/db");
  const { organizations } = await import("@/db/schema");
  const { seedBuiltinTemplatesForOrg } = await import("@/lib/dal/workflow-templates");
  const { buildBuiltinScenarioSeeds } = await import("@/db/seed-builtin-workflows");

  const orgs = await db.select().from(organizations);
  console.log(`Found ${orgs.length} organizations`);

  const seeds = buildBuiltinScenarioSeeds();
  console.log(`Re-seeding ${seeds.length} builtin scenarios per org`);

  for (const org of orgs) {
    console.log(`  ↻ Org ${org.id} (${org.name})`);
    try {
      await seedBuiltinTemplatesForOrg(org.id, seeds);
      console.log(`  ✓ Done ${org.name}`);
    } catch (err) {
      console.error(`  ✗ Failed ${org.name}:`, err);
    }
  }

  console.log("\n✓ All orgs re-seeded. ownerEmployeeId realignment complete.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

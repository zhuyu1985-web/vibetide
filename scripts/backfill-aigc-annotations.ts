/**
 * 一次性派发全量 aigc 标注事件
 *
 * 用途：Phase 2 部署后跑一次回填，让 Inngest `account-analytics-annotate-content`
 * 把历史 collected_items 的 aigc_content_category / aigc_keywords 全部补齐。
 *
 * 用法：
 *   npm run db:backfill-aigc
 *
 * 实际派发：每个有 collected_items 的 organization 派发 1 个根事件，
 * Inngest 函数内部会自递归链式处理（chainDepth < 20，batchSize 100）。
 * 单 org 上限 = MAX_CHAIN_DEPTH × batchSize = 20 × 100 = 2000 条。
 * 若某 org 超过 2000 条未标注，回填后重新跑 1 次即可。
 */

// 必须在 import 任何用 process.env 的模块之前加载 .env.local（对齐 scripts/seed-research.ts 风格）
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { inngest } from "../src/inngest/client";
import { db } from "../src/db";
import { organizations } from "../src/db/schema";
import { collectedItems } from "../src/db/schema/collection";
import { isNull, eq, sql } from "drizzle-orm";

(async () => {
  // 先查每个 org 有多少未标注的 collected_items，避免空派发
  const orgsWithUnannotated = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      pendingCount: sql<number>`COUNT(${collectedItems.id})::int`,
    })
    .from(organizations)
    .innerJoin(
      collectedItems,
      eq(collectedItems.organizationId, organizations.id),
    )
    .where(isNull(collectedItems.aigcAnnotatedAt))
    .groupBy(organizations.id, organizations.name)
    .orderBy(sql`COUNT(${collectedItems.id}) DESC`);

  console.log(`Found ${orgsWithUnannotated.length} organizations with unannotated items:\n`);
  for (const o of orgsWithUnannotated) {
    console.log(
      `  - ${o.name.padEnd(30)} (${o.id}) - ${o.pendingCount} pending`,
    );
  }
  console.log("");

  if (orgsWithUnannotated.length === 0) {
    console.log("Nothing to backfill. Exiting.");
    process.exit(0);
  }

  console.log("Dispatching events to Inngest...\n");
  for (const org of orgsWithUnannotated) {
    await inngest.send({
      name: "account-analytics/aigc-annotate.requested",
      data: { orgId: org.id, batchSize: 100, chainDepth: 0 },
    });
    console.log(`  → Dispatched for org ${org.name} (${org.id})`);
  }

  console.log("\nAll dispatched. Monitor at Inngest dashboard:");
  console.log("  - dev: http://localhost:8288");
  console.log(
    "\nIf any org has pendingCount > 2000 (MAX_CHAIN_DEPTH × batchSize),",
  );
  console.log("re-run this script after first pass to continue backfilling.");
  process.exit(0);
})().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});

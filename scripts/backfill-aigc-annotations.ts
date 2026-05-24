/**
 * 一次性派发全量 aigc 标注事件
 *
 * 用途：Phase 2 修正部署后跑一次回填，让 Inngest `account-analytics-annotate-posts`
 * 把历史 my_posts + benchmark_posts 的 aigc_content_category / aigc_keywords 补齐。
 *
 * 用法：
 *   npm run db:backfill-aigc
 *
 * 实际派发：每个有 pending my_posts/benchmark_posts 的 organization 派发 1 个根事件，
 * Inngest 函数内部会自递归链式处理（chainDepth < 20，batchSize 100）。
 * 单 org 上限 = MAX_CHAIN_DEPTH × batchSize = 20 × 100 = 2000 条。
 * 实际 my_posts (3) + benchmark_posts (17) 数据量极小，1 次链式就跑完。
 */

// 必须在 import 任何用 process.env 的模块之前加载 .env.local
// （ES module 顶层 import 是 hoisted，所以 db/inngest 必须用 dynamic import
// 才能保证它们读到的是 dotenv 加载后的 process.env.DATABASE_URL）
// 对齐 scripts/seed-research.ts 的写法。
import { config } from "dotenv";
config({ path: ".env.local" });
config();

async function main() {
  const { inngest } = await import("../src/inngest/client");
  const { db } = await import("../src/db");
  const { sql } = await import("drizzle-orm");

  // 统计每个 org 有多少 pending (my_posts + benchmark_posts) —— 用 UNION 子查询
  const rows = (await db.execute(sql`
    SELECT
      o.id,
      o.name,
      COALESCE(SUM(p.pending_count), 0)::int AS pending_count
    FROM organizations o
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS pending_count
      FROM my_posts
      WHERE organization_id = o.id
        AND aigc_annotated_at IS NULL
      UNION ALL
      SELECT COUNT(*)::int
      FROM benchmark_posts bp
      JOIN benchmark_accounts ba ON ba.id = bp.benchmark_account_id
      WHERE bp.aigc_annotated_at IS NULL
        AND (ba.organization_id = o.id OR ba.organization_id IS NULL)
    ) p ON true
    GROUP BY o.id, o.name
    HAVING COALESCE(SUM(p.pending_count), 0) > 0
    ORDER BY COALESCE(SUM(p.pending_count), 0) DESC
  `)) as unknown as Array<{ id: string; name: string; pending_count: number }>;

  const orgsWithUnannotated = rows;

  console.log(`Found ${orgsWithUnannotated.length} organizations with unannotated posts:\n`);
  for (const o of orgsWithUnannotated) {
    console.log(
      `  - ${o.name.padEnd(30)} (${o.id}) - ${o.pending_count} pending`,
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
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("ERROR:", e);
    process.exit(1);
  });

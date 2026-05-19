// 触发 research/backfill-annotate.requested:对指定 org 全量历史 collected_items
// 跑 topic + district 命中,把结果写到 research_collected_item_topics /
// research_collected_item_districts。前提:Inngest dev server 已启动(8288 端口)。
//
// Usage:
//   npx tsx scripts/trigger-backfill-annotate.ts            # 自动选 DB 中第一个 org
//   npx tsx scripts/trigger-backfill-annotate.ts <orgId>    # 指定 org
import { config } from "dotenv";
config({ path: ".env.local" });
config();

async function main() {
  const { db } = await import("@/db");
  const { organizations } = await import("@/db/schema/users");
  const { inngest } = await import("@/inngest/client");

  let orgId = process.argv[2];
  if (!orgId) {
    const rows = await db.select({ id: organizations.id, name: organizations.name }).from(organizations).limit(5);
    if (rows.length === 0) {
      console.error("DB 中没有 organization,请先 seed");
      process.exit(1);
    }
    if (rows.length > 1) {
      console.error("DB 中多个 org,请显式传 orgId:");
      for (const r of rows) console.error(`  ${r.id}  ${r.name}`);
      process.exit(1);
    }
    orgId = rows[0]!.id;
    console.log(`使用默认 org: ${orgId} (${rows[0]!.name})`);
  }

  await inngest.send({
    name: "research/backfill-annotate.requested",
    data: { organizationId: orgId },
  });

  console.log(`✓ 已触发 research/backfill-annotate.requested  org=${orgId}`);
  console.log("→ 打开 http://localhost:8288 查看 Inngest run 进度");
  process.exit(0);
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});

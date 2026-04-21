// scripts/trigger-research-bridge-backfill.ts
// 一次性：触发 research/bridge.backfill.trigger 事件，把存量 collected_items
// 桥接到 research_news_articles（只处理 researchBridgeEnabled=true 的源）。
//
// 前置：Inngest dev server 必须在跑（npm run dev 起动，自动注册）。
//
// 用法：
//   npx tsx scripts/trigger-research-bridge-backfill.ts
//   npx tsx scripts/trigger-research-bridge-backfill.ts --org=<orgId>
//   npx tsx scripts/trigger-research-bridge-backfill.ts --limit=100
//
// 运行后到 http://localhost:8288 的 Inngest dashboard 观察：
//   research-bridge-backfill → collection-research-bridge → research-article-content-fetch
import { config } from "dotenv";
config({ path: ".env.local" });
config();

function parseArgs() {
  const args: { org?: string; limit?: number } = {};
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--org=")) args.org = a.slice("--org=".length);
    else if (a.startsWith("--limit=")) args.limit = Number(a.slice("--limit=".length));
  }
  return args;
}

async function main() {
  const { org, limit } = parseArgs();

  const { inngest } = await import("@/inngest/client");
  const { db } = await import("@/db");
  const { organizations } = await import("@/db/schema");

  const targetOrgs = org
    ? [{ id: org, name: "(from --org flag)" }]
    : await db.select({ id: organizations.id, name: organizations.name }).from(organizations);

  if (targetOrgs.length === 0) {
    console.error("No orgs found.");
    process.exit(1);
  }

  console.log(`Triggering backfill for ${targetOrgs.length} org(s), limit=${limit ?? "default(500)"}`);

  for (const o of targetOrgs) {
    const ids = await inngest.send({
      name: "research/bridge.backfill.trigger",
      data: { organizationId: o.id, limit },
    });
    console.log(`  ✓ ${o.name} (${o.id}) → event ids: ${ids.ids.join(", ")}`);
  }

  console.log("\nEvents dispatched. Watch Inngest dashboard for progress.");
  console.log("  Dev server: http://localhost:8288  (or whatever port the Inngest UI uses)");
  console.log("  App UI:     http://localhost:3000/research");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

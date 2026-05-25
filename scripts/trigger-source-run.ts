/**
 * 一次性触发指定 collection_source 立即跑(派发 collection/source.run-requested)。
 * 用法:npx tsx scripts/trigger-source-run.ts <sourceId>
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { Inngest } from "inngest";

async function main() {
  const sourceId = process.argv[2];
  if (!sourceId) {
    console.error("用法: npx tsx scripts/trigger-source-run.ts <sourceId>");
    process.exit(1);
  }

  const postgres = (await import("postgres")).default;
  const dburl = process.env.DATABASE_URL!.replace(/[?&]directConnection=true/i, "").replace(/\?$/, "");
  const sql = postgres(dburl, { prepare: false });
  const [row] = await sql.unsafe(
    `SELECT organization_id::text AS organization_id, name FROM collection_sources WHERE id = '${sourceId}'`,
  );
  await sql.end();

  if (!row?.organization_id) {
    console.error(`找不到 source ${sourceId}`);
    process.exit(2);
  }

  const inngest = new Inngest({
    id: "vibetide-trigger",
    eventKey: "test",
    isDev: true,
    baseUrl: "http://127.0.0.1:8288",
  });

  console.log(`派发抓取:${row.name}`);

  const res = await inngest.send({
    name: "collection/source.run-requested",
    data: {
      sourceId,
      organizationId: row.organization_id,
      trigger: "manual",
    },
  });

  console.log("事件已派发:", JSON.stringify(res, null, 2));
  console.log("查看进度:http://localhost:8288/stream");
}

void main();

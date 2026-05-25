/**
 * 一次性触发指定账号的报告生成 + reanalyze。
 * 用法:npx tsx scripts/trigger-account-report.ts <accountId> [my|benchmark] [daily|weekly]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { Inngest } from "inngest";

async function main() {
  const accountId = process.argv[2];
  const accountSource = (process.argv[3] ?? "my") as "my" | "benchmark";
  const reportType = (process.argv[4] ?? "weekly") as "daily" | "weekly" | "monthly" | "custom";

  if (!accountId) {
    console.error("用法: npx tsx scripts/trigger-account-report.ts <accountId> [my|benchmark] [daily|weekly]");
    process.exit(1);
  }

  // 直连本地 inngest dev server(8288)派发事件
  const inngest = new Inngest({
    id: "vibetide-trigger",
    eventKey: "test",
    isDev: true,
    baseUrl: "http://127.0.0.1:8288",
  });

  // 周报区间 = 过去 7 天(Asia/Shanghai 业务日)
  const nowSh = new Date(Date.now() + 8 * 3600 * 1000);
  const todayShStart = new Date(
    Date.UTC(nowSh.getUTCFullYear(), nowSh.getUTCMonth(), nowSh.getUTCDate()),
  );
  const sevenDaysAgo = new Date(todayShStart.getTime() - 6 * 24 * 3600 * 1000);
  const periodStart = sevenDaysAgo.toISOString().slice(0, 10);
  const periodEnd = todayShStart.toISOString().slice(0, 10);

  // 从 DB 查 organizationId
  const postgres = (await import("postgres")).default;
  const dburl = process.env.DATABASE_URL!.replace(/[?&]directConnection=true/i, "").replace(/\?$/, "");
  const sql = postgres(dburl, { prepare: false });
  const table = accountSource === "my" ? "my_accounts" : "benchmark_accounts";
  const [row] = await sql.unsafe(
    `SELECT organization_id::text AS organization_id, name FROM ${table} WHERE id = '${accountId}'`,
  );
  await sql.end();

  if (!row?.organization_id) {
    console.error(`找不到账号 ${accountId} (${table})`);
    process.exit(2);
  }

  console.log(`派发报告:${row.name} / ${accountSource} / ${reportType} / ${periodStart} ~ ${periodEnd}`);

  const res = await inngest.send({
    name: "account-analytics/daily-report.requested",
    data: {
      organizationId: row.organization_id,
      accountId,
      accountSource,
      periodStart,
      periodEnd,
      reportType,
      forceRefresh: true,
    },
  });

  console.log("事件已派发:", JSON.stringify(res, null, 2));
  console.log("查看进度:http://localhost:8288/stream");
}

void main();

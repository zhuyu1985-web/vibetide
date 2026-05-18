// 实时查看 source 的最新 run 进度
// Usage: npx tsx --env-file=.env.local scripts/progress.ts <sourceId>
//   或 不传参数 → 显示所有 running run

import postgres from "postgres";

async function main() {
  const sourceId = process.argv[2];
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

  const runs = sourceId
    ? await sql`
        SELECT r.id, s.name AS source_name, r.started_at, r.finished_at, r.status,
               r.items_inserted, r.items_merged, r.items_failed
        FROM collection_runs r JOIN collection_sources s ON s.id = r.source_id
        WHERE r.source_id = ${sourceId} ORDER BY r.started_at DESC LIMIT 1
      `
    : await sql`
        SELECT r.id, s.name AS source_name, r.started_at, r.finished_at, r.status,
               r.items_inserted, r.items_merged, r.items_failed
        FROM collection_runs r JOIN collection_sources s ON s.id = r.source_id
        WHERE r.status = 'running' ORDER BY r.started_at DESC
      `;

  if (runs.length === 0) {
    console.log(sourceId ? "该 source 还没跑过" : "没有 running 中的 run");
    process.exit(0);
  }

  for (const r of runs) {
    const dur = r.finished_at
      ? `${((r.finished_at - r.started_at) / 1000).toFixed(1)}s`
      : `RUNNING ${((Date.now() - r.started_at) / 1000).toFixed(0)}s`;
    console.log(`\n=== ${r.source_name} [${r.status}] ${dur} ===`);
    console.log(`Run ID: ${r.id}`);
    console.log(`inserted=${r.items_inserted} merged=${r.items_merged} failed=${r.items_failed}`);

    const logs = await sql`
      SELECT logged_at, level, message FROM collection_logs
      WHERE run_id = ${r.id} ORDER BY logged_at DESC LIMIT 15
    `;
    console.log(`\n最近 15 条 log:`);
    logs.reverse().forEach((l) => {
      const ts = l.logged_at.toISOString().slice(11, 19);
      console.log(`  [${ts}] [${l.level}] ${l.message.slice(0, 100)}`);
    });
  }
  await sql.end();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

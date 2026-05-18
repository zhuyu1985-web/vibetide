/**
 * 一次性把 docs/data.xlsx 的舆情数据灌进 collected_items 采集池
 *
 * 用法:
 *   npx tsx scripts/import-opinion-data.ts [orgId] [filePath]
 *   默认 orgId = a0000000-0000-4000-8000-000000000001
 *   默认 filePath = docs/data.xlsx
 */
// 关键:dotenv 必须在 import "../src/db" 之前完成,因为 src/db/index.ts 顶层会
// 立刻读 DATABASE_URL 创建 client + pre-warm。ESM import 是 hoist 的,所以
// dotenv.config() 不能放在普通 import 之间 — 用 dynamic import 强制顺序。
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { readFileSync } from "fs";
import { resolve } from "path";
import * as XLSX from "@e965/xlsx";
import { eq } from "drizzle-orm";
import type { RawItem } from "../src/lib/collection/types";

const ORG_ID = process.argv[2] || "a0000000-0000-4000-8000-000000000001";
const FILE = resolve(process.argv[3] || "docs/data.xlsx");
const BATCH = 500;

async function main() {
  // dynamic import — 确保 dotenv 先生效
  const { db } = await import("../src/db");
  const { collectedItems, collectionRuns } = await import("../src/db/schema/collection");
  const { getOrCreateExcelImportVirtualSource } = await import(
    "../src/db/seed/excel-import-virtual-source"
  );
  const { transformOpinionRow, isOpinionExcelFormat } = await import(
    "../src/lib/collection/bulk-import/opinion-transform"
  );
  const { writeItems } = await import("../src/lib/collection/writer");
  const { inngest } = await import("../src/inngest/client");

  // 脚本场景 stub:本地无 INNGEST_EVENT_KEY,每条派生通知都 401 会拖慢导入。
  // 派生通知只是给下游 hot_topics enrichment 用的,导入历史数据不需要派生。
  inngest.send = (async () => ({ ids: [] })) as typeof inngest.send;

  // 干净起见:清空之前可能半截写入的 items
  const cleared = await db.delete(collectedItems).returning({ id: collectedItems.id });
  if (cleared.length > 0) console.log(`[import] cleared ${cleared.length} pre-existing items`);

  console.log(`[import] file=${FILE} org=${ORG_ID}`);
  const buf = readFileSync(FILE);
  const wb = XLSX.read(buf, { cellDates: true });
  const sheetName = wb.SheetNames[0]!;
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName]!, {
    raw: false,
    defval: "",
  });
  if (rows.length === 0) {
    console.error("empty sheet");
    process.exit(1);
  }

  const columns = Object.keys(rows[0]!);
  console.log(`[import] sheet="${sheetName}" rows=${rows.length} cols=${columns.length}`);
  if (!isOpinionExcelFormat(columns)) {
    console.error("[import] columns 不像舆情格式,期望含 标题/作者昵称/平台/情感倾向 等列");
    console.error("[import] actual columns:", columns);
    process.exit(1);
  }

  // 准备 virtual source + run
  const sourceId = await getOrCreateExcelImportVirtualSource(ORG_ID);
  const [run] = await db.insert(collectionRuns).values({
    sourceId,
    organizationId: ORG_ID,
    trigger: "manual",
    startedAt: new Date(),
    status: "running",
    itemsAttempted: 0,
    itemsInserted: 0,
    itemsMerged: 0,
    itemsFailed: 0,
    metadata: {
      source: "opinion_bulk_import_script",
      filePath: FILE,
      totalRows: rows.length,
    },
  }).returning();
  const runId = run!.id;

  // 分批跑
  let totalInserted = 0, totalMerged = 0, totalFailed = 0, totalSkipped = 0;
  const totalBatches = Math.ceil(rows.length / BATCH);
  const t0 = Date.now();

  for (let bi = 0; bi < totalBatches; bi++) {
    const slice = rows.slice(bi * BATCH, (bi + 1) * BATCH);
    const rawItems: RawItem[] = [];
    for (const r of slice) {
      const result = transformOpinionRow(r);
      if (!result) {
        totalSkipped++;
        continue;
      }
      rawItems.push(result.rawItem);
    }

    if (rawItems.length === 0) continue;

    try {
      const wr = await writeItems({
        runId,
        sourceId,
        organizationId: ORG_ID,
        items: rawItems,
        source: {
          targetModules: [],
          defaultCategory: null,
          defaultTags: null,
          outletId: null,
          defaultOutletTier: null,
          defaultOutletRegion: null,
        },
        dedupStrategy: "url_only",
      });
      totalInserted += wr.inserted;
      totalMerged += wr.merged;
      totalFailed += wr.failed;
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(
        `[batch ${bi + 1}/${totalBatches}] +${wr.inserted} merged=${wr.merged} failed=${wr.failed} | total inserted=${totalInserted} | elapsed=${elapsed}s`,
      );
    } catch (e) {
      totalFailed += rawItems.length;
      console.error(`[batch ${bi + 1}] FAIL:`, (e as Error).message);
    }
  }

  await db.update(collectionRuns).set({
    finishedAt: new Date(),
    status: totalFailed > 0 ? "partial" : "success",
  }).where(eq(collectionRuns.id, runId));

  console.log("\n=== DONE ===");
  console.log({
    runId,
    totalRows: rows.length,
    skipped: totalSkipped,
    inserted: totalInserted,
    merged: totalMerged,
    failed: totalFailed,
    elapsed: `${((Date.now() - t0) / 1000).toFixed(1)}s`,
  });
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

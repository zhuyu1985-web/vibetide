/**
 * scripts/backfill-outlet-id.ts
 *
 * 回填 collected_items.outlet_id / outlet_tier / outlet_region
 * 跑 outlet-recognizer 对所有 outlet_id IS NULL 的稿件。
 *
 * 用法:
 *   npx tsx scripts/backfill-outlet-id.ts            # 默认 org
 *   npx tsx scripts/backfill-outlet-id.ts <orgId>
 *   npx tsx scripts/backfill-outlet-id.ts <orgId> --dry-run
 *
 * 背景:
 *   - import-json-collected-items.ts / opinion-excel 部分 channel 走的 import 路径
 *     绕过了 writer.ts 的 recognizeOutlet,导致历史 78% 稿件 outlet_id=NULL
 *   - 此脚本基于 canonical_url host + raw_metadata.publicAccountName / author
 *     做后置识别,只 UPDATE outlet_id 还是 NULL 的稿件,安全可重跑
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

const BATCH = 1000;
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const { db } = await import("@/db");
  const { collectedItems } = await import("@/db/schema/collection");
  const { mediaOutletDictionary } = await import("@/db/schema/media-outlet-dictionary");
  const { organizations } = await import("@/db/schema/users");
  const { recognizeOutlet } = await import("@/lib/collection/outlet-recognizer");
  const { and, eq, isNull, sql, asc, inArray } = await import("drizzle-orm");

  let orgId = process.argv.find((a, i) => i >= 2 && !a.startsWith("--"));
  if (!orgId) {
    const rows = await db.select({ id: organizations.id, name: organizations.name }).from(organizations).limit(5);
    if (rows.length === 0) { console.error("DB 中没有 organization"); process.exit(1); }
    if (rows.length > 1) {
      console.error("多个 org,请显式传 orgId:");
      for (const r of rows) console.error(`  ${r.id}  ${r.name}`);
      process.exit(1);
    }
    orgId = rows[0]!.id;
    console.log(`使用默认 org: ${orgId} (${rows[0]!.name})`);
  }

  // 加载字典 (清理后的)
  const dict = await db
    .select()
    .from(mediaOutletDictionary)
    .where(eq(mediaOutletDictionary.organizationId, orgId));
  console.log(`✓ 加载字典 ${dict.length} 个 outlet`);

  // 没识别到任何 outlet 的稿件总量
  const [{ total }] = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(collectedItems)
    .where(and(eq(collectedItems.organizationId, orgId), isNull(collectedItems.outletId)));
  console.log(`📊 待回填 outlet_id IS NULL 的稿件: ${total} 条${dryRun ? " (dry-run)" : ""}`);

  let processed = 0;
  let recognized = 0;
  let lastId: string | null = null;
  let batchIdx = 0;

  while (true) {
    const conditions = [
      eq(collectedItems.organizationId, orgId),
      isNull(collectedItems.outletId),
    ];
    if (lastId) conditions.push(sql`${collectedItems.id}::text > ${lastId}`);

    const batch = await db
      .select({
        id: collectedItems.id,
        canonicalUrl: collectedItems.canonicalUrl,
        rawMetadata: collectedItems.rawMetadata,
      })
      .from(collectedItems)
      .where(and(...conditions))
      .orderBy(asc(collectedItems.id))
      .limit(BATCH);

    if (batch.length === 0) break;

    const updates: Array<{ id: string; outletId: string; outletTier: string | null; outletRegion: string | null }> = [];
    for (const item of batch) {
      const recognized = recognizeOutlet(
        { canonicalUrl: item.canonicalUrl, rawMetadata: item.rawMetadata as Record<string, unknown> | null },
        { outletId: null, defaultOutletTier: null, defaultOutletRegion: null },
        dict,
      );
      if (recognized?.outletId) {
        updates.push({
          id: item.id,
          outletId: recognized.outletId,
          outletTier: recognized.outletTier,
          outletRegion: recognized.outletRegion,
        });
      }
    }

    if (updates.length > 0 && !dryRun) {
      // 按 outletId 分组批量 update — 同 outlet 的所有稿件一次 query 完成
      const groups = new Map<string, { tier: string | null; region: string | null; ids: string[] }>();
      for (const u of updates) {
        const g = groups.get(u.outletId);
        if (g) g.ids.push(u.id);
        else groups.set(u.outletId, { tier: u.outletTier, region: u.outletRegion, ids: [u.id] });
      }
      for (const [outletId, g] of groups) {
        await db
          .update(collectedItems)
          .set({
            outletId,
            outletTier: g.tier,
            outletRegion: g.region,
          })
          .where(inArray(collectedItems.id, g.ids));
      }
    }

    processed += batch.length;
    recognized += updates.length;
    lastId = batch[batch.length - 1]!.id;
    batchIdx += 1;

    if (batchIdx % 5 === 0 || batch.length < BATCH) {
      console.log(`  batch ${batchIdx}: 处理 ${processed}/${total}, 命中 ${recognized}`);
    }
    if (batch.length < BATCH) break;
  }

  console.log(`✓ 完成: 扫 ${processed} 条, 命中 ${recognized} (${((recognized / Math.max(processed, 1)) * 100).toFixed(1)}%)`);
  if (dryRun) console.log("  (dry-run, 未实际写入)");
  process.exit(0);
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});

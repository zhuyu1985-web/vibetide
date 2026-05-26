/**
 * scripts/backfill-outlet-by-author.ts
 *
 * 用 collected_items.author 直接匹配 media_outlet_dictionary.public_account_names,
 * 回填 outlet_id IS NULL 的稿件。
 *
 * 背景:之前 backfill-outlet-id.ts 只用 raw_metadata.publicAccountName/author 匹配,
 * 但 opinion_excel 导入路径的 raw_metadata 是空的,作者昵称写到了 collected_items.author
 * 主列,所以 18000+ 稿件没识别上 outlet。
 *
 * 用法:
 *   npx tsx scripts/backfill-outlet-by-author.ts            # 默认 org
 *   npx tsx scripts/backfill-outlet-by-author.ts <orgId>
 *   npx tsx scripts/backfill-outlet-by-author.ts <orgId> --dry-run
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

const BATCH = 2000;
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const { db } = await import("@/db");
  const { collectedItems } = await import("@/db/schema/collection");
  const { mediaOutletDictionary } = await import("@/db/schema/media-outlet-dictionary");
  const { organizations } = await import("@/db/schema/users");
  const { and, eq, isNull, sql, asc, inArray } = await import("drizzle-orm");

  let orgId = process.argv.find((a, i) => i >= 2 && !a.startsWith("--"));
  if (!orgId) {
    const rows = await db.select({ id: organizations.id, name: organizations.name }).from(organizations).limit(5);
    if (rows.length === 0) { console.error("DB 中没有 organization"); process.exit(1); }
    if (rows.length > 1) {
      console.error("多个 org,请显式传 orgId");
      for (const r of rows) console.error(`  ${r.id}  ${r.name}`);
      process.exit(1);
    }
    orgId = rows[0]!.id;
    console.log(`使用默认 org: ${orgId} (${rows[0]!.name})`);
  }

  // 构建 author → outlet 索引:遍历字典,把每个 publicAccountName 映射到 outlet
  const dict = await db
    .select({
      id: mediaOutletDictionary.id,
      outletName: mediaOutletDictionary.outletName,
      outletTier: mediaOutletDictionary.outletTier,
      outletRegion: mediaOutletDictionary.outletRegion,
      publicAccountNames: mediaOutletDictionary.publicAccountNames,
    })
    .from(mediaOutletDictionary)
    .where(eq(mediaOutletDictionary.organizationId, orgId));

  const authorToOutlet = new Map<string, { outletId: string; tier: string | null; region: string | null; outletName: string }>();
  for (const o of dict) {
    for (const name of o.publicAccountNames ?? []) {
      if (!authorToOutlet.has(name)) {
        authorToOutlet.set(name, {
          outletId: o.id,
          tier: o.outletTier,
          region: o.outletRegion,
          outletName: o.outletName,
        });
      }
    }
  }
  console.log(`✓ 加载字典 ${dict.length} 个 outlet, ${authorToOutlet.size} 个 author alias`);

  // 待处理稿件总数
  const [{ total }] = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(collectedItems)
    .where(and(
      eq(collectedItems.organizationId, orgId),
      isNull(collectedItems.outletId),
      sql`${collectedItems.author} IS NOT NULL`,
    ));
  console.log(`📊 待回填 outlet_id IS NULL 且 author 非空: ${total} 条${dryRun ? " (dry-run)" : ""}`);

  let processed = 0;
  let recognized = 0;
  let lastId: string | null = null;
  let batchIdx = 0;
  const tierStats = new Map<string, number>();

  while (true) {
    const conditions = [
      eq(collectedItems.organizationId, orgId),
      isNull(collectedItems.outletId),
      sql`${collectedItems.author} IS NOT NULL`,
    ];
    if (lastId) conditions.push(sql`${collectedItems.id}::text > ${lastId}`);

    const batch = await db
      .select({ id: collectedItems.id, author: collectedItems.author })
      .from(collectedItems)
      .where(and(...conditions))
      .orderBy(asc(collectedItems.id))
      .limit(BATCH);

    if (batch.length === 0) break;

    // 按 outletId 分组
    const groups = new Map<string, { tier: string | null; region: string | null; outletName: string; ids: string[] }>();
    for (const item of batch) {
      const matched = item.author ? authorToOutlet.get(item.author) : null;
      if (!matched) continue;
      const g = groups.get(matched.outletId);
      if (g) g.ids.push(item.id);
      else groups.set(matched.outletId, {
        tier: matched.tier,
        region: matched.region,
        outletName: matched.outletName,
        ids: [item.id],
      });
    }

    if (!dryRun) {
      for (const [outletId, g] of groups) {
        await db
          .update(collectedItems)
          .set({ outletId, outletTier: g.tier, outletRegion: g.region })
          .where(inArray(collectedItems.id, g.ids));
        tierStats.set(g.tier ?? "_null_", (tierStats.get(g.tier ?? "_null_") ?? 0) + g.ids.length);
      }
    } else {
      for (const [, g] of groups) {
        tierStats.set(g.tier ?? "_null_", (tierStats.get(g.tier ?? "_null_") ?? 0) + g.ids.length);
      }
    }

    const batchHits = Array.from(groups.values()).reduce((sum, g) => sum + g.ids.length, 0);
    processed += batch.length;
    recognized += batchHits;
    lastId = batch[batch.length - 1]!.id;
    batchIdx += 1;

    if (batchIdx % 3 === 0 || batch.length < BATCH) {
      console.log(`  batch ${batchIdx}: 处理 ${processed}/${total}, 命中 ${recognized}`);
    }
    if (batch.length < BATCH) break;
  }

  console.log(`\n✓ 完成: 扫 ${processed} 条, 命中 ${recognized} (${(recognized/Math.max(processed,1)*100).toFixed(1)}%)`);
  console.log(`\n按 tier 分布:`);
  for (const [tier, n] of [...tierStats.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${tier}: ${n}`);
  }
  if (dryRun) console.log(`\n(dry-run, 未实际写入)`);
  process.exit(0);
}

main().catch((err) => { console.error("fatal:", err); process.exit(1); });

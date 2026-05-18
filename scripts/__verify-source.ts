// 一次性脚本:端到端跑一个 source 验证(模拟 runCollectionSource Inngest fn,同步直跑)
// Usage: npx tsx --env-file=.env.local scripts/__verify-source.ts <sourceId>

import { db } from "@/db";
import { collectionSources, collectionRuns, collectionLogs, collectedItems, collectedItemContents } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getAdapter } from "@/lib/collection/registry";
import { writeItems } from "@/lib/collection/writer";
import "@/lib/collection/adapters";

async function main() {
  const sourceId = process.argv[2];
  if (!sourceId) {
    console.error("Usage: __verify-source.ts <sourceId>");
    process.exit(1);
  }

  console.log(`\n=== 验证 source: ${sourceId} ===\n`);

  const [source] = await db
    .select()
    .from(collectionSources)
    .where(eq(collectionSources.id, sourceId))
    .limit(1);
  if (!source) {
    console.error("✗ Source 不存在");
    process.exit(1);
  }

  console.log(`Name: ${source.name}`);
  console.log(`Type: ${source.sourceType}`);
  console.log(`Config: ${JSON.stringify(source.config)}`);
  console.log(`Enabled: ${source.enabled}`);
  console.log(`OutletId: ${source.outletId}`);
  console.log(`TargetModules: ${JSON.stringify(source.targetModules)}\n`);

  if (!source.enabled) {
    console.error("✗ Source disabled");
    process.exit(1);
  }

  const [run] = await db
    .insert(collectionRuns)
    .values({
      sourceId,
      organizationId: source.organizationId,
      trigger: "manual",
      startedAt: new Date(),
      status: "running",
    })
    .returning({ id: collectionRuns.id });
  const runId = run!.id;
  console.log(`Run ID: ${runId}\n`);

  try {
    const adapter = getAdapter(source.sourceType);
    const parsed = adapter.configSchema.safeParse(source.config);
    if (!parsed.success) throw new Error(`config validation failed: ${parsed.error.message}`);
    console.log(`Parsed config: ${JSON.stringify(parsed.data)}\n`);

    console.log("→ 执行 adapter...");
    const t0 = Date.now();
    const result = await adapter.execute({
      config: parsed.data,
      sourceId,
      organizationId: source.organizationId,
      runId,
      log: (level, message, meta) => {
        console.log(`  [${level}] ${message}`, meta ? JSON.stringify(meta) : "");
        db.insert(collectionLogs)
          .values({ runId, sourceId, level, message, metadata: meta ?? null })
          .then(() => {}).catch(() => {});
      },
    });
    console.log(`✓ adapter 完成,${result.items.length} 条 raw items (${Date.now() - t0}ms)`);
    if (result.partialFailures && result.partialFailures.length > 0) {
      console.log(`⚠ partialFailures:`);
      for (const f of result.partialFailures) console.log(`   - ${f.message}`, f.meta ? JSON.stringify(f.meta) : "");
    }

    console.log("\n→ writeItems...");
    const t1 = Date.now();
    const writeResult = await writeItems({
      runId,
      sourceId,
      organizationId: source.organizationId,
      items: result.items,
      source: {
        targetModules: source.targetModules,
        defaultCategory: source.defaultCategory,
        defaultTags: source.defaultTags,
        outletId: source.outletId,
        defaultOutletTier: source.defaultOutletTier,
        defaultOutletRegion: source.defaultOutletRegion,
      },
    });
    console.log(`✓ writeItems 完成 (${Date.now() - t1}ms)`);
    console.log(`  inserted: ${writeResult.inserted}`);
    console.log(`  merged:   ${writeResult.merged}`);
    console.log(`  failed:   ${writeResult.failed}`);

    const hasFailures = writeResult.failed > 0 || (result.partialFailures?.length ?? 0) > 0;
    await db.update(collectionRuns).set({
      finishedAt: new Date(),
      status: hasFailures ? "partial" : "success",
      itemsInserted: writeResult.inserted,
      itemsMerged: writeResult.merged,
      itemsFailed: writeResult.failed,
      errorSummary: result.partialFailures?.map((f) => f.message).join("; ") || null,
    }).where(eq(collectionRuns.id, runId));

    // 跟 Inngest fn 保持一致:同步累加 source 的 total_items_collected / total_runs,
    // 避免 verify-source 跑完 UI counter 漂移
    await db.update(collectionSources).set({
      lastRunAt: new Date(),
      lastRunStatus: hasFailures ? "partial" : "success",
      totalItemsCollected: sql`${collectionSources.totalItemsCollected} + ${writeResult.inserted}`,
      totalRuns: sql`${collectionSources.totalRuns} + 1`,
    }).where(eq(collectionSources.id, sourceId));

    if (writeResult.inserted > 0 && writeResult.insertedItemIds[0]) {
      const itemId = writeResult.insertedItemIds[0];
      const [item] = await db.select({
        title: collectedItems.title,
        canonicalUrl: collectedItems.canonicalUrl,
        category: collectedItems.category,
        tags: collectedItems.tags,
        outletId: collectedItems.outletId,
        outletTier: collectedItems.outletTier,
      }).from(collectedItems).where(eq(collectedItems.id, itemId)).limit(1);
      const [contentRow] = await db.select({ content: collectedItemContents.content })
        .from(collectedItemContents).where(eq(collectedItemContents.itemId, itemId)).limit(1);
      console.log("\n=== 抽样最近 1 条入库 item ===");
      console.log(`Title:  ${item!.title}`);
      console.log(`URL:    ${item!.canonicalUrl}`);
      console.log(`Category: ${item!.category}`);
      console.log(`Tags:   ${JSON.stringify(item!.tags)}`);
      console.log(`OutletId:   ${item!.outletId}`);
      console.log(`OutletTier: ${item!.outletTier}`);
      console.log(`Content length: ${contentRow?.content?.length ?? 0} chars (副表 LZ4)`);
    }
    console.log(`\n=== ✓ 验证完成 ===`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.update(collectionRuns).set({
      finishedAt: new Date(), status: "failed", errorSummary: msg,
    }).where(eq(collectionRuns.id, runId));
    console.error(`\n✗ 失败: ${msg}`);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main().catch(err => { console.error(err); process.exit(1); });

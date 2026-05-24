/**
 * scripts/sync-backfill-annotate.ts
 *
 * 同步版本的 research-backfill-annotate (跳过 inngest, 直接跑)。
 * 对所有 collected_items 用 title + content + tags + matched_keywords + raw_metadata.keyword
 * 跑 topic / district 匹配,写到 annotation 表(onConflictDoNothing)。
 *
 * 用法:
 *   npx tsx scripts/sync-backfill-annotate.ts            # 默认 org
 *   npx tsx scripts/sync-backfill-annotate.ts <orgId>
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

const BATCH = 500;

async function main() {
  const { db } = await import("@/db");
  const { collectedItems, collectedItemContents } = await import("@/db/schema/collection");
  const { researchTopics, researchTopicKeywords } = await import("@/db/schema/research/research-topics");
  const { cqDistricts } = await import("@/db/schema/research/cq-districts");
  const {
    researchCollectedItemTopics,
    researchCollectedItemDistricts,
  } = await import("@/db/schema/research/annotations");
  const { organizations } = await import("@/db/schema/users");
  const { eq, and, sql, asc } = await import("drizzle-orm");
  const { matchTopicsForItem } = await import("@/lib/research/topic-matcher");
  const { matchDistrictsForItem } = await import("@/lib/research/district-matcher");

  let orgId = process.argv[2];
  if (!orgId) {
    const rows = await db.select({ id: organizations.id, name: organizations.name }).from(organizations).limit(5);
    if (rows.length === 0) { console.error("DB 中没有 organization"); process.exit(1); }
    if (rows.length > 1) {
      console.error("多个 org,请显式传 orgId");
      process.exit(1);
    }
    orgId = rows[0]!.id;
    console.log(`使用默认 org: ${orgId} (${rows[0]!.name})`);
  }

  // 加载 topics
  const topicRows = await db
    .select({
      id: researchTopics.id,
      name: researchTopics.name,
      keyword: researchTopicKeywords.keyword,
      isPrimary: researchTopicKeywords.isPrimary,
    })
    .from(researchTopics)
    .leftJoin(researchTopicKeywords, eq(researchTopicKeywords.topicId, researchTopics.id))
    .where(eq(researchTopics.organizationId, orgId));

  const topicMap = new Map<string, { id: string; name: string; primaryKeywords: string[]; otherKeywords: string[] }>();
  for (const row of topicRows) {
    if (!topicMap.has(row.id)) {
      topicMap.set(row.id, { id: row.id, name: row.name, primaryKeywords: [], otherKeywords: [] });
    }
    const t = topicMap.get(row.id)!;
    if (row.keyword) {
      if (row.isPrimary) t.primaryKeywords.push(row.keyword);
      else t.otherKeywords.push(row.keyword);
    }
  }
  for (const t of topicMap.values()) {
    if (t.primaryKeywords.length === 0) t.primaryKeywords.push(t.name);
  }
  const topics = Array.from(topicMap.values());
  console.log(`✓ 加载 ${topics.length} 个 topic, 共 ${topicRows.length} 个 (topic, keyword) 行`);

  // 加载 districts
  const districts = await db.select({ id: cqDistricts.id, name: cqDistricts.name }).from(cqDistricts);
  console.log(`✓ 加载 ${districts.length} 个 cq_district`);

  // 全部稿件
  const [{ total }] = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(collectedItems)
    .where(eq(collectedItems.organizationId, orgId));
  console.log(`📊 待回填 ${total} 条`);

  let processed = 0;
  let topicHits = 0;
  let districtHits = 0;
  let lastId: string | null = null;
  let batchIdx = 0;

  while (true) {
    const conditions = [eq(collectedItems.organizationId, orgId)];
    if (lastId) conditions.push(sql`${collectedItems.id}::text > ${lastId}`);

    const batch = await db
      .select({
        id: collectedItems.id,
        title: collectedItems.title,
        content: collectedItemContents.content,
        ocrText: collectedItemContents.ocrText,
        asrText: collectedItemContents.asrText,
        tags: collectedItems.tags,
        matchedKeywords: collectedItems.matchedKeywords,
        rawMetadata: collectedItems.rawMetadata,
      })
      .from(collectedItems)
      .leftJoin(collectedItemContents, eq(collectedItemContents.itemId, collectedItems.id))
      .where(and(...conditions))
      .orderBy(asc(collectedItems.id))
      .limit(BATCH);

    if (batch.length === 0) break;

    const topicInserts: { collectedItemId: string; topicId: string; matchType: "keyword"; matchedKeyword: string | null }[] = [];
    const districtInserts: { collectedItemId: string; districtId: string; matchType: "keyword"; matchedKeyword: string | null }[] = [];

    for (const item of batch) {
      const metaKw = (item.rawMetadata as { keyword?: unknown } | null)?.keyword;
      const text = [
        item.title,
        item.content ?? "",
        item.ocrText ?? "",
        item.asrText ?? "",
        ...(item.tags ?? []),
        ...(item.matchedKeywords ?? []),
        typeof metaKw === "string" ? metaKw : "",
      ].filter((s) => s && s.length > 0).join("\n");

      for (const m of matchTopicsForItem(text, topics)) {
        topicInserts.push({ collectedItemId: item.id, topicId: m.topicId, matchType: "keyword", matchedKeyword: m.matchedKeyword });
      }
      for (const m of matchDistrictsForItem(text, districts)) {
        districtInserts.push({ collectedItemId: item.id, districtId: m.districtId, matchType: "keyword", matchedKeyword: m.matchedKeyword });
      }
    }

    if (topicInserts.length > 0) {
      await db.insert(researchCollectedItemTopics).values(topicInserts).onConflictDoNothing();
      topicHits += topicInserts.length;
    }
    if (districtInserts.length > 0) {
      await db.insert(researchCollectedItemDistricts).values(districtInserts).onConflictDoNothing();
      districtHits += districtInserts.length;
    }

    processed += batch.length;
    lastId = batch[batch.length - 1]!.id;
    batchIdx += 1;

    if (batchIdx % 5 === 0 || batch.length < BATCH) {
      console.log(`  batch ${batchIdx}: 处理 ${processed}/${total}, topic-hits=${topicHits} district-hits=${districtHits}`);
    }
    if (batch.length < BATCH) break;
  }

  console.log(`✓ 完成: 扫 ${processed} 条, topic 命中 ${topicHits}, district 命中 ${districtHits}`);
  process.exit(0);
}

main().catch((err) => { console.error("fatal:", err); process.exit(1); });

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { organizations } from "@/db/schema/users";
import { collectedItems, collectedItemContents } from "@/db/schema/collection";
import { researchTopics, researchTopicKeywords } from "@/db/schema/research/research-topics";
import { cqDistricts } from "@/db/schema/research/cq-districts";
import {
  researchCollectedItemTopics,
  researchCollectedItemDistricts,
} from "@/db/schema/research/annotations";
import { eq, sql } from "drizzle-orm";
import {
  searchCollectedItemsByTopicKeywords,
  searchCollectedItemsForResearch,
} from "../collected-item-search";

let orgId: string;
let topicAId: string;
let districtAId: string;
let item1Id: string;
let item2Id: string;
let itemContentHitId: string;
let itemTagHitId: string;
let itemMatchedKeywordHitId: string;

beforeAll(async () => {
  const [org] = await db
    .insert(organizations)
    .values({ name: "Test A3 DAL", slug: "test-a3-dal-" + Date.now() })
    .returning();
  orgId = org!.id;

  const [topic] = await db
    .insert(researchTopics)
    .values({ organizationId: orgId, name: "美丽中国" })
    .returning();
  topicAId = topic!.id;

  // 关键词单独存 researchTopicKeywords 表
  await db.insert(researchTopicKeywords).values([
    { topicId: topicAId, keyword: "美丽中国", isPrimary: true },
    { topicId: topicAId, keyword: "美丽中国建设", isPrimary: false },
  ]);

  // cqDistricts.name is globally unique — upsert and fetch
  await db
    .insert(cqDistricts)
    .values({ name: "涪陵区", code: "CQ-FL", sortOrder: 1 })
    .onConflictDoNothing();
  const [district] = await db
    .select()
    .from(cqDistricts)
    .where(eq(cqDistricts.name, "涪陵区"))
    .limit(1);
  districtAId = district!.id;

  const [i1] = await db
    .insert(collectedItems)
    .values({
      organizationId: orgId,
      contentFingerprint: "fp1-" + Date.now(),
      title: "美丽中国 article 1",
      firstSeenChannel: "test",
      firstSeenAt: new Date(),
      outletTier: "central",
    })
    .returning();
  item1Id = i1!.id;

  const [i2] = await db
    .insert(collectedItems)
    .values({
      organizationId: orgId,
      contentFingerprint: "fp2-" + Date.now(),
      title: "无关 article 2",
      firstSeenChannel: "test",
      firstSeenAt: new Date(),
      outletTier: "industry",
    })
    .returning();
  item2Id = i2!.id;

  await db.insert(researchCollectedItemTopics).values({
    collectedItemId: item1Id,
    topicId: topicAId,
    matchType: "keyword",
    matchedKeyword: "美丽中国",
  });

  await db.insert(researchCollectedItemDistricts).values({
    collectedItemId: item1Id,
    districtId: districtAId,
    matchType: "keyword",
    matchedKeyword: "涪陵区",
  });

  const [contentHit] = await db
    .insert(collectedItems)
    .values({
      organizationId: orgId,
      contentFingerprint: "fp-content-hit-" + Date.now(),
      title: "正文命中的采集项",
      firstSeenChannel: "test",
      firstSeenAt: new Date(),
      outletTier: "industry",
    })
    .returning();
  itemContentHitId = contentHit!.id;
  await db.insert(collectedItemContents).values({
    itemId: itemContentHitId,
    content: "乡村振兴需要持续改善生态宜居水平。",
  });

  const [tagHit] = await db
    .insert(collectedItems)
    .values({
      organizationId: orgId,
      contentFingerprint: "fp-tag-hit-" + Date.now(),
      title: "标签命中的采集项",
      firstSeenChannel: "test",
      firstSeenAt: new Date(),
      tags: ["生态宜居"],
      outletTier: "industry",
    })
    .returning();
  itemTagHitId = tagHit!.id;

  const [matchedKeywordHit] = await db
    .insert(collectedItems)
    .values({
      organizationId: orgId,
      contentFingerprint: "fp-matched-keyword-hit-" + Date.now(),
      title: "命中关键词列召回的采集项",
      firstSeenChannel: "test",
      firstSeenAt: new Date(),
      matchedKeywords: ["生态宜居"],
      outletTier: "industry",
    })
    .returning();
  itemMatchedKeywordHitId = matchedKeywordHit!.id;
});

afterAll(async () => {
  // 手动级联删除（research_topics FK 没有 ON DELETE CASCADE 到 organizations）
  // 1. 先删 annotation 表（被 collectedItems 和 topics/districts cascade，但显式清更保险）
  await db.delete(researchCollectedItemTopics).where(
    sql`collected_item_id IN (SELECT id FROM collected_items WHERE organization_id = ${orgId}::uuid)`,
  );
  await db.delete(researchCollectedItemDistricts).where(
    sql`collected_item_id IN (SELECT id FROM collected_items WHERE organization_id = ${orgId}::uuid)`,
  );
  // 2. 删 collectedItems (belongs to org)
  await db.delete(collectedItems).where(eq(collectedItems.organizationId, orgId));
  // 3. 删 topic keywords then topics
  await db.delete(researchTopicKeywords).where(eq(researchTopicKeywords.topicId, topicAId));
  await db.delete(researchTopics).where(eq(researchTopics.id, topicAId));
  // 4. 删 org
  await db.delete(organizations).where(eq(organizations.id, orgId));
});

describe("searchCollectedItemsForResearch", () => {
  it("基础查 — 按 outletTier 过滤", async () => {
    const r = await searchCollectedItemsForResearch(
      orgId,
      { outletTier: "central" },
      { limit: 10, offset: 0 },
    );
    expect(r.items.length).toBe(1);
    expect(r.items[0]!.id).toBe(item1Id);
  });

  it("按 topic 过滤（EXISTS 子查询 annotation）", async () => {
    const r = await searchCollectedItemsForResearch(
      orgId,
      { topicIds: [topicAId] },
      { limit: 10, offset: 0 },
    );
    expect(r.items.length).toBe(1);
    expect(r.items[0]!.id).toBe(item1Id);
  });

  it("按 district 过滤", async () => {
    const r = await searchCollectedItemsForResearch(
      orgId,
      { districtIds: [districtAId] },
      { limit: 10, offset: 0 },
    );
    expect(r.items.length).toBe(1);
    expect(r.items[0]!.id).toBe(item1Id);
  });

  it("title 关键词过滤", async () => {
    const r = await searchCollectedItemsForResearch(
      orgId,
      { titleKeyword: "美丽" },
      { limit: 10, offset: 0 },
    );
    expect(r.items.length).toBe(1);
  });

  it("跨 org 隔离", async () => {
    const r = await searchCollectedItemsForResearch(
      "00000000-0000-0000-0000-000000000000",
      {},
      { limit: 10, offset: 0 },
    );
    expect(r.items.length).toBe(0);
  });

  it("按主题关键词跨正文、标签、命中关键词列 OR 召回", async () => {
    const r = await searchCollectedItemsByTopicKeywords(
      orgId,
      topicAId,
      ["生态宜居"],
      {},
      { limit: 20, offset: 0 },
    );

    const ids = r.items.map((item) => item.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        itemContentHitId,
        itemTagHitId,
        itemMatchedKeywordHitId,
      ]),
    );
    expect(ids).not.toContain(item2Id);
    expect(
      r.items.find((item) => item.id === itemTagHitId)?.topicMatchedKeywords,
    ).toContain("生态宜居");
  });
});

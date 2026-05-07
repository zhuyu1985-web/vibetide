// A5 Phase 2 — report-aggregator 单测 (6 cases)
//
// 测试模式：实接 Supabase dev DB（与 advanced-search.test.ts / reports.test.ts 同模式）。
// beforeAll：建 1 org + 2 topics + 2 districts + 4 items + annotations
// afterAll：手动级联清理（research_topics / cqDistricts 全局 / annotations 不会随 org cascade）

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { organizations } from "@/db/schema/users";
import { collectedItems } from "@/db/schema/collection";
import {
  researchCollectedItemDistricts,
  researchCollectedItemTopics,
} from "@/db/schema/research/annotations";
import { researchTopics } from "@/db/schema/research/research-topics";
import { cqDistricts } from "@/db/schema/research/cq-districts";

import { computeReportAggregates } from "../report-aggregator";

let orgId: string;
let topicAId: string; // 营商环境
let topicBId: string; // 教育
let districtAId: string;
let districtBId: string;
let item1: string; // central / district A / topic A / 2025-06-01
let item2: string; // provincial_municipal / district B / topic A / 2025-06-02
let item3: string; // central / topic B / 2025-06-02 (no district)
let item4: string; // outletTier=null / 2025-06-03 (no annotations)

const TS = Date.now();
const DISTRICT_A_NAME = `TEST_A5_渝中区_${TS}`;
const DISTRICT_B_NAME = `TEST_A5_江北区_${TS}`;

beforeAll(async () => {
  const [o] = await db
    .insert(organizations)
    .values({ name: "Test A5 Aggregator", slug: `test-a5-agg-${TS}` })
    .returning();
  orgId = o!.id;

  const [tA] = await db
    .insert(researchTopics)
    .values({ organizationId: orgId, name: "营商环境" })
    .returning();
  const [tB] = await db
    .insert(researchTopics)
    .values({ organizationId: orgId, name: "教育" })
    .returning();
  topicAId = tA!.id;
  topicBId = tB!.id;

  // cqDistricts.name 全局唯一 — upsert
  await db
    .insert(cqDistricts)
    .values([
      { name: DISTRICT_A_NAME, code: `A5-A-${TS}`, sortOrder: 999 },
      { name: DISTRICT_B_NAME, code: `A5-B-${TS}`, sortOrder: 999 },
    ])
    .onConflictDoNothing();
  const [dA] = await db
    .select()
    .from(cqDistricts)
    .where(eq(cqDistricts.name, DISTRICT_A_NAME))
    .limit(1);
  const [dB] = await db
    .select()
    .from(cqDistricts)
    .where(eq(cqDistricts.name, DISTRICT_B_NAME))
    .limit(1);
  districtAId = dA!.id;
  districtBId = dB!.id;

  // 4 items 跨 outletTier × 日期
  const [i1] = await db
    .insert(collectedItems)
    .values({
      organizationId: orgId,
      contentFingerprint: `a5-fp1-${TS}`,
      title: "item1 — 央级 + 渝中 + 营商",
      firstSeenChannel: "test",
      firstSeenAt: new Date(),
      publishedAt: new Date("2025-06-01T00:00:00Z"),
      outletTier: "central",
      contentType: "image_text",
    })
    .returning();
  const [i2] = await db
    .insert(collectedItems)
    .values({
      organizationId: orgId,
      contentFingerprint: `a5-fp2-${TS}`,
      title: "item2 — 省级 + 江北 + 营商",
      firstSeenChannel: "test",
      firstSeenAt: new Date(),
      publishedAt: new Date("2025-06-02T00:00:00Z"),
      outletTier: "provincial_municipal",
      contentType: "image_text",
    })
    .returning();
  const [i3] = await db
    .insert(collectedItems)
    .values({
      organizationId: orgId,
      contentFingerprint: `a5-fp3-${TS}`,
      title: "item3 — 央级 + 教育（无 district）",
      firstSeenChannel: "test",
      firstSeenAt: new Date(),
      publishedAt: new Date("2025-06-02T00:00:00Z"),
      outletTier: "central",
      contentType: "image_text",
    })
    .returning();
  const [i4] = await db
    .insert(collectedItems)
    .values({
      organizationId: orgId,
      contentFingerprint: `a5-fp4-${TS}`,
      title: "item4 — outletTier=null（无标注）",
      firstSeenChannel: "test",
      firstSeenAt: new Date(),
      publishedAt: new Date("2025-06-03T00:00:00Z"),
      outletTier: null,
      contentType: "image_text",
    })
    .returning();
  item1 = i1!.id;
  item2 = i2!.id;
  item3 = i3!.id;
  item4 = i4!.id;

  await db.insert(researchCollectedItemTopics).values([
    {
      collectedItemId: item1,
      topicId: topicAId,
      matchType: "keyword",
      matchedKeyword: "营商",
    },
    {
      collectedItemId: item2,
      topicId: topicAId,
      matchType: "keyword",
      matchedKeyword: "营商",
    },
    {
      collectedItemId: item3,
      topicId: topicBId,
      matchType: "keyword",
      matchedKeyword: "教育",
    },
  ]);

  await db.insert(researchCollectedItemDistricts).values([
    {
      collectedItemId: item1,
      districtId: districtAId,
      matchType: "keyword",
      matchedKeyword: "渝中",
    },
    {
      collectedItemId: item2,
      districtId: districtBId,
      matchType: "keyword",
      matchedKeyword: "江北",
    },
  ]);
});

afterAll(async () => {
  // 手动级联清理（cqDistricts 全局；topics 无 cascade FK 到 org）
  await db
    .delete(researchCollectedItemTopics)
    .where(
      sql`collected_item_id IN (SELECT id FROM collected_items WHERE organization_id = ${orgId}::uuid)`,
    );
  await db
    .delete(researchCollectedItemDistricts)
    .where(
      sql`collected_item_id IN (SELECT id FROM collected_items WHERE organization_id = ${orgId}::uuid)`,
    );
  await db.delete(collectedItems).where(eq(collectedItems.organizationId, orgId));
  await db.delete(researchTopics).where(eq(researchTopics.id, topicAId));
  await db.delete(researchTopics).where(eq(researchTopics.id, topicBId));
  await db.delete(organizations).where(eq(organizations.id, orgId));
  await db.delete(cqDistricts).where(eq(cqDistricts.name, DISTRICT_A_NAME));
  await db.delete(cqDistricts).where(eq(cqDistricts.name, DISTRICT_B_NAME));
});

describe("computeReportAggregates", () => {
  it("[1] mediaTierDistribution: 每个 tier 含 count + percentage + topMediaNames", async () => {
    const agg = await computeReportAggregates(orgId, [item1, item2, item3, item4]);

    // 3 个 distinct tier：central / provincial_municipal / null(=未分类)
    expect(agg.mediaTierDistribution.length).toBe(3);

    // central = 2 (item1 + item3) → 50%
    const central = agg.mediaTierDistribution.find((t) => t.tier === "central");
    expect(central?.count).toBe(2);
    expect(central?.percentage).toBe(50);

    // provincial_municipal = 1 → 25%
    const prov = agg.mediaTierDistribution.find(
      (t) => t.tier === "provincial_municipal",
    );
    expect(prov?.count).toBe(1);
    expect(prov?.percentage).toBe(25);

    // null tier 归"未分类"
    const unc = agg.mediaTierDistribution.find((t) => t.tier === "未分类");
    expect(unc?.count).toBe(1);

    // 百分比合计 = 100
    const sumPct = agg.mediaTierDistribution.reduce(
      (s, r) => s + r.percentage,
      0,
    );
    expect(sumPct).toBe(100);

    // topMediaNames 总数 ≤ 3（这里全空因为没绑定 dictionary）
    for (const t of agg.mediaTierDistribution) {
      expect(t.topMediaNames.length).toBeLessThanOrEqual(3);
    }
  });

  it("[2] districtDistribution: 仅含 count ≥ 1 的 district + 百分比", async () => {
    const agg = await computeReportAggregates(orgId, [item1, item2, item3, item4]);

    // 仅 2 个 district 有标注：A(item1) + B(item2)
    expect(agg.districtDistribution.length).toBe(2);

    const dA = agg.districtDistribution.find((d) => d.districtId === districtAId);
    expect(dA?.count).toBe(1);
    expect(dA?.districtName).toBe(DISTRICT_A_NAME);
    expect(dA?.percentage).toBe(25); // 1 / 4 = 25

    const dB = agg.districtDistribution.find((d) => d.districtId === districtBId);
    expect(dB?.count).toBe(1);
    expect(dB?.percentage).toBe(25);

    // topTopics 是数组（V1 留空待 cross-pivot V2 填）
    for (const d of agg.districtDistribution) {
      expect(Array.isArray(d.topTopics)).toBe(true);
      expect(d.topTopics.length).toBeLessThanOrEqual(3);
    }
  });

  it("[3] topicDistribution: 主题排序 + count + percentage", async () => {
    const agg = await computeReportAggregates(orgId, [item1, item2, item3, item4]);

    // 2 个 topic：营商(2) + 教育(1)
    expect(agg.topicDistribution.length).toBe(2);

    const tA = agg.topicDistribution.find((t) => t.topicId === topicAId);
    expect(tA?.count).toBe(2);
    expect(tA?.topicName).toBe("营商环境");
    expect(tA?.percentage).toBe(50); // 2 / 4

    const tB = agg.topicDistribution.find((t) => t.topicId === topicBId);
    expect(tB?.count).toBe(1);
    expect(tB?.topicName).toBe("教育");
    expect(tB?.percentage).toBe(25);

    // topDistricts / topMedia 数组（V1 留空）
    for (const t of agg.topicDistribution) {
      expect(Array.isArray(t.topDistricts)).toBe(true);
      expect(Array.isArray(t.topMedia)).toBe(true);
      expect(t.topDistricts.length).toBeLessThanOrEqual(3);
      expect(t.topMedia.length).toBeLessThanOrEqual(3);
    }

    // count desc 排序：营商(2) 在 教育(1) 之前
    expect(agg.topicDistribution[0]!.count).toBeGreaterThanOrEqual(
      agg.topicDistribution[1]!.count,
    );
  });

  it("[4] dailyTrend: 按日期 group + 累计单调递增", async () => {
    const agg = await computeReportAggregates(orgId, [item1, item2, item3, item4]);

    // 3 个不同的发布日：06-01 / 06-02 / 06-03
    expect(agg.dailyTrend.length).toBe(3);

    // 日期升序
    expect(agg.dailyTrend[0]!.date).toBe("2025-06-01");
    expect(agg.dailyTrend[1]!.date).toBe("2025-06-02");
    expect(agg.dailyTrend[2]!.date).toBe("2025-06-03");

    // 计数：1 / 2 / 1
    expect(agg.dailyTrend[0]!.count).toBe(1);
    expect(agg.dailyTrend[1]!.count).toBe(2);
    expect(agg.dailyTrend[2]!.count).toBe(1);

    // 累计单调 + 末值 = hitCount
    expect(agg.dailyTrend[0]!.cumulative).toBe(1);
    expect(agg.dailyTrend[1]!.cumulative).toBe(3);
    expect(agg.dailyTrend[2]!.cumulative).toBe(4);
    expect(agg.dailyTrend.at(-1)!.cumulative).toBe(agg.hitCount);
  });

  it("[5] HIT_ITEMS_ALL_DELETED: 传入 ID 但全部不存在 → 抛错", async () => {
    await expect(
      computeReportAggregates(orgId, ["00000000-0000-0000-0000-000000000000"]),
    ).rejects.toThrow("HIT_ITEMS_ALL_DELETED");
  });

  it("[6] 空 hitItemIds: 返零态（不查 DB，无 NaN/null 字段）", async () => {
    const agg = await computeReportAggregates(orgId, []);

    expect(agg.hitCount).toBe(0);
    expect(agg.isAiFallback).toBe(false);
    expect(agg.mediaTierDistribution).toEqual([]);
    expect(agg.districtDistribution).toEqual([]);
    expect(agg.topicDistribution).toEqual([]);
    expect(agg.dailyTrend).toEqual([]);
    expect(typeof agg.generatedAt).toBe("string");
    expect(() => new Date(agg.generatedAt).toISOString()).not.toThrow();
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { organizations } from "@/db/schema/users";
import { collectedItems } from "@/db/schema/collection";
import { researchTopics } from "@/db/schema/research/research-topics";
import { cqDistricts } from "@/db/schema/research/cq-districts";
import {
  researchCollectedItemTopics,
  researchCollectedItemDistricts,
} from "@/db/schema/research/annotations";
import { eq, sql } from "drizzle-orm";
import { advancedSearchCollectedItems } from "../collected-item-search";
import type { AdvancedSearchCondition } from "@/app/(dashboard)/research/search-mode-types";

let orgId: string;
let topicAId: string;
let districtAId: string;
let item1Id: string; // "美丽中国" central / 涪陵
let item2Id: string; // "长江保护" provincial_municipal / 重庆 / 无 district 标注
let item3Id: string; // 无 topic / 无 district industry

const TEST_DISTRICT_NAME = "TEST_涪陵区_a4";

beforeAll(async () => {
  const [org] = await db
    .insert(organizations)
    .values({ name: "Test A4 DAL", slug: "test-a4-dal-" + Date.now() })
    .returning();
  orgId = org!.id;

  const [topic] = await db
    .insert(researchTopics)
    .values({ organizationId: orgId, name: "美丽中国" })
    .returning();
  topicAId = topic!.id;

  // cqDistricts.name 是全局唯一 — upsert + fetch
  await db
    .insert(cqDistricts)
    .values({ name: TEST_DISTRICT_NAME, code: "TEST-FL-A4", sortOrder: 999 })
    .onConflictDoNothing();
  const [district] = await db
    .select()
    .from(cqDistricts)
    .where(eq(cqDistricts.name, TEST_DISTRICT_NAME))
    .limit(1);
  districtAId = district!.id;

  const [i1] = await db
    .insert(collectedItems)
    .values({
      organizationId: orgId,
      contentFingerprint: "a4-fp1-" + Date.now(),
      title: "美丽中国生态宜居进展",
      content: "讨论美丽中国建设",
      firstSeenChannel: "tavily",
      firstSeenAt: new Date(),
      publishedAt: new Date("2025-06-15"),
      outletTier: "central",
      outletRegion: "全国",
    })
    .returning();
  item1Id = i1!.id;

  const [i2] = await db
    .insert(collectedItems)
    .values({
      organizationId: orgId,
      contentFingerprint: "a4-fp2-" + Date.now(),
      title: "长江保护重要部署",
      content: "聚焦长江流域",
      firstSeenChannel: "tavily",
      firstSeenAt: new Date(),
      publishedAt: new Date("2025-06-15"),
      outletTier: "provincial_municipal",
      outletRegion: "重庆",
    })
    .returning();
  item2Id = i2!.id;

  const [i3] = await db
    .insert(collectedItems)
    .values({
      organizationId: orgId,
      contentFingerprint: "a4-fp3-" + Date.now(),
      title: "无主题文章",
      content: "今天天气真好",
      firstSeenChannel: "tavily",
      firstSeenAt: new Date(),
      publishedAt: new Date("2025-06-15"),
      outletTier: "industry",
      outletRegion: null,
    })
    .returning();
  item3Id = i3!.id;

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
    matchedKeyword: "涪陵",
  });
});

afterAll(async () => {
  // 手动级联清理（research_topics 无 ON DELETE CASCADE 到 organizations）
  await db.delete(researchCollectedItemTopics).where(
    sql`collected_item_id IN (SELECT id FROM collected_items WHERE organization_id = ${orgId}::uuid)`,
  );
  await db.delete(researchCollectedItemDistricts).where(
    sql`collected_item_id IN (SELECT id FROM collected_items WHERE organization_id = ${orgId}::uuid)`,
  );
  await db.delete(collectedItems).where(eq(collectedItems.organizationId, orgId));
  await db.delete(researchTopics).where(eq(researchTopics.id, topicAId));
  await db.delete(organizations).where(eq(organizations.id, orgId));
  // cqDistricts 全局表 — 显式删除测试种子
  await db.delete(cqDistricts).where(eq(cqDistricts.name, TEST_DISTRICT_NAME));
});

describe("advancedSearchCollectedItems — 单字段", () => {
  it("title contains", async () => {
    const r = await advancedSearchCollectedItems(
      orgId,
      [{ field: "title", operator: "contains", value: "美丽", logic: "and" }],
      { limit: 10, offset: 0 },
    );
    expect(r.items.length).toBe(1);
    expect(r.items[0]!.id).toBe(item1Id);
  });

  it("title not_contains（含 NULL 兜底）", async () => {
    const r = await advancedSearchCollectedItems(
      orgId,
      [{ field: "title", operator: "not_contains", value: "美丽", logic: "and" }],
      { limit: 10, offset: 0 },
    );
    expect(r.items.length).toBe(2); // item2 + item3
  });

  it("outletTier equals", async () => {
    const r = await advancedSearchCollectedItems(
      orgId,
      [{ field: "outletTier", operator: "equals", value: "central", logic: "and" }],
      { limit: 10, offset: 0 },
    );
    expect(r.items.length).toBe(1);
    expect(r.items[0]!.id).toBe(item1Id);
  });

  it("topic equals (EXISTS)", async () => {
    const r = await advancedSearchCollectedItems(
      orgId,
      [{ field: "topic", operator: "equals", value: topicAId, logic: "and" }],
      { limit: 10, offset: 0 },
    );
    expect(r.items.length).toBe(1);
    expect(r.items[0]!.id).toBe(item1Id);
  });

  it("district equals (EXISTS)", async () => {
    const r = await advancedSearchCollectedItems(
      orgId,
      [{ field: "district", operator: "equals", value: districtAId, logic: "and" }],
      { limit: 10, offset: 0 },
    );
    expect(r.items.length).toBe(1);
    expect(r.items[0]!.id).toBe(item1Id);
  });

  it("publishedAt between", async () => {
    const r = await advancedSearchCollectedItems(
      orgId,
      [
        {
          field: "publishedAt",
          operator: "between",
          value: "2025-06-01",
          valueRange: { from: "2025-06-01", to: "2025-06-30" },
          logic: "and",
        },
      ],
      { limit: 10, offset: 0 },
    );
    expect(r.items.length).toBe(3);
  });
});

describe("advancedSearchCollectedItems — 多字段组合", () => {
  it("AND 多字段（标题包含 + 媒体分级=央级）", async () => {
    const r = await advancedSearchCollectedItems(
      orgId,
      [
        { field: "title", operator: "contains", value: "美丽", logic: "and" },
        { field: "outletTier", operator: "equals", value: "central", logic: "and" },
      ],
      { limit: 10, offset: 0 },
    );
    expect(r.items.length).toBe(1);
    expect(r.items[0]!.id).toBe(item1Id);
  });

  it("OR 多字段（标题包含 美丽 OR 长江）", async () => {
    const r = await advancedSearchCollectedItems(
      orgId,
      [
        { field: "title", operator: "contains", value: "美丽", logic: "or" },
        { field: "title", operator: "contains", value: "长江", logic: "and" },
      ],
      { limit: 10, offset: 0 },
    );
    const ids = r.items.map((i) => i.id).sort();
    expect(ids).toEqual([item1Id, item2Id].sort());
  });

  it("AND OR 混合（左结合：A AND B OR C）", async () => {
    // (title contains 美丽 AND outletTier=central) OR title contains 无主题
    const r = await advancedSearchCollectedItems(
      orgId,
      [
        { field: "title", operator: "contains", value: "美丽", logic: "and" },
        { field: "outletTier", operator: "equals", value: "central", logic: "or" },
        { field: "title", operator: "contains", value: "无主题", logic: "and" },
      ],
      { limit: 10, offset: 0 },
    );
    const ids = r.items.map((i) => i.id).sort();
    expect(ids).toEqual([item1Id, item3Id].sort());
  });
});

describe("advancedSearchCollectedItems — 单字段补齐（content/author/outletName/outletRegion/contentType/platform）", () => {
  it("content contains（正文匹配）", async () => {
    const r = await advancedSearchCollectedItems(
      orgId,
      [{ field: "content", operator: "contains", value: "长江", logic: "and" }],
      { limit: 10, offset: 0 },
    );
    expect(r.items.length).toBe(1);
    expect(r.items[0]!.id).toBe(item2Id);
  });

  it("outletRegion equals（区域过滤）", async () => {
    const r = await advancedSearchCollectedItems(
      orgId,
      [{ field: "outletRegion", operator: "equals", value: "重庆", logic: "and" }],
      { limit: 10, offset: 0 },
    );
    expect(r.items.length).toBe(1);
    expect(r.items[0]!.id).toBe(item2Id);
  });

  it("contentType equals（schema 默认 image_text，全部 3 条命中）", async () => {
    // schema collection.contentType default = "image_text"
    const r = await advancedSearchCollectedItems(
      orgId,
      [{ field: "contentType", operator: "equals", value: "image_text", logic: "and" }],
      { limit: 10, offset: 0 },
    );
    expect(r.items.length).toBe(3);
  });

  it("platform equals（firstSeenChannel — tavily）", async () => {
    const r = await advancedSearchCollectedItems(
      orgId,
      [{ field: "platform", operator: "equals", value: "tavily", logic: "and" }],
      { limit: 10, offset: 0 },
    );
    expect(r.items.length).toBe(3);
  });

  it("author contains（rawMetadata->>author 路径匹配 — 无 author 时不命中）", async () => {
    // 种子未注 author，期望返回 0 条
    const r = await advancedSearchCollectedItems(
      orgId,
      [{ field: "author", operator: "contains", value: "张记者", logic: "and" }],
      { limit: 10, offset: 0 },
    );
    expect(r.items.length).toBe(0);
  });

  it("outletName contains（EXISTS 子查询，未绑定 outletId 时不命中）", async () => {
    // 种子未绑 outlet_id，期望 0 条
    const r = await advancedSearchCollectedItems(
      orgId,
      [{ field: "outletName", operator: "contains", value: "人民日报", logic: "and" }],
      { limit: 10, offset: 0 },
    );
    expect(r.items.length).toBe(0);
  });
});

describe("advancedSearchCollectedItems — sidebarFilter（多选 OR-bracket + 跨组 AND）", () => {
  it("sidebar outletTiers 多选构成 OR-bracket（central + provincial_municipal 命中 item1+item2）", async () => {
    const r = await advancedSearchCollectedItems(
      orgId,
      [],
      { limit: 10, offset: 0 },
      {
        outletTiers: ["central", "provincial_municipal"],
      },
    );
    const ids = r.items.map((i) => i.id).sort();
    expect(ids).toEqual([item1Id, item2Id].sort());
  });

  it("sidebar 跨组 AND（outletTiers=[central] AND topicIds=[topicA] → 仅 item1）", async () => {
    const r = await advancedSearchCollectedItems(
      orgId,
      [],
      { limit: 10, offset: 0 },
      {
        outletTiers: ["central"],
        topicIds: [topicAId],
      },
    );
    expect(r.items.length).toBe(1);
    expect(r.items[0]!.id).toBe(item1Id);
  });
});

describe("advancedSearchCollectedItems — 边界 + 安全", () => {
  it("跨 org 隔离", async () => {
    const r = await advancedSearchCollectedItems(
      "00000000-0000-0000-0000-000000000000",
      [{ field: "title", operator: "contains", value: "美丽", logic: "and" }],
      { limit: 10, offset: 0 },
    );
    expect(r.items.length).toBe(0);
  });

  it("空 conditions + 空 sidebar 返回空（不返回所有）", async () => {
    const r = await advancedSearchCollectedItems(orgId, [], { limit: 10, offset: 0 });
    expect(r.items.length).toBe(0);
  });

  it("空 conditions + 有 sidebar 仍可命中（sidebar 单独驱动）", async () => {
    const r = await advancedSearchCollectedItems(
      orgId,
      [],
      { limit: 10, offset: 0 },
      {
        outletTiers: ["central"],
      },
    );
    expect(r.items.length).toBe(1);
    expect(r.items[0]!.id).toBe(item1Id);
  });

  it("超过 10 条 conditions 抛错", async () => {
    const tooMany = Array.from(
      { length: 11 },
      (_, i): AdvancedSearchCondition => ({
        field: "title",
        operator: "contains",
        value: `kw${i}`,
        logic: "and",
      }),
    );
    await expect(
      advancedSearchCollectedItems(orgId, tooMany, { limit: 10, offset: 0 }),
    ).rejects.toThrow(/exceed|超过|too many/i);
  });
});

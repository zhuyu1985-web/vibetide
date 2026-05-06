import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { db } from "@/db";
import { collectedItems, collectionRuns, collectionSources, organizations } from "@/db/schema";
import { mediaOutletDictionary } from "@/db/schema/media-outlet-dictionary";
import { researchTopics } from "@/db/schema/research/research-topics";
import { and, eq } from "drizzle-orm";
import { writeItems } from "../writer";
import { bumpDictionaryVersion } from "@/lib/dal/media-outlet-dictionary";
import { matchTopicsForItem } from "@/lib/research/topic-matcher";
import { matchDistrictsForItem } from "@/lib/research/district-matcher";

// Mock Inngest send to observe event emission without actually dispatching
vi.mock("@/inngest/client", () => ({
  inngest: { send: vi.fn().mockResolvedValue({ ids: ["evt-1"] }) },
}));
import { inngest } from "@/inngest/client";

let orgId: string;
let sourceId: string;
const slug = "test-writer-" + Date.now();

beforeAll(async () => {
  const [org] = await db.insert(organizations).values({
    name: "test-writer-org",
    slug,
  }).returning();
  orgId = org.id;

  const [src] = await db.insert(collectionSources).values({
    organizationId: orgId,
    name: "test-source-" + Date.now(),
    sourceType: "tophub",
    config: { platforms: ["weibo"] },
    targetModules: ["hot_topics"],
  }).returning();
  sourceId = src.id;
});

afterAll(async () => {
  await db.delete(collectedItems).where(eq(collectedItems.organizationId, orgId));
  await db.delete(collectionRuns).where(eq(collectionRuns.organizationId, orgId));
  await db.delete(collectionSources).where(eq(collectionSources.organizationId, orgId));
  await db.delete(mediaOutletDictionary).where(eq(mediaOutletDictionary.organizationId, orgId));
  await db.delete(organizations).where(eq(organizations.id, orgId));
});

beforeEach(async () => {
  vi.clearAllMocks();
  await db.delete(collectedItems).where(eq(collectedItems.organizationId, orgId));
});

async function makeRun(): Promise<string> {
  const [run] = await db.insert(collectionRuns).values({
    sourceId,
    organizationId: orgId,
    trigger: "manual",
    startedAt: new Date(),
    status: "running",
  }).returning({ id: collectionRuns.id });
  return run.id;
}

describe("writeItems", () => {
  it("inserts new items on first write", async () => {
    const runId = await makeRun();
    const result = await writeItems({
      runId,
      sourceId,
      organizationId: orgId,
      items: [
        { title: "Hello world A", url: "https://a.com/1", channel: "tophub/weibo" },
        { title: "Hello world B", url: "https://a.com/2", channel: "tophub/weibo" },
      ],
      source: { targetModules: ["hot_topics"], defaultCategory: null, defaultTags: null },
    });
    expect(result).toMatchObject({ inserted: 2, merged: 0, failed: 0 });
    expect(result.insertedItemIds).toHaveLength(2);
    const rows = await db.select().from(collectedItems).where(eq(collectedItems.organizationId, orgId));
    expect(rows).toHaveLength(2);
    expect(inngest.send).toHaveBeenCalledTimes(2);
  });

  it("merges same URL captured twice", async () => {
    const runId = await makeRun();
    await writeItems({
      runId, sourceId, organizationId: orgId,
      items: [{ title: "Hello", url: "https://a.com/x", channel: "tophub/weibo" }],
      source: { targetModules: [], defaultCategory: null, defaultTags: null },
    });
    vi.clearAllMocks();
    const runId2 = await makeRun();
    const result = await writeItems({
      runId: runId2, sourceId, organizationId: orgId,
      items: [{ title: "Hello", url: "https://a.com/x", channel: "tophub/zhihu" }],
      source: { targetModules: [], defaultCategory: null, defaultTags: null },
    });
    expect(result).toMatchObject({ inserted: 0, merged: 1, failed: 0 });
    expect(result.insertedItemIds).toEqual([]);
    const [row] = await db.select().from(collectedItems).where(eq(collectedItems.organizationId, orgId));
    expect((row.sourceChannels as unknown as unknown[]).length).toBe(2);
    // merge should NOT emit event
    expect(inngest.send).not.toHaveBeenCalled();
  });

  it("merges by content fingerprint when URLs differ but title+day match", async () => {
    const runId = await makeRun();
    await writeItems({
      runId, sourceId, organizationId: orgId,
      items: [{
        title: "Breaking news X",
        url: "https://a.com/v1?utm_source=t",
        publishedAt: new Date("2026-04-18T10:00:00Z"),
        channel: "tophub/weibo",
      }],
      source: { targetModules: [], defaultCategory: null, defaultTags: null },
    });
    const result = await writeItems({
      runId: await makeRun(), sourceId, organizationId: orgId,
      items: [{
        title: "Breaking News X!",  // title normalization collapses to same form
        url: "https://a.com/v2",     // different URL
        publishedAt: new Date("2026-04-18T18:00:00Z"),  // same UTC day
        channel: "tophub/zhihu",
      }],
      source: { targetModules: [], defaultCategory: null, defaultTags: null },
    });
    expect(result).toMatchObject({ inserted: 0, merged: 1, failed: 0 });
    expect(result.insertedItemIds).toEqual([]);
    const rows = await db.select().from(collectedItems).where(eq(collectedItems.organizationId, orgId));
    expect(rows).toHaveLength(1);
  });

  it("emits item.created event only for new inserts", async () => {
    const runId = await makeRun();
    await writeItems({
      runId, sourceId, organizationId: orgId,
      items: [{ title: "evt test", url: "https://e.com/1", channel: "tophub/weibo" }],
      source: { targetModules: ["hot_topics"], defaultCategory: null, defaultTags: null },
    });
    expect(inngest.send).toHaveBeenCalledWith(expect.objectContaining({
      name: "collection/item.created",
      data: expect.objectContaining({
        sourceId,
        organizationId: orgId,
        targetModules: ["hot_topics"],
      }),
    }));
  });
});

describe("writer + outlet-recognizer 集成", () => {
  let outletPeople: string;  // 人民日报
  let outletCqrb: string;    // 重庆日报

  beforeAll(async () => {
    // 插入测试媒体字典条目（以 TEST_ 前缀避免与真实数据冲突）
    const [a] = await db.insert(mediaOutletDictionary).values({
      organizationId: orgId,
      outletName: "TEST_人民日报",
      outletTier: "central",
      outletRegion: "全国",
      domains: ["test-people.com.cn"],
      publicAccountNames: ["TEST_人民日报"],
    }).returning();
    outletPeople = a!.id;

    const [b] = await db.insert(mediaOutletDictionary).values({
      organizationId: orgId,
      outletName: "TEST_重庆日报",
      outletTier: "provincial_municipal",
      outletRegion: "重庆",
      domains: ["test-cqrb.cn"],
      publicAccountNames: ["TEST_重庆日报"],
    }).returning();
    outletCqrb = b!.id;

    // 升版本使 writer cache 能感知到字典变化
    await bumpDictionaryVersion(orgId);
  });

  it("source.outletId 已配置 → 写入时直接采用", async () => {
    // 创建含 outletId 的 source
    const [src] = await db.insert(collectionSources).values({
      organizationId: orgId,
      name: "src-with-outletid-" + Date.now(),
      sourceType: "tophub",
      config: { platforms: ["weibo"] },
      targetModules: ["hot_topics"],
      outletId: outletPeople,
    }).returning();

    const runId = await (async () => {
      const [run] = await db.insert(collectionRuns).values({
        sourceId: src.id,
        organizationId: orgId,
        trigger: "manual",
        startedAt: new Date(),
        status: "running",
      }).returning({ id: collectionRuns.id });
      return run.id;
    })();

    const result = await writeItems({
      runId,
      sourceId: src.id,
      organizationId: orgId,
      items: [{ title: "测试文章-outletId直接采用", url: "https://unknown-host.com/art1", channel: "tophub/weibo" }],
      source: {
        targetModules: ["hot_topics"],
        defaultCategory: null,
        defaultTags: null,
        outletId: outletPeople,
        defaultOutletTier: null,
        defaultOutletRegion: null,
      },
    });

    expect(result.inserted).toBe(1);
    const [row] = await db.select().from(collectedItems).where(eq(collectedItems.organizationId, orgId));
    expect(row.outletId).toBe(outletPeople);
    expect(row.outletTier).toBe("central");

    // 清理
    await db.delete(collectionRuns).where(eq(collectionRuns.id, runId));
    await db.delete(collectionSources).where(eq(collectionSources.id, src.id));
  });

  it("URL host 命中字典 → 自动填 outlet_tier", async () => {
    const runId = await makeRun();

    const result = await writeItems({
      runId,
      sourceId,
      organizationId: orgId,
      items: [{ title: "测试文章-URL命中", url: "https://test-cqrb.cn/article/123", channel: "tophub/weibo" }],
      source: {
        targetModules: [],
        defaultCategory: null,
        defaultTags: null,
        outletId: null,
        defaultOutletTier: null,
        defaultOutletRegion: null,
      },
    });

    expect(result.inserted).toBe(1);
    const [row] = await db.select().from(collectedItems).where(eq(collectedItems.organizationId, orgId));
    expect(row.outletId).toBe(outletCqrb);
    expect(row.outletTier).toBe("provincial_municipal");
    expect(row.outletRegion).toBe("重庆");
  });

  it("公众号名命中 → 自动填", async () => {
    const runId = await makeRun();

    const result = await writeItems({
      runId,
      sourceId,
      organizationId: orgId,
      items: [{
        title: "测试文章-公众号命中",
        url: "https://totally-unknown.com/p/999",
        channel: "tophub/weixin",
        rawMetadata: { publicAccountName: "TEST_人民日报" },
      }],
      source: {
        targetModules: [],
        defaultCategory: null,
        defaultTags: null,
        outletId: null,
        defaultOutletTier: null,
        defaultOutletRegion: null,
      },
    });

    expect(result.inserted).toBe(1);
    const [row] = await db.select().from(collectedItems).where(eq(collectedItems.organizationId, orgId));
    expect(row.outletId).toBe(outletPeople);
    expect(row.outletTier).toBe("central");
  });

  it("不命中 + source.defaultOutletTier 兜底", async () => {
    const runId = await makeRun();

    const result = await writeItems({
      runId,
      sourceId,
      organizationId: orgId,
      items: [{
        title: "测试文章-默认兜底",
        url: "https://no-match-host.example/art",
        channel: "tophub/weibo",
      }],
      source: {
        targetModules: [],
        defaultCategory: null,
        defaultTags: null,
        outletId: null,
        defaultOutletTier: "central",
        defaultOutletRegion: "全国",
      },
    });

    expect(result.inserted).toBe(1);
    const [row] = await db.select().from(collectedItems).where(eq(collectedItems.organizationId, orgId));
    expect(row.outletId).toBeNull();
    expect(row.outletTier).toBe("central");
    expect(row.outletRegion).toBe("全国");
  });

  it("version-stamp：outlet 修改后下一条写入用上新字典（tikhub 集成前置测试）", async () => {
    // 1. 先写一条（此时 TEST_人民日报 tier = central）
    const runId1 = await makeRun();
    await writeItems({
      runId: runId1,
      sourceId,
      organizationId: orgId,
      items: [{ title: "版本戳测试-第一条", url: "https://test-people.com.cn/v1/art1", channel: "tophub/weibo" }],
      source: { targetModules: [], defaultCategory: null, defaultTags: null },
    });

    const rows1 = await db.select().from(collectedItems).where(eq(collectedItems.organizationId, orgId));
    const first = rows1.find((r) => r.title === "版本戳测试-第一条");
    expect(first?.outletTier).toBe("central");

    // 2. 修改字典：把 TEST_人民日报 tier 改为 industry，并 bump 版本
    await db.update(mediaOutletDictionary)
      .set({ outletTier: "industry", updatedAt: new Date() })
      .where(eq(mediaOutletDictionary.id, outletPeople));
    await bumpDictionaryVersion(orgId);

    // 3. 写第二条（URL 也命中 test-people.com.cn）
    const runId2 = await makeRun();
    await writeItems({
      runId: runId2,
      sourceId,
      organizationId: orgId,
      items: [{ title: "版本戳测试-第二条", url: "https://test-people.com.cn/v1/art2", channel: "tophub/weibo" }],
      source: { targetModules: [], defaultCategory: null, defaultTags: null },
    });

    // 4. 第二条应该用上新 tier = industry
    const rows2 = await db.select().from(collectedItems).where(eq(collectedItems.organizationId, orgId));
    const second = rows2.find((r) => r.title === "版本戳测试-第二条");
    expect(second?.outletTier).toBe("industry");

    // 5. 恢复字典原状避免影响其他 case
    await db.update(mediaOutletDictionary)
      .set({ outletTier: "central", updatedAt: new Date() })
      .where(eq(mediaOutletDictionary.id, outletPeople));
    await bumpDictionaryVersion(orgId);
  });
});

describe("writer + bulk-import 集成", () => {
  it("Excel 导入的 RawItem 入库后 outlet 自动识别 + virtual source 关联", async () => {
    const { seedExcelImportVirtualSource, EXCEL_IMPORT_SOURCE_NAME } = await import(
      "@/db/seed/excel-import-virtual-source"
    );
    await seedExcelImportVirtualSource(orgId);
    const [vsource] = await db
      .select()
      .from(collectionSources)
      .where(
        and(
          eq(collectionSources.organizationId, orgId),
          eq(collectionSources.name, EXCEL_IMPORT_SOURCE_NAME),
        ),
      )
      .limit(1);

    // 灌字典让 recognizer 命中
    const [o] = await db
      .insert(mediaOutletDictionary)
      .values({
        organizationId: orgId,
        outletName: "TEST_BULK_重庆生态环境",
        outletTier: "government_self_media",
        outletRegion: "重庆",
        publicAccountNames: ["TEST_BULK_重庆生态环境"],
      })
      .returning();
    await bumpDictionaryVersion(orgId);

    const runId = await makeRun();
    await writeItems({
      runId,
      sourceId: vsource!.id,
      organizationId: orgId,
      source: {
        targetModules: [],
        defaultCategory: null,
        defaultTags: null,
        outletId: null,
        defaultOutletTier: null,
        defaultOutletRegion: null,
      },
      items: [
        {
          title: "test bulk-import 集成 case",
          url: undefined,
          channel: "excel_import",
          contentType: "image_text",
          attachments: [],
          rawMetadata: {
            importedFromExcel: true,
            publicAccountName: "TEST_BULK_重庆生态环境",
          },
        },
      ],
    });

    // 用唯一 title 查（RawItem 没有 contentFingerprint 字段，不依赖 fingerprint 实现细节）
    const [row] = await db
      .select()
      .from(collectedItems)
      .where(
        and(
          eq(collectedItems.organizationId, orgId),
          eq(collectedItems.title, "test bulk-import 集成 case"),
        ),
      )
      .limit(1);
    expect(row?.outletTier).toBe("government_self_media");
    expect(row?.firstSeenSourceId).toBe(vsource!.id);

    // 清理字典条目
    await db.delete(mediaOutletDictionary).where(eq(mediaOutletDictionary.id, o!.id));
    await bumpDictionaryVersion(orgId);
  });
});

describe("writer + a3 annotate 集成", () => {
  // 验证：writer 写入采集项后，matcher 能命中对应 topic 和 district
  // production 路径: writer → collection/item.created 事件 → Inngest annotateCollectedItem
  // 本 case 直接调 matcher 函数绕过 inngest event 触发，验证 matcher 逻辑正确性

  it("matcher 能命中 topic + district（间接验证 annotate inngest 自动触发逻辑）", async () => {
    // 1. 灌测试 topic（name 作主词）
    const [t] = await db.insert(researchTopics).values({
      organizationId: orgId,
      name: "TEST_A3_长江生态",
    }).returning();

    // 2. 使用固定 district id（直接在 matcher 调用时构造 — 不依赖 DB 真实行）
    const testDistrictId = "00000000-0000-0000-0000-000000000001";

    try {
      // 3. 写入采集项
      const runId = await makeRun();
      const result = await writeItems({
        runId,
        sourceId,
        organizationId: orgId,
        source: { targetModules: [], defaultCategory: null, defaultTags: null },
        items: [{
          title: "TEST_A3_长江生态 在涪陵的最新进展",
          url: "https://a3-test.example.com/art1",
          channel: "test_a3",
        }],
      });
      expect(result.inserted).toBe(1);

      // 4. 直接调 matcher — 验证 topic 命中
      const topicMatches = matchTopicsForItem(
        "TEST_A3_长江生态 在涪陵的最新进展",
        [{ id: t!.id, name: "TEST_A3_长江生态", primaryKeywords: ["TEST_A3_长江生态"], otherKeywords: [] }],
      );
      expect(topicMatches.length).toBe(1);
      expect(topicMatches[0]!.topicId).toBe(t!.id);
      expect(topicMatches[0]!.matchedKeyword).toBe("TEST_A3_长江生态");

      // 5. 直接调 matcher — 验证 district 命中（"涪陵" 变体命中 "涪陵区"）
      const districtMatches = matchDistrictsForItem(
        "TEST_A3_长江生态 在涪陵的最新进展",
        [{ id: testDistrictId, name: "涪陵区" }],
      );
      expect(districtMatches.length).toBe(1);
      expect(districtMatches[0]!.districtId).toBe(testDistrictId);
      expect(districtMatches[0]!.matchedKeyword).toBe("涪陵");
    } finally {
      // 清理（topic；collectedItems 由外层 beforeEach 清理）
      await db.delete(researchTopics).where(eq(researchTopics.id, t!.id));
    }
  });
});

describe("writer + tikhub adapter 集成", () => {
  let tikhubOutletId: string;

  beforeAll(async () => {
    // 灌一条微信公众号出口字典条目，让 recognizer 通过 publicAccountName 命中
    const [o] = await db.insert(mediaOutletDictionary).values({
      organizationId: orgId,
      outletName: "TEST_重庆生态环境",
      outletTier: "government_self_media",
      outletRegion: "重庆",
      domains: [],
      publicAccountNames: ["TEST_重庆生态环境"],
    }).returning();
    tikhubOutletId = o!.id;
    await bumpDictionaryVersion(orgId);
  });

  afterAll(async () => {
    await db.delete(mediaOutletDictionary).where(eq(mediaOutletDictionary.id, tikhubOutletId));
    await bumpDictionaryVersion(orgId);
  });

  it("微信公众号文章入库后 outlet 自动识别", async () => {
    const runId = await makeRun();
    const result = await writeItems({
      runId,
      sourceId,
      organizationId: orgId,
      items: [{
        title: "test wechat 公众号文章",
        url: "https://mp.weixin.qq.com/s/tikhub-test-wechat-001",
        channel: "tikhub_wechat_mp",
        contentType: "image_text",
        attachments: [],
        rawMetadata: { platform: "wechat_mp", publicAccountName: "TEST_重庆生态环境" },
      }],
      source: {
        targetModules: [],
        defaultCategory: null,
        defaultTags: null,
        outletId: null,
        defaultOutletTier: null,
        defaultOutletRegion: null,
      },
    });
    expect(result.inserted).toBe(1);
    const [row] = await db.select().from(collectedItems).where(eq(collectedItems.organizationId, orgId));
    expect(row?.outletTier).toBe("government_self_media");
    expect(row?.outletId).toBe(tikhubOutletId);
    expect(row?.contentType).toBe("image_text");
  });

  it("抖音视频入库带 attachments", async () => {
    const runId = await makeRun();
    await writeItems({
      runId,
      sourceId,
      organizationId: orgId,
      items: [{
        title: "test douyin 短视频",
        url: "https://www.douyin.com/video/tikhub-test-douyin-001",
        channel: "tikhub_douyin",
        contentType: "short_video",
        attachments: [
          { kind: "video", url: "https://example.com/douyin-v.mp4", durationMs: 30000 },
          { kind: "thumbnail", url: "https://example.com/douyin-t.jpg" },
        ],
        rawMetadata: { platform: "douyin", aweme_id: "tikhub-test-douyin-001" },
      }],
      source: {
        targetModules: [],
        defaultCategory: null,
        defaultTags: null,
        outletId: null,
        defaultOutletTier: null,
        defaultOutletRegion: null,
      },
    });

    const rows = await db.select().from(collectedItems).where(eq(collectedItems.organizationId, orgId));
    const douyinRow = rows.find((r) => r.firstSeenChannel === "tikhub_douyin");
    expect(douyinRow).toBeDefined();
    expect(douyinRow?.contentType).toBe("short_video");
    const attachments = douyinRow?.attachments as Array<{ kind: string }>;
    expect(attachments?.length).toBe(2);
    expect(attachments?.map((a) => a.kind)).toContain("video");
    expect(attachments?.map((a) => a.kind)).toContain("thumbnail");
  });
});

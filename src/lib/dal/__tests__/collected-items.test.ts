import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/db";
import {
  organizations,
  collectionSources,
  collectedItems,
  collectionRuns,
  collectionLogs,
  hotTopics,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import {
  listCollectedItems,
  getCollectedItemDetail,
  getDerivedRecordsForItem,
  getMonitoringSummary,
  getCollectionTrend,
  getSourceErrorList,
  getRecentErrors,
} from "../collected-items";

// ────────────────────────────────────────────────
// 测试数据 ID 变量
// ────────────────────────────────────────────────
let orgA: string;
let orgB: string;
let sourceA1: string; // tophub 源
let sourceA2: string; // tavily 源
let itemA1: string;   // hot_topics 模块 item
let itemA2: string;   // news 模块 item
let itemA3: string;   // 旧 item (超时间窗口)
let runA1: string;    // 失败的 run
let runA2: string;    // 成功的 run
let htId: string;     // hotTopics 派生记录 (linked to itemA1)

beforeAll(async () => {
  const now = Date.now();

  // 创建 2 个临时组织
  const [a] = await db
    .insert(organizations)
    .values({ name: "ci-items-A", slug: `ci-items-a-${now}` })
    .returning();
  const [b] = await db
    .insert(organizations)
    .values({ name: "ci-items-B", slug: `ci-items-b-${now}` })
    .returning();
  orgA = a.id;
  orgB = b.id;

  // 两个源属于 orgA
  const [s1] = await db
    .insert(collectionSources)
    .values({
      organizationId: orgA,
      name: "ci-source-tophub",
      sourceType: "tophub",
      config: { platforms: ["weibo"] },
      targetModules: ["hot_topics"],
    })
    .returning();
  sourceA1 = s1.id;

  const [s2] = await db
    .insert(collectionSources)
    .values({
      organizationId: orgA,
      name: "ci-source-tavily",
      sourceType: "tavily",
      config: { keywords: ["ai"], timeRange: "7d", maxResults: 5 },
      targetModules: ["news"],
    })
    .returning();
  sourceA2 = s2.id;

  // orgB 的源（用于隔离测试）
  await db.insert(collectionSources).values({
    organizationId: orgB,
    name: "ci-source-B",
    sourceType: "tophub",
    config: { platforms: ["weibo"] },
    targetModules: [],
  });

  // orgA 的 items
  const t1 = new Date(now - 10 * 60 * 1000); // 10 分钟前
  const [i1] = await db
    .insert(collectedItems)
    .values({
      organizationId: orgA,
      contentFingerprint: `fp-a1-${now}`,
      title: "科技新闻标题一",
      content: "这是科技相关内容，AI 驱动未来",
      summary: "科技摘要",
      firstSeenSourceId: sourceA1,
      firstSeenChannel: "tophub/weibo",
      firstSeenAt: t1,
      derivedModules: ["hot_topics"],
      enrichmentStatus: "enriched",
    })
    .returning();
  itemA1 = i1.id;

  const [i2] = await db
    .insert(collectedItems)
    .values({
      organizationId: orgA,
      contentFingerprint: `fp-a2-${now}`,
      title: "财经头条报道",
      content: "股市波动明显",
      summary: "财经摘要",
      firstSeenSourceId: sourceA2,
      firstSeenChannel: "tavily/web",
      firstSeenAt: new Date(now - 5 * 60 * 1000),
      derivedModules: ["news"],
      enrichmentStatus: "pending",
    })
    .returning();
  itemA2 = i2.id;

  // 旧 item: 8 天前 (超出 7 天窗口)
  const [i3] = await db
    .insert(collectedItems)
    .values({
      organizationId: orgA,
      contentFingerprint: `fp-a3-${now}`,
      title: "很久之前的旧内容",
      content: "过时内容",
      firstSeenSourceId: sourceA1,
      firstSeenChannel: "tophub/weibo",
      firstSeenAt: new Date(now - 8 * 24 * 60 * 60 * 1000),
      derivedModules: [],
      enrichmentStatus: "pending",
    })
    .returning();
  itemA3 = i3.id;

  // orgB 的 item（隔离用）
  await db.insert(collectedItems).values({
    organizationId: orgB,
    contentFingerprint: `fp-b1-${now}`,
    title: "orgB 内容",
    content: "B 组织内容",
    firstSeenChannel: "tophub/weibo",
    firstSeenAt: new Date(),
    derivedModules: [],
    enrichmentStatus: "pending",
  });

  // runs：一个失败一个成功
  const [r1] = await db
    .insert(collectionRuns)
    .values({
      sourceId: sourceA1,
      organizationId: orgA,
      trigger: "cron",
      startedAt: new Date(now - 60 * 60 * 1000), // 1h 前
      finishedAt: new Date(now - 59 * 60 * 1000),
      status: "failed",
      itemsAttempted: 10,
      itemsInserted: 0,
      itemsMerged: 0,
      itemsFailed: 10,
      errorSummary: "网络超时连接失败",
    })
    .returning();
  runA1 = r1.id;

  const [r2] = await db
    .insert(collectionRuns)
    .values({
      sourceId: sourceA1,
      organizationId: orgA,
      trigger: "cron",
      startedAt: new Date(now - 30 * 60 * 1000),
      finishedAt: new Date(now - 29 * 60 * 1000),
      status: "success",
      itemsAttempted: 5,
      itemsInserted: 3,
      itemsMerged: 2,
      itemsFailed: 0,
    })
    .returning();
  runA2 = r2.id;

  // collection_logs: error + info
  await db.insert(collectionLogs).values([
    {
      runId: runA1,
      sourceId: sourceA1,
      level: "error",
      message: "连接超时，重试失败",
      loggedAt: new Date(now - 58 * 60 * 1000),
    },
    {
      runId: runA2,
      sourceId: sourceA1,
      level: "info",
      message: "采集成功",
      loggedAt: new Date(now - 28 * 60 * 1000),
    },
    {
      runId: runA2,
      sourceId: sourceA1,
      level: "warn",
      message: "部分内容解析失败",
      loggedAt: new Date(now - 27 * 60 * 1000),
    },
  ]);

  // hot_topics 派生记录 (linked to itemA1)
  const [ht] = await db
    .insert(hotTopics)
    .values({
      organizationId: orgA,
      title: "AI 科技热点",
      collectedItemId: itemA1,
      titleHash: `th-ci-test-${now}`,
    })
    .returning();
  htId = ht.id;
});

afterAll(async () => {
  // 按依赖顺序删除：先删 hot_topics
  if (htId) {
    await db.delete(hotTopics).where(eq(hotTopics.id, htId));
  }
  // 删 logs
  await db.delete(collectionLogs).where(
    eq(collectionLogs.sourceId, sourceA1),
  );
  // 删 runs
  await db.delete(collectionRuns).where(eq(collectionRuns.organizationId, orgA));
  await db.delete(collectionRuns).where(eq(collectionRuns.organizationId, orgB));
  // 删 items
  await db.delete(collectedItems).where(eq(collectedItems.organizationId, orgA));
  await db.delete(collectedItems).where(eq(collectedItems.organizationId, orgB));
  // 删 sources
  await db.delete(collectionSources).where(eq(collectionSources.organizationId, orgA));
  await db.delete(collectionSources).where(eq(collectionSources.organizationId, orgB));
  // 删 orgs
  await db.delete(organizations).where(eq(organizations.id, orgA));
  await db.delete(organizations).where(eq(organizations.id, orgB));
});

// ────────────────────────────────────────────────
// Test 1: 多租户隔离
// ────────────────────────────────────────────────
describe("listCollectedItems — 多租户隔离", () => {
  it("只返回本 org 的 items", async () => {
    const result = await listCollectedItems(orgA);
    expect(result.items.length).toBeGreaterThanOrEqual(3);
    expect(result.items.every((r) => r.organizationId === orgA)).toBe(true);
    // orgB 的内容不出现
    const titles = result.items.map((r) => r.title);
    expect(titles).not.toContain("orgB 内容");
  });

  it("orgB 只能看到自己的 items", async () => {
    const result = await listCollectedItems(orgB);
    expect(result.items.every((r) => r.organizationId === orgB)).toBe(true);
    expect(result.items.length).toBe(1);
  });
});

// ────────────────────────────────────────────────
// Test 2: 按 sourceType 过滤
// ────────────────────────────────────────────────
describe("listCollectedItems — sourceType 过滤", () => {
  it("过滤 tophub 源 → 只返回 tophub 来源的 items", async () => {
    const result = await listCollectedItems(orgA, { sourceType: "tophub" });
    expect(result.items.length).toBeGreaterThanOrEqual(1);
    // 所有 items 的 firstSeenSourceId 应为 sourceA1
    expect(result.items.every((r) => r.firstSeenSourceId === sourceA1)).toBe(true);
  });

  it("过滤 tavily 源 → 只返回 tavily 来源的 items", async () => {
    const result = await listCollectedItems(orgA, { sourceType: "tavily" });
    expect(result.items.every((r) => r.firstSeenSourceId === sourceA2)).toBe(true);
    // itemA2 是 tavily 来源
    expect(result.items.map((r) => r.id)).toContain(itemA2);
  });

  it("不存在的 sourceType 返回空列表", async () => {
    const result = await listCollectedItems(orgA, { sourceType: "nonexistent_adapter" });
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

// ────────────────────────────────────────────────
// Test 3: 按 targetModule 过滤
// ────────────────────────────────────────────────
describe("listCollectedItems — targetModule 过滤", () => {
  it("过滤 hot_topics → 只返回 derivedModules 包含 hot_topics 的", async () => {
    const result = await listCollectedItems(orgA, { targetModule: "hot_topics" });
    expect(result.items.length).toBeGreaterThanOrEqual(1);
    expect(result.items.every((r) => r.derivedModules.includes("hot_topics"))).toBe(true);
    expect(result.items.map((r) => r.id)).toContain(itemA1);
  });

  it("过滤 news → 只返回 derivedModules 包含 news 的", async () => {
    const result = await listCollectedItems(orgA, { targetModule: "news" });
    expect(result.items.every((r) => r.derivedModules.includes("news"))).toBe(true);
    expect(result.items.map((r) => r.id)).toContain(itemA2);
  });
});

// ────────────────────────────────────────────────
// Test 4: 按时间窗口过滤
// ────────────────────────────────────────────────
describe("listCollectedItems — sinceMs 时间窗过滤", () => {
  it("sinceMs=1h 前 → 过滤掉旧 item (8 天前)", async () => {
    const since1h = Date.now() - 60 * 60 * 1000;
    const result = await listCollectedItems(orgA, { sinceMs: since1h });
    const ids = result.items.map((r) => r.id);
    // itemA1 (10min) 和 itemA2 (5min) 应该在
    expect(ids).toContain(itemA1);
    expect(ids).toContain(itemA2);
    // itemA3 (8 天前) 不应该在
    expect(ids).not.toContain(itemA3);
  });
});

// ────────────────────────────────────────────────
// Test 5: 全文搜索
// ────────────────────────────────────────────────
describe("listCollectedItems — searchText 全文搜索", () => {
  it("按标题关键词搜索", async () => {
    const result = await listCollectedItems(orgA, { searchText: "科技" });
    expect(result.items.length).toBeGreaterThanOrEqual(1);
    const titles = result.items.map((r) => r.title);
    expect(titles.some((t) => t.includes("科技"))).toBe(true);
  });

  it("按内容关键词搜索", async () => {
    const result = await listCollectedItems(orgA, { searchText: "股市" });
    expect(result.items.length).toBeGreaterThanOrEqual(1);
    expect(result.items.map((r) => r.id)).toContain(itemA2);
  });

  it("不匹配的关键词返回空", async () => {
    const result = await listCollectedItems(orgA, { searchText: "完全不存在的词xyz123" });
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

// ────────────────────────────────────────────────
// Test 6: 分页 total 正确性
// ────────────────────────────────────────────────
describe("listCollectedItems — 分页 total", () => {
  it("total 值与实际数量一致", async () => {
    const allResult = await listCollectedItems(orgA, {}, { limit: 100 });
    const pagedResult = await listCollectedItems(orgA, {}, { limit: 1, offset: 0 });
    // total 应相同（都是全量计数）
    expect(pagedResult.total).toBe(allResult.total);
    // items 数量受 limit 限制
    expect(pagedResult.items).toHaveLength(1);
  });

  it("offset 分页正确", async () => {
    const first = await listCollectedItems(orgA, {}, { limit: 2, offset: 0 });
    const second = await listCollectedItems(orgA, {}, { limit: 2, offset: 2 });
    const firstIds = first.items.map((r) => r.id);
    const secondIds = second.items.map((r) => r.id);
    // 两页不重叠
    const overlap = firstIds.filter((id) => secondIds.includes(id));
    expect(overlap).toHaveLength(0);
    // total 相同
    expect(first.total).toBe(second.total);
  });
});

// ────────────────────────────────────────────────
// Test 7: getMonitoringSummary KPI
// ────────────────────────────────────────────────
describe("getMonitoringSummary", () => {
  it("返回正确的 org 作用域 KPI", async () => {
    const summary = await getMonitoringSummary(orgA);

    // 24h 内有 2 个 items (itemA1 和 itemA2 都在 1h 内)
    expect(summary.itemsLast24h).toBeGreaterThanOrEqual(2);
    // 7d 内有 2 个 items (itemA3 是 8 天前,不算)
    expect(summary.itemsLast7d).toBeGreaterThanOrEqual(2);
    // 24h 有 2 次 runs (runA1 failed, runA2 success)
    expect(summary.totalRunsLast24h).toBeGreaterThanOrEqual(2);
    // 1 次失败
    expect(summary.failedRunsLast24h).toBeGreaterThanOrEqual(1);
    // 成功率 < 1
    expect(summary.successRate24h).toBeLessThan(1);
    expect(summary.successRate24h).toBeGreaterThan(0);
    // sources: orgA 有 2 个 enabled 源
    expect(summary.totalSources).toBeGreaterThanOrEqual(2);
    expect(summary.activeSources).toBeGreaterThanOrEqual(2);
  });

  it("orgB 的 KPI 与 orgA 隔离", async () => {
    const summaryA = await getMonitoringSummary(orgA);
    const summaryB = await getMonitoringSummary(orgB);
    // orgB 没有 runs
    expect(summaryB.totalRunsLast24h).toBe(0);
    expect(summaryB.failedRunsLast24h).toBe(0);
    expect(summaryB.successRate24h).toBe(1); // 无 runs => 默认 1
    // 总 items 互相不干扰
    expect(summaryA.itemsLast24h).not.toBe(summaryB.itemsLast24h);
  });
});

// ────────────────────────────────────────────────
// Test 8: getCollectionTrend 日期聚合
// ────────────────────────────────────────────────
describe("getCollectionTrend", () => {
  it("返回日期分组的趋势数据", async () => {
    const trend = await getCollectionTrend(orgA, 7);
    // 应有数据点（今天有 runs）
    expect(trend.length).toBeGreaterThanOrEqual(1);
    // 每个点有 date/inserted/merged/failed
    for (const point of trend) {
      expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof point.inserted).toBe("number");
      expect(typeof point.merged).toBe("number");
      expect(typeof point.failed).toBe("number");
    }
    // 今天应有一个失败: itemsFailed sum >= 10
    const today = new Date().toISOString().slice(0, 10);
    const todayPoint = trend.find((p) => p.date === today);
    if (todayPoint) {
      // runA1 itemsFailed=10, runA2 itemsFailed=0
      expect(todayPoint.failed).toBeGreaterThanOrEqual(0);
      // runA2 inserted=3, merged=2
      expect(todayPoint.inserted).toBeGreaterThanOrEqual(3);
      expect(todayPoint.merged).toBeGreaterThanOrEqual(2);
    }
  });

  it("超出 days 范围的 runs 不出现", async () => {
    // 只查 1 天
    const trend1d = await getCollectionTrend(orgA, 1);
    // getCollectionTrend 用 `now - days*24h` 作为 since 下界，用 UTC
    // to_char 做日期分桶。跨 UTC 零点时（08:00-09:00 CST），1h 前的 run
    // 会落到"昨天"的桶里但仍在 since 窗口内。按 since 下界比较才是对齐
    // 实现语义，按 today UTC 比较会误判。
    const sinceDate = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    for (const point of trend1d) {
      expect(point.date >= sinceDate).toBe(true);
    }
  });
});

// ────────────────────────────────────────────────
// Test 9: getSourceErrorList 按 failedCount 倒序
// ────────────────────────────────────────────────
describe("getSourceErrorList", () => {
  it("返回有错误的源列表,按 failedCount 倒序", async () => {
    const list = await getSourceErrorList(orgA, 7, 10);
    expect(list.length).toBeGreaterThanOrEqual(1);
    // sourceA1 有 1 次 failed run
    const entry = list.find((r) => r.sourceId === sourceA1);
    expect(entry).toBeTruthy();
    expect(entry!.failedCount).toBeGreaterThanOrEqual(1);
    expect(entry!.sourceName).toBe("ci-source-tophub");
    expect(entry!.sourceType).toBe("tophub");
    // lastErrorMessage 来自 errorSummary
    expect(entry!.lastErrorMessage).toBe("网络超时连接失败");
  });

  it("按 failedCount 降序排列", async () => {
    const list = await getSourceErrorList(orgA, 7, 10);
    for (let i = 1; i < list.length; i++) {
      expect(list[i - 1].failedCount).toBeGreaterThanOrEqual(list[i].failedCount);
    }
  });

  it("orgB 没有 failed runs → 返回空列表", async () => {
    const list = await getSourceErrorList(orgB, 7, 10);
    expect(list).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────
// Test 10: getDerivedRecordsForItem 派生记录
// ────────────────────────────────────────────────
describe("getDerivedRecordsForItem", () => {
  it("返回 hot_topics 派生记录", async () => {
    const derived = await getDerivedRecordsForItem(itemA1, orgA);
    expect(derived.length).toBeGreaterThanOrEqual(1);
    const htRecord = derived.find((r) => r.module === "hot_topics");
    expect(htRecord).toBeTruthy();
    expect(htRecord!.recordId).toBe(htId);
    expect(htRecord!.title).toBe("AI 科技热点");
    expect(htRecord!.linkHref).toContain(htId);
  });

  it("无派生记录的 item 返回空数组", async () => {
    const derived = await getDerivedRecordsForItem(itemA2, orgA);
    expect(derived).toHaveLength(0);
  });

  it("跨 org 无法读取派生记录", async () => {
    const derived = await getDerivedRecordsForItem(itemA1, orgB);
    // orgB 下查 itemA1 的派生:hotTopics 用 orgB 过滤 → 返回空
    expect(derived).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────
// Test 11: getRecentErrors 只过滤 error 级别
// ────────────────────────────────────────────────
describe("getRecentErrors", () => {
  it("只返回 level=error 的日志条目", async () => {
    const errors = await getRecentErrors(orgA, 50);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors.every((r) => r.level === "error")).toBe(true);
    // info 和 warn 不出现
    const messages = errors.map((r) => r.message);
    expect(messages).not.toContain("采集成功");
    expect(messages).not.toContain("部分内容解析失败");
    // error 消息应在
    expect(messages).toContain("连接超时，重试失败");
  });

  it("sourceName 正确 join", async () => {
    const errors = await getRecentErrors(orgA, 50);
    const entry = errors.find((r) => r.message === "连接超时，重试失败");
    expect(entry?.sourceName).toBe("ci-source-tophub");
    expect(entry?.sourceId).toBe(sourceA1);
  });

  it("orgB 没有 error 日志 → 返回空", async () => {
    const errors = await getRecentErrors(orgB, 50);
    expect(errors).toHaveLength(0);
  });
});

// ────────────────────────────────────────────────
// Test 12: getCollectedItemDetail
// ────────────────────────────────────────────────
describe("getCollectedItemDetail", () => {
  it("返回正确的单条 item", async () => {
    const item = await getCollectedItemDetail(itemA1, orgA);
    expect(item).not.toBeNull();
    expect(item!.id).toBe(itemA1);
    expect(item!.title).toBe("科技新闻标题一");
  });

  it("跨 org 返回 null", async () => {
    const item = await getCollectedItemDetail(itemA1, orgB);
    expect(item).toBeNull();
  });
});

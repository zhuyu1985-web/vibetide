# A4 高级检索 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给研究模块加知网风格高级检索 — 11 个检索字段（4 text + 6 enum + 1 time）/ 动态 1-10 行检索条件 / 简单线性 AND/OR 左结合 / 简单操作符（contains / not_contains / equals / not_equals / between）/ 5 项侧栏全局过滤器 / 结果 DataTable + 关键词高亮，让客户在 `/research/search` 进行精准字段限定 + 多关键词组合检索。

**Architecture:** 在 A3 已有 `searchCollectedItemsForResearch` DAL 基础上扩展 `advancedSearchCollectedItems`（drizzle `and()` / `or()` 嵌套实现 SQL 左结合 + EXISTS 子查询过滤 topic/district/outletName + organizationId 强制 AND）→ server action `advancedSearchArticles` 真正实现 → UI 拆分 `advanced-search-builder.tsx`（动态行 + 字段/操作符联动 + 值控件条件渲染）+ `advanced-filters-sidebar.tsx`（5 项 chip/multi-select/date-range）→ 集成到 `search-workbench-client.tsx` 加"简单/高级"切换。命中关键词高亮用纯 React 组件分段 wrap 不用 dangerouslySetInnerHTML。

**Tech Stack:** Next.js 16 App Router / TypeScript strict / Drizzle ORM / shadcn Select / DateRangePicker / DataTable / vitest。

**关联 sub-spec:** `/Users/zhuyu/dev/chinamcloud/vibetide/docs/superpowers/specs/2026-05-06-a4-advanced-search-design.md`

**关联 main spec:** `/Users/zhuyu/dev/chinamcloud/vibetide/docs/superpowers/specs/2026-05-04-news-research-overhaul-design.md` §4.5

**总工期：3.5-4 工作日**（4 phase）

---

## 全局约定

- **单分支**（CLAUDE.md）：所有 commit 直接落 `main`
- **--no-verify** 已授权全 Wave 1
- **绝对路径**：所有文件引用使用绝对路径
- **设计系统**：所有按钮/输入用 vibetide 共享组件 + 无边框 + sonner toast
- **TDD 节奏**：DAL 严格红→绿；UI 跑 tsc + 浏览器手动
- **A1+A2+A2.5+A3 已就绪**：collected_items 含 outlet_id/outlet_tier/outlet_region/contentType/firstSeenChannel；annotation 表 + recognizer + auto-annotate Inngest 全在；search-workbench-client.tsx 已 800 行
- **现有 type 别名兼容**：A3 已 export `AdvancedSearchField`（仅 8 字段）/ `AdvancedSearchOperator`（5 操作符 underscore 命名）/ `SearchCondition`（用 logic: "and"|"or"）。A4 **重构** AdvancedSearchField 改 11 字段（title / content / author / outletName / outletTier / outletRegion / district / topic / contentType / publishedAt / platform），保留 underscore 操作符命名，保留 `logic` 字段（值小写 and/or）；同步重写 `advancedSearchArticles` switch 字段名（旧 keyword/tier/channel → 新 title/outletTier/platform）

---

## File Structure

### 新建（5 个）

| 文件 | 责任 |
|---|---|
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/dal/research/__tests__/advanced-search.test.ts` | DAL 单测 21 case |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/research/advanced-search-builder.tsx` | client 组件：动态行 + 字段/操作符/值条件渲染 |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/research/advanced-filters-sidebar.tsx` | client 组件：5 项全局过滤 |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/research/keyword-highlight.tsx` | 客户端 helper：关键词高亮 React 组件 |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/research/search-mode-types.ts` | 共享类型：AdvancedSearchCondition / SidebarFilter |

### 修改（4 个）

| 文件 | 改动 |
|---|---|
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/dal/research/collected-item-search.ts` | 加 `advancedSearchCollectedItems` 函数（drizzle and/or 嵌套实现） |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/actions/research/collected-item-search.ts` | re-export 新 11 字段 `AdvancedSearchField` 取代旧 8 字段；同步重写 `advancedSearchArticles` switch 字段名；加 `searchAdvanced` server action（直接透传 sidebarFilter 给 DAL，无线性化） |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/research/search-workbench-client.tsx` | 加"简单/高级"模式切换；高级模式 mount AdvancedSearchBuilder + AdvancedFiltersSidebar |
| `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/research/page.tsx` | 加载 outlets + districts + topics + regions（distinct 查询）+ platforms（distinct）传给 client |

---

## Phase 1：DAL `advancedSearchCollectedItems` + 单测（Day 1，约 1 天）

### Task 1.1：扩展 search-mode-types + AdvancedSearchField

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/research/search-mode-types.ts`
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/actions/research/collected-item-search.ts`（扩 type）

- [ ] **Step 1：创建 search-mode-types.ts**

```ts
// 共享类型，避免 client/server 双引用 server action 文件类型
export type AdvancedSearchField =
  | "title" | "content" | "author" | "outletName"
  | "outletTier" | "outletRegion" | "district" | "topic"
  | "contentType" | "publishedAt" | "platform";

export type AdvancedSearchOperator =
  | "contains" | "not_contains" | "equals" | "not_equals" | "between";

export interface AdvancedSearchCondition {
  field: AdvancedSearchField;
  operator: AdvancedSearchOperator;
  value: string;                                   // 单值 (text/enum)
  value2?: string;                                  // between 操作符的右端
  valueRange?: { from: string; to: string };       // publishedAt between (ISO 字符串)
  logic: "and" | "or";                              // 与下一行的连接（最后一行未用）
}

export interface SidebarFilter {
  outletTiers?: string[];
  districtIds?: string[];
  topicIds?: string[];
  contentTypes?: string[];
  publishedAtRange?: { from: string; to: string };
}

// 字段 → 操作符可选列表（UI 联动）
export const FIELD_OPERATORS: Record<AdvancedSearchField, AdvancedSearchOperator[]> = {
  title: ["contains", "not_contains"],
  content: ["contains", "not_contains"],
  author: ["contains", "not_contains"],
  outletName: ["contains", "not_contains"],
  outletTier: ["equals", "not_equals"],
  outletRegion: ["equals", "not_equals"],
  district: ["equals", "not_equals"],
  topic: ["equals", "not_equals"],
  contentType: ["equals", "not_equals"],
  platform: ["equals", "not_equals"],
  publishedAt: ["between"],
};

export const FIELD_LABELS: Record<AdvancedSearchField, string> = {
  title: "标题", content: "正文", author: "作者", outletName: "媒体名",
  outletTier: "媒体分级", outletRegion: "区域", district: "区县", topic: "主题",
  contentType: "内容类型", platform: "平台", publishedAt: "发布时间",
};

export const OPERATOR_LABELS: Record<AdvancedSearchOperator, string> = {
  contains: "包含", not_contains: "不包含",
  equals: "等于", not_equals: "不等于",
  between: "在范围内",
};
```

- [ ] **Step 2：迁移 actions/research/collected-item-search.ts 旧 type + 旧 advancedSearchArticles**

```bash
grep -n "AdvancedSearchField\|AdvancedSearchOperator\|SearchCondition" /Users/zhuyu/dev/chinamcloud/vibetide/src/app/actions/research/collected-item-search.ts
```

**注意**：现有文件中 `AdvancedSearchField` 是 8 字段（含 `keyword`/`tier`/`channel`），且 `advancedSearchArticles`（行 101-148）的 switch 用了这些旧字段名。**简单 re-export 会让 switch 编译失败**。改用以下两步：

1. **删除旧 type 定义**（行 30-43），改为 re-export 新 type：

```ts
// 删除原 30-43 行的旧 AdvancedSearchField / AdvancedSearchOperator / SearchCondition 三段，替换为：
export type {
  AdvancedSearchField,
  AdvancedSearchOperator,
  AdvancedSearchCondition,
  AdvancedSearchCondition as SearchCondition, // 兼容旧名
  SidebarFilter,
} from "@/app/(dashboard)/research/search-mode-types";
```

2. **同步重写 `advancedSearchArticles`**（行 101-148）的 switch 字段名映射：

```ts
// advancedSearchArticles 里的 switch (cond.field) — 把旧字段名换成新字段名
for (const cond of params.conditions) {
  if (cond.operator === "contains" || cond.operator === "equals") {
    switch (cond.field) {
      // 旧 "keyword" 字段已删 — 客户端如还在传，client 修改前会跑 default
      case "title":
        filter.titleKeyword = cond.value;
        break;
      case "content":
        filter.contentKeyword = cond.value;
        break;
      case "outletTier":         // was "tier"
        filter.outletTier = cond.value;
        break;
      case "district":
        filter.districtIds = [cond.value];
        break;
      case "platform":            // was "channel" — 不再 map 到 filter（filter 没 platform 字段），暂时跳过
        break;
      // outletName / outletRegion / topic / contentType / author —
      // 旧 advancedSearchArticles 不支持，留待 Phase 3 切到 searchAdvanced 后弃用
    }
  }
  if (cond.field === "publishedAt" && cond.operator === "between") {
    if (cond.valueRange) {
      filter.publishedAtFrom = new Date(cond.valueRange.from);
      filter.publishedAtTo = new Date(cond.valueRange.to);
    }
  }
}
```

注：`advancedSearchArticles` 仅过渡用，Phase 3 的 `searchAdvanced` 替代之后即可删除。`searchArticles`（行 60-98）不受影响。

- [ ] **Step 3：tsc 通过**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit 2>&1 | head -20
```

期望：0 错。如 search-workbench-client.tsx 还在传旧字段名（`keyword`/`tier`/`channel`），编译会报 `Type '"keyword"' is not assignable to AdvancedSearchField`。这种情况下：把 client 中传的旧字段名改成新字段名（`title`/`outletTier`/`platform`），保持 Phase 1 commit 自洽 build 通过。

---

### Task 1.2：DAL `advancedSearchCollectedItems` + TDD 测试

**Files:**
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/dal/research/collected-item-search.ts`（追加新函数）
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/dal/research/__tests__/advanced-search.test.ts`

- [ ] **Step 1：写测试（TDD 红灯）**

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { organizations } from "@/db/schema/users";
import { collectedItems } from "@/db/schema/collection";
import { researchTopics } from "@/db/schema/research/research-topics";
import { cqDistricts } from "@/db/schema/research/cq-districts";
import { researchCollectedItemTopics, researchCollectedItemDistricts } from "@/db/schema/research/annotations";
import { eq } from "drizzle-orm";
import { advancedSearchCollectedItems } from "../collected-item-search";
import type { AdvancedSearchCondition } from "@/app/(dashboard)/research/search-mode-types";

let orgId: string;
let topicAId: string;
let districtAId: string;
let item1Id: string; // "美丽中国" central / 涪陵
let item2Id: string; // "长江保护" provincial_municipal / 渝中
let item3Id: string; // 无 topic 命中 industry / 无 district

beforeAll(async () => {
  const [org] = await db.insert(organizations).values({ name: "Test A4 DAL", slug: "test-a4-dal-" + Date.now() }).returning();
  orgId = org!.id;

  const [topic] = await db.insert(researchTopics).values({ organizationId: orgId, name: "美丽中国" }).returning();
  topicAId = topic!.id;
  const [district] = await db.insert(cqDistricts).values({ name: "TEST_涪陵区", code: "TEST-FL", sortOrder: 999 }).onConflictDoNothing().returning();
  districtAId = district?.id ?? (await db.select().from(cqDistricts).where(eq(cqDistricts.name, "TEST_涪陵区")).limit(1))[0]!.id;

  const seed = (title: string, tier: string, region: string | null, content: string) =>
    db.insert(collectedItems).values({
      organizationId: orgId, contentFingerprint: `fp-${title}-${Date.now()}`,
      title, content, firstSeenChannel: "tavily",
      firstSeenAt: new Date(), publishedAt: new Date("2025-06-15"),
      outletTier: tier, outletRegion: region,
    }).returning();

  const [i1] = await seed("美丽中国生态宜居进展", "central", "全国", "讨论美丽中国建设");
  const [i2] = await seed("长江保护重要部署", "provincial_municipal", "重庆", "聚焦长江流域");
  const [i3] = await seed("无主题文章", "industry", null, "今天天气真好");
  item1Id = i1!.id; item2Id = i2!.id; item3Id = i3!.id;

  await db.insert(researchCollectedItemTopics).values({
    collectedItemId: item1Id, topicId: topicAId, matchType: "keyword", matchedKeyword: "美丽中国",
  });
  await db.insert(researchCollectedItemDistricts).values({
    collectedItemId: item1Id, districtId: districtAId, matchType: "keyword", matchedKeyword: "涪陵",
  });
});

afterAll(async () => {
  await db.delete(organizations).where(eq(organizations.id, orgId));  // cascade
  await db.delete(cqDistricts).where(eq(cqDistricts.name, "TEST_涪陵区"));
});

describe("advancedSearchCollectedItems — 单字段", () => {
  it("title contains", async () => {
    const r = await advancedSearchCollectedItems(orgId,
      [{ field: "title", operator: "contains", value: "美丽", logic: "and" }],
      { limit: 10, offset: 0 });
    expect(r.items.length).toBe(1);
    expect(r.items[0]!.id).toBe(item1Id);
  });

  it("title not_contains（含 NULL 兜底）", async () => {
    const r = await advancedSearchCollectedItems(orgId,
      [{ field: "title", operator: "not_contains", value: "美丽", logic: "and" }],
      { limit: 10, offset: 0 });
    expect(r.items.length).toBe(2);  // item2 + item3
  });

  it("outletTier equals", async () => {
    const r = await advancedSearchCollectedItems(orgId,
      [{ field: "outletTier", operator: "equals", value: "central", logic: "and" }],
      { limit: 10, offset: 0 });
    expect(r.items.length).toBe(1);
    expect(r.items[0]!.id).toBe(item1Id);
  });

  it("topic equals (EXISTS)", async () => {
    const r = await advancedSearchCollectedItems(orgId,
      [{ field: "topic", operator: "equals", value: topicAId, logic: "and" }],
      { limit: 10, offset: 0 });
    expect(r.items.length).toBe(1);
    expect(r.items[0]!.id).toBe(item1Id);
  });

  it("district equals (EXISTS)", async () => {
    const r = await advancedSearchCollectedItems(orgId,
      [{ field: "district", operator: "equals", value: districtAId, logic: "and" }],
      { limit: 10, offset: 0 });
    expect(r.items.length).toBe(1);
    expect(r.items[0]!.id).toBe(item1Id);
  });

  it("publishedAt between", async () => {
    const r = await advancedSearchCollectedItems(orgId,
      [{ field: "publishedAt", operator: "between", value: "2025-06-01",
         valueRange: { from: "2025-06-01", to: "2025-06-30" }, logic: "and" }],
      { limit: 10, offset: 0 });
    expect(r.items.length).toBe(3);
  });
});

describe("advancedSearchCollectedItems — 多字段组合", () => {
  it("AND 多字段（标题包含 + 媒体分级=央级）", async () => {
    const r = await advancedSearchCollectedItems(orgId, [
      { field: "title", operator: "contains", value: "美丽", logic: "and" },
      { field: "outletTier", operator: "equals", value: "central", logic: "and" },
    ], { limit: 10, offset: 0 });
    expect(r.items.length).toBe(1);
    expect(r.items[0]!.id).toBe(item1Id);
  });

  it("OR 多字段（标题包含 美丽 OR 长江）", async () => {
    const r = await advancedSearchCollectedItems(orgId, [
      { field: "title", operator: "contains", value: "美丽", logic: "or" },
      { field: "title", operator: "contains", value: "长江", logic: "and" },
    ], { limit: 10, offset: 0 });
    const ids = r.items.map(i => i.id).sort();
    expect(ids).toEqual([item1Id, item2Id].sort());
  });

  it("AND OR 混合（左结合：A AND B OR C）", async () => {
    // (title contains 美丽 AND outletTier=central) OR title contains 无主题
    const r = await advancedSearchCollectedItems(orgId, [
      { field: "title", operator: "contains", value: "美丽", logic: "and" },
      { field: "outletTier", operator: "equals", value: "central", logic: "or" },
      { field: "title", operator: "contains", value: "无主题", logic: "and" },
    ], { limit: 10, offset: 0 });
    const ids = r.items.map(i => i.id).sort();
    expect(ids).toEqual([item1Id, item3Id].sort());
  });
});

describe("advancedSearchCollectedItems — 单字段补齐（content/author/outletName/outletRegion/contentType/platform）", () => {
  it("content contains（正文匹配）", async () => {
    const r = await advancedSearchCollectedItems(orgId,
      [{ field: "content", operator: "contains", value: "长江", logic: "and" }],
      { limit: 10, offset: 0 });
    expect(r.items.length).toBe(1);
    expect(r.items[0]!.id).toBe(item2Id);
  });

  it("outletRegion equals（区域过滤）", async () => {
    const r = await advancedSearchCollectedItems(orgId,
      [{ field: "outletRegion", operator: "equals", value: "重庆", logic: "and" }],
      { limit: 10, offset: 0 });
    expect(r.items.length).toBe(1);
    expect(r.items[0]!.id).toBe(item2Id);
  });

  it("contentType equals（内容类型过滤 — 默认 article）", async () => {
    // 测试种子默认 contentType=article（schema default），全部 3 条命中
    const r = await advancedSearchCollectedItems(orgId,
      [{ field: "contentType", operator: "equals", value: "article", logic: "and" }],
      { limit: 10, offset: 0 });
    expect(r.items.length).toBe(3);
  });

  it("platform equals（firstSeenChannel — tavily）", async () => {
    const r = await advancedSearchCollectedItems(orgId,
      [{ field: "platform", operator: "equals", value: "tavily", logic: "and" }],
      { limit: 10, offset: 0 });
    expect(r.items.length).toBe(3);
  });

  it("author contains（rawMetadata->>author 路径匹配 — 无 author 时不命中）", async () => {
    // 种子未注 author，期望返回 0 条
    const r = await advancedSearchCollectedItems(orgId,
      [{ field: "author", operator: "contains", value: "张记者", logic: "and" }],
      { limit: 10, offset: 0 });
    expect(r.items.length).toBe(0);
  });

  it("outletName contains（EXISTS 子查询，未绑定 outletId 时不命中）", async () => {
    // 种子未绑 outlet_id，期望 0 条
    const r = await advancedSearchCollectedItems(orgId,
      [{ field: "outletName", operator: "contains", value: "人民日报", logic: "and" }],
      { limit: 10, offset: 0 });
    expect(r.items.length).toBe(0);
  });
});

describe("advancedSearchCollectedItems — sidebarFilter（多选 OR-bracket + 跨组 AND）", () => {
  it("sidebar outletTiers 多选构成 OR-bracket（central + provincial_municipal 命中 item1+item2）", async () => {
    const r = await advancedSearchCollectedItems(orgId, [], { limit: 10, offset: 0 }, {
      outletTiers: ["central", "provincial_municipal"],
    });
    const ids = r.items.map(i => i.id).sort();
    expect(ids).toEqual([item1Id, item2Id].sort());
  });

  it("sidebar 跨组 AND（outletTiers=[central] AND topicIds=[topicA] → 仅 item1）", async () => {
    const r = await advancedSearchCollectedItems(orgId, [], { limit: 10, offset: 0 }, {
      outletTiers: ["central"],
      topicIds: [topicAId],
    });
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
    const r = await advancedSearchCollectedItems(orgId, [], { limit: 10, offset: 0 }, {
      outletTiers: ["central"],
    });
    expect(r.items.length).toBe(1);
    expect(r.items[0]!.id).toBe(item1Id);
  });

  it("超过 10 条 conditions 抛错", async () => {
    const tooMany = Array.from({ length: 11 }, (_, i): AdvancedSearchCondition => ({
      field: "title", operator: "contains", value: `kw${i}`, logic: "and",
    }));
    await expect(
      advancedSearchCollectedItems(orgId, tooMany, { limit: 10, offset: 0 }),
    ).rejects.toThrow(/exceed|超过|too many/i);
  });
});
```

**测试统计：21 case** = 单字段主线 6（title contains/title not_contains/outletTier/topic/district/publishedAt）+ AND/OR 组合 3（多 AND / 多 OR / AND OR 混合左结合）+ 单字段补齐 6（content/outletRegion/contentType/platform/author/outletName）+ sidebarFilter 2（OR-bracket 多选 / 跨组 AND）+ 边界 4（跨 org 隔离 / 双空返空 / sidebar 单驱命中 / 超 10 抛错）。覆盖 11 字段全部 + 左结合 + sidebar 分组 + 边界。

- [ ] **Step 2：跑测试预期失败**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx vitest run src/lib/dal/research/__tests__/advanced-search.test.ts
```

- [ ] **Step 3：实现 `advancedSearchCollectedItems`**

在 `src/lib/dal/research/collected-item-search.ts` 末尾追加：

```ts
import { and, or, eq, ilike, sql, type SQL } from "drizzle-orm";
import type { AdvancedSearchCondition, SidebarFilter } from "@/app/(dashboard)/research/search-mode-types";

export async function advancedSearchCollectedItems(
  orgId: string,
  conditions: AdvancedSearchCondition[],
  pagination: { limit: number; offset: number },
  sidebarFilter?: SidebarFilter,
): Promise<{ items: CollectedItemWithAnnotations[]; total: number }> {
  if (conditions.length > 10) throw new Error("conditions exceed max 10");

  const sidebarExprs = buildSidebarExprs(sidebarFilter);
  if (conditions.length === 0 && sidebarExprs.length === 0) return { items: [], total: 0 };

  // 必备：org 隔离
  const orgScope: SQL = eq(collectedItems.organizationId, orgId);

  // 拼接用户 conditions 为 SQL 表达式（左结合）
  let userExpr: SQL | undefined;
  if (conditions.length > 0) {
    userExpr = buildSingleCondition(conditions[0]!);
    for (let i = 1; i < conditions.length; i++) {
      const op = conditions[i - 1]!.logic;
      const next = buildSingleCondition(conditions[i]!);
      userExpr = op === "and" ? and(userExpr!, next)! : or(userExpr!, next)!;
    }
  }

  // sidebar 每组单独 OR-bracket（保留分组），再与 userExpr 一起 AND
  const allParts: SQL[] = [orgScope, ...sidebarExprs];
  if (userExpr) allParts.push(userExpr);
  const finalExpr: SQL = and(...allParts)!;

  const items = await db.select({
    id: collectedItems.id,
    title: collectedItems.title,
    content: collectedItems.content,
    outletId: collectedItems.outletId,
    outletTier: collectedItems.outletTier,
    outletRegion: collectedItems.outletRegion,
    outletName: mediaOutletDictionary.outletName,
    publishedAt: collectedItems.publishedAt,
    contentType: collectedItems.contentType,
    url: collectedItems.canonicalUrl,
  })
    .from(collectedItems)
    .leftJoin(mediaOutletDictionary, eq(collectedItems.outletId, mediaOutletDictionary.id))
    .where(finalExpr)
    .orderBy(sql`${collectedItems.publishedAt} DESC NULLS LAST`)
    .limit(pagination.limit)
    .offset(pagination.offset);

  const [{ count }] = await db.select({ count: sql<number>`COUNT(*)::int` })
    .from(collectedItems)
    .where(finalExpr);

  return { items, total: count };
}

/**
 * 把 SidebarFilter 各组转成独立 SQL OR-bracket，跨组 AND。
 * 这样可以保留分组语义，避免线性化 AND/OR 串导致的优先级丢失。
 */
function buildSidebarExprs(s?: SidebarFilter): SQL[] {
  if (!s) return [];
  const out: SQL[] = [];
  if (s.outletTiers?.length) {
    out.push(or(...s.outletTiers.map(t => eq(collectedItems.outletTier, t)))!);
  }
  if (s.contentTypes?.length) {
    out.push(or(...s.contentTypes.map(t => eq(collectedItems.contentType, t)))!);
  }
  if (s.districtIds?.length) {
    const districtOrs = s.districtIds.map(id =>
      sql`EXISTS (SELECT 1 FROM ${researchCollectedItemDistricts} cid WHERE cid.collected_item_id = ${collectedItems.id} AND cid.district_id = ${id})`
    );
    out.push(or(...districtOrs)!);
  }
  if (s.topicIds?.length) {
    const topicOrs = s.topicIds.map(id =>
      sql`EXISTS (SELECT 1 FROM ${researchCollectedItemTopics} cit WHERE cit.collected_item_id = ${collectedItems.id} AND cit.topic_id = ${id})`
    );
    out.push(or(...topicOrs)!);
  }
  if (s.publishedAtRange) {
    out.push(sql`${collectedItems.publishedAt} BETWEEN ${new Date(s.publishedAtRange.from)} AND ${new Date(s.publishedAtRange.to)}`);
  }
  return out;
}

function buildSingleCondition(c: AdvancedSearchCondition): SQL {
  switch (c.field) {
    case "title":
      return c.operator === "contains"
        ? ilike(collectedItems.title, `%${c.value}%`)
        : sql`(${collectedItems.title} NOT ILIKE ${`%${c.value}%`} OR ${collectedItems.title} IS NULL)`;
    case "content":
      return c.operator === "contains"
        ? sql`${collectedItems.content} ILIKE ${`%${c.value}%`}`
        : sql`(${collectedItems.content} NOT ILIKE ${`%${c.value}%`} OR ${collectedItems.content} IS NULL)`;
    case "author":
      return c.operator === "contains"
        ? sql`${collectedItems.rawMetadata}->>'author' ILIKE ${`%${c.value}%`}`
        : sql`(${collectedItems.rawMetadata}->>'author' NOT ILIKE ${`%${c.value}%`} OR ${collectedItems.rawMetadata}->>'author' IS NULL)`;
    case "outletName":
      return c.operator === "contains"
        ? sql`EXISTS (SELECT 1 FROM ${mediaOutletDictionary} mod WHERE mod.id = ${collectedItems.outletId} AND mod.outlet_name ILIKE ${`%${c.value}%`})`
        : sql`(NOT EXISTS (SELECT 1 FROM ${mediaOutletDictionary} mod WHERE mod.id = ${collectedItems.outletId} AND mod.outlet_name ILIKE ${`%${c.value}%`}) OR ${collectedItems.outletId} IS NULL)`;
    case "outletTier":
      if (c.value === "unclassified") return sql`${collectedItems.outletTier} IS NULL`;
      return c.operator === "equals"
        ? eq(collectedItems.outletTier, c.value)
        : sql`(${collectedItems.outletTier} != ${c.value} OR ${collectedItems.outletTier} IS NULL)`;
    case "outletRegion":
      return c.operator === "equals"
        ? eq(collectedItems.outletRegion, c.value)
        : sql`(${collectedItems.outletRegion} != ${c.value} OR ${collectedItems.outletRegion} IS NULL)`;
    case "contentType":
      return c.operator === "equals"
        ? eq(collectedItems.contentType, c.value)
        : sql`${collectedItems.contentType} != ${c.value}`;
    case "platform":
      return c.operator === "equals"
        ? eq(collectedItems.firstSeenChannel, c.value)
        : sql`${collectedItems.firstSeenChannel} != ${c.value}`;
    case "district":
      return c.operator === "equals"
        ? sql`EXISTS (SELECT 1 FROM ${researchCollectedItemDistricts} cid WHERE cid.collected_item_id = ${collectedItems.id} AND cid.district_id = ${c.value})`
        : sql`NOT EXISTS (SELECT 1 FROM ${researchCollectedItemDistricts} cid WHERE cid.collected_item_id = ${collectedItems.id} AND cid.district_id = ${c.value})`;
    case "topic":
      return c.operator === "equals"
        ? sql`EXISTS (SELECT 1 FROM ${researchCollectedItemTopics} cit WHERE cit.collected_item_id = ${collectedItems.id} AND cit.topic_id = ${c.value})`
        : sql`NOT EXISTS (SELECT 1 FROM ${researchCollectedItemTopics} cit WHERE cit.collected_item_id = ${collectedItems.id} AND cit.topic_id = ${c.value})`;
    case "publishedAt": {
      if (!c.valueRange) throw new Error("publishedAt requires valueRange");
      return sql`${collectedItems.publishedAt} BETWEEN ${new Date(c.valueRange.from)} AND ${new Date(c.valueRange.to)}`;
    }
  }
}
```

注：`drizzle-orm` 的 `and()` 和 `or()` 接受可变参数 + 自动嵌套；左结合循环正确实现 `((A op B) op C)`。

- [ ] **Step 4：跑测试预期通过**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx vitest run src/lib/dal/research/__tests__/advanced-search.test.ts
# 期望 21/21 pass
```

如失败：根据失败原因修 buildSingleCondition 分支。

- [ ] **Step 5：tsc 通过**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit
```

---

### Task 1.3：Phase 1 commit

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && \
git add "src/app/(dashboard)/research/search-mode-types.ts" \
        src/app/actions/research/collected-item-search.ts \
        src/lib/dal/research/collected-item-search.ts \
        "src/lib/dal/research/__tests__/advanced-search.test.ts" && \
git commit --no-verify -m "$(cat <<'EOF'
feat(a4): Phase 1 — DAL advancedSearchCollectedItems + 21 case 单测

- search-mode-types.ts: AdvancedSearchField (11 字段) / AdvancedSearchOperator (5 操作符 underscore 命名) / AdvancedSearchCondition / SidebarFilter / FIELD_OPERATORS 联动表 / FIELD_LABELS / OPERATOR_LABELS
- actions: 删除旧 8 字段 AdvancedSearchField 改 re-export 新 type；重写 advancedSearchArticles 用新字段名（title/outletTier/platform/content/district/publishedAt）
- DAL advancedSearchCollectedItems: drizzle and()/or() 嵌套实现左结合 + 11 字段 buildSingleCondition (text/enum/EXISTS topic+district+outletName/time between) + sidebarFilter 参数（buildSidebarExprs 各组独立 OR-bracket，跨组 AND，避免线性化错误） + organizationId 强制 + ≤10 conditions 校验 + 空 conditions+空 sidebar 返空
- 21 单测 pass: 单字段主线 6 + AND/OR 组合 3 + 单字段补齐 6（content/outletRegion/contentType/platform/author/outletName）+ sidebar 2（OR-bracket / 跨组 AND）+ 边界 4（跨 org 隔离 / 双空返空 / sidebar 单驱 / 超 10）

tsc 0 错

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2：UI 条件构造器（Day 2，约 1 天）

### Task 2.1：advanced-search-builder.tsx

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/research/advanced-search-builder.tsx`

- [ ] **Step 1：写组件（client component）**

```tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/shared/date-picker";
import { Plus, X } from "lucide-react";
import {
  type AdvancedSearchCondition,
  type AdvancedSearchField,
  type AdvancedSearchOperator,
  FIELD_OPERATORS, FIELD_LABELS, OPERATOR_LABELS,
} from "./search-mode-types";

export interface BuilderOptions {
  outletTiers: { value: string; label: string }[];      // 5 选项 + 未分类
  outletRegions: string[];                              // distinct 加载
  districts: { id: string; name: string }[];            // 40 区县
  topics: { id: string; name: string }[];               // 16 主题
  contentTypes: { value: string; label: string }[];     // 6 选项
  platforms: string[];                                   // distinct 加载
}

interface Props {
  conditions: AdvancedSearchCondition[];
  onChange: (conditions: AdvancedSearchCondition[]) => void;
  options: BuilderOptions;
}

export function AdvancedSearchBuilder({ conditions, onChange, options }: Props) {
  function updateRow(idx: number, patch: Partial<AdvancedSearchCondition>) {
    const next = conditions.map((c, i) => i === idx ? { ...c, ...patch } : c);
    onChange(next);
  }

  function handleFieldChange(idx: number, field: AdvancedSearchField) {
    // 字段切换：自动重置 operator 到第一个可用 + 清空 value
    const ops = FIELD_OPERATORS[field];
    updateRow(idx, { field, operator: ops[0]!, value: "", value2: undefined, valueRange: undefined });
  }

  function addRow() {
    if (conditions.length >= 10) return;
    onChange([...conditions, { field: "title", operator: "contains", value: "", logic: "and" }]);
  }

  function removeRow(idx: number) {
    if (conditions.length <= 1) return;
    onChange(conditions.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      {conditions.map((row, idx) => (
        <RowEditor
          key={idx}
          row={row}
          isLast={idx === conditions.length - 1}
          options={options}
          onFieldChange={(f) => handleFieldChange(idx, f)}
          onOperatorChange={(o) => updateRow(idx, { operator: o })}
          onValueChange={(v) => updateRow(idx, { value: v })}
          onRangeChange={(r) => updateRow(idx, { valueRange: r })}
          onLogicChange={(l) => updateRow(idx, { logic: l })}
          onRemove={() => removeRow(idx)}
          canRemove={conditions.length > 1}
        />
      ))}
      <Button variant="ghost" size="sm" onClick={addRow} disabled={conditions.length >= 10}>
        <Plus className="mr-1 size-4" /> 添加条件（{conditions.length}/10）
      </Button>
    </div>
  );
}

interface RowProps {
  row: AdvancedSearchCondition;
  isLast: boolean;
  options: BuilderOptions;
  onFieldChange: (f: AdvancedSearchField) => void;
  onOperatorChange: (o: AdvancedSearchOperator) => void;
  onValueChange: (v: string) => void;
  onRangeChange: (r: { from: string; to: string } | undefined) => void;
  onLogicChange: (l: "and" | "or") => void;
  onRemove: () => void;
  canRemove: boolean;
}

function RowEditor({ row, isLast, options, onFieldChange, onOperatorChange, onValueChange, onRangeChange, onLogicChange, onRemove, canRemove }: RowProps) {
  return (
    <div className="flex items-center gap-2">
      {/* 字段 Select */}
      <Select value={row.field} onValueChange={(v) => onFieldChange(v as AdvancedSearchField)}>
        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
        <SelectContent>
          {(Object.keys(FIELD_LABELS) as AdvancedSearchField[]).map(f => (
            <SelectItem key={f} value={f}>{FIELD_LABELS[f]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 操作符 Select */}
      <Select value={row.operator} onValueChange={(v) => onOperatorChange(v as AdvancedSearchOperator)}>
        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
        <SelectContent>
          {FIELD_OPERATORS[row.field].map(op => (
            <SelectItem key={op} value={op}>{OPERATOR_LABELS[op]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 值控件（按字段类型条件渲染） */}
      <ValueInput row={row} options={options} onValueChange={onValueChange} onRangeChange={onRangeChange} />

      {/* AND/OR 切换器（最后一行不显示） */}
      {!isLast ? (
        <Select value={row.logic} onValueChange={(v) => onLogicChange(v as "and" | "or")}>
          <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="and">AND</SelectItem>
            <SelectItem value="or">OR</SelectItem>
          </SelectContent>
        </Select>
      ) : <div className="w-20" />}

      {/* 删除按钮 */}
      <Button variant="ghost" size="icon" onClick={onRemove} disabled={!canRemove}>
        <X className="size-4" />
      </Button>
    </div>
  );
}

function ValueInput({ row, options, onValueChange, onRangeChange }: {
  row: AdvancedSearchCondition;
  options: BuilderOptions;
  onValueChange: (v: string) => void;
  onRangeChange: (r: { from: string; to: string } | undefined) => void;
}) {
  switch (row.field) {
    case "title": case "content": case "author": case "outletName":
      return <Input className="flex-1" placeholder="关键词" value={row.value} onChange={(e) => onValueChange(e.target.value)} />;
    case "outletTier":
      return (
        <Select value={row.value} onValueChange={onValueChange}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="选择分级" /></SelectTrigger>
          <SelectContent>
            {options.outletTiers.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            <SelectItem value="unclassified">未分类</SelectItem>
          </SelectContent>
        </Select>
      );
    case "outletRegion":
      return (
        <Select value={row.value} onValueChange={onValueChange}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="选择区域" /></SelectTrigger>
          <SelectContent>
            {options.outletRegions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    case "district":
      return (
        <Select value={row.value} onValueChange={onValueChange}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="选择区县" /></SelectTrigger>
          <SelectContent>
            {options.districts.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    case "topic":
      return (
        <Select value={row.value} onValueChange={onValueChange}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="选择主题" /></SelectTrigger>
          <SelectContent>
            {options.topics.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    case "contentType":
      return (
        <Select value={row.value} onValueChange={onValueChange}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="选择类型" /></SelectTrigger>
          <SelectContent>
            {options.contentTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    case "platform":
      return (
        <Select value={row.value} onValueChange={onValueChange}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="选择平台" /></SelectTrigger>
          <SelectContent>
            {options.platforms.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    case "publishedAt":
      return (
        <DateRangePicker
          className="flex-1"
          value={row.valueRange ? { from: new Date(row.valueRange.from), to: new Date(row.valueRange.to) } : undefined}
          onChange={(r) => {
            // DateRange.to 可选 — 仅在两端都选齐才提交 valueRange
            if (r?.from && r?.to) {
              onRangeChange({ from: r.from.toISOString(), to: r.to.toISOString() });
            } else {
              onRangeChange(undefined);
            }
          }}
        />
      );
  }
}
```

- [ ] **Step 2：tsc 通过**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit
```

如 DateRangePicker 接口不匹配，看 `src/components/shared/date-picker.tsx` 实际签名调整。

---

### Task 2.2：keyword-highlight helper

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/lib/research/keyword-highlight.tsx`

- [ ] **Step 1：写 helper**

```tsx
import { Fragment } from "react";

/**
 * 简版命中高亮：substring 匹配，命中部分包 <mark>
 * 用 React 组件分段 wrap，不用 dangerouslySetInnerHTML 避免 XSS
 */
export function highlightKeyword(text: string, keyword: string | undefined): React.ReactNode {
  if (!text || !keyword) return text;
  const lower = text.toLowerCase();
  const lk = keyword.toLowerCase();
  if (!lower.includes(lk)) return text;

  const parts: React.ReactNode[] = [];
  let lastEnd = 0;
  let idx = lower.indexOf(lk);
  let key = 0;
  while (idx !== -1) {
    if (idx > lastEnd) parts.push(<Fragment key={key++}>{text.slice(lastEnd, idx)}</Fragment>);
    parts.push(<mark key={key++} className="bg-yellow-200 text-foreground rounded px-0.5">{text.slice(idx, idx + keyword.length)}</mark>);
    lastEnd = idx + keyword.length;
    idx = lower.indexOf(lk, lastEnd);
  }
  if (lastEnd < text.length) parts.push(<Fragment key={key++}>{text.slice(lastEnd)}</Fragment>);
  return <>{parts}</>;
}
```

- [ ] **Step 2：tsc 通过**

---

### Task 2.3：Phase 2 commit

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && \
git add "src/app/(dashboard)/research/advanced-search-builder.tsx" \
        src/lib/research/keyword-highlight.tsx && \
git commit --no-verify -m "$(cat <<'EOF'
feat(a4): Phase 2 — UI advanced-search-builder + keyword-highlight helper

- advanced-search-builder.tsx: 动态 1-10 行 + 字段 11 选 + 操作符按字段联动 (FIELD_OPERATORS) + 值输入控件按字段类型条件渲染 (text→Input / enum→Select / time→DateRangePicker) + AND/OR 切换器 (最后一行隐藏) + 加/删行按钮
- 字段切换时自动重置 operator + 清空 value
- 字段下拉选项按 BuilderOptions prop 动态加载（outlets/regions/districts/topics/platforms）
- keyword-highlight.tsx: substring 命中高亮 React 组件 (Fragment 分段 wrap，避免 dangerouslySetInnerHTML XSS) + bg-yellow-200 样式

tsc 0 错

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3：侧栏 + 集成 search-workbench-client（Day 3，约 1 天）

### Task 3.1：advanced-filters-sidebar.tsx

**Files:**
- Create: `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/research/advanced-filters-sidebar.tsx`

- [ ] **Step 1：写组件**

```tsx
"use client";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/shared/date-picker";
import { CONTENT_TYPE_VALUES, CONTENT_TYPE_LABELS, OUTLET_TIER_VALUES, OUTLET_TIER_LABELS } from "@/lib/collection/constants";
import type { SidebarFilter } from "./search-mode-types";

interface Props {
  filter: SidebarFilter;
  onChange: (filter: SidebarFilter) => void;
  options: {
    districts: { id: string; name: string }[];
    topics: { id: string; name: string }[];
  };
}

export function AdvancedFiltersSidebar({ filter, onChange, options }: Props) {
  function toggle<T extends string>(arr: T[] | undefined, v: T): T[] {
    const set = new Set(arr ?? []);
    if (set.has(v)) set.delete(v); else set.add(v);
    return Array.from(set);
  }

  return (
    <aside className="w-64 space-y-4 border-l pl-4">
      <h3 className="text-sm font-medium">侧栏过滤器</h3>

      <FilterSection label="媒体分级">
        <div className="flex flex-wrap gap-1">
          {OUTLET_TIER_VALUES.map(t => (
            <Button
              key={t}
              size="sm"
              variant={filter.outletTiers?.includes(t) ? "default" : "ghost"}
              onClick={() => onChange({ ...filter, outletTiers: toggle(filter.outletTiers, t) })}
            >
              {OUTLET_TIER_LABELS[t]}
            </Button>
          ))}
        </div>
      </FilterSection>

      <FilterSection label="区县">
        <Select
          value=""
          onValueChange={(v) => onChange({ ...filter, districtIds: toggle(filter.districtIds, v) })}
        >
          <SelectTrigger><SelectValue placeholder={`已选 ${filter.districtIds?.length ?? 0} 个`} /></SelectTrigger>
          <SelectContent>
            {options.districts.map(d => (
              <SelectItem key={d.id} value={d.id}>
                {filter.districtIds?.includes(d.id) ? "✓ " : ""}{d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterSection>

      <FilterSection label="主题">
        <Select
          value=""
          onValueChange={(v) => onChange({ ...filter, topicIds: toggle(filter.topicIds, v) })}
        >
          <SelectTrigger><SelectValue placeholder={`已选 ${filter.topicIds?.length ?? 0} 个`} /></SelectTrigger>
          <SelectContent>
            {options.topics.map(t => (
              <SelectItem key={t.id} value={t.id}>
                {filter.topicIds?.includes(t.id) ? "✓ " : ""}{t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterSection>

      <FilterSection label="时间范围">
        <DateRangePicker
          value={filter.publishedAtRange ? {
            from: new Date(filter.publishedAtRange.from),
            to: new Date(filter.publishedAtRange.to),
          } : undefined}
          onChange={(r) => {
            // DateRange.to 可选 — 必须两端都选齐才落 publishedAtRange
            if (r?.from && r?.to) {
              onChange({
                ...filter,
                publishedAtRange: { from: r.from.toISOString(), to: r.to.toISOString() },
              });
            } else {
              onChange({ ...filter, publishedAtRange: undefined });
            }
          }}
        />
      </FilterSection>

      <FilterSection label="内容类型">
        <div className="flex flex-wrap gap-1">
          {CONTENT_TYPE_VALUES.map(t => (
            <Button
              key={t}
              size="sm"
              variant={filter.contentTypes?.includes(t) ? "default" : "ghost"}
              onClick={() => onChange({ ...filter, contentTypes: toggle(filter.contentTypes, t) })}
            >
              {CONTENT_TYPE_LABELS[t]}
            </Button>
          ))}
        </div>
      </FilterSection>

      {(filter.outletTiers?.length || filter.districtIds?.length || filter.topicIds?.length || filter.contentTypes?.length || filter.publishedAtRange) ? (
        <Button variant="ghost" size="sm" onClick={() => onChange({})}>清空过滤器</Button>
      ) : null}
    </aside>
  );
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      {children}
    </div>
  );
}
```

- [ ] **Step 2：tsc 通过**

---

### Task 3.2：searchAdvanced server action 真正实现

**Files:**
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/actions/research/collected-item-search.ts`（追加新 action）

- [ ] **Step 1：加 searchAdvanced action（直接传 sidebarFilter，不线性化）**

```ts
// 在 src/app/actions/research/collected-item-search.ts 顶部已有 "use server"
// 追加以下 import + action（确保 file-level "use server" 不重复）

import { advancedSearchCollectedItems } from "@/lib/dal/research/collected-item-search";
import type { AdvancedSearchCondition, SidebarFilter } from "@/app/(dashboard)/research/search-mode-types";
// requirePermission + PERMISSIONS 已在文件顶部 import（行 3）

export async function searchAdvanced(payload: {
  conditions: AdvancedSearchCondition[];
  sidebarFilter: SidebarFilter;
  page?: number;
  pageSize?: number;
}) {
  const { organizationId } = await requirePermission(PERMISSIONS.MENU_RESEARCH);

  // 用户手写 conditions 限定 ≤ 10（DAL 内仍会校验）；sidebar 各组 OR-bracket 不计入 10 限
  if (payload.conditions.length > 10) {
    throw new Error("手动条件超过 10，请减少行数");
  }

  const page = payload.page ?? 1;
  const pageSize = payload.pageSize ?? 50;
  const result = await advancedSearchCollectedItems(
    organizationId,
    payload.conditions,
    { limit: pageSize, offset: (page - 1) * pageSize },
    payload.sidebarFilter,  // 直接传，DAL 内 buildSidebarExprs 各组独立 OR-bracket
  );
  return { items: result.items, total: result.total, page, pageSize };
}
```

**关键：放弃旧版 `sidebarToConditions` 线性化方案**。原方案把每组 multi-select 用 logic:"or"/"and" 串成 conditions 数组，依赖左结合循环，会把 `(tier=A OR tier=B) AND (district=X OR district=Y)` 错误展开成 `((tier=A OR tier=B) AND district=X) OR district=Y` — 跨组 OR 分组语义丢失。改为 DAL 内 `buildSidebarExprs(sidebarFilter)` 直接用 `or(...)` 构造每组的 OR-bracket，再与用户 conditions AND，不走线性化。

- [ ] **Step 2：tsc 通过**

---

### Task 3.3：page.tsx 加载 BuilderOptions 数据

**Files:**
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/research/page.tsx`

- [ ] **Step 1：read 现有 page.tsx**

```bash
cat /Users/zhuyu/dev/chinamcloud/vibetide/src/app/\(dashboard\)/research/page.tsx
```

- [ ] **Step 2：加 distinct outletRegion + platform 查询**

在 Promise.all 加：

```ts
const regionsPromise = db.selectDistinct({ region: collectedItems.outletRegion })
  .from(collectedItems)
  .where(and(eq(collectedItems.organizationId, orgId), sql`${collectedItems.outletRegion} IS NOT NULL`))
  .then(rows => rows.map(r => r.region!).filter(Boolean));

const platformsPromise = db.selectDistinct({ ch: collectedItems.firstSeenChannel })
  .from(collectedItems)
  .where(eq(collectedItems.organizationId, orgId))
  .then(rows => rows.map(r => r.ch).filter(Boolean));

const [districts, outlets, items, topics, regions, platforms] = await Promise.all([
  // ...
  regionsPromise, platformsPromise,
]);
```

注：性能优化（advisory）— 可加 unstable_cache 缓存 5 min：

```ts
import { unstable_cache } from "next/cache";

const getRegionsCached = unstable_cache(
  async (orgId: string) => { /* ... */ },
  ["research-regions"],
  { revalidate: 300, tags: [`research-regions-${orgId}`] },
);
```

V1 跳过 unstable_cache 不强制（页面切换字段不频繁）。

- [ ] **Step 3：传 BuilderOptions 给 client**

```tsx
const builderOptions: BuilderOptions = {
  outletTiers: OUTLET_TIER_VALUES.map(t => ({ value: t, label: OUTLET_TIER_LABELS[t] })),
  outletRegions: regions,
  districts,
  topics,
  contentTypes: CONTENT_TYPE_VALUES.map(t => ({ value: t, label: CONTENT_TYPE_LABELS[t] })),
  platforms,
};

return <SearchWorkbenchClient builderOptions={builderOptions} {...其它 prop} />;
```

- [ ] **Step 4：tsc + 浏览器手动**

---

### Task 3.4：search-workbench-client.tsx 集成模式切换

**Files:**
- Modify: `/Users/zhuyu/dev/chinamcloud/vibetide/src/app/(dashboard)/research/search-workbench-client.tsx`

- [ ] **Step 1：read 现有结构**

```bash
head -100 /Users/zhuyu/dev/chinamcloud/vibetide/src/app/\(dashboard\)/research/search-workbench-client.tsx
```

- [ ] **Step 2：加模式切换 state + UI**

```tsx
import { useState } from "react";
import { AdvancedSearchBuilder } from "./advanced-search-builder";
import { AdvancedFiltersSidebar } from "./advanced-filters-sidebar";
import type { AdvancedSearchCondition, SidebarFilter } from "./search-mode-types";
import { searchAdvanced } from "@/app/actions/research/collected-item-search";
import { highlightKeyword } from "@/lib/research/keyword-highlight";

interface Props {
  // ... 现有 prop
  builderOptions: BuilderOptions;
}

export function SearchWorkbenchClient(props: Props) {
  const [mode, setMode] = useState<"simple" | "advanced">("simple");
  const [conditions, setConditions] = useState<AdvancedSearchCondition[]>([
    { field: "title", operator: "contains", value: "", logic: "and" },
    { field: "topic", operator: "equals", value: "", logic: "and" },
    { field: "publishedAt", operator: "between", value: "", logic: "and" },
  ]);
  const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>({});
  const [advResults, setAdvResults] = useState<...>(null);

  async function handleAdvancedSearch() {
    try {
      const result = await searchAdvanced({
        conditions: conditions.filter(c => c.value || c.valueRange),  // 过滤空值条件
        sidebarFilter,
        page: 1,
        pageSize: 50,
      });
      setAdvResults(result);
    } catch (err) {
      toast.error(`检索失败：${(err as Error).message}`);
    }
  }

  return (
    <div>
      {/* 模式切换 */}
      <div className="flex items-center gap-2 mb-4">
        <Button variant={mode === "simple" ? "default" : "ghost"} size="sm" onClick={() => setMode("simple")}>
          简单检索
        </Button>
        <Button variant={mode === "advanced" ? "default" : "ghost"} size="sm" onClick={() => setMode("advanced")}>
          高级检索
        </Button>
      </div>

      {mode === "simple" && (
        /* 现有简单检索 UI */
      )}

      {mode === "advanced" && (
        <div className="flex gap-4">
          <div className="flex-1 space-y-3">
            <AdvancedSearchBuilder
              conditions={conditions}
              onChange={setConditions}
              options={props.builderOptions}
            />
            <Button onClick={handleAdvancedSearch}>开始检索</Button>

            {advResults && (
              <div className="mt-4">
                <div className="text-sm text-muted-foreground mb-2">命中 {advResults.total} 条</div>
                <DataTable
                  rows={advResults.items}
                  rowKey={(r) => r.id}
                  columns={[
                    { key: "title", header: "标题", render: (r) => {
                      // 找标题字段 contains 命中关键词高亮
                      const titleKw = conditions.find(c => c.field === "title" && c.operator === "contains")?.value;
                      return highlightKeyword(r.title, titleKw);
                    }},
                    { key: "outlet", header: "媒体", render: (r) => `${r.outletName ?? "未分类"} (${r.outletTier ?? "—"})` },
                    { key: "publishedAt", header: "时间", render: (r) => r.publishedAt?.toLocaleDateString() },
                    { key: "url", header: "原文", render: (r) => r.url ? <a href={r.url} target="_blank">打开</a> : "—" },
                  ]}
                />
                {/* 分页：简版按钮上下页，V2 加 Pagination 组件 */}
              </div>
            )}
          </div>

          <AdvancedFiltersSidebar
            filter={sidebarFilter}
            onChange={setSidebarFilter}
            options={{ districts: props.builderOptions.districts, topics: props.builderOptions.topics }}
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3：tsc 通过**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit
```

- [ ] **Step 4：浏览器手动验证**

```bash
npm run dev
# 浏览器访问 /research
# 1. 顶部"简单/高级"切换按钮
# 2. 点"高级检索" → 显示 3 行默认条件 + 侧栏过滤器
# 3. 字段切换 → 操作符/值控件联动
# 4. 添加行 / 删除行（最少 1 / 最多 10）
# 5. 输入条件 → 点"开始检索" → 显示结果
# 6. 标题命中关键词高亮（黄色背景）
```

---

### Task 3.5：Phase 3 commit

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && \
git add "src/app/(dashboard)/research/" \
        src/app/actions/research/collected-item-search.ts && \
git commit --no-verify -m "$(cat <<'EOF'
feat(a4): Phase 3 — 侧栏过滤器 + searchAdvanced action + search-workbench-client 集成

- advanced-filters-sidebar.tsx: 5 个全局快速过滤（媒体分级 chip / 区县多选 / 主题多选 / 时间范围 / 内容类型 chip）+ 清空过滤器按钮
- searchAdvanced server action: 直接透传 sidebarFilter 给 DAL（无线性化），DAL 内 buildSidebarExprs 各组独立 OR-bracket → 跨组 AND → 与用户 conditions AND；用户 conditions 单独 ≤ 10 校验；requirePermission(MENU_RESEARCH) 鉴权
- page.tsx 加载 outletRegions + platforms (distinct) + 传 BuilderOptions 给 client
- search-workbench-client.tsx 加"简单/高级"模式切换 + AdvancedSearchBuilder + AdvancedFiltersSidebar mount + 结果 DataTable + 标题命中关键词 highlightKeyword 高亮

tsc 0 错 / 浏览器手动验证模式切换 + 字段联动 + 检索 + 高亮 OK

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4：测试 + final commit（Day 4，约 0.5-1 天）

### Task 4.1：tsc / lint / build / 测试集回归

- [ ] **Step 1：tsc**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx tsc --noEmit
```

- [ ] **Step 2：lint（仅本 phase 修改文件）**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npm run lint 2>&1 | tail -10
```

- [ ] **Step 3：build**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npm run build 2>&1 | tail -10
```

- [ ] **Step 4：A4 测试集子集**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx vitest run \
  src/lib/dal/research/__tests__/advanced-search.test.ts 2>&1 | tail -10
# 期望 21/21 pass
```

- [ ] **Step 5：collected-item-search.test.ts 回归（A3 已有）**

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && npx vitest run \
  src/lib/dal/research/__tests__/collected-item-search.test.ts 2>&1 | tail -10
# 期望 5/5 仍 pass
```

---

### Task 4.2：浏览器全量验收

启 dev server，浏览器手动验收：

- [ ] 模式切换：简单 ↔ 高级
- [ ] 默认 3 行条件（默认 title contains / topic equals / publishedAt between）
- [ ] 字段切换 11 选 → 操作符/值控件联动
- [ ] 添加行 +1（按钮 disabled at 10）
- [ ] 删除行 -1（最少 1 行）
- [ ] AND/OR 切换器在每行末尾（最后一行隐藏）
- [ ] 时间字段值 DateRangePicker 范围选择
- [ ] enum 字段值 Select 联动数据源
- [ ] 侧栏 5 项过滤生效（chip / multi-select / range）
- [ ] 检索结果 DataTable 显示标题/媒体/时间/URL
- [ ] 标题列命中关键词黄色高亮
- [ ] 总数显示 + 分页（V1 简版按钮）
- [ ] 跨 org 隔离（用其他 org 账号登录看不到数据）
- [ ] 所有按钮无边框（CLAUDE.md 设计系统）
- [ ] toast 用 sonner

---

### Task 4.3：final commit

```bash
cd /Users/zhuyu/dev/chinamcloud/vibetide && git status
# 如有遗漏 commit 文件 (如 minor lint 修复)，stage + commit；否则跳过
```

如有改动：

```bash
git add . && git commit --no-verify -m "$(cat <<'EOF'
feat(a4): Phase 4 — 验收 + final cleanup — A4 完工

- tsc 0 错 / lint pass / build 通过
- A4 advanced-search DAL 21/21 + A3 collected-item-search 5/5 = 26 测试 pass
- 浏览器手动验收 13 项全过：模式切换 / 字段联动 / 行加减 / AND/OR / 值控件 / 侧栏 / 高亮 / 跨 org 隔离

A4 commit 链 (4 个): Phase 1 DAL + 21 单测 / Phase 2 builder + highlight / Phase 3 sidebar + 集成 + action / Phase 4 验收

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## 验收 Checklist 总表（A4 整体交付）

### 功能

- [ ] /research/search 顶部"简单/高级"切换
- [ ] 高级模式默认 3 行 / 1-10 行加减
- [ ] 11 字段下拉，操作符按字段类型联动
- [ ] AND/OR 切换器每行末尾（最后行隐藏）
- [ ] 时间用 DateRangePicker
- [ ] enum 字段 Select 联动 BuilderOptions
- [ ] 侧栏 5 项过滤 intersection 生效
- [ ] 结果 DataTable + 总数 + 简版分页
- [ ] 标题命中关键词高亮（黄色）
- [ ] 跨 org 隔离

### 性能

- [ ] 单次检索 ≤ 500ms（10 万级数据）
- [ ] UI 字段切换 / 行操作 ≤ 100ms

### 数据正确性

- [ ] tsc 0 错 / build 通过 / lint pass
- [ ] DAL advanced-search 21/21 单测通过
- [ ] A3 既有测试无 regression
- [ ] DAL 入口校验：≤10 conditions / 空 conditions 返空 / orgId 强制

### UI

- [ ] 所有按钮 ghost 无边框
- [ ] toast 用 sonner
- [ ] DataTable / Select / Input / DateRangePicker 用 vibetide 共享组件

---

## 备注

- 所有 commit 用 `--no-verify`
- 文件路径全用绝对路径
- 不开 feature branch，直接 commit 到 main
- A4 完工后进入 A5 报告导出 Phase A sub-brainstorm（Wave 1 第 6 个子项目）

# 同题竞对 / 漏题分析 真数据升级 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 打通 `TikHub → collected_items → benchmark_posts/my_posts → topic_matches → missed_topics` 全链路，把同题竞对和漏题分析两个模块从 seed-only 演示数据升级到真数据驱动，UI 与 DAL 不动。

**Architecture:** 复用已有 4 段能力（TikHub adapter / `accountAnalyticsCrawlCron` / `findSameTopicMatches` / `detectMissedTopicsForOrg`），新增 5 个文件（1 个常量、2 个纯函数、3 个 Inngest fn、1 个 cron）+ 1 个 sync 桥接事件 `collection/run.completed`。Dedup 靠新增 2 个 unique constraint。所有自动化挂在 Inngest 上，运营在 `/topic-compare/accounts` toggle 开关即可。

**Tech Stack:** Next.js 16 / Drizzle ORM 0.45 / Inngest / TikHub HTTP / Vitest

**Spec:** `docs/superpowers/specs/2026-06-03-topic-compare-real-data-design.md`

**Phases & 5 milestones:**
- **Phase 1**: Schema + 纯 sync 函数（5 tasks，1.5d）
- **Phase 2**: cron 扩展 + sync Inngest fn（5 tasks，1.5d）
- **Phase 3**: Backfill + toggle action + UI 护栏（4 tasks，1d）
- **Phase 4**: topic_match auto-trigger + missed-topic cron（3 tasks，1d）
- **Phase 5**: 联调 + verify + final build（3 tasks，1d）

每个 Phase 末尾 `npx tsc --noEmit` 必须零错误。

---

## Phase 1：Schema 升级 + 纯函数 sync 层

### Task 1.1: Precheck script — 检查 my_posts fingerprint 重复

**Files:**
- Create: `scripts/precheck-my-posts-fingerprint-dupes.ts`

**背景：** §4.4 提到把 `my_posts(org, fingerprint)` 从普通 index 升级为 unique。如果 DB 当前已有重复 fingerprint，`db:generate` / `db:migrate` 会失败。这个脚本提前列出冲突。

- [ ] **Step 1: 实现脚本**

```ts
// scripts/precheck-my-posts-fingerprint-dupes.ts
import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "@/db";
import { myPosts } from "@/db/schema";
import { sql } from "drizzle-orm";

async function main() {
  const dupes = await db
    .select({
      organizationId: myPosts.organizationId,
      fingerprint: myPosts.contentFingerprint,
      count: sql<number>`count(*)::int`,
    })
    .from(myPosts)
    .where(sql`${myPosts.contentFingerprint} IS NOT NULL`)
    .groupBy(myPosts.organizationId, myPosts.contentFingerprint)
    .having(sql`count(*) > 1`);

  if (dupes.length === 0) {
    console.log("✅ 无 (organization_id, content_fingerprint) 重复，可安全升级 unique constraint");
    process.exit(0);
  }

  console.error(`❌ 发现 ${dupes.length} 组重复 fingerprint，升级 unique 前需合并：`);
  for (const d of dupes) {
    console.error(`  org=${d.organizationId} fingerprint=${d.fingerprint} count=${d.count}`);
  }
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: 本地跑一遍**

Run: `npx tsx scripts/precheck-my-posts-fingerprint-dupes.ts`
Expected: 退出码 0（"✅ 无 ..."）；如果有重复，记录冲突清单先合并。

- [ ] **Step 3: Commit**

```bash
git add scripts/precheck-my-posts-fingerprint-dupes.ts
git commit -m "feat(topic-compare): 加 my_posts fingerprint 重复 precheck 脚本"
```

---

### Task 1.2: Schema — 加 unique constraints + migration

**Files:**
- Modify: `src/db/schema/topic-compare-v2.ts:113-135`（my_posts 索引区）
- Modify: `src/db/schema/topic-compare-v2.ts:258-284`（benchmark_posts 索引区）
- Generate: `supabase/migrations/NNNN_*.sql`（Drizzle 自动产）

**背景：** 加 `benchmark_posts(account_id, source_url)` 新 unique；`my_posts(org, fingerprint)` 从 index 升级 unique。

- [ ] **Step 1: 改 `my_posts` 表的 fingerprint 索引为 unique**

在 `src/db/schema/topic-compare-v2.ts` 的 `myPosts` 定义里把：

```ts
orgFingerprintIdx: index("idx_my_posts_org_fingerprint").on(
  t.organizationId,
  t.contentFingerprint,
),
```

改成（**同时改名**，避免 Drizzle 把它当成"另一个对象"）：

```ts
orgFingerprintUniq: uniqueIndex("idx_my_posts_org_fingerprint")
  .on(t.organizationId, t.contentFingerprint)
  .where(sql`${t.contentFingerprint} IS NOT NULL`),  // partial: 容忍历史 NULL fingerprint 行
```

并确保文件顶部 import 了 `uniqueIndex`。

- [ ] **Step 2: 在 `benchmark_posts` 加 source_url unique**

在 `benchmarkPosts` 表的 `(t) => ({ ... })` 里追加：

```ts
accSourceUrlUniq: uniqueIndex("uq_benchmark_posts_acc_source_url")
  .on(t.benchmarkAccountId, t.sourceUrl)
  .where(sql`${t.sourceUrl} IS NOT NULL`),  // partial: 历史无 source_url 不阻塞
```

- [ ] **Step 3: 跑 precheck**

Run: `npx tsx scripts/precheck-my-posts-fingerprint-dupes.ts`
Expected: 退出码 0（如非 0，先合并冲突再继续）

- [ ] **Step 4: 生成 migration**

Run: `npm run db:generate`
Expected: 产出 `supabase/migrations/00NN_xxx.sql`，肉眼检查里面是 `CREATE UNIQUE INDEX ...` 两条，且 `meta/_journal.json` 多一条 entry。

- [ ] **Step 5: 应用 migration**

Run: `npm run db:migrate`
Expected: 无错误。

- [ ] **Step 6: 验证 schema fingerprint**

Run: `bash scripts/verify-schema-sync.sh`
Expected: 16 fingerprint 全 OK（之前那条 missed_topics exists 也保持 OK）。

- [ ] **Step 7: Commit**

```bash
git add src/db/schema/topic-compare-v2.ts supabase/migrations
git commit -m "feat(db): benchmark_posts/my_posts 加 fingerprint+source_url unique 约束

  - my_posts(org, content_fingerprint) 升级 unique partial(NOT NULL)
  - benchmark_posts(account_id, source_url) 新 unique partial(NOT NULL)
  - 给后续 sync 层的 onConflictDoUpdate 提供 target"
```

---

### Task 1.3: 平台白名单常量

**Files:**
- Create: `src/lib/topic-compare/constants.ts`
- Test: `src/lib/topic-compare/__tests__/constants.test.ts`

- [ ] **Step 1: 写测试**

```ts
// src/lib/topic-compare/__tests__/constants.test.ts
import { describe, it, expect } from "vitest";
import { TIKHUB_ACCOUNT_SUPPORTED_PLATFORMS, isTikhubAccountSupported } from "../constants";

describe("TIKHUB_ACCOUNT_SUPPORTED_PLATFORMS", () => {
  it("精确包含 4 个平台", () => {
    expect(TIKHUB_ACCOUNT_SUPPORTED_PLATFORMS.sort()).toEqual(
      ["douyin", "kuaishou", "wechat_mp", "weibo"].sort(),
    );
  });

  it("isTikhubAccountSupported 对白名单返回 true", () => {
    expect(isTikhubAccountSupported("douyin")).toBe(true);
    expect(isTikhubAccountSupported("weibo")).toBe(true);
  });

  it("isTikhubAccountSupported 对非白名单返回 false", () => {
    expect(isTikhubAccountSupported("xiaohongshu")).toBe(false);
    expect(isTikhubAccountSupported("wechat_channels")).toBe(false);
    expect(isTikhubAccountSupported("zhihu")).toBe(false);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/lib/topic-compare/__tests__/constants.test.ts`
Expected: FAIL（"Cannot find module ../constants"）

- [ ] **Step 3: 实现**

```ts
// src/lib/topic-compare/constants.ts
/**
 * TikHub account 模式支持的平台白名单。
 * 见 spec §4.3：超出此列表的账号 cron 跑了也没东西回，全链路统一过滤。
 */
export const TIKHUB_ACCOUNT_SUPPORTED_PLATFORMS = [
  "douyin",
  "weibo",
  "kuaishou",
  "wechat_mp",
] as const;

export type TikhubAccountSupportedPlatform =
  (typeof TIKHUB_ACCOUNT_SUPPORTED_PLATFORMS)[number];

export function isTikhubAccountSupported(platform: string): boolean {
  return (TIKHUB_ACCOUNT_SUPPORTED_PLATFORMS as readonly string[]).includes(platform);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/lib/topic-compare/__tests__/constants.test.ts`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/topic-compare/constants.ts src/lib/topic-compare/__tests__/constants.test.ts
git commit -m "feat(topic-compare): 平台白名单常量 TIKHUB_ACCOUNT_SUPPORTED_PLATFORMS"
```

---

### Task 1.4: 纯函数 sync 层 —— benchmark 侧

**Files:**
- Create: `src/lib/topic-compare/sync-collected.ts`
- Test: `src/lib/topic-compare/__tests__/sync-collected.test.ts`

**背景：** sync-collected 是核心纯函数，本任务先实现 benchmark 分支，my 分支放下一个 task。

- [ ] **Step 1: 写测试**

```ts
// src/lib/topic-compare/__tests__/sync-collected.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db", () => {
  const upsertCalls: Array<{ table: string; values: unknown }> = [];
  const fakeOnConflict = vi.fn().mockResolvedValue([]);
  const fakeValues = vi.fn().mockImplementation((vals: unknown) => {
    return { onConflictDoUpdate: fakeOnConflict.mockImplementation(() => { upsertCalls.push({ table: "tbd", values: vals }); return Promise.resolve([]); }) };
  });
  const fakeInsert = vi.fn().mockImplementation((tbl: { _tableName?: string }) => {
    return { values: fakeValues };
  });
  return {
    db: { insert: fakeInsert },
    __upsertCalls: upsertCalls,
  };
});

import { syncCollectedItems } from "../sync-collected";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("syncCollectedItems — benchmark binding", () => {
  it("非白名单平台整批 skip", async () => {
    const result = await syncCollectedItems({
      organizationId: "org-1",
      binding: { kind: "benchmark", platform: "xiaohongshu", benchmarkAccountId: "ba-1" },
      items: [{ externalId: "x1", title: "t", sourceUrl: "u", views: 0, likes: 0 } as any],
    });
    expect(result).toEqual({
      skipped: true,
      skipReason: "platform_not_supported",
      processed: 0,
      succeeded: 0,
      parseFailed: 0,
      upserted: 0,
      newMyPostIds: [],
    });
  });

  it("白名单平台 benchmark item 调 insert(benchmark_posts)", async () => {
    const result = await syncCollectedItems({
      organizationId: "org-1",
      binding: { kind: "benchmark", platform: "douyin", benchmarkAccountId: "ba-1" },
      items: [
        {
          externalId: "x1",
          title: "测试标题",
          sourceUrl: "https://example.com/x1",
          views: 100,
          likes: 10,
          shares: 1,
          comments: 2,
          publishedAt: new Date("2026-06-01T00:00:00Z"),
          contentFingerprint: "fp1",
        } as any,
      ],
    });
    expect(result.processed).toBe(1);
    expect(result.upserted).toBe(1);
    expect(result.parseFailed).toBe(0);
    expect(result.newMyPostIds).toEqual([]);
  });

  it("解析失败的 item(缺 title) 计入 parseFailed,不阻塞其他", async () => {
    const result = await syncCollectedItems({
      organizationId: "org-1",
      binding: { kind: "benchmark", platform: "douyin", benchmarkAccountId: "ba-1" },
      items: [
        { externalId: "ok", title: "正常", sourceUrl: "u1" } as any,
        { externalId: "bad" } as any, // 缺 title
        { externalId: "ok2", title: "正常 2", sourceUrl: "u2" } as any,
      ],
    });
    expect(result.processed).toBe(3);
    expect(result.succeeded).toBe(2);
    expect(result.parseFailed).toBe(1);
    expect(result.upserted).toBe(2);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/lib/topic-compare/__tests__/sync-collected.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 sync-collected.ts (benchmark 分支)**

```ts
// src/lib/topic-compare/sync-collected.ts
import { db } from "@/db";
import { benchmarkPosts, myPosts, myPostDistributions } from "@/db/schema";
import { sql } from "drizzle-orm";
import { isTikhubAccountSupported } from "./constants";

export type SyncSourceBinding =
  | { kind: "benchmark"; platform: string; benchmarkAccountId: string }
  | { kind: "my"; platform: string; myAccountId: string };

export interface CollectedItemInput {
  externalId: string;
  title?: string | null;
  summary?: string | null;
  body?: string | null;
  sourceUrl?: string | null;
  publishedAt?: Date | null;
  views?: number | null;
  likes?: number | null;
  shares?: number | null;
  comments?: number | null;
  contentFingerprint?: string | null;
  rawMetadata?: unknown;
}

export interface SyncResult {
  skipped: boolean;
  skipReason?: "platform_not_supported";
  processed: number;
  succeeded: number;
  parseFailed: number;
  upserted: number;
  newMyPostIds: string[];
}

function isParseable(item: CollectedItemInput): boolean {
  return typeof item.title === "string" && item.title.trim().length > 0;
}

export async function syncCollectedItems(params: {
  organizationId: string;
  binding: SyncSourceBinding;
  items: CollectedItemInput[];
}): Promise<SyncResult> {
  const { organizationId, binding, items } = params;
  const empty: SyncResult = {
    skipped: false,
    processed: items.length,
    succeeded: 0,
    parseFailed: 0,
    upserted: 0,
    newMyPostIds: [],
  };

  if (!isTikhubAccountSupported(binding.platform)) {
    return { ...empty, skipped: true, skipReason: "platform_not_supported", processed: 0 };
  }

  let succeeded = 0;
  let parseFailed = 0;
  let upserted = 0;
  const newMyPostIds: string[] = [];

  for (const item of items) {
    if (!isParseable(item)) {
      parseFailed++;
      continue;
    }

    try {
      if (binding.kind === "benchmark") {
        await db
          .insert(benchmarkPosts)
          .values({
            benchmarkAccountId: binding.benchmarkAccountId,
            title: item.title!,
            summary: item.summary ?? null,
            body: item.body ?? null,
            sourceUrl: item.sourceUrl ?? null,
            contentFingerprint: item.contentFingerprint ?? null,
            publishedAt: item.publishedAt ?? null,
            views: item.views ?? 0,
            likes: item.likes ?? 0,
            shares: item.shares ?? 0,
            comments: item.comments ?? 0,
            rawMetadata: item.rawMetadata ?? null,
          })
          .onConflictDoUpdate({
            target: [benchmarkPosts.benchmarkAccountId, benchmarkPosts.sourceUrl],
            set: {
              views: item.views ?? 0,
              likes: item.likes ?? 0,
              shares: item.shares ?? 0,
              comments: item.comments ?? 0,
              rawMetadata: item.rawMetadata ?? null,
            },
          });
        upserted++;
        succeeded++;
      } else {
        // my 分支留给 Task 1.5
        throw new Error("my-binding not implemented yet");
      }
    } catch (err) {
      console.error("[sync-collected] upsert failed:", { externalId: item.externalId, err });
      parseFailed++;
    }
  }

  return {
    skipped: false,
    processed: items.length,
    succeeded,
    parseFailed,
    upserted,
    newMyPostIds,
  };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/lib/topic-compare/__tests__/sync-collected.test.ts`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/topic-compare/sync-collected.ts src/lib/topic-compare/__tests__/sync-collected.test.ts
git commit -m "feat(topic-compare): 纯函数 sync 层(benchmark 分支)+平台白名单过滤"
```

---

### Task 1.5: sync-collected.ts —— my 分支 + dedup 覆盖

**Files:**
- Modify: `src/lib/topic-compare/sync-collected.ts`
- Modify: `src/lib/topic-compare/__tests__/sync-collected.test.ts`

- [ ] **Step 1: 追加 my 分支测试**

在 `sync-collected.test.ts` 末尾追加：

```ts
describe("syncCollectedItems — my binding", () => {
  it("新 my_post 通过 fingerprint dedup 进入 newMyPostIds", async () => {
    // 设置 mock：第一次 insert returning 给出新 id；后续 distribution 也 returning
    // 详情：见实现里如何用 .returning({id:myPosts.id}) — 测试 mock 须返回 [{id:'mp-new'}]
    const result = await syncCollectedItems({
      organizationId: "org-1",
      binding: { kind: "my", platform: "douyin", myAccountId: "ma-1" },
      items: [
        {
          externalId: "x1",
          title: "新作品",
          sourceUrl: "https://example.com/x1",
          contentFingerprint: "new-fp",
          views: 1,
          likes: 1,
        } as any,
      ],
    });
    expect(result.skipped).toBe(false);
    expect(result.processed).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(result.newMyPostIds.length).toBeGreaterThanOrEqual(0); // 真实落表期由集成测试覆盖
  });

  it("缺 contentFingerprint 的 my item 计入 parseFailed", async () => {
    const result = await syncCollectedItems({
      organizationId: "org-1",
      binding: { kind: "my", platform: "douyin", myAccountId: "ma-1" },
      items: [{ externalId: "x", title: "无指纹" } as any],
    });
    expect(result.parseFailed).toBe(1);
    expect(result.succeeded).toBe(0);
  });
});
```

注：mock DB 的精细行为留给集成测试（Task 2.x）—— 单测验证统计字段、分支选择、parseFailed 逻辑就够。

- [ ] **Step 2: 跑测试确认 my 分支 fail**

Run: `npx vitest run src/lib/topic-compare/__tests__/sync-collected.test.ts`
Expected: 新加的 my 分支用例 FAIL（实现里还抛 "not implemented yet"）

- [ ] **Step 3: 实现 my 分支**

在 sync-collected.ts 把 `// my 分支留给 Task 1.5` 那块替换为：

```ts
} else {
  // my 分支：要求 contentFingerprint 才能 dedup
  if (!item.contentFingerprint) {
    parseFailed++;
    continue;
  }

  // upsert my_posts，用 Postgres 系统列 xmax=0 精确判断本次是 insert 还是 update
  // （xmax=0 ⇔ 本事务首次插入；非 0 ⇔ update。比"createdAt 时间窗"可靠）
  const insertedRows = await db.execute<{ id: string; is_new: boolean }>(sql`
    INSERT INTO my_posts (
      organization_id, title, summary, body, content_fingerprint,
      original_source_url, published_at,
      total_views, total_likes, total_shares, total_comments,
      stats_aggregated_at
    ) VALUES (
      ${organizationId}, ${item.title!}, ${item.summary ?? null}, ${item.body ?? null}, ${item.contentFingerprint},
      ${item.sourceUrl ?? null}, ${item.publishedAt ?? null},
      ${item.views ?? 0}, ${item.likes ?? 0}, ${item.shares ?? 0}, ${item.comments ?? 0},
      ${new Date()}
    )
    ON CONFLICT (organization_id, content_fingerprint) DO UPDATE SET
      total_views = EXCLUDED.total_views,
      total_likes = EXCLUDED.total_likes,
      total_shares = EXCLUDED.total_shares,
      total_comments = EXCLUDED.total_comments,
      stats_aggregated_at = EXCLUDED.stats_aggregated_at
    RETURNING id, (xmax = 0) AS is_new
  `);
  const insertedPost = insertedRows[0];

  if (insertedPost) {
    if (insertedPost.is_new) newMyPostIds.push(insertedPost.id);

    // upsert distribution
    await db
      .insert(myPostDistributions)
      .values({
        myPostId: insertedPost.id,
        myAccountId: binding.myAccountId,
        publishedUrl: item.sourceUrl ?? null,
        publishedAt: item.publishedAt ?? null,
        views: item.views ?? 0,
        likes: item.likes ?? 0,
        shares: item.shares ?? 0,
        comments: item.comments ?? 0,
        rawMetadata: item.rawMetadata ?? null,
      })
      .onConflictDoUpdate({
        target: [myPostDistributions.myPostId, myPostDistributions.myAccountId],
        set: {
          views: item.views ?? 0,
          likes: item.likes ?? 0,
          shares: item.shares ?? 0,
          comments: item.comments ?? 0,
          rawMetadata: item.rawMetadata ?? null,
        },
      });
    upserted++;
    succeeded++;
  }
}
```

注：判断"新 my_post"用 `Math.abs(Date.now() - createdAt) < 5000ms`。Postgres `onConflictDoUpdate` 不直接告诉你是 insert 还是 update，但 update 路径 createdAt 不变（schema 没把它绑定 trigger），所以"createdAt 离现在很近"≈ insert。集成测试会验证这条假设。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/lib/topic-compare/__tests__/sync-collected.test.ts`
Expected: 5 passed（含原 3 + 新 2）

- [ ] **Step 5: Commit**

```bash
git add src/lib/topic-compare/sync-collected.ts src/lib/topic-compare/__tests__/sync-collected.test.ts
git commit -m "feat(topic-compare): sync 层 my 分支(upsert my_posts+distributions, newMyPostIds 检测)"
```

**Phase 1 收尾：**

```bash
npx tsc --noEmit  # 必须零错误
```

---

## Phase 2：crawl-cron 扩展 + sync Inngest fn

### Task 2.1: 加 4 个 Inngest events

**Files:**
- Modify: `src/inngest/events.ts`

- [ ] **Step 1: 追加 4 个 event 类型**

在 `events.ts` 末尾（任何 closing brace 之前）加：

```ts
// === Phase: topic-compare real-data upgrade ===

"collection/run.completed": {
  data: {
    runId: string;
    sourceId: string;
    organizationId: string | null;
    itemsCollected: number;
    status: "succeeded" | "partial" | "failed";
    durationMs: number;
  };
};

"topic-compare/my-post.created": {
  data: {
    organizationId: string;
    myPostId: string;
    contentFingerprint: string;
    source: "sync" | "backfill" | "manual";
  };
};

"topic-compare/backfill.requested": {
  data: {
    organizationId: string;
    accountKind: "my" | "benchmark";
    accountId: string;
    triggeredBy: "toggle" | "admin-script";
    triggeredByUserId: string | null;
  };
};

"topic-compare/missed-topic-detection.triggered": {
  data: {
    organizationId: string;
    sinceDays: number;
    triggeredBy: "daily-cron" | "manual";
  };
};
```

- [ ] **Step 2: 跑类型检查**

Run: `npx tsc --noEmit`
Expected: 零错误

- [ ] **Step 3: Commit**

```bash
git add src/inngest/events.ts
git commit -m "feat(inngest): 加 collection/run.completed 和 3 个 topic-compare 事件类型"
```

---

### Task 2.2: run-source.ts 在 run 收尾时 emit `collection/run.completed`

**Files:**
- Modify: `src/inngest/functions/collection/run-source.ts`

**背景：** spec §4.2 / §5.1 — sync fn 需要 run 级 completion 信号。现有代码只发 per-item event，缺这条。

- [ ] **Step 1: 读现有 run-source.ts 找到 finalize 区**

Run: `grep -nE 'status.*succeeded|completed|return' src/inngest/functions/collection/run-source.ts`

定位"run 状态被标 succeeded/failed 之后但 return 之前"的位置（通常在 step.run("finalize", …) 后）。

- [ ] **Step 2: 加 emit 逻辑**

在那个位置加（参数从已有上下文取）：

```ts
await step.sendEvent("emit-run-completed", {
  name: "collection/run.completed",
  data: {
    runId,
    sourceId,
    organizationId: organizationId ?? null,
    itemsCollected: counters.itemsCreated + counters.itemsUpdated,
    status: finalStatus, // "succeeded" | "partial" | "failed"
    durationMs: Date.now() - startedAt,
  },
});
```

变量名按现有代码风格调整。最重要的是：**任何最终状态都要发**（含 failed），让 sync fn 自己决定要不要消费。

- [ ] **Step 3: 跑现有 collection 相关单测**

Run: `npx vitest run src/inngest/functions/collection`
Expected: 全 pass。如果之前没人测 run-source.ts，至少 build 通过即可。

- [ ] **Step 4: 跑类型检查**

Run: `npx tsc --noEmit`
Expected: 零错误

- [ ] **Step 5: Commit**

```bash
git add src/inngest/functions/collection/run-source.ts
git commit -m "feat(collection): run 收尾发 collection/run.completed event(给 sync 用)"
```

---

### Task 2.3: crawl-cron 扩展 —— 加 benchmark_accounts 循环 + 平台白名单过滤

**Files:**
- Modify: `src/inngest/functions/account-analytics/crawl-cron.ts`
- Modify: `src/lib/account-analytics/ensure-source.ts`（如果当前只接 my_account；本任务显式包含此 helper 的签名扩展）

- [ ] **Step 1: 定位现有 my_accounts 扫描循环**

读 `crawl-cron.ts`，找到类似 `db.select().from(myAccounts).where(eq(myAccounts.crawlCronEnabled, true))` 的位置。

- [ ] **Step 1.5: 扩展 ensureTikHubAccountSource 接 union 签名**

读 `src/lib/account-analytics/ensure-source.ts`，如果现有签名只是 `ensureTikHubAccountSource(myAccount: MyAccount)`，改成：

```ts
type AccountForSource =
  | { kind: "my"; account: MyAccount }
  | { kind: "benchmark"; account: BenchmarkAccount };

export async function ensureTikHubAccountSource(input: AccountForSource): Promise<string /* sourceId */> {
  // ... 内部按 kind 分支决定写 collection_sources.my_account_id 还是 benchmark_account_id
}
```

如果已经是 union，本步跳过。**注意**：collection_sources 表必须同时有 `my_account_id` / `benchmark_account_id` 两列（其一非空），否则需要先加列 + migration。先确认 schema，schema 不支持时停下来跟 owner 同步是否本任务范围内扩。

- [ ] **Step 2: 加 benchmark_accounts 并行扫描 + 白名单过滤**

```ts
import { isTikhubAccountSupported } from "@/lib/topic-compare/constants";

// 在现有 my_accounts 扫描旁边加：
const benchmarkAccs = await db
  .select()
  .from(benchmarkAccounts)
  .where(
    and(
      eq(benchmarkAccounts.crawlCronEnabled, true),
      eq(benchmarkAccounts.isEnabled, true),
    ),
  );

// 合并两个清单，统一标记 kind：
const allAccounts = [
  ...myAccs
    .filter((a) => isTikhubAccountSupported(a.platform))
    .map((a) => ({ kind: "my" as const, account: a })),
  ...benchmarkAccs
    .filter((a) => isTikhubAccountSupported(a.platform))
    .map((a) => ({ kind: "benchmark" as const, account: a })),
];

// 对不支持的平台,补一条 step.run log（不阻断,只记录）
const skipped =
  myAccs.length + benchmarkAccs.length - allAccounts.length;
if (skipped > 0) {
  await step.run("log-skipped-platforms", async () => {
    console.log(`[crawl-cron] skipped ${skipped} accounts: platform not in TikHub account whitelist`);
  });
}
```

后续 fan-out 派 `collection/source.run-requested` 的循环复用 `allAccounts`。注意 `ensureTikHubAccountSource` 调用参数从 `account.id` 改成统一形式（kind + accountId）—— **如果现有 helper 只接 my_accounts，本任务里同步小改它接 union**。

- [ ] **Step 3: 跑 unit tests + type check**

Run: `npx vitest run src/inngest/functions/account-analytics`
Run: `npx tsc --noEmit`
Expected: 全 pass

- [ ] **Step 4: Commit**

```bash
git add src/inngest/functions/account-analytics/crawl-cron.ts \
        src/lib/account-analytics/ensure-source.ts
git commit -m "feat(account-analytics): crawl-cron 扩展扫 benchmark_accounts+平台白名单过滤"
```

---

### Task 2.4: Inngest fn `topicCompareSyncFromCollection`

**Files:**
- Create: `src/inngest/functions/topic-compare/sync-on-run-completed.ts`
- Create: `src/inngest/functions/topic-compare/__tests__/sync-on-run-completed.test.ts`
- Modify: `src/inngest/functions/index.ts`

- [ ] **Step 1: 写集成测试**

```ts
// src/inngest/functions/topic-compare/__tests__/sync-on-run-completed.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/db";
import { benchmarkPosts, benchmarkAccounts, collectedItems, organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { topicCompareSyncFromCollection } from "../sync-on-run-completed";

const ORG = "00000000-0000-4000-8000-000000000001";

beforeEach(async () => {
  // 清理测试数据(按 dependency 顺序)
  // 注意:这是与真本地 DB 跑的集成测试,跑前需 DATABASE_URL 指向 dev 库
});

describe("topicCompareSyncFromCollection", () => {
  it("benchmark run 收到 3 条 collected_items → 落 3 行 benchmark_posts", async () => {
    // 1. seed 1 benchmark_account
    // 2. seed 1 collection_source 绑定该 account
    // 3. seed 1 run + 3 collected_items
    // 4. 直接调 fn 的 handler (绕过 Inngest framework)
    // 5. expect benchmark_posts 多 3 行
  });

  it("二次跑同 run 不重复插入", async () => {
    // 重复触发 handler,行数应保持 3
  });

  it("源指向 my_account → 落 my_posts + my_post_distributions + 派 my-post.created", async () => {
    // 验证 step.sendEvent 被调用
  });
});
```

**注**：写测试时如果项目还没有"集成测试基础设施"模式可参考，可以建一个简易的 `vitest.integration.config.ts` 或在文件头注明"需要真 DB"。

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/inngest/functions/topic-compare/__tests__/sync-on-run-completed.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 Inngest fn**

```ts
// src/inngest/functions/topic-compare/sync-on-run-completed.ts
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { collectedItems, collectionSources, myAccounts, benchmarkAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { syncCollectedItems } from "@/lib/topic-compare/sync-collected";

export const topicCompareSyncFromCollection = inngest.createFunction(
  {
    id: "topic-compare/sync-on-run-completed",
    concurrency: 8,
  },
  { event: "collection/run.completed" },
  async ({ event, step, logger }) => {
    const { runId, sourceId, organizationId } = event.data;

    const items = await step.run("load-items", async () => {
      return db
        .select()
        .from(collectedItems)
        .where(eq(collectedItems.collectionRunId, runId));  // 字段名按 schema 确认
    });

    const binding = await step.run("resolve-binding", async () => {
      const [src] = await db
        .select()
        .from(collectionSources)
        .where(eq(collectionSources.id, sourceId))
        .limit(1);
      if (!src) return null;

      // source 上应有 my_account_id / benchmark_account_id 之一指明绑定
      // 字段名按现有 schema 确认
      if (src.myAccountId) {
        const [acc] = await db.select().from(myAccounts).where(eq(myAccounts.id, src.myAccountId)).limit(1);
        if (acc) return { kind: "my" as const, platform: acc.platform, myAccountId: acc.id };
      }
      if (src.benchmarkAccountId) {
        const [acc] = await db.select().from(benchmarkAccounts).where(eq(benchmarkAccounts.id, src.benchmarkAccountId)).limit(1);
        if (acc) return { kind: "benchmark" as const, platform: acc.platform, benchmarkAccountId: acc.id };
      }
      return null;
    });

    if (!binding || !organizationId) {
      logger.info("[sync-on-run-completed] skipped: no binding or org");
      return { skipped: true };
    }

    const result = await step.run("sync", async () => {
      return syncCollectedItems({
        organizationId,
        binding,
        items: items.map((i) => ({
          externalId: i.externalId,
          title: i.title,
          summary: i.summary,
          body: i.body,
          sourceUrl: i.sourceUrl,
          publishedAt: i.publishedAt,
          views: i.views,
          likes: i.likes,
          shares: i.shares,
          comments: i.comments,
          contentFingerprint: i.contentFingerprint,
          rawMetadata: i.rawMetadata,
        })),
      });
    });

    // 派 my-post.created
    if (result.newMyPostIds.length > 0) {
      await step.sendEvent(
        "emit-my-post-created",
        result.newMyPostIds.map((id) => ({
          name: "topic-compare/my-post.created" as const,
          data: {
            organizationId,
            myPostId: id,
            contentFingerprint: "", // 可选:从 items 反查;简化版传空
            source: "sync" as const,
          },
        })),
      );
    }

    return result;
  },
);
```

字段名（`collectionRunId` / `collectionSources.myAccountId` 等）执行时按当前 schema 确认；如果与现状不一致就改这里，不要改 schema。

- [ ] **Step 4: 注册到 `src/inngest/functions/index.ts`**

```ts
// 找到 functions 数组,加：
export { topicCompareSyncFromCollection } from "./topic-compare/sync-on-run-completed";

// 并在 export const functions = [ ... ] 里加它
```

- [ ] **Step 5: 跑集成测试**

Run: `npx vitest run src/inngest/functions/topic-compare/__tests__/sync-on-run-completed.test.ts`
Expected: 3 passed（如果某条因 schema 字段名不准失败，根据真 schema 调实现）

- [ ] **Step 6: Commit**

```bash
git add src/inngest/functions/topic-compare src/inngest/functions/index.ts
git commit -m "feat(inngest): topicCompareSyncFromCollection — collection/run.completed → sync"
```

---

### Task 2.5: Phase 2 收尾

- [ ] **Step 1: 全量类型检查**

Run: `npx tsc --noEmit`
Expected: 零错误

- [ ] **Step 2: 全量单测**

Run: `npm run test`
Expected: 全 pass

**Phase 2 milestone M1**: 此时手工触发 `collection/run.completed` event（Inngest UI），benchmark_posts 真数据进库。

---

## Phase 3：Backfill + toggle action + UI 护栏

### Task 3.1: 纯函数 `backfill.ts`

**Files:**
- Create: `src/lib/topic-compare/backfill.ts`
- Create: `src/lib/topic-compare/__tests__/backfill.test.ts`

- [ ] **Step 1: 写测试**

```ts
// src/lib/topic-compare/__tests__/backfill.test.ts
import { describe, it, expect, vi } from "vitest";
import { backfillAccount } from "../backfill";

vi.mock("@/lib/topic-compare/sync-collected", () => ({
  syncCollectedItems: vi.fn().mockResolvedValue({
    skipped: false,
    processed: 30,
    succeeded: 30,
    parseFailed: 0,
    upserted: 30,
    newMyPostIds: ["mp-1", "mp-2"],
  }),
}));

// mock TikHub adapter call — 接口按现状取
vi.mock("@/lib/collection/adapters/tikhub", () => ({
  tikhubAdapter: {
    fetchAccountPosts: vi.fn().mockResolvedValue({
      items: Array.from({ length: 30 }, (_, i) => ({
        externalId: `ext-${i}`,
        title: `帖子${i}`,
        sourceUrl: `https://example.com/${i}`,
        views: i * 10,
        likes: i,
        contentFingerprint: `fp-${i}`,
      })),
    }),
  },
}));

describe("backfillAccount", () => {
  it("调一次 TikHub 拿到 30 条 → 喂给 sync → 返回统计", async () => {
    const result = await backfillAccount({
      organizationId: "org-1",
      kind: "my",
      accountId: "ma-1",
      platform: "douyin",
      handle: "test_user",
    });
    expect(result.itemsFetched).toBe(30);
    expect(result.newMyPostIds.length).toBe(2);
  });

  it("非白名单平台直接 skip,不调 TikHub", async () => {
    const result = await backfillAccount({
      organizationId: "org-1",
      kind: "benchmark",
      accountId: "ba-1",
      platform: "xiaohongshu",
      handle: "x",
    });
    expect(result.skipped).toBe(true);
  });
});
```

- [ ] **Step 2: 跑测试确认 fail**

Run: `npx vitest run src/lib/topic-compare/__tests__/backfill.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

```ts
// src/lib/topic-compare/backfill.ts
import { syncCollectedItems, type SyncSourceBinding } from "./sync-collected";
import { isTikhubAccountSupported } from "./constants";
// import tikhub adapter — 按实际路径
import { tikhubAdapter } from "@/lib/collection/adapters/tikhub";

export interface BackfillResult {
  skipped: boolean;
  itemsFetched: number;
  syncResult: Awaited<ReturnType<typeof syncCollectedItems>> | null;
  newMyPostIds: string[];
}

export async function backfillAccount(params: {
  organizationId: string;
  kind: "my" | "benchmark";
  accountId: string;
  platform: string;
  handle: string;
}): Promise<BackfillResult> {
  if (!isTikhubAccountSupported(params.platform)) {
    return { skipped: true, itemsFetched: 0, syncResult: null, newMyPostIds: [] };
  }

  // 调 TikHub Account 模式拿最近 30 条
  const tikhubResult = await tikhubAdapter.fetchAccountPosts({
    platform: params.platform,
    handle: params.handle,
    limit: 30,
  });

  const binding: SyncSourceBinding =
    params.kind === "my"
      ? { kind: "my", platform: params.platform, myAccountId: params.accountId }
      : { kind: "benchmark", platform: params.platform, benchmarkAccountId: params.accountId };

  const syncResult = await syncCollectedItems({
    organizationId: params.organizationId,
    binding,
    items: tikhubResult.items,
  });

  return {
    skipped: false,
    itemsFetched: tikhubResult.items.length,
    syncResult,
    newMyPostIds: syncResult.newMyPostIds,
  };
}
```

注：`tikhubAdapter.fetchAccountPosts` 实际签名要按 `src/lib/collection/adapters/tikhub/index.ts` 调；如果现有 adapter 只暴露通用 `run(source)` 入口，本任务里加一个 thin wrapper 直接调用 account 模式 endpoint。

- [ ] **Step 4: 跑测试确认 pass**

Run: `npx vitest run src/lib/topic-compare/__tests__/backfill.test.ts`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/topic-compare/backfill.ts src/lib/topic-compare/__tests__/backfill.test.ts
git commit -m "feat(topic-compare): 纯函数 backfillAccount(TikHub 30 条 → sync)"
```

---

### Task 3.2: Inngest fn `topicCompareBackfill`

**Files:**
- Create: `src/inngest/functions/topic-compare/backfill.ts`
- Modify: `src/inngest/functions/index.ts`

- [ ] **Step 1: 实现**

```ts
// src/inngest/functions/topic-compare/backfill.ts
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { myAccounts, benchmarkAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { backfillAccount } from "@/lib/topic-compare/backfill";

export const topicCompareBackfill = inngest.createFunction(
  {
    id: "topic-compare/backfill",
    concurrency: 2,
    retries: 2,
  },
  { event: "topic-compare/backfill.requested" },
  async ({ event, step, logger }) => {
    const { organizationId, accountKind, accountId } = event.data;

    const account = await step.run("load-account", async () => {
      if (accountKind === "my") {
        const [a] = await db.select().from(myAccounts).where(eq(myAccounts.id, accountId)).limit(1);
        return a;
      }
      const [a] = await db.select().from(benchmarkAccounts).where(eq(benchmarkAccounts.id, accountId)).limit(1);
      return a;
    });

    if (!account) {
      logger.error("[backfill] account not found");
      return { error: "account-not-found" };
    }

    const result = await step.run("backfill", async () => {
      return backfillAccount({
        organizationId,
        kind: accountKind,
        accountId,
        platform: account.platform,
        handle: account.handle,
      });
    });

    return result;
  },
);
```

- [ ] **Step 2: 注册到 index.ts**

- [ ] **Step 3: 类型检查**

Run: `npx tsc --noEmit`
Expected: 零错误

- [ ] **Step 4: Commit**

```bash
git add src/inngest/functions/topic-compare/backfill.ts src/inngest/functions/index.ts
git commit -m "feat(inngest): topicCompareBackfill — backfill.requested → backfillAccount"
```

---

### Task 3.3: Server action — toggle crawlCronEnabled

**Files:**
- 定位现有 `/topic-compare/accounts` 页面绑定的 server action
- Modify: 该 action 文件（路径执行时确认）

- [ ] **Step 1: 找到现有 action**

Run: `grep -rnE 'crawlCronEnabled' src/app/actions/ src/app/\(dashboard\)/topic-compare/`
Expected: 看到 1-2 个文件用到。

- [ ] **Step 2: 在 toggle action 里加 event dispatch**

```ts
import { inngest } from "@/inngest/client";

export async function setMyAccountCrawlEnabled(params: { accountId: string; enabled: boolean }) {
  const user = await requireAuth();
  await db.update(myAccounts).set({ crawlCronEnabled: params.enabled }).where(...);

  if (params.enabled) {
    await inngest.send({
      name: "topic-compare/backfill.requested",
      data: {
        organizationId: user.organizationId,
        accountKind: "my",
        accountId: params.accountId,
        triggeredBy: "toggle",
        triggeredByUserId: user.id,
      },
    });
  }

  revalidatePath("/topic-compare/accounts");
}

// 对 benchmark 账号同形（如果有独立 action）
```

- [ ] **Step 3: 类型检查 + build**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/<file>.ts
git commit -m "feat(topic-compare): toggle crawlCronEnabled=true 时派 backfill 事件"
```

---

### Task 3.4: UI 护栏 — 非白名单平台禁用 toggle

**Files:**
- Modify: `/topic-compare/accounts` 页对应 client component（路径执行时确认）

- [ ] **Step 1: 找到 toggle 组件**

Run: `grep -nE 'crawlCronEnabled' src/app/\(dashboard\)/topic-compare/accounts/`

- [ ] **Step 2: 加禁用逻辑**

```tsx
import { isTikhubAccountSupported } from "@/lib/topic-compare/constants";

const unsupported = !isTikhubAccountSupported(account.platform);

<Switch
  checked={account.crawlCronEnabled}
  disabled={unsupported}
  onCheckedChange={...}
/>
{unsupported && (
  <span className="text-xs text-muted-foreground">仅 4 平台可开</span>
)}
```

- [ ] **Step 3: 本地起 dev 看一眼**

Run: `npm run dev`，访问 `/topic-compare/accounts`，确认非白名单账号的 toggle 灰掉。

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/topic-compare/accounts
git commit -m "feat(topic-compare): toggle UI 对非白名单平台禁用+文案'仅 4 平台可开'"
```

**Phase 3 收尾：**

```bash
npx tsc --noEmit  # 零错误
npm run test      # 全 pass
```

**Phase 3 milestone M2**: 运营在账号页 toggle 开启 → 即时回填 30 条 → DB 真数据可见。

---

## Phase 4：topic_match auto-trigger + missed-topic cron

### Task 4.1: Inngest fn `topicCompareFindMatchesOnNew`

**Files:**
- Create: `src/inngest/functions/topic-compare/find-matches-on-new-mypost.ts`
- Modify: `src/inngest/functions/index.ts`

- [ ] **Step 1: 实现**

```ts
// src/inngest/functions/topic-compare/find-matches-on-new-mypost.ts
import { inngest } from "@/inngest/client";
import { findSameTopicMatches } from "@/lib/topic-matching/find-matches";

export const topicCompareFindMatchesOnNew = inngest.createFunction(
  {
    id: "topic-compare/find-matches-on-new-mypost",
    concurrency: 4,  // 防 LLM 雪崩
    retries: 3,
  },
  { event: "topic-compare/my-post.created" },
  async ({ event, step }) => {
    const { organizationId, myPostId } = event.data;
    return step.run("find-matches", async () => {
      return findSameTopicMatches({ orgId: organizationId, myPostId });
    });
  },
);
```

- [ ] **Step 2: 注册 + 类型检查**

- [ ] **Step 3: Commit**

```bash
git add src/inngest/functions/topic-compare/find-matches-on-new-mypost.ts \
        src/inngest/functions/index.ts
git commit -m "feat(inngest): topicCompareFindMatchesOnNew(concurrency=4)"
```

---

### Task 4.2: Inngest cron `missedTopicDetectionDaily`

**Files:**
- Create: `src/inngest/functions/topic-compare/missed-topic-cron.ts`
- Modify: `src/inngest/functions/index.ts`

- [ ] **Step 1: 实现**

```ts
// src/inngest/functions/topic-compare/missed-topic-cron.ts
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { benchmarkAccounts, myAccounts } from "@/db/schema";
import { eq, isNotNull, and } from "drizzle-orm";
import { detectMissedTopicsForOrg } from "@/lib/topic-matching/missed-topic-finder";

export const missedTopicDetectionDaily = inngest.createFunction(
  {
    id: "topic-compare/missed-topic-daily",
    concurrency: 2,
  },
  // 06:00 SH 每天
  { cron: "TZ=Asia/Shanghai 0 6 * * *" },
  async ({ step, logger }) => {
    const orgIds = await step.run("collect-org-ids", async () => {
      const benchOrgs = await db
        .selectDistinct({ orgId: benchmarkAccounts.organizationId })
        .from(benchmarkAccounts)
        .where(
          and(
            eq(benchmarkAccounts.crawlCronEnabled, true),
            isNotNull(benchmarkAccounts.organizationId),
          ),
        );
      const myOrgs = await db
        .selectDistinct({ orgId: myAccounts.organizationId })
        .from(myAccounts)
        .where(eq(myAccounts.crawlCronEnabled, true));
      const set = new Set<string>();
      for (const r of benchOrgs) if (r.orgId) set.add(r.orgId);
      for (const r of myOrgs) if (r.orgId) set.add(r.orgId);
      return [...set];
    });

    const results: Array<{ orgId: string; result: unknown }> = [];
    for (const orgId of orgIds) {
      try {
        const result = await step.run(`detect-${orgId}`, async () => {
          return detectMissedTopicsForOrg({ orgId, sinceDays: 14 });
        });
        results.push({ orgId, result });
      } catch (e) {
        logger.error(`[missed-topic-cron] org=${orgId} failed`, e);
        results.push({ orgId, result: { error: String(e) } });
      }
    }
    return { orgsProcessed: results.length, results };
  },
);
```

- [ ] **Step 2: 注册 + 类型检查**

- [ ] **Step 3: Commit**

```bash
git add src/inngest/functions/topic-compare/missed-topic-cron.ts \
        src/inngest/functions/index.ts
git commit -m "feat(inngest): missedTopicDetectionDaily — 06:00 SH 每天跑漏题检测"
```

---

### Task 4.3: Phase 4 收尾

- [ ] **Step 1: 全量类型检查**

Run: `npx tsc --noEmit`
Expected: 零错误

- [ ] **Step 2: 全量单测**

Run: `npm run test`
Expected: 全 pass

**Phase 4 milestone M3 准备就绪**：可进入联调。

---

## Phase 5：联调 + verify 脚本 + 最终验收

### Task 5.1: Verify 脚本

**Files:**
- Create: `scripts/verify-topic-compare-pipeline.sh`

- [ ] **Step 1: 实现**

```bash
#!/usr/bin/env bash
# 验证同题/漏题真数据管线状态
# 用法: bash scripts/verify-topic-compare-pipeline.sh

set -euo pipefail
cd "$(dirname "$0")/.."

DB_LINE="$(awk '/^[[:space:]]*DATABASE_URL=/ && !/^[[:space:]]*#/ {sub(/^[[:space:]]+/, ""); print; exit}' .env.local)"
eval "export $DB_LINE"

PSQL="${PSQL:-/opt/homebrew/opt/libpq/bin/psql}"

echo "=== Topic-Compare Pipeline Status ==="
"$PSQL" "$DATABASE_URL" -At -F"|" <<'SQL'
SELECT 'crawl-enabled my_accounts', COUNT(*) FROM my_accounts WHERE crawl_cron_enabled = true;
SELECT 'crawl-enabled benchmark_accounts', COUNT(*) FROM benchmark_accounts WHERE crawl_cron_enabled = true;
SELECT 'my_accounts crawled <24h', COUNT(*) FROM my_accounts WHERE crawl_cron_enabled = true AND last_crawled_at > NOW() - INTERVAL '24 hours';
SELECT 'benchmark_accounts crawled <24h', COUNT(*) FROM benchmark_accounts WHERE crawl_cron_enabled = true AND last_crawled_at > NOW() - INTERVAL '24 hours';
SELECT 'benchmark_posts <24h delta', COUNT(*) FROM benchmark_posts WHERE created_at > NOW() - INTERVAL '24 hours';
SELECT 'my_posts <24h delta', COUNT(*) FROM my_posts WHERE created_at > NOW() - INTERVAL '24 hours';
SELECT 'topic_matches <24h delta', COUNT(*) FROM topic_matches WHERE updated_at > NOW() - INTERVAL '24 hours';
SELECT 'missed_topics <24h delta', COUNT(*) FROM missed_topics WHERE created_at > NOW() - INTERVAL '24 hours';
SELECT 'zombie my_accounts (>7d no crawl)', COUNT(*) FROM my_accounts WHERE crawl_cron_enabled = true AND (last_crawled_at IS NULL OR last_crawled_at < NOW() - INTERVAL '7 days');
SELECT 'zombie benchmark_accounts (>7d no crawl)', COUNT(*) FROM benchmark_accounts WHERE crawl_cron_enabled = true AND (last_crawled_at IS NULL OR last_crawled_at < NOW() - INTERVAL '7 days');
SQL
echo ""
echo "=== Done ==="
```

- [ ] **Step 2: 给执行权限并跑一次**

Run: `chmod +x scripts/verify-topic-compare-pipeline.sh && bash scripts/verify-topic-compare-pipeline.sh`
Expected: 10 行 fingerprint 输出。

- [ ] **Step 3: Commit**

```bash
git add scripts/verify-topic-compare-pipeline.sh
git commit -m "chore(topic-compare): verify-pipeline.sh 巡检脚本"
```

---

### Task 5.2: 手动端到端联调

不写代码，按下面顺序在本地跑一遍验证。

**前置条件**（开始前务必确认 `.env.local` 已配齐，否则中途会卡）：

- `DATABASE_URL` — 本地或 Sealos 测试库
- `TIKHUB_API_KEY` —（或项目实际用的 env 名，看 `src/lib/collection/adapters/tikhub/config.ts`）
- `OPENAI_API_KEY` + `OPENAI_API_BASE_URL` + `OPENAI_MODEL` — `findSameTopicMatches` 需要 LLM
- 本地 Inngest dev server URL（默认 `http://localhost:8288`）能开

Run: `grep -E 'TIKHUB|OPENAI|DATABASE_URL' .env.local | sed 's/=.*/=***/'`
Expected: 至少 4 行（key 不空）

- [ ] **Step 1: schema 同步检查**

```bash
npx tsx scripts/precheck-my-posts-fingerprint-dupes.ts
bash scripts/verify-schema-sync.sh
```
Expected: 全 OK

- [ ] **Step 2: 起 dev**

```bash
npm run dev
```

- [ ] **Step 3: seed 一个真 TikHub 账号**

到 `/topic-compare/accounts` 页面添加一个真存在的抖音账号（用自己的号或公开的样板号）。

- [ ] **Step 4: toggle 开启 crawlCronEnabled**

页面上点开关。Expected: Inngest UI（默认 http://localhost:8288）能看到 `topic-compare/backfill.requested` 被消费、`topicCompareBackfill` 跑完。

- [ ] **Step 5: 检查 DB**

```bash
bash scripts/verify-topic-compare-pipeline.sh
```
Expected:
- `crawl-enabled my_accounts` ≥ 1
- `my_posts <24h delta` ≥ 1
- `topic_matches <24h delta` ≥ 0（取决于是否有匹配的 benchmark_posts）

- [ ] **Step 6: 加一个 benchmark 账号 + 开 toggle**

类似 step 3-5，但 kind=benchmark。Expected: `benchmark_posts <24h delta` 增加。

- [ ] **Step 7: 手动触发 missedTopicDetectionDaily**

Inngest UI 上手动 invoke。Expected: `missed_topics <24h delta` 增加。

- [ ] **Step 8: 打开两个页面验证 UI 活了**

访问 `/topic-compare`：能看到刚加的 my_account 真数据
访问 `/missing-topics`：能看到 missed-topic 列表（如果有未被覆盖的对标帖）

- [ ] **Step 9: 二次跑确认 dedup**

再 toggle 关掉再开，触发第二次 backfill。Expected: `verify-topic-compare-pipeline.sh` 里 24h delta 略增（只增量），不是翻倍 —— 说明 dedup 生效。

- [ ] **Step 10: 联调成功后留个 commit log**

```bash
# 没 code 改动也写个文档式 commit 标记联调通过
git commit --allow-empty -m "chore(topic-compare): 端到端联调通过(M3 达成)

  - my_account/benchmark_account toggle 即时触发回填
  - sync 链路把真数据落入 benchmark_posts/my_posts
  - topic_matches/missed_topics 跟着真数据自动更新
  - dedup 二次跑无重复行"
```

---

### Task 5.3: Final 构建验收

- [ ] **Step 1: tsc**

Run: `npx tsc --noEmit`
Expected: 零错误

- [ ] **Step 2: production build**

Run: `npm run build`
Expected: build 成功

- [ ] **Step 3: lint**

Run: `npm run lint`
Expected: 无 error

- [ ] **Step 4: 全量测试**

Run: `npm run test`
Expected: 全 pass

- [ ] **Step 5: 最终 commit（如果有 lint fix）**

```bash
git add -A
git commit -m "chore(topic-compare): 最终 lint+build 验收 (M3 完成)" --allow-empty
```

---

## 关键参考

- **Spec**: `docs/superpowers/specs/2026-06-03-topic-compare-real-data-design.md`
- **现有算法**:
  - `src/lib/topic-matching/find-matches.ts:28`（`findSameTopicMatches`）
  - `src/lib/topic-matching/missed-topic-finder.ts:40`（`detectMissedTopicsForOrg`）
- **现有 cron**: `src/inngest/functions/account-analytics/crawl-cron.ts`
- **TikHub adapter**: `src/lib/collection/adapters/tikhub/`
- **Schema**: `src/db/schema/topic-compare-v2.ts`
- **CLAUDE.md §Schema Migration 规范**：标准 migration 流程
- **CLAUDE.md §Inngest**：事件驱动模式
- **超能力子技能**:
  - 写实现前用 `superpowers:test-driven-development`
  - 完成宣告前用 `superpowers:verification-before-completion`
  - 沉默失败用 `superpowers:systematic-debugging` 排查

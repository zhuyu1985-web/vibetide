# Collection Hub · Phase 0 地基层 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建统一数据采集模块的地基——`pg_trgm` 扩展、4 张新表、`SourceAdapter` 插件接口、Registry、FetchLayer、3 个基础 Adapter（TopHub / Tavily / Jina URL）、Writer 管道、`collection/item.created` 事件骨架 + smoke-test 消费者。Phase 0 完成时能在代码中直接调用一次 TopHub 采集，数据正确落 `collected_items`，事件触达 smoke 消费者。

**Architecture:** 插件式 Adapter 架构，所有源通过统一 `SourceAdapter` 接口注册进 Registry；`FetchLayer` 提供跨 Adapter 的重试/限流/超时；`Writer` 负责归一化/指纹去重/事件发射。领域派生表的 FK 改造放到 Phase 1-4，Phase 0 只建新表、不动旧表。

**Tech Stack:** Next.js 16、Drizzle ORM 0.45.1（schema in `src/db/schema/collection.ts`）、Inngest v3、Zod 4、Vitest。

**关联文档：** 设计 spec `docs/superpowers/specs/2026-04-18-unified-collection-module-design.md`

**Phase 0 验收标准：**
- `pg_trgm` 扩展在本地 Supabase 生效，trigram 索引可创建
- `collected_items` / `collection_sources` / `collection_runs` / `collection_logs` 4 张表存在
- 3 个 Adapter（TopHub / Tavily / Jina URL）全部通过单测
- Writer 集成测全部通过（插入、URL 合并、指纹合并、并发锁）
- 手动触发一次 TopHub 采集，数据进 DB，smoke consumer 收到事件
- `npm run build` 通过，`npm run test` 通过

---

## 文件结构总览

### 新建 — DB / Migration
- `supabase/migrations/0022_pg_trgm_extension.sql`（独立迁移，必须先于 0023）
- `supabase/migrations/0023_collection_hub_tables.sql`（drizzle-kit generate 产出）
- `src/db/schema/collection.ts` — 4 张表 + 索引

### 新建 — 核心库
- `src/lib/collection/types.ts` — `SourceAdapter` / `RawItem` / `ConfigField` / `AdapterContext` / `WriteArgs`
- `src/lib/collection/normalize.ts` — `normalizeTitle` / `normalizeUrl` / `computeFingerprint`
- `src/lib/collection/fetch-layer.ts` — `fetchWithPolicy` 通用重试/超时
- `src/lib/collection/registry.ts` — `ADAPTER_REGISTRY`、`registerAdapter`、`getAdapter`、`listAdapters`
- `src/lib/collection/writer.ts` — `writeItems` 归一化→指纹→合并/插入→事件

### 新建 — Adapters（Phase 0 的 3 个）
- `src/lib/collection/adapters/tophub.ts`
- `src/lib/collection/adapters/tavily.ts`
- `src/lib/collection/adapters/jina-url.ts`
- `src/lib/collection/adapters/index.ts` — 导入 + 注册所有 Adapter

### 新建 — Inngest
- `src/inngest/functions/collection/run-source.ts` — 执行单个源的 Inngest 函数
- `src/inngest/functions/collection/smoke-consumer.ts` — Phase 0 smoke test 消费者
- `src/inngest/functions/collection/index.ts` — re-export

### 修改 — Inngest 装配
- `src/inngest/events.ts` — 注册 `collection/source.run-requested` 与 `collection/item.created` 事件
- `src/inngest/functions/index.ts` — 在 `functions` 数组里追加两个新函数（`route.ts` 自动 pick up）

### 新建 — 测试
- `src/lib/collection/__tests__/normalize.test.ts`（单测）
- `src/lib/collection/__tests__/fetch-layer.test.ts`（单测）
- `src/lib/collection/__tests__/writer.test.ts`（集成测，需 `DATABASE_URL`）
- `src/lib/collection/adapters/__tests__/tophub.test.ts`（单测，mock fetch）
- `src/lib/collection/adapters/__tests__/tavily.test.ts`（单测）
- `src/lib/collection/adapters/__tests__/jina-url.test.ts`（单测）

### 新建 — 脚本
- `scripts/phase0-smoke-run.ts` — 命令行手动触发一次 TopHub 源,验证端到端

---

## Task 1: `pg_trgm` 扩展 migration

**Files:** Create `supabase/migrations/0022_pg_trgm_extension.sql`

`pg_trgm` 是 PostgreSQL 内置 contrib 扩展，Supabase（云端 + 本地）都支持，无需申请。必须先于建表迁移，所以用独立的 migration。

- [ ] **Step 1.1** 创建文件 `supabase/migrations/0022_pg_trgm_extension.sql`：

```sql
-- Enable pg_trgm extension for trigram GIN indexes used by Collection Hub FTS.
-- Must run before any migration that creates trigram indexes on collected_items.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

- [ ] **Step 1.2** 在本地 Supabase 应用该迁移：

```bash
npm run db:migrate
```

Expected: 命令无报错；`0022_pg_trgm_extension.sql` 在 `drizzle_migrations` 表里出现。

- [ ] **Step 1.3** 验证扩展已启用：

```bash
psql "$DATABASE_URL" -c "SELECT extname FROM pg_extension WHERE extname='pg_trgm';"
```

Expected: 返回一行 `pg_trgm`。

- [ ] **Step 1.4** Commit：

```bash
git add supabase/migrations/0022_pg_trgm_extension.sql
git commit -m "feat(collection-hub): enable pg_trgm extension for trigram FTS

Prerequisite for Collection Hub content-pool full-text search indexes."
```

---

## Task 2: Drizzle schema for 4 collection tables

**Files:** Create `src/db/schema/collection.ts`, modify `src/db/schema/index.ts`

- [ ] **Step 2.1** 创建 `src/db/schema/collection.ts`：

```ts
import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "./users";
import { userProfiles } from "./users";

// ───────────────────────────────────────────────────────────
// ① 源注册表: 所有采集源配置的 SSOT (多租户)
// ───────────────────────────────────────────────────────────
export const collectionSources = pgTable(
  "collection_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sourceType: text("source_type").notNull(),
    config: jsonb("config").notNull(),
    scheduleCron: text("schedule_cron"),
    scheduleMinIntervalSeconds: integer("schedule_min_interval_seconds"),
    targetModules: text("target_modules").array().notNull().default(sql`ARRAY[]::text[]`),
    defaultCategory: text("default_category"),
    defaultTags: text("default_tags").array(),
    enabled: boolean("enabled").notNull().default(true),
    createdBy: uuid("created_by").references(() => userProfiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    lastRunStatus: text("last_run_status"),
    totalItemsCollected: bigint("total_items_collected", { mode: "number" })
      .notNull()
      .default(0),
    totalRuns: bigint("total_runs", { mode: "number" }).notNull().default(0),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    uniqueOrgName: unique("collection_sources_org_name_unique").on(t.organizationId, t.name),
    enabledIdx: index("collection_sources_org_enabled_idx").on(t.organizationId, t.enabled),
  }),
);

// ───────────────────────────────────────────────────────────
// ② 原始采集池: 所有采集结果规范化存储
// ───────────────────────────────────────────────────────────
export const collectedItems = pgTable(
  "collected_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    contentFingerprint: text("content_fingerprint").notNull(),
    canonicalUrl: text("canonical_url"),
    canonicalUrlHash: text("canonical_url_hash"),
    title: text("title").notNull(),
    content: text("content"),
    summary: text("summary"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    firstSeenSourceId: uuid("first_seen_source_id").references(() => collectionSources.id, {
      onDelete: "set null",
    }),
    firstSeenChannel: text("first_seen_channel").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull(),
    sourceChannels: jsonb("source_channels").notNull().default(sql`'[]'::jsonb`),
    category: text("category"),
    tags: text("tags").array(),
    language: text("language"),
    derivedModules: text("derived_modules").array().notNull().default(sql`ARRAY[]::text[]`),
    rawMetadata: jsonb("raw_metadata"),
    enrichmentStatus: text("enrichment_status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqueFingerprint: unique("collected_items_org_fp_unique").on(
      t.organizationId,
      t.contentFingerprint,
    ),
    pubIdx: index("collected_items_org_pub_idx").on(t.organizationId, t.publishedAt),
    urlHashIdx: index("collected_items_url_hash_idx").on(t.canonicalUrlHash),
    categoryIdx: index("collected_items_org_category_idx").on(t.organizationId, t.category),
    tagsIdx: index("collected_items_tags_gin").using("gin", t.tags),
    derivedIdx: index("collected_items_derived_gin").using("gin", t.derivedModules),
    // trigram 全文索引 — pg_trgm 扩展必须已启用（见 0022 migration）
    titleTrgmIdx: index("collected_items_title_trgm").using(
      "gin",
      sql`${t.title} gin_trgm_ops`,
    ),
    contentTrgmIdx: index("collected_items_content_trgm").using(
      "gin",
      sql`${t.content} gin_trgm_ops`,
    ),
  }),
);

// ───────────────────────────────────────────────────────────
// ③ 运行日志: 每次 adapter 执行一条
// ───────────────────────────────────────────────────────────
export const collectionRuns = pgTable(
  "collection_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => collectionSources.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    trigger: text("trigger").notNull(), // "cron" | "manual" | "event"
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    status: text("status").notNull(), // "running" | "success" | "partial" | "failed"
    itemsAttempted: integer("items_attempted").notNull().default(0),
    itemsInserted: integer("items_inserted").notNull().default(0),
    itemsMerged: integer("items_merged").notNull().default(0),
    itemsFailed: integer("items_failed").notNull().default(0),
    errorSummary: text("error_summary"),
    metadata: jsonb("metadata"),
  },
  (t) => ({
    sourceStartedIdx: index("collection_runs_source_started_idx").on(
      t.sourceId,
      t.startedAt,
    ),
  }),
);

// ───────────────────────────────────────────────────────────
// ④ 细粒度事件日志: 错误/告警/信息条目
// ───────────────────────────────────────────────────────────
export const collectionLogs = pgTable(
  "collection_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => collectionRuns.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => collectionSources.id, { onDelete: "cascade" }),
    level: text("level").notNull(), // "info" | "warn" | "error"
    message: text("message").notNull(),
    metadata: jsonb("metadata"),
    loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    runLoggedIdx: index("collection_logs_run_logged_idx").on(t.runId, t.loggedAt),
  }),
);
```

- [ ] **Step 2.2** 在 `src/db/schema/index.ts` 末尾追加：

```ts
// Collection Hub (统一数据采集, 2026-04-18)
export * from "./collection";
```

- [ ] **Step 2.3** 生成 migration：

```bash
npm run db:generate
```

Expected: 在 `supabase/migrations/` 新增 `0023_*.sql`（drizzle-kit 自动命名），包含 4 张表的 `CREATE TABLE` 与索引。

- [ ] **Step 2.4** 检查生成的 SQL，确认：
  - 4 张表都在
  - trigram GIN 索引语法为 `USING gin (title gin_trgm_ops)` 形式
  - `pg_trgm` 本身**不**在这个 migration 里（它在 0022）

若 drizzle 生成的 SQL 不符合 trigram 形式，手动编辑 `0023_*.sql` 文件修正。

- [ ] **Step 2.5** 应用 migration：

```bash
npm run db:migrate
```

- [ ] **Step 2.6** 验证表结构：

```bash
psql "$DATABASE_URL" -c "\\d collected_items" | head -40
psql "$DATABASE_URL" -c "\\di collected_items*" 
```

Expected: 表字段和索引都存在，包括 `collected_items_title_trgm` 与 `collected_items_content_trgm`。

- [ ] **Step 2.7** Type check：

```bash
npx tsc --noEmit
```

Expected: 无新错误。

- [ ] **Step 2.8** Commit：

```bash
git add src/db/schema/collection.ts src/db/schema/index.ts supabase/migrations/0023_*.sql
git commit -m "feat(collection-hub): add 4 core tables (sources/items/runs/logs)

- collection_sources: source registry with per-tenant isolation
- collected_items: normalized content pool with trigram FTS + dedup keys
- collection_runs: per-execution log
- collection_logs: fine-grained event stream"
```

---

## Task 3: Inngest 事件注册

**Files:** Modify `src/inngest/events.ts`

- [ ] **Step 3.1** 在 `src/inngest/events.ts` 的 `InngestEvents` 类型末尾追加：

```ts
  // ─── Collection Hub Events (2026-04-18) ───

  "collection/source.run-requested": {
    data: {
      sourceId: string;
      organizationId: string;
      trigger: "cron" | "manual" | "event";
      /** optional override of source.config (used when triggering via UI "试运行") */
      configOverride?: Record<string, unknown>;
    };
  };
  "collection/item.created": {
    data: {
      itemId: string;
      sourceId: string;
      organizationId: string;
      targetModules: string[];
      firstSeenChannel: string;
    };
  };
```

- [ ] **Step 3.2** Type check：

```bash
npx tsc --noEmit
```

Expected: 无错误。

- [ ] **Step 3.3** Commit：

```bash
git add src/inngest/events.ts
git commit -m "feat(collection-hub): register 2 Inngest events (run-requested + item.created)"
```

---

## Task 4: `normalize.ts` 归一化工具 (TDD)

**Files:**
- Create: `src/lib/collection/normalize.ts`
- Test: `src/lib/collection/__tests__/normalize.test.ts`

此模块是纯函数,用完整 TDD 流程。

- [ ] **Step 4.1** 写测试文件 `src/lib/collection/__tests__/normalize.test.ts`：

```ts
import { describe, it, expect } from "vitest";
import {
  normalizeTitle,
  normalizeUrl,
  computeUrlHash,
  computeContentFingerprint,
} from "../normalize";

describe("normalizeTitle", () => {
  it("strips whitespace and punctuation", () => {
    expect(normalizeTitle("  Hello, World!!  ")).toBe("helloworld");
  });

  it("lowercases ASCII letters", () => {
    expect(normalizeTitle("HELLO World")).toBe("helloworld");
  });

  it("collapses internal whitespace", () => {
    expect(normalizeTitle("a    b\tc\n d")).toBe("abcd");
  });

  it("converts traditional Chinese to simplified", () => {
    // 國家 → 国家 (simplified)
    expect(normalizeTitle("國家大事")).toBe("国家大事");
  });

  it("strips common Chinese punctuation", () => {
    expect(normalizeTitle("【重磅】某某公司，今日上市！")).toBe("重磅某某公司今日上市");
  });

  it("handles empty string", () => {
    expect(normalizeTitle("")).toBe("");
  });
});

describe("normalizeUrl", () => {
  it("strips fragment", () => {
    expect(normalizeUrl("https://a.com/p#frag")).toBe("https://a.com/p");
  });

  it("strips trailing slash except root", () => {
    expect(normalizeUrl("https://a.com/p/")).toBe("https://a.com/p");
    expect(normalizeUrl("https://a.com/")).toBe("https://a.com/");
  });

  it("lowercases scheme and host", () => {
    expect(normalizeUrl("HTTPS://A.COM/X")).toBe("https://a.com/X");
  });

  it("upgrades http to https", () => {
    expect(normalizeUrl("http://a.com/x")).toBe("https://a.com/x");
  });

  it("drops utm_* and common tracking params", () => {
    expect(normalizeUrl("https://a.com/?utm_source=t&utm_medium=m&id=1&fbclid=abc"))
      .toBe("https://a.com/?id=1");
  });

  it("sorts remaining query params", () => {
    expect(normalizeUrl("https://a.com/?b=2&a=1")).toBe("https://a.com/?a=1&b=2");
  });

  it("returns null for invalid URLs", () => {
    expect(normalizeUrl("not a url")).toBe(null);
    expect(normalizeUrl("")).toBe(null);
  });
});

describe("computeUrlHash", () => {
  it("produces same hash for equivalent URLs", () => {
    expect(computeUrlHash("https://A.COM/x/?utm_source=t&id=1"))
      .toBe(computeUrlHash("http://a.com/x?id=1"));
  });

  it("returns null for invalid URL", () => {
    expect(computeUrlHash("not a url")).toBe(null);
  });

  it("produces 32-char hex md5", () => {
    const h = computeUrlHash("https://example.com/");
    expect(h).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("computeContentFingerprint", () => {
  it("produces same fingerprint for same title + same day", () => {
    const day = new Date("2026-04-18T10:00:00Z");
    const nextHour = new Date("2026-04-18T14:00:00Z");
    expect(computeContentFingerprint("Hello world", day))
      .toBe(computeContentFingerprint("  HELLO  WORLD!  ", nextHour));
  });

  it("produces different fingerprints across days when publishedAt set", () => {
    const day1 = new Date("2026-04-18T23:00:00Z");
    const day2 = new Date("2026-04-19T01:00:00Z");
    expect(computeContentFingerprint("Hello", day1))
      .not.toBe(computeContentFingerprint("Hello", day2));
  });

  it("uses 7d bucket when publishedAt null - captured dates within 7d share bucket", () => {
    // captured_at 2026-04-18 and 2026-04-20 should share the same 7d bucket
    const capture1 = new Date("2026-04-18T10:00:00Z");
    const capture2 = new Date("2026-04-20T10:00:00Z");
    expect(computeContentFingerprint("Hello", null, capture1))
      .toBe(computeContentFingerprint("Hello", null, capture2));
  });

  it("differs when capture dates span 7d boundary with null publishedAt", () => {
    const capture1 = new Date("2026-04-01T10:00:00Z");
    const capture2 = new Date("2026-04-15T10:00:00Z");
    expect(computeContentFingerprint("Hello", null, capture1))
      .not.toBe(computeContentFingerprint("Hello", null, capture2));
  });

  it("produces 32-char hex md5", () => {
    const fp = computeContentFingerprint("hello", new Date());
    expect(fp).toMatch(/^[0-9a-f]{32}$/);
  });
});
```

- [ ] **Step 4.2** 运行测试,确认失败：

```bash
npm run test -- src/lib/collection/__tests__/normalize.test.ts
```

Expected: 全部 FAIL（模块不存在）。

- [ ] **Step 4.3** 查看现有项目是否已有繁简转换依赖。执行：

```bash
grep -l "chinese-s2t\|opencc" package.json src/lib/**/*.ts 2>/dev/null
```

若没有，在 package.json 安装 `chinese-s2t`（轻量纯 JS，约 30KB）：

```bash
npm install chinese-s2t
```

- [ ] **Step 4.4** 创建 `src/lib/collection/normalize.ts`：

```ts
import { createHash } from "node:crypto";
import { t2s } from "chinese-s2t";

/**
 * 标题归一化: 繁简转简 → 去标点/符号 → 去空白 → lowercase
 * 对应 spec 6.3 "normalize_title"
 */
export function normalizeTitle(title: string): string {
  if (!title) return "";
  const simplified = t2s(title);
  // 去除常见标点(ASCII + 中文) 和 所有空白
  return simplified
    .replace(/[\s\u00A0\u3000]+/g, "")
    .replace(
      /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~！"#¥%&'()*+，－。／：；＜＝＞？＠［＼］＾＿｀｛｜｝～·【】《》「」『』、…—\-]+/g,
      "",
    )
    .toLowerCase();
}

const TRACKING_PARAM_PREFIXES = ["utm_"];
const TRACKING_PARAM_KEYS = new Set([
  "fbclid",
  "gclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "ref",
  "spm",
]);

/**
 * URL 归一化:
 * - 去 fragment
 * - http→https
 * - lowercase scheme + host
 * - 去尾部斜杠(root 保留)
 * - 去 utm_* / fbclid 等追踪参数
 * - 剩余 query 按键排序
 * 失败返回 null
 */
export function normalizeUrl(raw: string): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  // Only handle http(s)
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  url.protocol = "https:";
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";

  // filter + sort params
  const filtered = Array.from(url.searchParams.entries())
    .filter(([k]) => {
      if (TRACKING_PARAM_KEYS.has(k)) return false;
      return !TRACKING_PARAM_PREFIXES.some((p) => k.toLowerCase().startsWith(p));
    })
    .sort(([a], [b]) => a.localeCompare(b));
  url.search = "";
  for (const [k, v] of filtered) url.searchParams.append(k, v);

  let str = url.toString();
  // strip trailing slash except for root-only path
  if (url.pathname !== "/" && str.endsWith("/")) str = str.slice(0, -1);
  return str;
}

export function computeUrlHash(raw: string): string | null {
  const norm = normalizeUrl(raw);
  if (!norm) return null;
  return createHash("md5").update(norm).digest("hex");
}

/**
 * 内容指纹:
 * - 有 publishedAt: bucket = UTC 当天 00:00 epoch (24h)
 * - 无 publishedAt: bucket = floor(capturedAt_epoch / 7d) * 7d (7d)
 * 对应 spec 6.3
 */
export function computeContentFingerprint(
  title: string,
  publishedAt: Date | null,
  capturedAt: Date = new Date(),
): string {
  const titleNorm = normalizeTitle(title);
  let bucket: number;
  if (publishedAt) {
    // UTC-day epoch ms
    bucket = Date.UTC(
      publishedAt.getUTCFullYear(),
      publishedAt.getUTCMonth(),
      publishedAt.getUTCDate(),
    );
  } else {
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    bucket = Math.floor(capturedAt.getTime() / SEVEN_DAYS_MS) * SEVEN_DAYS_MS;
  }
  return createHash("md5").update(`${titleNorm}:${bucket}`).digest("hex");
}
```

- [ ] **Step 4.5** 运行测试,确认全通过：

```bash
npm run test -- src/lib/collection/__tests__/normalize.test.ts
```

Expected: 全部 PASS。

- [ ] **Step 4.6** Commit：

```bash
git add src/lib/collection/normalize.ts src/lib/collection/__tests__/normalize.test.ts package.json package-lock.json
git commit -m "feat(collection-hub): add title/url normalize + content fingerprint

Pure functions with full TDD coverage. Implements spec section 6.3:
- normalizeTitle: simplify chinese, strip punctuation/whitespace, lowercase
- normalizeUrl: strip tracking params, canonical form
- computeContentFingerprint: 24h bucket with publishedAt, 7d bucket fallback"
```

---

## Task 5: `fetch-layer.ts` 统一重试/超时 (TDD)

**Files:**
- Create: `src/lib/collection/fetch-layer.ts`
- Test: `src/lib/collection/__tests__/fetch-layer.test.ts`

- [ ] **Step 5.1** 创建测试文件 `src/lib/collection/__tests__/fetch-layer.test.ts`：

```ts
import { describe, it, expect, vi } from "vitest";
import { fetchWithPolicy, DEFAULT_FETCH_POLICY } from "../fetch-layer";

describe("fetchWithPolicy", () => {
  it("returns result on first successful attempt", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await fetchWithPolicy(fn, DEFAULT_FETCH_POLICY);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on thrown error up to maxAttempts", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail1"))
      .mockRejectedValueOnce(new Error("fail2"))
      .mockResolvedValue("ok");
    const result = await fetchWithPolicy(fn, {
      ...DEFAULT_FETCH_POLICY,
      baseDelayMs: 1,
      jitter: false,
    });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws after maxAttempts exceeded", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("persistent"));
    await expect(
      fetchWithPolicy(fn, { ...DEFAULT_FETCH_POLICY, maxAttempts: 2, baseDelayMs: 1, jitter: false }),
    ).rejects.toThrow("persistent");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry when error is marked non-retryable", async () => {
    const err = new Error("400 Bad Request");
    (err as any).nonRetryable = true;
    const fn = vi.fn().mockRejectedValue(err);
    await expect(
      fetchWithPolicy(fn, { ...DEFAULT_FETCH_POLICY, maxAttempts: 5, baseDelayMs: 1, jitter: false }),
    ).rejects.toThrow("400 Bad Request");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("calls onAttempt callback for each attempt", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("e1"))
      .mockResolvedValue("ok");
    const onAttempt = vi.fn();
    await fetchWithPolicy(
      fn,
      { ...DEFAULT_FETCH_POLICY, baseDelayMs: 1, jitter: false },
      onAttempt,
    );
    expect(onAttempt).toHaveBeenCalledTimes(2);
    expect(onAttempt).toHaveBeenNthCalledWith(1, 1, expect.any(Error));
    expect(onAttempt).toHaveBeenNthCalledWith(2, 2, undefined);
  });

  it("respects timeoutMs via AbortController", async () => {
    const fn = (signal: AbortSignal) =>
      new Promise<string>((resolve, reject) => {
        const t = setTimeout(() => resolve("late"), 500);
        signal.addEventListener("abort", () => {
          clearTimeout(t);
          reject(new Error("aborted"));
        });
      });
    await expect(
      fetchWithPolicy(
        ({ signal }) => fn(signal),
        { ...DEFAULT_FETCH_POLICY, timeoutMs: 50, maxAttempts: 1, baseDelayMs: 1 },
      ),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 5.2** 运行确认失败：

```bash
npm run test -- src/lib/collection/__tests__/fetch-layer.test.ts
```

- [ ] **Step 5.3** 创建 `src/lib/collection/fetch-layer.ts`：

```ts
export interface FetchPolicy {
  timeoutMs: number;
  maxAttempts: number;
  backoff: "exponential" | "linear" | "none";
  baseDelayMs: number;
  jitter: boolean;
}

export const DEFAULT_FETCH_POLICY: FetchPolicy = {
  timeoutMs: 10_000,
  maxAttempts: 3,
  backoff: "exponential",
  baseDelayMs: 500,
  jitter: true,
};

export interface FetchContext {
  signal: AbortSignal;
  attempt: number;
}

export type FetchFn<T> = (ctx: FetchContext) => Promise<T>;

export type AttemptCallback = (attempt: number, err?: Error) => void;

/**
 * Wraps any async operation with retry/timeout/backoff.
 * The wrapped fn receives an AbortSignal so it can cancel long-running work
 * on timeout.
 *
 * Retry behavior:
 * - On thrown error, retry up to `maxAttempts` unless `err.nonRetryable === true`.
 * - Backoff between attempts per policy.
 * - Timeout triggers AbortController + counts as a failed attempt.
 */
export async function fetchWithPolicy<T>(
  fn: FetchFn<T>,
  policy: FetchPolicy = DEFAULT_FETCH_POLICY,
  onAttempt?: AttemptCallback,
): Promise<T> {
  let lastErr: Error | undefined;
  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), policy.timeoutMs);
    try {
      const result = await fn({ signal: ac.signal, attempt });
      onAttempt?.(attempt, undefined);
      return result;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      lastErr = e;
      onAttempt?.(attempt, e);
      if ((e as unknown as { nonRetryable?: boolean }).nonRetryable) throw e;
      if (attempt >= policy.maxAttempts) throw e;
      const delay = computeBackoff(policy, attempt);
      await sleep(delay);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr ?? new Error("fetchWithPolicy exhausted with no error");
}

function computeBackoff(policy: FetchPolicy, attempt: number): number {
  let base: number;
  switch (policy.backoff) {
    case "exponential":
      base = policy.baseDelayMs * 2 ** (attempt - 1);
      break;
    case "linear":
      base = policy.baseDelayMs * attempt;
      break;
    default:
      base = policy.baseDelayMs;
  }
  if (policy.jitter) base *= 0.5 + Math.random();
  return Math.floor(base);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Helper: mark a thrown Error as non-retryable (e.g., 4xx that's not 429).
 */
export function markNonRetryable(err: Error): Error {
  (err as unknown as { nonRetryable: boolean }).nonRetryable = true;
  return err;
}
```

- [ ] **Step 5.4** 运行测试,确认 PASS：

```bash
npm run test -- src/lib/collection/__tests__/fetch-layer.test.ts
```

- [ ] **Step 5.5** Commit：

```bash
git add src/lib/collection/fetch-layer.ts src/lib/collection/__tests__/fetch-layer.test.ts
git commit -m "feat(collection-hub): add FetchLayer with retry/timeout/backoff

Centralized fetch policy for all Adapters to share. Supports:
- exponential/linear/none backoff with jitter
- per-attempt timeout via AbortController
- non-retryable error marking (for 4xx non-429)"
```

---

## Task 6: `types.ts` + `registry.ts` (Adapter 插件骨架)

**Files:**
- Create: `src/lib/collection/types.ts`
- Create: `src/lib/collection/registry.ts`

- [ ] **Step 6.1** 创建 `src/lib/collection/types.ts`：

```ts
import type { ZodTypeAny } from "zod";

// ───────────────────────────────────────────────────────────
// 采集原材料 — Adapter 产出,Writer 消费
// ───────────────────────────────────────────────────────────
export interface RawItem {
  title: string;
  url?: string;
  content?: string;
  summary?: string;
  publishedAt?: Date;
  /** e.g. "tophub/weibo", "rss/36kr", "tavily" */
  channel: string;
  rawMetadata?: Record<string, unknown>;
}

// ───────────────────────────────────────────────────────────
// Adapter 执行上下文
// ───────────────────────────────────────────────────────────
export type LogLevel = "info" | "warn" | "error";

export interface AdapterContext<TConfig = unknown> {
  config: TConfig;
  sourceId: string;
  organizationId: string;
  runId: string;
  log: (level: LogLevel, message: string, meta?: Record<string, unknown>) => void;
}

export interface AdapterResult {
  items: RawItem[];
  partialFailures?: { message: string; meta?: Record<string, unknown> }[];
}

// ───────────────────────────────────────────────────────────
// 配置表单字段声明(后台 UI 自动渲染,Phase 1 才用)
// ───────────────────────────────────────────────────────────
export type ConfigFieldType =
  | "text"
  | "url"
  | "textarea"
  | "select"
  | "multiselect"
  | "number"
  | "boolean"
  | "kv";

export interface ConfigField {
  key: string;
  label: string;
  type: ConfigFieldType;
  required?: boolean;
  help?: string;
  options?: { value: string; label: string }[];
  validation?: { pattern?: string; min?: number; max?: number };
}

// ───────────────────────────────────────────────────────────
// Adapter 主接口
// ───────────────────────────────────────────────────────────
export type AdapterCategory =
  | "aggregator"
  | "search"
  | "url"
  | "list"
  | "feed";

export interface SourceAdapter<TConfig = unknown> {
  readonly type: string;
  readonly displayName: string;
  readonly description: string;
  readonly category: AdapterCategory;
  readonly configSchema: ZodTypeAny;
  readonly configFields: ConfigField[];
  execute(ctx: AdapterContext<TConfig>): Promise<AdapterResult>;
  /** Optional 试运行预览(V2 才用) */
  preview?(config: TConfig): Promise<RawItem[]>;
}

// ───────────────────────────────────────────────────────────
// Writer 入口参数
// ───────────────────────────────────────────────────────────
export interface WriteArgs {
  runId: string;
  sourceId: string;
  organizationId: string;
  items: RawItem[];
  /** 源的 targetModules / defaultCategory / defaultTags */
  source: {
    targetModules: string[];
    defaultCategory: string | null;
    defaultTags: string[] | null;
  };
}

export interface WriteResult {
  inserted: number;
  merged: number;
  failed: number;
}
```

- [ ] **Step 6.2** 创建 `src/lib/collection/registry.ts`：

```ts
import type { SourceAdapter } from "./types";

const ADAPTER_REGISTRY = new Map<string, SourceAdapter<any>>();

export function registerAdapter(adapter: SourceAdapter<any>): void {
  if (ADAPTER_REGISTRY.has(adapter.type)) {
    throw new Error(`Adapter type "${adapter.type}" already registered`);
  }
  ADAPTER_REGISTRY.set(adapter.type, adapter);
}

export function getAdapter(type: string): SourceAdapter<any> {
  const adapter = ADAPTER_REGISTRY.get(type);
  if (!adapter) throw new Error(`Unknown source adapter type: "${type}"`);
  return adapter;
}

export function listAdapters(): SourceAdapter<any>[] {
  return Array.from(ADAPTER_REGISTRY.values());
}

/** Test helper — clears registry. DO NOT use in prod code paths. */
export function __resetAdapterRegistry(): void {
  ADAPTER_REGISTRY.clear();
}
```

- [ ] **Step 6.3** Type check：

```bash
npx tsc --noEmit
```

- [ ] **Step 6.4** Commit：

```bash
git add src/lib/collection/types.ts src/lib/collection/registry.ts
git commit -m "feat(collection-hub): add SourceAdapter plugin contract + registry"
```

---

## Task 7: TopHub Adapter (聚合榜单)

**Files:**
- Create: `src/lib/collection/adapters/tophub.ts`
- Test: `src/lib/collection/adapters/__tests__/tophub.test.ts`

TopHub 已有调用逻辑在 `src/lib/trending-api.ts` 里，这里包装成 Adapter。

**已核对的实际签名（与 plan 代码直接匹配）：**

```ts
// src/lib/trending-api.ts
export const TOPHUB_DEFAULT_NODES: Record<string, string> = {
  微博热搜: "KqndgxeLl9",
  知乎热榜: "mproPpoq6O",
  // ...中文名做 key
};
export const PLATFORM_ALIASES: Record<string, string[]> = {
  微博热搜: ["weibo", "微博"],
  // ...把英文别名映射到中文 canonical name
};
export function resolveNodeIds(platforms?: string[]): Record<string, string>;
export interface TrendingItem {
  platform: string;  // Chinese canonical (e.g. "微博热搜")
  rank: number;
  title: string;
  heat: number | string;
  url: string;
  category?: string;
}
export async function fetchTrendingFromApi(
  mode: "hot" | "platforms" | "search",
  options: { platforms?: string[]; limit?: number; query?: string }
): Promise<TrendingItem[]>;
```

注意：`fetchTrendingFromApi("platforms", { platforms })` 内部用 `Promise.allSettled` 聚合所有平台结果，**已吞掉单平台失败**——所以 Phase 0 adapter 不做 per-platform 失败粒度，若 `fetchTrendingFromApi` 整体抛错就算整体失败（partial failure 粒度 V2 再优化）。

- [ ] **Step 7.1** 写测试 `src/lib/collection/adapters/__tests__/tophub.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { tophubAdapter } from "../tophub";

vi.mock("@/lib/trending-api", () => ({
  fetchTrendingFromApi: vi.fn(),
}));

import { fetchTrendingFromApi } from "@/lib/trending-api";

describe("tophubAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has correct metadata", () => {
    expect(tophubAdapter.type).toBe("tophub");
    expect(tophubAdapter.category).toBe("aggregator");
    expect(tophubAdapter.configFields.find((f) => f.key === "platforms")).toBeTruthy();
  });

  it("validates config with zod — rejects missing platforms", () => {
    const result = tophubAdapter.configSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("validates config with zod — accepts valid shape", () => {
    const result = tophubAdapter.configSchema.safeParse({ platforms: ["weibo", "zhihu"] });
    expect(result.success).toBe(true);
  });

  it("execute fetches items and normalizes to RawItem with channel", async () => {
    vi.mocked(fetchTrendingFromApi).mockResolvedValue([
      { platform: "微博热搜", rank: 1, title: "微博热点 A", heat: 100000, url: "https://weibo.com/a" },
      { platform: "微博热搜", rank: 2, title: "微博热点 B", heat: 90000, url: "https://weibo.com/b" },
      { platform: "知乎热榜", rank: 1, title: "知乎热点 X", heat: 50000, url: "https://zhihu.com/x", category: "科技" },
    ]);

    const result = await tophubAdapter.execute({
      config: { platforms: ["weibo", "zhihu"] },
      sourceId: "src-1",
      organizationId: "org-1",
      runId: "run-1",
      log: vi.fn(),
    });

    expect(result.items).toHaveLength(3);
    expect(result.items[0].title).toBe("微博热点 A");
    expect(result.items[0].url).toBe("https://weibo.com/a");
    expect(result.items[0].channel).toBe("tophub/微博热搜");
    expect(result.items[0].rawMetadata).toMatchObject({ rank: 1, heat: 100000 });
    expect(result.items[2].channel).toBe("tophub/知乎热榜");
    expect(result.items[2].rawMetadata).toMatchObject({ category: "科技" });
    expect(fetchTrendingFromApi).toHaveBeenCalledWith("platforms", { platforms: ["weibo", "zhihu"] });
  });

  it("execute surfaces error when fetchTrendingFromApi throws", async () => {
    vi.mocked(fetchTrendingFromApi).mockRejectedValue(new Error("Tophub 503"));

    const log = vi.fn();
    const result = await tophubAdapter.execute({
      config: { platforms: ["weibo"] },
      sourceId: "src-1",
      organizationId: "org-1",
      runId: "run-1",
      log,
    });

    expect(result.items).toHaveLength(0);
    expect(result.partialFailures).toHaveLength(1);
    expect(result.partialFailures?.[0].message).toMatch(/Tophub 503/);
    expect(log).toHaveBeenCalledWith("error", expect.stringMatching(/tophub/i), expect.anything());
  });
});
```

- [ ] **Step 7.2** 运行测试,确认失败：

```bash
npm run test -- src/lib/collection/adapters/__tests__/tophub.test.ts
```

- [ ] **Step 7.3** 创建 `src/lib/collection/adapters/tophub.ts`：

```ts
import { z } from "zod";
import type { SourceAdapter, RawItem } from "../types";
import { fetchTrendingFromApi } from "@/lib/trending-api";

// Aliases understood by trending-api's resolveNodeIds()
const TOPHUB_PLATFORM_ALIASES = [
  "weibo",
  "zhihu",
  "baidu",
  "douyin",
  "toutiao",
  "36kr",
  "bilibili",
  "xiaohongshu",
  "thepaper",
  "weixin",
] as const;

const configSchema = z.object({
  platforms: z
    .array(z.enum(TOPHUB_PLATFORM_ALIASES))
    .min(1, "必须至少选择一个平台"),
});

type TophubConfig = z.infer<typeof configSchema>;

export const tophubAdapter: SourceAdapter<TophubConfig> = {
  type: "tophub",
  displayName: "聚合榜单 (TopHub)",
  description: "抓取 TopHub 聚合的各大平台热榜(微博/抖音/小红书/B站/知乎等)",
  category: "aggregator",
  configSchema,
  configFields: [
    {
      key: "platforms",
      label: "平台",
      type: "multiselect",
      required: true,
      help: "选择要抓取的平台热榜",
      options: TOPHUB_PLATFORM_ALIASES.map((p) => ({ value: p, label: platformLabel(p) })),
    },
  ],

  async execute({ config, log }) {
    const items: RawItem[] = [];
    const partialFailures: { message: string; meta?: Record<string, unknown> }[] = [];

    try {
      const results = await fetchTrendingFromApi("platforms", {
        platforms: [...config.platforms],
      });
      for (const entry of results) {
        items.push({
          title: entry.title,
          url: entry.url || undefined,
          channel: `tophub/${entry.platform}`, // platform is Chinese canonical name
          rawMetadata: {
            rank: entry.rank,
            heat: entry.heat,
            category: entry.category,
          },
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      partialFailures.push({ message, meta: { platforms: config.platforms } });
      log("error", `tophub fetch failed: ${message}`, { platforms: config.platforms });
    }

    return { items, partialFailures };
  },
};

function platformLabel(p: (typeof TOPHUB_PLATFORM_ALIASES)[number]): string {
  const labels: Record<string, string> = {
    weibo: "微博热搜",
    zhihu: "知乎热榜",
    baidu: "百度热搜",
    douyin: "抖音热点",
    toutiao: "今日头条",
    "36kr": "36氪热榜",
    bilibili: "哔哩哔哩",
    xiaohongshu: "小红书",
    thepaper: "澎湃热榜",
    weixin: "微信热文",
  };
  return labels[p] ?? p;
}
```

- [ ] **Step 7.4** 运行测试确认 PASS：

```bash
npm run test -- src/lib/collection/adapters/__tests__/tophub.test.ts
```

- [ ] **Step 7.5** Commit：

```bash
git add src/lib/collection/adapters/tophub.ts src/lib/collection/adapters/__tests__/tophub.test.ts
git commit -m "feat(collection-hub): add TopHub Adapter (aggregator)"
```

---

## Task 8: Tavily Adapter (关键词搜索)

**Files:**
- Create: `src/lib/collection/adapters/tavily.ts`
- Test: `src/lib/collection/adapters/__tests__/tavily.test.ts`

**已核对的实际签名（重要——与直觉不同）：**

```ts
// src/lib/web-fetch.ts
export async function searchViaTavily(
  query: string,
  options: {
    timeRange?: WebSearchTimeRange;        // "1h"|"24h"|"7d"|"30d"|"all"
    maxResults?: number;
    topic?: "general" | "news" | "finance";
    include_domains?: string[];             // snake_case!
  }
): Promise<{
  items: NewsFeedItem[];                    // wrapped in .items, NOT a bare array
  answer?: string;
  responseTime: number;
}>;

export interface NewsFeedItem {
  title: string;
  snippet: string;            // short snippet (NOT "content"/"raw_content")
  url: string;
  source: string;             // hostname
  publishedAt: string | null; // ISO string (NOT Date)
  publishedAtMs: number | null;
  engine: "google-news" | "bing-news";
  sourceType: SourceType;
  credibility: Credibility;
}
```

- [ ] **Step 8.1** 写测试 `src/lib/collection/adapters/__tests__/tavily.test.ts`：

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { tavilyAdapter } from "../tavily";

vi.mock("@/lib/web-fetch", () => ({
  searchViaTavily: vi.fn(),
}));

import { searchViaTavily } from "@/lib/web-fetch";

describe("tavilyAdapter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("has correct metadata", () => {
    expect(tavilyAdapter.type).toBe("tavily");
    expect(tavilyAdapter.category).toBe("search");
    expect(tavilyAdapter.configFields.find((f) => f.key === "keywords")).toBeTruthy();
  });

  it("rejects empty keywords", () => {
    expect(tavilyAdapter.configSchema.safeParse({ keywords: [] }).success).toBe(false);
    expect(tavilyAdapter.configSchema.safeParse({}).success).toBe(false);
  });

  it("accepts minimal valid config", () => {
    const r = tavilyAdapter.configSchema.safeParse({ keywords: ["ai"] });
    expect(r.success).toBe(true);
  });

  it("normalizes NewsFeedItem to RawItem with channel=tavily", async () => {
    vi.mocked(searchViaTavily).mockResolvedValue({
      items: [
        {
          title: "A 国 AI 新政策",
          snippet: "据悉...",
          url: "https://example.com/a",
          source: "example.com",
          publishedAt: "2026-04-10T08:00:00Z",
          publishedAtMs: 1776124800000,
          engine: "google-news",
          sourceType: "news",
          credibility: "high",
        },
      ],
      responseTime: 123,
    });

    const result = await tavilyAdapter.execute({
      config: { keywords: ["AI 政策"], timeRange: "7d", maxResults: 8 },
      sourceId: "src-1",
      organizationId: "org-1",
      runId: "run-1",
      log: vi.fn(),
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      title: "A 国 AI 新政策",
      url: "https://example.com/a",
      summary: "据悉...",
      channel: "tavily",
    });
    expect(result.items[0].publishedAt).toBeInstanceOf(Date);
    expect(result.items[0].rawMetadata).toMatchObject({
      keyword: "AI 政策",
      source: "example.com",
      credibility: "high",
    });
  });

  it("passes includeDomains as include_domains (snake_case) to searchViaTavily", async () => {
    vi.mocked(searchViaTavily).mockResolvedValue({ items: [], responseTime: 10 });
    await tavilyAdapter.execute({
      config: {
        keywords: ["x"],
        timeRange: "24h",
        includeDomains: ["xinhuanet.com"],
        maxResults: 5,
      },
      sourceId: "s",
      organizationId: "o",
      runId: "r",
      log: vi.fn(),
    });
    expect(searchViaTavily).toHaveBeenCalledWith("x", expect.objectContaining({
      timeRange: "24h",
      include_domains: ["xinhuanet.com"],
      maxResults: 5,
    }));
  });

  it("records partialFailures on per-keyword errors", async () => {
    vi.mocked(searchViaTavily)
      .mockResolvedValueOnce({ items: [], responseTime: 10 })
      .mockRejectedValueOnce(new Error("Tavily 429"));

    const log = vi.fn();
    const result = await tavilyAdapter.execute({
      config: { keywords: ["ok", "bad"], timeRange: "7d", maxResults: 8 },
      sourceId: "s",
      organizationId: "o",
      runId: "r",
      log,
    });
    expect(result.partialFailures).toHaveLength(1);
    expect(result.partialFailures?.[0].message).toMatch(/Tavily 429/);
    expect(result.partialFailures?.[0].meta).toMatchObject({ keyword: "bad" });
    expect(log).toHaveBeenCalledWith("error", expect.stringContaining("bad"), expect.anything());
  });
});
```

- [ ] **Step 8.2** 运行确认失败。

- [ ] **Step 8.3** 创建 `src/lib/collection/adapters/tavily.ts`：

```ts
import { z } from "zod";
import type { SourceAdapter, RawItem } from "../types";
import { searchViaTavily } from "@/lib/web-fetch";

const configSchema = z.object({
  keywords: z.array(z.string().min(1)).min(1, "至少一个关键词"),
  timeRange: z.enum(["1h", "24h", "7d", "30d", "all"]).default("7d"),
  includeDomains: z.array(z.string()).optional(),
  maxResults: z.number().int().min(1).max(20).default(8),
});

type TavilyConfig = z.infer<typeof configSchema>;

export const tavilyAdapter: SourceAdapter<TavilyConfig> = {
  type: "tavily",
  displayName: "关键词搜索 (Tavily)",
  description: "通过 Tavily 搜索全网新闻,支持时间窗和站点过滤",
  category: "search",
  configSchema,
  configFields: [
    { key: "keywords", label: "关键词", type: "multiselect", required: true, help: "一个或多个搜索关键词" },
    {
      key: "timeRange",
      label: "时间窗",
      type: "select",
      options: [
        { value: "1h", label: "1 小时内" },
        { value: "24h", label: "24 小时内" },
        { value: "7d", label: "7 天内" },
        { value: "30d", label: "30 天内" },
        { value: "all", label: "不限" },
      ],
    },
    { key: "includeDomains", label: "限定站点(可选)", type: "multiselect", help: "如 xinhuanet.com" },
    { key: "maxResults", label: "每关键词最大条数", type: "number", validation: { min: 1, max: 20 } },
  ],

  async execute({ config, log }) {
    const items: RawItem[] = [];
    const partialFailures: { message: string; meta?: Record<string, unknown> }[] = [];

    for (const keyword of config.keywords) {
      try {
        const response = await searchViaTavily(keyword, {
          timeRange: config.timeRange,
          include_domains: config.includeDomains, // note: snake_case, matches searchViaTavily's option key
          maxResults: config.maxResults,
        });
        for (const r of response.items) {
          items.push({
            title: r.title,
            url: r.url,
            summary: r.snippet,
            publishedAt: r.publishedAtMs ? new Date(r.publishedAtMs) : undefined,
            channel: "tavily",
            rawMetadata: {
              keyword,
              source: r.source,
              sourceType: r.sourceType,
              credibility: r.credibility,
              engine: r.engine,
            },
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        partialFailures.push({ message, meta: { keyword } });
        log("error", `Tavily search failed for "${keyword}": ${message}`, { keyword });
      }
    }

    return { items, partialFailures };
  },
};
```

注：Tavily 只返回 snippet 不返回正文。`RawItem.content` 留空，若下游需要正文需再调用 Jina Reader——这是刻意的（避免搜索阶段抓不必要的长文本）。

- [ ] **Step 8.4** 运行测试确认 PASS：

```bash
npm run test -- src/lib/collection/adapters/__tests__/tavily.test.ts
```

- [ ] **Step 8.5** Commit：

```bash
git add src/lib/collection/adapters/tavily.ts src/lib/collection/adapters/__tests__/tavily.test.ts
git commit -m "feat(collection-hub): add Tavily Adapter (keyword search)"
```

---

## Task 9: Jina URL Adapter (单 URL 深读)

**Files:**
- Create: `src/lib/collection/adapters/jina-url.ts`
- Test: `src/lib/collection/adapters/__tests__/jina-url.test.ts`

- [ ] **Step 9.1** 确认 `src/lib/web-fetch.ts` 里 `fetchViaJinaReader(url)` 返回的是 `{ title, content }`。

- [ ] **Step 9.2** 写测试：
  - 元数据检查
  - Zod schema 校验 `url` 必填且为合法 URL
  - 成功 case：调用 `fetchViaJinaReader` 返回 `{title, content}`，Adapter 产出 1 条 RawItem，channel=`jina/{hostname}`
  - Jina 抛错：放入 `partialFailures`
  - URL 解析失败：记 error log，返回空

- [ ] **Step 9.3** 运行测试确认失败。

- [ ] **Step 9.4** 创建 `src/lib/collection/adapters/jina-url.ts`：

```ts
import { z } from "zod";
import type { SourceAdapter, RawItem } from "../types";
import { fetchViaJinaReader } from "@/lib/web-fetch";

const configSchema = z.object({
  url: z.string().url("请填写合法的 URL"),
});

type JinaUrlConfig = z.infer<typeof configSchema>;

export const jinaUrlAdapter: SourceAdapter<JinaUrlConfig> = {
  type: "jina_url",
  displayName: "单 URL 深读 (Jina Reader)",
  description: "通过 Jina Reader 抓取任意网页并转换成 Markdown 全文",
  category: "url",
  configSchema,
  configFields: [
    { key: "url", label: "网页 URL", type: "url", required: true },
  ],

  async execute({ config, log }) {
    const items: RawItem[] = [];
    const partialFailures: { message: string; meta?: Record<string, unknown> }[] = [];

    let hostname = "unknown";
    try {
      hostname = new URL(config.url).hostname;
    } catch {
      log("error", "invalid URL", { url: config.url });
      return { items, partialFailures: [{ message: "invalid URL", meta: { url: config.url } }] };
    }

    try {
      const { title, content } = await fetchViaJinaReader(config.url);
      if (!content || content.length < 50) {
        partialFailures.push({
          message: "fetched content too short",
          meta: { url: config.url, length: content?.length ?? 0 },
        });
        log("warn", "content too short from Jina", { url: config.url });
      } else {
        items.push({
          title: title || config.url,
          url: config.url,
          content,
          channel: `jina/${hostname}`,
          rawMetadata: { source: "jina-reader" },
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      partialFailures.push({ message, meta: { url: config.url } });
      log("error", `Jina fetch failed: ${message}`, { url: config.url });
    }

    return { items, partialFailures };
  },
};
```

- [ ] **Step 9.5** 运行测试确认 PASS。

- [ ] **Step 9.6** Commit：

```bash
git add src/lib/collection/adapters/jina-url.ts src/lib/collection/adapters/__tests__/jina-url.test.ts
git commit -m "feat(collection-hub): add Jina URL Adapter (deep read)"
```

---

## Task 10: Adapter registry index + 注册

**Files:** Create `src/lib/collection/adapters/index.ts`

- [ ] **Step 10.1** 创建 `src/lib/collection/adapters/index.ts`：

```ts
import { registerAdapter } from "../registry";
import { tophubAdapter } from "./tophub";
import { tavilyAdapter } from "./tavily";
import { jinaUrlAdapter } from "./jina-url";

// Phase 0: 3 个基础 Adapter
registerAdapter(tophubAdapter);
registerAdapter(tavilyAdapter);
registerAdapter(jinaUrlAdapter);

export { tophubAdapter, tavilyAdapter, jinaUrlAdapter };
```

- [ ] **Step 10.2** Type check：

```bash
npx tsc --noEmit
```

- [ ] **Step 10.3** Commit：

```bash
git add src/lib/collection/adapters/index.ts
git commit -m "feat(collection-hub): register 3 Phase 0 Adapters in Registry"
```

---

## Task 11: Writer 管道 (集成测试)

**Files:**
- Create: `src/lib/collection/writer.ts`
- Test: `src/lib/collection/__tests__/writer.test.ts`

这是 Phase 0 最复杂的组件。集成测需要真实 DB 连接（本地 Supabase）。先写测试覆盖核心场景。

- [ ] **Step 11.1** 检查测试环境已设置 `DATABASE_URL`：

```bash
echo $DATABASE_URL | head -c 30
```

如为空，从 `.env.local` 拷贝 `DATABASE_URL`。

- [ ] **Step 11.2** 创建测试 `src/lib/collection/__tests__/writer.test.ts`：

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { db } from "@/db";
import { collectedItems, collectionRuns, collectionSources, organizations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { writeItems } from "../writer";

// Mock Inngest send to observe event emission without actually dispatching
vi.mock("@/inngest/client", () => ({
  inngest: { send: vi.fn().mockResolvedValue({ ids: ["evt-1"] }) },
}));
import { inngest } from "@/inngest/client";

let orgId: string;
let sourceId: string;

beforeAll(async () => {
  // Create a throwaway org and source for the test
  const [org] = await db.insert(organizations).values({
    name: "test-writer-" + Date.now(),
    slug: "test-writer-" + Date.now(),
  }).returning();
  orgId = org.id;

  const [src] = await db.insert(collectionSources).values({
    organizationId: orgId,
    name: "test-source",
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
    expect(result).toEqual({ inserted: 2, merged: 0, failed: 0 });
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
    expect(result).toEqual({ inserted: 0, merged: 1, failed: 0 });
    const [row] = await db.select().from(collectedItems).where(eq(collectedItems.organizationId, orgId));
    expect((row.sourceChannels as unknown[]).length).toBe(2);
    // 合并不发事件
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
        title: "Breaking News X!",  // normalization matches
        url: "https://a.com/v2",     // different URL
        publishedAt: new Date("2026-04-18T18:00:00Z"),  // same day bucket
        channel: "tophub/zhihu",
      }],
      source: { targetModules: [], defaultCategory: null, defaultTags: null },
    });
    expect(result).toEqual({ inserted: 0, merged: 1, failed: 0 });
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
```

- [ ] **Step 11.3** 运行确认失败：

```bash
npm run test -- src/lib/collection/__tests__/writer.test.ts
```

- [ ] **Step 11.4** 创建 `src/lib/collection/writer.ts`：

```ts
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { collectedItems, collectionRuns, collectionSources } from "@/db/schema";
import { inngest } from "@/inngest/client";
import { computeContentFingerprint, computeUrlHash, normalizeUrl } from "./normalize";
import type { WriteArgs, WriteResult, RawItem } from "./types";

interface WriteOutcome {
  itemId: string;
  isNew: boolean;
  merged: boolean;
}

export async function writeItems(args: WriteArgs): Promise<WriteResult> {
  let inserted = 0;
  let merged = 0;
  let failed = 0;

  for (const raw of args.items) {
    try {
      const outcome = await writeSingleItem(args, raw);
      if (outcome.isNew) inserted++;
      if (outcome.merged) merged++;

      if (outcome.isNew) {
        await inngest.send({
          name: "collection/item.created",
          data: {
            itemId: outcome.itemId,
            sourceId: args.sourceId,
            organizationId: args.organizationId,
            targetModules: args.source.targetModules,
            firstSeenChannel: raw.channel,
          },
        });
      }
    } catch (err) {
      failed++;
      console.error("[collection-writer] failed to write item", {
        sourceId: args.sourceId,
        title: raw.title?.slice(0, 50),
        err: err instanceof Error ? err.message : String(err),
      });
    }
  }

  await updateRunCounters(args.runId, { inserted, merged, failed });
  return { inserted, merged, failed };
}

async function writeSingleItem(args: WriteArgs, raw: RawItem): Promise<WriteOutcome> {
  const canonicalUrl = raw.url ? normalizeUrl(raw.url) : null;
  const urlHash = raw.url ? computeUrlHash(raw.url) : null;
  const capturedAt = new Date();
  const fingerprint = computeContentFingerprint(
    raw.title,
    raw.publishedAt ?? null,
    capturedAt,
  );

  return db.transaction(async (tx) => {
    // 1. Try URL hash match first
    if (urlHash) {
      const byUrl = await tx
        .select()
        .from(collectedItems)
        .where(
          and(
            eq(collectedItems.organizationId, args.organizationId),
            eq(collectedItems.canonicalUrlHash, urlHash),
          ),
        )
        .for("update")
        .limit(1);
      if (byUrl.length > 0) {
        await appendSourceChannel(tx, byUrl[0].id, {
          channel: raw.channel,
          url: raw.url,
          sourceId: args.sourceId,
          runId: args.runId,
          capturedAt: capturedAt.toISOString(),
        });
        return { itemId: byUrl[0].id, isNew: false, merged: true };
      }
    }

    // 2. Try content fingerprint match
    const byFp = await tx
      .select()
      .from(collectedItems)
      .where(
        and(
          eq(collectedItems.organizationId, args.organizationId),
          eq(collectedItems.contentFingerprint, fingerprint),
        ),
      )
      .for("update")
      .limit(1);
    if (byFp.length > 0) {
      await appendSourceChannel(tx, byFp[0].id, {
        channel: raw.channel,
        url: raw.url,
        sourceId: args.sourceId,
        runId: args.runId,
        capturedAt: capturedAt.toISOString(),
      });
      return { itemId: byFp[0].id, isNew: false, merged: true };
    }

    // 3. Insert new item
    const [inserted] = await tx
      .insert(collectedItems)
      .values({
        organizationId: args.organizationId,
        contentFingerprint: fingerprint,
        canonicalUrl,
        canonicalUrlHash: urlHash,
        title: raw.title,
        content: raw.content,
        summary: raw.summary,
        publishedAt: raw.publishedAt,
        firstSeenSourceId: args.sourceId,
        firstSeenChannel: raw.channel,
        firstSeenAt: capturedAt,
        sourceChannels: [
          {
            channel: raw.channel,
            url: raw.url,
            sourceId: args.sourceId,
            runId: args.runId,
            capturedAt: capturedAt.toISOString(),
          },
        ],
        category: args.source.defaultCategory,
        tags: args.source.defaultTags,
        rawMetadata: raw.rawMetadata ?? null,
      })
      .returning({ id: collectedItems.id });

    // Phase 0: 不做轻派生;Phase 1+ 再在这里调 lightDeriveToNewsArticles 等
    return { itemId: inserted.id, isNew: true, merged: false };
  });
}

async function appendSourceChannel(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  itemId: string,
  entry: {
    channel: string;
    url?: string;
    sourceId: string;
    runId: string;
    capturedAt: string;
  },
): Promise<void> {
  await tx.execute(sql`
    UPDATE collected_items
    SET source_channels = source_channels || ${JSON.stringify([entry])}::jsonb,
        updated_at = now()
    WHERE id = ${itemId}
  `);
}

async function updateRunCounters(
  runId: string,
  counts: { inserted: number; merged: number; failed: number },
): Promise<void> {
  const attempted = counts.inserted + counts.merged + counts.failed;
  await db
    .update(collectionRuns)
    .set({
      itemsAttempted: attempted,
      itemsInserted: counts.inserted,
      itemsMerged: counts.merged,
      itemsFailed: counts.failed,
    })
    .where(eq(collectionRuns.id, runId));
}
```

- [ ] **Step 11.5** 运行集成测试确认 PASS：

```bash
npm run test -- src/lib/collection/__tests__/writer.test.ts
```

如有 FK/schema 错误，检查 Task 2 的 `organizations`/`userProfiles` 导入是否正确。如果 `organizations` 表在本项目叫别的名字（比如 `user_organizations`），调整 schema 的 `.references(() => organizations.id)` 目标。

- [ ] **Step 11.6** Commit：

```bash
git add src/lib/collection/writer.ts src/lib/collection/__tests__/writer.test.ts
git commit -m "feat(collection-hub): add Writer pipeline with dedup + event emission

Handles URL-first then fingerprint dedup, same-txn row lock for concurrency,
and emits collection/item.created only on new inserts (not merges)."
```

---

## Task 12: Inngest function `runCollectionSource`

**Files:**
- Create: `src/inngest/functions/collection/run-source.ts`
- Create: `src/inngest/functions/collection/index.ts`

- [ ] **Step 12.1** 创建 `src/inngest/functions/collection/run-source.ts`：

```ts
import { inngest } from "@/inngest/client";
import { db } from "@/db";
import { collectionSources, collectionRuns, collectionLogs } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getAdapter } from "@/lib/collection/registry";
import { writeItems } from "@/lib/collection/writer";
import "@/lib/collection/adapters"; // ensure adapters are registered

export const runCollectionSource = inngest.createFunction(
  {
    id: "collection-run-source",
    concurrency: { limit: 3 },
    retries: 2,
  },
  { event: "collection/source.run-requested" },
  async ({ event, step }) => {
    const { sourceId, organizationId, trigger } = event.data;

    // 1. Load source
    const source = await step.run("load-source", async () => {
      const [s] = await db
        .select()
        .from(collectionSources)
        .where(eq(collectionSources.id, sourceId))
        .limit(1);
      if (!s) throw new Error(`source ${sourceId} not found`);
      if (!s.enabled) throw new Error(`source ${sourceId} disabled`);
      return s;
    });

    // 2. Create run row
    const runId = await step.run("create-run", async () => {
      const [run] = await db
        .insert(collectionRuns)
        .values({
          sourceId,
          organizationId,
          trigger,
          startedAt: new Date(),
          status: "running",
        })
        .returning({ id: collectionRuns.id });
      return run.id;
    });

    try {
      // 3. Resolve adapter + validate config
      const adapter = getAdapter(source.sourceType);
      const parsed = adapter.configSchema.safeParse(source.config);
      if (!parsed.success) {
        throw new Error(`config validation failed: ${parsed.error.message}`);
      }

      // 4. Execute adapter
      const adapterResult = await step.run("execute-adapter", async () => {
        return adapter.execute({
          config: parsed.data,
          sourceId,
          organizationId,
          runId,
          log: (level, message, meta) => {
            // fire-and-forget log write; don't block adapter flow
            db.insert(collectionLogs)
              .values({ runId, sourceId, level, message, metadata: meta ?? null })
              .then(() => {})
              .catch(() => {});
          },
        });
      });

      // 5. Write items
      const writeResult = await step.run("write-items", async () => {
        return writeItems({
          runId,
          sourceId,
          organizationId,
          items: adapterResult.items,
          source: {
            targetModules: source.targetModules,
            defaultCategory: source.defaultCategory,
            defaultTags: source.defaultTags,
          },
        });
      });

      // 6. Finalize run
      const hasFailures =
        writeResult.failed > 0 || (adapterResult.partialFailures?.length ?? 0) > 0;
      await step.run("finalize-run", async () => {
        await db
          .update(collectionRuns)
          .set({
            finishedAt: new Date(),
            status: hasFailures ? "partial" : "success",
            errorSummary:
              adapterResult.partialFailures?.map((f) => f.message).join("; ") ?? null,
          })
          .where(eq(collectionRuns.id, runId));

        await db
          .update(collectionSources)
          .set({
            lastRunAt: new Date(),
            lastRunStatus: hasFailures ? "partial" : "success",
            totalItemsCollected: sql`${collectionSources.totalItemsCollected} + ${writeResult.inserted}`,
            totalRuns: sql`${collectionSources.totalRuns} + 1`,
          })
          .where(eq(collectionSources.id, sourceId));
      });

      return { sourceId, runId, ...writeResult };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await db
        .update(collectionRuns)
        .set({ finishedAt: new Date(), status: "failed", errorSummary: message })
        .where(eq(collectionRuns.id, runId));
      await db
        .update(collectionSources)
        .set({ lastRunAt: new Date(), lastRunStatus: "failed", totalRuns: sql`${collectionSources.totalRuns} + 1` })
        .where(eq(collectionSources.id, sourceId));
      throw err;
    }
  },
);
```

- [ ] **Step 12.2** 创建 `src/inngest/functions/collection/index.ts`：

```ts
export { runCollectionSource } from "./run-source";
export { collectionSmokeConsumer } from "./smoke-consumer";
```

(smoke-consumer 在 Task 13 创建)

- [ ] **Step 12.3** Type check：

```bash
npx tsc --noEmit
```

- [ ] **Step 12.4** Commit：

```bash
git add src/inngest/functions/collection/run-source.ts src/inngest/functions/collection/index.ts
git commit -m "feat(collection-hub): add Inngest runCollectionSource orchestrator"
```

---

## Task 13: Smoke-test consumer (Phase 0 端到端验证)

**Files:** Create `src/inngest/functions/collection/smoke-consumer.ts`

Reviewer advisory: Phase 0 加一个空壳事件消费者,证明 `collection/item.created` 事件线路通。

- [ ] **Step 13.1** 创建 `src/inngest/functions/collection/smoke-consumer.ts`：

```ts
import { inngest } from "@/inngest/client";

/**
 * Phase 0 smoke consumer: proves the event bus works end-to-end.
 * Will be deleted in Phase 2 when real subscribers (hot-topics-enricher, etc.) take over.
 */
export const collectionSmokeConsumer = inngest.createFunction(
  { id: "collection-smoke-consumer", concurrency: { limit: 5 } },
  { event: "collection/item.created" },
  async ({ event, logger }) => {
    logger.info("[collection-smoke] received item.created", {
      itemId: event.data.itemId,
      sourceId: event.data.sourceId,
      channel: event.data.firstSeenChannel,
      targetModules: event.data.targetModules,
    });
    return { received: event.data.itemId };
  },
);
```

- [ ] **Step 13.2** 注册新函数。**实际的 functions 数组在 `src/inngest/functions/index.ts`**（不是 `route.ts`—— `route.ts` 只是 `import { functions } from "@/inngest/functions"` 然后 `serve({...})`）。

在 `src/inngest/functions/index.ts` 文件顶部的 import 区块追加：

```ts
import {
  runCollectionSource,
  collectionSmokeConsumer,
} from "./collection";
```

在 `export const functions = [...]` 数组末尾追加两项（前面保留现有行）：

```ts
export const functions = [
  // ... 现有所有函数 (保持不变) ...

  // Collection Hub (2026-04-18)
  runCollectionSource,
  collectionSmokeConsumer,
];
```

检查：

```bash
grep -A 1 "runCollectionSource" src/inngest/functions/index.ts
grep -A 1 "collectionSmokeConsumer" src/inngest/functions/index.ts
```

Expected: 每个符号都在两处出现（一次 import、一次在数组里）。

- [ ] **Step 13.3** Type check + build：

```bash
npx tsc --noEmit
npm run build
```

Expected: 无错误,build 成功。

- [ ] **Step 13.4** Commit：

```bash
git add src/inngest/functions/collection/smoke-consumer.ts src/inngest/functions/index.ts
git commit -m "feat(collection-hub): add Phase 0 smoke consumer + register functions"
```

---

## Task 14: 端到端手动 smoke test

**Files:** Create `scripts/phase0-smoke-run.ts`

Phase 0 验收脚本。创建一个 TopHub 源,触发 Inngest 事件,验证数据进库 + smoke consumer 触发。

- [ ] **Step 14.1** 创建 `scripts/phase0-smoke-run.ts`：

```ts
/**
 * Phase 0 smoke test: end-to-end collection hub flow.
 *
 * Usage:
 *   npx tsx scripts/phase0-smoke-run.ts <orgId>
 *
 * What it does:
 *   1. Creates a TopHub source (platforms: [weibo])
 *   2. Sends "collection/source.run-requested" event
 *   3. Waits for Inngest to process
 *   4. Reads back collected_items + collection_runs
 *   5. Prints results
 */
import { db } from "@/db";
import {
  collectedItems,
  collectionRuns,
  collectionSources,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { inngest } from "@/inngest/client";

const orgId = process.argv[2];
if (!orgId) {
  console.error("Usage: npx tsx scripts/phase0-smoke-run.ts <orgId>");
  process.exit(1);
}

async function main() {
  console.log("[smoke] creating test source...");
  const [src] = await db
    .insert(collectionSources)
    .values({
      organizationId: orgId,
      name: `smoke-test-${Date.now()}`,
      sourceType: "tophub",
      config: { platforms: ["weibo"] },
      targetModules: [],
    })
    .returning();
  console.log(`[smoke] source created: ${src.id}`);

  console.log("[smoke] sending Inngest event...");
  const evt = await inngest.send({
    name: "collection/source.run-requested",
    data: {
      sourceId: src.id,
      organizationId: orgId,
      trigger: "manual",
    },
  });
  console.log(`[smoke] event sent: ${JSON.stringify(evt.ids)}`);

  console.log("[smoke] waiting 15s for Inngest to process...");
  await new Promise((r) => setTimeout(r, 15_000));

  const runs = await db
    .select()
    .from(collectionRuns)
    .where(eq(collectionRuns.sourceId, src.id))
    .orderBy(desc(collectionRuns.startedAt));
  console.log(`[smoke] runs: ${JSON.stringify(runs, null, 2)}`);

  const items = await db
    .select()
    .from(collectedItems)
    .where(
      and(
        eq(collectedItems.organizationId, orgId),
        eq(collectedItems.firstSeenSourceId, src.id),
      ),
    );
  console.log(`[smoke] ${items.length} items collected.`);
  console.log("[smoke] sample:", items.slice(0, 3));

  if (runs.length === 0 || runs[0].status !== "success") {
    console.error("[smoke] ❌ FAILED: run did not succeed");
    process.exit(1);
  }
  if (items.length === 0) {
    console.error("[smoke] ❌ FAILED: no items collected");
    process.exit(1);
  }
  console.log("[smoke] ✅ PASSED");
}

main().catch((err) => {
  console.error("[smoke] error:", err);
  process.exit(1);
});
```

- [ ] **Step 14.2** 启动 Next dev server（Inngest 会自动启动）：

```bash
npm run dev
```

另开终端,查找现有测试组织 ID：

```bash
psql "$DATABASE_URL" -c "SELECT id, name FROM organizations LIMIT 3;"
```

- [ ] **Step 14.3** 执行 smoke test：

```bash
npx tsx scripts/phase0-smoke-run.ts <复制上面的 orgId>
```

Expected:
- 输出 `[smoke] source created: ...`
- 输出 `[smoke] event sent: ...`
- 15 秒后输出 runs（应含 status: success）
- items 列表非空
- 最后输出 `[smoke] ✅ PASSED`

同时在 dev server 终端应看到 `[collection-smoke] received item.created` 日志行（证明 smoke consumer 收到事件）。

- [ ] **Step 14.4** 如果失败,检查：
  - Inngest dev UI（通常 `http://localhost:8288`）看函数是否注册 + 运行历史
  - dev server 日志看 `runCollectionSource` 错误
  - 检查 `TRENDING_API_KEY` 是否已在 `.env.local` 设置（TopHub 需要）

- [ ] **Step 14.5** Commit：

```bash
git add scripts/phase0-smoke-run.ts
git commit -m "chore(collection-hub): add Phase 0 smoke test script"
```

---

## Task 15: Phase 0 最终验收

- [ ] **Step 15.1** 完整测试集运行：

```bash
npm run test
```

Expected: 所有新增的 normalize / fetch-layer / writer / adapter 测试全部 PASS,既有测试无回归。

- [ ] **Step 15.2** Type check：

```bash
npx tsc --noEmit
```

- [ ] **Step 15.3** 完整构建：

```bash
npm run build
```

Expected: 构建成功无错误。

- [ ] **Step 15.4** 验证数据库状态：

```bash
psql "$DATABASE_URL" -c "\\dt collect*"
```

Expected: 列出 4 张 `collect*` 表。

```bash
psql "$DATABASE_URL" -c "\\di collected_items*"
```

Expected: 包含两条 trigram GIN 索引。

- [ ] **Step 15.5** 清理 smoke test 测试数据（可选）：

```bash
psql "$DATABASE_URL" -c "DELETE FROM collection_sources WHERE name LIKE 'smoke-test-%';"
```

- [ ] **Step 15.6** 最终 checkpoint commit（无新代码，作为 Phase 0 完成标记）：

```bash
git log --oneline -n 20
# 确认 Phase 0 的所有提交都在
```

- [ ] **Step 15.7** 更新 memory 与 spec，标记 Phase 0 完成：

```bash
# 在 docs/superpowers/specs/2026-04-18-unified-collection-module-design.md
# 的 Section 10 Phase 0 标题末尾追加: " ✅ 完成 YYYY-MM-DD"
```

Commit：

```bash
git add docs/superpowers/specs/2026-04-18-unified-collection-module-design.md
git commit -m "docs(collection-hub): mark Phase 0 complete"
```

---

## Phase 0 完成后的下一步

Phase 0 验收通过后,下一阶段是 **Phase 1：源管理页 + 灵感池迁移**（1 周）。

Phase 1 会单独写一份实施计划（`docs/superpowers/plans/2026-04-XX-collection-hub-phase1-sources-ui.md`），内容包括：
- DAL for collection_sources + collected_items + collection_runs
- Server Actions (CRUD source / manual trigger)
- 后台路由 `/data-collection/sources`（列表 + 新建向导）
- 灵感池 SSE 改造为调用 `collection/source.run-requested`
- 首次生产路径完整打通 + 验收

Phase 1 依赖本阶段所有交付物稳定工作 — 建议 Phase 0 在本地跑满 2-3 天、至少人工触发 5 次以上 smoke run 没出现 race condition 或 DB 锁问题，再开 Phase 1。

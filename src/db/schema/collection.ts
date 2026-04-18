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
    // trigram 全文索引 — pg_trgm 扩展必须已启用 (见 0022 migration)
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

import { relations, sql } from "drizzle-orm";
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
import { organizations, userProfiles } from "./users";

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
    outletId: uuid("outlet_id"),
    defaultOutletTier: text("default_outlet_tier"),
    defaultOutletRegion: text("default_outlet_region"),
  },
  (t) => ({
    uniqueOrgName: unique("collection_sources_org_name_unique").on(t.organizationId, t.name),
    enabledIdx: index("collection_sources_org_enabled_idx").on(t.organizationId, t.enabled),
    cronIdx: index("collection_sources_cron_idx").on(t.scheduleCron).where(sql`enabled = true`),
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
    /** 首屏摘要(舆情系统的"内容摘要"列、RSS 的 summary 等)。详情正文在 collected_item_contents 副表。 */
    summary: text("summary"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    firstSeenSourceId: uuid("first_seen_source_id").references(() => collectionSources.id, {
      onDelete: "set null",
    }),
    firstSeenChannel: text("first_seen_channel").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull(),
    sourceChannels: jsonb("source_channels")
      .$type<Array<{
        channel: string;
        url?: string;
        sourceId: string;
        runId: string;
        capturedAt: string;
      }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    /** 行业/业务分类,多值(对接舆情数据"行业分类":"公安, 政务")。 */
    category: text("category").array().notNull().default(sql`ARRAY[]::text[]`),
    tags: text("tags").array(),
    language: text("language"),
    derivedModules: text("derived_modules").array().notNull().default(sql`ARRAY[]::text[]`),
    rawMetadata: jsonb("raw_metadata"),
    enrichmentStatus: text("enrichment_status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    contentType: text("content_type").notNull().default("image_text"),
    attachments: jsonb("attachments")
      .$type<Array<{
        kind: "video" | "image" | "audio" | "thumbnail";
        url: string;
        thumbnailUrl?: string;
        mimeType?: string;
        durationMs?: number;
        width?: number;
        height?: number;
        fileSizeBytes?: number;
        extra?: Record<string, unknown>;
      }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    outletId: uuid("outlet_id"),
    outletTier: text("outlet_tier"),
    outletRegion: text("outlet_region"),

    // ── 平台/账号/身份 ──
    externalId: text("external_id"),
    platform: text("platform"),
    author: text("author"),
    accountId: text("account_id"),
    accountHandle: text("account_handle"),
    authorFollowerCount: integer("author_follower_count"),

    // ── 舆情属性 ──
    sentiment: text("sentiment"),
    infoType: text("info_type"),

    // ── 互动指标 ──
    likeCount: integer("like_count").notNull().default(0),
    commentCount: integer("comment_count").notNull().default(0),
    shareCount: integer("share_count").notNull().default(0),
    viewCount: integer("view_count").notNull().default(0),
    favoriteCount: integer("favorite_count").notNull().default(0),
    replyCount: integer("reply_count").notNull().default(0),

    // ── 稿件级地域(跟 outlet_region 是不同语义) ──
    ipRegion: text("ip_region"),
    postRegion: text("post_region"),
    mentionedRegions: text("mentioned_regions").array(),

    // ── 命中分析 ──
    matchedKeywords: text("matched_keywords").array(),
    matchedRegions: text("matched_regions").array(),

    // ── 行业(多值);跟单值 industry 不同,行业分类如["公安","政务"] ──
    industries: text("industries").array(),

    // ── 媒体附加 ──
    coverImageUrl: text("cover_image_url"),
    durationSeconds: integer("duration_seconds"),
  },
  (t) => ({
    uniqueFingerprint: unique("collected_items_org_fp_unique").on(
      t.organizationId,
      t.contentFingerprint,
    ),
    pubIdx: index("collected_items_org_pub_idx").on(t.organizationId, t.publishedAt),
    firstSeenIdx: index("collected_items_org_first_seen_idx").on(
      t.organizationId,
      sql`${t.firstSeenAt} DESC`,
    ),
    urlHashIdx: index("collected_items_url_hash_idx").on(t.canonicalUrlHash).where(sql`canonical_url_hash IS NOT NULL`),
    // category 变多值后用 GIN(单值的 btree 索引已废)
    categoryGin: index("collected_items_category_gin").using("gin", t.category),
    tagsIdx: index("collected_items_tags_gin").using("gin", t.tags),
    derivedIdx: index("collected_items_derived_gin").using("gin", t.derivedModules),
    industriesGin: index("collected_items_industries_gin").using("gin", t.industries),
    mentionedGin: index("collected_items_mentioned_regions_gin").using("gin", t.mentionedRegions),
    matchedKwGin: index("collected_items_matched_keywords_gin").using("gin", t.matchedKeywords),
    matchedRegionGin: index("collected_items_matched_regions_gin").using("gin", t.matchedRegions),
    // trigram 全文索引 — pg_trgm 扩展必须已启用 (见 0022 migration)
    // content trigram 已迁到 collected_item_contents 副表,主表只保留 title trigram
    titleTrgmIdx: index("collected_items_title_trgm").using(
      "gin",
      sql`${t.title} gin_trgm_ops`,
    ),
    contentTypeIdx: index("collected_items_content_type_idx").on(t.organizationId, t.contentType),
    outletTierIdx: index("collected_items_outlet_tier_idx").on(t.organizationId, t.outletTier),
    outletIdIdx: index("collected_items_outlet_id_idx").on(t.outletId),

    // 舆情维度索引
    authorIdx: index("collected_items_org_author_idx").on(t.organizationId, t.author),
    accountIdx: index("collected_items_org_account_idx").on(t.organizationId, t.accountId),
    platformIdx: index("collected_items_org_platform_idx").on(t.organizationId, t.platform),
    sentimentIdx: index("collected_items_org_sentiment_idx").on(t.organizationId, t.sentiment),
    ipRegionIdx: index("collected_items_org_ip_region_idx").on(t.organizationId, t.ipRegion),
    postRegionIdx: index("collected_items_org_post_region_idx").on(t.organizationId, t.postRegion),
    externalIdIdx: index("collected_items_org_external_id_idx").on(t.organizationId, t.externalId),
    likeRankIdx: index("collected_items_org_like_idx").on(t.organizationId, sql`${t.likeCount} DESC`),
  }),
);

// ───────────────────────────────────────────────────────────
// ②.5 正文表(1:1 拆出): 把可能很长的正文从主表移出,主表保持轻量。
// ───────────────────────────────────────────────────────────
// 设计要点:
// - item_id 是 PK 也是 FK,1:1 关系。ON DELETE CASCADE 跟主表同步。
// - content 列在 PG14+ 用 LZ4 压缩(migration 里手写 ALTER COLUMN SET COMPRESSION)。
// - content trigram GIN 索引保留在此副表(Q2=A 兜底任意关键词搜索)。
//   主表上的旧 contentTrgmIdx 已删,索引膨胀只发生在副表。
// - 列表/筛选/排序查询绝不读此表,只在详情页 JOIN。
export const collectedItemContents = pgTable(
  "collected_item_contents",
  {
    itemId: uuid("item_id")
      .primaryKey()
      .references(() => collectedItems.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    /** 视频/图片 OCR 文本(舆情系统提取);LZ4 压缩;trigram 索引保留兜底全文搜索。 */
    ocrText: text("ocr_text"),
    /** 音视频 ASR 转写文本;LZ4 压缩;trigram 索引保留兜底全文搜索。 */
    asrText: text("asr_text"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    contentTrgmIdx: index("collected_item_contents_content_trgm").using(
      "gin",
      sql`${t.content} gin_trgm_ops`,
    ),
    ocrTrgmIdx: index("collected_item_contents_ocr_trgm")
      .using("gin", sql`${t.ocrText} gin_trgm_ops`)
      .where(sql`ocr_text IS NOT NULL`),
    asrTrgmIdx: index("collected_item_contents_asr_trgm")
      .using("gin", sql`${t.asrText} gin_trgm_ops`)
      .where(sql`asr_text IS NOT NULL`),
  }),
);

export const collectedItemContentsRelations = relations(collectedItemContents, ({ one }) => ({
  item: one(collectedItems, {
    fields: [collectedItemContents.itemId],
    references: [collectedItems.id],
  }),
}));

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

// ───────────────────────────────────────────────────────────
// Relations
// ───────────────────────────────────────────────────────────
export const collectionSourcesRelations = relations(collectionSources, ({ many }) => ({
  runs: many(collectionRuns),
  items: many(collectedItems),
}));

export const collectedItemsRelations = relations(collectedItems, ({ one }) => ({
  firstSeenSource: one(collectionSources, {
    fields: [collectedItems.firstSeenSourceId],
    references: [collectionSources.id],
  }),
}));

export const collectionRunsRelations = relations(collectionRuns, ({ one, many }) => ({
  source: one(collectionSources, {
    fields: [collectionRuns.sourceId],
    references: [collectionSources.id],
  }),
  logs: many(collectionLogs),
}));

export const collectionLogsRelations = relations(collectionLogs, ({ one }) => ({
  run: one(collectionRuns, {
    fields: [collectionLogs.runId],
    references: [collectionRuns.id],
  }),
}));

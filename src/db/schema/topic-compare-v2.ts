import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  real,
  boolean,
  unique,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { organizations } from "./users";
import { articles } from "./articles";
import {
  myAccountPlatformEnum,
  benchmarkAccountLevelEnum,
  topicMatchDecisionEnum,
} from "./enums";

// ---------------------------------------------------------------------------
// my_accounts — 我方账号绑定
// ---------------------------------------------------------------------------

export const myAccounts = pgTable(
  "my_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    platform: myAccountPlatformEnum("platform").notNull(),
    handle: text("handle").notNull(),
    name: text("name").notNull(),
    avatarUrl: text("avatar_url"),
    description: text("description"),
    accountUrl: text("account_url"),

    crawlConfig: jsonb("crawl_config").default({}),
    crawlStatus: text("crawl_status").default("manual"),
    lastCrawledAt: timestamp("last_crawled_at", { withTimezone: true }),

    postCount: integer("post_count").default(0),
    followerCount: integer("follower_count"),
    notes: text("notes"),

    isEnabled: boolean("is_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgPlatformHandleUnique: unique("my_accounts_org_platform_handle_uniq").on(
      t.organizationId,
      t.platform,
      t.handle,
    ),
    orgPlatformIdx: index("idx_my_accounts_org_platform").on(t.organizationId, t.platform),
    orgEnabledIdx: index("idx_my_accounts_org_enabled").on(t.organizationId, t.isEnabled),
  }),
);

// ---------------------------------------------------------------------------
// my_posts — 我方原始稿件
// ---------------------------------------------------------------------------

export const myPosts = pgTable(
  "my_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    title: text("title").notNull(),
    summary: text("summary"),
    body: text("body"),
    topic: text("topic"),
    contentFingerprint: text("content_fingerprint"),

    internalArticleId: uuid("internal_article_id").references(() => articles.id, {
      onDelete: "set null",
    }),

    originalAuthor: text("original_author"),
    originalSourceUrl: text("original_source_url"),
    publishedAt: timestamp("published_at", { withTimezone: true }),

    totalViews: integer("total_views").default(0),
    totalLikes: integer("total_likes").default(0),
    totalShares: integer("total_shares").default(0),
    totalComments: integer("total_comments").default(0),
    statsAggregatedAt: timestamp("stats_aggregated_at", { withTimezone: true }),

    dimensionScores: jsonb("dimension_scores"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgPubIdx: index("idx_my_posts_org_published").on(t.organizationId, t.publishedAt),
    orgTopicIdx: index("idx_my_posts_org_topic").on(t.organizationId, t.topic),
    orgFingerprintIdx: index("idx_my_posts_org_fingerprint").on(
      t.organizationId,
      t.contentFingerprint,
    ),
    articleIdx: index("idx_my_posts_article_id").on(t.internalArticleId),
    titleTrgmIdx: index("idx_my_posts_title_trgm").using(
      "gin",
      sql`${t.title} gin_trgm_ops`,
    ),
  }),
);

// ---------------------------------------------------------------------------
// my_post_distributions — 一稿多发
// ---------------------------------------------------------------------------

export const myPostDistributions = pgTable(
  "my_post_distributions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    myPostId: uuid("my_post_id")
      .notNull()
      .references(() => myPosts.id, { onDelete: "cascade" }),
    myAccountId: uuid("my_account_id")
      .notNull()
      .references(() => myAccounts.id, { onDelete: "cascade" }),

    publishedUrl: text("published_url"),
    publishedAt: timestamp("published_at", { withTimezone: true }),

    views: integer("views").default(0),
    likes: integer("likes").default(0),
    shares: integer("shares").default(0),
    comments: integer("comments").default(0),
    rawMetadata: jsonb("raw_metadata"),

    collectedAt: timestamp("collected_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uq: unique("my_post_dist_post_account_uniq").on(t.myPostId, t.myAccountId),
    postIdx: index("idx_my_post_dist_post").on(t.myPostId),
    accountIdx: index("idx_my_post_dist_account").on(t.myAccountId),
  }),
);

// ---------------------------------------------------------------------------
// benchmark_accounts — 对标账号池
// ---------------------------------------------------------------------------

export const benchmarkAccounts = pgTable(
  "benchmark_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),

    platform: myAccountPlatformEnum("platform").notNull(),
    level: benchmarkAccountLevelEnum("level").notNull(),
    handle: text("handle").notNull(),
    name: text("name").notNull(),
    avatarUrl: text("avatar_url"),
    description: text("description"),
    accountUrl: text("account_url"),

    region: text("region"),
    isPreset: boolean("is_preset").notNull().default(false),
    isEnabled: boolean("is_enabled").notNull().default(true),

    lastCrawledAt: timestamp("last_crawled_at", { withTimezone: true }),
    postCount: integer("post_count").default(0),

    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // 用 uniqueIndex 而非 unique 约束 —— DB 里实际是 unique index（migration
    // 20260421000004 用 CONSTRAINT UNIQUE 创建会同时建 pg_index entry）。
    // drizzle-kit push 的 introspection 对 unique() 检测有 false-positive，
    // 改用 uniqueIndex 与 DB 形态完全一致，避免反复弹"add constraint"提示。
    uq: uniqueIndex("uq_benchmark_acc_global").on(t.platform, t.handle, t.organizationId),
    platLevelIdx: index("idx_benchmark_acc_platform_level").on(t.platform, t.level),
    enabledIdx: index("idx_benchmark_acc_enabled").on(t.isEnabled),
    // partial index：与 migration 20260421000004 保持一致。drizzle 的 .where()
    // 必须显式声明，否则 push 会以为 schema 改了非 partial → 弹另一个 drift 提示。
    orgIdx: index("idx_benchmark_acc_org")
      .on(t.organizationId)
      .where(sql`${t.organizationId} IS NOT NULL`),
  }),
);

// ---------------------------------------------------------------------------
// benchmark_posts — 对标账号帖子
// ---------------------------------------------------------------------------

export const benchmarkPosts = pgTable(
  "benchmark_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    benchmarkAccountId: uuid("benchmark_account_id")
      .notNull()
      .references(() => benchmarkAccounts.id, { onDelete: "cascade" }),

    title: text("title").notNull(),
    summary: text("summary"),
    body: text("body"),
    sourceUrl: text("source_url"),
    topic: text("topic"),
    contentFingerprint: text("content_fingerprint"),

    publishedAt: timestamp("published_at", { withTimezone: true }),

    views: integer("views").default(0),
    likes: integer("likes").default(0),
    shares: integer("shares").default(0),
    comments: integer("comments").default(0),
    rawMetadata: jsonb("raw_metadata"),

    aiInterpretation: jsonb("ai_interpretation"),
    aiInterpretationAt: timestamp("ai_interpretation_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    accountPubIdx: index("idx_benchmark_posts_account_pub").on(t.benchmarkAccountId, t.publishedAt),
    pubIdx: index("idx_benchmark_posts_pub").on(t.publishedAt),
    fingerprintIdx: index("idx_benchmark_posts_fingerprint").on(t.contentFingerprint),
    titleTrgmIdx: index("idx_benchmark_posts_title_trgm").using(
      "gin",
      sql`${t.title} gin_trgm_ops`,
    ),
    bodyTrgmIdx: index("idx_benchmark_posts_body_trgm").using(
      "gin",
      sql`${t.body} gin_trgm_ops`,
    ),
  }),
);

// ---------------------------------------------------------------------------
// topic_matches — 同题匹配 + 10 维分析缓存
// ---------------------------------------------------------------------------

export const topicMatches = pgTable(
  "topic_matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    myPostId: uuid("my_post_id")
      .notNull()
      .references(() => myPosts.id, { onDelete: "cascade" }),

    benchmarkPostIds: jsonb("benchmark_post_ids").$type<string[]>().notNull().default([]),
    matchCount: integer("match_count").notNull().default(0),

    similarityScore: real("similarity_score"),
    matchedBy: text("matched_by").notNull().default("llm"),
    matchedReasons: jsonb("matched_reasons"),

    aiAnalysis: jsonb("ai_analysis"),
    aiAnalysisVersion: integer("ai_analysis_version").default(1),
    aiAnalysisSource: text("ai_analysis_source"),
    aiAnalysisAt: timestamp("ai_analysis_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    radarData: jsonb("radar_data"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uqMyPost: unique("topic_matches_my_post_uniq").on(t.myPostId),
    orgIdx: index("idx_topic_matches_org").on(t.organizationId),
    expiresIdx: index("idx_topic_matches_expires").on(t.organizationId, t.expiresAt),
  }),
);

// ---------------------------------------------------------------------------
// missed_topics — 重建极简版
// ---------------------------------------------------------------------------

export const missedTopics = pgTable(
  "missed_topics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),

    primaryBenchmarkPostId: uuid("primary_benchmark_post_id")
      .notNull()
      .references(() => benchmarkPosts.id, { onDelete: "cascade" }),
    relatedBenchmarkPostIds: jsonb("related_benchmark_post_ids")
      .$type<string[]>()
      .default([]),

    title: text("title").notNull(),
    topic: text("topic"),
    contentFingerprint: text("content_fingerprint"),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
    heatScore: real("heat_score").default(0),

    decision: topicMatchDecisionEnum("decision").notNull().default("suspected"),
    matchedMyPostId: uuid("matched_my_post_id").references(() => myPosts.id, {
      onDelete: "set null",
    }),
    matchedMyPostTitleSnapshot: text("matched_my_post_title_snapshot"),

    excludedReasonCode: text("excluded_reason_code"),
    excludedReasonText: text("excluded_reason_text"),
    confirmedBy: uuid("confirmed_by"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),

    pushStatus: text("push_status").notNull().default("not_pushed"),
    pushedAt: timestamp("pushed_at", { withTimezone: true }),
    pushErrorMessage: text("push_error_message"),
    pushPayload: jsonb("push_payload"),

    aiSummary: jsonb("ai_summary"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uqFingerprint: unique("missed_topics_org_fingerprint_uniq").on(
      t.organizationId,
      t.contentFingerprint,
    ),
    orgDecisionIdx: index("idx_missed_topics_org_decision").on(t.organizationId, t.decision),
    orgDiscoveredIdx: index("idx_missed_topics_org_discovered").on(
      t.organizationId,
      t.discoveredAt,
    ),
  }),
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const myAccountsRelations = relations(myAccounts, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [myAccounts.organizationId],
    references: [organizations.id],
  }),
  distributions: many(myPostDistributions),
}));

export const myPostsRelations = relations(myPosts, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [myPosts.organizationId],
    references: [organizations.id],
  }),
  article: one(articles, {
    fields: [myPosts.internalArticleId],
    references: [articles.id],
  }),
  distributions: many(myPostDistributions),
  topicMatch: one(topicMatches, {
    fields: [myPosts.id],
    references: [topicMatches.myPostId],
  }),
}));

export const myPostDistributionsRelations = relations(myPostDistributions, ({ one }) => ({
  post: one(myPosts, {
    fields: [myPostDistributions.myPostId],
    references: [myPosts.id],
  }),
  account: one(myAccounts, {
    fields: [myPostDistributions.myAccountId],
    references: [myAccounts.id],
  }),
}));

export const benchmarkAccountsRelations = relations(benchmarkAccounts, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [benchmarkAccounts.organizationId],
    references: [organizations.id],
  }),
  posts: many(benchmarkPosts),
}));

export const benchmarkPostsRelations = relations(benchmarkPosts, ({ one }) => ({
  account: one(benchmarkAccounts, {
    fields: [benchmarkPosts.benchmarkAccountId],
    references: [benchmarkAccounts.id],
  }),
}));

export const topicMatchesRelations = relations(topicMatches, ({ one }) => ({
  organization: one(organizations, {
    fields: [topicMatches.organizationId],
    references: [organizations.id],
  }),
  myPost: one(myPosts, {
    fields: [topicMatches.myPostId],
    references: [myPosts.id],
  }),
}));

export const missedTopicsRelations = relations(missedTopics, ({ one }) => ({
  organization: one(organizations, {
    fields: [missedTopics.organizationId],
    references: [organizations.id],
  }),
  primaryPost: one(benchmarkPosts, {
    fields: [missedTopics.primaryBenchmarkPostId],
    references: [benchmarkPosts.id],
  }),
  matchedMyPost: one(myPosts, {
    fields: [missedTopics.matchedMyPostId],
    references: [myPosts.id],
  }),
}));

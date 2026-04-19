import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";
import { articles } from "./articles";
import { cmsPublicationStateEnum } from "./enums";

// =====================================================================
// cms_publications — article → CMS 入稿流水
// 设计文档 §11.3
// Phase 1 CMS Adapter MVP — Task 11
//
// 单条记录代表一次 article 向 CMS 的入稿尝试，包含：
//   - 请求/响应 payload 及 hash（幂等/审计）
//   - 状态机（cms_publication_state 枚举，6 态）
//   - 重试 / 错误诊断字段
//   - CMS 侧落地 id + 预览 / 发布 URL（submitted 态后写入）
// =====================================================================

export const cmsPublications = pgTable(
  "cms_publications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    articleId: uuid("article_id")
      .references(() => articles.id)
      .notNull(),
    appChannelSlug: text("app_channel_slug").notNull(),

    cmsArticleId: text("cms_article_id"),
    cmsCatalogId: text("cms_catalog_id"),
    cmsSiteId: integer("cms_site_id"),
    cmsState: cmsPublicationStateEnum("cms_state").notNull().default("submitting"),
    cmsType: integer("cms_type"), // 1 / 2 / 4 / 5 / 11

    requestHash: text("request_hash"),
    requestPayload: jsonb("request_payload"),
    responsePayload: jsonb("response_payload"),

    previewUrl: text("preview_url"),
    publishedUrl: text("published_url"),

    attempts: integer("attempts").notNull().default(0),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),

    operatorId: text("operator_id"),
    triggerSource: text("trigger_source"),

    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    articleIdx: index("cms_pub_article_idx").on(table.articleId),
    cmsArticleIdIdx: index("cms_pub_cms_article_idx").on(table.cmsArticleId),
    orgStateIdx: index("cms_pub_org_state_idx").on(
      table.organizationId,
      table.cmsState,
    ),
    channelStateIdx: index("cms_pub_channel_state_idx").on(
      table.appChannelSlug,
      table.cmsState,
    ),
  }),
);

export const cmsPublicationsRelations = relations(cmsPublications, ({ one }) => ({
  organization: one(organizations, {
    fields: [cmsPublications.organizationId],
    references: [organizations.id],
  }),
  article: one(articles, {
    fields: [cmsPublications.articleId],
    references: [articles.id],
  }),
}));

import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";
import { articles } from "./articles";

// =====================================================================
// external_publications — article → Ayrshare 外站发布流水
// 设计文档：/Users/zhuyu/.claude/plans/tophub-x-instagram-twitter-sunny-papert.md §2.2
//
// 一条记录代表一篇文章向一个外部平台（X / Instagram / Facebook / LinkedIn 等）的
// 一次发布尝试。多平台批量发 = 多条记录。
// =====================================================================

export const externalPublications = pgTable(
  "external_publications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    articleId: uuid("article_id")
      .references(() => articles.id)
      .notNull(),

    // Ayrshare 聚合 id（一次 POST /api/post 可能跨多平台，返回统一 id）
    ayrsharePostId: text("ayrshare_post_id"),

    // 目标平台 slug：twitter | instagram | facebook | linkedin | tiktok | ...
    platform: text("platform").notNull(),

    // 平台原生 id / URL（Ayrshare webhook 回写时填充）
    platformPostId: text("platform_post_id"),
    platformPostUrl: text("platform_post_url"),

    // submitting | success | failed | retrying
    status: text("status").notNull().default("submitting"),

    errorCode: text("error_code"),
    errorMessage: text("error_message"),

    // Ayrshare 完整请求/响应 payload（debug + 审计）
    requestPayload: jsonb("request_payload"),
    rawResponse: jsonb("raw_response"),

    operatorId: text("operator_id"),

    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    articleIdx: index("ext_pub_article_idx").on(table.articleId),
    ayrshareIdx: index("ext_pub_ayrshare_idx").on(table.ayrsharePostId),
    orgPlatformStatusIdx: index("ext_pub_org_platform_status_idx").on(
      table.organizationId,
      table.platform,
      table.status,
    ),
  }),
);

export const externalPublicationsRelations = relations(
  externalPublications,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [externalPublications.organizationId],
      references: [organizations.id],
    }),
    article: one(articles, {
      fields: [externalPublications.articleId],
      references: [articles.id],
    }),
  }),
);

import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";
import { articles } from "./articles";

// =====================================================================
// article_channel_variants — 一篇稿件向各社媒渠道（微信/微博/抖音 ...）的改写版本
// 设计文档：/Users/zhuyu/.claude/plans/tophub-x-instagram-twitter-sunny-papert.md §数据层
//
// 一行 = 一个 (articleId, platform) 组合。每个渠道有独立的标题/正文/封面/hashtags，
// 可以独立审核、独立发布。与 external_publications（Ayrshare 海外发布流水）区分：
// 那张表存的是发布"尝试记录"，本表存的是发布"内容版本"。
// =====================================================================

export const articleChannelVariants = pgTable(
  "article_channel_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    articleId: uuid("article_id")
      .references(() => articles.id, { onDelete: "cascade" })
      .notNull(),

    // 渠道 slug，对齐 channels.platform：
    //   wechat_oa | weibo | douyin | xiaohongshu | zhihu | toutiao
    //   kuaishou | bilibili | tiktok | (未来扩展)
    platform: text("platform").notNull(),

    // 改写后的渠道版本内容
    title: text("title").notNull(),
    body: text("body"),
    summary: text("summary"),
    coverImageUrl: text("cover_image_url"),
    hashtags: jsonb("hashtags").$type<string[]>().default([]),

    // 平台特定字段（jsonb 灵活承载）
    //   微信：{ authorOverride, originalLink, sourceCopyright, coverType }
    //   抖音：{ challengeIds[], poiName, atUsers[] }
    //   微博：{ topics[], replyStrategy }
    //   小红书：{ noteType, geoTag }
    //   ...
    extraFields: jsonb("extra_fields").default({}),

    // 状态机：
    //   draft       — 用户手填或刚生成，未确认
    //   generating  — channel_rewrite skill 正在跑
    //   ready       — 已就绪，可发布
    //   failed      — AI 生成失败
    status: text("status").notNull().default("draft"),

    // AI 生成时间戳（重新生成时刷新）
    generatedAt: timestamp("generated_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    uniqueArticlePlatform: uniqueIndex("acv_article_platform_uidx").on(
      t.articleId,
      t.platform,
    ),
    orgArticleIdx: index("acv_org_article_idx").on(
      t.organizationId,
      t.articleId,
    ),
  }),
);

export const articleChannelVariantsRelations = relations(
  articleChannelVariants,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [articleChannelVariants.organizationId],
      references: [organizations.id],
    }),
    article: one(articles, {
      fields: [articleChannelVariants.articleId],
      references: [articles.id],
    }),
  }),
);

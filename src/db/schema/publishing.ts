import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  real,
  date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";
import { aiEmployees } from "./ai-employees";
import { tasks } from "./tasks";
import { channelStatusEnum, publishStatusEnum } from "./enums";

// ---------------------------------------------------------------------------
// channels — 渠道账号管理 (F3.1.07)
// ---------------------------------------------------------------------------

export const channels = pgTable("channels", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),

  name: text("name").notNull(),
  platform: text("platform").notNull(), // wechat | toutiao | douyin | weibo | baidu | bilibili | xiaohongshu | zhihu
  icon: text("icon"),
  apiConfig: jsonb("api_config").$type<Record<string, unknown>>(),
  status: channelStatusEnum("status").notNull().default("setup"),
  followers: integer("followers").notNull().default(0),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------------------------------------------------------------------------
// publish_plans — 发布计划 (F3.1.01-06)
// ---------------------------------------------------------------------------

export const publishPlans = pgTable("publish_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),

  channelId: uuid("channel_id")
    .references(() => channels.id, { onDelete: "cascade" })
    .notNull(),
  taskId: uuid("task_id").references(() => tasks.id),

  title: text("title").notNull(),
  adaptedContent: jsonb("adapted_content").$type<{
    headline?: string;
    body?: string;
    coverImage?: string;
    tags?: string[];
    format?: string;
  }>(),

  status: publishStatusEnum("status").notNull().default("scheduled"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }),

  // Condition-based publishing (F3.1.05)
  triggerConditions: jsonb("trigger_conditions").$type<{
    type: string;
    threshold?: number;
    operator?: string;
  }[]>(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------------------------------------------------------------------------
// channel_metrics — 渠道数据指标 (F3.1.13-14)
// ---------------------------------------------------------------------------

export const channelMetrics = pgTable("channel_metrics", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),

  channelId: uuid("channel_id")
    .references(() => channels.id, { onDelete: "cascade" })
    .notNull(),

  date: date("date").notNull(),
  views: integer("views").notNull().default(0),
  likes: integer("likes").notNull().default(0),
  shares: integer("shares").notNull().default(0),
  comments: integer("comments").notNull().default(0),
  followers: integer("followers").notNull().default(0),
  engagement: real("engagement").notNull().default(0),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const channelsRelations = relations(channels, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [channels.organizationId],
    references: [organizations.id],
  }),
  publishPlans: many(publishPlans),
  metrics: many(channelMetrics),
}));

export const publishPlansRelations = relations(publishPlans, ({ one }) => ({
  organization: one(organizations, {
    fields: [publishPlans.organizationId],
    references: [organizations.id],
  }),
  channel: one(channels, {
    fields: [publishPlans.channelId],
    references: [channels.id],
  }),
  task: one(tasks, {
    fields: [publishPlans.taskId],
    references: [tasks.id],
  }),
}));

export const channelMetricsRelations = relations(
  channelMetrics,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [channelMetrics.organizationId],
      references: [organizations.id],
    }),
    channel: one(channels, {
      fields: [channelMetrics.channelId],
      references: [channels.id],
    }),
  })
);

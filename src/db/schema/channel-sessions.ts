import {
  pgTable,
  uuid,
  text,
  jsonb,
  integer,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { organizations } from "./users";
import { channelConfigs } from "./channels";
import { missions } from "./missions";
import { articles } from "./articles";
import { channelPlatformEnum } from "./enums";
import type { IntentStep } from "@/lib/agent/types";

/** 一个 IM 会话（configId+chatId+发送者）一份澄清/执行状态。回执反查的真相源。 */
export const channelSessions = pgTable(
  "channel_sessions",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    configId: uuid("config_id")
      .notNull()
      .references(() => channelConfigs.id, { onDelete: "cascade" }),
    platform: channelPlatformEnum("platform").notNull(),
    chatId: text("chat_id").notNull(),
    externalUserId: text("external_user_id").notNull(),
    status: text("status").notNull().default("idle"),
    contextTurns: jsonb("context_turns")
      .$type<{ role: string; content: string }[]>()
      .notNull()
      .default([]),
    activeMissionId: uuid("active_mission_id").references(() => missions.id, {
      onDelete: "set null",
    }),
    clarifyRounds: integer("clarify_rounds").notNull().default(0),
    pendingPlan: jsonb("pending_plan").$type<{
      summary: string;
      steps: IntentStep[];
    }>(),
    /** 上次 mission 产出的 articleId，供发布/配图 follow-up 锚定"这篇"。 */
    lastArticleId: uuid("last_article_id").references(() => articles.id, {
      onDelete: "set null",
    }),
    /** 待确认发布任务（发布意图识别后暂存，等用户二次确认）。 */
    pendingPublish: jsonb("pending_publish").$type<{
      articleId: string;
      articleTitle: string;
      catalogName: string;
      target: { catalogId: number; appId: number; siteId: number };
    }>(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    unique("channel_sessions_triple_uidx").on(
      t.configId,
      t.chatId,
      t.externalUserId
    ),
  ]
);

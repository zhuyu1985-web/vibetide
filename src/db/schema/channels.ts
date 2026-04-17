import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";
import { missions } from "./missions";
import {
  channelPlatformEnum,
  channelMessageDirectionEnum,
  channelMessageStatusEnum,
} from "./enums";

// ---------------------------------------------------------------------------
// channel_configs — 渠道集成配置（钉钉 / 企业微信）
// ---------------------------------------------------------------------------

export const channelConfigs = pgTable("channel_configs", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  platform: channelPlatformEnum("platform").notNull(),
  name: text("name").notNull(), // 用户给此配置起的名字
  // Credentials (stored plaintext for MVP; Supabase provides encryption at rest)
  appKey: text("app_key"),            // DingTalk AppKey / WeChat CorpID
  appSecret: text("app_secret"),      // DingTalk AppSecret / WeChat Secret
  robotSecret: text("robot_secret"),  // DingTalk robot sign secret
  agentId: text("agent_id"),          // WeChat Work AgentId
  token: text("token"),               // WeChat URL verification token
  encodingAesKey: text("encoding_aes_key"), // WeChat message encryption key
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------------------------------------------------------------------------
// channel_messages — 渠道消息记录（双向）
// ---------------------------------------------------------------------------

export const channelMessages = pgTable("channel_messages", {
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
  direction: channelMessageDirectionEnum("direction").notNull(),
  externalMessageId: text("external_message_id"), // platform's message ID
  externalUserId: text("external_user_id"),        // sender ID on external platform
  chatId: text("chat_id"),                          // conversation/group ID
  content: jsonb("content").notNull(),              // standardized content
  missionId: uuid("mission_id").references(() => missions.id, {
    onDelete: "set null",
  }),
  status: channelMessageStatusEnum("status").notNull().default("received"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const channelConfigsRelations = relations(
  channelConfigs,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [channelConfigs.organizationId],
      references: [organizations.id],
    }),
    messages: many(channelMessages),
  })
);

export const channelMessagesRelations = relations(
  channelMessages,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [channelMessages.organizationId],
      references: [organizations.id],
    }),
    config: one(channelConfigs, {
      fields: [channelMessages.configId],
      references: [channelConfigs.id],
    }),
    mission: one(missions, {
      fields: [channelMessages.missionId],
      references: [missions.id],
    }),
  })
);

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
import { projects } from "./projects";
import { aiEmployees } from "./ai-employees";
import { missions } from "./missions";
import { conversationStatusEnum } from "./enums";

// ─── Conversations (cowork 单窗口会话头) ───
// 取代员工强绑定的 saved_conversations:不再有 employeeSlug,员工由意图识别
// 动态调度。一个会话里多次"可执行请求"各 spawn 一个 mission(1:N),消息行
// 直接 FK 到 mission(见 conversation_messages.missionId)。
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    userId: uuid("user_id").notNull(),

    // 会话可归类到项目;项目删除时置空(会话本身保留)
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),

    title: text("title").notNull(),
    summary: text("summary"),
    status: conversationStatusEnum("status").notNull().default("active"),

    // 会话列表排序键(类 ChatGPT:最近活跃置顶)
    lastMessageAt: timestamp("last_message_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // 会话列表热路径:某用户在某 org 下按状态 + 最近活跃排序
    listIdx: index("conversations_list_idx").on(
      table.organizationId,
      table.userId,
      table.status,
      table.lastMessageAt,
    ),
    projectIdx: index("conversations_project_idx").on(table.projectId),
  }),
);

// ─── Conversation Messages (独立消息表;可分页、可索引、可挂 mission) ───
export const conversationMessages = pgTable(
  "conversation_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
      .references(() => conversations.id, { onDelete: "cascade" })
      .notNull(),

    role: text("role").notNull(), // user | assistant | system
    content: text("content").notNull().default(""),
    // text(纯文本/自由聊天) | mission_card(承载一个 mission) | plan_card(意图计划卡)
    kind: text("kind").notNull().default("text"),

    // 这条消息承载/触发的 mission;右栏即渲染它(一条消息 ↔ 0..1 mission)
    missionId: uuid("mission_id").references(() => missions.id, {
      onDelete: "set null",
    }),

    // 产出归属:哪个员工产出这条(替代 saved_conversations.employeeSlug 强绑定)
    executedByEmployeeId: uuid("executed_by_employee_id").references(
      () => aiEmployees.id,
    ),

    // 自由聊天富信息(沿用现 ChatMessage 形状):
    // durationMs / thinkingSteps[] / skillsUsed[] / sources[] / referenceCount / intentResult
    meta: jsonb("meta").$type<Record<string, unknown>>(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    convoCreatedIdx: index("conversation_messages_convo_created_idx").on(
      table.conversationId,
      table.createdAt,
    ),
    // 从 mission 反查所属对话消息
    missionIdx: index("conversation_messages_mission_idx").on(table.missionId),
  }),
);

export const conversationsRelations = relations(
  conversations,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [conversations.organizationId],
      references: [organizations.id],
    }),
    project: one(projects, {
      fields: [conversations.projectId],
      references: [projects.id],
    }),
    messages: many(conversationMessages),
  }),
);

export const conversationMessagesRelations = relations(
  conversationMessages,
  ({ one }) => ({
    conversation: one(conversations, {
      fields: [conversationMessages.conversationId],
      references: [conversations.id],
    }),
    mission: one(missions, {
      fields: [conversationMessages.missionId],
      references: [missions.id],
    }),
    executedByEmployee: one(aiEmployees, {
      fields: [conversationMessages.executedByEmployeeId],
      references: [aiEmployees.id],
    }),
  }),
);

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type NewConversationMessage = typeof conversationMessages.$inferInsert;

import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations, userProfiles } from "./users";
import { aiEmployees } from "./ai-employees";
import { reviewStatusEnum } from "./enums";

/** 审核任务在 IM/cowork 两侧的对话定位（回链作者、投递审核人用）。 */
export interface ReviewImThread {
  /** 作者侧 IM 会话定位（驳回/通过结果回推给作者） */
  author?: {
    platform: "dingtalk" | "wechat_work";
    configId: string;
    chatId: string;
    externalUserId: string;
    channelSessionId?: string;
  };
  /** 审核人侧 cowork 对话定位（任务卡投递处） */
  reviewer?: {
    kind: "cowork";
    userId: string;
    conversationId?: string;
  };
}

// ---------------------------------------------------------------------------
// review_results — 审核结果 (F3.1.08-12)
// ---------------------------------------------------------------------------

export const reviewResults = pgTable("review_results", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),

  contentId: text("content_id").notNull(), // articleId or taskId
  contentType: text("content_type").notNull().default("article"), // article | task
  // AI 审核官（自动质检/预审）。真人审核走 assigneeUserId，故此处去 notNull。
  reviewerEmployeeId: uuid("reviewer_employee_id").references(
    () => aiEmployees.id,
  ),

  // 真人审核（决策 C，2026-06-24）
  assigneeUserId: uuid("assignee_user_id").references(() => userProfiles.id),
  authorUserId: uuid("author_user_id").references(() => userProfiles.id),
  imThread: jsonb("im_thread").$type<ReviewImThread>(),
  decision: text("decision"), // approved | rejected（真人最终决定）
  decisionReason: text("decision_reason"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decisionTurns: jsonb("decision_turns")
    .$type<{ role: string; content: string; at: string }[]>()
    .default([]),

  status: reviewStatusEnum("status").notNull().default("pending"),

  // Structured issues found during review (F3.1.10)
  issues: jsonb("issues").$type<{
    type: string; // sensitive | copyright | factual | quality | privacy
    severity: "high" | "medium" | "low";
    location: string; // paragraph/sentence/image reference
    description: string;
    suggestion: string;
    resolved: boolean;
  }[]>().default([]),

  score: integer("score"), // 0-100 overall review score

  // Channel-specific rules applied (F3.1.09)
  channelRules: jsonb("channel_rules").$type<{
    channelId?: string;
    strictnessLevel?: string;
    customRules?: string[];
  }>(),

  // Escalation info (F3.1.12)
  escalatedAt: timestamp("escalated_at", { withTimezone: true }),
  escalationReason: text("escalation_reason"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const reviewResultsRelations = relations(
  reviewResults,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [reviewResults.organizationId],
      references: [organizations.id],
    }),
    reviewer: one(aiEmployees, {
      fields: [reviewResults.reviewerEmployeeId],
      references: [aiEmployees.id],
    }),
  })
);

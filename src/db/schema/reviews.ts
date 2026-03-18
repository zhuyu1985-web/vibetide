import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";
import { aiEmployees } from "./ai-employees";
import { reviewStatusEnum } from "./enums";

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
  reviewerEmployeeId: uuid("reviewer_employee_id")
    .references(() => aiEmployees.id)
    .notNull(),

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

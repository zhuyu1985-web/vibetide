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
  auditStageEnum,
  auditModeEnum,
  auditResultEnum,
  trailActionEnum,
  trailStageEnum,
} from "./enums";

// ---------------------------------------------------------------------------
// audit_records — 三审记录 (三级审核体系)
// ---------------------------------------------------------------------------

export const auditRecords = pgTable("audit_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),

  missionId: uuid("mission_id").references(() => missions.id),
  articleId: uuid("article_id"),
  contentType: text("content_type").notNull(), // "mission_task" | "article" | "draft"
  contentId: uuid("content_id").notNull(),

  stage: auditStageEnum("stage").notNull(),
  mode: auditModeEnum("mode").notNull(),
  reviewerType: text("reviewer_type").notNull(), // "ai" | "human"
  reviewerId: text("reviewer_id").notNull(), // employee slug or user ID

  // 6-dimension scores (political_compliance, factual_accuracy, etc.)
  dimensions: jsonb("dimensions").$type<Record<string, unknown>>(),

  overallResult: auditResultEnum("overall_result").notNull(),

  // Array of {type, severity, location, description, suggestion}
  issues: jsonb("issues")
    .$type<
      {
        type: string;
        severity: string;
        location: string;
        description: string;
        suggestion: string;
      }[]
    >()
    .default([]),

  comment: text("comment"),
  contentSnapshot: text("content_snapshot"),
  diff: jsonb("diff"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------------------------------------------------------------------------
// audit_rules — 审核规则配置
// ---------------------------------------------------------------------------

export const auditRules = pgTable("audit_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),

  scenarioKey: text("scenario_key"), // null = default rule for org
  name: text("name").notNull(),

  // Which dimensions are enabled + strictness per dimension
  dimensions: jsonb("dimensions").$type<Record<string, unknown>>(),

  review1Mode: auditModeEnum("review_1_mode").notNull(),
  review2Mode: auditModeEnum("review_2_mode").notNull(),
  review3Mode: auditModeEnum("review_3_mode").notNull(),

  isDefault: boolean("is_default").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------------------------------------------------------------------------
// content_trail_logs — 内容全链路留痕
// ---------------------------------------------------------------------------

export const contentTrailLogs = pgTable("content_trail_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),

  contentId: uuid("content_id").notNull(),
  contentType: text("content_type").notNull(), // "mission_task" | "article" | "draft"

  operator: text("operator").notNull(), // employee slug or user ID
  operatorType: text("operator_type").notNull(), // "ai" | "human"

  action: trailActionEnum("action").notNull(),
  stage: trailStageEnum("stage").notNull(),

  contentSnapshot: text("content_snapshot"),
  diff: jsonb("diff"),
  comment: text("comment"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------------------------------------------------------------------------
// sensitive_word_lists — 敏感词库
// ---------------------------------------------------------------------------

export const sensitiveWordLists = pgTable("sensitive_word_lists", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),

  name: text("name").notNull(),
  words: jsonb("words").$type<string[]>().default([]),
  category: text("category"),
  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export const auditRecordsRelations = relations(auditRecords, ({ one }) => ({
  organization: one(organizations, {
    fields: [auditRecords.organizationId],
    references: [organizations.id],
  }),
  mission: one(missions, {
    fields: [auditRecords.missionId],
    references: [missions.id],
  }),
}));

export const auditRulesRelations = relations(auditRules, ({ one }) => ({
  organization: one(organizations, {
    fields: [auditRules.organizationId],
    references: [organizations.id],
  }),
}));

export const contentTrailLogsRelations = relations(
  contentTrailLogs,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [contentTrailLogs.organizationId],
      references: [organizations.id],
    }),
  })
);

export const sensitiveWordListsRelations = relations(
  sensitiveWordLists,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [sensitiveWordLists.organizationId],
      references: [organizations.id],
    }),
  })
);

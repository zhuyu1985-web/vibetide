import {
  pgTable,
  uuid,
  timestamp,
  text,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";

// ---------------------------------------------------------------------------
// compliance_checks — 合规检查记录 (M2.F11)
// ---------------------------------------------------------------------------

export const complianceChecks = pgTable("compliance_checks", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),

  contentId: uuid("content_id"), // task or article id
  contentType: text("content_type"), // 'task' | 'article' | 'draft'
  content: text("content").notNull(),

  issues: jsonb("issues")
    .$type<
      {
        type: string;
        severity: "info" | "warning" | "critical";
        location: string;
        description: string;
        suggestion: string;
      }[]
    >()
    .default([]),

  isClean: boolean("is_clean").default(true),

  checkedAt: timestamp("checked_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Relations
export const complianceChecksRelations = relations(
  complianceChecks,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [complianceChecks.organizationId],
      references: [organizations.id],
    }),
  })
);

import {
  pgTable,
  uuid,
  timestamp,
  text,
  jsonb,
  real,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";

// ---------------------------------------------------------------------------
// improvement_trackings — 改进建议追踪 (M2.F18)
// ---------------------------------------------------------------------------

export const improvementTrackings = pgTable("improvement_trackings", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),

  suggestionSource: text("suggestion_source"), // 'benchmark' | 'review' | 'analytics'
  suggestion: text("suggestion").notNull(),

  adoptedAt: timestamp("adopted_at", { withTimezone: true }),

  baselineMetrics: jsonb("baseline_metrics").$type<Record<string, number>>(),
  currentMetrics: jsonb("current_metrics").$type<Record<string, number>>(),

  effectScore: real("effect_score"), // computed improvement score
  status: text("status").default("pending"), // pending | adopted | tracking | completed

  trackUntil: timestamp("track_until", { withTimezone: true }), // 7 days after adoption

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Relations
export const improvementTrackingsRelations = relations(
  improvementTrackings,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [improvementTrackings.organizationId],
      references: [organizations.id],
    }),
  })
);

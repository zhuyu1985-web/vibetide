import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";
import { aiEmployees } from "./ai-employees";
import { advisorStatusEnum } from "./enums";

export const channelAdvisors = pgTable("channel_advisors", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),

  name: text("name").notNull(),
  channelType: text("channel_type").notNull(),
  personality: text("personality").notNull(),
  avatar: text("avatar"),
  style: text("style"),
  strengths: jsonb("strengths").$type<string[]>().default([]),
  catchphrase: text("catchphrase"),

  systemPrompt: text("system_prompt"),
  styleConstraints: jsonb("style_constraints").$type<{
    tone?: string;
    preferredWords?: string[];
    forbiddenWords?: string[];
    replacementRules?: Record<string, string>;
  }>(),

  status: advisorStatusEnum("status").notNull().default("draft"),
  aiEmployeeId: uuid("ai_employee_id").references(() => aiEmployees.id),

  targetAudience: text("target_audience"),
  channelPositioning: text("channel_positioning"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const channelDnaProfiles = pgTable("channel_dna_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  advisorId: uuid("advisor_id")
    .references(() => channelAdvisors.id, { onDelete: "cascade" })
    .notNull(),

  dimensions: jsonb("dimensions")
    .$type<{ dimension: string; score: number }[]>()
    .default([]),
  report: text("report"),

  wordCloud: jsonb("word_cloud"),
  styleExamples: jsonb("style_examples"),

  analyzedAt: timestamp("analyzed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Relations
export const channelAdvisorsRelations = relations(
  channelAdvisors,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [channelAdvisors.organizationId],
      references: [organizations.id],
    }),
    aiEmployee: one(aiEmployees, {
      fields: [channelAdvisors.aiEmployeeId],
      references: [aiEmployees.id],
    }),
    dnaProfiles: many(channelDnaProfiles),
  })
);

export const channelDnaProfilesRelations = relations(
  channelDnaProfiles,
  ({ one }) => ({
    advisor: one(channelAdvisors, {
      fields: [channelDnaProfiles.advisorId],
      references: [channelAdvisors.id],
    }),
  })
);

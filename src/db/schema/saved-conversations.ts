import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";

export const savedConversations = pgTable("saved_conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  userId: uuid("user_id").notNull(),
  employeeSlug: text("employee_slug").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  messages: jsonb("messages")
    .$type<
      {
        role: "user" | "assistant" | "system";
        content: string;
        durationMs?: number;
        thinkingSteps?: { tool: string; label: string; skillName?: string }[];
        skillsUsed?: { tool: string; skillName: string }[];
        sources?: string[];
        referenceCount?: number;
        // mission_card 消息用字段（kind 缺省视为 "text"，向后兼容）
        kind?: "text" | "mission_card";
        missionId?: string;
        templateId?: string;
        templateName?: string;
      }[]
    >()
    .notNull()
    .default([]),
  scenarioId: uuid("scenario_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const savedConversationsRelations = relations(
  savedConversations,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [savedConversations.organizationId],
      references: [organizations.id],
    }),
  })
);

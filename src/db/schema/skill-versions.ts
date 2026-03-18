import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { skills } from "./skills";
import { organizations } from "./users";

export const skillVersions = pgTable("skill_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  skillId: uuid("skill_id")
    .references(() => skills.id, { onDelete: "cascade" })
    .notNull(),
  organizationId: uuid("organization_id").references(() => organizations.id),

  version: text("version").notNull(),
  versionNumber: integer("version_number").notNull().default(1),

  // Snapshot of skill state at this version
  snapshot: jsonb("snapshot").$type<{
    name: string;
    description: string;
    content: string;
    category: string;
    inputSchema?: Record<string, string>;
    outputSchema?: Record<string, string>;
    runtimeConfig?: Record<string, unknown>;
    compatibleRoles?: string[];
  }>().notNull(),

  changeDescription: text("change_description"),
  changedBy: uuid("changed_by"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const skillVersionsRelations = relations(skillVersions, ({ one }) => ({
  skill: one(skills, {
    fields: [skillVersions.skillId],
    references: [skills.id],
  }),
  organization: one(organizations, {
    fields: [skillVersions.organizationId],
    references: [organizations.id],
  }),
}));

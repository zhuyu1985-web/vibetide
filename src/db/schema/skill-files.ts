import {
  pgTable,
  uuid,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { skills } from "./skills";
import { organizations } from "./users";

export const skillFiles = pgTable(
  "skill_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    skillId: uuid("skill_id")
      .references(() => skills.id, { onDelete: "cascade" })
      .notNull(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    fileType: text("file_type").notNull(), // 'reference' | 'script'
    fileName: text("file_name").notNull(),
    filePath: text("file_path").notNull(),
    content: text("content").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [unique().on(t.skillId, t.filePath)]
);

export const skillFilesRelations = relations(skillFiles, ({ one }) => ({
  skill: one(skills, {
    fields: [skillFiles.skillId],
    references: [skills.id],
  }),
  organization: one(organizations, {
    fields: [skillFiles.organizationId],
    references: [organizations.id],
  }),
}));

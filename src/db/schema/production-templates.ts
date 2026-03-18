import {
  pgTable,
  uuid,
  timestamp,
  text,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";

// ---------------------------------------------------------------------------
// production_templates — 模板化生产 (M2.F35)
// ---------------------------------------------------------------------------

export interface TemplateSection {
  title: string;
  prompt: string;
  wordCount: number;
}

export interface TemplateStructure {
  sections: TemplateSection[];
  mediaTypes: string[];
  targetChannels: string[];
}

export interface TemplateVariable {
  name: string;
  label: string;
  type: "text" | "number" | "select" | "date";
  default?: string;
  options?: string[]; // for select type
}

export const productionTemplates = pgTable("production_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),

  name: text("name").notNull(),
  description: text("description"),
  category: text("category"), // 'news_flash' | 'interview' | 'commentary' | 'feature' | 'social_post'

  structure: jsonb("structure").$type<TemplateStructure>().notNull(),
  variables: jsonb("variables").$type<TemplateVariable[]>().default([]),

  usageCount: integer("usage_count").default(0),
  createdBy: uuid("created_by"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Relations
export const productionTemplatesRelations = relations(
  productionTemplates,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [productionTemplates.organizationId],
      references: [organizations.id],
    }),
  })
);

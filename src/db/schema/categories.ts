import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),

    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),

    parentId: uuid("parent_id").references(
      (): AnyPgColumn => categories.id
    ),
    level: integer("level").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),

    isActive: boolean("is_active").notNull().default(true),

    // Media asset library extensions
    scope: text("scope").notNull().default("article"), // 'article' | 'media'
    workflowId: uuid("workflow_id"),
    videoTranscodeGroup: text("video_transcode_group"),
    audioTranscodeGroup: text("audio_transcode_group"),
    catalogTemplateId: text("catalog_template_id"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    orgSlugScopeUniq: uniqueIndex("categories_org_slug_scope_uniq").on(
      table.organizationId,
      table.slug,
      table.scope,
    ),
  }),
);

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [categories.organizationId],
    references: [organizations.id],
  }),
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "categoryParent",
  }),
  children: many(categories, { relationName: "categoryParent" }),
}));

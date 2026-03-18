import {
  pgTable,
  uuid,
  timestamp,
  text,
  jsonb,
  boolean,
  integer,
} from "drizzle-orm/pg-core";

export const tagSchemas = pgTable("tag_schemas", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  options: jsonb("options").$type<{ value: string; label: string }[]>(),
  isCustom: boolean("is_custom").default(true),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

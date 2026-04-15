// src/db/schema/research/cq-districts.ts
import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";

export const cqDistricts = pgTable("research_cq_districts", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  code: text("code"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

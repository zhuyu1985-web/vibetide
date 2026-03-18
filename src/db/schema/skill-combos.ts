import { pgTable, uuid, timestamp, text, jsonb } from "drizzle-orm/pg-core";

export const skillCombos = pgTable("skill_combos", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  skillIds: jsonb("skill_ids").$type<string[]>().notNull(), // skill UUIDs in execution order
  config: jsonb("config").$type<{
    sequential: boolean;
    passOutput: boolean;
  }>(),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

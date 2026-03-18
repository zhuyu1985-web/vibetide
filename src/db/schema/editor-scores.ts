import {
  pgTable,
  uuid,
  timestamp,
  text,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// editor_scores — 编辑积分记录 (M3.F29)
// ---------------------------------------------------------------------------

export const editorScores = pgTable("editor_scores", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  userId: uuid("user_id").notNull(),
  userName: text("user_name").notNull(),
  totalPoints: integer("total_points").default(0),
  level: integer("level").default(1),
  achievements: jsonb("achievements").$type<
    Array<{ name: string; icon: string; earnedAt: string }>
  >(),
  monthlyPoints: integer("monthly_points").default(0),
  weeklyPoints: integer("weekly_points").default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ---------------------------------------------------------------------------
// point_transactions — 积分变动记录 (M3.F29)
// ---------------------------------------------------------------------------

export const pointTransactions = pgTable("point_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  userId: uuid("user_id").notNull(),
  points: integer("points").notNull(),
  reason: text("reason").notNull(), // 'publish_content', 'high_quality', 'trending', 'consistency'
  referenceId: uuid("reference_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

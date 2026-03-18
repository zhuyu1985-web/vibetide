import {
  pgTable,
  uuid,
  timestamp,
  text,
  jsonb,
  real,
} from "drizzle-orm/pg-core";

export const advisorCompareTests = pgTable("advisor_compare_tests", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  testInput: text("test_input").notNull(),
  advisorIds: jsonb("advisor_ids").$type<string[]>().notNull(),
  results: jsonb("results").$type<
    {
      advisorId: string;
      advisorName: string;
      output: string;
      responseTime: number;
      tokenCount: number;
    }[]
  >(),
  selectedWinner: uuid("selected_winner"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const advisorAbTests = pgTable("advisor_ab_tests", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  name: text("name").notNull(),
  advisorAId: uuid("advisor_a_id").notNull(),
  advisorBId: uuid("advisor_b_id").notNull(),
  configDiff: jsonb("config_diff").$type<Record<string, unknown>>(),
  status: text("status").default("active"),
  metrics: jsonb("metrics").$type<{
    a: { views: number; engagement: number; quality: number };
    b: { views: number; engagement: number; quality: number };
  }>(),
  sampleSize: jsonb("sample_size").$type<{ a: number; b: number }>(),
  winner: text("winner"),
  confidence: real("confidence"),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

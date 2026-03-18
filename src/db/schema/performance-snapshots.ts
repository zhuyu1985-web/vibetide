import {
  pgTable,
  uuid,
  timestamp,
  integer,
  real,
  date,
} from "drizzle-orm/pg-core";
import { aiEmployees } from "./ai-employees";

export const performanceSnapshots = pgTable("performance_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  employeeId: uuid("employee_id")
    .references(() => aiEmployees.id)
    .notNull(),
  snapshotDate: date("snapshot_date").notNull(),
  tasksCompleted: integer("tasks_completed").default(0),
  accuracy: real("accuracy").default(0),
  avgResponseTime: real("avg_response_time").default(0),
  satisfaction: real("satisfaction").default(0),
  qualityAvg: real("quality_avg").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

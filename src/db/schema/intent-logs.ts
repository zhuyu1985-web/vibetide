import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { organizations, userProfiles } from "./users";

export const intentLogs = pgTable(
  "intent_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .references(() => organizations.id)
      .notNull(),
    userId: uuid("user_id")
      .references(() => userProfiles.id)
      .notNull(),
    employeeSlug: text("employee_slug").notNull(),
    userMessage: text("user_message").notNull(),
    intentType: text("intent_type").notNull(),
    intentResult: jsonb("intent_result").notNull(),
    userEdited: boolean("user_edited").notNull().default(false),
    editedIntent: jsonb("edited_intent"),
    executionSuccess: boolean("execution_success"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_intent_logs_user").on(table.userId, table.createdAt),
    index("idx_intent_logs_org").on(table.organizationId, table.createdAt),
  ]
);

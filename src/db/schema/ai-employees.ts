import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  integer,
  real,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";
import { employeeStatusEnum, authorityLevelEnum } from "./enums";

export const aiEmployees = pgTable("ai_employees", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),

  // Display info
  slug: text("slug").notNull(), // maps to existing EmployeeId (e.g., "xiaolei")
  name: text("name").notNull(), // role name (e.g., "热点猎手")
  nickname: text("nickname").notNull(), // display name (e.g., "小雷")
  title: text("title").notNull(),
  motto: text("motto"),

  // Role configuration
  roleType: text("role_type").notNull(),
  authorityLevel: authorityLevelEnum("authority_level")
    .notNull()
    .default("advisor"),
  autoActions: jsonb("auto_actions").$type<string[]>().default([]),
  needApprovalActions: jsonb("need_approval_actions")
    .$type<string[]>()
    .default([]),

  // Status
  status: employeeStatusEnum("status").notNull().default("idle"),
  currentTask: text("current_task"),

  // Work preferences
  workPreferences: jsonb("work_preferences").$type<{
    proactivity: string;
    reportingFrequency: string;
    autonomyLevel: number;
    communicationStyle: string;
    workingHours: string;
  }>(),

  // Memory / learned patterns
  learnedPatterns: jsonb("learned_patterns")
    .$type<
      Record<
        string,
        {
          source: "human_feedback" | "quality_review" | "self_reflection";
          count: number;
          lastSeen: string;
        }
      >
    >()
    .default({}),

  // Metrics
  tasksCompleted: integer("tasks_completed").notNull().default(0),
  accuracy: real("accuracy").notNull().default(0),
  avgResponseTime: text("avg_response_time").notNull().default("0s"),
  satisfaction: real("satisfaction").notNull().default(0),

  // Metadata
  isPreset: integer("is_preset").notNull().default(1), // 1 = built-in, 0 = custom
  disabled: integer("disabled").notNull().default(0), // 1 = disabled, 0 = active
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Note: Cross-module relations (employeeSkills, teamMembers, etc.)
// are defined in their respective schema files pointing back to aiEmployees.
// This keeps circular imports clean.
export const aiEmployeesRelations = relations(aiEmployees, ({ one }) => ({
  organization: one(organizations, {
    fields: [aiEmployees.organizationId],
    references: [organizations.id],
  }),
}));

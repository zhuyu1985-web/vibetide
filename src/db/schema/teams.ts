import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations, userProfiles } from "./users";
import { aiEmployees } from "./ai-employees";
import { memberTypeEnum } from "./enums";

export const teams = pgTable("teams", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),

  name: text("name").notNull(),
  scenario: text("scenario").notNull(), // breaking_news, deep_report, social_media, custom

  // Collaboration rules
  rules: jsonb("rules")
    .$type<{
      approvalRequired: boolean;
      reportFrequency: string;
      sensitiveTopics: string[];
      approvalSteps?: string[];
    }>()
    .notNull(),

  // Workflow template reference
  workflowTemplateId: uuid("workflow_template_id"),

  // Escalation policy
  escalationPolicy: jsonb("escalation_policy").$type<{
    sensitivityThreshold?: number; // 0-100, auto-escalate if content sensitivity > threshold
    qualityThreshold?: number; // 0-100, auto-escalate if quality score < threshold
    timeoutAction?: "auto_approve" | "auto_reject" | "escalate"; // what to do on approval timeout
    escalateToUserId?: string; // user to escalate to
  }>(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const teamMembers = pgTable("team_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id")
    .references(() => teams.id, { onDelete: "cascade" })
    .notNull(),
  memberType: memberTypeEnum("member_type").notNull(),

  // One of these will be set based on memberType
  aiEmployeeId: uuid("ai_employee_id").references(() => aiEmployees.id, {
    onDelete: "cascade",
  }),
  userId: uuid("user_id").references(() => userProfiles.id, {
    onDelete: "cascade",
  }),

  displayName: text("display_name").notNull(),
  teamRole: text("team_role"), // e.g., "热点发现", "主编（审批者）"

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Relations
export const teamsRelations = relations(teams, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [teams.organizationId],
    references: [organizations.id],
  }),
  members: many(teamMembers),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  aiEmployee: one(aiEmployees, {
    fields: [teamMembers.aiEmployeeId],
    references: [aiEmployees.id],
  }),
  user: one(userProfiles, {
    fields: [teamMembers.userId],
    references: [userProfiles.id],
  }),
}));

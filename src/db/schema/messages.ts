import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { teams } from "./teams";
import { aiEmployees } from "./ai-employees";
import { userProfiles } from "./users";
import { workflowInstances } from "./workflows";
import { messageTypeEnum } from "./enums";

export const teamMessages = pgTable("team_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),

  // Sender: either AI employee or human
  senderType: text("sender_type").notNull(), // "ai" or "human"
  aiEmployeeId: uuid("ai_employee_id").references(() => aiEmployees.id),
  userId: uuid("user_id").references(() => userProfiles.id),

  workflowInstanceId: uuid("workflow_instance_id").references(
    () => workflowInstances.id
  ),
  workflowStepKey: text("workflow_step_key"),

  type: messageTypeEnum("type").notNull(),
  content: text("content").notNull(),

  actions: jsonb("actions").$type<
    {
      label: string;
      variant: "default" | "primary" | "destructive";
      stepId?: string;
    }[]
  >(),

  attachments: jsonb("attachments").$type<
    {
      type: "topic_card" | "draft_preview" | "chart" | "asset";
      title: string;
      description?: string;
    }[]
  >(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Relations
export const teamMessagesRelations = relations(teamMessages, ({ one }) => ({
  team: one(teams, {
    fields: [teamMessages.teamId],
    references: [teams.id],
  }),
  aiEmployee: one(aiEmployees, {
    fields: [teamMessages.aiEmployeeId],
    references: [aiEmployees.id],
  }),
  user: one(userProfiles, {
    fields: [teamMessages.userId],
    references: [userProfiles.id],
  }),
  workflowInstance: one(workflowInstances, {
    fields: [teamMessages.workflowInstanceId],
    references: [workflowInstances.id],
  }),
}));

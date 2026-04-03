import {
  pgTable,
  uuid,
  timestamp,
  real,
  boolean,
  jsonb,
  text,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organizations } from "./users";
import { missions, missionTasks } from "./missions";
import { aiEmployees } from "./ai-employees";
import { savedConversations } from "./saved-conversations";
import { verificationLevelEnum, verifierTypeEnum } from "./enums";

export const verificationRecords = pgTable("verification_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  missionId: uuid("mission_id").references(() => missions.id),
  taskId: uuid("task_id").references(() => missionTasks.id),
  conversationId: uuid("conversation_id").references(() => savedConversations.id),
  verificationLevel: verificationLevelEnum("verification_level").notNull(),
  verifierType: verifierTypeEnum("verifier_type").notNull(),
  verifierEmployeeId: uuid("verifier_employee_id").references(() => aiEmployees.id),
  qualityScore: real("quality_score").notNull(),
  passed: boolean("passed").notNull(),
  feedback: text("feedback"),
  issuesFound: jsonb("issues_found")
    .$type<Array<{ type: string; description: string; severity: string }>>()
    .default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
}, (table) => [
  index("idx_verification_org_mission").on(table.organizationId, table.missionId),
  index("idx_verification_task").on(table.taskId),
  index("idx_verification_verifier").on(table.verifierEmployeeId),
]);

export const verificationRecordsRelations = relations(
  verificationRecords,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [verificationRecords.organizationId],
      references: [organizations.id],
    }),
    mission: one(missions, {
      fields: [verificationRecords.missionId],
      references: [missions.id],
    }),
    task: one(missionTasks, {
      fields: [verificationRecords.taskId],
      references: [missionTasks.id],
    }),
    conversation: one(savedConversations, {
      fields: [verificationRecords.conversationId],
      references: [savedConversations.id],
    }),
    verifier: one(aiEmployees, {
      fields: [verificationRecords.verifierEmployeeId],
      references: [aiEmployees.id],
    }),
  })
);

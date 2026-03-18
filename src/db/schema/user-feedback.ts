import {
  pgTable,
  uuid,
  timestamp,
  text,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";

export const feedbackTypeEnum = pgEnum("feedback_type", [
  "accept",
  "reject",
  "edit",
]);

export const userFeedback = pgTable("user_feedback", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  userId: uuid("user_id").notNull(),
  workflowInstanceId: uuid("workflow_instance_id"),
  stepKey: text("step_key"),
  employeeId: uuid("employee_id"),
  feedbackType: feedbackTypeEnum("feedback_type").notNull(),
  originalContent: text("original_content"),
  editedContent: text("edited_content"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const effectAttributions = pgTable("effect_attributions", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull(),
  publishPlanId: uuid("publish_plan_id"),
  workflowInstanceId: uuid("workflow_instance_id"),
  employeeId: uuid("employee_id"),
  reach: jsonb("reach"), // { views, shares, comments, likes }
  engagement: jsonb("engagement"),
  qualityScore: jsonb("quality_score"),
  attributedAt: timestamp("attributed_at").defaultNow(),
});

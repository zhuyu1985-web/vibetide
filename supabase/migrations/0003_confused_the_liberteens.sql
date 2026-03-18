CREATE TYPE "public"."artifact_type" AS ENUM('topic_brief', 'angle_list', 'material_pack', 'article_draft', 'video_plan', 'review_report', 'publish_plan', 'analytics_report', 'generic');--> statement-breakpoint
CREATE TYPE "public"."memory_type" AS ENUM('feedback', 'pattern', 'preference');--> statement-breakpoint
CREATE TYPE "public"."skill_binding_type" AS ENUM('core', 'extended', 'knowledge');--> statement-breakpoint
CREATE TYPE "public"."feedback_type" AS ENUM('accept', 'reject', 'edit');--> statement-breakpoint
CREATE TABLE "workflow_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_instance_id" uuid NOT NULL,
	"artifact_type" "artifact_type" NOT NULL,
	"title" text NOT NULL,
	"content" jsonb,
	"text_content" text,
	"producer_employee_id" uuid,
	"producer_step_key" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"memory_type" "memory_type" NOT NULL,
	"content" text NOT NULL,
	"source" text,
	"importance" real DEFAULT 0.5 NOT NULL,
	"access_count" integer DEFAULT 0 NOT NULL,
	"last_accessed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"message_id" uuid NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_reads_user_message_unique" UNIQUE("user_id","message_id")
);
--> statement-breakpoint
CREATE TABLE "performance_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"snapshot_date" date NOT NULL,
	"tasks_completed" integer DEFAULT 0,
	"accuracy" real DEFAULT 0,
	"avg_response_time" real DEFAULT 0,
	"satisfaction" real DEFAULT 0,
	"quality_avg" real DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "effect_attributions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"publish_plan_id" uuid,
	"workflow_instance_id" uuid,
	"employee_id" uuid,
	"reach" jsonb,
	"engagement" jsonb,
	"quality_score" jsonb,
	"attributed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"workflow_instance_id" uuid,
	"step_key" text,
	"employee_id" uuid,
	"feedback_type" "feedback_type" NOT NULL,
	"original_content" text,
	"edited_content" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employee_config_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"changed_by" uuid,
	"changed_fields" jsonb,
	"change_description" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "skill_combos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"skill_ids" jsonb NOT NULL,
	"config" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "compliance_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"content_id" uuid,
	"content_type" text,
	"content" text NOT NULL,
	"issues" jsonb DEFAULT '[]'::jsonb,
	"is_clean" boolean DEFAULT true,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "production_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text,
	"structure" jsonb NOT NULL,
	"variables" jsonb DEFAULT '[]'::jsonb,
	"usage_count" integer DEFAULT 0,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "improvement_trackings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"suggestion_source" text,
	"suggestion" text NOT NULL,
	"adopted_at" timestamp with time zone,
	"baseline_metrics" jsonb,
	"current_metrics" jsonb,
	"effect_score" real,
	"status" text DEFAULT 'pending',
	"track_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editor_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"user_name" text NOT NULL,
	"total_points" integer DEFAULT 0,
	"level" integer DEFAULT 1,
	"achievements" jsonb,
	"monthly_points" integer DEFAULT 0,
	"weekly_points" integer DEFAULT 0,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "point_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"points" integer NOT NULL,
	"reason" text NOT NULL,
	"reference_id" uuid,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tag_schemas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"options" jsonb,
	"is_custom" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "advisor_ab_tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"advisor_a_id" uuid NOT NULL,
	"advisor_b_id" uuid NOT NULL,
	"config_diff" jsonb,
	"status" text DEFAULT 'active',
	"metrics" jsonb,
	"sample_size" jsonb,
	"winner" text,
	"confidence" real,
	"started_at" timestamp with time zone DEFAULT now(),
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "advisor_compare_tests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"test_input" text NOT NULL,
	"advisor_ids" jsonb NOT NULL,
	"results" jsonb,
	"selected_winner" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_employees" ALTER COLUMN "learned_patterns" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "employee_skills" ADD COLUMN "binding_type" "skill_binding_type" DEFAULT 'extended' NOT NULL;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD COLUMN "token_budget" integer DEFAULT 100000 NOT NULL;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD COLUMN "tokens_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "workflow_artifacts" ADD CONSTRAINT "workflow_artifacts_workflow_instance_id_workflow_instances_id_fk" FOREIGN KEY ("workflow_instance_id") REFERENCES "public"."workflow_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_artifacts" ADD CONSTRAINT "workflow_artifacts_producer_employee_id_ai_employees_id_fk" FOREIGN KEY ("producer_employee_id") REFERENCES "public"."ai_employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_memories" ADD CONSTRAINT "employee_memories_employee_id_ai_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."ai_employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_memories" ADD CONSTRAINT "employee_memories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_message_id_team_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."team_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_snapshots" ADD CONSTRAINT "performance_snapshots_employee_id_ai_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."ai_employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_config_versions" ADD CONSTRAINT "employee_config_versions_employee_id_ai_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."ai_employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_checks" ADD CONSTRAINT "compliance_checks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_templates" ADD CONSTRAINT "production_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "improvement_trackings" ADD CONSTRAINT "improvement_trackings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
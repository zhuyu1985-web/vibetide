CREATE TYPE "public"."learning_source" AS ENUM('assigned', 'discovered', 'recommended');--> statement-breakpoint
CREATE TYPE "public"."verification_level" AS ENUM('simple', 'important', 'critical');--> statement-breakpoint
CREATE TYPE "public"."verifier_type" AS ENUM('self_eval', 'cross_review', 'human');--> statement-breakpoint
ALTER TYPE "public"."memory_type" ADD VALUE 'success_pattern';--> statement-breakpoint
ALTER TYPE "public"."memory_type" ADD VALUE 'failure_lesson';--> statement-breakpoint
ALTER TYPE "public"."memory_type" ADD VALUE 'user_preference';--> statement-breakpoint
ALTER TYPE "public"."memory_type" ADD VALUE 'skill_insight';--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"assigned_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"mission_id" uuid,
	"task_id" uuid,
	"conversation_id" uuid,
	"verification_level" "verification_level" NOT NULL,
	"verifier_type" "verifier_type" NOT NULL,
	"verifier_employee_id" uuid,
	"quality_score" real NOT NULL,
	"passed" boolean NOT NULL,
	"feedback" text,
	"issues_found" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "is_super_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_skills" ADD COLUMN "usage_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_skills" ADD COLUMN "success_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_skills" ADD COLUMN "last_quality_avg" real;--> statement-breakpoint
ALTER TABLE "employee_skills" ADD COLUMN "learned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "employee_skills" ADD COLUMN "learning_source" "learning_source" DEFAULT 'assigned' NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_memories" ADD COLUMN "source_task_id" uuid;--> statement-breakpoint
ALTER TABLE "employee_memories" ADD COLUMN "confidence" real DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_memories" ADD COLUMN "decay_rate" real DEFAULT 0.01 NOT NULL;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_assigned_by_user_profiles_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_records" ADD CONSTRAINT "verification_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_records" ADD CONSTRAINT "verification_records_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_records" ADD CONSTRAINT "verification_records_task_id_mission_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."mission_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_records" ADD CONSTRAINT "verification_records_conversation_id_saved_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."saved_conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_records" ADD CONSTRAINT "verification_records_verifier_employee_id_ai_employees_id_fk" FOREIGN KEY ("verifier_employee_id") REFERENCES "public"."ai_employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_role_org_slug" ON "roles" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_role" ON "user_roles" USING btree ("user_id","role_id");--> statement-breakpoint
CREATE INDEX "idx_verification_org_mission" ON "verification_records" USING btree ("organization_id","mission_id");--> statement-breakpoint
CREATE INDEX "idx_verification_task" ON "verification_records" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_verification_verifier" ON "verification_records" USING btree ("verifier_employee_id");
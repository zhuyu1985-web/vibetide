-- Mission system migration: idempotent (safe to re-run)

-- 1. Create new enums
DO $$ BEGIN CREATE TYPE "public"."mission_message_type" AS ENUM('question', 'answer', 'status_update', 'result', 'coordination'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."mission_status" AS ENUM('planning', 'executing', 'consolidating', 'completed', 'failed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "public"."mission_task_status" AS ENUM('pending', 'ready', 'claimed', 'in_progress', 'completed', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

-- 2. Create new tables
CREATE TABLE IF NOT EXISTS "mission_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mission_id" uuid NOT NULL,
	"from_employee_id" uuid NOT NULL,
	"to_employee_id" uuid,
	"message_type" "mission_message_type" NOT NULL,
	"content" text NOT NULL,
	"related_task_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mission_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mission_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"expected_output" text,
	"assigned_employee_id" uuid,
	"status" "mission_task_status" DEFAULT 'pending' NOT NULL,
	"dependencies" jsonb DEFAULT '[]'::jsonb,
	"priority" integer DEFAULT 0 NOT NULL,
	"input_context" jsonb,
	"output_data" jsonb,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"claimed_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "missions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"scenario" text NOT NULL,
	"user_instruction" text NOT NULL,
	"leader_employee_id" uuid NOT NULL,
	"team_members" jsonb DEFAULT '[]'::jsonb,
	"status" "mission_status" DEFAULT 'planning' NOT NULL,
	"final_output" jsonb,
	"token_budget" integer DEFAULT 200000 NOT NULL,
	"tokens_used" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint

-- 3. Drop old tables
ALTER TABLE IF EXISTS "team_members" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "teams" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "workflow_instances" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "workflow_steps" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "team_messages" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE IF EXISTS "team_members" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "teams" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "workflow_instances" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "workflow_steps" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "team_messages" CASCADE;--> statement-breakpoint

-- 4. Drop old constraints (IF EXISTS because CASCADE above may have already removed them)
ALTER TABLE "workflow_artifacts" DROP CONSTRAINT IF EXISTS "workflow_artifacts_workflow_instance_id_workflow_instances_id_fk";--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_team_id_teams_id_fk";--> statement-breakpoint
ALTER TABLE "articles" DROP CONSTRAINT IF EXISTS "articles_team_id_teams_id_fk";--> statement-breakpoint
ALTER TABLE "articles" DROP CONSTRAINT IF EXISTS "articles_workflow_instance_id_workflow_instances_id_fk";--> statement-breakpoint
ALTER TABLE "creation_sessions" DROP CONSTRAINT IF EXISTS "creation_sessions_team_id_teams_id_fk";--> statement-breakpoint
ALTER TABLE "execution_logs" DROP CONSTRAINT IF EXISTS "execution_logs_workflow_instance_id_workflow_instances_id_fk";--> statement-breakpoint
ALTER TABLE "message_reads" DROP CONSTRAINT IF EXISTS "message_reads_message_id_team_messages_id_fk";--> statement-breakpoint
DROP INDEX IF EXISTS "ai_employees_org_slug_unique";--> statement-breakpoint

-- 5. Add new columns (IF NOT EXISTS)
ALTER TABLE "workflow_artifacts" ADD COLUMN IF NOT EXISTS "mission_id" uuid;--> statement-breakpoint
ALTER TABLE "workflow_artifacts" ADD COLUMN IF NOT EXISTS "producer_task_id" uuid;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "mission_id" uuid;--> statement-breakpoint
ALTER TABLE "execution_logs" ADD COLUMN IF NOT EXISTS "mission_id" uuid;--> statement-breakpoint
ALTER TABLE "execution_logs" ADD COLUMN IF NOT EXISTS "mission_task_id" uuid;--> statement-breakpoint
ALTER TABLE "skill_usage_records" ADD COLUMN IF NOT EXISTS "mission_id" uuid;--> statement-breakpoint
ALTER TABLE "skill_usage_records" ADD COLUMN IF NOT EXISTS "mission_task_id" uuid;--> statement-breakpoint

-- 6. Add new foreign keys (wrapped in DO blocks to skip if already exists)
DO $$ BEGIN ALTER TABLE "mission_messages" ADD CONSTRAINT "mission_messages_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "mission_messages" ADD CONSTRAINT "mission_messages_from_employee_id_ai_employees_id_fk" FOREIGN KEY ("from_employee_id") REFERENCES "public"."ai_employees"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "mission_messages" ADD CONSTRAINT "mission_messages_to_employee_id_ai_employees_id_fk" FOREIGN KEY ("to_employee_id") REFERENCES "public"."ai_employees"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "mission_messages" ADD CONSTRAINT "mission_messages_related_task_id_mission_tasks_id_fk" FOREIGN KEY ("related_task_id") REFERENCES "public"."mission_tasks"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "mission_tasks" ADD CONSTRAINT "mission_tasks_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "mission_tasks" ADD CONSTRAINT "mission_tasks_assigned_employee_id_ai_employees_id_fk" FOREIGN KEY ("assigned_employee_id") REFERENCES "public"."ai_employees"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "missions" ADD CONSTRAINT "missions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "missions" ADD CONSTRAINT "missions_leader_employee_id_ai_employees_id_fk" FOREIGN KEY ("leader_employee_id") REFERENCES "public"."ai_employees"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "workflow_artifacts" ADD CONSTRAINT "workflow_artifacts_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "articles" ADD CONSTRAINT "articles_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "execution_logs" ADD CONSTRAINT "execution_logs_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "execution_logs" ADD CONSTRAINT "execution_logs_mission_task_id_mission_tasks_id_fk" FOREIGN KEY ("mission_task_id") REFERENCES "public"."mission_tasks"("id") ON DELETE no action ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
TRUNCATE TABLE "message_reads";--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_message_id_mission_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."mission_messages"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

-- 7. Drop old columns
ALTER TABLE "workflow_artifacts" DROP COLUMN IF EXISTS "workflow_instance_id";--> statement-breakpoint
ALTER TABLE "workflow_artifacts" DROP COLUMN IF EXISTS "producer_step_key";--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "team_id";--> statement-breakpoint
ALTER TABLE "articles" DROP COLUMN IF EXISTS "team_id";--> statement-breakpoint
ALTER TABLE "articles" DROP COLUMN IF EXISTS "workflow_instance_id";--> statement-breakpoint
ALTER TABLE "creation_sessions" DROP COLUMN IF EXISTS "team_id";--> statement-breakpoint
ALTER TABLE "execution_logs" DROP COLUMN IF EXISTS "workflow_instance_id";--> statement-breakpoint
ALTER TABLE "execution_logs" DROP COLUMN IF EXISTS "workflow_step_key";--> statement-breakpoint
ALTER TABLE "skill_usage_records" DROP COLUMN IF EXISTS "workflow_instance_id";--> statement-breakpoint
ALTER TABLE "skill_usage_records" DROP COLUMN IF EXISTS "workflow_step_id";--> statement-breakpoint

-- 8. Drop old enums
DROP TYPE IF EXISTS "public"."member_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."message_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."workflow_step_status";

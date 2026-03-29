-- Mission Phase enum (idempotent)
DO $$ BEGIN
  CREATE TYPE "public"."mission_phase" AS ENUM('assembling', 'decomposing', 'executing', 'coordinating', 'delivering');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

-- Add new enum values (ALTER TYPE ADD VALUE is idempotent in PG 13+, but wrap for safety)
DO $$ BEGIN
  ALTER TYPE "public"."mission_message_type" ADD VALUE IF NOT EXISTS 'chat' BEFORE 'question';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TYPE "public"."mission_message_type" ADD VALUE IF NOT EXISTS 'data_handoff' BEFORE 'status_update';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TYPE "public"."mission_message_type" ADD VALUE IF NOT EXISTS 'progress_update' BEFORE 'status_update';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TYPE "public"."mission_message_type" ADD VALUE IF NOT EXISTS 'task_completed' BEFORE 'status_update';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TYPE "public"."mission_message_type" ADD VALUE IF NOT EXISTS 'task_failed' BEFORE 'status_update';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TYPE "public"."mission_message_type" ADD VALUE IF NOT EXISTS 'help_request' BEFORE 'status_update';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TYPE "public"."mission_status" ADD VALUE IF NOT EXISTS 'queued' BEFORE 'planning';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TYPE "public"."mission_status" ADD VALUE IF NOT EXISTS 'coordinating' BEFORE 'consolidating';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TYPE "public"."mission_task_status" ADD VALUE IF NOT EXISTS 'in_review' BEFORE 'completed';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TYPE "public"."mission_task_status" ADD VALUE IF NOT EXISTS 'cancelled';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TYPE "public"."mission_task_status" ADD VALUE IF NOT EXISTS 'blocked';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

-- Create mission_artifacts table (idempotent)
CREATE TABLE IF NOT EXISTS "mission_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mission_id" uuid NOT NULL,
	"task_id" uuid,
	"produced_by" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"file_url" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Add columns (idempotent via IF NOT EXISTS pattern)
ALTER TABLE "mission_messages" ADD COLUMN IF NOT EXISTS "channel" text DEFAULT 'direct' NOT NULL;--> statement-breakpoint
ALTER TABLE "mission_messages" ADD COLUMN IF NOT EXISTS "structured_data" jsonb;--> statement-breakpoint
ALTER TABLE "mission_messages" ADD COLUMN IF NOT EXISTS "priority" text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "mission_messages" ADD COLUMN IF NOT EXISTS "reply_to" uuid;--> statement-breakpoint
ALTER TABLE "mission_tasks" ADD COLUMN IF NOT EXISTS "acceptance_criteria" text;--> statement-breakpoint
ALTER TABLE "mission_tasks" ADD COLUMN IF NOT EXISTS "assigned_role" text;--> statement-breakpoint
ALTER TABLE "mission_tasks" ADD COLUMN IF NOT EXISTS "output_summary" text;--> statement-breakpoint
ALTER TABLE "mission_tasks" ADD COLUMN IF NOT EXISTS "error_recoverable" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "mission_tasks" ADD COLUMN IF NOT EXISTS "phase" integer;--> statement-breakpoint
ALTER TABLE "mission_tasks" ADD COLUMN IF NOT EXISTS "progress" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "mission_tasks" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "description" text;--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "phase" "mission_phase";--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "progress" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "config" jsonb DEFAULT '{"max_retries":3,"task_timeout":300,"max_agents":8}'::jsonb;--> statement-breakpoint
ALTER TABLE "missions" ADD COLUMN IF NOT EXISTS "started_at" timestamp with time zone;--> statement-breakpoint

-- Foreign keys (idempotent via DO block)
DO $$ BEGIN
  ALTER TABLE "mission_artifacts" ADD CONSTRAINT "mission_artifacts_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "mission_artifacts" ADD CONSTRAINT "mission_artifacts_task_id_mission_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."mission_tasks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "mission_artifacts" ADD CONSTRAINT "mission_artifacts_produced_by_ai_employees_id_fk" FOREIGN KEY ("produced_by") REFERENCES "public"."ai_employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

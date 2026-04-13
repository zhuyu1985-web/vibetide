CREATE TYPE "public"."workflow_category" AS ENUM('news', 'video', 'analytics', 'distribution', 'custom');--> statement-breakpoint
CREATE TYPE "public"."workflow_trigger_type" AS ENUM('manual', 'scheduled');--> statement-breakpoint
ALTER TABLE "workflow_templates" ADD COLUMN "category" "workflow_category" DEFAULT 'custom';--> statement-breakpoint
ALTER TABLE "workflow_templates" ADD COLUMN "trigger_type" "workflow_trigger_type" DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE "workflow_templates" ADD COLUMN "trigger_config" jsonb;--> statement-breakpoint
ALTER TABLE "workflow_templates" ADD COLUMN "is_builtin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "workflow_templates" ADD COLUMN "is_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "workflow_templates" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "workflow_templates" ADD COLUMN "last_run_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workflow_templates" ADD COLUMN "run_count" integer DEFAULT 0 NOT NULL;
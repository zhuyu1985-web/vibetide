CREATE TYPE "public"."audit_mode" AS ENUM('auto', 'human', 'hybrid');--> statement-breakpoint
CREATE TYPE "public"."audit_result" AS ENUM('pass', 'warning', 'fail');--> statement-breakpoint
CREATE TYPE "public"."audit_stage" AS ENUM('review_1', 'review_2', 'review_3');--> statement-breakpoint
CREATE TYPE "public"."trail_action" AS ENUM('create', 'edit', 'review', 'approve', 'reject', 'publish');--> statement-breakpoint
CREATE TYPE "public"."trail_stage" AS ENUM('planning', 'writing', 'review_1', 'review_2', 'review_3', 'publishing');--> statement-breakpoint
CREATE TABLE "audit_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"mission_id" uuid,
	"article_id" uuid,
	"content_type" text NOT NULL,
	"content_id" uuid NOT NULL,
	"stage" "audit_stage" NOT NULL,
	"mode" "audit_mode" NOT NULL,
	"reviewer_type" text NOT NULL,
	"reviewer_id" text NOT NULL,
	"dimensions" jsonb,
	"overall_result" "audit_result" NOT NULL,
	"issues" jsonb DEFAULT '[]'::jsonb,
	"comment" text,
	"content_snapshot" text,
	"diff" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"scenario_key" text,
	"name" text NOT NULL,
	"dimensions" jsonb,
	"review_1_mode" "audit_mode" NOT NULL,
	"review_2_mode" "audit_mode" NOT NULL,
	"review_3_mode" "audit_mode" NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_trail_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"content_id" uuid NOT NULL,
	"content_type" text NOT NULL,
	"operator" text NOT NULL,
	"operator_type" text NOT NULL,
	"action" "trail_action" NOT NULL,
	"stage" "trail_stage" NOT NULL,
	"content_snapshot" text,
	"diff" jsonb,
	"comment" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sensitive_word_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"words" jsonb DEFAULT '[]'::jsonb,
	"category" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_records" ADD CONSTRAINT "audit_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_records" ADD CONSTRAINT "audit_records_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_rules" ADD CONSTRAINT "audit_rules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_trail_logs" ADD CONSTRAINT "content_trail_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensitive_word_lists" ADD CONSTRAINT "sensitive_word_lists_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
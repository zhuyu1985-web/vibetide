CREATE TYPE "public"."benchmark_alert_priority" AS ENUM('urgent', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."benchmark_alert_status" AS ENUM('new', 'acknowledged', 'actioned', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."benchmark_alert_type" AS ENUM('missed_topic', 'competitor_highlight', 'gap_warning', 'trend_alert');--> statement-breakpoint
CREATE TYPE "public"."crawl_status" AS ENUM('active', 'paused', 'error');--> statement-breakpoint
CREATE TYPE "public"."platform_category" AS ENUM('central', 'provincial', 'municipal', 'industry');--> statement-breakpoint
CREATE TABLE "benchmark_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"priority" "benchmark_alert_priority" DEFAULT 'medium' NOT NULL,
	"type" "benchmark_alert_type" NOT NULL,
	"status" "benchmark_alert_status" DEFAULT 'new' NOT NULL,
	"platform_content_ids" jsonb DEFAULT '[]'::jsonb,
	"related_platforms" jsonb DEFAULT '[]'::jsonb,
	"related_topics" jsonb DEFAULT '[]'::jsonb,
	"analysis_data" jsonb DEFAULT '{}'::jsonb,
	"actioned_by" uuid,
	"action_note" text,
	"workflow_instance_id" uuid,
	"generated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitored_platforms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"category" "platform_category" DEFAULT 'central' NOT NULL,
	"province" text,
	"crawl_frequency_minutes" integer DEFAULT 120,
	"status" "crawl_status" DEFAULT 'active' NOT NULL,
	"crawl_config" jsonb DEFAULT '{}'::jsonb,
	"last_crawled_at" timestamp with time zone,
	"last_error_message" text,
	"total_content_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"platform_id" uuid NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"body" text,
	"source_url" text NOT NULL,
	"author" text,
	"published_at" timestamp with time zone,
	"topics" jsonb DEFAULT '[]'::jsonb,
	"category" text,
	"sentiment" text,
	"importance" real DEFAULT 0,
	"content_hash" text,
	"coverage_status" text,
	"gap_analysis" text,
	"crawled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"analyzed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "benchmark_alerts" ADD CONSTRAINT "benchmark_alerts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benchmark_alerts" ADD CONSTRAINT "benchmark_alerts_generated_by_ai_employees_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."ai_employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitored_platforms" ADD CONSTRAINT "monitored_platforms_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_content" ADD CONSTRAINT "platform_content_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_content" ADD CONSTRAINT "platform_content_platform_id_monitored_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."monitored_platforms"("id") ON DELETE cascade ON UPDATE no action;
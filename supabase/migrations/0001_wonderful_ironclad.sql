CREATE TYPE "public"."batch_item_status" AS ENUM('pending', 'processing', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."batch_job_status" AS ENUM('pending', 'processing', 'completed', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."channel_status" AS ENUM('active', 'paused', 'setup');--> statement-breakpoint
CREATE TYPE "public"."conversion_task_status" AS ENUM('pending', 'processing', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."creation_chat_role" AS ENUM('editor', 'ai');--> statement-breakpoint
CREATE TYPE "public"."creation_session_status" AS ENUM('active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."editor_type" AS ENUM('ai', 'human');--> statement-breakpoint
CREATE TYPE "public"."event_output_status" AS ENUM('pending', 'processing', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."event_output_type" AS ENUM('clip', 'summary', 'graphic', 'flash', 'quote_card');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('upcoming', 'live', 'finished');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('sport', 'conference', 'festival', 'exhibition');--> statement-breakpoint
CREATE TYPE "public"."highlight_type" AS ENUM('goal', 'slam_dunk', 'save', 'foul', 'highlight', 'speech', 'announcement');--> statement-breakpoint
CREATE TYPE "public"."missed_topic_priority" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."missed_topic_status" AS ENUM('missed', 'tracking', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."missed_topic_type" AS ENUM('breaking', 'trending', 'analysis');--> statement-breakpoint
CREATE TYPE "public"."publish_status" AS ENUM('scheduled', 'publishing', 'published', 'failed');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'approved', 'rejected', 'escalated');--> statement-breakpoint
CREATE TYPE "public"."topic_angle_status" AS ENUM('suggested', 'accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."topic_priority" AS ENUM('P0', 'P1', 'P2');--> statement-breakpoint
CREATE TYPE "public"."topic_trend" AS ENUM('rising', 'surging', 'plateau', 'declining');--> statement-breakpoint
CREATE TABLE "comment_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hot_topic_id" uuid NOT NULL,
	"positive" real DEFAULT 0 NOT NULL,
	"neutral" real DEFAULT 0 NOT NULL,
	"negative" real DEFAULT 0 NOT NULL,
	"hot_comments" jsonb DEFAULT '[]'::jsonb,
	"analyzed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitor_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hot_topic_id" uuid NOT NULL,
	"competitor_name" text NOT NULL,
	"response_type" text,
	"response_time" text,
	"content_url" text,
	"views" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hot_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"title" text NOT NULL,
	"priority" "topic_priority" DEFAULT 'P1' NOT NULL,
	"heat_score" real DEFAULT 0 NOT NULL,
	"trend" "topic_trend" DEFAULT 'rising' NOT NULL,
	"source" text,
	"category" text,
	"summary" text,
	"heat_curve" jsonb DEFAULT '[]'::jsonb,
	"platforms" jsonb DEFAULT '[]'::jsonb,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topic_angles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hot_topic_id" uuid NOT NULL,
	"angle_text" text NOT NULL,
	"generated_by" uuid,
	"status" "topic_angle_status" DEFAULT 'suggested' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"headline" text,
	"body" text,
	"word_count" integer DEFAULT 0,
	"editor_type" "editor_type" DEFAULT 'ai' NOT NULL,
	"change_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creation_chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" "creation_chat_role" NOT NULL,
	"employee_id" uuid,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creation_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"team_id" uuid,
	"goal_title" text NOT NULL,
	"goal_description" text,
	"media_types" jsonb DEFAULT '[]'::jsonb,
	"status" "creation_session_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "benchmark_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"topic_title" text NOT NULL,
	"category" text,
	"media_scores" jsonb DEFAULT '[]'::jsonb,
	"radar_data" jsonb DEFAULT '[]'::jsonb,
	"improvements" jsonb DEFAULT '[]'::jsonb,
	"analyzed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"name" text NOT NULL,
	"platform" text,
	"followers" integer DEFAULT 0,
	"avg_views" integer DEFAULT 0,
	"publish_freq" text,
	"strengths" jsonb DEFAULT '[]'::jsonb,
	"gaps" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "missed_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"title" text NOT NULL,
	"priority" "missed_topic_priority" DEFAULT 'medium' NOT NULL,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"competitors" jsonb DEFAULT '[]'::jsonb,
	"heat_score" real DEFAULT 0,
	"category" text,
	"type" "missed_topic_type" DEFAULT 'trending' NOT NULL,
	"status" "missed_topic_status" DEFAULT 'missed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"period" text NOT NULL,
	"overall_score" real DEFAULT 0,
	"missed_rate" real DEFAULT 0,
	"response_speed" text,
	"coverage_rate" real DEFAULT 0,
	"trends" jsonb DEFAULT '[]'::jsonb,
	"gap_list" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batch_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_job_id" uuid NOT NULL,
	"topic_title" text NOT NULL,
	"channel" text,
	"format" text,
	"status" "batch_item_status" DEFAULT 'pending' NOT NULL,
	"output_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batch_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"goal_description" text NOT NULL,
	"total_items" integer DEFAULT 0 NOT NULL,
	"completed_items" integer DEFAULT 0 NOT NULL,
	"status" "batch_job_status" DEFAULT 'pending' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversion_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"source_ratio" text NOT NULL,
	"target_ratio" text NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"status" "conversion_task_status" DEFAULT 'pending' NOT NULL,
	"batch_item_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_highlights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"time" text,
	"type" "highlight_type" NOT NULL,
	"description" text,
	"auto_clipped" boolean DEFAULT false,
	"clip_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_outputs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"title" text NOT NULL,
	"type" "event_output_type" NOT NULL,
	"status" "event_output_status" DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0,
	"output_url" text,
	"duration" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_transcriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"speaker" text,
	"content" text NOT NULL,
	"golden_quote" boolean DEFAULT false,
	"timestamp" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"name" text NOT NULL,
	"type" "event_type" NOT NULL,
	"status" "event_status" DEFAULT 'upcoming' NOT NULL,
	"start_time" timestamp with time zone,
	"end_time" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"stats" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"date" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"shares" integer DEFAULT 0 NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"followers" integer DEFAULT 0 NOT NULL,
	"engagement" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"platform" text NOT NULL,
	"icon" text,
	"api_config" jsonb,
	"status" "channel_status" DEFAULT 'setup' NOT NULL,
	"followers" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publish_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"task_id" uuid,
	"title" text NOT NULL,
	"adapted_content" jsonb,
	"status" "publish_status" DEFAULT 'scheduled' NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"published_at" timestamp with time zone,
	"trigger_conditions" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"content_id" text NOT NULL,
	"content_type" text DEFAULT 'article' NOT NULL,
	"reviewer_employee_id" uuid NOT NULL,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"issues" jsonb DEFAULT '[]'::jsonb,
	"score" integer,
	"channel_rules" jsonb,
	"escalated_at" timestamp with time zone,
	"escalation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_library" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"content_id" text NOT NULL,
	"title" text NOT NULL,
	"channel" text,
	"score" integer NOT NULL,
	"success_factors" jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitor_hits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"competitor_name" text NOT NULL,
	"title" text NOT NULL,
	"platform" text NOT NULL,
	"metrics" jsonb,
	"success_factors" jsonb,
	"analyzed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hit_predictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"content_id" text NOT NULL,
	"predicted_score" integer NOT NULL,
	"actual_score" integer,
	"dimensions" jsonb,
	"suggestions" jsonb DEFAULT '[]'::jsonb,
	"suggestions_adopted" integer DEFAULT 0,
	"tracking_started_at" timestamp with time zone,
	"tracking_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "session_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "progress" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "comment_insights" ADD CONSTRAINT "comment_insights_hot_topic_id_hot_topics_id_fk" FOREIGN KEY ("hot_topic_id") REFERENCES "public"."hot_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_responses" ADD CONSTRAINT "competitor_responses_hot_topic_id_hot_topics_id_fk" FOREIGN KEY ("hot_topic_id") REFERENCES "public"."hot_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hot_topics" ADD CONSTRAINT "hot_topics_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_angles" ADD CONSTRAINT "topic_angles_hot_topic_id_hot_topics_id_fk" FOREIGN KEY ("hot_topic_id") REFERENCES "public"."hot_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_angles" ADD CONSTRAINT "topic_angles_generated_by_ai_employees_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."ai_employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creation_chat_messages" ADD CONSTRAINT "creation_chat_messages_session_id_creation_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."creation_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creation_chat_messages" ADD CONSTRAINT "creation_chat_messages_employee_id_ai_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."ai_employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creation_sessions" ADD CONSTRAINT "creation_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creation_sessions" ADD CONSTRAINT "creation_sessions_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "benchmark_analyses" ADD CONSTRAINT "benchmark_analyses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitors" ADD CONSTRAINT "competitors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "missed_topics" ADD CONSTRAINT "missed_topics_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_items" ADD CONSTRAINT "batch_items_batch_job_id_batch_jobs_id_fk" FOREIGN KEY ("batch_job_id") REFERENCES "public"."batch_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batch_jobs" ADD CONSTRAINT "batch_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversion_tasks" ADD CONSTRAINT "conversion_tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversion_tasks" ADD CONSTRAINT "conversion_tasks_batch_item_id_batch_items_id_fk" FOREIGN KEY ("batch_item_id") REFERENCES "public"."batch_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_highlights" ADD CONSTRAINT "event_highlights_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_outputs" ADD CONSTRAINT "event_outputs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_transcriptions" ADD CONSTRAINT "event_transcriptions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_metrics" ADD CONSTRAINT "channel_metrics_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_metrics" ADD CONSTRAINT "channel_metrics_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publish_plans" ADD CONSTRAINT "publish_plans_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publish_plans" ADD CONSTRAINT "publish_plans_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publish_plans" ADD CONSTRAINT "publish_plans_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_results" ADD CONSTRAINT "review_results_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_results" ADD CONSTRAINT "review_results_reviewer_employee_id_ai_employees_id_fk" FOREIGN KEY ("reviewer_employee_id") REFERENCES "public"."ai_employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_library" ADD CONSTRAINT "case_library_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_hits" ADD CONSTRAINT "competitor_hits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hit_predictions" ADD CONSTRAINT "hit_predictions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
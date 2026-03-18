CREATE TYPE "public"."adaptation_status" AS ENUM('completed', 'in_progress', 'pending');--> statement-breakpoint
CREATE TYPE "public"."advisor_status" AS ENUM('active', 'training', 'draft');--> statement-breakpoint
CREATE TYPE "public"."article_status" AS ENUM('draft', 'reviewing', 'approved', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."asset_processing_status" AS ENUM('queued', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."asset_tag_category" AS ENUM('topic', 'event', 'emotion', 'person', 'location', 'shotType', 'quality', 'object', 'action');--> statement-breakpoint
CREATE TYPE "public"."authority_level" AS ENUM('observer', 'advisor', 'executor', 'coordinator');--> statement-breakpoint
CREATE TYPE "public"."employee_status" AS ENUM('working', 'idle', 'learning', 'reviewing');--> statement-breakpoint
CREATE TYPE "public"."entity_type" AS ENUM('topic', 'person', 'event', 'location', 'organization');--> statement-breakpoint
CREATE TYPE "public"."knowledge_source_type" AS ENUM('upload', 'cms', 'subscription');--> statement-breakpoint
CREATE TYPE "public"."media_asset_type" AS ENUM('video', 'image', 'audio', 'document');--> statement-breakpoint
CREATE TYPE "public"."member_type" AS ENUM('ai', 'human');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('alert', 'decision_request', 'status_update', 'work_output');--> statement-breakpoint
CREATE TYPE "public"."revive_scenario" AS ENUM('topic_match', 'hot_match', 'daily_push', 'intl_broadcast', 'style_adapt');--> statement-breakpoint
CREATE TYPE "public"."revive_status" AS ENUM('pending', 'adopted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."skill_category" AS ENUM('perception', 'analysis', 'generation', 'production', 'management', 'knowledge');--> statement-breakpoint
CREATE TYPE "public"."skill_type" AS ENUM('builtin', 'custom', 'plugin');--> statement-breakpoint
CREATE TYPE "public"."sync_log_status" AS ENUM('success', 'error', 'warning');--> statement-breakpoint
CREATE TYPE "public"."tag_source" AS ENUM('ai_auto', 'human_correct');--> statement-breakpoint
CREATE TYPE "public"."vectorization_status" AS ENUM('pending', 'processing', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."workflow_step_status" AS ENUM('completed', 'active', 'pending', 'skipped', 'waiting_approval', 'failed');--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid,
	"display_name" text NOT NULL,
	"role" text DEFAULT 'editor' NOT NULL,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"nickname" text NOT NULL,
	"title" text NOT NULL,
	"motto" text,
	"role_type" text NOT NULL,
	"authority_level" "authority_level" DEFAULT 'advisor' NOT NULL,
	"auto_actions" jsonb DEFAULT '[]'::jsonb,
	"need_approval_actions" jsonb DEFAULT '[]'::jsonb,
	"status" "employee_status" DEFAULT 'idle' NOT NULL,
	"current_task" text,
	"work_preferences" jsonb,
	"learned_patterns" jsonb DEFAULT '[]'::jsonb,
	"tasks_completed" integer DEFAULT 0 NOT NULL,
	"accuracy" real DEFAULT 0 NOT NULL,
	"avg_response_time" text DEFAULT '0s' NOT NULL,
	"satisfaction" real DEFAULT 0 NOT NULL,
	"is_preset" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"level" integer DEFAULT 50 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"name" text NOT NULL,
	"category" "skill_category" NOT NULL,
	"type" "skill_type" DEFAULT 'builtin' NOT NULL,
	"version" text DEFAULT '1.0' NOT NULL,
	"description" text NOT NULL,
	"input_schema" jsonb,
	"output_schema" jsonb,
	"runtime_config" jsonb,
	"compatible_roles" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"member_type" "member_type" NOT NULL,
	"ai_employee_id" uuid,
	"user_id" uuid,
	"display_name" text NOT NULL,
	"team_role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"scenario" text NOT NULL,
	"rules" jsonb NOT NULL,
	"workflow_template_id" uuid,
	"escalation_policy" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid,
	"template_id" uuid,
	"topic_id" text,
	"topic_title" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"inngest_run_id" text,
	"current_step_key" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"estimated_completion" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workflow_instance_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"employee_id" uuid,
	"step_order" integer NOT NULL,
	"status" "workflow_step_status" DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"output" text,
	"structured_output" jsonb,
	"error_message" text,
	"retry_count" integer DEFAULT 0,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "workflow_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"steps" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid,
	"sender_type" text NOT NULL,
	"ai_employee_id" uuid,
	"user_id" uuid,
	"workflow_instance_id" uuid,
	"workflow_step_key" text,
	"type" "message_type" NOT NULL,
	"content" text NOT NULL,
	"actions" jsonb,
	"attachments" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"team_id" uuid,
	"assignee_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"media_type" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" text DEFAULT 'P1',
	"content" jsonb,
	"advisor_notes" jsonb,
	"word_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_knowledge_bases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"knowledge_base_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_bases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'general' NOT NULL,
	"document_count" integer DEFAULT 0,
	"vectorization_status" vectorization_status DEFAULT 'pending' NOT NULL,
	"chunk_count" integer DEFAULT 0,
	"last_sync_at" timestamp with time zone,
	"sync_config" jsonb,
	"source_url" text,
	"source_type" "knowledge_source_type" DEFAULT 'upload' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"knowledge_base_id" uuid NOT NULL,
	"title" text,
	"snippet" text,
	"full_content" text,
	"source_document" text,
	"source_type" "knowledge_source_type" DEFAULT 'upload' NOT NULL,
	"chunk_index" integer DEFAULT 0,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"embedding" jsonb,
	"embedding_model" text,
	"relevance_score" real,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_sync_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"knowledge_base_id" uuid NOT NULL,
	"action" text NOT NULL,
	"status" "sync_log_status" NOT NULL,
	"detail" text,
	"documents_processed" integer DEFAULT 0,
	"chunks_generated" integer DEFAULT 0,
	"errors_count" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"parent_id" uuid,
	"level" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"type" "media_asset_type" NOT NULL,
	"description" text,
	"file_url" text,
	"thumbnail_url" text,
	"file_name" text,
	"file_size" bigint,
	"file_size_display" text,
	"mime_type" text,
	"duration" text,
	"duration_seconds" integer,
	"source" text,
	"source_id" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"understanding_status" "asset_processing_status" DEFAULT 'queued' NOT NULL,
	"understanding_progress" integer DEFAULT 0 NOT NULL,
	"total_tags" integer DEFAULT 0 NOT NULL,
	"processed_at" timestamp with time zone,
	"category_id" uuid,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "article_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"usage_type" text DEFAULT 'reference' NOT NULL,
	"caption" text,
	"sort_order" integer DEFAULT 0,
	"segment_id" uuid,
	"start_time" text,
	"end_time" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"slug" text,
	"body" text,
	"summary" text,
	"content" jsonb,
	"media_type" text DEFAULT 'article' NOT NULL,
	"status" "article_status" DEFAULT 'draft' NOT NULL,
	"priority" text DEFAULT 'P1',
	"category_id" uuid,
	"assignee_id" uuid,
	"team_id" uuid,
	"created_by" uuid,
	"advisor_notes" jsonb,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"word_count" integer DEFAULT 0,
	"version" integer DEFAULT 1,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"task_id" uuid,
	"workflow_instance_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"start_time" text,
	"end_time" text,
	"start_time_seconds" real,
	"end_time_seconds" real,
	"transcript" text,
	"ocr_texts" jsonb DEFAULT '[]'::jsonb,
	"nlu_summary" text,
	"scene_type" text,
	"visual_quality" real,
	"segment_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL,
	"segment_id" uuid,
	"category" "asset_tag_category" NOT NULL,
	"label" text NOT NULL,
	"confidence" real DEFAULT 0 NOT NULL,
	"source" "tag_source" DEFAULT 'ai_auto' NOT NULL,
	"corrected_by" uuid,
	"original_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "detected_faces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"segment_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"confidence" real DEFAULT 0 NOT NULL,
	"appearances" integer DEFAULT 1,
	"bounding_box" jsonb,
	"thumbnail_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"entity_name" text NOT NULL,
	"description" text,
	"metadata" jsonb,
	"connection_count" integer DEFAULT 0 NOT NULL,
	"source_asset_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_node_id" uuid NOT NULL,
	"target_node_id" uuid NOT NULL,
	"relation_type" text NOT NULL,
	"weight" real DEFAULT 1,
	"metadata" jsonb,
	"source_asset_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_advisors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"channel_type" text NOT NULL,
	"personality" text NOT NULL,
	"avatar" text,
	"style" text,
	"strengths" jsonb DEFAULT '[]'::jsonb,
	"catchphrase" text,
	"system_prompt" text,
	"style_constraints" jsonb,
	"status" "advisor_status" DEFAULT 'draft' NOT NULL,
	"ai_employee_id" uuid,
	"target_audience" text,
	"channel_positioning" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_dna_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"advisor_id" uuid NOT NULL,
	"dimensions" jsonb DEFAULT '[]'::jsonb,
	"report" text,
	"word_cloud" jsonb,
	"style_examples" jsonb,
	"analyzed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "international_adaptations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source_asset_id" uuid NOT NULL,
	"language" text NOT NULL,
	"language_code" text NOT NULL,
	"flag" text,
	"generated_title" text,
	"generated_excerpt" text,
	"adaptation_notes" text,
	"status" "adaptation_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "revive_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"scenario" "revive_scenario" NOT NULL,
	"matched_topic" text,
	"reason" text,
	"match_score" real DEFAULT 0 NOT NULL,
	"suggested_action" text,
	"estimated_reach" text,
	"status" "revive_status" DEFAULT 'pending' NOT NULL,
	"adopted_by" uuid,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revive_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"recommendation_id" uuid,
	"asset_id" uuid NOT NULL,
	"scenario" "revive_scenario" NOT NULL,
	"result_reach" integer,
	"created_content_id" uuid,
	"summary" text,
	"status" text DEFAULT 'pending',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "style_adaptations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"source_asset_id" uuid NOT NULL,
	"style" text NOT NULL,
	"style_label" text,
	"generated_title" text,
	"generated_excerpt" text,
	"tone" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_employees" ADD CONSTRAINT "ai_employees_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_skills" ADD CONSTRAINT "employee_skills_employee_id_ai_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."ai_employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_skills" ADD CONSTRAINT "employee_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_ai_employee_id_ai_employees_id_fk" FOREIGN KEY ("ai_employee_id") REFERENCES "public"."ai_employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_instances" ADD CONSTRAINT "workflow_instances_template_id_workflow_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workflow_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_workflow_instance_id_workflow_instances_id_fk" FOREIGN KEY ("workflow_instance_id") REFERENCES "public"."workflow_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_employee_id_ai_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."ai_employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_templates" ADD CONSTRAINT "workflow_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_messages" ADD CONSTRAINT "team_messages_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_messages" ADD CONSTRAINT "team_messages_ai_employee_id_ai_employees_id_fk" FOREIGN KEY ("ai_employee_id") REFERENCES "public"."ai_employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_messages" ADD CONSTRAINT "team_messages_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_messages" ADD CONSTRAINT "team_messages_workflow_instance_id_workflow_instances_id_fk" FOREIGN KEY ("workflow_instance_id") REFERENCES "public"."workflow_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_ai_employees_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."ai_employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_knowledge_bases" ADD CONSTRAINT "employee_knowledge_bases_employee_id_ai_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."ai_employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_knowledge_bases" ADD CONSTRAINT "employee_knowledge_bases_knowledge_base_id_knowledge_bases_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."knowledge_bases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_bases" ADD CONSTRAINT "knowledge_bases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_knowledge_base_id_knowledge_bases_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."knowledge_bases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_sync_logs" ADD CONSTRAINT "knowledge_sync_logs_knowledge_base_id_knowledge_bases_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."knowledge_bases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_user_profiles_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_assets" ADD CONSTRAINT "article_assets_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_assets" ADD CONSTRAINT "article_assets_asset_id_media_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_assignee_id_ai_employees_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."ai_employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_created_by_user_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_workflow_instance_id_workflow_instances_id_fk" FOREIGN KEY ("workflow_instance_id") REFERENCES "public"."workflow_instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_segments" ADD CONSTRAINT "asset_segments_asset_id_media_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_tags" ADD CONSTRAINT "asset_tags_asset_id_media_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_tags" ADD CONSTRAINT "asset_tags_segment_id_asset_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."asset_segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_tags" ADD CONSTRAINT "asset_tags_corrected_by_user_profiles_id_fk" FOREIGN KEY ("corrected_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detected_faces" ADD CONSTRAINT "detected_faces_segment_id_asset_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."asset_segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "detected_faces" ADD CONSTRAINT "detected_faces_asset_id_media_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_nodes" ADD CONSTRAINT "knowledge_nodes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_nodes" ADD CONSTRAINT "knowledge_nodes_source_asset_id_media_assets_id_fk" FOREIGN KEY ("source_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_relations" ADD CONSTRAINT "knowledge_relations_source_node_id_knowledge_nodes_id_fk" FOREIGN KEY ("source_node_id") REFERENCES "public"."knowledge_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_relations" ADD CONSTRAINT "knowledge_relations_target_node_id_knowledge_nodes_id_fk" FOREIGN KEY ("target_node_id") REFERENCES "public"."knowledge_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_relations" ADD CONSTRAINT "knowledge_relations_source_asset_id_media_assets_id_fk" FOREIGN KEY ("source_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_advisors" ADD CONSTRAINT "channel_advisors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_advisors" ADD CONSTRAINT "channel_advisors_ai_employee_id_ai_employees_id_fk" FOREIGN KEY ("ai_employee_id") REFERENCES "public"."ai_employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_dna_profiles" ADD CONSTRAINT "channel_dna_profiles_advisor_id_channel_advisors_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."channel_advisors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "international_adaptations" ADD CONSTRAINT "international_adaptations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "international_adaptations" ADD CONSTRAINT "international_adaptations_source_asset_id_media_assets_id_fk" FOREIGN KEY ("source_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revive_recommendations" ADD CONSTRAINT "revive_recommendations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revive_recommendations" ADD CONSTRAINT "revive_recommendations_asset_id_media_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revive_recommendations" ADD CONSTRAINT "revive_recommendations_adopted_by_user_profiles_id_fk" FOREIGN KEY ("adopted_by") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revive_records" ADD CONSTRAINT "revive_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revive_records" ADD CONSTRAINT "revive_records_recommendation_id_revive_recommendations_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."revive_recommendations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revive_records" ADD CONSTRAINT "revive_records_asset_id_media_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_adaptations" ADD CONSTRAINT "style_adaptations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "style_adaptations" ADD CONSTRAINT "style_adaptations_source_asset_id_media_assets_id_fk" FOREIGN KEY ("source_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE no action ON UPDATE no action;
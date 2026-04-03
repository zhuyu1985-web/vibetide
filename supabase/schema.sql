


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "drizzle";


ALTER SCHEMA "drizzle" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."adaptation_status" AS ENUM (
    'completed',
    'in_progress',
    'pending'
);


ALTER TYPE "public"."adaptation_status" OWNER TO "postgres";


CREATE TYPE "public"."advisor_status" AS ENUM (
    'active',
    'training',
    'draft'
);


ALTER TYPE "public"."advisor_status" OWNER TO "postgres";


CREATE TYPE "public"."ai_analysis_perspective" AS ENUM (
    'summary',
    'journalist',
    'quotes',
    'timeline',
    'qa',
    'deep'
);


ALTER TYPE "public"."ai_analysis_perspective" OWNER TO "postgres";


CREATE TYPE "public"."ai_sentiment" AS ENUM (
    'neutral',
    'bullish',
    'critical',
    'advertorial'
);


ALTER TYPE "public"."ai_sentiment" OWNER TO "postgres";


CREATE TYPE "public"."annotation_color" AS ENUM (
    'red',
    'yellow',
    'green',
    'blue',
    'purple'
);


ALTER TYPE "public"."annotation_color" OWNER TO "postgres";


CREATE TYPE "public"."article_status" AS ENUM (
    'draft',
    'reviewing',
    'approved',
    'published',
    'archived'
);


ALTER TYPE "public"."article_status" OWNER TO "postgres";


CREATE TYPE "public"."artifact_type" AS ENUM (
    'topic_brief',
    'angle_list',
    'material_pack',
    'article_draft',
    'video_plan',
    'review_report',
    'publish_plan',
    'analytics_report',
    'generic'
);


ALTER TYPE "public"."artifact_type" OWNER TO "postgres";


CREATE TYPE "public"."asset_processing_status" AS ENUM (
    'queued',
    'processing',
    'completed',
    'failed'
);


ALTER TYPE "public"."asset_processing_status" OWNER TO "postgres";


CREATE TYPE "public"."asset_tag_category" AS ENUM (
    'topic',
    'event',
    'emotion',
    'person',
    'location',
    'shotType',
    'quality',
    'object',
    'action'
);


ALTER TYPE "public"."asset_tag_category" OWNER TO "postgres";


CREATE TYPE "public"."authority_level" AS ENUM (
    'observer',
    'advisor',
    'executor',
    'coordinator'
);


ALTER TYPE "public"."authority_level" OWNER TO "postgres";


CREATE TYPE "public"."batch_item_status" AS ENUM (
    'pending',
    'processing',
    'done',
    'failed'
);


ALTER TYPE "public"."batch_item_status" OWNER TO "postgres";


CREATE TYPE "public"."batch_job_status" AS ENUM (
    'pending',
    'processing',
    'completed',
    'cancelled',
    'failed'
);


ALTER TYPE "public"."batch_job_status" OWNER TO "postgres";


CREATE TYPE "public"."benchmark_alert_priority" AS ENUM (
    'urgent',
    'high',
    'medium',
    'low'
);


ALTER TYPE "public"."benchmark_alert_priority" OWNER TO "postgres";


CREATE TYPE "public"."benchmark_alert_status" AS ENUM (
    'new',
    'acknowledged',
    'actioned',
    'dismissed'
);


ALTER TYPE "public"."benchmark_alert_status" OWNER TO "postgres";


CREATE TYPE "public"."benchmark_alert_type" AS ENUM (
    'missed_topic',
    'competitor_highlight',
    'gap_warning',
    'trend_alert'
);


ALTER TYPE "public"."benchmark_alert_type" OWNER TO "postgres";


CREATE TYPE "public"."calendar_event_type" AS ENUM (
    'festival',
    'competition',
    'conference',
    'exhibition',
    'launch',
    'memorial'
);


ALTER TYPE "public"."calendar_event_type" OWNER TO "postgres";


CREATE TYPE "public"."calendar_recurrence" AS ENUM (
    'once',
    'yearly',
    'custom'
);


ALTER TYPE "public"."calendar_recurrence" OWNER TO "postgres";


CREATE TYPE "public"."calendar_source" AS ENUM (
    'builtin',
    'manual',
    'ai_discovered'
);


ALTER TYPE "public"."calendar_source" OWNER TO "postgres";


CREATE TYPE "public"."calendar_status" AS ENUM (
    'confirmed',
    'pending_review'
);


ALTER TYPE "public"."calendar_status" OWNER TO "postgres";


CREATE TYPE "public"."category_permission_type" AS ENUM (
    'read',
    'write',
    'manage'
);


ALTER TYPE "public"."category_permission_type" OWNER TO "postgres";


CREATE TYPE "public"."channel_status" AS ENUM (
    'active',
    'paused',
    'setup'
);


ALTER TYPE "public"."channel_status" OWNER TO "postgres";


CREATE TYPE "public"."conversion_task_status" AS ENUM (
    'pending',
    'processing',
    'done',
    'failed'
);


ALTER TYPE "public"."conversion_task_status" OWNER TO "postgres";


CREATE TYPE "public"."crawl_status" AS ENUM (
    'active',
    'paused',
    'error'
);


ALTER TYPE "public"."crawl_status" OWNER TO "postgres";


CREATE TYPE "public"."creation_chat_role" AS ENUM (
    'editor',
    'ai'
);


ALTER TYPE "public"."creation_chat_role" OWNER TO "postgres";


CREATE TYPE "public"."creation_session_status" AS ENUM (
    'active',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."creation_session_status" OWNER TO "postgres";


CREATE TYPE "public"."editor_type" AS ENUM (
    'ai',
    'human'
);


ALTER TYPE "public"."editor_type" OWNER TO "postgres";


CREATE TYPE "public"."employee_status" AS ENUM (
    'working',
    'idle',
    'learning',
    'reviewing'
);


ALTER TYPE "public"."employee_status" OWNER TO "postgres";


CREATE TYPE "public"."entity_type" AS ENUM (
    'topic',
    'person',
    'event',
    'location',
    'organization'
);


ALTER TYPE "public"."entity_type" OWNER TO "postgres";


CREATE TYPE "public"."event_output_status" AS ENUM (
    'pending',
    'processing',
    'done',
    'failed'
);


ALTER TYPE "public"."event_output_status" OWNER TO "postgres";


CREATE TYPE "public"."event_output_type" AS ENUM (
    'clip',
    'summary',
    'graphic',
    'flash',
    'quote_card'
);


ALTER TYPE "public"."event_output_type" OWNER TO "postgres";


CREATE TYPE "public"."event_status" AS ENUM (
    'upcoming',
    'live',
    'finished'
);


ALTER TYPE "public"."event_status" OWNER TO "postgres";


CREATE TYPE "public"."event_type" AS ENUM (
    'sport',
    'conference',
    'festival',
    'exhibition'
);


ALTER TYPE "public"."event_type" OWNER TO "postgres";


CREATE TYPE "public"."feedback_type" AS ENUM (
    'accept',
    'reject',
    'edit'
);


ALTER TYPE "public"."feedback_type" OWNER TO "postgres";


CREATE TYPE "public"."highlight_type" AS ENUM (
    'goal',
    'slam_dunk',
    'save',
    'foul',
    'highlight',
    'speech',
    'announcement'
);


ALTER TYPE "public"."highlight_type" OWNER TO "postgres";


CREATE TYPE "public"."knowledge_source_type" AS ENUM (
    'upload',
    'cms',
    'subscription'
);


ALTER TYPE "public"."knowledge_source_type" OWNER TO "postgres";


CREATE TYPE "public"."library_type" AS ENUM (
    'personal',
    'product',
    'public'
);


ALTER TYPE "public"."library_type" OWNER TO "postgres";


CREATE TYPE "public"."media_asset_type" AS ENUM (
    'video',
    'image',
    'audio',
    'document',
    'manuscript'
);


ALTER TYPE "public"."media_asset_type" OWNER TO "postgres";


CREATE TYPE "public"."media_catalog_status" AS ENUM (
    'uncataloged',
    'cataloged'
);


ALTER TYPE "public"."media_catalog_status" OWNER TO "postgres";


CREATE TYPE "public"."media_cdn_status" AS ENUM (
    'not_started',
    'processing',
    'completed',
    'failed',
    'revoked'
);


ALTER TYPE "public"."media_cdn_status" OWNER TO "postgres";


CREATE TYPE "public"."media_cms_status" AS ENUM (
    'not_started',
    'processing',
    'completed',
    'failed',
    'revoked'
);


ALTER TYPE "public"."media_cms_status" OWNER TO "postgres";


CREATE TYPE "public"."media_review_status" AS ENUM (
    'not_submitted',
    'pending',
    'reviewing',
    'approved',
    'rejected'
);


ALTER TYPE "public"."media_review_status" OWNER TO "postgres";


CREATE TYPE "public"."media_transcode_status" AS ENUM (
    'not_started',
    'processing',
    'completed',
    'failed',
    'cancelled'
);


ALTER TYPE "public"."media_transcode_status" OWNER TO "postgres";


CREATE TYPE "public"."memory_type" AS ENUM (
    'feedback',
    'pattern',
    'preference'
);


ALTER TYPE "public"."memory_type" OWNER TO "postgres";


CREATE TYPE "public"."missed_topic_priority" AS ENUM (
    'high',
    'medium',
    'low'
);


ALTER TYPE "public"."missed_topic_priority" OWNER TO "postgres";


CREATE TYPE "public"."missed_topic_status" AS ENUM (
    'missed',
    'tracking',
    'resolved'
);


ALTER TYPE "public"."missed_topic_status" OWNER TO "postgres";


CREATE TYPE "public"."missed_topic_type" AS ENUM (
    'breaking',
    'trending',
    'analysis'
);


ALTER TYPE "public"."missed_topic_type" OWNER TO "postgres";


CREATE TYPE "public"."mission_message_type" AS ENUM (
    'chat',
    'question',
    'answer',
    'data_handoff',
    'progress_update',
    'task_completed',
    'task_failed',
    'help_request',
    'status_update',
    'result',
    'coordination'
);


ALTER TYPE "public"."mission_message_type" OWNER TO "postgres";


CREATE TYPE "public"."mission_phase" AS ENUM (
    'assembling',
    'decomposing',
    'executing',
    'coordinating',
    'delivering'
);


ALTER TYPE "public"."mission_phase" OWNER TO "postgres";


CREATE TYPE "public"."mission_status" AS ENUM (
    'queued',
    'planning',
    'executing',
    'coordinating',
    'consolidating',
    'completed',
    'failed',
    'cancelled'
);


ALTER TYPE "public"."mission_status" OWNER TO "postgres";


CREATE TYPE "public"."mission_task_status" AS ENUM (
    'pending',
    'ready',
    'claimed',
    'in_progress',
    'in_review',
    'completed',
    'failed',
    'cancelled',
    'blocked'
);


ALTER TYPE "public"."mission_task_status" OWNER TO "postgres";


CREATE TYPE "public"."permission_grantee_type" AS ENUM (
    'user',
    'role'
);


ALTER TYPE "public"."permission_grantee_type" OWNER TO "postgres";


CREATE TYPE "public"."platform_category" AS ENUM (
    'central',
    'provincial',
    'municipal',
    'industry'
);


ALTER TYPE "public"."platform_category" OWNER TO "postgres";


CREATE TYPE "public"."publish_status" AS ENUM (
    'scheduled',
    'publishing',
    'published',
    'failed'
);


ALTER TYPE "public"."publish_status" OWNER TO "postgres";


CREATE TYPE "public"."review_status" AS ENUM (
    'pending',
    'approved',
    'rejected',
    'escalated'
);


ALTER TYPE "public"."review_status" OWNER TO "postgres";


CREATE TYPE "public"."revive_scenario" AS ENUM (
    'topic_match',
    'hot_match',
    'daily_push',
    'intl_broadcast',
    'style_adapt'
);


ALTER TYPE "public"."revive_scenario" OWNER TO "postgres";


CREATE TYPE "public"."revive_status" AS ENUM (
    'pending',
    'adopted',
    'rejected'
);


ALTER TYPE "public"."revive_status" OWNER TO "postgres";


CREATE TYPE "public"."security_level" AS ENUM (
    'public',
    'secret',
    'private',
    'top_secret',
    'confidential'
);


ALTER TYPE "public"."security_level" OWNER TO "postgres";


CREATE TYPE "public"."share_status" AS ENUM (
    'active',
    'expired',
    'cancelled'
);


ALTER TYPE "public"."share_status" OWNER TO "postgres";


CREATE TYPE "public"."skill_binding_type" AS ENUM (
    'core',
    'extended',
    'knowledge'
);


ALTER TYPE "public"."skill_binding_type" OWNER TO "postgres";


CREATE TYPE "public"."skill_category" AS ENUM (
    'perception',
    'analysis',
    'generation',
    'production',
    'management',
    'knowledge'
);


ALTER TYPE "public"."skill_category" OWNER TO "postgres";


CREATE TYPE "public"."skill_type" AS ENUM (
    'builtin',
    'custom',
    'plugin'
);


ALTER TYPE "public"."skill_type" OWNER TO "postgres";


CREATE TYPE "public"."sync_log_status" AS ENUM (
    'success',
    'error',
    'warning'
);


ALTER TYPE "public"."sync_log_status" OWNER TO "postgres";


CREATE TYPE "public"."tag_source" AS ENUM (
    'ai_auto',
    'human_correct'
);


ALTER TYPE "public"."tag_source" OWNER TO "postgres";


CREATE TYPE "public"."topic_angle_status" AS ENUM (
    'suggested',
    'accepted',
    'rejected'
);


ALTER TYPE "public"."topic_angle_status" OWNER TO "postgres";


CREATE TYPE "public"."topic_priority" AS ENUM (
    'P0',
    'P1',
    'P2'
);


ALTER TYPE "public"."topic_priority" OWNER TO "postgres";


CREATE TYPE "public"."topic_trend" AS ENUM (
    'rising',
    'surging',
    'plateau',
    'declining'
);


ALTER TYPE "public"."topic_trend" OWNER TO "postgres";


CREATE TYPE "public"."vectorization_status" AS ENUM (
    'pending',
    'processing',
    'done',
    'failed'
);


ALTER TYPE "public"."vectorization_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
    "id" integer NOT NULL,
    "hash" "text" NOT NULL,
    "created_at" bigint
);


ALTER TABLE "drizzle"."__drizzle_migrations" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "drizzle"."__drizzle_migrations_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "drizzle"."__drizzle_migrations_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "drizzle"."__drizzle_migrations_id_seq" OWNED BY "drizzle"."__drizzle_migrations"."id";



CREATE TABLE IF NOT EXISTS "public"."advisor_ab_tests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "advisor_a_id" "uuid" NOT NULL,
    "advisor_b_id" "uuid" NOT NULL,
    "config_diff" "jsonb",
    "status" "text" DEFAULT 'active'::"text",
    "metrics" "jsonb",
    "sample_size" "jsonb",
    "winner" "text",
    "confidence" real,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "ended_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."advisor_ab_tests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."advisor_compare_tests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "test_input" "text" NOT NULL,
    "advisor_ids" "jsonb" NOT NULL,
    "results" "jsonb",
    "selected_winner" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."advisor_compare_tests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ai_employees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "nickname" "text" NOT NULL,
    "title" "text" NOT NULL,
    "motto" "text",
    "role_type" "text" NOT NULL,
    "authority_level" "public"."authority_level" DEFAULT 'advisor'::"public"."authority_level" NOT NULL,
    "auto_actions" "jsonb" DEFAULT '[]'::"jsonb",
    "need_approval_actions" "jsonb" DEFAULT '[]'::"jsonb",
    "status" "public"."employee_status" DEFAULT 'idle'::"public"."employee_status" NOT NULL,
    "current_task" "text",
    "work_preferences" "jsonb",
    "learned_patterns" "jsonb" DEFAULT '{}'::"jsonb",
    "tasks_completed" integer DEFAULT 0 NOT NULL,
    "accuracy" real DEFAULT 0 NOT NULL,
    "avg_response_time" "text" DEFAULT '0s'::"text" NOT NULL,
    "satisfaction" real DEFAULT 0 NOT NULL,
    "is_preset" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "disabled" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."ai_employees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."article_ai_analysis" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "article_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "perspective" "public"."ai_analysis_perspective" NOT NULL,
    "analysis_text" "text" NOT NULL,
    "sentiment" "public"."ai_sentiment",
    "metadata" "jsonb",
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."article_ai_analysis" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."article_annotations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "article_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "quote" "text" NOT NULL,
    "note" "text",
    "color" "public"."annotation_color" DEFAULT 'yellow'::"public"."annotation_color" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "timecode" numeric,
    "frame_snapshot" "text",
    "is_pinned" boolean DEFAULT false NOT NULL,
    "pinned_position" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."article_annotations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."article_assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "article_id" "uuid" NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "usage_type" "text" DEFAULT 'reference'::"text" NOT NULL,
    "caption" "text",
    "sort_order" integer DEFAULT 0,
    "segment_id" "uuid",
    "start_time" "text",
    "end_time" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."article_assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."article_chat_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "article_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" character varying(10) NOT NULL,
    "content" "text" NOT NULL,
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."article_chat_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."articles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "subtitle" "text",
    "slug" "text",
    "body" "text",
    "summary" "text",
    "content" "jsonb",
    "media_type" "text" DEFAULT 'article'::"text" NOT NULL,
    "status" "public"."article_status" DEFAULT 'draft'::"public"."article_status" NOT NULL,
    "priority" "text" DEFAULT 'P1'::"text",
    "category_id" "uuid",
    "assignee_id" "uuid",
    "created_by" "uuid",
    "advisor_notes" "jsonb",
    "tags" "jsonb" DEFAULT '[]'::"jsonb",
    "word_count" integer DEFAULT 0,
    "version" integer DEFAULT 1,
    "published_at" timestamp with time zone,
    "archived_at" timestamp with time zone,
    "task_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "mission_id" "uuid",
    "web_archive_html" "text",
    "web_archive_at" timestamp with time zone,
    "read_progress" integer DEFAULT 0,
    "transcript" "jsonb",
    "chapters" "jsonb"
);


ALTER TABLE "public"."articles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."asset_segments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "start_time" "text",
    "end_time" "text",
    "start_time_seconds" real,
    "end_time_seconds" real,
    "transcript" "text",
    "ocr_texts" "jsonb" DEFAULT '[]'::"jsonb",
    "nlu_summary" "text",
    "scene_type" "text",
    "visual_quality" real,
    "segment_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."asset_segments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."asset_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "segment_id" "uuid",
    "category" "public"."asset_tag_category" NOT NULL,
    "label" "text" NOT NULL,
    "confidence" real DEFAULT 0 NOT NULL,
    "source" "public"."tag_source" DEFAULT 'ai_auto'::"public"."tag_source" NOT NULL,
    "corrected_by" "uuid",
    "original_label" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."asset_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."batch_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "batch_job_id" "uuid" NOT NULL,
    "topic_title" "text" NOT NULL,
    "channel" "text",
    "format" "text",
    "status" "public"."batch_item_status" DEFAULT 'pending'::"public"."batch_item_status" NOT NULL,
    "output_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."batch_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."batch_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "goal_description" "text" NOT NULL,
    "total_items" integer DEFAULT 0 NOT NULL,
    "completed_items" integer DEFAULT 0 NOT NULL,
    "status" "public"."batch_job_status" DEFAULT 'pending'::"public"."batch_job_status" NOT NULL,
    "scheduled_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."batch_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."benchmark_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "priority" "public"."benchmark_alert_priority" DEFAULT 'medium'::"public"."benchmark_alert_priority" NOT NULL,
    "type" "public"."benchmark_alert_type" NOT NULL,
    "status" "public"."benchmark_alert_status" DEFAULT 'new'::"public"."benchmark_alert_status" NOT NULL,
    "platform_content_ids" "jsonb" DEFAULT '[]'::"jsonb",
    "related_platforms" "jsonb" DEFAULT '[]'::"jsonb",
    "related_topics" "jsonb" DEFAULT '[]'::"jsonb",
    "analysis_data" "jsonb" DEFAULT '{}'::"jsonb",
    "actioned_by" "uuid",
    "action_note" "text",
    "workflow_instance_id" "uuid",
    "generated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."benchmark_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."benchmark_analyses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "topic_title" "text" NOT NULL,
    "category" "text",
    "media_scores" "jsonb" DEFAULT '[]'::"jsonb",
    "radar_data" "jsonb" DEFAULT '[]'::"jsonb",
    "improvements" "jsonb" DEFAULT '[]'::"jsonb",
    "analyzed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."benchmark_analyses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calendar_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "event_type" "public"."calendar_event_type" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "is_all_day" boolean DEFAULT true NOT NULL,
    "recurrence" "public"."calendar_recurrence" DEFAULT 'once'::"public"."calendar_recurrence" NOT NULL,
    "source" "public"."calendar_source" NOT NULL,
    "status" "public"."calendar_status" DEFAULT 'confirmed'::"public"."calendar_status" NOT NULL,
    "ai_angles" "jsonb" DEFAULT '[]'::"jsonb",
    "reminder_days_before" integer DEFAULT 3 NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."calendar_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."case_library" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "content_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "channel" "text",
    "score" integer NOT NULL,
    "success_factors" "jsonb",
    "tags" "jsonb" DEFAULT '[]'::"jsonb",
    "published_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."case_library" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "parent_id" "uuid",
    "level" integer DEFAULT 0 NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "scope" "text" DEFAULT 'article'::"text" NOT NULL,
    "workflow_id" "uuid",
    "video_transcode_group" "text",
    "audio_transcode_group" "text",
    "catalog_template_id" "text"
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."category_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "grantee_type" "public"."permission_grantee_type" NOT NULL,
    "grantee_id" "text" NOT NULL,
    "permission_type" "public"."category_permission_type" NOT NULL,
    "inherited" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."category_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."channel_advisors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "channel_type" "text" NOT NULL,
    "personality" "text" NOT NULL,
    "avatar" "text",
    "style" "text",
    "strengths" "jsonb" DEFAULT '[]'::"jsonb",
    "catchphrase" "text",
    "system_prompt" "text",
    "style_constraints" "jsonb",
    "status" "public"."advisor_status" DEFAULT 'draft'::"public"."advisor_status" NOT NULL,
    "ai_employee_id" "uuid",
    "target_audience" "text",
    "channel_positioning" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."channel_advisors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."channel_dna_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "advisor_id" "uuid" NOT NULL,
    "dimensions" "jsonb" DEFAULT '[]'::"jsonb",
    "report" "text",
    "word_cloud" "jsonb",
    "style_examples" "jsonb",
    "analyzed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."channel_dna_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."channel_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "views" integer DEFAULT 0 NOT NULL,
    "likes" integer DEFAULT 0 NOT NULL,
    "shares" integer DEFAULT 0 NOT NULL,
    "comments" integer DEFAULT 0 NOT NULL,
    "followers" integer DEFAULT 0 NOT NULL,
    "engagement" real DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."channel_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."channels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "platform" "text" NOT NULL,
    "icon" "text",
    "api_config" "jsonb",
    "status" "public"."channel_status" DEFAULT 'setup'::"public"."channel_status" NOT NULL,
    "followers" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."channels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comment_insights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hot_topic_id" "uuid" NOT NULL,
    "positive" real DEFAULT 0 NOT NULL,
    "neutral" real DEFAULT 0 NOT NULL,
    "negative" real DEFAULT 0 NOT NULL,
    "hot_comments" "jsonb" DEFAULT '[]'::"jsonb",
    "analyzed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."comment_insights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."competitor_hits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "competitor_name" "text" NOT NULL,
    "title" "text" NOT NULL,
    "platform" "text" NOT NULL,
    "metrics" "jsonb",
    "success_factors" "jsonb",
    "analyzed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."competitor_hits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."competitor_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hot_topic_id" "uuid" NOT NULL,
    "competitor_name" "text" NOT NULL,
    "response_type" "text",
    "response_time" "text",
    "content_url" "text",
    "views" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."competitor_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."competitors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "name" "text" NOT NULL,
    "platform" "text",
    "followers" integer DEFAULT 0,
    "avg_views" integer DEFAULT 0,
    "publish_freq" "text",
    "strengths" "jsonb" DEFAULT '[]'::"jsonb",
    "gaps" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."competitors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."compliance_checks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "content_id" "uuid",
    "content_type" "text",
    "content" "text" NOT NULL,
    "issues" "jsonb" DEFAULT '[]'::"jsonb",
    "is_clean" boolean DEFAULT true,
    "checked_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."compliance_checks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."content_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "task_id" "uuid" NOT NULL,
    "version_number" integer DEFAULT 1 NOT NULL,
    "headline" "text",
    "body" "text",
    "word_count" integer DEFAULT 0,
    "editor_type" "public"."editor_type" DEFAULT 'ai'::"public"."editor_type" NOT NULL,
    "change_summary" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."content_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversion_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "source_ratio" "text" NOT NULL,
    "target_ratio" "text" NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "public"."conversion_task_status" DEFAULT 'pending'::"public"."conversion_task_status" NOT NULL,
    "batch_item_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."conversion_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."creation_chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid" NOT NULL,
    "role" "public"."creation_chat_role" NOT NULL,
    "employee_id" "uuid",
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."creation_chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."creation_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "goal_title" "text" NOT NULL,
    "goal_description" "text",
    "media_types" "jsonb" DEFAULT '[]'::"jsonb",
    "status" "public"."creation_session_status" DEFAULT 'active'::"public"."creation_session_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."creation_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."detected_faces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "segment_id" "uuid" NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "role" "text",
    "confidence" real DEFAULT 0 NOT NULL,
    "appearances" integer DEFAULT 1,
    "bounding_box" "jsonb",
    "thumbnail_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."detected_faces" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."editor_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "user_name" "text" NOT NULL,
    "total_points" integer DEFAULT 0,
    "level" integer DEFAULT 1,
    "achievements" "jsonb",
    "monthly_points" integer DEFAULT 0,
    "weekly_points" integer DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."editor_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."effect_attributions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "publish_plan_id" "uuid",
    "workflow_instance_id" "uuid",
    "employee_id" "uuid",
    "reach" "jsonb",
    "engagement" "jsonb",
    "quality_score" "jsonb",
    "attributed_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."effect_attributions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_config_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "version" integer NOT NULL,
    "snapshot" "jsonb" NOT NULL,
    "changed_by" "uuid",
    "changed_fields" "jsonb",
    "change_description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."employee_config_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_knowledge_bases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "knowledge_base_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."employee_knowledge_bases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_memories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "memory_type" "public"."memory_type" NOT NULL,
    "content" "text" NOT NULL,
    "source" "text",
    "importance" real DEFAULT 0.5 NOT NULL,
    "access_count" integer DEFAULT 0 NOT NULL,
    "last_accessed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."employee_memories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_scenarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "employee_slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" NOT NULL,
    "icon" "text" DEFAULT 'Zap'::"text" NOT NULL,
    "system_instruction" "text" NOT NULL,
    "input_fields" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "tools_hint" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."employee_scenarios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."employee_skills" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "skill_id" "uuid" NOT NULL,
    "level" integer DEFAULT 50 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "binding_type" "public"."skill_binding_type" DEFAULT 'extended'::"public"."skill_binding_type" NOT NULL
);


ALTER TABLE "public"."employee_skills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_highlights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "time" "text",
    "type" "public"."highlight_type" NOT NULL,
    "description" "text",
    "auto_clipped" boolean DEFAULT false,
    "clip_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."event_highlights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_outputs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "type" "public"."event_output_type" NOT NULL,
    "status" "public"."event_output_status" DEFAULT 'pending'::"public"."event_output_status" NOT NULL,
    "progress" integer DEFAULT 0,
    "output_url" "text",
    "duration" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."event_outputs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_transcriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "speaker" "text",
    "content" "text" NOT NULL,
    "golden_quote" boolean DEFAULT false,
    "timestamp" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."event_transcriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "name" "text" NOT NULL,
    "type" "public"."event_type" NOT NULL,
    "status" "public"."event_status" DEFAULT 'upcoming'::"public"."event_status" NOT NULL,
    "start_time" timestamp with time zone,
    "end_time" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "stats" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."execution_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "employee_id" "uuid" NOT NULL,
    "step_label" "text",
    "topic_title" "text",
    "scenario" "text",
    "output_summary" "text",
    "output_full" "jsonb",
    "tokens_input" integer DEFAULT 0 NOT NULL,
    "tokens_output" integer DEFAULT 0 NOT NULL,
    "duration_ms" integer DEFAULT 0 NOT NULL,
    "tool_call_count" integer DEFAULT 0 NOT NULL,
    "model_id" "text",
    "temperature" "jsonb",
    "status" "text" DEFAULT 'success'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "mission_id" "uuid",
    "mission_task_id" "uuid"
);


ALTER TABLE "public"."execution_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hit_predictions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "content_id" "text" NOT NULL,
    "predicted_score" integer NOT NULL,
    "actual_score" integer,
    "dimensions" "jsonb",
    "suggestions" "jsonb" DEFAULT '[]'::"jsonb",
    "suggestions_adopted" integer DEFAULT 0,
    "tracking_started_at" timestamp with time zone,
    "tracking_completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."hit_predictions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hot_topic_crawl_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "platform_name" "text" NOT NULL,
    "platform_node_id" "text",
    "status" "text" NOT NULL,
    "topics_found" integer DEFAULT 0 NOT NULL,
    "error_message" "text",
    "crawled_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."hot_topic_crawl_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."hot_topics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "title" "text" NOT NULL,
    "priority" "public"."topic_priority" DEFAULT 'P1'::"public"."topic_priority" NOT NULL,
    "heat_score" real DEFAULT 0 NOT NULL,
    "trend" "public"."topic_trend" DEFAULT 'rising'::"public"."topic_trend" NOT NULL,
    "source" "text",
    "category" "text",
    "summary" "text",
    "heat_curve" "jsonb" DEFAULT '[]'::"jsonb",
    "platforms" "jsonb" DEFAULT '[]'::"jsonb",
    "discovered_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "title_hash" "text",
    "source_url" "text",
    "ai_score" real,
    "enriched_outlines" "jsonb" DEFAULT '[]'::"jsonb",
    "related_materials" "jsonb" DEFAULT '[]'::"jsonb"
);


ALTER TABLE "public"."hot_topics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."improvement_trackings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "suggestion_source" "text",
    "suggestion" "text" NOT NULL,
    "adopted_at" timestamp with time zone,
    "baseline_metrics" "jsonb",
    "current_metrics" "jsonb",
    "effect_score" real,
    "status" "text" DEFAULT 'pending'::"text",
    "track_until" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."improvement_trackings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."intent_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "employee_slug" "text" NOT NULL,
    "user_message" "text" NOT NULL,
    "intent_type" "text" NOT NULL,
    "intent_result" "jsonb" NOT NULL,
    "user_edited" boolean DEFAULT false NOT NULL,
    "edited_intent" "jsonb",
    "execution_success" boolean,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."intent_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."international_adaptations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "source_asset_id" "uuid" NOT NULL,
    "language" "text" NOT NULL,
    "language_code" "text" NOT NULL,
    "flag" "text",
    "generated_title" "text",
    "generated_excerpt" "text",
    "adaptation_notes" "text",
    "status" "public"."adaptation_status" DEFAULT 'pending'::"public"."adaptation_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone
);


ALTER TABLE "public"."international_adaptations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_bases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "type" "text" DEFAULT 'general'::"text" NOT NULL,
    "document_count" integer DEFAULT 0,
    "vectorization_status" "public"."vectorization_status" DEFAULT 'pending'::"public"."vectorization_status" NOT NULL,
    "chunk_count" integer DEFAULT 0,
    "last_sync_at" timestamp with time zone,
    "sync_config" "jsonb",
    "source_url" "text",
    "source_type" "public"."knowledge_source_type" DEFAULT 'upload'::"public"."knowledge_source_type" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."knowledge_bases" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "knowledge_base_id" "uuid" NOT NULL,
    "title" "text",
    "snippet" "text",
    "full_content" "text",
    "source_document" "text",
    "source_type" "public"."knowledge_source_type" DEFAULT 'upload'::"public"."knowledge_source_type" NOT NULL,
    "chunk_index" integer DEFAULT 0,
    "tags" "jsonb" DEFAULT '[]'::"jsonb",
    "embedding" "jsonb",
    "embedding_model" "text",
    "relevance_score" real,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."knowledge_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_nodes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "entity_type" "public"."entity_type" NOT NULL,
    "entity_name" "text" NOT NULL,
    "description" "text",
    "metadata" "jsonb",
    "connection_count" integer DEFAULT 0 NOT NULL,
    "source_asset_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."knowledge_nodes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_relations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_node_id" "uuid" NOT NULL,
    "target_node_id" "uuid" NOT NULL,
    "relation_type" "text" NOT NULL,
    "weight" real DEFAULT 1,
    "metadata" "jsonb",
    "source_asset_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."knowledge_relations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_sync_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "knowledge_base_id" "uuid" NOT NULL,
    "action" "text" NOT NULL,
    "status" "public"."sync_log_status" NOT NULL,
    "detail" "text",
    "documents_processed" integer DEFAULT 0,
    "chunks_generated" integer DEFAULT 0,
    "errors_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."knowledge_sync_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."media_asset_shares" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "asset_ids" "jsonb" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "share_token" "text" NOT NULL,
    "password" "text",
    "expires_at" timestamp with time zone,
    "max_access_count" integer,
    "current_access_count" integer DEFAULT 0 NOT NULL,
    "allow_download" boolean DEFAULT true NOT NULL,
    "status" "public"."share_status" DEFAULT 'active'::"public"."share_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."media_asset_shares" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."media_assets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "type" "public"."media_asset_type" NOT NULL,
    "description" "text",
    "file_url" "text",
    "thumbnail_url" "text",
    "file_name" "text",
    "file_size" bigint,
    "file_size_display" "text",
    "mime_type" "text",
    "duration" "text",
    "duration_seconds" integer,
    "source" "text",
    "source_id" "text",
    "tags" "jsonb" DEFAULT '[]'::"jsonb",
    "understanding_status" "public"."asset_processing_status" DEFAULT 'queued'::"public"."asset_processing_status" NOT NULL,
    "understanding_progress" integer DEFAULT 0 NOT NULL,
    "total_tags" integer DEFAULT 0 NOT NULL,
    "processed_at" timestamp with time zone,
    "category_id" "uuid",
    "usage_count" integer DEFAULT 0 NOT NULL,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "width" integer,
    "height" integer,
    "tos_object_key" "text",
    "tos_bucket" "text",
    "library_type" "public"."library_type" DEFAULT 'personal'::"public"."library_type" NOT NULL,
    "is_public" boolean DEFAULT false NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "original_category_id" "uuid",
    "security_level" "public"."security_level" DEFAULT 'public'::"public"."security_level" NOT NULL,
    "review_status" "public"."media_review_status" DEFAULT 'not_submitted'::"public"."media_review_status" NOT NULL,
    "catalog_status" "public"."media_catalog_status" DEFAULT 'uncataloged'::"public"."media_catalog_status" NOT NULL,
    "transcode_status" "public"."media_transcode_status" DEFAULT 'not_started'::"public"."media_transcode_status" NOT NULL,
    "cdn_status" "public"."media_cdn_status" DEFAULT 'not_started'::"public"."media_cdn_status" NOT NULL,
    "cms_status" "public"."media_cms_status" DEFAULT 'not_started'::"public"."media_cms_status" NOT NULL,
    "version_number" integer DEFAULT 1 NOT NULL,
    "parent_version_id" "uuid",
    "catalog_data" "jsonb"
);


ALTER TABLE "public"."media_assets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_reads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "message_id" "uuid" NOT NULL,
    "read_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."message_reads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."missed_topics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "title" "text" NOT NULL,
    "priority" "public"."missed_topic_priority" DEFAULT 'medium'::"public"."missed_topic_priority" NOT NULL,
    "discovered_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "competitors" "jsonb" DEFAULT '[]'::"jsonb",
    "heat_score" real DEFAULT 0,
    "category" "text",
    "type" "public"."missed_topic_type" DEFAULT 'trending'::"public"."missed_topic_type" NOT NULL,
    "status" "public"."missed_topic_status" DEFAULT 'missed'::"public"."missed_topic_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."missed_topics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mission_artifacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mission_id" "uuid" NOT NULL,
    "task_id" "uuid",
    "produced_by" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text",
    "file_url" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "version" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mission_artifacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mission_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mission_id" "uuid" NOT NULL,
    "from_employee_id" "uuid" NOT NULL,
    "to_employee_id" "uuid",
    "message_type" "public"."mission_message_type" NOT NULL,
    "content" "text" NOT NULL,
    "related_task_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "channel" "text" DEFAULT 'direct'::"text" NOT NULL,
    "structured_data" "jsonb",
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "reply_to" "uuid"
);


ALTER TABLE "public"."mission_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."mission_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mission_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "expected_output" "text",
    "assigned_employee_id" "uuid",
    "status" "public"."mission_task_status" DEFAULT 'pending'::"public"."mission_task_status" NOT NULL,
    "dependencies" "jsonb" DEFAULT '[]'::"jsonb",
    "priority" integer DEFAULT 0 NOT NULL,
    "input_context" "jsonb",
    "output_data" "jsonb",
    "error_message" "text",
    "retry_count" integer DEFAULT 0 NOT NULL,
    "claimed_at" timestamp with time zone,
    "started_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "acceptance_criteria" "text",
    "assigned_role" "text",
    "output_summary" "text",
    "error_recoverable" integer DEFAULT 1 NOT NULL,
    "phase" integer,
    "progress" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."mission_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."missions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "scenario" "text" NOT NULL,
    "user_instruction" "text" NOT NULL,
    "leader_employee_id" "uuid" NOT NULL,
    "team_members" "jsonb" DEFAULT '[]'::"jsonb",
    "status" "public"."mission_status" DEFAULT 'planning'::"public"."mission_status" NOT NULL,
    "final_output" "jsonb",
    "token_budget" integer DEFAULT 200000 NOT NULL,
    "tokens_used" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "description" "text",
    "phase" "public"."mission_phase",
    "progress" integer DEFAULT 0 NOT NULL,
    "config" "jsonb" DEFAULT '{"max_agents": 8, "max_retries": 3, "task_timeout": 300}'::"jsonb",
    "started_at" timestamp with time zone,
    "source_module" "text",
    "source_entity_id" "text",
    "source_entity_type" "text"
);


ALTER TABLE "public"."missions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."monitored_platforms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "name" "text" NOT NULL,
    "url" "text" NOT NULL,
    "category" "public"."platform_category" DEFAULT 'central'::"public"."platform_category" NOT NULL,
    "province" "text",
    "crawl_frequency_minutes" integer DEFAULT 1440,
    "status" "public"."crawl_status" DEFAULT 'active'::"public"."crawl_status" NOT NULL,
    "crawl_config" "jsonb" DEFAULT '{}'::"jsonb",
    "last_crawled_at" timestamp with time zone,
    "last_error_message" "text",
    "total_content_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."monitored_platforms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."organizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."performance_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "snapshot_date" "date" NOT NULL,
    "tasks_completed" integer DEFAULT 0,
    "accuracy" real DEFAULT 0,
    "avg_response_time" real DEFAULT 0,
    "satisfaction" real DEFAULT 0,
    "quality_avg" real DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."performance_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_content" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "platform_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "summary" "text",
    "body" "text",
    "source_url" "text" NOT NULL,
    "author" "text",
    "published_at" timestamp with time zone,
    "topics" "jsonb" DEFAULT '[]'::"jsonb",
    "category" "text",
    "sentiment" "text",
    "importance" real DEFAULT 0,
    "content_hash" "text",
    "coverage_status" "text",
    "gap_analysis" "text",
    "crawled_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "analyzed_at" timestamp with time zone
);


ALTER TABLE "public"."platform_content" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."point_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "points" integer NOT NULL,
    "reason" "text" NOT NULL,
    "reference_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."point_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."production_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "structure" "jsonb" NOT NULL,
    "variables" "jsonb" DEFAULT '[]'::"jsonb",
    "usage_count" integer DEFAULT 0,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."production_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."publish_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "channel_id" "uuid" NOT NULL,
    "task_id" "uuid",
    "title" "text" NOT NULL,
    "adapted_content" "jsonb",
    "status" "public"."publish_status" DEFAULT 'scheduled'::"public"."publish_status" NOT NULL,
    "scheduled_at" timestamp with time zone NOT NULL,
    "published_at" timestamp with time zone,
    "trigger_conditions" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."publish_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "content_id" "text" NOT NULL,
    "content_type" "text" DEFAULT 'article'::"text" NOT NULL,
    "reviewer_employee_id" "uuid" NOT NULL,
    "status" "public"."review_status" DEFAULT 'pending'::"public"."review_status" NOT NULL,
    "issues" "jsonb" DEFAULT '[]'::"jsonb",
    "score" integer,
    "channel_rules" "jsonb",
    "escalated_at" timestamp with time zone,
    "escalation_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."review_results" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."revive_recommendations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "asset_id" "uuid" NOT NULL,
    "scenario" "public"."revive_scenario" NOT NULL,
    "matched_topic" "text",
    "reason" "text",
    "match_score" real DEFAULT 0 NOT NULL,
    "suggested_action" "text",
    "estimated_reach" "text",
    "status" "public"."revive_status" DEFAULT 'pending'::"public"."revive_status" NOT NULL,
    "adopted_by" "uuid",
    "responded_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."revive_recommendations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."revive_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "recommendation_id" "uuid",
    "asset_id" "uuid" NOT NULL,
    "scenario" "public"."revive_scenario" NOT NULL,
    "result_reach" integer,
    "created_content_id" "uuid",
    "summary" "text",
    "status" "text" DEFAULT 'pending'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone
);


ALTER TABLE "public"."revive_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."saved_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "employee_slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "summary" "text",
    "messages" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "scenario_id" "uuid",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."saved_conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."skill_combos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "skill_ids" "jsonb" NOT NULL,
    "config" "jsonb",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."skill_combos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."skill_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "skill_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "file_type" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "content" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."skill_files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."skill_usage_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "skill_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "organization_id" "uuid",
    "success" integer DEFAULT 1 NOT NULL,
    "quality_score" integer,
    "execution_time_ms" integer,
    "token_usage" integer,
    "error_message" "text",
    "input_summary" "text",
    "output_summary" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "mission_id" "uuid",
    "mission_task_id" "uuid"
);


ALTER TABLE "public"."skill_usage_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."skill_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "skill_id" "uuid" NOT NULL,
    "organization_id" "uuid",
    "version" "text" NOT NULL,
    "version_number" integer DEFAULT 1 NOT NULL,
    "snapshot" "jsonb" NOT NULL,
    "change_description" "text",
    "changed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."skill_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."skills" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "name" "text" NOT NULL,
    "category" "public"."skill_category" NOT NULL,
    "type" "public"."skill_type" DEFAULT 'builtin'::"public"."skill_type" NOT NULL,
    "version" "text" DEFAULT '1.0'::"text" NOT NULL,
    "description" "text" NOT NULL,
    "input_schema" "jsonb",
    "output_schema" "jsonb",
    "runtime_config" "jsonb",
    "compatible_roles" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "content" "text" DEFAULT ''::"text",
    "plugin_config" "jsonb"
);


ALTER TABLE "public"."skills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."style_adaptations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "source_asset_id" "uuid" NOT NULL,
    "style" "text" NOT NULL,
    "style_label" "text",
    "generated_title" "text",
    "generated_excerpt" "text",
    "tone" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."style_adaptations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tag_schemas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "description" "text",
    "options" "jsonb",
    "is_custom" boolean DEFAULT true,
    "sort_order" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tag_schemas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "assignee_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "media_type" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "priority" "text" DEFAULT 'P1'::"text",
    "content" "jsonb",
    "advisor_notes" "jsonb",
    "word_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "session_id" "uuid",
    "progress" integer DEFAULT 0
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."topic_angles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "hot_topic_id" "uuid" NOT NULL,
    "angle_text" "text" NOT NULL,
    "generated_by" "uuid",
    "status" "public"."topic_angle_status" DEFAULT 'suggested'::"public"."topic_angle_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."topic_angles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "workflow_instance_id" "uuid",
    "step_key" "text",
    "employee_id" "uuid",
    "feedback_type" "public"."feedback_type" NOT NULL,
    "original_content" "text",
    "edited_content" "text",
    "metadata" "jsonb",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" NOT NULL,
    "organization_id" "uuid",
    "display_name" "text" NOT NULL,
    "role" "text" DEFAULT 'editor'::"text" NOT NULL,
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_topic_reads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "last_viewed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "read_topic_ids" "jsonb" DEFAULT '[]'::"jsonb",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_topic_reads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_topic_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "subscribed_categories" "jsonb" DEFAULT '[]'::"jsonb",
    "subscribed_event_types" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_topic_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."weekly_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "period" "text" NOT NULL,
    "overall_score" real DEFAULT 0,
    "missed_rate" real DEFAULT 0,
    "response_speed" "text",
    "coverage_rate" real DEFAULT 0,
    "trends" "jsonb" DEFAULT '[]'::"jsonb",
    "gap_list" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."weekly_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workflow_artifacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "artifact_type" "public"."artifact_type" NOT NULL,
    "title" "text" NOT NULL,
    "content" "jsonb",
    "text_content" "text",
    "producer_employee_id" "uuid",
    "version" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "mission_id" "uuid" NOT NULL,
    "producer_task_id" "uuid"
);


ALTER TABLE "public"."workflow_artifacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workflow_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "steps" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."workflow_templates" OWNER TO "postgres";


ALTER TABLE ONLY "drizzle"."__drizzle_migrations" ALTER COLUMN "id" SET DEFAULT "nextval"('"drizzle"."__drizzle_migrations_id_seq"'::"regclass");



ALTER TABLE ONLY "drizzle"."__drizzle_migrations"
    ADD CONSTRAINT "__drizzle_migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."advisor_ab_tests"
    ADD CONSTRAINT "advisor_ab_tests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."advisor_compare_tests"
    ADD CONSTRAINT "advisor_compare_tests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ai_employees"
    ADD CONSTRAINT "ai_employees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."article_ai_analysis"
    ADD CONSTRAINT "article_ai_analysis_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."article_ai_analysis"
    ADD CONSTRAINT "article_ai_analysis_unique" UNIQUE ("article_id", "perspective");



ALTER TABLE ONLY "public"."article_annotations"
    ADD CONSTRAINT "article_annotations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."article_assets"
    ADD CONSTRAINT "article_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."article_chat_history"
    ADD CONSTRAINT "article_chat_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."asset_segments"
    ADD CONSTRAINT "asset_segments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."asset_tags"
    ADD CONSTRAINT "asset_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."batch_items"
    ADD CONSTRAINT "batch_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."batch_jobs"
    ADD CONSTRAINT "batch_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."benchmark_alerts"
    ADD CONSTRAINT "benchmark_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."benchmark_analyses"
    ADD CONSTRAINT "benchmark_analyses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."case_library"
    ADD CONSTRAINT "case_library_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."category_permissions"
    ADD CONSTRAINT "category_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."channel_advisors"
    ADD CONSTRAINT "channel_advisors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."channel_dna_profiles"
    ADD CONSTRAINT "channel_dna_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."channel_metrics"
    ADD CONSTRAINT "channel_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."channels"
    ADD CONSTRAINT "channels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comment_insights"
    ADD CONSTRAINT "comment_insights_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."competitor_hits"
    ADD CONSTRAINT "competitor_hits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."competitor_responses"
    ADD CONSTRAINT "competitor_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."competitors"
    ADD CONSTRAINT "competitors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compliance_checks"
    ADD CONSTRAINT "compliance_checks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."content_versions"
    ADD CONSTRAINT "content_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversion_tasks"
    ADD CONSTRAINT "conversion_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."creation_chat_messages"
    ADD CONSTRAINT "creation_chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."creation_sessions"
    ADD CONSTRAINT "creation_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."detected_faces"
    ADD CONSTRAINT "detected_faces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."editor_scores"
    ADD CONSTRAINT "editor_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."effect_attributions"
    ADD CONSTRAINT "effect_attributions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_config_versions"
    ADD CONSTRAINT "employee_config_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_knowledge_bases"
    ADD CONSTRAINT "employee_knowledge_bases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_memories"
    ADD CONSTRAINT "employee_memories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_scenarios"
    ADD CONSTRAINT "employee_scenarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."employee_skills"
    ADD CONSTRAINT "employee_skills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_highlights"
    ADD CONSTRAINT "event_highlights_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_outputs"
    ADD CONSTRAINT "event_outputs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_transcriptions"
    ADD CONSTRAINT "event_transcriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."execution_logs"
    ADD CONSTRAINT "execution_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hit_predictions"
    ADD CONSTRAINT "hit_predictions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hot_topic_crawl_logs"
    ADD CONSTRAINT "hot_topic_crawl_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hot_topics"
    ADD CONSTRAINT "hot_topics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."improvement_trackings"
    ADD CONSTRAINT "improvement_trackings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."intent_logs"
    ADD CONSTRAINT "intent_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."international_adaptations"
    ADD CONSTRAINT "international_adaptations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_bases"
    ADD CONSTRAINT "knowledge_bases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_items"
    ADD CONSTRAINT "knowledge_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_nodes"
    ADD CONSTRAINT "knowledge_nodes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_relations"
    ADD CONSTRAINT "knowledge_relations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_sync_logs"
    ADD CONSTRAINT "knowledge_sync_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."media_asset_shares"
    ADD CONSTRAINT "media_asset_shares_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."media_asset_shares"
    ADD CONSTRAINT "media_asset_shares_share_token_unique" UNIQUE ("share_token");



ALTER TABLE ONLY "public"."media_assets"
    ADD CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_reads"
    ADD CONSTRAINT "message_reads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_reads"
    ADD CONSTRAINT "message_reads_user_message_unique" UNIQUE ("user_id", "message_id");



ALTER TABLE ONLY "public"."missed_topics"
    ADD CONSTRAINT "missed_topics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mission_artifacts"
    ADD CONSTRAINT "mission_artifacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mission_messages"
    ADD CONSTRAINT "mission_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."mission_tasks"
    ADD CONSTRAINT "mission_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."missions"
    ADD CONSTRAINT "missions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."monitored_platforms"
    ADD CONSTRAINT "monitored_platforms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_slug_unique" UNIQUE ("slug");



ALTER TABLE ONLY "public"."performance_snapshots"
    ADD CONSTRAINT "performance_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_content"
    ADD CONSTRAINT "platform_content_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."point_transactions"
    ADD CONSTRAINT "point_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."production_templates"
    ADD CONSTRAINT "production_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."publish_plans"
    ADD CONSTRAINT "publish_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_results"
    ADD CONSTRAINT "review_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."revive_recommendations"
    ADD CONSTRAINT "revive_recommendations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."revive_records"
    ADD CONSTRAINT "revive_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."saved_conversations"
    ADD CONSTRAINT "saved_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."skill_combos"
    ADD CONSTRAINT "skill_combos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."skill_files"
    ADD CONSTRAINT "skill_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."skill_files"
    ADD CONSTRAINT "skill_files_skill_id_file_path_unique" UNIQUE ("skill_id", "file_path");



ALTER TABLE ONLY "public"."skill_usage_records"
    ADD CONSTRAINT "skill_usage_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."skill_versions"
    ADD CONSTRAINT "skill_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."skills"
    ADD CONSTRAINT "skills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."style_adaptations"
    ADD CONSTRAINT "style_adaptations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tag_schemas"
    ADD CONSTRAINT "tag_schemas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."topic_angles"
    ADD CONSTRAINT "topic_angles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_feedback"
    ADD CONSTRAINT "user_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_topic_reads"
    ADD CONSTRAINT "user_topic_reads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_topic_reads"
    ADD CONSTRAINT "user_topic_reads_user_id_organization_id_unique" UNIQUE ("user_id", "organization_id");



ALTER TABLE ONLY "public"."user_topic_subscriptions"
    ADD CONSTRAINT "user_topic_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_topic_subscriptions"
    ADD CONSTRAINT "user_topic_subscriptions_user_id_organization_id_unique" UNIQUE ("user_id", "organization_id");



ALTER TABLE ONLY "public"."weekly_reports"
    ADD CONSTRAINT "weekly_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workflow_artifacts"
    ADD CONSTRAINT "workflow_artifacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."workflow_templates"
    ADD CONSTRAINT "workflow_templates_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "hot_topics_org_title_hash_uniq" ON "public"."hot_topics" USING "btree" ("organization_id", "title_hash");



CREATE INDEX "idx_intent_logs_org" ON "public"."intent_logs" USING "btree" ("organization_id", "created_at");



CREATE INDEX "idx_intent_logs_user" ON "public"."intent_logs" USING "btree" ("user_id", "created_at");



CREATE UNIQUE INDEX "uq_category_permission" ON "public"."category_permissions" USING "btree" ("category_id", "grantee_type", "grantee_id", "permission_type");



ALTER TABLE ONLY "public"."ai_employees"
    ADD CONSTRAINT "ai_employees_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."article_ai_analysis"
    ADD CONSTRAINT "article_ai_analysis_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."article_annotations"
    ADD CONSTRAINT "article_annotations_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."article_assets"
    ADD CONSTRAINT "article_assets_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."article_assets"
    ADD CONSTRAINT "article_assets_asset_id_media_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."media_assets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."article_chat_history"
    ADD CONSTRAINT "article_chat_history_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_assignee_id_ai_employees_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."ai_employees"("id");



ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id");



ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_created_by_user_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id");



ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."articles"
    ADD CONSTRAINT "articles_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id");



ALTER TABLE ONLY "public"."asset_segments"
    ADD CONSTRAINT "asset_segments_asset_id_media_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."media_assets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."asset_tags"
    ADD CONSTRAINT "asset_tags_asset_id_media_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."media_assets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."asset_tags"
    ADD CONSTRAINT "asset_tags_corrected_by_user_profiles_id_fk" FOREIGN KEY ("corrected_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."asset_tags"
    ADD CONSTRAINT "asset_tags_segment_id_asset_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."asset_segments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."batch_items"
    ADD CONSTRAINT "batch_items_batch_job_id_batch_jobs_id_fk" FOREIGN KEY ("batch_job_id") REFERENCES "public"."batch_jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."batch_jobs"
    ADD CONSTRAINT "batch_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."benchmark_alerts"
    ADD CONSTRAINT "benchmark_alerts_generated_by_ai_employees_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."ai_employees"("id");



ALTER TABLE ONLY "public"."benchmark_alerts"
    ADD CONSTRAINT "benchmark_alerts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."benchmark_analyses"
    ADD CONSTRAINT "benchmark_analyses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_created_by_user_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."calendar_events"
    ADD CONSTRAINT "calendar_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."case_library"
    ADD CONSTRAINT "case_library_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id");



ALTER TABLE ONLY "public"."category_permissions"
    ADD CONSTRAINT "category_permissions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."category_permissions"
    ADD CONSTRAINT "category_permissions_created_by_user_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."category_permissions"
    ADD CONSTRAINT "category_permissions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."channel_advisors"
    ADD CONSTRAINT "channel_advisors_ai_employee_id_ai_employees_id_fk" FOREIGN KEY ("ai_employee_id") REFERENCES "public"."ai_employees"("id");



ALTER TABLE ONLY "public"."channel_advisors"
    ADD CONSTRAINT "channel_advisors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."channel_dna_profiles"
    ADD CONSTRAINT "channel_dna_profiles_advisor_id_channel_advisors_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."channel_advisors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_metrics"
    ADD CONSTRAINT "channel_metrics_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."channel_metrics"
    ADD CONSTRAINT "channel_metrics_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."channels"
    ADD CONSTRAINT "channels_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."comment_insights"
    ADD CONSTRAINT "comment_insights_hot_topic_id_hot_topics_id_fk" FOREIGN KEY ("hot_topic_id") REFERENCES "public"."hot_topics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."competitor_hits"
    ADD CONSTRAINT "competitor_hits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."competitor_responses"
    ADD CONSTRAINT "competitor_responses_hot_topic_id_hot_topics_id_fk" FOREIGN KEY ("hot_topic_id") REFERENCES "public"."hot_topics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."competitors"
    ADD CONSTRAINT "competitors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."compliance_checks"
    ADD CONSTRAINT "compliance_checks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."content_versions"
    ADD CONSTRAINT "content_versions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversion_tasks"
    ADD CONSTRAINT "conversion_tasks_batch_item_id_batch_items_id_fk" FOREIGN KEY ("batch_item_id") REFERENCES "public"."batch_items"("id");



ALTER TABLE ONLY "public"."conversion_tasks"
    ADD CONSTRAINT "conversion_tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."creation_chat_messages"
    ADD CONSTRAINT "creation_chat_messages_employee_id_ai_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."ai_employees"("id");



ALTER TABLE ONLY "public"."creation_chat_messages"
    ADD CONSTRAINT "creation_chat_messages_session_id_creation_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."creation_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."creation_sessions"
    ADD CONSTRAINT "creation_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."detected_faces"
    ADD CONSTRAINT "detected_faces_asset_id_media_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."media_assets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."detected_faces"
    ADD CONSTRAINT "detected_faces_segment_id_asset_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."asset_segments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_config_versions"
    ADD CONSTRAINT "employee_config_versions_employee_id_ai_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."ai_employees"("id");



ALTER TABLE ONLY "public"."employee_knowledge_bases"
    ADD CONSTRAINT "employee_knowledge_bases_employee_id_ai_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."ai_employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_knowledge_bases"
    ADD CONSTRAINT "employee_knowledge_bases_knowledge_base_id_knowledge_bases_id_f" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."knowledge_bases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_memories"
    ADD CONSTRAINT "employee_memories_employee_id_ai_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."ai_employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_memories"
    ADD CONSTRAINT "employee_memories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."employee_scenarios"
    ADD CONSTRAINT "employee_scenarios_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."employee_skills"
    ADD CONSTRAINT "employee_skills_employee_id_ai_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."ai_employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."employee_skills"
    ADD CONSTRAINT "employee_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_highlights"
    ADD CONSTRAINT "event_highlights_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_outputs"
    ADD CONSTRAINT "event_outputs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_transcriptions"
    ADD CONSTRAINT "event_transcriptions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."execution_logs"
    ADD CONSTRAINT "execution_logs_employee_id_ai_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."ai_employees"("id");



ALTER TABLE ONLY "public"."execution_logs"
    ADD CONSTRAINT "execution_logs_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id");



ALTER TABLE ONLY "public"."execution_logs"
    ADD CONSTRAINT "execution_logs_mission_task_id_mission_tasks_id_fk" FOREIGN KEY ("mission_task_id") REFERENCES "public"."mission_tasks"("id");



ALTER TABLE ONLY "public"."execution_logs"
    ADD CONSTRAINT "execution_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."hit_predictions"
    ADD CONSTRAINT "hit_predictions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."hot_topic_crawl_logs"
    ADD CONSTRAINT "hot_topic_crawl_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."hot_topics"
    ADD CONSTRAINT "hot_topics_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."improvement_trackings"
    ADD CONSTRAINT "improvement_trackings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."intent_logs"
    ADD CONSTRAINT "intent_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."intent_logs"
    ADD CONSTRAINT "intent_logs_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."international_adaptations"
    ADD CONSTRAINT "international_adaptations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."international_adaptations"
    ADD CONSTRAINT "international_adaptations_source_asset_id_media_assets_id_fk" FOREIGN KEY ("source_asset_id") REFERENCES "public"."media_assets"("id");



ALTER TABLE ONLY "public"."knowledge_bases"
    ADD CONSTRAINT "knowledge_bases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."knowledge_items"
    ADD CONSTRAINT "knowledge_items_knowledge_base_id_knowledge_bases_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."knowledge_bases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."knowledge_nodes"
    ADD CONSTRAINT "knowledge_nodes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."knowledge_nodes"
    ADD CONSTRAINT "knowledge_nodes_source_asset_id_media_assets_id_fk" FOREIGN KEY ("source_asset_id") REFERENCES "public"."media_assets"("id");



ALTER TABLE ONLY "public"."knowledge_relations"
    ADD CONSTRAINT "knowledge_relations_source_asset_id_media_assets_id_fk" FOREIGN KEY ("source_asset_id") REFERENCES "public"."media_assets"("id");



ALTER TABLE ONLY "public"."knowledge_relations"
    ADD CONSTRAINT "knowledge_relations_source_node_id_knowledge_nodes_id_fk" FOREIGN KEY ("source_node_id") REFERENCES "public"."knowledge_nodes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."knowledge_relations"
    ADD CONSTRAINT "knowledge_relations_target_node_id_knowledge_nodes_id_fk" FOREIGN KEY ("target_node_id") REFERENCES "public"."knowledge_nodes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."knowledge_sync_logs"
    ADD CONSTRAINT "knowledge_sync_logs_knowledge_base_id_knowledge_bases_id_fk" FOREIGN KEY ("knowledge_base_id") REFERENCES "public"."knowledge_bases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."media_asset_shares"
    ADD CONSTRAINT "media_asset_shares_created_by_user_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."media_asset_shares"
    ADD CONSTRAINT "media_asset_shares_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."media_assets"
    ADD CONSTRAINT "media_assets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id");



ALTER TABLE ONLY "public"."media_assets"
    ADD CONSTRAINT "media_assets_deleted_by_user_profiles_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."media_assets"
    ADD CONSTRAINT "media_assets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."media_assets"
    ADD CONSTRAINT "media_assets_parent_version_id_media_assets_id_fk" FOREIGN KEY ("parent_version_id") REFERENCES "public"."media_assets"("id");



ALTER TABLE ONLY "public"."media_assets"
    ADD CONSTRAINT "media_assets_uploaded_by_user_profiles_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."message_reads"
    ADD CONSTRAINT "message_reads_message_id_mission_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."mission_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."missed_topics"
    ADD CONSTRAINT "missed_topics_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."mission_artifacts"
    ADD CONSTRAINT "mission_artifacts_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mission_artifacts"
    ADD CONSTRAINT "mission_artifacts_produced_by_ai_employees_id_fk" FOREIGN KEY ("produced_by") REFERENCES "public"."ai_employees"("id");



ALTER TABLE ONLY "public"."mission_artifacts"
    ADD CONSTRAINT "mission_artifacts_task_id_mission_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."mission_tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mission_messages"
    ADD CONSTRAINT "mission_messages_from_employee_id_ai_employees_id_fk" FOREIGN KEY ("from_employee_id") REFERENCES "public"."ai_employees"("id");



ALTER TABLE ONLY "public"."mission_messages"
    ADD CONSTRAINT "mission_messages_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."mission_messages"
    ADD CONSTRAINT "mission_messages_related_task_id_mission_tasks_id_fk" FOREIGN KEY ("related_task_id") REFERENCES "public"."mission_tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."mission_messages"
    ADD CONSTRAINT "mission_messages_to_employee_id_ai_employees_id_fk" FOREIGN KEY ("to_employee_id") REFERENCES "public"."ai_employees"("id");



ALTER TABLE ONLY "public"."mission_tasks"
    ADD CONSTRAINT "mission_tasks_assigned_employee_id_ai_employees_id_fk" FOREIGN KEY ("assigned_employee_id") REFERENCES "public"."ai_employees"("id");



ALTER TABLE ONLY "public"."mission_tasks"
    ADD CONSTRAINT "mission_tasks_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."missions"
    ADD CONSTRAINT "missions_leader_employee_id_ai_employees_id_fk" FOREIGN KEY ("leader_employee_id") REFERENCES "public"."ai_employees"("id");



ALTER TABLE ONLY "public"."missions"
    ADD CONSTRAINT "missions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."monitored_platforms"
    ADD CONSTRAINT "monitored_platforms_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."performance_snapshots"
    ADD CONSTRAINT "performance_snapshots_employee_id_ai_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."ai_employees"("id");



ALTER TABLE ONLY "public"."platform_content"
    ADD CONSTRAINT "platform_content_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."platform_content"
    ADD CONSTRAINT "platform_content_platform_id_monitored_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."monitored_platforms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."production_templates"
    ADD CONSTRAINT "production_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."publish_plans"
    ADD CONSTRAINT "publish_plans_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."publish_plans"
    ADD CONSTRAINT "publish_plans_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."publish_plans"
    ADD CONSTRAINT "publish_plans_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id");



ALTER TABLE ONLY "public"."review_results"
    ADD CONSTRAINT "review_results_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."review_results"
    ADD CONSTRAINT "review_results_reviewer_employee_id_ai_employees_id_fk" FOREIGN KEY ("reviewer_employee_id") REFERENCES "public"."ai_employees"("id");



ALTER TABLE ONLY "public"."revive_recommendations"
    ADD CONSTRAINT "revive_recommendations_adopted_by_user_profiles_id_fk" FOREIGN KEY ("adopted_by") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."revive_recommendations"
    ADD CONSTRAINT "revive_recommendations_asset_id_media_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."media_assets"("id");



ALTER TABLE ONLY "public"."revive_recommendations"
    ADD CONSTRAINT "revive_recommendations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."revive_records"
    ADD CONSTRAINT "revive_records_asset_id_media_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."media_assets"("id");



ALTER TABLE ONLY "public"."revive_records"
    ADD CONSTRAINT "revive_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."revive_records"
    ADD CONSTRAINT "revive_records_recommendation_id_revive_recommendations_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."revive_recommendations"("id");



ALTER TABLE ONLY "public"."saved_conversations"
    ADD CONSTRAINT "saved_conversations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."skill_files"
    ADD CONSTRAINT "skill_files_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."skill_files"
    ADD CONSTRAINT "skill_files_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."skill_usage_records"
    ADD CONSTRAINT "skill_usage_records_employee_id_ai_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."ai_employees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."skill_usage_records"
    ADD CONSTRAINT "skill_usage_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."skill_usage_records"
    ADD CONSTRAINT "skill_usage_records_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."skill_versions"
    ADD CONSTRAINT "skill_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."skill_versions"
    ADD CONSTRAINT "skill_versions_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."skills"
    ADD CONSTRAINT "skills_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."style_adaptations"
    ADD CONSTRAINT "style_adaptations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."style_adaptations"
    ADD CONSTRAINT "style_adaptations_source_asset_id_media_assets_id_fk" FOREIGN KEY ("source_asset_id") REFERENCES "public"."media_assets"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_assignee_id_ai_employees_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."ai_employees"("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."topic_angles"
    ADD CONSTRAINT "topic_angles_generated_by_ai_employees_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."ai_employees"("id");



ALTER TABLE ONLY "public"."topic_angles"
    ADD CONSTRAINT "topic_angles_hot_topic_id_hot_topics_id_fk" FOREIGN KEY ("hot_topic_id") REFERENCES "public"."hot_topics"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."user_topic_reads"
    ADD CONSTRAINT "user_topic_reads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."user_topic_reads"
    ADD CONSTRAINT "user_topic_reads_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."user_topic_subscriptions"
    ADD CONSTRAINT "user_topic_subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."user_topic_subscriptions"
    ADD CONSTRAINT "user_topic_subscriptions_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id");



ALTER TABLE ONLY "public"."weekly_reports"
    ADD CONSTRAINT "weekly_reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."workflow_artifacts"
    ADD CONSTRAINT "workflow_artifacts_mission_id_missions_id_fk" FOREIGN KEY ("mission_id") REFERENCES "public"."missions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workflow_artifacts"
    ADD CONSTRAINT "workflow_artifacts_producer_employee_id_ai_employees_id_fk" FOREIGN KEY ("producer_employee_id") REFERENCES "public"."ai_employees"("id");



ALTER TABLE ONLY "public"."workflow_templates"
    ADD CONSTRAINT "workflow_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";


















GRANT ALL ON TABLE "public"."advisor_ab_tests" TO "anon";
GRANT ALL ON TABLE "public"."advisor_ab_tests" TO "authenticated";
GRANT ALL ON TABLE "public"."advisor_ab_tests" TO "service_role";



GRANT ALL ON TABLE "public"."advisor_compare_tests" TO "anon";
GRANT ALL ON TABLE "public"."advisor_compare_tests" TO "authenticated";
GRANT ALL ON TABLE "public"."advisor_compare_tests" TO "service_role";



GRANT ALL ON TABLE "public"."ai_employees" TO "anon";
GRANT ALL ON TABLE "public"."ai_employees" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_employees" TO "service_role";



GRANT ALL ON TABLE "public"."article_ai_analysis" TO "anon";
GRANT ALL ON TABLE "public"."article_ai_analysis" TO "authenticated";
GRANT ALL ON TABLE "public"."article_ai_analysis" TO "service_role";



GRANT ALL ON TABLE "public"."article_annotations" TO "anon";
GRANT ALL ON TABLE "public"."article_annotations" TO "authenticated";
GRANT ALL ON TABLE "public"."article_annotations" TO "service_role";



GRANT ALL ON TABLE "public"."article_assets" TO "anon";
GRANT ALL ON TABLE "public"."article_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."article_assets" TO "service_role";



GRANT ALL ON TABLE "public"."article_chat_history" TO "anon";
GRANT ALL ON TABLE "public"."article_chat_history" TO "authenticated";
GRANT ALL ON TABLE "public"."article_chat_history" TO "service_role";



GRANT ALL ON TABLE "public"."articles" TO "anon";
GRANT ALL ON TABLE "public"."articles" TO "authenticated";
GRANT ALL ON TABLE "public"."articles" TO "service_role";



GRANT ALL ON TABLE "public"."asset_segments" TO "anon";
GRANT ALL ON TABLE "public"."asset_segments" TO "authenticated";
GRANT ALL ON TABLE "public"."asset_segments" TO "service_role";



GRANT ALL ON TABLE "public"."asset_tags" TO "anon";
GRANT ALL ON TABLE "public"."asset_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."asset_tags" TO "service_role";



GRANT ALL ON TABLE "public"."batch_items" TO "anon";
GRANT ALL ON TABLE "public"."batch_items" TO "authenticated";
GRANT ALL ON TABLE "public"."batch_items" TO "service_role";



GRANT ALL ON TABLE "public"."batch_jobs" TO "anon";
GRANT ALL ON TABLE "public"."batch_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."batch_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."benchmark_alerts" TO "anon";
GRANT ALL ON TABLE "public"."benchmark_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."benchmark_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."benchmark_analyses" TO "anon";
GRANT ALL ON TABLE "public"."benchmark_analyses" TO "authenticated";
GRANT ALL ON TABLE "public"."benchmark_analyses" TO "service_role";



GRANT ALL ON TABLE "public"."calendar_events" TO "anon";
GRANT ALL ON TABLE "public"."calendar_events" TO "authenticated";
GRANT ALL ON TABLE "public"."calendar_events" TO "service_role";



GRANT ALL ON TABLE "public"."case_library" TO "anon";
GRANT ALL ON TABLE "public"."case_library" TO "authenticated";
GRANT ALL ON TABLE "public"."case_library" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."category_permissions" TO "anon";
GRANT ALL ON TABLE "public"."category_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."category_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."channel_advisors" TO "anon";
GRANT ALL ON TABLE "public"."channel_advisors" TO "authenticated";
GRANT ALL ON TABLE "public"."channel_advisors" TO "service_role";



GRANT ALL ON TABLE "public"."channel_dna_profiles" TO "anon";
GRANT ALL ON TABLE "public"."channel_dna_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."channel_dna_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."channel_metrics" TO "anon";
GRANT ALL ON TABLE "public"."channel_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."channel_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."channels" TO "anon";
GRANT ALL ON TABLE "public"."channels" TO "authenticated";
GRANT ALL ON TABLE "public"."channels" TO "service_role";



GRANT ALL ON TABLE "public"."comment_insights" TO "anon";
GRANT ALL ON TABLE "public"."comment_insights" TO "authenticated";
GRANT ALL ON TABLE "public"."comment_insights" TO "service_role";



GRANT ALL ON TABLE "public"."competitor_hits" TO "anon";
GRANT ALL ON TABLE "public"."competitor_hits" TO "authenticated";
GRANT ALL ON TABLE "public"."competitor_hits" TO "service_role";



GRANT ALL ON TABLE "public"."competitor_responses" TO "anon";
GRANT ALL ON TABLE "public"."competitor_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."competitor_responses" TO "service_role";



GRANT ALL ON TABLE "public"."competitors" TO "anon";
GRANT ALL ON TABLE "public"."competitors" TO "authenticated";
GRANT ALL ON TABLE "public"."competitors" TO "service_role";



GRANT ALL ON TABLE "public"."compliance_checks" TO "anon";
GRANT ALL ON TABLE "public"."compliance_checks" TO "authenticated";
GRANT ALL ON TABLE "public"."compliance_checks" TO "service_role";



GRANT ALL ON TABLE "public"."content_versions" TO "anon";
GRANT ALL ON TABLE "public"."content_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."content_versions" TO "service_role";



GRANT ALL ON TABLE "public"."conversion_tasks" TO "anon";
GRANT ALL ON TABLE "public"."conversion_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."conversion_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."creation_chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."creation_chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."creation_chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."creation_sessions" TO "anon";
GRANT ALL ON TABLE "public"."creation_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."creation_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."detected_faces" TO "anon";
GRANT ALL ON TABLE "public"."detected_faces" TO "authenticated";
GRANT ALL ON TABLE "public"."detected_faces" TO "service_role";



GRANT ALL ON TABLE "public"."editor_scores" TO "anon";
GRANT ALL ON TABLE "public"."editor_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."editor_scores" TO "service_role";



GRANT ALL ON TABLE "public"."effect_attributions" TO "anon";
GRANT ALL ON TABLE "public"."effect_attributions" TO "authenticated";
GRANT ALL ON TABLE "public"."effect_attributions" TO "service_role";



GRANT ALL ON TABLE "public"."employee_config_versions" TO "anon";
GRANT ALL ON TABLE "public"."employee_config_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_config_versions" TO "service_role";



GRANT ALL ON TABLE "public"."employee_knowledge_bases" TO "anon";
GRANT ALL ON TABLE "public"."employee_knowledge_bases" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_knowledge_bases" TO "service_role";



GRANT ALL ON TABLE "public"."employee_memories" TO "anon";
GRANT ALL ON TABLE "public"."employee_memories" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_memories" TO "service_role";



GRANT ALL ON TABLE "public"."employee_scenarios" TO "anon";
GRANT ALL ON TABLE "public"."employee_scenarios" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_scenarios" TO "service_role";



GRANT ALL ON TABLE "public"."employee_skills" TO "anon";
GRANT ALL ON TABLE "public"."employee_skills" TO "authenticated";
GRANT ALL ON TABLE "public"."employee_skills" TO "service_role";



GRANT ALL ON TABLE "public"."event_highlights" TO "anon";
GRANT ALL ON TABLE "public"."event_highlights" TO "authenticated";
GRANT ALL ON TABLE "public"."event_highlights" TO "service_role";



GRANT ALL ON TABLE "public"."event_outputs" TO "anon";
GRANT ALL ON TABLE "public"."event_outputs" TO "authenticated";
GRANT ALL ON TABLE "public"."event_outputs" TO "service_role";



GRANT ALL ON TABLE "public"."event_transcriptions" TO "anon";
GRANT ALL ON TABLE "public"."event_transcriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."event_transcriptions" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."execution_logs" TO "anon";
GRANT ALL ON TABLE "public"."execution_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."execution_logs" TO "service_role";



GRANT ALL ON TABLE "public"."hit_predictions" TO "anon";
GRANT ALL ON TABLE "public"."hit_predictions" TO "authenticated";
GRANT ALL ON TABLE "public"."hit_predictions" TO "service_role";



GRANT ALL ON TABLE "public"."hot_topic_crawl_logs" TO "anon";
GRANT ALL ON TABLE "public"."hot_topic_crawl_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."hot_topic_crawl_logs" TO "service_role";



GRANT ALL ON TABLE "public"."hot_topics" TO "anon";
GRANT ALL ON TABLE "public"."hot_topics" TO "authenticated";
GRANT ALL ON TABLE "public"."hot_topics" TO "service_role";



GRANT ALL ON TABLE "public"."improvement_trackings" TO "anon";
GRANT ALL ON TABLE "public"."improvement_trackings" TO "authenticated";
GRANT ALL ON TABLE "public"."improvement_trackings" TO "service_role";



GRANT ALL ON TABLE "public"."intent_logs" TO "anon";
GRANT ALL ON TABLE "public"."intent_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."intent_logs" TO "service_role";



GRANT ALL ON TABLE "public"."international_adaptations" TO "anon";
GRANT ALL ON TABLE "public"."international_adaptations" TO "authenticated";
GRANT ALL ON TABLE "public"."international_adaptations" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_bases" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_bases" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_bases" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_items" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_items" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_items" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_nodes" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_nodes" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_nodes" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_relations" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_relations" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_relations" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_sync_logs" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_sync_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_sync_logs" TO "service_role";



GRANT ALL ON TABLE "public"."media_asset_shares" TO "anon";
GRANT ALL ON TABLE "public"."media_asset_shares" TO "authenticated";
GRANT ALL ON TABLE "public"."media_asset_shares" TO "service_role";



GRANT ALL ON TABLE "public"."media_assets" TO "anon";
GRANT ALL ON TABLE "public"."media_assets" TO "authenticated";
GRANT ALL ON TABLE "public"."media_assets" TO "service_role";



GRANT ALL ON TABLE "public"."message_reads" TO "anon";
GRANT ALL ON TABLE "public"."message_reads" TO "authenticated";
GRANT ALL ON TABLE "public"."message_reads" TO "service_role";



GRANT ALL ON TABLE "public"."missed_topics" TO "anon";
GRANT ALL ON TABLE "public"."missed_topics" TO "authenticated";
GRANT ALL ON TABLE "public"."missed_topics" TO "service_role";



GRANT ALL ON TABLE "public"."mission_artifacts" TO "anon";
GRANT ALL ON TABLE "public"."mission_artifacts" TO "authenticated";
GRANT ALL ON TABLE "public"."mission_artifacts" TO "service_role";



GRANT ALL ON TABLE "public"."mission_messages" TO "anon";
GRANT ALL ON TABLE "public"."mission_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."mission_messages" TO "service_role";



GRANT ALL ON TABLE "public"."mission_tasks" TO "anon";
GRANT ALL ON TABLE "public"."mission_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."mission_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."missions" TO "anon";
GRANT ALL ON TABLE "public"."missions" TO "authenticated";
GRANT ALL ON TABLE "public"."missions" TO "service_role";



GRANT ALL ON TABLE "public"."monitored_platforms" TO "anon";
GRANT ALL ON TABLE "public"."monitored_platforms" TO "authenticated";
GRANT ALL ON TABLE "public"."monitored_platforms" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."performance_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."performance_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."performance_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."platform_content" TO "anon";
GRANT ALL ON TABLE "public"."platform_content" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_content" TO "service_role";



GRANT ALL ON TABLE "public"."point_transactions" TO "anon";
GRANT ALL ON TABLE "public"."point_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."point_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."production_templates" TO "anon";
GRANT ALL ON TABLE "public"."production_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."production_templates" TO "service_role";



GRANT ALL ON TABLE "public"."publish_plans" TO "anon";
GRANT ALL ON TABLE "public"."publish_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."publish_plans" TO "service_role";



GRANT ALL ON TABLE "public"."review_results" TO "anon";
GRANT ALL ON TABLE "public"."review_results" TO "authenticated";
GRANT ALL ON TABLE "public"."review_results" TO "service_role";



GRANT ALL ON TABLE "public"."revive_recommendations" TO "anon";
GRANT ALL ON TABLE "public"."revive_recommendations" TO "authenticated";
GRANT ALL ON TABLE "public"."revive_recommendations" TO "service_role";



GRANT ALL ON TABLE "public"."revive_records" TO "anon";
GRANT ALL ON TABLE "public"."revive_records" TO "authenticated";
GRANT ALL ON TABLE "public"."revive_records" TO "service_role";



GRANT ALL ON TABLE "public"."saved_conversations" TO "anon";
GRANT ALL ON TABLE "public"."saved_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."saved_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."skill_combos" TO "anon";
GRANT ALL ON TABLE "public"."skill_combos" TO "authenticated";
GRANT ALL ON TABLE "public"."skill_combos" TO "service_role";



GRANT ALL ON TABLE "public"."skill_files" TO "anon";
GRANT ALL ON TABLE "public"."skill_files" TO "authenticated";
GRANT ALL ON TABLE "public"."skill_files" TO "service_role";



GRANT ALL ON TABLE "public"."skill_usage_records" TO "anon";
GRANT ALL ON TABLE "public"."skill_usage_records" TO "authenticated";
GRANT ALL ON TABLE "public"."skill_usage_records" TO "service_role";



GRANT ALL ON TABLE "public"."skill_versions" TO "anon";
GRANT ALL ON TABLE "public"."skill_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."skill_versions" TO "service_role";



GRANT ALL ON TABLE "public"."skills" TO "anon";
GRANT ALL ON TABLE "public"."skills" TO "authenticated";
GRANT ALL ON TABLE "public"."skills" TO "service_role";



GRANT ALL ON TABLE "public"."style_adaptations" TO "anon";
GRANT ALL ON TABLE "public"."style_adaptations" TO "authenticated";
GRANT ALL ON TABLE "public"."style_adaptations" TO "service_role";



GRANT ALL ON TABLE "public"."tag_schemas" TO "anon";
GRANT ALL ON TABLE "public"."tag_schemas" TO "authenticated";
GRANT ALL ON TABLE "public"."tag_schemas" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."topic_angles" TO "anon";
GRANT ALL ON TABLE "public"."topic_angles" TO "authenticated";
GRANT ALL ON TABLE "public"."topic_angles" TO "service_role";



GRANT ALL ON TABLE "public"."user_feedback" TO "anon";
GRANT ALL ON TABLE "public"."user_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."user_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_topic_reads" TO "anon";
GRANT ALL ON TABLE "public"."user_topic_reads" TO "authenticated";
GRANT ALL ON TABLE "public"."user_topic_reads" TO "service_role";



GRANT ALL ON TABLE "public"."user_topic_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."user_topic_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_topic_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."weekly_reports" TO "anon";
GRANT ALL ON TABLE "public"."weekly_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."weekly_reports" TO "service_role";



GRANT ALL ON TABLE "public"."workflow_artifacts" TO "anon";
GRANT ALL ON TABLE "public"."workflow_artifacts" TO "authenticated";
GRANT ALL ON TABLE "public"."workflow_artifacts" TO "service_role";



GRANT ALL ON TABLE "public"."workflow_templates" TO "anon";
GRANT ALL ON TABLE "public"."workflow_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."workflow_templates" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";




































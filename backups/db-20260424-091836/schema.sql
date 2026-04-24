--
-- PostgreSQL database dump
--

\restrict KmEHkltqTI7k5U2yzW1GuVNZNrbSZIeEfVpnBFGGwrVo1SWYKcZHrl5xq1oHxN0

-- Dumped from database version 15.8
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: drizzle; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA drizzle;


--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA extensions;


--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pgbouncer;


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: pgjwt; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgjwt WITH SCHEMA extensions;


--
-- Name: EXTENSION pgjwt; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgjwt IS 'JSON Web Token API for Postgresql';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


--
-- Name: adaptation_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.adaptation_status AS ENUM (
    'completed',
    'in_progress',
    'pending'
);


--
-- Name: advisor_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.advisor_status AS ENUM (
    'active',
    'training',
    'draft'
);


--
-- Name: ai_analysis_perspective; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ai_analysis_perspective AS ENUM (
    'summary',
    'journalist',
    'quotes',
    'timeline',
    'qa',
    'deep'
);


--
-- Name: ai_sentiment; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ai_sentiment AS ENUM (
    'neutral',
    'bullish',
    'critical',
    'advertorial'
);


--
-- Name: annotation_color; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.annotation_color AS ENUM (
    'red',
    'yellow',
    'green',
    'blue',
    'purple'
);


--
-- Name: article_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.article_status AS ENUM (
    'draft',
    'reviewing',
    'approved',
    'published',
    'archived'
);


--
-- Name: artifact_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.artifact_type AS ENUM (
    'topic_brief',
    'angle_list',
    'material_pack',
    'article_draft',
    'video_plan',
    'review_report',
    'publish_plan',
    'analytics_report',
    'generic',
    'cms_publication'
);


--
-- Name: asset_processing_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.asset_processing_status AS ENUM (
    'queued',
    'processing',
    'completed',
    'failed'
);


--
-- Name: asset_tag_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.asset_tag_category AS ENUM (
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


--
-- Name: audit_mode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.audit_mode AS ENUM (
    'auto',
    'human',
    'hybrid'
);


--
-- Name: audit_result; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.audit_result AS ENUM (
    'pass',
    'warning',
    'fail'
);


--
-- Name: audit_stage; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.audit_stage AS ENUM (
    'review_1',
    'review_2',
    'review_3'
);


--
-- Name: authority_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.authority_level AS ENUM (
    'observer',
    'advisor',
    'executor',
    'coordinator'
);


--
-- Name: batch_item_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.batch_item_status AS ENUM (
    'pending',
    'processing',
    'done',
    'failed'
);


--
-- Name: batch_job_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.batch_job_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'cancelled',
    'failed'
);


--
-- Name: benchmark_account_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.benchmark_account_level AS ENUM (
    'central',
    'provincial',
    'city',
    'industry',
    'self_media'
);


--
-- Name: benchmark_alert_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.benchmark_alert_priority AS ENUM (
    'urgent',
    'high',
    'medium',
    'low'
);


--
-- Name: benchmark_alert_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.benchmark_alert_status AS ENUM (
    'new',
    'acknowledged',
    'actioned',
    'dismissed'
);


--
-- Name: benchmark_alert_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.benchmark_alert_type AS ENUM (
    'missed_topic',
    'competitor_highlight',
    'gap_warning',
    'trend_alert'
);


--
-- Name: calendar_event_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.calendar_event_type AS ENUM (
    'festival',
    'competition',
    'conference',
    'exhibition',
    'launch',
    'memorial'
);


--
-- Name: calendar_recurrence; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.calendar_recurrence AS ENUM (
    'once',
    'yearly',
    'custom'
);


--
-- Name: calendar_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.calendar_source AS ENUM (
    'builtin',
    'manual',
    'ai_discovered'
);


--
-- Name: calendar_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.calendar_status AS ENUM (
    'confirmed',
    'pending_review'
);


--
-- Name: category_permission_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.category_permission_type AS ENUM (
    'read',
    'write',
    'manage'
);


--
-- Name: channel_message_direction; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.channel_message_direction AS ENUM (
    'inbound',
    'outbound'
);


--
-- Name: channel_message_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.channel_message_status AS ENUM (
    'received',
    'processed',
    'sent',
    'failed'
);


--
-- Name: channel_platform; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.channel_platform AS ENUM (
    'dingtalk',
    'wechat_work'
);


--
-- Name: channel_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.channel_status AS ENUM (
    'active',
    'paused',
    'setup'
);


--
-- Name: cms_publication_state; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.cms_publication_state AS ENUM (
    'submitting',
    'submitted',
    'synced',
    'rejected_by_cms',
    'failed',
    'retrying'
);


--
-- Name: conversion_task_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.conversion_task_status AS ENUM (
    'pending',
    'processing',
    'done',
    'failed'
);


--
-- Name: crawl_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.crawl_status AS ENUM (
    'active',
    'paused',
    'error'
);


--
-- Name: creation_chat_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.creation_chat_role AS ENUM (
    'editor',
    'ai'
);


--
-- Name: creation_session_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.creation_session_status AS ENUM (
    'active',
    'completed',
    'cancelled'
);


--
-- Name: editor_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.editor_type AS ENUM (
    'ai',
    'human'
);


--
-- Name: employee_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.employee_status AS ENUM (
    'working',
    'idle',
    'learning',
    'reviewing'
);


--
-- Name: entity_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.entity_type AS ENUM (
    'topic',
    'person',
    'event',
    'location',
    'organization'
);


--
-- Name: event_output_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.event_output_status AS ENUM (
    'pending',
    'processing',
    'done',
    'failed'
);


--
-- Name: event_output_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.event_output_type AS ENUM (
    'clip',
    'summary',
    'graphic',
    'flash',
    'quote_card'
);


--
-- Name: event_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.event_status AS ENUM (
    'upcoming',
    'live',
    'finished'
);


--
-- Name: event_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.event_type AS ENUM (
    'sport',
    'conference',
    'festival',
    'exhibition'
);


--
-- Name: feedback_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.feedback_type AS ENUM (
    'accept',
    'reject',
    'edit'
);


--
-- Name: highlight_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.highlight_type AS ENUM (
    'goal',
    'slam_dunk',
    'save',
    'foul',
    'highlight',
    'speech',
    'announcement'
);


--
-- Name: knowledge_source_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.knowledge_source_type AS ENUM (
    'upload',
    'cms',
    'subscription'
);


--
-- Name: learning_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.learning_source AS ENUM (
    'assigned',
    'discovered',
    'recommended'
);


--
-- Name: library_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.library_type AS ENUM (
    'personal',
    'product',
    'public'
);


--
-- Name: media_asset_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.media_asset_type AS ENUM (
    'video',
    'image',
    'audio',
    'document',
    'manuscript'
);


--
-- Name: media_catalog_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.media_catalog_status AS ENUM (
    'uncataloged',
    'cataloged'
);


--
-- Name: media_cdn_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.media_cdn_status AS ENUM (
    'not_started',
    'processing',
    'completed',
    'failed',
    'revoked'
);


--
-- Name: media_cms_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.media_cms_status AS ENUM (
    'not_started',
    'processing',
    'completed',
    'failed',
    'revoked'
);


--
-- Name: media_review_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.media_review_status AS ENUM (
    'not_submitted',
    'pending',
    'reviewing',
    'approved',
    'rejected'
);


--
-- Name: media_transcode_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.media_transcode_status AS ENUM (
    'not_started',
    'processing',
    'completed',
    'failed',
    'cancelled'
);


--
-- Name: memory_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.memory_type AS ENUM (
    'feedback',
    'pattern',
    'preference',
    'success_pattern',
    'failure_lesson',
    'user_preference',
    'skill_insight'
);


--
-- Name: missed_topic_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.missed_topic_priority AS ENUM (
    'high',
    'medium',
    'low'
);


--
-- Name: missed_topic_source_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.missed_topic_source_type AS ENUM (
    'social_hot',
    'sentiment_event',
    'benchmark_media'
);


--
-- Name: missed_topic_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.missed_topic_status AS ENUM (
    'missed',
    'tracking',
    'resolved'
);


--
-- Name: missed_topic_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.missed_topic_type AS ENUM (
    'breaking',
    'trending',
    'analysis'
);


--
-- Name: mission_message_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.mission_message_type AS ENUM (
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


--
-- Name: mission_phase; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.mission_phase AS ENUM (
    'assembling',
    'decomposing',
    'executing',
    'coordinating',
    'delivering'
);


--
-- Name: mission_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.mission_status AS ENUM (
    'queued',
    'planning',
    'executing',
    'coordinating',
    'consolidating',
    'completed',
    'failed',
    'cancelled'
);


--
-- Name: mission_task_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.mission_task_status AS ENUM (
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


--
-- Name: my_account_platform; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.my_account_platform AS ENUM (
    'app',
    'website',
    'wechat',
    'weibo',
    'douyin',
    'kuaishou',
    'bilibili',
    'xiaohongshu',
    'tv',
    'radio',
    'other'
);


--
-- Name: permission_grantee_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.permission_grantee_type AS ENUM (
    'user',
    'role'
);


--
-- Name: platform_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.platform_category AS ENUM (
    'central',
    'provincial',
    'municipal',
    'industry'
);


--
-- Name: publish_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.publish_status AS ENUM (
    'scheduled',
    'publishing',
    'published',
    'failed'
);


--
-- Name: research_dedup_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.research_dedup_level AS ENUM (
    'keyword',
    'district',
    'both'
);


--
-- Name: research_embedding_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.research_embedding_status AS ENUM (
    'pending',
    'processing',
    'done',
    'failed'
);


--
-- Name: research_media_outlet_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.research_media_outlet_status AS ENUM (
    'active',
    'archived'
);


--
-- Name: research_media_tier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.research_media_tier AS ENUM (
    'central',
    'provincial_municipal',
    'industry',
    'district_media',
    'self_media'
);


--
-- Name: research_news_source_channel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.research_news_source_channel AS ENUM (
    'tavily',
    'whitelist_crawl',
    'manual_url',
    'hot_topic_crawler'
);


--
-- Name: research_task_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.research_task_status AS ENUM (
    'pending',
    'crawling',
    'analyzing',
    'done',
    'failed',
    'cancelled'
);


--
-- Name: research_topic_match_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.research_topic_match_type AS ENUM (
    'keyword',
    'semantic',
    'both'
);


--
-- Name: review_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.review_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'escalated'
);


--
-- Name: review_tier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.review_tier AS ENUM (
    'strict',
    'relaxed'
);


--
-- Name: revive_scenario; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.revive_scenario AS ENUM (
    'topic_match',
    'hot_match',
    'daily_push',
    'intl_broadcast',
    'style_adapt'
);


--
-- Name: revive_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.revive_status AS ENUM (
    'pending',
    'adopted',
    'rejected'
);


--
-- Name: security_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.security_level AS ENUM (
    'public',
    'secret',
    'private',
    'top_secret',
    'confidential'
);


--
-- Name: share_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.share_status AS ENUM (
    'active',
    'expired',
    'cancelled'
);


--
-- Name: skill_binding_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.skill_binding_type AS ENUM (
    'core',
    'extended',
    'knowledge'
);


--
-- Name: skill_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.skill_category AS ENUM (
    'web_search',
    'data_collection',
    'topic_planning',
    'content_gen',
    'av_script',
    'quality_review',
    'content_analysis',
    'data_analysis',
    'distribution',
    'other'
);


--
-- Name: skill_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.skill_type AS ENUM (
    'builtin',
    'custom',
    'plugin'
);


--
-- Name: sync_log_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sync_log_status AS ENUM (
    'success',
    'error',
    'warning'
);


--
-- Name: tag_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tag_source AS ENUM (
    'ai_auto',
    'human_correct'
);


--
-- Name: topic_angle_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.topic_angle_status AS ENUM (
    'suggested',
    'accepted',
    'rejected'
);


--
-- Name: topic_match_decision; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.topic_match_decision AS ENUM (
    'covered',
    'suspected',
    'confirmed',
    'excluded',
    'pushed'
);


--
-- Name: topic_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.topic_priority AS ENUM (
    'P0',
    'P1',
    'P2'
);


--
-- Name: topic_trend; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.topic_trend AS ENUM (
    'rising',
    'surging',
    'plateau',
    'declining'
);


--
-- Name: trail_action; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.trail_action AS ENUM (
    'create',
    'edit',
    'review',
    'approve',
    'reject',
    'publish'
);


--
-- Name: trail_stage; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.trail_stage AS ENUM (
    'planning',
    'writing',
    'review_1',
    'review_2',
    'review_3',
    'publishing'
);


--
-- Name: vectorization_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.vectorization_status AS ENUM (
    'pending',
    'processing',
    'done',
    'failed'
);


--
-- Name: verification_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.verification_level AS ENUM (
    'simple',
    'important',
    'critical'
);


--
-- Name: verifier_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.verifier_type AS ENUM (
    'self_eval',
    'cross_review',
    'human'
);


--
-- Name: workflow_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.workflow_category AS ENUM (
    'news',
    'video',
    'analytics',
    'distribution',
    'deep',
    'social',
    'advanced',
    'livelihood',
    'podcast',
    'drama',
    'daily_brief',
    'custom'
);


--
-- Name: workflow_trigger_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.workflow_trigger_type AS ENUM (
    'manual',
    'scheduled'
);


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_cron_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  schema_is_cron bool;
BEGIN
  schema_is_cron = (
    SELECT n.nspname = 'cron'
    FROM pg_event_trigger_ddl_commands() AS ev
    LEFT JOIN pg_catalog.pg_namespace AS n
      ON ev.objid = n.oid
  );

  IF schema_is_cron
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;

  END IF;

END;
$$;


--
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';


--
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_net_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;

    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
    ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

    ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
    ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

    REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
    REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

    GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';


--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: -
--

CREATE FUNCTION pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    RAISE WARNING 'PgBouncer auth request: %', p_usename;

    RETURN QUERY
    SELECT usename::TEXT, passwd::TEXT FROM pg_catalog.pg_shadow
    WHERE usename = p_usename;
END;
$$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
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


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
_filename text;
BEGIN
    select string_to_array(name, '/') into _parts;
    select _parts[array_length(_parts,1)] into _filename;
    -- @todo return the last part instead of 2
    return split_part(_filename, '.', 2);
END
$$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
    select string_to_array(name, '/') into _parts;
    return _parts[array_length(_parts,1)];
END
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
    select string_to_array(name, '/') into _parts;
    return _parts[1:array_length(_parts,1)-1];
END
$$;


--
-- Name: search(text, text, integer, integer, integer); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql
    AS $$
DECLARE
_bucketId text;
BEGIN
    -- will be replaced by migrations when server starts
    -- saving space for cloud-init
END
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text,
    code_challenge_method auth.code_challenge_method,
    code_challenge text,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone,
    invite_token text,
    referrer text,
    oauth_client_state_id uuid,
    linking_target_id uuid,
    email_optional boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.flow_state IS 'Stores metadata for all OAuth/SSO login flows';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    token_endpoint_auth_method text NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048)),
    CONSTRAINT oauth_clients_token_endpoint_auth_method_check CHECK ((token_endpoint_auth_method = ANY (ARRAY['client_secret_basic'::text, 'client_secret_post'::text, 'none'::text])))
);


--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


--
-- Name: __drizzle_migrations; Type: TABLE; Schema: drizzle; Owner: -
--

CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE; Schema: drizzle; Owner: -
--

CREATE SEQUENCE drizzle.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: drizzle; Owner: -
--

ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;


--
-- Name: advisor_ab_tests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.advisor_ab_tests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    advisor_a_id uuid NOT NULL,
    advisor_b_id uuid NOT NULL,
    config_diff jsonb,
    status text DEFAULT 'active'::text,
    metrics jsonb,
    sample_size jsonb,
    winner text,
    confidence real,
    started_at timestamp with time zone DEFAULT now(),
    ended_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: advisor_compare_tests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.advisor_compare_tests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    test_input text NOT NULL,
    advisor_ids jsonb NOT NULL,
    results jsonb,
    selected_winner uuid,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ai_employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_employees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    nickname text NOT NULL,
    title text NOT NULL,
    motto text,
    role_type text NOT NULL,
    authority_level public.authority_level DEFAULT 'advisor'::public.authority_level NOT NULL,
    auto_actions jsonb DEFAULT '[]'::jsonb,
    need_approval_actions jsonb DEFAULT '[]'::jsonb,
    status public.employee_status DEFAULT 'idle'::public.employee_status NOT NULL,
    current_task text,
    work_preferences jsonb,
    learned_patterns jsonb DEFAULT '{}'::jsonb,
    tasks_completed integer DEFAULT 0 NOT NULL,
    accuracy real DEFAULT 0 NOT NULL,
    avg_response_time text DEFAULT '0s'::text NOT NULL,
    satisfaction real DEFAULT 0 NOT NULL,
    is_preset integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    disabled integer DEFAULT 0 NOT NULL
);


--
-- Name: article_ai_analysis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.article_ai_analysis (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    article_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    perspective public.ai_analysis_perspective NOT NULL,
    analysis_text text NOT NULL,
    sentiment public.ai_sentiment,
    metadata jsonb,
    generated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: article_annotations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.article_annotations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    article_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    quote text NOT NULL,
    note text,
    color public.annotation_color DEFAULT 'yellow'::public.annotation_color NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    timecode numeric,
    frame_snapshot text,
    is_pinned boolean DEFAULT false NOT NULL,
    pinned_position jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: article_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.article_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    article_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    usage_type text DEFAULT 'reference'::text NOT NULL,
    caption text,
    sort_order integer DEFAULT 0,
    segment_id uuid,
    start_time text,
    end_time text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: article_chat_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.article_chat_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    article_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role character varying(10) NOT NULL,
    content text NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.articles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    title text NOT NULL,
    subtitle text,
    slug text,
    body text,
    summary text,
    content jsonb,
    media_type text DEFAULT 'article'::text NOT NULL,
    status public.article_status DEFAULT 'draft'::public.article_status NOT NULL,
    priority text DEFAULT 'P1'::text,
    category_id uuid,
    assignee_id uuid,
    created_by uuid,
    advisor_notes jsonb,
    tags jsonb DEFAULT '[]'::jsonb,
    word_count integer DEFAULT 0,
    version integer DEFAULT 1,
    published_at timestamp with time zone,
    archived_at timestamp with time zone,
    task_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    mission_id uuid,
    web_archive_html text,
    web_archive_at timestamp with time zone,
    read_progress integer DEFAULT 0,
    transcript jsonb,
    chapters jsonb,
    publish_channels jsonb DEFAULT '[]'::jsonb,
    spread_data jsonb DEFAULT '{}'::jsonb
);


--
-- Name: asset_segments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_segments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    start_time text,
    end_time text,
    start_time_seconds real,
    end_time_seconds real,
    transcript text,
    ocr_texts jsonb DEFAULT '[]'::jsonb,
    nlu_summary text,
    scene_type text,
    visual_quality real,
    segment_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: asset_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    segment_id uuid,
    category public.asset_tag_category NOT NULL,
    label text NOT NULL,
    confidence real DEFAULT 0 NOT NULL,
    source public.tag_source DEFAULT 'ai_auto'::public.tag_source NOT NULL,
    corrected_by uuid,
    original_label text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    mission_id uuid,
    article_id uuid,
    content_type text NOT NULL,
    content_id uuid NOT NULL,
    stage public.audit_stage NOT NULL,
    mode public.audit_mode NOT NULL,
    reviewer_type text NOT NULL,
    reviewer_id text NOT NULL,
    dimensions jsonb,
    overall_result public.audit_result NOT NULL,
    issues jsonb DEFAULT '[]'::jsonb,
    comment text,
    content_snapshot text,
    diff jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    scenario_key text,
    name text NOT NULL,
    dimensions jsonb,
    review_1_mode public.audit_mode NOT NULL,
    review_2_mode public.audit_mode NOT NULL,
    review_3_mode public.audit_mode NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: batch_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.batch_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_job_id uuid NOT NULL,
    topic_title text NOT NULL,
    channel text,
    format text,
    status public.batch_item_status DEFAULT 'pending'::public.batch_item_status NOT NULL,
    output_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: batch_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.batch_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    goal_description text NOT NULL,
    total_items integer DEFAULT 0 NOT NULL,
    completed_items integer DEFAULT 0 NOT NULL,
    status public.batch_job_status DEFAULT 'pending'::public.batch_job_status NOT NULL,
    scheduled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: benchmark_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.benchmark_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    platform public.my_account_platform NOT NULL,
    level public.benchmark_account_level NOT NULL,
    handle text NOT NULL,
    name text NOT NULL,
    avatar_url text,
    description text,
    account_url text,
    region text,
    is_preset boolean DEFAULT false NOT NULL,
    is_enabled boolean DEFAULT true NOT NULL,
    last_crawled_at timestamp with time zone,
    post_count integer DEFAULT 0,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: benchmark_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.benchmark_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    title text NOT NULL,
    description text NOT NULL,
    priority public.benchmark_alert_priority DEFAULT 'medium'::public.benchmark_alert_priority NOT NULL,
    type public.benchmark_alert_type NOT NULL,
    status public.benchmark_alert_status DEFAULT 'new'::public.benchmark_alert_status NOT NULL,
    platform_content_ids jsonb DEFAULT '[]'::jsonb,
    related_platforms jsonb DEFAULT '[]'::jsonb,
    related_topics jsonb DEFAULT '[]'::jsonb,
    analysis_data jsonb DEFAULT '{}'::jsonb,
    actioned_by uuid,
    action_note text,
    workflow_instance_id uuid,
    generated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: benchmark_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.benchmark_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    benchmark_account_id uuid NOT NULL,
    title text NOT NULL,
    summary text,
    body text,
    source_url text,
    topic text,
    content_fingerprint text,
    published_at timestamp with time zone,
    views integer DEFAULT 0,
    likes integer DEFAULT 0,
    shares integer DEFAULT 0,
    comments integer DEFAULT 0,
    raw_metadata jsonb,
    ai_interpretation jsonb,
    ai_interpretation_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: calendar_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendar_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    event_type public.calendar_event_type NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    is_all_day boolean DEFAULT true NOT NULL,
    recurrence public.calendar_recurrence DEFAULT 'once'::public.calendar_recurrence NOT NULL,
    source public.calendar_source NOT NULL,
    status public.calendar_status DEFAULT 'confirmed'::public.calendar_status NOT NULL,
    ai_angles jsonb DEFAULT '[]'::jsonb,
    reminder_days_before integer DEFAULT 3 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: case_library; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.case_library (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    content_id text NOT NULL,
    title text NOT NULL,
    channel text,
    score integer NOT NULL,
    success_factors jsonb,
    tags jsonb DEFAULT '[]'::jsonb,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    parent_id uuid,
    level integer DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    scope text DEFAULT 'article'::text NOT NULL,
    workflow_id uuid,
    video_transcode_group text,
    audio_transcode_group text,
    catalog_template_id text
);


--
-- Name: category_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.category_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    category_id uuid NOT NULL,
    grantee_type public.permission_grantee_type NOT NULL,
    grantee_id text NOT NULL,
    permission_type public.category_permission_type NOT NULL,
    inherited boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: channel_advisors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_advisors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    channel_type text NOT NULL,
    personality text NOT NULL,
    avatar text,
    style text,
    strengths jsonb DEFAULT '[]'::jsonb,
    catchphrase text,
    system_prompt text,
    style_constraints jsonb,
    status public.advisor_status DEFAULT 'draft'::public.advisor_status NOT NULL,
    ai_employee_id uuid,
    target_audience text,
    channel_positioning text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: channel_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_configs (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    platform public.channel_platform NOT NULL,
    name text NOT NULL,
    app_key text,
    app_secret text,
    robot_secret text,
    agent_id text,
    token text,
    encoding_aes_key text,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: channel_dna_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_dna_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    advisor_id uuid NOT NULL,
    dimensions jsonb DEFAULT '[]'::jsonb,
    report text,
    word_cloud jsonb,
    style_examples jsonb,
    analyzed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: channel_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_messages (
    id uuid NOT NULL,
    organization_id uuid NOT NULL,
    config_id uuid NOT NULL,
    platform public.channel_platform NOT NULL,
    direction public.channel_message_direction NOT NULL,
    external_message_id text,
    external_user_id text,
    chat_id text,
    content jsonb NOT NULL,
    mission_id uuid,
    status public.channel_message_status DEFAULT 'received'::public.channel_message_status NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: channel_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    channel_id uuid NOT NULL,
    date date NOT NULL,
    views integer DEFAULT 0 NOT NULL,
    likes integer DEFAULT 0 NOT NULL,
    shares integer DEFAULT 0 NOT NULL,
    comments integer DEFAULT 0 NOT NULL,
    followers integer DEFAULT 0 NOT NULL,
    engagement real DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: channels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    platform text NOT NULL,
    icon text,
    api_config jsonb,
    status public.channel_status DEFAULT 'setup'::public.channel_status NOT NULL,
    followers integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cms_apps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cms_apps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    channel_key text NOT NULL,
    cms_app_id text NOT NULL,
    site_id integer NOT NULL,
    name text NOT NULL,
    appkey text,
    appsecret text,
    last_synced_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cms_catalogs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cms_catalogs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    cms_catalog_id integer NOT NULL,
    app_id integer NOT NULL,
    site_id integer NOT NULL,
    name text NOT NULL,
    parent_id integer DEFAULT 0,
    inner_code text,
    alias text,
    tree_level integer,
    is_leaf boolean DEFAULT true,
    catalog_type integer DEFAULT 1,
    video_player text,
    audio_player text,
    live_player text,
    vlive_player text,
    h5_preview text,
    pc_preview text,
    url text,
    deleted_at timestamp with time zone,
    last_synced_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cms_channels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cms_channels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    channel_key text NOT NULL,
    channel_code integer NOT NULL,
    name text NOT NULL,
    pick_value text,
    third_flag text,
    last_synced_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cms_publications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cms_publications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    article_id uuid NOT NULL,
    cms_article_id text,
    cms_catalog_id text,
    cms_site_id integer,
    cms_state public.cms_publication_state DEFAULT 'submitting'::public.cms_publication_state NOT NULL,
    cms_type integer,
    request_hash text,
    request_payload jsonb,
    response_payload jsonb,
    preview_url text,
    published_url text,
    attempts integer DEFAULT 0 NOT NULL,
    error_code text,
    error_message text,
    operator_id text,
    trigger_source text,
    scheduled_at timestamp with time zone,
    submitted_at timestamp with time zone,
    synced_at timestamp with time zone,
    last_attempt_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cms_sync_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cms_sync_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    state text NOT NULL,
    stats jsonb,
    warnings jsonb,
    trigger_source text,
    operator_id text,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    duration_ms integer,
    error_message text
);


--
-- Name: collected_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collected_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    content_fingerprint text NOT NULL,
    canonical_url text,
    canonical_url_hash text,
    title text NOT NULL,
    content text,
    summary text,
    published_at timestamp with time zone,
    first_seen_source_id uuid,
    first_seen_channel text NOT NULL,
    first_seen_at timestamp with time zone NOT NULL,
    source_channels jsonb DEFAULT '[]'::jsonb NOT NULL,
    category text,
    tags text[],
    language text,
    derived_modules text[] DEFAULT ARRAY[]::text[] NOT NULL,
    raw_metadata jsonb,
    enrichment_status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: collection_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collection_logs (
    id bigint NOT NULL,
    run_id uuid NOT NULL,
    source_id uuid NOT NULL,
    level text NOT NULL,
    message text NOT NULL,
    metadata jsonb,
    logged_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: collection_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.collection_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: collection_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.collection_logs_id_seq OWNED BY public.collection_logs.id;


--
-- Name: collection_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collection_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    trigger text NOT NULL,
    started_at timestamp with time zone NOT NULL,
    finished_at timestamp with time zone,
    status text NOT NULL,
    items_attempted integer DEFAULT 0 NOT NULL,
    items_inserted integer DEFAULT 0 NOT NULL,
    items_merged integer DEFAULT 0 NOT NULL,
    items_failed integer DEFAULT 0 NOT NULL,
    error_summary text,
    metadata jsonb
);


--
-- Name: collection_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collection_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    source_type text NOT NULL,
    config jsonb NOT NULL,
    schedule_cron text,
    schedule_min_interval_seconds integer,
    target_modules text[] DEFAULT ARRAY[]::text[] NOT NULL,
    default_category text,
    default_tags text[],
    enabled boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_run_at timestamp with time zone,
    last_run_status text,
    total_items_collected bigint DEFAULT 0 NOT NULL,
    total_runs bigint DEFAULT 0 NOT NULL,
    deleted_at timestamp with time zone,
    research_bridge_enabled boolean DEFAULT false NOT NULL
);


--
-- Name: comment_insights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comment_insights (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hot_topic_id uuid NOT NULL,
    positive real DEFAULT 0 NOT NULL,
    neutral real DEFAULT 0 NOT NULL,
    negative real DEFAULT 0 NOT NULL,
    hot_comments jsonb DEFAULT '[]'::jsonb,
    analyzed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: competitor_hits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.competitor_hits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    competitor_name text NOT NULL,
    title text NOT NULL,
    platform text NOT NULL,
    metrics jsonb,
    success_factors jsonb,
    analyzed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: competitor_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.competitor_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hot_topic_id uuid NOT NULL,
    competitor_name text NOT NULL,
    response_type text,
    response_time text,
    content_url text,
    views text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: competitors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.competitors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name text NOT NULL,
    platform text,
    followers integer DEFAULT 0,
    avg_views integer DEFAULT 0,
    publish_freq text,
    strengths jsonb DEFAULT '[]'::jsonb,
    gaps jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: compliance_checks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_checks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    content_id uuid,
    content_type text,
    content text NOT NULL,
    issues jsonb DEFAULT '[]'::jsonb,
    is_clean boolean DEFAULT true,
    checked_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: content_trail_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_trail_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    content_id uuid NOT NULL,
    content_type text NOT NULL,
    operator text NOT NULL,
    operator_type text NOT NULL,
    action public.trail_action NOT NULL,
    stage public.trail_stage NOT NULL,
    content_snapshot text,
    diff jsonb,
    comment text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: content_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    version_number integer DEFAULT 1 NOT NULL,
    headline text,
    body text,
    word_count integer DEFAULT 0,
    editor_type public.editor_type DEFAULT 'ai'::public.editor_type NOT NULL,
    change_summary text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: conversion_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversion_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    source_ratio text NOT NULL,
    target_ratio text NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb,
    status public.conversion_task_status DEFAULT 'pending'::public.conversion_task_status NOT NULL,
    batch_item_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: creation_chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.creation_chat_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    role public.creation_chat_role NOT NULL,
    employee_id uuid,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: creation_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.creation_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    goal_title text NOT NULL,
    goal_description text,
    media_types jsonb DEFAULT '[]'::jsonb,
    status public.creation_session_status DEFAULT 'active'::public.creation_session_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: detected_faces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.detected_faces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    segment_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    name text NOT NULL,
    role text,
    confidence real DEFAULT 0 NOT NULL,
    appearances integer DEFAULT 1,
    bounding_box jsonb,
    thumbnail_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: editor_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.editor_scores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    user_name text NOT NULL,
    total_points integer DEFAULT 0,
    level integer DEFAULT 1,
    achievements jsonb,
    monthly_points integer DEFAULT 0,
    weekly_points integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: effect_attributions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.effect_attributions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    publish_plan_id uuid,
    workflow_instance_id uuid,
    employee_id uuid,
    reach jsonb,
    engagement jsonb,
    quality_score jsonb,
    attributed_at timestamp without time zone DEFAULT now()
);


--
-- Name: employee_config_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_config_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    version integer NOT NULL,
    snapshot jsonb NOT NULL,
    changed_by uuid,
    changed_fields jsonb,
    change_description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: employee_knowledge_bases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_knowledge_bases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    knowledge_base_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: employee_memories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_memories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    memory_type public.memory_type NOT NULL,
    content text NOT NULL,
    source text,
    importance real DEFAULT 0.5 NOT NULL,
    access_count integer DEFAULT 0 NOT NULL,
    last_accessed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    source_task_id uuid,
    confidence real DEFAULT 1 NOT NULL,
    decay_rate real DEFAULT 0.01 NOT NULL
);


--
-- Name: employee_skills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_skills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    skill_id uuid NOT NULL,
    level integer DEFAULT 50 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    binding_type public.skill_binding_type DEFAULT 'extended'::public.skill_binding_type NOT NULL,
    usage_count integer DEFAULT 0 NOT NULL,
    success_count integer DEFAULT 0 NOT NULL,
    last_quality_avg real,
    learned_at timestamp with time zone,
    learning_source public.learning_source DEFAULT 'assigned'::public.learning_source NOT NULL
);


--
-- Name: event_highlights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_highlights (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    "time" text,
    type public.highlight_type NOT NULL,
    description text,
    auto_clipped boolean DEFAULT false,
    clip_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: event_outputs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_outputs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    title text NOT NULL,
    type public.event_output_type NOT NULL,
    status public.event_output_status DEFAULT 'pending'::public.event_output_status NOT NULL,
    progress integer DEFAULT 0,
    output_url text,
    duration text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: event_transcriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_transcriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    speaker text,
    content text NOT NULL,
    golden_quote boolean DEFAULT false,
    "timestamp" text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name text NOT NULL,
    type public.event_type NOT NULL,
    status public.event_status DEFAULT 'upcoming'::public.event_status NOT NULL,
    start_time timestamp with time zone,
    end_time timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    stats jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: execution_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.execution_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    employee_id uuid NOT NULL,
    step_label text,
    topic_title text,
    scenario text,
    output_summary text,
    output_full jsonb,
    tokens_input integer DEFAULT 0 NOT NULL,
    tokens_output integer DEFAULT 0 NOT NULL,
    duration_ms integer DEFAULT 0 NOT NULL,
    tool_call_count integer DEFAULT 0 NOT NULL,
    model_id text,
    temperature jsonb,
    status text DEFAULT 'success'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    mission_id uuid,
    mission_task_id uuid
);


--
-- Name: hit_predictions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hit_predictions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    content_id text NOT NULL,
    predicted_score integer NOT NULL,
    actual_score integer,
    dimensions jsonb,
    suggestions jsonb DEFAULT '[]'::jsonb,
    suggestions_adopted integer DEFAULT 0,
    tracking_started_at timestamp with time zone,
    tracking_completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hot_topic_crawl_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hot_topic_crawl_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    platform_name text NOT NULL,
    platform_node_id text,
    status text NOT NULL,
    topics_found integer DEFAULT 0 NOT NULL,
    error_message text,
    crawled_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hot_topics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hot_topics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    title text NOT NULL,
    priority public.topic_priority DEFAULT 'P1'::public.topic_priority NOT NULL,
    heat_score real DEFAULT 0 NOT NULL,
    trend public.topic_trend DEFAULT 'rising'::public.topic_trend NOT NULL,
    source text,
    category text,
    summary text,
    heat_curve jsonb DEFAULT '[]'::jsonb,
    platforms jsonb DEFAULT '[]'::jsonb,
    discovered_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    title_hash text,
    source_url text,
    ai_score real,
    enriched_outlines jsonb DEFAULT '[]'::jsonb,
    related_materials jsonb DEFAULT '[]'::jsonb,
    collected_item_id uuid
);


--
-- Name: improvement_trackings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.improvement_trackings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    suggestion_source text,
    suggestion text NOT NULL,
    adopted_at timestamp with time zone,
    baseline_metrics jsonb,
    current_metrics jsonb,
    effect_score real,
    status text DEFAULT 'pending'::text,
    track_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: intent_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.intent_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    employee_slug text NOT NULL,
    user_message text NOT NULL,
    intent_type text NOT NULL,
    intent_result jsonb NOT NULL,
    user_edited boolean DEFAULT false NOT NULL,
    edited_intent jsonb,
    execution_success boolean,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: international_adaptations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.international_adaptations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    source_asset_id uuid NOT NULL,
    language text NOT NULL,
    language_code text NOT NULL,
    flag text,
    generated_title text,
    generated_excerpt text,
    adaptation_notes text,
    status public.adaptation_status DEFAULT 'pending'::public.adaptation_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);


--
-- Name: knowledge_bases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_bases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name text NOT NULL,
    description text,
    type text DEFAULT 'general'::text NOT NULL,
    document_count integer DEFAULT 0,
    vectorization_status public.vectorization_status DEFAULT 'pending'::public.vectorization_status NOT NULL,
    chunk_count integer DEFAULT 0,
    last_sync_at timestamp with time zone,
    sync_config jsonb,
    source_url text,
    source_type public.knowledge_source_type DEFAULT 'upload'::public.knowledge_source_type NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: knowledge_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    knowledge_base_id uuid NOT NULL,
    title text,
    snippet text,
    full_content text,
    source_document text,
    source_type public.knowledge_source_type DEFAULT 'upload'::public.knowledge_source_type NOT NULL,
    chunk_index integer DEFAULT 0,
    tags jsonb DEFAULT '[]'::jsonb,
    embedding jsonb,
    embedding_model text,
    relevance_score real,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: knowledge_nodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_nodes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    entity_type public.entity_type NOT NULL,
    entity_name text NOT NULL,
    description text,
    metadata jsonb,
    connection_count integer DEFAULT 0 NOT NULL,
    source_asset_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: knowledge_relations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_relations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_node_id uuid NOT NULL,
    target_node_id uuid NOT NULL,
    relation_type text NOT NULL,
    weight real DEFAULT 1,
    metadata jsonb,
    source_asset_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: knowledge_sync_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_sync_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    knowledge_base_id uuid NOT NULL,
    action text NOT NULL,
    status public.sync_log_status NOT NULL,
    detail text,
    documents_processed integer DEFAULT 0,
    chunks_generated integer DEFAULT 0,
    errors_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: media_asset_shares; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_asset_shares (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    asset_ids jsonb NOT NULL,
    created_by uuid NOT NULL,
    share_token text NOT NULL,
    password text,
    expires_at timestamp with time zone,
    max_access_count integer,
    current_access_count integer DEFAULT 0 NOT NULL,
    allow_download boolean DEFAULT true NOT NULL,
    status public.share_status DEFAULT 'active'::public.share_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: media_assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    title text NOT NULL,
    type public.media_asset_type NOT NULL,
    description text,
    file_url text,
    thumbnail_url text,
    file_name text,
    file_size bigint,
    file_size_display text,
    mime_type text,
    duration text,
    duration_seconds integer,
    source text,
    source_id text,
    tags jsonb DEFAULT '[]'::jsonb,
    understanding_status public.asset_processing_status DEFAULT 'queued'::public.asset_processing_status NOT NULL,
    understanding_progress integer DEFAULT 0 NOT NULL,
    total_tags integer DEFAULT 0 NOT NULL,
    processed_at timestamp with time zone,
    category_id uuid,
    usage_count integer DEFAULT 0 NOT NULL,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    width integer,
    height integer,
    tos_object_key text,
    tos_bucket text,
    library_type public.library_type DEFAULT 'personal'::public.library_type NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    original_category_id uuid,
    security_level public.security_level DEFAULT 'public'::public.security_level NOT NULL,
    review_status public.media_review_status DEFAULT 'not_submitted'::public.media_review_status NOT NULL,
    catalog_status public.media_catalog_status DEFAULT 'uncataloged'::public.media_catalog_status NOT NULL,
    transcode_status public.media_transcode_status DEFAULT 'not_started'::public.media_transcode_status NOT NULL,
    cdn_status public.media_cdn_status DEFAULT 'not_started'::public.media_cdn_status NOT NULL,
    cms_status public.media_cms_status DEFAULT 'not_started'::public.media_cms_status NOT NULL,
    version_number integer DEFAULT 1 NOT NULL,
    parent_version_id uuid,
    catalog_data jsonb
);


--
-- Name: message_reads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_reads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    message_id uuid NOT NULL,
    read_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: missed_topics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.missed_topics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    primary_benchmark_post_id uuid NOT NULL,
    related_benchmark_post_ids jsonb DEFAULT '[]'::jsonb,
    title text NOT NULL,
    topic text,
    content_fingerprint text,
    discovered_at timestamp with time zone DEFAULT now() NOT NULL,
    heat_score real DEFAULT 0,
    decision public.topic_match_decision DEFAULT 'suspected'::public.topic_match_decision NOT NULL,
    matched_my_post_id uuid,
    matched_my_post_title_snapshot text,
    excluded_reason_code text,
    excluded_reason_text text,
    confirmed_by uuid,
    confirmed_at timestamp with time zone,
    push_status text DEFAULT 'not_pushed'::text NOT NULL,
    pushed_at timestamp with time zone,
    push_error_message text,
    push_payload jsonb,
    ai_summary jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mission_artifacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_artifacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mission_id uuid NOT NULL,
    task_id uuid,
    produced_by uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    content text,
    file_url text,
    metadata jsonb DEFAULT '{}'::jsonb,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mission_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mission_id uuid NOT NULL,
    from_employee_id uuid NOT NULL,
    to_employee_id uuid,
    message_type public.mission_message_type NOT NULL,
    content text NOT NULL,
    related_task_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    channel text DEFAULT 'direct'::text NOT NULL,
    structured_data jsonb,
    priority text DEFAULT 'normal'::text NOT NULL,
    reply_to uuid
);


--
-- Name: mission_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mission_id uuid NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    expected_output text,
    assigned_employee_id uuid,
    status public.mission_task_status DEFAULT 'pending'::public.mission_task_status NOT NULL,
    dependencies jsonb DEFAULT '[]'::jsonb,
    priority integer DEFAULT 0 NOT NULL,
    input_context jsonb,
    output_data jsonb,
    error_message text,
    retry_count integer DEFAULT 0 NOT NULL,
    claimed_at timestamp with time zone,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    acceptance_criteria text,
    assigned_role text,
    output_summary text,
    error_recoverable integer DEFAULT 1 NOT NULL,
    phase integer,
    progress integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: missions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.missions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    title text NOT NULL,
    scenario text NOT NULL,
    user_instruction text NOT NULL,
    leader_employee_id uuid NOT NULL,
    team_members jsonb DEFAULT '[]'::jsonb,
    status public.mission_status DEFAULT 'planning'::public.mission_status NOT NULL,
    final_output jsonb,
    token_budget integer DEFAULT 200000 NOT NULL,
    tokens_used integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    description text,
    phase public.mission_phase,
    progress integer DEFAULT 0 NOT NULL,
    config jsonb DEFAULT '{"max_agents": 8, "max_retries": 3, "task_timeout": 300}'::jsonb,
    started_at timestamp with time zone,
    source_module text,
    source_entity_id text,
    source_entity_type text,
    workflow_template_id uuid,
    input_params jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: monitored_platforms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.monitored_platforms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name text NOT NULL,
    url text NOT NULL,
    category public.platform_category DEFAULT 'central'::public.platform_category NOT NULL,
    province text,
    crawl_frequency_minutes integer DEFAULT 1440,
    status public.crawl_status DEFAULT 'active'::public.crawl_status NOT NULL,
    crawl_config jsonb DEFAULT '{}'::jsonb,
    last_crawled_at timestamp with time zone,
    last_error_message text,
    total_content_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: my_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.my_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    platform public.my_account_platform NOT NULL,
    handle text NOT NULL,
    name text NOT NULL,
    avatar_url text,
    description text,
    account_url text,
    crawl_config jsonb DEFAULT '{}'::jsonb,
    crawl_status text DEFAULT 'manual'::text,
    last_crawled_at timestamp with time zone,
    post_count integer DEFAULT 0,
    follower_count integer,
    notes text,
    is_enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: my_post_distributions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.my_post_distributions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    my_post_id uuid NOT NULL,
    my_account_id uuid NOT NULL,
    published_url text,
    published_at timestamp with time zone,
    views integer DEFAULT 0,
    likes integer DEFAULT 0,
    shares integer DEFAULT 0,
    comments integer DEFAULT 0,
    raw_metadata jsonb,
    collected_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: my_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.my_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    title text NOT NULL,
    summary text,
    body text,
    topic text,
    content_fingerprint text,
    internal_article_id uuid,
    original_author text,
    original_source_url text,
    published_at timestamp with time zone,
    total_views integer DEFAULT 0,
    total_likes integer DEFAULT 0,
    total_shares integer DEFAULT 0,
    total_comments integer DEFAULT 0,
    stats_aggregated_at timestamp with time zone,
    dimension_scores jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: performance_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.performance_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid NOT NULL,
    snapshot_date date NOT NULL,
    tasks_completed integer DEFAULT 0,
    accuracy real DEFAULT 0,
    avg_response_time real DEFAULT 0,
    satisfaction real DEFAULT 0,
    quality_avg real DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: point_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.point_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    points integer NOT NULL,
    reason text NOT NULL,
    reference_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: production_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.production_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    category text,
    structure jsonb NOT NULL,
    variables jsonb DEFAULT '[]'::jsonb,
    usage_count integer DEFAULT 0,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: publish_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.publish_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    channel_id uuid NOT NULL,
    task_id uuid,
    title text NOT NULL,
    adapted_content jsonb,
    status public.publish_status DEFAULT 'scheduled'::public.publish_status NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    published_at timestamp with time zone,
    trigger_conditions jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: research_cq_districts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.research_cq_districts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    code text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: research_media_outlet_aliases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.research_media_outlet_aliases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    outlet_id uuid NOT NULL,
    alias text NOT NULL,
    match_pattern text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: research_media_outlet_crawl_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.research_media_outlet_crawl_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    outlet_id uuid NOT NULL,
    list_url_template text NOT NULL,
    article_url_pattern text,
    schedule_cron text DEFAULT '0 3 * * *'::text NOT NULL,
    last_crawled_at timestamp with time zone,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: research_media_outlets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.research_media_outlets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    tier public.research_media_tier NOT NULL,
    province text,
    district_id uuid,
    industry_tag text,
    official_url text,
    status public.research_media_outlet_status DEFAULT 'active'::public.research_media_outlet_status NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: research_news_article_topic_hits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.research_news_article_topic_hits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    article_id uuid NOT NULL,
    topic_id uuid NOT NULL,
    research_task_id uuid NOT NULL,
    match_type public.research_topic_match_type NOT NULL,
    matched_keywords jsonb DEFAULT '[]'::jsonb NOT NULL,
    matched_fields jsonb DEFAULT '[]'::jsonb NOT NULL,
    semantic_score numeric(5,4),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: research_news_articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.research_news_articles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    url text NOT NULL,
    url_hash text NOT NULL,
    title text NOT NULL,
    content text,
    html_snapshot_path text,
    published_at timestamp with time zone,
    outlet_id uuid,
    outlet_tier_snapshot public.research_media_tier,
    district_id_snapshot uuid,
    source_channel public.research_news_source_channel NOT NULL,
    crawled_at timestamp with time zone DEFAULT now() NOT NULL,
    embedding jsonb,
    embedding_status public.research_embedding_status DEFAULT 'pending'::public.research_embedding_status NOT NULL,
    raw_metadata jsonb,
    first_seen_research_task_id uuid,
    content_fetch_status text DEFAULT 'pending'::text NOT NULL
);


--
-- Name: research_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.research_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    time_range_start timestamp with time zone NOT NULL,
    time_range_end timestamp with time zone NOT NULL,
    topic_ids jsonb NOT NULL,
    district_ids jsonb NOT NULL,
    media_tiers jsonb NOT NULL,
    custom_urls jsonb DEFAULT '[]'::jsonb NOT NULL,
    semantic_enabled boolean DEFAULT true NOT NULL,
    semantic_threshold numeric(4,3) DEFAULT 0.720 NOT NULL,
    dedup_level public.research_dedup_level DEFAULT 'district'::public.research_dedup_level NOT NULL,
    status public.research_task_status DEFAULT 'pending'::public.research_task_status NOT NULL,
    progress jsonb DEFAULT '{}'::jsonb NOT NULL,
    result_summary jsonb,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);


--
-- Name: research_topic_keywords; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.research_topic_keywords (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    topic_id uuid NOT NULL,
    keyword text NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: research_topic_samples; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.research_topic_samples (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    topic_id uuid NOT NULL,
    sample_text text NOT NULL,
    embedding jsonb,
    embedding_status public.research_embedding_status DEFAULT 'pending'::public.research_embedding_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: research_topics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.research_topics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_preset boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: review_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.review_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    content_id text NOT NULL,
    content_type text DEFAULT 'article'::text NOT NULL,
    reviewer_employee_id uuid NOT NULL,
    status public.review_status DEFAULT 'pending'::public.review_status NOT NULL,
    issues jsonb DEFAULT '[]'::jsonb,
    score integer,
    channel_rules jsonb,
    escalated_at timestamp with time zone,
    escalation_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: revive_recommendations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.revive_recommendations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    scenario public.revive_scenario NOT NULL,
    matched_topic text,
    reason text,
    match_score real DEFAULT 0 NOT NULL,
    suggested_action text,
    estimated_reach text,
    status public.revive_status DEFAULT 'pending'::public.revive_status NOT NULL,
    adopted_by uuid,
    responded_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: revive_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.revive_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    recommendation_id uuid,
    asset_id uuid NOT NULL,
    scenario public.revive_scenario NOT NULL,
    result_reach integer,
    created_content_id uuid,
    summary text,
    status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    is_system boolean DEFAULT false NOT NULL,
    permissions jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: saved_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.saved_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    employee_slug text NOT NULL,
    title text NOT NULL,
    summary text,
    messages jsonb DEFAULT '[]'::jsonb NOT NULL,
    scenario_id uuid,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sensitive_word_lists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sensitive_word_lists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    words jsonb DEFAULT '[]'::jsonb,
    category text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: skill_combos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skill_combos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    skill_ids jsonb NOT NULL,
    config jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: skill_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skill_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    skill_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    file_type text NOT NULL,
    file_name text NOT NULL,
    file_path text NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: skill_usage_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skill_usage_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    skill_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    organization_id uuid,
    success integer DEFAULT 1 NOT NULL,
    quality_score integer,
    execution_time_ms integer,
    token_usage integer,
    error_message text,
    input_summary text,
    output_summary text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    mission_id uuid,
    mission_task_id uuid
);


--
-- Name: skill_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skill_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    skill_id uuid NOT NULL,
    organization_id uuid,
    version text NOT NULL,
    version_number integer DEFAULT 1 NOT NULL,
    snapshot jsonb NOT NULL,
    change_description text,
    changed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: skills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name text NOT NULL,
    category public.skill_category NOT NULL,
    type public.skill_type DEFAULT 'builtin'::public.skill_type NOT NULL,
    version text DEFAULT '1.0'::text NOT NULL,
    description text NOT NULL,
    input_schema jsonb,
    output_schema jsonb,
    runtime_config jsonb,
    compatible_roles jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    content text DEFAULT ''::text,
    plugin_config jsonb,
    slug text
);


--
-- Name: style_adaptations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.style_adaptations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    source_asset_id uuid NOT NULL,
    style text NOT NULL,
    style_label text,
    generated_title text,
    generated_excerpt text,
    tone text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tag_schemas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tag_schemas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    description text,
    options jsonb,
    is_custom boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    assignee_id uuid,
    title text NOT NULL,
    description text,
    media_type text,
    status text DEFAULT 'pending'::text NOT NULL,
    priority text DEFAULT 'P1'::text,
    content jsonb,
    advisor_notes jsonb,
    word_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    session_id uuid,
    progress integer DEFAULT 0
);


--
-- Name: topic_angles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.topic_angles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    hot_topic_id uuid NOT NULL,
    angle_text text NOT NULL,
    generated_by uuid,
    status public.topic_angle_status DEFAULT 'suggested'::public.topic_angle_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: topic_matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.topic_matches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    my_post_id uuid NOT NULL,
    benchmark_post_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
    match_count integer DEFAULT 0 NOT NULL,
    similarity_score real,
    matched_by text DEFAULT 'llm'::text NOT NULL,
    matched_reasons jsonb,
    ai_analysis jsonb,
    ai_analysis_version integer DEFAULT 1,
    ai_analysis_source text,
    ai_analysis_at timestamp with time zone,
    expires_at timestamp with time zone,
    radar_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    workflow_instance_id uuid,
    step_key text,
    employee_id uuid,
    feedback_type public.feedback_type NOT NULL,
    original_content text,
    edited_content text,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    id uuid NOT NULL,
    organization_id uuid,
    display_name text NOT NULL,
    role text DEFAULT 'editor'::text NOT NULL,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_super_admin boolean DEFAULT false NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    assigned_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_topic_reads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_topic_reads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    last_viewed_at timestamp with time zone DEFAULT now() NOT NULL,
    read_topic_ids jsonb DEFAULT '[]'::jsonb,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_topic_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_topic_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    organization_id uuid NOT NULL,
    subscribed_categories jsonb DEFAULT '[]'::jsonb,
    subscribed_event_types jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: verification_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.verification_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    mission_id uuid,
    task_id uuid,
    conversation_id uuid,
    verification_level public.verification_level NOT NULL,
    verifier_type public.verifier_type NOT NULL,
    verifier_employee_id uuid,
    quality_score real NOT NULL,
    passed boolean NOT NULL,
    feedback text,
    issues_found jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: weekly_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weekly_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    period text NOT NULL,
    overall_score real DEFAULT 0,
    missed_rate real DEFAULT 0,
    response_speed text,
    coverage_rate real DEFAULT 0,
    trends jsonb DEFAULT '[]'::jsonb,
    gap_list jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: workflow_artifacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_artifacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    artifact_type public.artifact_type NOT NULL,
    title text NOT NULL,
    content jsonb,
    text_content text,
    producer_employee_id uuid,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    mission_id uuid NOT NULL,
    producer_task_id uuid
);


--
-- Name: workflow_template_tab_order; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_template_tab_order (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    tab_key text NOT NULL,
    template_id uuid NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    pinned_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: workflow_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    name text NOT NULL,
    description text,
    steps jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    category public.workflow_category DEFAULT 'custom'::public.workflow_category,
    trigger_type public.workflow_trigger_type DEFAULT 'manual'::public.workflow_trigger_type,
    trigger_config jsonb,
    is_builtin boolean DEFAULT false NOT NULL,
    is_enabled boolean DEFAULT false NOT NULL,
    created_by uuid,
    last_run_at timestamp with time zone,
    run_count integer DEFAULT 0 NOT NULL,
    icon text,
    input_fields jsonb DEFAULT '[]'::jsonb,
    default_team jsonb DEFAULT '[]'::jsonb,
    system_instruction text,
    legacy_scenario_key text,
    content text DEFAULT ''::text,
    is_public boolean DEFAULT true NOT NULL,
    owner_employee_id text,
    launch_mode text DEFAULT 'form'::text NOT NULL,
    prompt_template text,
    is_featured boolean DEFAULT false NOT NULL
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb
);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: -
--

ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);


--
-- Name: collection_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_logs ALTER COLUMN id SET DEFAULT nextval('public.collection_logs_id_seq'::regclass);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: drizzle; Owner: -
--

ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- Name: advisor_ab_tests advisor_ab_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.advisor_ab_tests
    ADD CONSTRAINT advisor_ab_tests_pkey PRIMARY KEY (id);


--
-- Name: advisor_compare_tests advisor_compare_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.advisor_compare_tests
    ADD CONSTRAINT advisor_compare_tests_pkey PRIMARY KEY (id);


--
-- Name: ai_employees ai_employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_employees
    ADD CONSTRAINT ai_employees_pkey PRIMARY KEY (id);


--
-- Name: article_ai_analysis article_ai_analysis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.article_ai_analysis
    ADD CONSTRAINT article_ai_analysis_pkey PRIMARY KEY (id);


--
-- Name: article_ai_analysis article_ai_analysis_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.article_ai_analysis
    ADD CONSTRAINT article_ai_analysis_unique UNIQUE (article_id, perspective);


--
-- Name: article_annotations article_annotations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.article_annotations
    ADD CONSTRAINT article_annotations_pkey PRIMARY KEY (id);


--
-- Name: article_assets article_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.article_assets
    ADD CONSTRAINT article_assets_pkey PRIMARY KEY (id);


--
-- Name: article_chat_history article_chat_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.article_chat_history
    ADD CONSTRAINT article_chat_history_pkey PRIMARY KEY (id);


--
-- Name: articles articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_pkey PRIMARY KEY (id);


--
-- Name: asset_segments asset_segments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_segments
    ADD CONSTRAINT asset_segments_pkey PRIMARY KEY (id);


--
-- Name: asset_tags asset_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_tags
    ADD CONSTRAINT asset_tags_pkey PRIMARY KEY (id);


--
-- Name: audit_records audit_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_records
    ADD CONSTRAINT audit_records_pkey PRIMARY KEY (id);


--
-- Name: audit_rules audit_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_rules
    ADD CONSTRAINT audit_rules_pkey PRIMARY KEY (id);


--
-- Name: batch_items batch_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_items
    ADD CONSTRAINT batch_items_pkey PRIMARY KEY (id);


--
-- Name: batch_jobs batch_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_jobs
    ADD CONSTRAINT batch_jobs_pkey PRIMARY KEY (id);


--
-- Name: benchmark_accounts benchmark_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.benchmark_accounts
    ADD CONSTRAINT benchmark_accounts_pkey PRIMARY KEY (id);


--
-- Name: benchmark_alerts benchmark_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.benchmark_alerts
    ADD CONSTRAINT benchmark_alerts_pkey PRIMARY KEY (id);


--
-- Name: benchmark_posts benchmark_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.benchmark_posts
    ADD CONSTRAINT benchmark_posts_pkey PRIMARY KEY (id);


--
-- Name: calendar_events calendar_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_pkey PRIMARY KEY (id);


--
-- Name: case_library case_library_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_library
    ADD CONSTRAINT case_library_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: category_permissions category_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_permissions
    ADD CONSTRAINT category_permissions_pkey PRIMARY KEY (id);


--
-- Name: channel_advisors channel_advisors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_advisors
    ADD CONSTRAINT channel_advisors_pkey PRIMARY KEY (id);


--
-- Name: channel_configs channel_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_configs
    ADD CONSTRAINT channel_configs_pkey PRIMARY KEY (id);


--
-- Name: channel_dna_profiles channel_dna_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_dna_profiles
    ADD CONSTRAINT channel_dna_profiles_pkey PRIMARY KEY (id);


--
-- Name: channel_messages channel_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_messages
    ADD CONSTRAINT channel_messages_pkey PRIMARY KEY (id);


--
-- Name: channel_metrics channel_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_metrics
    ADD CONSTRAINT channel_metrics_pkey PRIMARY KEY (id);


--
-- Name: channels channels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_pkey PRIMARY KEY (id);


--
-- Name: cms_apps cms_apps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_apps
    ADD CONSTRAINT cms_apps_pkey PRIMARY KEY (id);


--
-- Name: cms_catalogs cms_catalogs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_catalogs
    ADD CONSTRAINT cms_catalogs_pkey PRIMARY KEY (id);


--
-- Name: cms_channels cms_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_channels
    ADD CONSTRAINT cms_channels_pkey PRIMARY KEY (id);


--
-- Name: cms_publications cms_publications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_publications
    ADD CONSTRAINT cms_publications_pkey PRIMARY KEY (id);


--
-- Name: cms_sync_logs cms_sync_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_sync_logs
    ADD CONSTRAINT cms_sync_logs_pkey PRIMARY KEY (id);


--
-- Name: collected_items collected_items_org_fp_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collected_items
    ADD CONSTRAINT collected_items_org_fp_unique UNIQUE (organization_id, content_fingerprint);


--
-- Name: collected_items collected_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collected_items
    ADD CONSTRAINT collected_items_pkey PRIMARY KEY (id);


--
-- Name: collection_logs collection_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_logs
    ADD CONSTRAINT collection_logs_pkey PRIMARY KEY (id);


--
-- Name: collection_runs collection_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_runs
    ADD CONSTRAINT collection_runs_pkey PRIMARY KEY (id);


--
-- Name: collection_sources collection_sources_org_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_sources
    ADD CONSTRAINT collection_sources_org_name_unique UNIQUE (organization_id, name);


--
-- Name: collection_sources collection_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_sources
    ADD CONSTRAINT collection_sources_pkey PRIMARY KEY (id);


--
-- Name: comment_insights comment_insights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comment_insights
    ADD CONSTRAINT comment_insights_pkey PRIMARY KEY (id);


--
-- Name: competitor_hits competitor_hits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitor_hits
    ADD CONSTRAINT competitor_hits_pkey PRIMARY KEY (id);


--
-- Name: competitor_responses competitor_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitor_responses
    ADD CONSTRAINT competitor_responses_pkey PRIMARY KEY (id);


--
-- Name: competitors competitors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitors
    ADD CONSTRAINT competitors_pkey PRIMARY KEY (id);


--
-- Name: compliance_checks compliance_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_checks
    ADD CONSTRAINT compliance_checks_pkey PRIMARY KEY (id);


--
-- Name: content_trail_logs content_trail_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_trail_logs
    ADD CONSTRAINT content_trail_logs_pkey PRIMARY KEY (id);


--
-- Name: content_versions content_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_versions
    ADD CONSTRAINT content_versions_pkey PRIMARY KEY (id);


--
-- Name: conversion_tasks conversion_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversion_tasks
    ADD CONSTRAINT conversion_tasks_pkey PRIMARY KEY (id);


--
-- Name: creation_chat_messages creation_chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creation_chat_messages
    ADD CONSTRAINT creation_chat_messages_pkey PRIMARY KEY (id);


--
-- Name: creation_sessions creation_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creation_sessions
    ADD CONSTRAINT creation_sessions_pkey PRIMARY KEY (id);


--
-- Name: detected_faces detected_faces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detected_faces
    ADD CONSTRAINT detected_faces_pkey PRIMARY KEY (id);


--
-- Name: editor_scores editor_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.editor_scores
    ADD CONSTRAINT editor_scores_pkey PRIMARY KEY (id);


--
-- Name: effect_attributions effect_attributions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.effect_attributions
    ADD CONSTRAINT effect_attributions_pkey PRIMARY KEY (id);


--
-- Name: employee_config_versions employee_config_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_config_versions
    ADD CONSTRAINT employee_config_versions_pkey PRIMARY KEY (id);


--
-- Name: employee_knowledge_bases employee_knowledge_bases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_knowledge_bases
    ADD CONSTRAINT employee_knowledge_bases_pkey PRIMARY KEY (id);


--
-- Name: employee_memories employee_memories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_memories
    ADD CONSTRAINT employee_memories_pkey PRIMARY KEY (id);


--
-- Name: employee_skills employee_skills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_skills
    ADD CONSTRAINT employee_skills_pkey PRIMARY KEY (id);


--
-- Name: event_highlights event_highlights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_highlights
    ADD CONSTRAINT event_highlights_pkey PRIMARY KEY (id);


--
-- Name: event_outputs event_outputs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_outputs
    ADD CONSTRAINT event_outputs_pkey PRIMARY KEY (id);


--
-- Name: event_transcriptions event_transcriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_transcriptions
    ADD CONSTRAINT event_transcriptions_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: execution_logs execution_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.execution_logs
    ADD CONSTRAINT execution_logs_pkey PRIMARY KEY (id);


--
-- Name: hit_predictions hit_predictions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hit_predictions
    ADD CONSTRAINT hit_predictions_pkey PRIMARY KEY (id);


--
-- Name: hot_topic_crawl_logs hot_topic_crawl_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hot_topic_crawl_logs
    ADD CONSTRAINT hot_topic_crawl_logs_pkey PRIMARY KEY (id);


--
-- Name: hot_topics hot_topics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hot_topics
    ADD CONSTRAINT hot_topics_pkey PRIMARY KEY (id);


--
-- Name: improvement_trackings improvement_trackings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.improvement_trackings
    ADD CONSTRAINT improvement_trackings_pkey PRIMARY KEY (id);


--
-- Name: intent_logs intent_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intent_logs
    ADD CONSTRAINT intent_logs_pkey PRIMARY KEY (id);


--
-- Name: international_adaptations international_adaptations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.international_adaptations
    ADD CONSTRAINT international_adaptations_pkey PRIMARY KEY (id);


--
-- Name: knowledge_bases knowledge_bases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_bases
    ADD CONSTRAINT knowledge_bases_pkey PRIMARY KEY (id);


--
-- Name: knowledge_items knowledge_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_items
    ADD CONSTRAINT knowledge_items_pkey PRIMARY KEY (id);


--
-- Name: knowledge_nodes knowledge_nodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_nodes
    ADD CONSTRAINT knowledge_nodes_pkey PRIMARY KEY (id);


--
-- Name: knowledge_relations knowledge_relations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_relations
    ADD CONSTRAINT knowledge_relations_pkey PRIMARY KEY (id);


--
-- Name: knowledge_sync_logs knowledge_sync_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_sync_logs
    ADD CONSTRAINT knowledge_sync_logs_pkey PRIMARY KEY (id);


--
-- Name: media_asset_shares media_asset_shares_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_asset_shares
    ADD CONSTRAINT media_asset_shares_pkey PRIMARY KEY (id);


--
-- Name: media_asset_shares media_asset_shares_share_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_asset_shares
    ADD CONSTRAINT media_asset_shares_share_token_unique UNIQUE (share_token);


--
-- Name: media_assets media_assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT media_assets_pkey PRIMARY KEY (id);


--
-- Name: message_reads message_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_reads
    ADD CONSTRAINT message_reads_pkey PRIMARY KEY (id);


--
-- Name: message_reads message_reads_user_message_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_reads
    ADD CONSTRAINT message_reads_user_message_unique UNIQUE (user_id, message_id);


--
-- Name: missed_topics missed_topics_org_fingerprint_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missed_topics
    ADD CONSTRAINT missed_topics_org_fingerprint_uniq UNIQUE (organization_id, content_fingerprint);


--
-- Name: missed_topics missed_topics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missed_topics
    ADD CONSTRAINT missed_topics_pkey PRIMARY KEY (id);


--
-- Name: mission_artifacts mission_artifacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_artifacts
    ADD CONSTRAINT mission_artifacts_pkey PRIMARY KEY (id);


--
-- Name: mission_messages mission_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_messages
    ADD CONSTRAINT mission_messages_pkey PRIMARY KEY (id);


--
-- Name: mission_tasks mission_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_tasks
    ADD CONSTRAINT mission_tasks_pkey PRIMARY KEY (id);


--
-- Name: missions missions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_pkey PRIMARY KEY (id);


--
-- Name: monitored_platforms monitored_platforms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monitored_platforms
    ADD CONSTRAINT monitored_platforms_pkey PRIMARY KEY (id);


--
-- Name: my_accounts my_accounts_org_platform_handle_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.my_accounts
    ADD CONSTRAINT my_accounts_org_platform_handle_uniq UNIQUE (organization_id, platform, handle);


--
-- Name: my_accounts my_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.my_accounts
    ADD CONSTRAINT my_accounts_pkey PRIMARY KEY (id);


--
-- Name: my_post_distributions my_post_dist_post_account_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.my_post_distributions
    ADD CONSTRAINT my_post_dist_post_account_uniq UNIQUE (my_post_id, my_account_id);


--
-- Name: my_post_distributions my_post_distributions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.my_post_distributions
    ADD CONSTRAINT my_post_distributions_pkey PRIMARY KEY (id);


--
-- Name: my_posts my_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.my_posts
    ADD CONSTRAINT my_posts_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_unique UNIQUE (slug);


--
-- Name: performance_snapshots performance_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_snapshots
    ADD CONSTRAINT performance_snapshots_pkey PRIMARY KEY (id);


--
-- Name: point_transactions point_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT point_transactions_pkey PRIMARY KEY (id);


--
-- Name: production_templates production_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_templates
    ADD CONSTRAINT production_templates_pkey PRIMARY KEY (id);


--
-- Name: publish_plans publish_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publish_plans
    ADD CONSTRAINT publish_plans_pkey PRIMARY KEY (id);


--
-- Name: research_cq_districts research_cq_districts_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_cq_districts
    ADD CONSTRAINT research_cq_districts_name_unique UNIQUE (name);


--
-- Name: research_cq_districts research_cq_districts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_cq_districts
    ADD CONSTRAINT research_cq_districts_pkey PRIMARY KEY (id);


--
-- Name: research_media_outlet_aliases research_media_outlet_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_media_outlet_aliases
    ADD CONSTRAINT research_media_outlet_aliases_pkey PRIMARY KEY (id);


--
-- Name: research_media_outlet_crawl_configs research_media_outlet_crawl_configs_outlet_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_media_outlet_crawl_configs
    ADD CONSTRAINT research_media_outlet_crawl_configs_outlet_id_unique UNIQUE (outlet_id);


--
-- Name: research_media_outlet_crawl_configs research_media_outlet_crawl_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_media_outlet_crawl_configs
    ADD CONSTRAINT research_media_outlet_crawl_configs_pkey PRIMARY KEY (id);


--
-- Name: research_media_outlets research_media_outlets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_media_outlets
    ADD CONSTRAINT research_media_outlets_pkey PRIMARY KEY (id);


--
-- Name: research_news_article_topic_hits research_news_article_topic_hits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_news_article_topic_hits
    ADD CONSTRAINT research_news_article_topic_hits_pkey PRIMARY KEY (id);


--
-- Name: research_news_articles research_news_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_news_articles
    ADD CONSTRAINT research_news_articles_pkey PRIMARY KEY (id);


--
-- Name: research_tasks research_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_tasks
    ADD CONSTRAINT research_tasks_pkey PRIMARY KEY (id);


--
-- Name: research_topic_keywords research_topic_keywords_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_topic_keywords
    ADD CONSTRAINT research_topic_keywords_pkey PRIMARY KEY (id);


--
-- Name: research_topic_samples research_topic_samples_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_topic_samples
    ADD CONSTRAINT research_topic_samples_pkey PRIMARY KEY (id);


--
-- Name: research_topics research_topics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_topics
    ADD CONSTRAINT research_topics_pkey PRIMARY KEY (id);


--
-- Name: review_results review_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_results
    ADD CONSTRAINT review_results_pkey PRIMARY KEY (id);


--
-- Name: revive_recommendations revive_recommendations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revive_recommendations
    ADD CONSTRAINT revive_recommendations_pkey PRIMARY KEY (id);


--
-- Name: revive_records revive_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revive_records
    ADD CONSTRAINT revive_records_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: saved_conversations saved_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_conversations
    ADD CONSTRAINT saved_conversations_pkey PRIMARY KEY (id);


--
-- Name: sensitive_word_lists sensitive_word_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sensitive_word_lists
    ADD CONSTRAINT sensitive_word_lists_pkey PRIMARY KEY (id);


--
-- Name: skill_combos skill_combos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_combos
    ADD CONSTRAINT skill_combos_pkey PRIMARY KEY (id);


--
-- Name: skill_files skill_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_files
    ADD CONSTRAINT skill_files_pkey PRIMARY KEY (id);


--
-- Name: skill_files skill_files_skill_id_file_path_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_files
    ADD CONSTRAINT skill_files_skill_id_file_path_unique UNIQUE (skill_id, file_path);


--
-- Name: skill_usage_records skill_usage_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_usage_records
    ADD CONSTRAINT skill_usage_records_pkey PRIMARY KEY (id);


--
-- Name: skill_versions skill_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_versions
    ADD CONSTRAINT skill_versions_pkey PRIMARY KEY (id);


--
-- Name: skills skills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skills
    ADD CONSTRAINT skills_pkey PRIMARY KEY (id);


--
-- Name: style_adaptations style_adaptations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.style_adaptations
    ADD CONSTRAINT style_adaptations_pkey PRIMARY KEY (id);


--
-- Name: tag_schemas tag_schemas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tag_schemas
    ADD CONSTRAINT tag_schemas_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: topic_angles topic_angles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic_angles
    ADD CONSTRAINT topic_angles_pkey PRIMARY KEY (id);


--
-- Name: topic_matches topic_matches_my_post_uniq; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic_matches
    ADD CONSTRAINT topic_matches_my_post_uniq UNIQUE (my_post_id);


--
-- Name: topic_matches topic_matches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic_matches
    ADD CONSTRAINT topic_matches_pkey PRIMARY KEY (id);


--
-- Name: benchmark_accounts uq_benchmark_acc_global; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.benchmark_accounts
    ADD CONSTRAINT uq_benchmark_acc_global UNIQUE (platform, handle, organization_id);


--
-- Name: user_feedback user_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_feedback
    ADD CONSTRAINT user_feedback_pkey PRIMARY KEY (id);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_topic_reads user_topic_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_topic_reads
    ADD CONSTRAINT user_topic_reads_pkey PRIMARY KEY (id);


--
-- Name: user_topic_reads user_topic_reads_user_id_organization_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_topic_reads
    ADD CONSTRAINT user_topic_reads_user_id_organization_id_unique UNIQUE (user_id, organization_id);


--
-- Name: user_topic_subscriptions user_topic_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_topic_subscriptions
    ADD CONSTRAINT user_topic_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: user_topic_subscriptions user_topic_subscriptions_user_id_organization_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_topic_subscriptions
    ADD CONSTRAINT user_topic_subscriptions_user_id_organization_id_unique UNIQUE (user_id, organization_id);


--
-- Name: verification_records verification_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_records
    ADD CONSTRAINT verification_records_pkey PRIMARY KEY (id);


--
-- Name: weekly_reports weekly_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_reports
    ADD CONSTRAINT weekly_reports_pkey PRIMARY KEY (id);


--
-- Name: workflow_artifacts workflow_artifacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_artifacts
    ADD CONSTRAINT workflow_artifacts_pkey PRIMARY KEY (id);


--
-- Name: workflow_template_tab_order workflow_template_tab_order_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_template_tab_order
    ADD CONSTRAINT workflow_template_tab_order_pkey PRIMARY KEY (id);


--
-- Name: workflow_templates workflow_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_templates
    ADD CONSTRAINT workflow_templates_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


--
-- Name: ai_employees_org_slug_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ai_employees_org_slug_uidx ON public.ai_employees USING btree (organization_id, slug);


--
-- Name: categories_org_slug_scope_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX categories_org_slug_scope_uniq ON public.categories USING btree (organization_id, slug, scope);


--
-- Name: cms_apps_org_appid_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cms_apps_org_appid_uniq ON public.cms_apps USING btree (organization_id, cms_app_id);


--
-- Name: cms_apps_site_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cms_apps_site_id_idx ON public.cms_apps USING btree (organization_id, site_id);


--
-- Name: cms_catalogs_app_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cms_catalogs_app_idx ON public.cms_catalogs USING btree (organization_id, app_id);


--
-- Name: cms_catalogs_org_catid_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cms_catalogs_org_catid_uniq ON public.cms_catalogs USING btree (organization_id, cms_catalog_id);


--
-- Name: cms_catalogs_tree_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cms_catalogs_tree_idx ON public.cms_catalogs USING btree (organization_id, parent_id, deleted_at);


--
-- Name: cms_channels_org_key_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cms_channels_org_key_uniq ON public.cms_channels USING btree (organization_id, channel_key);


--
-- Name: cms_pub_article_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cms_pub_article_idx ON public.cms_publications USING btree (article_id);


--
-- Name: cms_pub_cms_article_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cms_pub_cms_article_idx ON public.cms_publications USING btree (cms_article_id);


--
-- Name: cms_pub_org_state_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cms_pub_org_state_idx ON public.cms_publications USING btree (organization_id, cms_state);


--
-- Name: cms_sync_logs_org_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cms_sync_logs_org_time_idx ON public.cms_sync_logs USING btree (organization_id, started_at);


--
-- Name: collected_items_content_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX collected_items_content_trgm ON public.collected_items USING gin (content public.gin_trgm_ops);


--
-- Name: collected_items_derived_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX collected_items_derived_gin ON public.collected_items USING gin (derived_modules);


--
-- Name: collected_items_org_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX collected_items_org_category_idx ON public.collected_items USING btree (organization_id, category);


--
-- Name: collected_items_org_pub_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX collected_items_org_pub_idx ON public.collected_items USING btree (organization_id, published_at);


--
-- Name: collected_items_tags_gin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX collected_items_tags_gin ON public.collected_items USING gin (tags);


--
-- Name: collected_items_title_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX collected_items_title_trgm ON public.collected_items USING gin (title public.gin_trgm_ops);


--
-- Name: collected_items_url_hash_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX collected_items_url_hash_idx ON public.collected_items USING btree (canonical_url_hash) WHERE (canonical_url_hash IS NOT NULL);


--
-- Name: collection_logs_run_logged_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX collection_logs_run_logged_idx ON public.collection_logs USING btree (run_id, logged_at);


--
-- Name: collection_runs_source_started_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX collection_runs_source_started_idx ON public.collection_runs USING btree (source_id, started_at);


--
-- Name: collection_sources_cron_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX collection_sources_cron_idx ON public.collection_sources USING btree (schedule_cron) WHERE (enabled = true);


--
-- Name: collection_sources_org_enabled_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX collection_sources_org_enabled_idx ON public.collection_sources USING btree (organization_id, enabled);


--
-- Name: employee_knowledge_bases_employee_kb_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX employee_knowledge_bases_employee_kb_uidx ON public.employee_knowledge_bases USING btree (employee_id, knowledge_base_id);


--
-- Name: employee_skills_employee_skill_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX employee_skills_employee_skill_uidx ON public.employee_skills USING btree (employee_id, skill_id);


--
-- Name: hot_topics_collected_item_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hot_topics_collected_item_idx ON public.hot_topics USING btree (collected_item_id);


--
-- Name: hot_topics_org_title_hash_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX hot_topics_org_title_hash_uniq ON public.hot_topics USING btree (organization_id, title_hash);


--
-- Name: idx_benchmark_acc_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_benchmark_acc_enabled ON public.benchmark_accounts USING btree (is_enabled);


--
-- Name: idx_benchmark_acc_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_benchmark_acc_org ON public.benchmark_accounts USING btree (organization_id) WHERE (organization_id IS NOT NULL);


--
-- Name: idx_benchmark_acc_platform_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_benchmark_acc_platform_level ON public.benchmark_accounts USING btree (platform, level);


--
-- Name: idx_benchmark_posts_account_pub; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_benchmark_posts_account_pub ON public.benchmark_posts USING btree (benchmark_account_id, published_at);


--
-- Name: idx_benchmark_posts_body_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_benchmark_posts_body_trgm ON public.benchmark_posts USING gin (body public.gin_trgm_ops);


--
-- Name: idx_benchmark_posts_fingerprint; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_benchmark_posts_fingerprint ON public.benchmark_posts USING btree (content_fingerprint);


--
-- Name: idx_benchmark_posts_pub; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_benchmark_posts_pub ON public.benchmark_posts USING btree (published_at);


--
-- Name: idx_benchmark_posts_title_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_benchmark_posts_title_trgm ON public.benchmark_posts USING gin (title public.gin_trgm_ops);


--
-- Name: idx_homepage_order_org_tab; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_homepage_order_org_tab ON public.workflow_template_tab_order USING btree (organization_id, tab_key);


--
-- Name: idx_intent_logs_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intent_logs_org ON public.intent_logs USING btree (organization_id, created_at);


--
-- Name: idx_intent_logs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_intent_logs_user ON public.intent_logs USING btree (user_id, created_at);


--
-- Name: idx_missed_topics_org_decision; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_missed_topics_org_decision ON public.missed_topics USING btree (organization_id, decision);


--
-- Name: idx_missed_topics_org_discovered; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_missed_topics_org_discovered ON public.missed_topics USING btree (organization_id, discovered_at);


--
-- Name: idx_my_accounts_org_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_my_accounts_org_enabled ON public.my_accounts USING btree (organization_id, is_enabled);


--
-- Name: idx_my_accounts_org_platform; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_my_accounts_org_platform ON public.my_accounts USING btree (organization_id, platform);


--
-- Name: idx_my_post_dist_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_my_post_dist_account ON public.my_post_distributions USING btree (my_account_id);


--
-- Name: idx_my_post_dist_post; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_my_post_dist_post ON public.my_post_distributions USING btree (my_post_id);


--
-- Name: idx_my_posts_article_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_my_posts_article_id ON public.my_posts USING btree (internal_article_id) WHERE (internal_article_id IS NOT NULL);


--
-- Name: idx_my_posts_org_fingerprint; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_my_posts_org_fingerprint ON public.my_posts USING btree (organization_id, content_fingerprint);


--
-- Name: idx_my_posts_org_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_my_posts_org_published ON public.my_posts USING btree (organization_id, published_at);


--
-- Name: idx_my_posts_org_topic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_my_posts_org_topic ON public.my_posts USING btree (organization_id, topic);


--
-- Name: idx_my_posts_title_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_my_posts_title_trgm ON public.my_posts USING gin (title public.gin_trgm_ops);


--
-- Name: idx_topic_matches_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_topic_matches_expires ON public.topic_matches USING btree (organization_id, expires_at);


--
-- Name: idx_topic_matches_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_topic_matches_org ON public.topic_matches USING btree (organization_id);


--
-- Name: idx_verification_org_mission; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_org_mission ON public.verification_records USING btree (organization_id, mission_id);


--
-- Name: idx_verification_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_task ON public.verification_records USING btree (task_id);


--
-- Name: idx_verification_verifier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_verification_verifier ON public.verification_records USING btree (verifier_employee_id);


--
-- Name: idx_workflow_templates_featured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_templates_featured ON public.workflow_templates USING btree (organization_id, is_featured) WHERE ((is_featured = true) AND (is_public = true));


--
-- Name: knowledge_bases_org_name_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX knowledge_bases_org_name_uidx ON public.knowledge_bases USING btree (organization_id, name);


--
-- Name: missions_source_dedup_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX missions_source_dedup_uidx ON public.missions USING btree (organization_id, source_module, source_entity_id) WHERE (source_entity_id IS NOT NULL);


--
-- Name: research_media_outlet_aliases_outlet_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX research_media_outlet_aliases_outlet_idx ON public.research_media_outlet_aliases USING btree (outlet_id);


--
-- Name: research_media_outlet_aliases_pattern_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX research_media_outlet_aliases_pattern_idx ON public.research_media_outlet_aliases USING btree (match_pattern);


--
-- Name: research_media_outlets_district_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX research_media_outlets_district_idx ON public.research_media_outlets USING btree (district_id);


--
-- Name: research_media_outlets_org_name_tier_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX research_media_outlets_org_name_tier_uq ON public.research_media_outlets USING btree (organization_id, name, tier);


--
-- Name: research_media_outlets_tier_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX research_media_outlets_tier_idx ON public.research_media_outlets USING btree (tier);


--
-- Name: research_news_article_topic_hits_task_topic_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX research_news_article_topic_hits_task_topic_idx ON public.research_news_article_topic_hits USING btree (research_task_id, topic_id);


--
-- Name: research_news_article_topic_hits_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX research_news_article_topic_hits_uq ON public.research_news_article_topic_hits USING btree (article_id, topic_id, research_task_id);


--
-- Name: research_news_articles_district_published_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX research_news_articles_district_published_idx ON public.research_news_articles USING btree (district_id_snapshot, published_at);


--
-- Name: research_news_articles_embedding_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX research_news_articles_embedding_status_idx ON public.research_news_articles USING btree (embedding_status);


--
-- Name: research_news_articles_outlet_published_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX research_news_articles_outlet_published_idx ON public.research_news_articles USING btree (outlet_id, published_at);


--
-- Name: research_news_articles_task_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX research_news_articles_task_idx ON public.research_news_articles USING btree (first_seen_research_task_id);


--
-- Name: research_news_articles_url_hash_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX research_news_articles_url_hash_uq ON public.research_news_articles USING btree (url_hash);


--
-- Name: research_tasks_org_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX research_tasks_org_user_idx ON public.research_tasks USING btree (organization_id, user_id);


--
-- Name: research_tasks_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX research_tasks_status_idx ON public.research_tasks USING btree (status);


--
-- Name: research_topic_keywords_topic_kw_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX research_topic_keywords_topic_kw_uq ON public.research_topic_keywords USING btree (topic_id, keyword);


--
-- Name: research_topic_samples_topic_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX research_topic_samples_topic_idx ON public.research_topic_samples USING btree (topic_id);


--
-- Name: research_topics_org_name_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX research_topics_org_name_uq ON public.research_topics USING btree (organization_id, name);


--
-- Name: skills_org_name_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX skills_org_name_uidx ON public.skills USING btree (organization_id, name);


--
-- Name: uq_category_permission; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_category_permission ON public.category_permissions USING btree (category_id, grantee_type, grantee_id, permission_type);


--
-- Name: uq_role_org_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_role_org_slug ON public.roles USING btree (organization_id, slug);


--
-- Name: uq_user_role; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_user_role ON public.user_roles USING btree (user_id, role_id);


--
-- Name: workflow_template_tab_order_org_tab_template_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX workflow_template_tab_order_org_tab_template_uidx ON public.workflow_template_tab_order USING btree (organization_id, tab_key, template_id);


--
-- Name: workflow_templates_org_builtin_name_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX workflow_templates_org_builtin_name_uidx ON public.workflow_templates USING btree (organization_id, name) WHERE ((is_builtin = true) AND (legacy_scenario_key IS NULL));


--
-- Name: workflow_templates_org_legacy_key_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX workflow_templates_org_legacy_key_uidx ON public.workflow_templates USING btree (organization_id, legacy_scenario_key) WHERE (legacy_scenario_key IS NOT NULL);


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: ai_employees ai_employees_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_employees
    ADD CONSTRAINT ai_employees_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: article_ai_analysis article_ai_analysis_article_id_articles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.article_ai_analysis
    ADD CONSTRAINT article_ai_analysis_article_id_articles_id_fk FOREIGN KEY (article_id) REFERENCES public.articles(id) ON DELETE CASCADE;


--
-- Name: article_annotations article_annotations_article_id_articles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.article_annotations
    ADD CONSTRAINT article_annotations_article_id_articles_id_fk FOREIGN KEY (article_id) REFERENCES public.articles(id) ON DELETE CASCADE;


--
-- Name: article_assets article_assets_article_id_articles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.article_assets
    ADD CONSTRAINT article_assets_article_id_articles_id_fk FOREIGN KEY (article_id) REFERENCES public.articles(id) ON DELETE CASCADE;


--
-- Name: article_assets article_assets_asset_id_media_assets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.article_assets
    ADD CONSTRAINT article_assets_asset_id_media_assets_id_fk FOREIGN KEY (asset_id) REFERENCES public.media_assets(id) ON DELETE CASCADE;


--
-- Name: article_chat_history article_chat_history_article_id_articles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.article_chat_history
    ADD CONSTRAINT article_chat_history_article_id_articles_id_fk FOREIGN KEY (article_id) REFERENCES public.articles(id) ON DELETE CASCADE;


--
-- Name: articles articles_assignee_id_ai_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_assignee_id_ai_employees_id_fk FOREIGN KEY (assignee_id) REFERENCES public.ai_employees(id);


--
-- Name: articles articles_category_id_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: articles articles_created_by_user_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_created_by_user_profiles_id_fk FOREIGN KEY (created_by) REFERENCES public.user_profiles(id);


--
-- Name: articles articles_mission_id_missions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_mission_id_missions_id_fk FOREIGN KEY (mission_id) REFERENCES public.missions(id);


--
-- Name: articles articles_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: articles articles_task_id_tasks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_task_id_tasks_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id);


--
-- Name: asset_segments asset_segments_asset_id_media_assets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_segments
    ADD CONSTRAINT asset_segments_asset_id_media_assets_id_fk FOREIGN KEY (asset_id) REFERENCES public.media_assets(id) ON DELETE CASCADE;


--
-- Name: asset_tags asset_tags_asset_id_media_assets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_tags
    ADD CONSTRAINT asset_tags_asset_id_media_assets_id_fk FOREIGN KEY (asset_id) REFERENCES public.media_assets(id) ON DELETE CASCADE;


--
-- Name: asset_tags asset_tags_corrected_by_user_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_tags
    ADD CONSTRAINT asset_tags_corrected_by_user_profiles_id_fk FOREIGN KEY (corrected_by) REFERENCES public.user_profiles(id);


--
-- Name: asset_tags asset_tags_segment_id_asset_segments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset_tags
    ADD CONSTRAINT asset_tags_segment_id_asset_segments_id_fk FOREIGN KEY (segment_id) REFERENCES public.asset_segments(id) ON DELETE CASCADE;


--
-- Name: audit_records audit_records_mission_id_missions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_records
    ADD CONSTRAINT audit_records_mission_id_missions_id_fk FOREIGN KEY (mission_id) REFERENCES public.missions(id);


--
-- Name: audit_records audit_records_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_records
    ADD CONSTRAINT audit_records_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: audit_rules audit_rules_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_rules
    ADD CONSTRAINT audit_rules_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: batch_items batch_items_batch_job_id_batch_jobs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_items
    ADD CONSTRAINT batch_items_batch_job_id_batch_jobs_id_fk FOREIGN KEY (batch_job_id) REFERENCES public.batch_jobs(id) ON DELETE CASCADE;


--
-- Name: batch_jobs batch_jobs_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_jobs
    ADD CONSTRAINT batch_jobs_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: benchmark_accounts benchmark_accounts_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.benchmark_accounts
    ADD CONSTRAINT benchmark_accounts_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: benchmark_alerts benchmark_alerts_generated_by_ai_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.benchmark_alerts
    ADD CONSTRAINT benchmark_alerts_generated_by_ai_employees_id_fk FOREIGN KEY (generated_by) REFERENCES public.ai_employees(id);


--
-- Name: benchmark_alerts benchmark_alerts_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.benchmark_alerts
    ADD CONSTRAINT benchmark_alerts_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: benchmark_posts benchmark_posts_benchmark_account_id_benchmark_accounts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.benchmark_posts
    ADD CONSTRAINT benchmark_posts_benchmark_account_id_benchmark_accounts_id_fk FOREIGN KEY (benchmark_account_id) REFERENCES public.benchmark_accounts(id) ON DELETE CASCADE;


--
-- Name: calendar_events calendar_events_created_by_user_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_created_by_user_profiles_id_fk FOREIGN KEY (created_by) REFERENCES public.user_profiles(id);


--
-- Name: calendar_events calendar_events_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendar_events
    ADD CONSTRAINT calendar_events_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: case_library case_library_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.case_library
    ADD CONSTRAINT case_library_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: categories categories_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: categories categories_parent_id_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_parent_id_categories_id_fk FOREIGN KEY (parent_id) REFERENCES public.categories(id);


--
-- Name: category_permissions category_permissions_category_id_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_permissions
    ADD CONSTRAINT category_permissions_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;


--
-- Name: category_permissions category_permissions_created_by_user_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_permissions
    ADD CONSTRAINT category_permissions_created_by_user_profiles_id_fk FOREIGN KEY (created_by) REFERENCES public.user_profiles(id);


--
-- Name: category_permissions category_permissions_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category_permissions
    ADD CONSTRAINT category_permissions_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: channel_advisors channel_advisors_ai_employee_id_ai_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_advisors
    ADD CONSTRAINT channel_advisors_ai_employee_id_ai_employees_id_fk FOREIGN KEY (ai_employee_id) REFERENCES public.ai_employees(id);


--
-- Name: channel_advisors channel_advisors_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_advisors
    ADD CONSTRAINT channel_advisors_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: channel_configs channel_configs_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_configs
    ADD CONSTRAINT channel_configs_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: channel_dna_profiles channel_dna_profiles_advisor_id_channel_advisors_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_dna_profiles
    ADD CONSTRAINT channel_dna_profiles_advisor_id_channel_advisors_id_fk FOREIGN KEY (advisor_id) REFERENCES public.channel_advisors(id) ON DELETE CASCADE;


--
-- Name: channel_messages channel_messages_config_id_channel_configs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_messages
    ADD CONSTRAINT channel_messages_config_id_channel_configs_id_fk FOREIGN KEY (config_id) REFERENCES public.channel_configs(id) ON DELETE CASCADE;


--
-- Name: channel_messages channel_messages_mission_id_missions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_messages
    ADD CONSTRAINT channel_messages_mission_id_missions_id_fk FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE SET NULL;


--
-- Name: channel_messages channel_messages_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_messages
    ADD CONSTRAINT channel_messages_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: channel_metrics channel_metrics_channel_id_channels_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_metrics
    ADD CONSTRAINT channel_metrics_channel_id_channels_id_fk FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;


--
-- Name: channel_metrics channel_metrics_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_metrics
    ADD CONSTRAINT channel_metrics_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: channels channels_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: cms_apps cms_apps_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_apps
    ADD CONSTRAINT cms_apps_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: cms_catalogs cms_catalogs_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_catalogs
    ADD CONSTRAINT cms_catalogs_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: cms_channels cms_channels_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_channels
    ADD CONSTRAINT cms_channels_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: cms_publications cms_publications_article_id_articles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_publications
    ADD CONSTRAINT cms_publications_article_id_articles_id_fk FOREIGN KEY (article_id) REFERENCES public.articles(id);


--
-- Name: cms_publications cms_publications_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_publications
    ADD CONSTRAINT cms_publications_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: cms_sync_logs cms_sync_logs_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cms_sync_logs
    ADD CONSTRAINT cms_sync_logs_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: collected_items collected_items_first_seen_source_id_collection_sources_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collected_items
    ADD CONSTRAINT collected_items_first_seen_source_id_collection_sources_id_fk FOREIGN KEY (first_seen_source_id) REFERENCES public.collection_sources(id) ON DELETE SET NULL;


--
-- Name: collected_items collected_items_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collected_items
    ADD CONSTRAINT collected_items_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: collection_logs collection_logs_run_id_collection_runs_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_logs
    ADD CONSTRAINT collection_logs_run_id_collection_runs_id_fk FOREIGN KEY (run_id) REFERENCES public.collection_runs(id) ON DELETE CASCADE;


--
-- Name: collection_logs collection_logs_source_id_collection_sources_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_logs
    ADD CONSTRAINT collection_logs_source_id_collection_sources_id_fk FOREIGN KEY (source_id) REFERENCES public.collection_sources(id) ON DELETE CASCADE;


--
-- Name: collection_runs collection_runs_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_runs
    ADD CONSTRAINT collection_runs_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: collection_runs collection_runs_source_id_collection_sources_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_runs
    ADD CONSTRAINT collection_runs_source_id_collection_sources_id_fk FOREIGN KEY (source_id) REFERENCES public.collection_sources(id) ON DELETE CASCADE;


--
-- Name: collection_sources collection_sources_created_by_user_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_sources
    ADD CONSTRAINT collection_sources_created_by_user_profiles_id_fk FOREIGN KEY (created_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;


--
-- Name: collection_sources collection_sources_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_sources
    ADD CONSTRAINT collection_sources_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: comment_insights comment_insights_hot_topic_id_hot_topics_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comment_insights
    ADD CONSTRAINT comment_insights_hot_topic_id_hot_topics_id_fk FOREIGN KEY (hot_topic_id) REFERENCES public.hot_topics(id) ON DELETE CASCADE;


--
-- Name: competitor_hits competitor_hits_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitor_hits
    ADD CONSTRAINT competitor_hits_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: competitor_responses competitor_responses_hot_topic_id_hot_topics_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitor_responses
    ADD CONSTRAINT competitor_responses_hot_topic_id_hot_topics_id_fk FOREIGN KEY (hot_topic_id) REFERENCES public.hot_topics(id) ON DELETE CASCADE;


--
-- Name: competitors competitors_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.competitors
    ADD CONSTRAINT competitors_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: compliance_checks compliance_checks_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_checks
    ADD CONSTRAINT compliance_checks_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: content_trail_logs content_trail_logs_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_trail_logs
    ADD CONSTRAINT content_trail_logs_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: content_versions content_versions_task_id_tasks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_versions
    ADD CONSTRAINT content_versions_task_id_tasks_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: conversion_tasks conversion_tasks_batch_item_id_batch_items_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversion_tasks
    ADD CONSTRAINT conversion_tasks_batch_item_id_batch_items_id_fk FOREIGN KEY (batch_item_id) REFERENCES public.batch_items(id);


--
-- Name: conversion_tasks conversion_tasks_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversion_tasks
    ADD CONSTRAINT conversion_tasks_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: creation_chat_messages creation_chat_messages_employee_id_ai_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creation_chat_messages
    ADD CONSTRAINT creation_chat_messages_employee_id_ai_employees_id_fk FOREIGN KEY (employee_id) REFERENCES public.ai_employees(id);


--
-- Name: creation_chat_messages creation_chat_messages_session_id_creation_sessions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creation_chat_messages
    ADD CONSTRAINT creation_chat_messages_session_id_creation_sessions_id_fk FOREIGN KEY (session_id) REFERENCES public.creation_sessions(id) ON DELETE CASCADE;


--
-- Name: creation_sessions creation_sessions_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.creation_sessions
    ADD CONSTRAINT creation_sessions_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: detected_faces detected_faces_asset_id_media_assets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detected_faces
    ADD CONSTRAINT detected_faces_asset_id_media_assets_id_fk FOREIGN KEY (asset_id) REFERENCES public.media_assets(id) ON DELETE CASCADE;


--
-- Name: detected_faces detected_faces_segment_id_asset_segments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detected_faces
    ADD CONSTRAINT detected_faces_segment_id_asset_segments_id_fk FOREIGN KEY (segment_id) REFERENCES public.asset_segments(id) ON DELETE CASCADE;


--
-- Name: employee_config_versions employee_config_versions_employee_id_ai_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_config_versions
    ADD CONSTRAINT employee_config_versions_employee_id_ai_employees_id_fk FOREIGN KEY (employee_id) REFERENCES public.ai_employees(id);


--
-- Name: employee_knowledge_bases employee_knowledge_bases_employee_id_ai_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_knowledge_bases
    ADD CONSTRAINT employee_knowledge_bases_employee_id_ai_employees_id_fk FOREIGN KEY (employee_id) REFERENCES public.ai_employees(id) ON DELETE CASCADE;


--
-- Name: employee_knowledge_bases employee_knowledge_bases_knowledge_base_id_knowledge_bases_id_f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_knowledge_bases
    ADD CONSTRAINT employee_knowledge_bases_knowledge_base_id_knowledge_bases_id_f FOREIGN KEY (knowledge_base_id) REFERENCES public.knowledge_bases(id) ON DELETE CASCADE;


--
-- Name: employee_memories employee_memories_employee_id_ai_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_memories
    ADD CONSTRAINT employee_memories_employee_id_ai_employees_id_fk FOREIGN KEY (employee_id) REFERENCES public.ai_employees(id) ON DELETE CASCADE;


--
-- Name: employee_memories employee_memories_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_memories
    ADD CONSTRAINT employee_memories_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: employee_skills employee_skills_employee_id_ai_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_skills
    ADD CONSTRAINT employee_skills_employee_id_ai_employees_id_fk FOREIGN KEY (employee_id) REFERENCES public.ai_employees(id) ON DELETE CASCADE;


--
-- Name: employee_skills employee_skills_skill_id_skills_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_skills
    ADD CONSTRAINT employee_skills_skill_id_skills_id_fk FOREIGN KEY (skill_id) REFERENCES public.skills(id) ON DELETE CASCADE;


--
-- Name: event_highlights event_highlights_event_id_events_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_highlights
    ADD CONSTRAINT event_highlights_event_id_events_id_fk FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_outputs event_outputs_event_id_events_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_outputs
    ADD CONSTRAINT event_outputs_event_id_events_id_fk FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: event_transcriptions event_transcriptions_event_id_events_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_transcriptions
    ADD CONSTRAINT event_transcriptions_event_id_events_id_fk FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: events events_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: execution_logs execution_logs_employee_id_ai_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.execution_logs
    ADD CONSTRAINT execution_logs_employee_id_ai_employees_id_fk FOREIGN KEY (employee_id) REFERENCES public.ai_employees(id);


--
-- Name: execution_logs execution_logs_mission_id_missions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.execution_logs
    ADD CONSTRAINT execution_logs_mission_id_missions_id_fk FOREIGN KEY (mission_id) REFERENCES public.missions(id);


--
-- Name: execution_logs execution_logs_mission_task_id_mission_tasks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.execution_logs
    ADD CONSTRAINT execution_logs_mission_task_id_mission_tasks_id_fk FOREIGN KEY (mission_task_id) REFERENCES public.mission_tasks(id);


--
-- Name: execution_logs execution_logs_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.execution_logs
    ADD CONSTRAINT execution_logs_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: hit_predictions hit_predictions_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hit_predictions
    ADD CONSTRAINT hit_predictions_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: hot_topic_crawl_logs hot_topic_crawl_logs_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hot_topic_crawl_logs
    ADD CONSTRAINT hot_topic_crawl_logs_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: hot_topics hot_topics_collected_item_id_collected_items_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hot_topics
    ADD CONSTRAINT hot_topics_collected_item_id_collected_items_id_fk FOREIGN KEY (collected_item_id) REFERENCES public.collected_items(id) ON DELETE SET NULL;


--
-- Name: hot_topics hot_topics_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hot_topics
    ADD CONSTRAINT hot_topics_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: improvement_trackings improvement_trackings_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.improvement_trackings
    ADD CONSTRAINT improvement_trackings_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: intent_logs intent_logs_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intent_logs
    ADD CONSTRAINT intent_logs_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: intent_logs intent_logs_user_id_user_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.intent_logs
    ADD CONSTRAINT intent_logs_user_id_user_profiles_id_fk FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);


--
-- Name: international_adaptations international_adaptations_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.international_adaptations
    ADD CONSTRAINT international_adaptations_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: international_adaptations international_adaptations_source_asset_id_media_assets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.international_adaptations
    ADD CONSTRAINT international_adaptations_source_asset_id_media_assets_id_fk FOREIGN KEY (source_asset_id) REFERENCES public.media_assets(id);


--
-- Name: knowledge_bases knowledge_bases_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_bases
    ADD CONSTRAINT knowledge_bases_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: knowledge_items knowledge_items_knowledge_base_id_knowledge_bases_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_items
    ADD CONSTRAINT knowledge_items_knowledge_base_id_knowledge_bases_id_fk FOREIGN KEY (knowledge_base_id) REFERENCES public.knowledge_bases(id) ON DELETE CASCADE;


--
-- Name: knowledge_nodes knowledge_nodes_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_nodes
    ADD CONSTRAINT knowledge_nodes_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: knowledge_nodes knowledge_nodes_source_asset_id_media_assets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_nodes
    ADD CONSTRAINT knowledge_nodes_source_asset_id_media_assets_id_fk FOREIGN KEY (source_asset_id) REFERENCES public.media_assets(id);


--
-- Name: knowledge_relations knowledge_relations_source_asset_id_media_assets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_relations
    ADD CONSTRAINT knowledge_relations_source_asset_id_media_assets_id_fk FOREIGN KEY (source_asset_id) REFERENCES public.media_assets(id);


--
-- Name: knowledge_relations knowledge_relations_source_node_id_knowledge_nodes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_relations
    ADD CONSTRAINT knowledge_relations_source_node_id_knowledge_nodes_id_fk FOREIGN KEY (source_node_id) REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE;


--
-- Name: knowledge_relations knowledge_relations_target_node_id_knowledge_nodes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_relations
    ADD CONSTRAINT knowledge_relations_target_node_id_knowledge_nodes_id_fk FOREIGN KEY (target_node_id) REFERENCES public.knowledge_nodes(id) ON DELETE CASCADE;


--
-- Name: knowledge_sync_logs knowledge_sync_logs_knowledge_base_id_knowledge_bases_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_sync_logs
    ADD CONSTRAINT knowledge_sync_logs_knowledge_base_id_knowledge_bases_id_fk FOREIGN KEY (knowledge_base_id) REFERENCES public.knowledge_bases(id) ON DELETE CASCADE;


--
-- Name: media_asset_shares media_asset_shares_created_by_user_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_asset_shares
    ADD CONSTRAINT media_asset_shares_created_by_user_profiles_id_fk FOREIGN KEY (created_by) REFERENCES public.user_profiles(id);


--
-- Name: media_asset_shares media_asset_shares_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_asset_shares
    ADD CONSTRAINT media_asset_shares_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: media_assets media_assets_category_id_categories_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT media_assets_category_id_categories_id_fk FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: media_assets media_assets_deleted_by_user_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT media_assets_deleted_by_user_profiles_id_fk FOREIGN KEY (deleted_by) REFERENCES public.user_profiles(id);


--
-- Name: media_assets media_assets_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT media_assets_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: media_assets media_assets_parent_version_id_media_assets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT media_assets_parent_version_id_media_assets_id_fk FOREIGN KEY (parent_version_id) REFERENCES public.media_assets(id);


--
-- Name: media_assets media_assets_uploaded_by_user_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_assets
    ADD CONSTRAINT media_assets_uploaded_by_user_profiles_id_fk FOREIGN KEY (uploaded_by) REFERENCES public.user_profiles(id);


--
-- Name: message_reads message_reads_message_id_mission_messages_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_reads
    ADD CONSTRAINT message_reads_message_id_mission_messages_id_fk FOREIGN KEY (message_id) REFERENCES public.mission_messages(id) ON DELETE CASCADE;


--
-- Name: missed_topics missed_topics_matched_my_post_id_my_posts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missed_topics
    ADD CONSTRAINT missed_topics_matched_my_post_id_my_posts_id_fk FOREIGN KEY (matched_my_post_id) REFERENCES public.my_posts(id) ON DELETE SET NULL;


--
-- Name: missed_topics missed_topics_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missed_topics
    ADD CONSTRAINT missed_topics_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: missed_topics missed_topics_primary_benchmark_post_id_benchmark_posts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missed_topics
    ADD CONSTRAINT missed_topics_primary_benchmark_post_id_benchmark_posts_id_fk FOREIGN KEY (primary_benchmark_post_id) REFERENCES public.benchmark_posts(id) ON DELETE CASCADE;


--
-- Name: mission_artifacts mission_artifacts_mission_id_missions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_artifacts
    ADD CONSTRAINT mission_artifacts_mission_id_missions_id_fk FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE CASCADE;


--
-- Name: mission_artifacts mission_artifacts_produced_by_ai_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_artifacts
    ADD CONSTRAINT mission_artifacts_produced_by_ai_employees_id_fk FOREIGN KEY (produced_by) REFERENCES public.ai_employees(id);


--
-- Name: mission_artifacts mission_artifacts_task_id_mission_tasks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_artifacts
    ADD CONSTRAINT mission_artifacts_task_id_mission_tasks_id_fk FOREIGN KEY (task_id) REFERENCES public.mission_tasks(id) ON DELETE SET NULL;


--
-- Name: mission_messages mission_messages_from_employee_id_ai_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_messages
    ADD CONSTRAINT mission_messages_from_employee_id_ai_employees_id_fk FOREIGN KEY (from_employee_id) REFERENCES public.ai_employees(id);


--
-- Name: mission_messages mission_messages_mission_id_missions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_messages
    ADD CONSTRAINT mission_messages_mission_id_missions_id_fk FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE CASCADE;


--
-- Name: mission_messages mission_messages_related_task_id_mission_tasks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_messages
    ADD CONSTRAINT mission_messages_related_task_id_mission_tasks_id_fk FOREIGN KEY (related_task_id) REFERENCES public.mission_tasks(id) ON DELETE SET NULL;


--
-- Name: mission_messages mission_messages_to_employee_id_ai_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_messages
    ADD CONSTRAINT mission_messages_to_employee_id_ai_employees_id_fk FOREIGN KEY (to_employee_id) REFERENCES public.ai_employees(id);


--
-- Name: mission_tasks mission_tasks_assigned_employee_id_ai_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_tasks
    ADD CONSTRAINT mission_tasks_assigned_employee_id_ai_employees_id_fk FOREIGN KEY (assigned_employee_id) REFERENCES public.ai_employees(id);


--
-- Name: mission_tasks mission_tasks_mission_id_missions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_tasks
    ADD CONSTRAINT mission_tasks_mission_id_missions_id_fk FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE CASCADE;


--
-- Name: missions missions_leader_employee_id_ai_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_leader_employee_id_ai_employees_id_fk FOREIGN KEY (leader_employee_id) REFERENCES public.ai_employees(id);


--
-- Name: missions missions_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: monitored_platforms monitored_platforms_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.monitored_platforms
    ADD CONSTRAINT monitored_platforms_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: my_accounts my_accounts_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.my_accounts
    ADD CONSTRAINT my_accounts_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: my_post_distributions my_post_distributions_my_account_id_my_accounts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.my_post_distributions
    ADD CONSTRAINT my_post_distributions_my_account_id_my_accounts_id_fk FOREIGN KEY (my_account_id) REFERENCES public.my_accounts(id) ON DELETE CASCADE;


--
-- Name: my_post_distributions my_post_distributions_my_post_id_my_posts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.my_post_distributions
    ADD CONSTRAINT my_post_distributions_my_post_id_my_posts_id_fk FOREIGN KEY (my_post_id) REFERENCES public.my_posts(id) ON DELETE CASCADE;


--
-- Name: my_posts my_posts_internal_article_id_articles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.my_posts
    ADD CONSTRAINT my_posts_internal_article_id_articles_id_fk FOREIGN KEY (internal_article_id) REFERENCES public.articles(id) ON DELETE SET NULL;


--
-- Name: my_posts my_posts_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.my_posts
    ADD CONSTRAINT my_posts_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: performance_snapshots performance_snapshots_employee_id_ai_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.performance_snapshots
    ADD CONSTRAINT performance_snapshots_employee_id_ai_employees_id_fk FOREIGN KEY (employee_id) REFERENCES public.ai_employees(id);


--
-- Name: production_templates production_templates_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.production_templates
    ADD CONSTRAINT production_templates_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: publish_plans publish_plans_channel_id_channels_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publish_plans
    ADD CONSTRAINT publish_plans_channel_id_channels_id_fk FOREIGN KEY (channel_id) REFERENCES public.channels(id) ON DELETE CASCADE;


--
-- Name: publish_plans publish_plans_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publish_plans
    ADD CONSTRAINT publish_plans_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: publish_plans publish_plans_task_id_tasks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.publish_plans
    ADD CONSTRAINT publish_plans_task_id_tasks_id_fk FOREIGN KEY (task_id) REFERENCES public.tasks(id);


--
-- Name: research_media_outlet_aliases research_media_outlet_aliases_outlet_id_research_media_outlets_; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_media_outlet_aliases
    ADD CONSTRAINT research_media_outlet_aliases_outlet_id_research_media_outlets_ FOREIGN KEY (outlet_id) REFERENCES public.research_media_outlets(id) ON DELETE CASCADE;


--
-- Name: research_media_outlet_crawl_configs research_media_outlet_crawl_configs_outlet_id_research_media_ou; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_media_outlet_crawl_configs
    ADD CONSTRAINT research_media_outlet_crawl_configs_outlet_id_research_media_ou FOREIGN KEY (outlet_id) REFERENCES public.research_media_outlets(id) ON DELETE CASCADE;


--
-- Name: research_media_outlets research_media_outlets_district_id_research_cq_districts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_media_outlets
    ADD CONSTRAINT research_media_outlets_district_id_research_cq_districts_id_fk FOREIGN KEY (district_id) REFERENCES public.research_cq_districts(id);


--
-- Name: research_media_outlets research_media_outlets_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_media_outlets
    ADD CONSTRAINT research_media_outlets_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: research_news_article_topic_hits research_news_article_topic_hits_article_id_research_news_artic; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_news_article_topic_hits
    ADD CONSTRAINT research_news_article_topic_hits_article_id_research_news_artic FOREIGN KEY (article_id) REFERENCES public.research_news_articles(id) ON DELETE CASCADE;


--
-- Name: research_news_article_topic_hits research_news_article_topic_hits_research_task_id_research_task; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_news_article_topic_hits
    ADD CONSTRAINT research_news_article_topic_hits_research_task_id_research_task FOREIGN KEY (research_task_id) REFERENCES public.research_tasks(id) ON DELETE CASCADE;


--
-- Name: research_news_article_topic_hits research_news_article_topic_hits_topic_id_research_topics_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_news_article_topic_hits
    ADD CONSTRAINT research_news_article_topic_hits_topic_id_research_topics_id_fk FOREIGN KEY (topic_id) REFERENCES public.research_topics(id) ON DELETE CASCADE;


--
-- Name: research_news_articles research_news_articles_district_id_snapshot_research_cq_distric; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_news_articles
    ADD CONSTRAINT research_news_articles_district_id_snapshot_research_cq_distric FOREIGN KEY (district_id_snapshot) REFERENCES public.research_cq_districts(id);


--
-- Name: research_news_articles research_news_articles_first_seen_research_task_id_research_tas; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_news_articles
    ADD CONSTRAINT research_news_articles_first_seen_research_task_id_research_tas FOREIGN KEY (first_seen_research_task_id) REFERENCES public.research_tasks(id) ON DELETE SET NULL;


--
-- Name: research_news_articles research_news_articles_outlet_id_research_media_outlets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_news_articles
    ADD CONSTRAINT research_news_articles_outlet_id_research_media_outlets_id_fk FOREIGN KEY (outlet_id) REFERENCES public.research_media_outlets(id);


--
-- Name: research_tasks research_tasks_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_tasks
    ADD CONSTRAINT research_tasks_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: research_topic_keywords research_topic_keywords_topic_id_research_topics_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_topic_keywords
    ADD CONSTRAINT research_topic_keywords_topic_id_research_topics_id_fk FOREIGN KEY (topic_id) REFERENCES public.research_topics(id) ON DELETE CASCADE;


--
-- Name: research_topic_samples research_topic_samples_topic_id_research_topics_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_topic_samples
    ADD CONSTRAINT research_topic_samples_topic_id_research_topics_id_fk FOREIGN KEY (topic_id) REFERENCES public.research_topics(id) ON DELETE CASCADE;


--
-- Name: research_topics research_topics_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_topics
    ADD CONSTRAINT research_topics_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: review_results review_results_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_results
    ADD CONSTRAINT review_results_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: review_results review_results_reviewer_employee_id_ai_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_results
    ADD CONSTRAINT review_results_reviewer_employee_id_ai_employees_id_fk FOREIGN KEY (reviewer_employee_id) REFERENCES public.ai_employees(id);


--
-- Name: revive_recommendations revive_recommendations_adopted_by_user_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revive_recommendations
    ADD CONSTRAINT revive_recommendations_adopted_by_user_profiles_id_fk FOREIGN KEY (adopted_by) REFERENCES public.user_profiles(id);


--
-- Name: revive_recommendations revive_recommendations_asset_id_media_assets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revive_recommendations
    ADD CONSTRAINT revive_recommendations_asset_id_media_assets_id_fk FOREIGN KEY (asset_id) REFERENCES public.media_assets(id);


--
-- Name: revive_recommendations revive_recommendations_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revive_recommendations
    ADD CONSTRAINT revive_recommendations_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: revive_records revive_records_asset_id_media_assets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revive_records
    ADD CONSTRAINT revive_records_asset_id_media_assets_id_fk FOREIGN KEY (asset_id) REFERENCES public.media_assets(id);


--
-- Name: revive_records revive_records_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revive_records
    ADD CONSTRAINT revive_records_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: revive_records revive_records_recommendation_id_revive_recommendations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.revive_records
    ADD CONSTRAINT revive_records_recommendation_id_revive_recommendations_id_fk FOREIGN KEY (recommendation_id) REFERENCES public.revive_recommendations(id);


--
-- Name: roles roles_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: saved_conversations saved_conversations_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.saved_conversations
    ADD CONSTRAINT saved_conversations_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: sensitive_word_lists sensitive_word_lists_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sensitive_word_lists
    ADD CONSTRAINT sensitive_word_lists_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: skill_files skill_files_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_files
    ADD CONSTRAINT skill_files_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: skill_files skill_files_skill_id_skills_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_files
    ADD CONSTRAINT skill_files_skill_id_skills_id_fk FOREIGN KEY (skill_id) REFERENCES public.skills(id) ON DELETE CASCADE;


--
-- Name: skill_usage_records skill_usage_records_employee_id_ai_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_usage_records
    ADD CONSTRAINT skill_usage_records_employee_id_ai_employees_id_fk FOREIGN KEY (employee_id) REFERENCES public.ai_employees(id) ON DELETE CASCADE;


--
-- Name: skill_usage_records skill_usage_records_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_usage_records
    ADD CONSTRAINT skill_usage_records_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: skill_usage_records skill_usage_records_skill_id_skills_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_usage_records
    ADD CONSTRAINT skill_usage_records_skill_id_skills_id_fk FOREIGN KEY (skill_id) REFERENCES public.skills(id) ON DELETE CASCADE;


--
-- Name: skill_versions skill_versions_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_versions
    ADD CONSTRAINT skill_versions_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: skill_versions skill_versions_skill_id_skills_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skill_versions
    ADD CONSTRAINT skill_versions_skill_id_skills_id_fk FOREIGN KEY (skill_id) REFERENCES public.skills(id) ON DELETE CASCADE;


--
-- Name: skills skills_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.skills
    ADD CONSTRAINT skills_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: style_adaptations style_adaptations_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.style_adaptations
    ADD CONSTRAINT style_adaptations_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: style_adaptations style_adaptations_source_asset_id_media_assets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.style_adaptations
    ADD CONSTRAINT style_adaptations_source_asset_id_media_assets_id_fk FOREIGN KEY (source_asset_id) REFERENCES public.media_assets(id);


--
-- Name: tasks tasks_assignee_id_ai_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_assignee_id_ai_employees_id_fk FOREIGN KEY (assignee_id) REFERENCES public.ai_employees(id);


--
-- Name: tasks tasks_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: topic_angles topic_angles_generated_by_ai_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic_angles
    ADD CONSTRAINT topic_angles_generated_by_ai_employees_id_fk FOREIGN KEY (generated_by) REFERENCES public.ai_employees(id);


--
-- Name: topic_angles topic_angles_hot_topic_id_hot_topics_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic_angles
    ADD CONSTRAINT topic_angles_hot_topic_id_hot_topics_id_fk FOREIGN KEY (hot_topic_id) REFERENCES public.hot_topics(id) ON DELETE CASCADE;


--
-- Name: topic_matches topic_matches_my_post_id_my_posts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic_matches
    ADD CONSTRAINT topic_matches_my_post_id_my_posts_id_fk FOREIGN KEY (my_post_id) REFERENCES public.my_posts(id) ON DELETE CASCADE;


--
-- Name: topic_matches topic_matches_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.topic_matches
    ADD CONSTRAINT topic_matches_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: user_profiles user_profiles_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: user_roles user_roles_assigned_by_user_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_assigned_by_user_profiles_id_fk FOREIGN KEY (assigned_by) REFERENCES public.user_profiles(id);


--
-- Name: user_roles user_roles_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: user_roles user_roles_role_id_roles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_roles_id_fk FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_user_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_user_profiles_id_fk FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;


--
-- Name: user_topic_reads user_topic_reads_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_topic_reads
    ADD CONSTRAINT user_topic_reads_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: user_topic_reads user_topic_reads_user_id_user_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_topic_reads
    ADD CONSTRAINT user_topic_reads_user_id_user_profiles_id_fk FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);


--
-- Name: user_topic_subscriptions user_topic_subscriptions_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_topic_subscriptions
    ADD CONSTRAINT user_topic_subscriptions_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: user_topic_subscriptions user_topic_subscriptions_user_id_user_profiles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_topic_subscriptions
    ADD CONSTRAINT user_topic_subscriptions_user_id_user_profiles_id_fk FOREIGN KEY (user_id) REFERENCES public.user_profiles(id);


--
-- Name: verification_records verification_records_conversation_id_saved_conversations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_records
    ADD CONSTRAINT verification_records_conversation_id_saved_conversations_id_fk FOREIGN KEY (conversation_id) REFERENCES public.saved_conversations(id);


--
-- Name: verification_records verification_records_mission_id_missions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_records
    ADD CONSTRAINT verification_records_mission_id_missions_id_fk FOREIGN KEY (mission_id) REFERENCES public.missions(id);


--
-- Name: verification_records verification_records_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_records
    ADD CONSTRAINT verification_records_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: verification_records verification_records_task_id_mission_tasks_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_records
    ADD CONSTRAINT verification_records_task_id_mission_tasks_id_fk FOREIGN KEY (task_id) REFERENCES public.mission_tasks(id);


--
-- Name: verification_records verification_records_verifier_employee_id_ai_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.verification_records
    ADD CONSTRAINT verification_records_verifier_employee_id_ai_employees_id_fk FOREIGN KEY (verifier_employee_id) REFERENCES public.ai_employees(id);


--
-- Name: weekly_reports weekly_reports_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weekly_reports
    ADD CONSTRAINT weekly_reports_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: workflow_artifacts workflow_artifacts_mission_id_missions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_artifacts
    ADD CONSTRAINT workflow_artifacts_mission_id_missions_id_fk FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE CASCADE;


--
-- Name: workflow_artifacts workflow_artifacts_producer_employee_id_ai_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_artifacts
    ADD CONSTRAINT workflow_artifacts_producer_employee_id_ai_employees_id_fk FOREIGN KEY (producer_employee_id) REFERENCES public.ai_employees(id);


--
-- Name: workflow_template_tab_order workflow_template_tab_order_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_template_tab_order
    ADD CONSTRAINT workflow_template_tab_order_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: workflow_template_tab_order workflow_template_tab_order_template_id_workflow_templates_id_f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_template_tab_order
    ADD CONSTRAINT workflow_template_tab_order_template_id_workflow_templates_id_f FOREIGN KEY (template_id) REFERENCES public.workflow_templates(id) ON DELETE CASCADE;


--
-- Name: workflow_templates workflow_templates_organization_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_templates
    ADD CONSTRAINT workflow_templates_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: buckets buckets_owner_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id);


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: objects objects_owner_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_owner_fkey FOREIGN KEY (owner) REFERENCES auth.users(id);


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_cron_access ON ddl_command_end
         WHEN TAG IN ('CREATE SCHEMA')
   EXECUTE FUNCTION extensions.grant_pg_cron_access();


--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_net_access();


--
-- PostgreSQL database dump complete
--

\unrestrict KmEHkltqTI7k5U2yzW1GuVNZNrbSZIeEfVpnBFGGwrVo1SWYKcZHrl5xq1oHxN0


-- Skill category enum 6→10 overhaul (2026-04-21)
--
-- Replaces the legacy abstract 6-bucket taxonomy (perception/analysis/generation/
-- production/management/knowledge) with 10 scenario-aligned buckets. Existing
-- skills are remapped by slug first (builtin skills), with an old-category
-- fallback for custom skills whose slug isn't in the canonical map.
--
-- Also remaps the skillCategory string embedded in workflow_templates.steps
-- JSONB so workflow UI chips don't break.

BEGIN;

-- 1. Rename legacy enum so we can build a fresh one under the same name.
ALTER TYPE skill_category RENAME TO skill_category_old;

-- 2. New 10-value enum.
CREATE TYPE skill_category AS ENUM (
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

-- 3. Remap skills.category. Slug-first mapping for the 39 builtin skills; for
-- custom skills (slug NULL or unknown), fall back to category-based defaults.
ALTER TABLE skills
  ALTER COLUMN category TYPE skill_category
  USING (
    CASE slug
      WHEN 'web_search' THEN 'web_search'
      WHEN 'web_deep_read' THEN 'web_search'
      WHEN 'news_aggregation' THEN 'data_collection'
      WHEN 'social_listening' THEN 'data_collection'
      WHEN 'trend_monitor' THEN 'data_collection'
      WHEN 'trending_topics' THEN 'data_collection'
      WHEN 'media_search' THEN 'data_collection'
      WHEN 'angle_design' THEN 'topic_planning'
      WHEN 'content_generate' THEN 'content_gen'
      WHEN 'headline_generate' THEN 'content_gen'
      WHEN 'style_rewrite' THEN 'content_gen'
      WHEN 'summary_generate' THEN 'content_gen'
      WHEN 'translation' THEN 'content_gen'
      WHEN 'layout_design' THEN 'content_gen'
      WHEN 'thumbnail_generate' THEN 'content_gen'
      WHEN 'zongyi_highlight' THEN 'content_gen'
      WHEN 'script_generate' THEN 'av_script'
      WHEN 'duanju_script' THEN 'av_script'
      WHEN 'podcast_script' THEN 'av_script'
      WHEN 'tandian_script' THEN 'av_script'
      WHEN 'zhongcao_script' THEN 'av_script'
      WHEN 'audio_plan' THEN 'av_script'
      WHEN 'video_edit_plan' THEN 'av_script'
      WHEN 'quality_review' THEN 'quality_review'
      WHEN 'compliance_check' THEN 'quality_review'
      WHEN 'fact_check' THEN 'quality_review'
      WHEN 'sentiment_analysis' THEN 'content_analysis'
      WHEN 'topic_extraction' THEN 'content_analysis'
      WHEN 'audience_analysis' THEN 'data_analysis'
      WHEN 'competitor_analysis' THEN 'data_analysis'
      WHEN 'heat_scoring' THEN 'data_analysis'
      WHEN 'data_report' THEN 'data_analysis'
      WHEN 'cms_publish' THEN 'distribution'
      WHEN 'cms_catalog_sync' THEN 'distribution'
      WHEN 'aigc_script_push' THEN 'distribution'
      WHEN 'publish_strategy' THEN 'distribution'
      WHEN 'task_planning' THEN 'other'
      WHEN 'knowledge_retrieval' THEN 'other'
      WHEN 'case_reference' THEN 'other'
      ELSE
        CASE category::text
          WHEN 'perception' THEN 'data_collection'
          WHEN 'analysis' THEN 'content_analysis'
          WHEN 'generation' THEN 'content_gen'
          WHEN 'production' THEN 'content_gen'
          WHEN 'management' THEN 'other'
          WHEN 'knowledge' THEN 'other'
          ELSE 'other'
        END
    END
  )::skill_category;

-- 4. Legacy enum is no longer referenced by any table; drop it.
DROP TYPE skill_category_old;

-- 5. Remap skillCategory embedded in workflow_templates.steps JSONB so the
-- workflow step chips (which look up SKILL_CATEGORY_CONFIG by the stored
-- string) keep showing an icon. Slug-first; old-category fallback; any
-- already-new values pass through untouched.
UPDATE workflow_templates
SET steps = (
  SELECT jsonb_agg(
    CASE
      WHEN step->'config' ? 'skillCategory' THEN
        jsonb_set(
          step,
          '{config,skillCategory}',
          to_jsonb(
            CASE step->'config'->>'skillSlug'
              WHEN 'web_search' THEN 'web_search'
              WHEN 'web_deep_read' THEN 'web_search'
              WHEN 'news_aggregation' THEN 'data_collection'
              WHEN 'social_listening' THEN 'data_collection'
              WHEN 'trend_monitor' THEN 'data_collection'
              WHEN 'trending_topics' THEN 'data_collection'
              WHEN 'media_search' THEN 'data_collection'
              WHEN 'angle_design' THEN 'topic_planning'
              WHEN 'content_generate' THEN 'content_gen'
              WHEN 'headline_generate' THEN 'content_gen'
              WHEN 'style_rewrite' THEN 'content_gen'
              WHEN 'summary_generate' THEN 'content_gen'
              WHEN 'translation' THEN 'content_gen'
              WHEN 'layout_design' THEN 'content_gen'
              WHEN 'thumbnail_generate' THEN 'content_gen'
              WHEN 'zongyi_highlight' THEN 'content_gen'
              WHEN 'script_generate' THEN 'av_script'
              WHEN 'duanju_script' THEN 'av_script'
              WHEN 'podcast_script' THEN 'av_script'
              WHEN 'tandian_script' THEN 'av_script'
              WHEN 'zhongcao_script' THEN 'av_script'
              WHEN 'audio_plan' THEN 'av_script'
              WHEN 'video_edit_plan' THEN 'av_script'
              WHEN 'quality_review' THEN 'quality_review'
              WHEN 'compliance_check' THEN 'quality_review'
              WHEN 'fact_check' THEN 'quality_review'
              WHEN 'sentiment_analysis' THEN 'content_analysis'
              WHEN 'topic_extraction' THEN 'content_analysis'
              WHEN 'audience_analysis' THEN 'data_analysis'
              WHEN 'competitor_analysis' THEN 'data_analysis'
              WHEN 'heat_scoring' THEN 'data_analysis'
              WHEN 'data_report' THEN 'data_analysis'
              WHEN 'cms_publish' THEN 'distribution'
              WHEN 'cms_catalog_sync' THEN 'distribution'
              WHEN 'aigc_script_push' THEN 'distribution'
              WHEN 'publish_strategy' THEN 'distribution'
              WHEN 'task_planning' THEN 'other'
              WHEN 'knowledge_retrieval' THEN 'other'
              WHEN 'case_reference' THEN 'other'
              ELSE
                CASE step->'config'->>'skillCategory'
                  WHEN 'perception' THEN 'data_collection'
                  WHEN 'analysis' THEN 'content_analysis'
                  WHEN 'generation' THEN 'content_gen'
                  WHEN 'production' THEN 'content_gen'
                  WHEN 'management' THEN 'other'
                  WHEN 'knowledge' THEN 'other'
                  ELSE step->'config'->>'skillCategory'
                END
            END
          )
        )
      ELSE step
    END
  )
  FROM jsonb_array_elements(steps) AS step
)
WHERE steps IS NOT NULL;

COMMIT;

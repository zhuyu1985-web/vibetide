-- Topic-Compare / Missing-Topics 真实数据重构 schema 迁移 (2026-04-21)
--
-- 关联 spec: docs/superpowers/specs/2026-04-20-topic-compare-missing-topics-technical-design.md
--
-- 本迁移做四件事：
--   1. 新增两个 enum：coverage_decision / missed_topic_push_status
--   2. platform_content 增加 5 字段（Collection Hub 关联 + topicKey）
--   3. benchmark_analyses 增加 10 字段（主题级缓存）
--   4. missed_topics 增加 14+ 字段（二维状态机 + 多源证据 + 推送审计）
--
-- 旧 missed_topics.status 数据按推荐映射回填到新 coverage_decision：
--   missed                            → suspected
--   tracking                          → confirmed
--   resolved + matched_article_id     → covered
--   resolved + 无 matched_article_id  → confirmed
-- 旧 pushed_at 不为空 → push_status = pushed
-- 旧 status 字段保留兼容（read-only），下一期再清理。

BEGIN;

-- ==========================================================================
-- 1. 新增 enums
-- ==========================================================================

DO $$ BEGIN
  CREATE TYPE coverage_decision AS ENUM ('covered', 'suspected', 'confirmed', 'excluded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE missed_topic_push_status AS ENUM ('not_pushed', 'pushed', 'push_failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ==========================================================================
-- 2. platform_content 扩字段
-- ==========================================================================

ALTER TABLE platform_content
  ADD COLUMN IF NOT EXISTS collected_item_id uuid,
  ADD COLUMN IF NOT EXISTS topic_key text,
  ADD COLUMN IF NOT EXISTS topic_cluster_id uuid,
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_channel_snapshot text;

CREATE INDEX IF NOT EXISTS idx_platform_content_org_crawled_at
  ON platform_content (organization_id, crawled_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_content_org_platform_crawled
  ON platform_content (organization_id, platform_id, crawled_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_content_org_coverage
  ON platform_content (organization_id, coverage_status);
CREATE INDEX IF NOT EXISTS idx_platform_content_content_hash
  ON platform_content (content_hash);
CREATE INDEX IF NOT EXISTS idx_platform_content_org_topic_key
  ON platform_content (organization_id, topic_key);
CREATE INDEX IF NOT EXISTS idx_platform_content_org_topic_cluster
  ON platform_content (organization_id, topic_cluster_id);

-- ==========================================================================
-- 3. benchmark_analyses 扩字段
-- ==========================================================================

ALTER TABLE benchmark_analyses
  ADD COLUMN IF NOT EXISTS topic_key text,
  ADD COLUMN IF NOT EXISTS topic_cluster_id uuid,
  ADD COLUMN IF NOT EXISTS matched_report_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS central_report_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provincial_report_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_report_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS latest_matched_at timestamptz,
  ADD COLUMN IF NOT EXISTS summary_source text,
  ADD COLUMN IF NOT EXISTS summary_version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_benchmark_analyses_org_topic_key
  ON benchmark_analyses (organization_id, topic_key);
CREATE INDEX IF NOT EXISTS idx_benchmark_analyses_org_source_article
  ON benchmark_analyses (organization_id, source_article_id);
CREATE INDEX IF NOT EXISTS idx_benchmark_analyses_org_expires
  ON benchmark_analyses (organization_id, expires_at);

-- 回填 mediaScores.length 到 matched_report_count（旧统计口径迁移）
UPDATE benchmark_analyses
SET matched_report_count = COALESCE(jsonb_array_length(media_scores), 0)
WHERE matched_report_count = 0
  AND media_scores IS NOT NULL
  AND jsonb_typeof(media_scores) = 'array';

-- ==========================================================================
-- 4. missed_topics 扩字段（二维状态机 + 多源证据 + 推送审计）
-- ==========================================================================

ALTER TABLE missed_topics
  ADD COLUMN IF NOT EXISTS coverage_decision coverage_decision NOT NULL DEFAULT 'suspected',
  ADD COLUMN IF NOT EXISTS push_status missed_topic_push_status NOT NULL DEFAULT 'not_pushed',
  ADD COLUMN IF NOT EXISTS collected_item_id uuid,
  ADD COLUMN IF NOT EXISTS primary_evidence_id uuid,
  ADD COLUMN IF NOT EXISTS evidence_item_ids jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS topic_key text,
  ADD COLUMN IF NOT EXISTS clue_fingerprint text,
  ADD COLUMN IF NOT EXISTS source_detail text,
  ADD COLUMN IF NOT EXISTS content_summary text,
  ADD COLUMN IF NOT EXISTS content_length integer,
  ADD COLUMN IF NOT EXISTS is_multi_source text,
  ADD COLUMN IF NOT EXISTS reported_by jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS matched_score real,
  ADD COLUMN IF NOT EXISTS matched_article_title_snapshot text,
  ADD COLUMN IF NOT EXISTS excluded_reason_code text,
  ADD COLUMN IF NOT EXISTS excluded_reason_text text,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS push_payload jsonb,
  ADD COLUMN IF NOT EXISTS push_error_message text,
  ADD COLUMN IF NOT EXISTS score_breakdown jsonb;

-- 旧 status → coverage_decision 映射（仅在 coverage_decision 还是默认值时更新）
UPDATE missed_topics
SET coverage_decision = CASE
  WHEN status = 'missed' THEN 'suspected'::coverage_decision
  WHEN status = 'tracking' THEN 'confirmed'::coverage_decision
  WHEN status = 'resolved' AND matched_article_id IS NOT NULL THEN 'covered'::coverage_decision
  WHEN status = 'resolved' THEN 'confirmed'::coverage_decision
  ELSE 'suspected'::coverage_decision
END
WHERE coverage_decision = 'suspected';

-- 推送状态从 pushed_at 推断（旧字段表示已推送）
UPDATE missed_topics
SET push_status = 'pushed'::missed_topic_push_status
WHERE pushed_at IS NOT NULL
  AND push_status = 'not_pushed';

-- 索引
CREATE INDEX IF NOT EXISTS idx_missed_topics_org_coverage_push
  ON missed_topics (organization_id, coverage_decision, push_status);
CREATE INDEX IF NOT EXISTS idx_missed_topics_org_discovered
  ON missed_topics (organization_id, discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_missed_topics_org_topic_key
  ON missed_topics (organization_id, topic_key);
CREATE INDEX IF NOT EXISTS idx_missed_topics_org_clue_fingerprint
  ON missed_topics (organization_id, clue_fingerprint);

COMMIT;

-- Topic-Compare / Missing-Topics v2 重构 (2026-04-21)
--
-- 核心变化（按 CLAUDE.md / spec 2026-04-20 / brainstorming v2）：
--   1. "我方作品"从纯 articles 表扩展为：articles + my_posts (含多渠道发布记录)
--   2. "对标"从 platform 维度升级为账号维度
--   3. "同题匹配"从关键词 ILIKE 升级为 LLM 语义匹配
--   4. 10 维度 AI 分析 schema
--
-- Drop 的 3 张旧表数据在前面几轮 phase 已清空。

BEGIN;

-- ==========================================================================
-- 1. DROP 旧表
-- ==========================================================================

DROP TABLE IF EXISTS missed_topics CASCADE;
DROP TABLE IF EXISTS platform_content CASCADE;
DROP TABLE IF EXISTS benchmark_analyses CASCADE;

-- 相关旧 enum（保留 missed_topic_priority / type / source_type / status 兼容其他引用？确认无引用后 drop）
-- 检查：coverage_decision / missed_topic_push_status 是前几轮 phase 加的，v2 不用了
DROP TYPE IF EXISTS coverage_decision CASCADE;
DROP TYPE IF EXISTS missed_topic_push_status CASCADE;

-- ==========================================================================
-- 2. 新 enum
-- ==========================================================================

CREATE TYPE my_account_platform AS ENUM (
  'app',       -- 自家客户端（北京时间、听听 FM）
  'website',   -- 自家网站
  'wechat',    -- 微信公众号
  'weibo',     -- 新浪微博
  'douyin',    -- 抖音
  'kuaishou',  -- 快手
  'bilibili',  -- B 站
  'xiaohongshu',  -- 小红书
  'tv',        -- 电视频道
  'radio',     -- 广播
  'other'
);

CREATE TYPE benchmark_account_level AS ENUM (
  'central',      -- 央级媒体
  'provincial',   -- 省级媒体
  'city',         -- 地市级
  'industry',     -- 行业媒体
  'self_media'    -- 自媒体
);

CREATE TYPE topic_match_decision AS ENUM (
  'covered',      -- 已覆盖（我方有稿件对应）
  'suspected',    -- 疑似漏报
  'confirmed',    -- 确认漏报
  'excluded',     -- 人工排除
  'pushed'        -- 已推送处置
);

-- ==========================================================================
-- 3. my_accounts — 我方账号绑定
-- ==========================================================================

CREATE TABLE my_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  platform my_account_platform NOT NULL,
  handle text NOT NULL,             -- 账号标识（用户名 / UID / 域名）
  name text NOT NULL,               -- 显示名称
  avatar_url text,
  description text,
  account_url text,                 -- 账号主页 URL

  -- 抓取配置（本期手动录入为主，保留字段未来接数据平台）
  crawl_config jsonb DEFAULT '{}'::jsonb,
  crawl_status text DEFAULT 'manual', -- 'manual' | 'active' | 'paused' | 'error'
  last_crawled_at timestamptz,

  -- 统计
  post_count integer DEFAULT 0,
  follower_count integer,
  notes text,

  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (organization_id, platform, handle)
);

CREATE INDEX idx_my_accounts_org_platform ON my_accounts (organization_id, platform);
CREATE INDEX idx_my_accounts_org_enabled ON my_accounts (organization_id, is_enabled);

-- ==========================================================================
-- 4. my_posts — 我方原始稿件（一个逻辑作品）
-- ==========================================================================

CREATE TABLE my_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  title text NOT NULL,
  summary text,
  body text,
  topic text,                       -- AI 抽取的主题
  content_fingerprint text,         -- 用于同题归并

  -- 关联到内部稿件库（可选）
  internal_article_id uuid REFERENCES articles(id) ON DELETE SET NULL,

  -- 原始发布元信息
  original_author text,
  original_source_url text,         -- 首发源 URL
  published_at timestamptz,

  -- 聚合统计（多渠道发布总和，定期刷新）
  total_views integer DEFAULT 0,
  total_likes integer DEFAULT 0,
  total_shares integer DEFAULT 0,
  total_comments integer DEFAULT 0,
  stats_aggregated_at timestamptz,

  -- 维度评分缓存（由 AI 分析生成）
  dimension_scores jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_my_posts_org_published ON my_posts (organization_id, published_at DESC);
CREATE INDEX idx_my_posts_org_topic ON my_posts (organization_id, topic);
CREATE INDEX idx_my_posts_org_fingerprint ON my_posts (organization_id, content_fingerprint);
CREATE INDEX idx_my_posts_article_id ON my_posts (internal_article_id) WHERE internal_article_id IS NOT NULL;
CREATE INDEX idx_my_posts_title_trgm ON my_posts USING gin (title gin_trgm_ops);

-- ==========================================================================
-- 5. my_post_distributions — 一稿多发
-- ==========================================================================

CREATE TABLE my_post_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  my_post_id uuid NOT NULL REFERENCES my_posts(id) ON DELETE CASCADE,
  my_account_id uuid NOT NULL REFERENCES my_accounts(id) ON DELETE CASCADE,

  published_url text,               -- 该渠道发布的最终 URL（可点击源链接）
  published_at timestamptz,

  -- 渠道粒度指标
  views integer DEFAULT 0,
  likes integer DEFAULT 0,
  shares integer DEFAULT 0,
  comments integer DEFAULT 0,
  raw_metadata jsonb,

  collected_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (my_post_id, my_account_id)
);

CREATE INDEX idx_my_post_dist_post ON my_post_distributions (my_post_id);
CREATE INDEX idx_my_post_dist_account ON my_post_distributions (my_account_id);

-- ==========================================================================
-- 6. benchmark_accounts — 对标账号池
-- ==========================================================================

CREATE TABLE benchmark_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 全局预置账号 organization_id 为 null；组织自建账号带 org id
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,

  platform my_account_platform NOT NULL,
  level benchmark_account_level NOT NULL,
  handle text NOT NULL,
  name text NOT NULL,
  avatar_url text,
  description text,
  account_url text,

  region text,                      -- '北京' / '上海' / '中央' 等
  is_preset boolean NOT NULL DEFAULT false,
  is_enabled boolean NOT NULL DEFAULT true,

  -- 抓取统计
  last_crawled_at timestamptz,
  post_count integer DEFAULT 0,

  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- 全局预置账号的唯一约束（org_id NULL 时按 platform+handle 唯一）
  CONSTRAINT uq_benchmark_acc_global UNIQUE (platform, handle, organization_id)
);

CREATE INDEX idx_benchmark_acc_platform_level ON benchmark_accounts (platform, level);
CREATE INDEX idx_benchmark_acc_enabled ON benchmark_accounts (is_enabled);
CREATE INDEX idx_benchmark_acc_org ON benchmark_accounts (organization_id) WHERE organization_id IS NOT NULL;

-- ==========================================================================
-- 7. benchmark_posts — 对标账号帖子
-- ==========================================================================

CREATE TABLE benchmark_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  benchmark_account_id uuid NOT NULL REFERENCES benchmark_accounts(id) ON DELETE CASCADE,

  title text NOT NULL,
  summary text,
  body text,
  source_url text,
  topic text,
  content_fingerprint text,

  published_at timestamptz,

  views integer DEFAULT 0,
  likes integer DEFAULT 0,
  shares integer DEFAULT 0,
  comments integer DEFAULT 0,
  raw_metadata jsonb,

  -- 单篇 AI 解读缓存
  ai_interpretation jsonb,
  ai_interpretation_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_benchmark_posts_account_pub ON benchmark_posts (benchmark_account_id, published_at DESC);
CREATE INDEX idx_benchmark_posts_pub ON benchmark_posts (published_at DESC);
CREATE INDEX idx_benchmark_posts_fingerprint ON benchmark_posts (content_fingerprint);
CREATE INDEX idx_benchmark_posts_title_trgm ON benchmark_posts USING gin (title gin_trgm_ops);
CREATE INDEX idx_benchmark_posts_body_trgm ON benchmark_posts USING gin (body gin_trgm_ops);

-- ==========================================================================
-- 8. topic_matches — 同题匹配关系 + 10 维分析缓存
-- ==========================================================================

CREATE TABLE topic_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  my_post_id uuid NOT NULL REFERENCES my_posts(id) ON DELETE CASCADE,

  -- 匹配到的对标 post id 列表（jsonb 数组）
  benchmark_post_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  match_count integer NOT NULL DEFAULT 0,

  similarity_score real,
  matched_by text NOT NULL DEFAULT 'llm',   -- 'llm' | 'keyword' | 'manual'
  matched_reasons jsonb,                    -- LLM 判定原因

  -- 10 维 AI 分析结果（结构化 jsonb）
  ai_analysis jsonb,
  ai_analysis_version integer DEFAULT 1,
  ai_analysis_source text,                  -- 'platform_posts' | 'tavily'
  ai_analysis_at timestamptz,
  expires_at timestamptz,

  -- 维度评分矩阵（用于列表展示）
  radar_data jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (my_post_id)
);

CREATE INDEX idx_topic_matches_org ON topic_matches (organization_id);
CREATE INDEX idx_topic_matches_expires ON topic_matches (organization_id, expires_at);

-- ==========================================================================
-- 9. missed_topics_v2 — 重建漏题表（极简版，基于对标 - 我方差集）
-- ==========================================================================

CREATE TABLE missed_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- 主证据：对标账号发过的某一条 post
  primary_benchmark_post_id uuid NOT NULL REFERENCES benchmark_posts(id) ON DELETE CASCADE,
  -- 其他同题对标 post（多源证据）
  related_benchmark_post_ids jsonb DEFAULT '[]'::jsonb,

  title text NOT NULL,
  topic text,
  content_fingerprint text,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  heat_score real DEFAULT 0,

  -- 覆盖判断
  decision topic_match_decision NOT NULL DEFAULT 'suspected',
  matched_my_post_id uuid REFERENCES my_posts(id) ON DELETE SET NULL,
  matched_my_post_title_snapshot text,

  -- 排除 / 确认审计
  excluded_reason_code text,
  excluded_reason_text text,
  confirmed_by uuid,
  confirmed_at timestamptz,

  -- 推送
  push_status text NOT NULL DEFAULT 'not_pushed',  -- 'not_pushed' | 'pushed' | 'push_failed'
  pushed_at timestamptz,
  push_error_message text,
  push_payload jsonb,

  -- AI 分析（对该漏题）
  ai_summary jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (organization_id, content_fingerprint)
);

CREATE INDEX idx_missed_topics_org_decision ON missed_topics (organization_id, decision);
CREATE INDEX idx_missed_topics_org_discovered ON missed_topics (organization_id, discovered_at DESC);

COMMIT;

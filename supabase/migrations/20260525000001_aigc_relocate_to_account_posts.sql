-- Phase 2 修正 (2026-05-25)：把 aigc_ 4 字段从 collected_items 迁到 my_posts + benchmark_posts
--
-- 背景：
--   昨日 20260524000001 把 aigc_content_category/aigc_keywords/aigc_annotated_at/aigc_annotation_model
--   加到了 collected_items（66911 行，全量舆情/热点/调研池），范围错误。
--   账号分析模块 区块 C（类型占比 + 词云）应该基于"账号实际发文"：
--     - my_posts (3 行)          —— 我方账号的稿件
--     - benchmark_posts (17 行)  —— 对标账号的稿件
--   collected_items 跟账号分析无关，字段放错表了。
--
-- 已经派发的一次 backfill 标注了 ~2000 条 collected_items（沉没成本，不回滚数据，
-- 这里 drop 列时数据自然消失）。
--
-- 此次迁移：
--   1) drop collected_items 的 4 列 + 3 个索引
--   2) my_posts add 同样 4 列 + 3 个索引（org_id+category 复合 / keywords gin / annotated_at partial）
--   3) benchmark_posts add 同样 4 列 + 3 个索引（benchmark_account_id+category 复合 / keywords gin / annotated_at partial）

BEGIN;

-- ──────────────────────────────────────────────────────────────────
-- 1) 删除 collected_items 上误加的 aigc 字段 + 3 索引
-- ──────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS collected_items_aigc_category_idx;
DROP INDEX IF EXISTS collected_items_aigc_keywords_gin;
DROP INDEX IF EXISTS collected_items_aigc_annotated_at_idx;

ALTER TABLE collected_items DROP COLUMN IF EXISTS aigc_content_category;
ALTER TABLE collected_items DROP COLUMN IF EXISTS aigc_keywords;
ALTER TABLE collected_items DROP COLUMN IF EXISTS aigc_annotated_at;
ALTER TABLE collected_items DROP COLUMN IF EXISTS aigc_annotation_model;

-- ──────────────────────────────────────────────────────────────────
-- 2) my_posts 加 4 字段 + 3 索引
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE my_posts
  ADD COLUMN IF NOT EXISTS aigc_content_category text,
  ADD COLUMN IF NOT EXISTS aigc_keywords jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS aigc_annotated_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS aigc_annotation_model text;

CREATE INDEX IF NOT EXISTS my_posts_aigc_category_idx
  ON my_posts (organization_id, aigc_content_category);

CREATE INDEX IF NOT EXISTS my_posts_aigc_keywords_gin
  ON my_posts USING gin (aigc_keywords);

CREATE INDEX IF NOT EXISTS my_posts_aigc_annotated_at_idx
  ON my_posts (aigc_annotated_at)
  WHERE aigc_annotated_at IS NULL;

-- ──────────────────────────────────────────────────────────────────
-- 3) benchmark_posts 加 4 字段 + 3 索引
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE benchmark_posts
  ADD COLUMN IF NOT EXISTS aigc_content_category text,
  ADD COLUMN IF NOT EXISTS aigc_keywords jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS aigc_annotated_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS aigc_annotation_model text;

CREATE INDEX IF NOT EXISTS benchmark_posts_aigc_category_idx
  ON benchmark_posts (benchmark_account_id, aigc_content_category);

CREATE INDEX IF NOT EXISTS benchmark_posts_aigc_keywords_gin
  ON benchmark_posts USING gin (aigc_keywords);

CREATE INDEX IF NOT EXISTS benchmark_posts_aigc_annotated_at_idx
  ON benchmark_posts (aigc_annotated_at)
  WHERE aigc_annotated_at IS NULL;

COMMIT;

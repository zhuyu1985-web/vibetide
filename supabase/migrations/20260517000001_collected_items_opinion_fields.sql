-- 2026-05-17: 对齐舆情数据 schema
--
-- 背景:对照舆情系统导出 (docs/data.xlsx, 33 列, 重庆地区舆情样本) 补全
-- collected_items 缺失的字段。要点:
--   1) category 从单值 text → 多值 text[](舆情"行业分类"实际多值:"公安, 政务")
--   2) 加 22 个顶层列:平台/作者/账号/情感/互动指标/IP 属地/发布地/命中分析/...
--   3) 副表 collected_item_contents 加 ocr_text / asr_text + trigram 索引
--   4) 加 13 个索引兜底"多条件混合检索"(作者/账号/平台/地域/情感/命中关键词)
--
-- 不动的部分:
--   - collection_sources.default_category 仍是单值(写入侧包成 [defaultCategory])
--   - rawMetadata jsonb 保留作为低频字段兜底(MCN 等)

BEGIN;

-- ───────────────────────────────────────────────────────────
-- ① 主表加列 + category 类型迁移
-- ───────────────────────────────────────────────────────────

-- 1.1 category: text → text[](先建临时数组列,迁数据,再 drop+rename)
ALTER TABLE collected_items ADD COLUMN IF NOT EXISTS category_new text[] NOT NULL DEFAULT ARRAY[]::text[];
UPDATE collected_items
   SET category_new = ARRAY[category]
 WHERE category IS NOT NULL AND category <> '';
-- 旧 btree 索引必须先 drop,否则 DROP COLUMN 会带走它
DROP INDEX IF EXISTS collected_items_org_category_idx;
ALTER TABLE collected_items DROP COLUMN category;
ALTER TABLE collected_items RENAME COLUMN category_new TO category;

-- 1.2 其它新列(全部可空,与现有数据兼容)
ALTER TABLE collected_items
  ADD COLUMN IF NOT EXISTS external_id           text,
  ADD COLUMN IF NOT EXISTS platform              text,
  ADD COLUMN IF NOT EXISTS author                text,
  ADD COLUMN IF NOT EXISTS account_id            text,
  ADD COLUMN IF NOT EXISTS account_handle        text,
  ADD COLUMN IF NOT EXISTS author_follower_count integer,
  ADD COLUMN IF NOT EXISTS sentiment             text,
  ADD COLUMN IF NOT EXISTS info_type             text,
  ADD COLUMN IF NOT EXISTS like_count            integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comment_count         integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS share_count           integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS view_count            integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS favorite_count        integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reply_count           integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ip_region             text,
  ADD COLUMN IF NOT EXISTS post_region           text,
  ADD COLUMN IF NOT EXISTS mentioned_regions     text[],
  ADD COLUMN IF NOT EXISTS matched_keywords      text[],
  ADD COLUMN IF NOT EXISTS matched_regions       text[],
  ADD COLUMN IF NOT EXISTS industries            text[],
  ADD COLUMN IF NOT EXISTS cover_image_url       text,
  ADD COLUMN IF NOT EXISTS duration_seconds      integer;

-- ───────────────────────────────────────────────────────────
-- ② 主表索引
-- ───────────────────────────────────────────────────────────
-- 注:事务内不能 CONCURRENTLY。本表目前只有 ~6.6k 行,直接锁建可接受。
-- 数据量超过 100w 后,后续 migration 用单独事务 + CONCURRENTLY。

CREATE INDEX IF NOT EXISTS collected_items_org_first_seen_idx
  ON collected_items (organization_id, first_seen_at DESC);

CREATE INDEX IF NOT EXISTS collected_items_category_gin
  ON collected_items USING gin (category);

CREATE INDEX IF NOT EXISTS collected_items_industries_gin
  ON collected_items USING gin (industries);

CREATE INDEX IF NOT EXISTS collected_items_mentioned_regions_gin
  ON collected_items USING gin (mentioned_regions);

CREATE INDEX IF NOT EXISTS collected_items_matched_keywords_gin
  ON collected_items USING gin (matched_keywords);

CREATE INDEX IF NOT EXISTS collected_items_matched_regions_gin
  ON collected_items USING gin (matched_regions);

CREATE INDEX IF NOT EXISTS collected_items_org_author_idx
  ON collected_items (organization_id, author) WHERE author IS NOT NULL;

CREATE INDEX IF NOT EXISTS collected_items_org_account_idx
  ON collected_items (organization_id, account_id) WHERE account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS collected_items_org_platform_idx
  ON collected_items (organization_id, platform) WHERE platform IS NOT NULL;

CREATE INDEX IF NOT EXISTS collected_items_org_sentiment_idx
  ON collected_items (organization_id, sentiment) WHERE sentiment IS NOT NULL;

CREATE INDEX IF NOT EXISTS collected_items_org_ip_region_idx
  ON collected_items (organization_id, ip_region) WHERE ip_region IS NOT NULL;

CREATE INDEX IF NOT EXISTS collected_items_org_post_region_idx
  ON collected_items (organization_id, post_region) WHERE post_region IS NOT NULL;

CREATE INDEX IF NOT EXISTS collected_items_org_external_id_idx
  ON collected_items (organization_id, external_id) WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS collected_items_org_like_idx
  ON collected_items (organization_id, like_count DESC);

-- ───────────────────────────────────────────────────────────
-- ③ 副表 OCR / ASR
-- ───────────────────────────────────────────────────────────

ALTER TABLE collected_item_contents
  ADD COLUMN IF NOT EXISTS ocr_text text,
  ADD COLUMN IF NOT EXISTS asr_text text;

-- LZ4 压缩(PG14+);若实例不支持自动忽略
DO $$
BEGIN
  BEGIN
    ALTER TABLE collected_item_contents ALTER COLUMN ocr_text SET COMPRESSION lz4;
    ALTER TABLE collected_item_contents ALTER COLUMN asr_text SET COMPRESSION lz4;
  EXCEPTION WHEN feature_not_supported OR syntax_error THEN
    RAISE NOTICE 'LZ4 compression not supported on this PG version, skipping';
  END;
END$$;

CREATE INDEX IF NOT EXISTS collected_item_contents_ocr_trgm
  ON collected_item_contents USING gin (ocr_text gin_trgm_ops)
  WHERE ocr_text IS NOT NULL;

CREATE INDEX IF NOT EXISTS collected_item_contents_asr_trgm
  ON collected_item_contents USING gin (asr_text gin_trgm_ops)
  WHERE asr_text IS NOT NULL;

COMMIT;

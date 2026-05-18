-- 2026-05-14: 把 collected_items.content 拆到 collected_item_contents 副表
--
-- 背景: collected_items 主表在 content 列上有 GIN trigram 索引,数据量到
-- 百万-千万级时索引膨胀严重 (15-20GB),拖累写入和列表查询。把正文 1:1 拆出:
--   - 主表保持轻量,只放元数据 (org/title/url/category/tags/outlet/...)
--   - 副表 collected_item_contents 独立存正文 + LZ4 压缩 + GIN trigram 仅在副表
-- 列表/筛选/排序不再回主表读 content;详情页 LEFT JOIN 副表读正文。
--
-- 兜底 (Q2=A): 副表保留 trigram 索引,让"任意关键词搜索"路径仍能用
-- (百万级 1-3s 可接受,千万级再上 Meilisearch)。
--
-- 数据状态: 当前 collected_items 有 6651 行但 0 行有 content
-- (验证: SELECT COUNT(content) FROM collected_items = 0)
-- 因此 hard cut,无需搬迁数据。

BEGIN;

-- 1. 副表 (1:1)
CREATE TABLE IF NOT EXISTS collected_item_contents (
  item_id    uuid PRIMARY KEY REFERENCES collected_items(id) ON DELETE CASCADE,
  content    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. LZ4 压缩 (PG14+);若实例版本不支持会报错,届时手动改为 pglz
ALTER TABLE collected_item_contents ALTER COLUMN content SET COMPRESSION lz4;

-- 3. trigram GIN 索引仅在副表
CREATE INDEX IF NOT EXISTS collected_item_contents_content_trgm
  ON collected_item_contents USING gin (content gin_trgm_ops);

-- 4. 主表删 content 列 + 删主表 content trigram 索引
DROP INDEX IF EXISTS collected_items_content_trgm;
ALTER TABLE collected_items DROP COLUMN IF EXISTS content;

COMMIT;

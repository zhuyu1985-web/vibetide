-- Articles 去重 + 唯一约束 (2026-04-21)
--
-- 问题：seed.ts 多次执行后 articles 表出现 8 个标题 × 14 份 = 112 条重复数据，
-- 导致同题对比页（topic-compare）列表出现大量重复行。
--
-- 修复：
--   1. 一次性清理：每个 (organization_id, title) 仅保留最早创建的一条
--   2. 加唯一索引防止后续重复（seed 已改为 onConflictDoNothing）

BEGIN;

-- 一次性去重
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY organization_id, title
           ORDER BY created_at, id
         ) AS rn
  FROM articles
)
DELETE FROM articles
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS articles_org_title_uniq
  ON articles (organization_id, title);

COMMIT;

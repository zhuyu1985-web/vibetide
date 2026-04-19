-- supabase: no-transaction
-- 原因：PG `ALTER TYPE ... ADD VALUE` 不能在事务内执行。

ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'deep';
ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'social';
ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'advanced';
ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'livelihood';
ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'podcast';
ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'drama';
ALTER TYPE workflow_category ADD VALUE IF NOT EXISTS 'daily_brief';

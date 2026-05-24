-- Phase 2 Task 2.1 (2026-05-24): collected_items 加 AIGC 标注字段
--
-- 背景: 账号数据分析 Tab 区块 C(内容画像) 需要按内容类型/关键词聚合，
-- 由 Inngest 异步函数 annotate-collected-content 用 LLM 标注后写回这 4 列。
--
-- 字段:
--   aigc_content_category   text       单值, 8 选 1 (见 src/lib/account-analytics/content-category.ts)
--   aigc_keywords           jsonb      string[], default '[]', GIN 索引加速词云
--   aigc_annotated_at       timestamptz nullable, 增量回填基准
--   aigc_annotation_model   text       e.g. "deepseek.chat.v3", 模型版本字符串
--
-- 命名: 前缀 aigc_ 是为了与 collected_items.category text[] 行业分类区分,
--       aigc_ 表示 LLM 二次标注产物.
--
-- 索引:
--   1. 复合 (org_id, account_id, aigc_content_category) — 加速类型占比 group by
--   2. GIN on aigc_keywords — 加速词云 jsonb 元素展开
--   3. Partial WHERE aigc_annotated_at IS NULL — 加速"待标注"扫描,
--      历史回填完后该 index 会逐渐变小,长期保留维护成本极低.

ALTER TABLE collected_items
  ADD COLUMN IF NOT EXISTS aigc_content_category text;

ALTER TABLE collected_items
  ADD COLUMN IF NOT EXISTS aigc_keywords jsonb DEFAULT '[]'::jsonb;

ALTER TABLE collected_items
  ADD COLUMN IF NOT EXISTS aigc_annotated_at timestamp with time zone;

ALTER TABLE collected_items
  ADD COLUMN IF NOT EXISTS aigc_annotation_model text;

CREATE INDEX IF NOT EXISTS collected_items_aigc_category_idx
  ON collected_items (organization_id, account_id, aigc_content_category);

CREATE INDEX IF NOT EXISTS collected_items_aigc_keywords_gin
  ON collected_items USING gin (aigc_keywords);

CREATE INDEX IF NOT EXISTS collected_items_aigc_annotated_at_idx
  ON collected_items (aigc_annotated_at)
  WHERE aigc_annotated_at IS NULL;

-- Phase 3a (2026-05-18): research_topics 加 nullable group_name 列
--
-- 背景: 数据采集重构 Phase 3 合并 /research/admin/topics 到统一的
-- /data-collection/topics 入口。为支持主题分组(科技/民生/体育...),
-- 给 research_topics 加 nullable group_name 列。
--
-- 兼容性: 列 nullable, 老主题留空表示"默认分组",由 UI(Phase 3b) 统一处理。
-- Server action setTopicGroup() 用于后续分组编辑。

ALTER TABLE research_topics
  ADD COLUMN IF NOT EXISTS group_name text;

CREATE INDEX IF NOT EXISTS research_topics_org_group_idx
  ON research_topics (organization_id, group_name);

-- Drop the app_channels table and all associated appChannelSlug columns / indexes.
--
-- Context: CMS 推送目标（siteId / appId / catalogId）改为 article-mapper 硬编码
-- （81 / 1768 / 10210），不再经过 app_channels ↔ cms_catalogs 绑定路径。
--
-- Safety:
--   - app_channels 是运营配置，丢失后当前组织需重新绑定。P1 阶段的硬编码方案下
--     所有推送目标统一，app_channels 已经无消费者（见 loadMapperContext refactor）。
--   - cms_publications.app_channel_slug 仅做审计标注，drop 前先 drop 相关索引。
--   - workflow_templates.app_channel_slug 同上。

-- 1. Drop index on cms_publications first (references the column)
DROP INDEX IF EXISTS cms_pub_channel_state_idx;

-- 2. Drop app_channel_slug column from cms_publications
ALTER TABLE cms_publications
  DROP COLUMN IF EXISTS app_channel_slug;

-- 3. Drop app_channel_slug column from workflow_templates
ALTER TABLE workflow_templates
  DROP COLUMN IF EXISTS app_channel_slug;

-- 4. Drop app_channels table (has FK → cms_catalogs, no inbound FKs)
DROP TABLE IF EXISTS app_channels;

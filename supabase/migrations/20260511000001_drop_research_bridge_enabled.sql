-- B1: 删除 collection_sources.research_bridge_enabled 字段
--
-- 背景: A3 phase 已经把 research_news_articles 表 drop 了,research 检索/报告
-- 现在直接读 collected_items + research_collected_item_topics/districts 标注表。
-- research bridge 不再写入任何业务表,这个开关字段已变成 dead flag,
-- 顺手删掉避免后续误判"勾上会同步数据"。
--
-- /research 工作台需要"只看某几个采集源"时,通过新的 source-binding 多选筛选
-- (firstSeenSourceId IN (...)) 实现,不需要 source 上的常驻 boolean。

ALTER TABLE collection_sources DROP COLUMN IF EXISTS research_bridge_enabled;

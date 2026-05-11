-- M1.1 (2026-05-12): media_outlet_dictionary 加 group_name + channels jsonb
--
-- 背景: 旧 schema 用 domains[] + publicAccountNames[] 两个泛字段记录媒体在各平台的痕迹,
-- 无法区分平台类型(网站/公众号/抖音/微博/快手),也没有平台级 ID(secUid/ghid/uid/userId)。
-- M1 引入结构化的 channels[] discriminated union,让 tikhub adapter (M3) 能按账号抓,
-- 让 UI (M2) 能分平台编辑账号。
--
-- 兼容性: 旧字段 domains / public_account_names 保留, 数据由 scripts/migrate-outlet-channels.ts
-- 一次性回填到 channels,1-2 个 sprint 观察期后再 DROP。

ALTER TABLE media_outlet_dictionary
  ADD COLUMN IF NOT EXISTS group_name text,
  ADD COLUMN IF NOT EXISTS channels jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS media_outlet_dictionary_group_idx
  ON media_outlet_dictionary (organization_id, group_name);

-- 关键索引: 按 channel 中的账号识别符(ghid/secUid/uid/userId/domain)反查 outlet。
-- 用 jsonb_path_ops 比默认 jsonb_ops 占用小,适合 @> containment 查询场景。
CREATE INDEX IF NOT EXISTS media_outlet_dictionary_channels_gin
  ON media_outlet_dictionary USING gin (channels jsonb_path_ops);

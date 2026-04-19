-- workflow_templates 扩列
ALTER TABLE workflow_templates
  ADD COLUMN IF NOT EXISTS icon text,
  ADD COLUMN IF NOT EXISTS input_fields jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS default_team jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS app_channel_slug text,
  ADD COLUMN IF NOT EXISTS system_instruction text,
  ADD COLUMN IF NOT EXISTS legacy_scenario_key text;

-- Dedupe 历史上 seed 重跑累积的重复 builtin 行（保留每组 created_at 最早的一行）
-- 自愈：clean DB 上 0 行受影响；累积重复的 DB 上会收敛到每组 1 行
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY organization_id, name, is_builtin, legacy_scenario_key
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM workflow_templates
)
DELETE FROM workflow_templates
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 两个互补的 partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS workflow_templates_org_legacy_key_uidx
  ON workflow_templates (organization_id, legacy_scenario_key)
  WHERE legacy_scenario_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS workflow_templates_org_builtin_name_uidx
  ON workflow_templates (organization_id, name)
  WHERE is_builtin = true AND legacy_scenario_key IS NULL;

-- missions 扩 FK
ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS workflow_template_id uuid
    REFERENCES workflow_templates(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS missions_workflow_template_id_idx
  ON missions (workflow_template_id)
  WHERE workflow_template_id IS NOT NULL;

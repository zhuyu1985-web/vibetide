BEGIN;

-- workflow_templates: 4 new cols
ALTER TABLE workflow_templates
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS owner_employee_id text,
  ADD COLUMN IF NOT EXISTS launch_mode text NOT NULL DEFAULT 'form',
  ADD COLUMN IF NOT EXISTS prompt_template text;

-- CHECK constraint (no IF NOT EXISTS support for CONSTRAINT → DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workflow_templates_launch_mode_check'
  ) THEN
    ALTER TABLE workflow_templates
      ADD CONSTRAINT workflow_templates_launch_mode_check
      CHECK (launch_mode IN ('form', 'direct'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_workflow_templates_owner_employee
  ON workflow_templates(organization_id, owner_employee_id)
  WHERE owner_employee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_templates_public_builtin
  ON workflow_templates(organization_id, is_public, is_builtin);

-- missions: input_params
ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS input_params jsonb NOT NULL DEFAULT '{}'::jsonb;

-- DROP employee_scenarios (B.1 stopped writing; no runtime dependency)
DROP TABLE IF EXISTS employee_scenarios CASCADE;

COMMIT;

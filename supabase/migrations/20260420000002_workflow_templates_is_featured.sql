BEGIN;

-- 2026-04-20 homepage scenario tabs redesign —— 新增 is_featured 标识
-- 用途：首页"主流场景" tab 过滤（与 owner_employee_id 正交，双重归类）
ALTER TABLE workflow_templates
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

-- 部分索引：主流场景 tab 查询热路径（is_featured=true AND is_public=true）
CREATE INDEX IF NOT EXISTS idx_workflow_templates_featured
  ON workflow_templates(organization_id, is_featured)
  WHERE is_featured = true AND is_public = true;

COMMIT;

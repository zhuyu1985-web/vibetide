-- 唯一约束
CREATE UNIQUE INDEX IF NOT EXISTS ai_employees_org_slug_unique
  ON ai_employees (organization_id, slug);

CREATE UNIQUE INDEX IF NOT EXISTS employee_skills_employee_skill_unique
  ON employee_skills (employee_id, skill_id);

CREATE UNIQUE INDEX IF NOT EXISTS employee_kbs_employee_kb_unique
  ON employee_knowledge_bases (employee_id, knowledge_base_id);

-- 查询性能索引
CREATE INDEX IF NOT EXISTS missions_org_status_idx
  ON missions (organization_id, status);

CREATE INDEX IF NOT EXISTS mission_tasks_mission_status_idx
  ON mission_tasks (mission_id, status);

CREATE INDEX IF NOT EXISTS skill_usage_records_skill_created_idx
  ON skill_usage_records (skill_id, created_at);

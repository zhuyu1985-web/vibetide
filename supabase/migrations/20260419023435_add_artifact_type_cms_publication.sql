-- Phase 1 — 为 workflow_artifacts.artifactType 加入 cms_publication
-- 注意：ALTER TYPE ... ADD VALUE 不支持事务，此 migration 必须在事务外执行
ALTER TYPE artifact_type ADD VALUE IF NOT EXISTS 'cms_publication';

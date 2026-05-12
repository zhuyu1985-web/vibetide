-- 2026-05-13: 下线 /research/admin/tasks 与 /research/admin/media-outlets
--
-- 背景: 采集任务 + 媒体源管理已统一到 Collection Hub (/data-collection),
-- 研究模块不再需要独立的采集任务调度。此迁移幂等地清掉:
--   1. research_reports 中 research_task 来源的报告数据 (snapshot 已不再可序列化)
--   2. research_reports.research_task_id 列 + 自带 FK / 索引
--   3. research_tasks 表 (含 research_tasks_* 索引)
--   4. research_task_status / research_dedup_level 两个枚举类型
--   5. roles.permissions jsonb 数组中 5 个废弃权限的残留
--
-- 备注: 4 个研究任务相关权限 + 1 个媒体源管理权限会被剔除:
--   research:task_create / research:task_view_own / research:task_view_org /
--   research:task_export / research:media_outlet_manage

-- ─── 1. 清掉 research_task 来源的报告 ─────────────────────────────────
-- ReportSearchSnapshot 在代码层已收敛到 advanced_search 一种,
-- 这些 row 的 search_snapshot.kind="research_task" 现在无法被消费,
-- 直接删除避免运行时 union 类型断言失败.
DELETE FROM research_reports WHERE source_type = 'research_task';

-- ─── 2. research_reports.research_task_id 列 + FK + 索引 ─────────────
DROP INDEX IF EXISTS research_reports_task_idx;
-- CASCADE 自动一并 drop 系统自动命名的 FK 约束 (research_reports_research_task_id_fkey)
ALTER TABLE research_reports DROP COLUMN IF EXISTS research_task_id CASCADE;

-- ─── 3. research_tasks 表 + 索引 ──────────────────────────────────────
DROP INDEX IF EXISTS research_tasks_status_idx;
DROP INDEX IF EXISTS research_tasks_org_user_idx;
DROP TABLE IF EXISTS research_tasks;

-- ─── 4. 枚举类型 ──────────────────────────────────────────────────────
DROP TYPE IF EXISTS research_task_status;
DROP TYPE IF EXISTS research_dedup_level;

-- ─── 5. 从 roles.permissions JSONB 数组中剔除废弃权限 ────────────────
-- 权限以 string 元素存储在 permissions::jsonb 数组里,
-- 使用 jsonb_array_elements_text 展开 + 过滤 + 重新 jsonb_agg 回收.
UPDATE roles
SET permissions = COALESCE(
  (
    SELECT jsonb_agg(p)
    FROM jsonb_array_elements_text(permissions) AS p
    WHERE p NOT IN (
      'research:task_create',
      'research:task_view_own',
      'research:task_view_org',
      'research:task_export',
      'research:media_outlet_manage'
    )
  ),
  '[]'::jsonb
)
WHERE permissions ?| ARRAY[
  'research:task_create',
  'research:task_view_own',
  'research:task_view_org',
  'research:task_export',
  'research:media_outlet_manage'
];

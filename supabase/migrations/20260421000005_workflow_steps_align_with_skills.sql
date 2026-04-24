-- Align workflow_templates.steps skill metadata with the authoritative
-- `skills` table (2026-04-21).
--
-- Background
-- ----------
-- Workflow step definitions store `config.skillSlug`, `config.skillName`,
-- `config.skillCategory` redundantly so the UI doesn't need to look up the
-- skills table for every chip. That duplication drifts:
--   - 118 steps had `skillName` differing from skills.name (stale display text)
--   - 4 steps carried a deprecated `config.employeeSlug` left over from the
--     pre-B.1 scenario/employee binding model
--
-- Going forward the UI picker is driven by `skills` directly, so stored names
-- must agree with skills.name. This migration rewrites every step of type
-- 'skill' whose `skillSlug` exists in the skills table so its `skillName` and
-- `skillCategory` match skills.name / skills.category, and drops the two
-- deprecated employeeSlug fields.
--
-- Steps whose `skillSlug` is NULL/empty or points to a non-existent skill are
-- left untouched — manual cleanup is needed for those (currently 0). A guard
-- in server actions will reject new steps without a valid skillSlug.

BEGIN;

UPDATE workflow_templates wt
SET steps = rebuilt.steps
FROM (
  SELECT
    t.id,
    COALESCE(jsonb_agg(
      CASE
        WHEN s->>'type' = 'skill' AND sk.slug IS NOT NULL THEN
          -- Rebuild config with canonical name/category, stripping the
          -- deprecated employeeSlug key. Non-step or non-matching rows pass
          -- through unchanged.
          (s - 'employeeSlug') || jsonb_build_object(
            'config',
              ((s->'config') - 'employeeSlug')
                || jsonb_build_object(
                  'skillName', to_jsonb(sk.name),
                  'skillCategory', to_jsonb(sk.category::text)
                )
          )
        ELSE s
      END
      ORDER BY ord
    ), '[]'::jsonb) AS steps
  FROM workflow_templates t,
       LATERAL jsonb_array_elements(t.steps) WITH ORDINALITY AS elem(s, ord)
       LEFT JOIN skills sk ON sk.slug = s->'config'->>'skillSlug'
  WHERE t.steps IS NOT NULL
    AND jsonb_typeof(t.steps) = 'array'
  GROUP BY t.id
) AS rebuilt
WHERE wt.id = rebuilt.id;

COMMIT;

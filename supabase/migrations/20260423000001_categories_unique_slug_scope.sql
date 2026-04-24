-- Enforce (organization_id, slug, scope) uniqueness on categories.
-- Prevents non-idempotent seed runs from accumulating duplicate rows
-- that surface as repeated entries in 稿件管理 / 媒资栏目列表.
CREATE UNIQUE INDEX IF NOT EXISTS "categories_org_slug_scope_uniq"
  ON "categories" ("organization_id", "slug", "scope");

#!/bin/bash
# 验证 Sealos / 当前 DATABASE_URL 上的 schema 是否与代码 src/db/schema 同步。
# 每月跑一次,或迁数据库后跑一次。
#
# 用法:
#   ./scripts/verify-schema-sync.sh
#
# 输出: 列出 critical schema fingerprints 的实际状态。
#       OK = 已应用 / MISSING / STALE = 需要修复。

set -e

# 从 .env.local 拿 DATABASE_URL(取首条未注释的)
if [ -z "$DATABASE_URL" ] && [ -f ".env.local" ]; then
  DATABASE_URL=$(grep -E '^[[:space:]]*DATABASE_URL=' .env.local | head -1 | sed -E 's/^[[:space:]]*DATABASE_URL=//')
fi

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not set"
  exit 1
fi

# 拆 DSN 出来给 psql 用
DB_HOST=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:/]+).*|\1|')
DB_PORT=$(echo "$DATABASE_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
DB_USER=$(echo "$DATABASE_URL" | sed -E 's|.*//([^:]+):.*|\1|')
DB_PASS=$(echo "$DATABASE_URL" | sed -E 's|.*//[^:]+:([^@]+)@.*|\1|')
DB_NAME=$(echo "$DATABASE_URL" | sed -E 's|.*/([^?]+).*|\1|')

echo "=== Checking schema sync against $DB_HOST:$DB_PORT/$DB_NAME ==="

PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -F"|" <<'SQL'
-- 核心表存在
SELECT 'collected_items', CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='collected_items') THEN 'OK' ELSE 'MISSING' END;
SELECT 'collected_item_contents', CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='collected_item_contents') THEN 'OK' ELSE 'MISSING' END;
SELECT 'research_reports', CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='research_reports') THEN 'OK' ELSE 'MISSING' END;
SELECT 'workflow_templates', CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='workflow_templates') THEN 'OK' ELSE 'MISSING' END;

-- 关键字段
SELECT 'workflow_templates.is_featured', CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='workflow_templates' AND column_name='is_featured') THEN 'OK' ELSE 'MISSING' END;
SELECT 'missions.workflow_template_id', CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='missions' AND column_name='workflow_template_id') THEN 'OK' ELSE 'MISSING' END;
SELECT 'collected_items.category(text[])', CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='collected_items' AND column_name='category' AND data_type='ARRAY') THEN 'OK' ELSE 'WRONG TYPE' END;
SELECT 'collected_items.sentiment', CASE WHEN EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='collected_items' AND column_name='sentiment') THEN 'OK' ELSE 'MISSING' END;

-- 关键索引
SELECT 'idx_workflow_templates_owner_employee', CASE WHEN EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='idx_workflow_templates_owner_employee') THEN 'OK' ELSE 'MISSING' END;
SELECT 'idx_workflow_templates_featured', CASE WHEN EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='idx_workflow_templates_featured') THEN 'OK' ELSE 'MISSING' END;

-- 枚举值
SELECT 'workflow_category enum has advanced', CASE WHEN EXISTS(SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='workflow_category' AND e.enumlabel='advanced') THEN 'OK' ELSE 'MISSING' END;
SELECT 'artifact_type enum has cms_publication', CASE WHEN EXISTS(SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='artifact_type' AND e.enumlabel='cms_publication') THEN 'OK' ELSE 'MISSING' END;

-- V2 同题模块必备表（missed_topics 在 topic-compare-v2 重建为 v2 schema）
SELECT 'missed_topics exists', CASE WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='missed_topics') THEN 'OK' ELSE 'MISSING' END;
-- 废表应已删
SELECT 'platform_content dropped', CASE WHEN NOT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='platform_content') THEN 'OK' ELSE 'STALE' END;
SELECT 'research_tasks dropped', CASE WHEN NOT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='research_tasks') THEN 'OK' ELSE 'STALE' END;
SELECT 'app_channels dropped', CASE WHEN NOT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='app_channels') THEN 'OK' ELSE 'STALE' END;
SQL

echo ""
echo "=== Done. 任何非 OK 行需要修复 ==="

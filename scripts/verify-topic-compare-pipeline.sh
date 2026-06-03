#!/usr/bin/env bash
# 验证同题/漏题真数据管线状态
# 用法: bash scripts/verify-topic-compare-pipeline.sh

set -euo pipefail
cd "$(dirname "$0")/.."

DB_LINE="$(awk '/^[[:space:]]*DATABASE_URL=/ && !/^[[:space:]]*#/ {sub(/^[[:space:]]+/, ""); print; exit}' .env.local)"
eval "export $DB_LINE"

PSQL="${PSQL:-/opt/homebrew/opt/libpq/bin/psql}"

echo "=== Topic-Compare Pipeline Status ==="
"$PSQL" "$DATABASE_URL" -At -F"|" <<'SQL'
SELECT 'crawl-enabled my_accounts', COUNT(*) FROM my_accounts WHERE crawl_cron_enabled = true;
SELECT 'crawl-enabled benchmark_accounts', COUNT(*) FROM benchmark_accounts WHERE crawl_cron_enabled = true;
SELECT 'my_accounts crawled <24h', COUNT(*) FROM my_accounts WHERE crawl_cron_enabled = true AND last_crawled_at > NOW() - INTERVAL '24 hours';
SELECT 'benchmark_accounts crawled <24h', COUNT(*) FROM benchmark_accounts WHERE crawl_cron_enabled = true AND last_crawled_at > NOW() - INTERVAL '24 hours';
SELECT 'benchmark_posts <24h delta', COUNT(*) FROM benchmark_posts WHERE created_at > NOW() - INTERVAL '24 hours';
SELECT 'my_posts <24h delta', COUNT(*) FROM my_posts WHERE created_at > NOW() - INTERVAL '24 hours';
SELECT 'topic_matches <24h delta', COUNT(*) FROM topic_matches WHERE updated_at > NOW() - INTERVAL '24 hours';
SELECT 'missed_topics <24h delta', COUNT(*) FROM missed_topics WHERE created_at > NOW() - INTERVAL '24 hours';
SELECT 'zombie my_accounts (>7d no crawl)', COUNT(*) FROM my_accounts WHERE crawl_cron_enabled = true AND (last_crawled_at IS NULL OR last_crawled_at < NOW() - INTERVAL '7 days');
SELECT 'zombie benchmark_accounts (>7d no crawl)', COUNT(*) FROM benchmark_accounts WHERE crawl_cron_enabled = true AND (last_crawled_at IS NULL OR last_crawled_at < NOW() - INTERVAL '7 days');
SQL
echo ""
echo "=== Done ==="

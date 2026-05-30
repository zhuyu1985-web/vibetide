#!/usr/bin/env bash
# Vibetide 增量数据库 SQL 导出
#
# 策略：基于"上次全量"（MANIFEST.md 最后一行的 full 记录）的日期作为基线，
# 把 supabase/migrations/ 目录里"新增"的迁移文件按顺序拼接成增量 SQL；
# 若这些 migration 创建了新表，则追加这些新增表的 data-only dump。
#
# 这里"增量"不尝试导出既有表的行级变化，只补新增表当前数据。既有表数据
# 迁移仍走应用 API、专项迁移脚本，或新一份全量。Drizzle migration 文件
# 天然按时间戳/编号有序，且每个都 idempotent 友好（项目惯例：用
# IF NOT EXISTS / DO $$ BEGIN ... 包裹）。
#
# 用法：
#   ./scripts/db-export-incremental.sh                  # 自动版本号
#   ./scripts/db-export-incremental.sh 2026-05-20 v1    # 手动指定
#
# 产出：
#   backups/<DATE>-<VERSION>-incremental/incremental.sql  # migration + 新增表数据
#   backups/<DATE>-<VERSION>-incremental/README.md
#   backups/MANIFEST.md （追加一行）

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

MANIFEST="backups/MANIFEST.md"
if [[ ! -f "$MANIFEST" ]]; then
  echo "❌ 找不到 ${MANIFEST}，先跑一次全量导出" >&2
  exit 1
fi

# ---- 1. 计算 DATE / VERSION ----
DATE="${1:-$(date +%Y-%m-%d)}"
VERSION="${2:-}"
if [[ -z "$VERSION" ]]; then
  N=1
  while [[ -e "backups/${DATE}-v${N}-incremental" ]]; do
    N=$((N + 1))
  done
  VERSION="v${N}"
fi
OUT_DIR="backups/${DATE}-${VERSION}-incremental"
mkdir -p "$OUT_DIR"

# ---- 2. 找上次基线（MANIFEST 里最后一条 full 记录） ----
# MANIFEST 行格式：| 日期 | 版本 | 类型 | 文件 | 大小 | 孤儿剔除 | 备注 |
BASE_LINE="$(grep -E '^\| [0-9]{4}-[0-9]{2}-[0-9]{2} \|' "$MANIFEST" | grep ' full ' | tail -1)"
if [[ -z "$BASE_LINE" ]]; then
  echo "❌ MANIFEST 里没找到 full 类型基线" >&2
  exit 1
fi
BASE_DATE="$(echo "$BASE_LINE" | awk -F'|' '{gsub(/^ +| +$/,"",$2); print $2}')"
BASE_VERSION="$(echo "$BASE_LINE" | awk -F'|' '{gsub(/^ +| +$/,"",$3); print $3}')"
echo "👉 基线：${BASE_DATE} ${BASE_VERSION}"

# ---- 3. 找出"基线之后"的 migration 文件 ----
# Drizzle 自动生成的文件名前缀是 4 位数字（0000, 0001, ...）
# 手写的文件名前缀是 YYYYMMDD（如 20260505000001_xxx.sql）
# 我们用文件的 git 提交时间 vs 基线日期来比较。
BASE_EPOCH=$(date -j -f "%Y-%m-%d" "$BASE_DATE" +%s 2>/dev/null || date -d "$BASE_DATE" +%s)

INCLUDED=()
while IFS= read -r f; do
  # 用 git log 拿首次进入 main 的时间
  ts=$(git log --diff-filter=A --follow --format=%at -- "$f" 2>/dev/null | tail -1)
  if [[ -z "$ts" ]]; then
    # 未提交的本地新文件 → 强制包含
    INCLUDED+=("$f")
    continue
  fi
  if (( ts >= BASE_EPOCH )); then
    INCLUDED+=("$f")
  fi
done < <(ls supabase/migrations/*.sql 2>/dev/null | sort)

if [[ ${#INCLUDED[@]} -eq 0 ]]; then
  echo "ℹ️  自 ${BASE_DATE} 以来没有新增 migration 文件，无需增量"
  rm -rf "$OUT_DIR"
  exit 0
fi

echo "👉 检测到 ${#INCLUDED[@]} 个新 migration"
for f in "${INCLUDED[@]}"; do echo "    - $f"; done

# ---- 4. 检测新增表并导出其数据 ----
NEW_TABLES=()
while IFS= read -r table; do
  [[ -z "$table" ]] && continue
  if [[ ! "$table" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    echo "❌ 暂不支持导出非简单 identifier 的新增表名: ${table}" >&2
    exit 1
  fi

  exists=0
  if [[ ${#NEW_TABLES[@]} -gt 0 ]]; then
    for existing in "${NEW_TABLES[@]}"; do
      if [[ "$existing" == "$table" ]]; then
        exists=1
        break
      fi
    done
  fi
  if [[ "$exists" -eq 0 ]]; then
    NEW_TABLES+=("$table")
  fi
done < <(
  perl -ne '
    s/--.*$//;
    if (/^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?:"public"|public)\.)?(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))\s*\(/i) {
      print(($1 || $2) . "\n");
    }
  ' "${INCLUDED[@]}"
)

DATA_SQL=""
if [[ ${#NEW_TABLES[@]} -gt 0 ]]; then
  echo "👉 检测到 ${#NEW_TABLES[@]} 张新增表，导出这些表的数据"
  for t in "${NEW_TABLES[@]}"; do echo "    - public.${t}"; done

  if [[ ! -f .env.local ]]; then
    echo "❌ .env.local 不存在，无法导出新增表数据" >&2
    exit 1
  fi
  DB_LINE="$(awk '/^[[:space:]]*DATABASE_URL=/ && !/^[[:space:]]*#/ {sub(/^[[:space:]]+/, ""); print; exit}' .env.local)"
  if [[ -n "$DB_LINE" ]]; then
    eval "export $DB_LINE"
  fi
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "❌ DATABASE_URL 未设置，无法导出新增表数据" >&2
    exit 1
  fi

  PG_DUMP="${PG_DUMP:-/opt/homebrew/opt/libpq/bin/pg_dump}"
  if [[ ! -x "$PG_DUMP" ]]; then
    echo "❌ pg_dump 不存在: ${PG_DUMP}（brew install libpq 后导出 PG_DUMP 路径）" >&2
    exit 1
  fi

  DATA_SQL="$OUT_DIR/_new-table-data.sql"
  PG_DUMP_ARGS=(
    "$DATABASE_URL"
    --no-owner
    --no-acl
    --schema=public
    --quote-all-identifiers
    --data-only
    --format=plain
  )
  for t in "${NEW_TABLES[@]}"; do
    PG_DUMP_ARGS+=("--table=public.${t}")
  done
  PG_DUMP_ARGS+=(-f "$DATA_SQL")

  "$PG_DUMP" "${PG_DUMP_ARGS[@]}"
  echo "👉 新增表数据大小 $(du -h "$DATA_SQL" | cut -f1)"
else
  echo "👉 未检测到新增表，跳过数据导出"
fi

# ---- 5. 拼接增量 SQL ----
INC_SQL="$OUT_DIR/incremental.sql"
{
  cat <<EOF
-- ============================================================
-- Vibetide 增量数据库 SQL
-- Date     : ${DATE}
-- Version  : ${VERSION}
-- 基线     : ${BASE_DATE} ${BASE_VERSION} (full)
-- 包含     : ${#INCLUDED[@]} 个 migration
-- 新增表   : ${#NEW_TABLES[@]} 张（仅这些表会追加 data-only dump）
-- 注意     : 既有表的行级变化不在增量导出范围内
--
-- 在已经恢复了基线 full.sql 的目标库上执行：
--   psql "\$TARGET_DB_URL" -v ON_ERROR_STOP=1 -f incremental.sql
--
-- 多次执行安全性：依赖每个 migration 文件自身的 idempotency。
-- 项目惯例使用 IF NOT EXISTS / DO \$\$ ... \$\$，可重复执行。
-- ============================================================

BEGIN;
EOF
  for f in "${INCLUDED[@]}"; do
    echo ""
    echo "-- ============================================================"
    echo "-- migration: $f"
    echo "-- ============================================================"
    cat "$f"
    echo ""
  done
  if [[ -n "$DATA_SQL" && -s "$DATA_SQL" ]]; then
    echo ""
    echo "-- ============================================================"
    echo "-- 新增表数据"
    echo "-- ============================================================"
    cat "$DATA_SQL"
    echo ""
  fi
  echo "COMMIT;"
} > "$INC_SQL"
echo "👉 ${INC_SQL} 大小 $(du -h "$INC_SQL" | cut -f1)"

# ---- 6. README ----
cat > "$OUT_DIR/README.md" <<EOF
# Vibetide 增量 ${DATE} ${VERSION}

| 字段 | 值 |
|------|----|
| 基线全量 | ${BASE_DATE} ${BASE_VERSION} |
| 包含 migrations | ${#INCLUDED[@]} 个 |
| 新增表数据 | ${#NEW_TABLES[@]} 张 |
| 文件大小 | $(du -h "$INC_SQL" | cut -f1) |

## 包含的 migration

$(for f in "${INCLUDED[@]}"; do echo "- \`$f\`"; done)

## 追加数据的新增表

$(if [[ ${#NEW_TABLES[@]} -gt 0 ]]; then for t in "${NEW_TABLES[@]}"; do echo "- \`public.${t}\`"; done; else echo "- 无"; fi)

## 恢复

\`\`\`bash
# 目标库已经恢复了 ${BASE_DATE} ${BASE_VERSION} 的 full.sql 之后
psql "\$TARGET_DB_URL" -v ON_ERROR_STOP=1 -f incremental.sql
\`\`\`
EOF

# ---- 7. 追加 MANIFEST ----
SIZE_HUMAN=$(du -h "$INC_SQL" | cut -f1)
NOTE="基于 ${BASE_DATE} ${BASE_VERSION}，含 ${#INCLUDED[@]} migrations，新增表数据 ${#NEW_TABLES[@]} 张"
echo "| ${DATE} | ${VERSION} | incremental | ${OUT_DIR}/incremental.sql | ${SIZE_HUMAN} | — | ${NOTE} |" >> "$MANIFEST"

echo ""
echo "✅ 完成"
echo "   ${INC_SQL}"
echo "   ${OUT_DIR}/README.md"
echo "   ${MANIFEST} （已追加登记）"

#!/usr/bin/env bash
# Vibetide 全量数据库导出脚本
#
# 用法：
#   ./scripts/db-export-full.sh                 # 自动版本号（按当日 vN 递增）
#   ./scripts/db-export-full.sh 2026-05-12 v2   # 手动指定日期 + 版本
#
# 产出：
#   backups/<DATE>-<VERSION>/full.sql           # 干净全量（schema + data，已过滤孤儿行）
#   backups/<DATE>-<VERSION>/README.md          # 该版本恢复说明
#   backups/MANIFEST.md                         # 版本登记（追加一行）
#
# 故障模式回避：
#   pg_dump 默认会按字母序 COPY 数据，最后再 ADD CONSTRAINT FOREIGN KEY 校验。
#   如果源库存在孤儿行（child 指向已删除的 parent），最后 ADD CONSTRAINT 会
#   报 "violates foreign key constraint"。本脚本会先列出孤儿，再在导出 SQL
#   文件层面剔除这些行（不动源库）。

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# ---- 0. 读取 DATABASE_URL ----
if [[ ! -f .env.local ]]; then
  echo "❌ .env.local 不存在" >&2
  exit 1
fi
# shellcheck disable=SC1091
# 容忍前导空格 + 跳过注释行（用 awk 一步到位，避免 BSD grep 的 \s 兼容问题）
DB_LINE="$(awk '/^[[:space:]]*DATABASE_URL=/ && !/^[[:space:]]*#/ {sub(/^[[:space:]]+/, ""); print; exit}' .env.local)"
if [[ -n "$DB_LINE" ]]; then
  eval "export $DB_LINE"
fi
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ DATABASE_URL 未设置" >&2
  exit 1
fi

PG_DUMP="${PG_DUMP:-/opt/homebrew/opt/libpq/bin/pg_dump}"
PSQL="${PSQL:-/opt/homebrew/opt/libpq/bin/psql}"
if [[ ! -x "$PG_DUMP" ]]; then
  echo "❌ pg_dump 不存在: ${PG_DUMP}（brew install libpq 后导出 PG_DUMP 路径）" >&2
  exit 1
fi

# ---- 1. 计算 DATE / VERSION ----
DATE="${1:-$(date +%Y-%m-%d)}"
VERSION="${2:-}"
if [[ -z "$VERSION" ]]; then
  # 自动 v1, v2, ... 递增
  N=1
  while [[ -e "backups/${DATE}-v${N}" ]]; do
    N=$((N + 1))
  done
  VERSION="v${N}"
fi
OUT_DIR="backups/${DATE}-${VERSION}"
mkdir -p "$OUT_DIR"

echo "👉 导出到 $OUT_DIR"

# ---- 2. 探测孤儿行 ----
ORPHAN_LOG="$OUT_DIR/orphan-rows.log"
"$PSQL" "$DATABASE_URL" -At <<'SQL' > "$ORPHAN_LOG" || true
SELECT 'knowledge_items', id FROM public.knowledge_items ki
  WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_bases kb WHERE kb.id = ki.knowledge_base_id);
SELECT 'knowledge_sync_logs', id FROM public.knowledge_sync_logs ksl
  WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_bases kb WHERE kb.id = ksl.knowledge_base_id);
SELECT 'knowledge_relations', id FROM public.knowledge_relations kr
  WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_nodes kn WHERE kn.id = kr.source_node_id)
     OR NOT EXISTS (SELECT 1 FROM public.knowledge_nodes kn WHERE kn.id = kr.target_node_id);
SQL
ORPHAN_COUNT=$(wc -l < "$ORPHAN_LOG" | tr -d ' ')
echo "👉 检测到 ${ORPHAN_COUNT} 行孤儿数据（详见 ${ORPHAN_LOG}）"

# ---- 3. pg_dump 全量 ----
RAW_SQL="$OUT_DIR/_raw.sql"
echo "👉 pg_dump 中..."
"$PG_DUMP" "$DATABASE_URL" \
  --no-owner --no-acl --clean --if-exists \
  --schema=public --quote-all-identifiers \
  --format=plain \
  -f "$RAW_SQL"
echo "👉 pg_dump 完成，原始大小 $(du -h "$RAW_SQL" | cut -f1)"

# ---- 4. 后处理：从 COPY 块中剔除孤儿行 ----
# 用 awk 处理：遇到 COPY public."<table>" ... FROM stdin; 时，记录表名；
# 在 \. 结束前，逐行检查第 1 列（id, 由 \t 分隔），若 id ∈ 孤儿集，跳过。
CLEAN_SQL="$OUT_DIR/full.sql"
python3 - "$RAW_SQL" "$ORPHAN_LOG" "$CLEAN_SQL" <<'PY'
import re, sys, json

raw_path, orphan_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]

# 读孤儿行：{table: set(id)}
orphans = {}
with open(orphan_path, "r", encoding="utf-8") as f:
    for line in f:
        line = line.rstrip("\n")
        if not line: continue
        # 格式：table|id
        parts = line.split("|", 1)
        if len(parts) != 2: continue
        tbl, rid = parts
        orphans.setdefault(tbl, set()).add(rid)

copy_re = re.compile(r'^COPY\s+"?public"?\."?([a-z_0-9]+)"?\s*\([^)]*\)\s+FROM\s+stdin;\s*$', re.IGNORECASE)

with open(raw_path, "r", encoding="utf-8") as fin, open(out_path, "w", encoding="utf-8") as fout:
    in_copy = False
    current_tbl = None
    skipped = 0
    for line in fin:
        if not in_copy:
            m = copy_re.match(line)
            if m:
                current_tbl = m.group(1)
                in_copy = True
            fout.write(line)
            continue
        # in copy block
        if line.rstrip("\r\n") == "\\.":
            in_copy = False
            current_tbl = None
            fout.write(line)
            continue
        # 检查第一列 id
        first = line.split("\t", 1)[0]
        if current_tbl in orphans and first in orphans[current_tbl]:
            skipped += 1
            continue
        fout.write(line)
    sys.stderr.write(f"  ➜ python 后处理：剔除 {skipped} 行孤儿数据\n")
PY

# ---- 5. 在 full.sql 头部加版本元数据头 ----
META_HEADER="$OUT_DIR/_header.sql"
cat > "$META_HEADER" <<EOF
-- ============================================================
-- Vibetide 全量数据库导出
-- Date    : ${DATE}
-- Version : ${VERSION}
-- Source  : $(echo "$DATABASE_URL" | sed -E 's|://[^@]+@|://<REDACTED>@|')
-- Tool    : $($PG_DUMP --version)
-- Orphans : 已剔除 ${ORPHAN_COUNT} 行（详见 同目录 orphan-rows.log）
--
-- 恢复（推荐用 -v ON_ERROR_STOP=1 严格模式）：
--   psql "\$TARGET_DB_URL" -v ON_ERROR_STOP=1 -f full.sql
-- ============================================================

EOF
cat "$META_HEADER" "$CLEAN_SQL" > "$CLEAN_SQL.tmp" && mv "$CLEAN_SQL.tmp" "$CLEAN_SQL"
rm "$META_HEADER" "$RAW_SQL"
echo "👉 $CLEAN_SQL 大小 $(du -h "$CLEAN_SQL" | cut -f1)"

# ---- 6. 写 README ----
cat > "$OUT_DIR/README.md" <<EOF
# Vibetide 全量数据库 ${DATE} ${VERSION}

| 字段 | 值 |
|------|----|
| 导出时间 | $(date +"%Y-%m-%d %H:%M:%S %Z") |
| 数据源 | $(echo "$DATABASE_URL" | sed -E 's|://[^@]+@|://<REDACTED>@|') |
| pg_dump 版本 | $($PG_DUMP --version | head -1) |
| 剔除孤儿行 | ${ORPHAN_COUNT} |
| 文件大小 | $(du -h "$CLEAN_SQL" | cut -f1) |

## 恢复

\`\`\`bash
psql "\$TARGET_DB_URL" -v ON_ERROR_STOP=1 -f full.sql
\`\`\`

## 校验恢复后的孤儿行（应为 0）

\`\`\`sql
SELECT COUNT(*) FROM public.knowledge_items ki
  WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_bases kb WHERE kb.id = ki.knowledge_base_id);
SELECT COUNT(*) FROM public.knowledge_sync_logs ksl
  WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_bases kb WHERE kb.id = ksl.knowledge_base_id);
SELECT COUNT(*) FROM public.knowledge_relations kr
  WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_nodes kn WHERE kn.id = kr.source_node_id)
     OR NOT EXISTS (SELECT 1 FROM public.knowledge_nodes kn WHERE kn.id = kr.target_node_id);
\`\`\`
EOF

# ---- 7. 追加 MANIFEST ----
MANIFEST="backups/MANIFEST.md"
if [[ ! -f "$MANIFEST" ]]; then
  cat > "$MANIFEST" <<'MEOF'
# Vibetide 数据库导出登记表

每行登记一份全量或增量。**新增加在表底**。

| 日期 | 版本 | 类型 | 文件 | 大小 | 孤儿剔除 | 备注 |
|------|------|------|------|------|----------|------|
MEOF
fi
SIZE_HUMAN=$(du -h "$CLEAN_SQL" | cut -f1)
echo "| ${DATE} | ${VERSION} | full | ${OUT_DIR}/full.sql | ${SIZE_HUMAN} | ${ORPHAN_COUNT} | — |" >> "$MANIFEST"

echo ""
echo "✅ 完成"
echo "   $CLEAN_SQL"
echo "   $OUT_DIR/README.md"
echo "   $MANIFEST （已追加登记）"

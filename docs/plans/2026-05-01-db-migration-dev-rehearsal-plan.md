# 数据库迁出 Supabase · 开发环境演练计划

> **范围严格限定：只动开发环境**。生产 Supabase 实例完全不动。本次演练目的是**确认技术可行性**，把所有"切到自建/阿里云 RDS 之后会不会出 bug"的疑问消掉，**不**作为生产切换的依据。生产切换是另一个 plan。

- **日期：** 2026-05-01
- **owner：** zhuyu
- **预计净工时：** 半天（不含 RDS 申请审批等待）
- **预计基础设施成本：** 演练期 1-2 周，¥200-300（按需关停可降到 ¥50 以下）

---

## 0. 目标与非目标

**目标：**
1. 在新 PG 实例上完整跑一次：schema 创建 → 数据导入 → 应用启动 → 核心路径手测
2. 暴露所有"换 PG 提供商必然会出"的隐性依赖（pgbouncer 模式、扩展、连接字符串差异、连接池配额）
3. 形成生产迁移所需的 runbook 草稿（pg_dump/restore 时间、停机窗口估算、回滚步骤）

**非目标：**
- ❌ 不切换生产 `DATABASE_URL`
- ❌ 不停用 Supabase 账号
- ❌ 不迁移数据到 prod 的备用实例（本次只搭"演练 DB"）
- ❌ 不动 CI/CD 流水线（CI 仍打 Supabase）
- ❌ 不评估对客户私有部署的影响（独立议题）

---

## 1. 决策清单（开始前必须定）

需要你拍板的几个选项。**默认值已给出**，如无异议直接照默认走。

| 决策点 | 默认值 | 替代选项 | 备注 |
|---|---|---|---|
| **PG 提供商** | 阿里云 RDS for PostgreSQL | 腾讯云 / 华为云 / Neon / 自建 ECS | 看公司云资源池/折扣实际情况；演练阶段哪家便宜用哪家，生产再单独评估 |
| **PG 大版本** | 16 | 15 / 17 | Supabase 当前 15.x；同版本风险最低，迁回也方便 |
| **实例规格** | 共享型 1c2g（最小） | 独享 2c4g | 演练用最小够，¥120-150/月，按需付费可日均 ¥4-5 |
| **网络** | 公网（白名单本机 IP） | VPC 内网 | 演练简化；生产必须 VPC |
| **是否启用 RDS Proxy** | ❌ 不启用 | ✅ 启用 | 演练单连接够用；如果发现需要再加 |
| **数据迁移方式** | 方案 B（dump+restore，全量） | 方案 A（仅 schema + 重新 seed） | 见 §3 |
| **演练保留时长** | 2 周 | 1 个月 | 跑完销毁、留 backup snapshot |

---

## 2. Phase 1 — 新实例 provisioning（30 分钟，含等待）

### 2.1 阿里云控制台开 RDS（参考阿里云）

```
RDS → 创建实例
- 数据库类型：PostgreSQL
- 大版本：16
- 规格：pg.n2.micro.2c（1c2g）或类似最小档
- 存储：20 GB ESSD（演练够用）
- 计费：按量付费（用完释放）
- 网络：公网 + VPC（同时开）
- 区域：跟你最近的（北京/上海/杭州，看你常驻地）
```

### 2.2 创建账号 + 数据库 + 白名单

进入实例 → 账号管理：
```
账号名：vibetide_dev
密码：（强密码，记到 1Password）
权限：高权限账号
```

→ 数据库管理 → 创建：
```
数据库名：vibetide
字符集：UTF8
排序规则：C
Owner：vibetide_dev
```

→ 数据安全性 → 白名单 → 添加你本机出口 IP（`curl ifconfig.me` 确认）。

→ 连接信息 → 拷贝**外网连接地址**，组装 URL：

```
postgresql://vibetide_dev:<密码>@<外网地址>:5432/vibetide?sslmode=require
```

### 2.3 启用扩展

阿里云 RDS PG 默认不启用所有扩展，需要手动开。SSH/连接进 DB 跑：

```sql
-- 必需（项目已用）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Drizzle/Postgres 标准（通常默认有，确认下）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";    -- 如果有 uuid_generate_v4() 调用
CREATE EXTENSION IF NOT EXISTS pgcrypto;       -- 如果有 gen_random_uuid()（Drizzle defaultRandom 走这条）
```

> **验证：** `\dx` 应当看到 `pg_trgm` / `pgcrypto`。如果阿里云控制台有"扩展管理"GUI，先在那里勾选；裸 `CREATE EXTENSION` 阿里云 RDS 一般不支持非 SUPERUSER 调用，会报权限错。

---

## 3. Phase 2 — 数据迁移（30 分钟 - 2 小时，看数据量）

### 方案 A — 仅 schema + seed（快速、不保真）

适合：演练只想验证"代码跑得起来"，不在乎用户/历史数据。

```bash
# 切到新 DB env 运行 db:push
DATABASE_URL="postgresql://vibetide_dev:...@新实例:5432/vibetide?sslmode=require" \
  npm run db:push

# 跑 seed 重新填基础数据
DATABASE_URL="..." npm run db:seed
```

**用时：** 10 分钟。**问题：** 没有真实多租户/真实 user_profiles/真实 mission 历史，难发现"老数据 + 新代码"组合下的边界 bug。

### 方案 B — pg_dump 全量导（推荐）

适合：想真实演练一次切换流程，包括"prod 数据搬到新实例"的耗时基线。

#### Step 3.1：从 Supabase 导出

```bash
# 用 pooler 地址（跟你 .env.local 同步，但端口换 5432 直连而不是 6543 pgbouncer）
SUPABASE_URL="postgresql://postgres.rellwslwzfrwobvfwnuw:Hwasin19851122@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres"

mkdir -p /tmp/vibetide-migration
cd /tmp/vibetide-migration

# 不带 --create（避免 ROLE/数据库重建错误）；--no-owner --no-acl 跳过 supabase 内部权限映射
pg_dump "$SUPABASE_URL" \
  --no-owner \
  --no-acl \
  --schema=public \
  --exclude-schema=auth \
  --exclude-schema=storage \
  --exclude-schema=realtime \
  --exclude-schema=supabase_functions \
  --exclude-schema=vault \
  -Fc \
  -f vibetide-prod.dump

# 看下大小
ls -lh vibetide-prod.dump
```

**关键 flag 解释：**
- `-Fc`：custom format，比纯 SQL 快、可并行 restore
- `--exclude-schema=auth/storage/realtime/...`：Supabase 系统 schema 我们不要（即使空的也会带上元数据）
- `--no-owner --no-acl`：丢弃所有 `OWNER TO`、`GRANT` 语句，避免切到非 supabase 用户时报"role 不存在"

**用时估算：**
- < 100 MB：~1 分钟
- 100MB - 1GB：~5-15 分钟
- > 1GB：考虑用 `--jobs=4` 并行

#### Step 3.2：恢复到新实例

```bash
NEW_URL="postgresql://vibetide_dev:...@新实例:5432/vibetide?sslmode=require"

# 先把扩展手动建好（pg_dump 会带 CREATE EXTENSION，但阿里云 RDS 可能要在权限模式下跑）
psql "$NEW_URL" <<'EOF'
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
EOF

# 恢复
pg_restore "$NEW_URL" \
  --no-owner \
  --no-acl \
  --jobs=4 \
  --verbose \
  vibetide-prod.dump 2>&1 | tee restore.log

# 抓预期的报错
grep -iE "error|fatal" restore.log | grep -v "WARNING:" | head -20
```

**预期会看到（属正常）：**
- `extension "pg_trgm" already exists, skipping` — OK
- `language "plpgsql" already exists, skipping` — OK

**不正常的（需要处理）：**
- `permission denied` → 用的不是高权限账号
- `relation "auth.users" does not exist` → 应该被 `--exclude-schema=auth` 挡住，没挡住说明有跨 schema 引用，需要 grep `auth\.` in dump 查
- `extension "vector" is not available` → 你项目没用 pgvector，应该不出现

#### Step 3.3：抽样验证

```bash
psql "$NEW_URL" <<'EOF'
-- 表数量
SELECT count(*) AS table_count FROM information_schema.tables WHERE table_schema = 'public';
-- enum 数量
SELECT count(*) AS enum_count FROM pg_type WHERE typtype = 'e';
-- 几个核心表的行数
SELECT 'organizations' AS t, count(*) FROM organizations
UNION ALL SELECT 'user_profiles', count(*) FROM user_profiles
UNION ALL SELECT 'ai_employees', count(*) FROM ai_employees
UNION ALL SELECT 'missions', count(*) FROM missions
UNION ALL SELECT 'mission_tasks', count(*) FROM mission_tasks
UNION ALL SELECT 'workflow_templates', count(*) FROM workflow_templates;
EOF
```

跟 Supabase 上跑同样查询对比。**任意行数对不上就停下排查**（最常见原因：导出过程中 prod 仍在写）。

---

## 4. Phase 3 — 本地配置切换（10 分钟）

### 4.1 备份现有 .env.local

```bash
cp .env.local .env.local.supabase.bak
```

### 4.2 改 DATABASE_URL

编辑 `.env.local`，把 `DATABASE_URL` 那行改成新地址：

```bash
# 旧（注释保留）
#DATABASE_URL=postgresql://postgres.rellwslwzfrwobvfwnuw:...@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres
DATABASE_URL=postgresql://vibetide_dev:...@新实例:5432/vibetide?sslmode=require
```

### 4.3 调整 postgres 驱动选项（视情况）

打开 `src/db/index.ts:18-26`：

```ts
function createClient() {
  return postgres(process.env.DATABASE_URL!, {
    prepare: false,       // ← 阿里云 RDS 不走 pgbouncer transaction mode，可改 true（性能略好）
    connect_timeout: 30,  // ← 国内→新实例延迟低，可降到 10
    idle_timeout: 300,
    max: 2,               // ← 阿里云连接配额比 supabase pooler 宽松，可升到 5
    max_lifetime: 900,
  });
}
```

> **演练阶段先**保持 `prepare: false / max: 2` 不动，等"切完跑通"之后再单独 commit 调优。一次只改一个变量。

### 4.4 不要 commit

`.env.local` 已在 `.gitignore`。**不要把 vibetide_dev 的 DATABASE_URL 写到 .env.example 或任何会进 git 的文件**。

---

## 5. Phase 4 — 验证（30 分钟）

### 5.1 静态检查

```bash
npx tsc --noEmit
# 预期：0 errors
```

### 5.2 跑测试（连真 DB）

```bash
npm test
# 预期：57 files / 452 tests pass
# 集成测试会真连新 RDS——这一步是最有价值的烟雾测试
# 失败要看 stack trace，常见：
# - ECONNREFUSED → 白名单/sslmode 问题
# - relation "X" does not exist → restore 漏表
# - permission denied for schema → 账号权限不对
# - too many connections → 阿里云实例 max_connections 不够，需要升档
```

### 5.3 起 dev server

```bash
npm run dev
# 控制台应该看到 [dal/employees] auth=Xms, query=Yms 这种日志，Y 应该比 supabase 时低（国内→国内 vs 国内→新加坡）
```

### 5.4 浏览器手测核对

按这条路径走一遍：

1. `http://localhost:3000` → 跳到 `/login`
2. 用真实账号登录 → 进 `/home`
3. 左侧 sidebar 的所有 dashboard 入口（员工、灵感池、任务、媒资、工作流…）每一个点开，**只要不报错就过**——不需要每个都用一遍
4. 进 `/chat` → 发起一个场景任务（"深度新闻调研"或随便一个）
5. 看刚搞定的 mission stream：
   - 计划气泡 ✓
   - 步骤气泡按依赖顺序 running → completed ✓
   - **每步头像跟员工对应** ✓（这条是 Commit 2-da45329 修的核心 bug，迁移完容易回来）
   - 失败的话点"重试本步" toast 弹出 ✓
6. 进 `/missions/<某个mission>` 详情页 → 看任务列表/制品/聊天记录都正常加载

**手测时盯日志：**

```bash
# 另一个终端
tail -f .next/dev.log  # 如果你设了输出到文件，否则看 dev server 的控制台
```

任何 `Error: ...` / `TypeError: ...` / 慢查询（> 2s）都记下来。

### 5.5 Inngest 后台路径

dev server 起着的同时，去 `http://localhost:8288`（Inngest dev UI），看：
- 是否有 task ready/completed 事件流过
- 任务有没有触发 leader-plan / execute-mission-task 函数
- DB 写入是否到了新实例（去阿里云 RDS 控制台看 mission_tasks 行数增长）

---

## 6. Phase 5 — 性能 vs Supabase 对比（可选，30 分钟）

如果想顺便量一下性能差异：

```bash
# 跑两次 dev server，分别指向 supabase 和新 RDS，对比某个慢路径
# 比如 /chat 页面冷启动到第一个气泡出现的时间
```

记录指标（粗略即可）：

| 指标 | Supabase | 阿里云 RDS | Δ |
|---|---|---|---|
| `[dal/employees]` query 耗时（典型值） | ~150ms | 期望 ~30ms | 国内延迟优势 |
| dev server 冷启 → /home 渲完 | ? | ? | |
| 启动一个 mission 到 mission-init SSE 推到 | ? | ? | |

这些数字是生产迁移决策的输入。

---

## 7. Phase 6 — 回滚

如果演练发现致命问题（无法在合理时间内修复），回到 Supabase：

```bash
cp .env.local.supabase.bak .env.local
# 或手动把 DATABASE_URL 改回去
# 重启 dev server
```

新 RDS 实例可以保留几天调试，确认无用后释放（避免持续计费）。

**不需要清理任何 git/代码改动**——本次演练全程不动代码（除非 §4.3 调驱动选项，那是单独事项）。

---

## 8. 风险登记

| 风险 | 概率 | 后果 | 缓解 |
|---|---|---|---|
| pg_dump 漏导 schema-level 对象（trigger / function / sequence） | 中 | DAL 调用报错 | restore.log 里 grep `error`；抽样跑 §5.2 测试覆盖 |
| 阿里云 RDS 默认 `max_connections` 太小 | 低 | 多 dev server / Inngest 并发时连接耗尽 | 升档实例或调参；演练期 1-2 个进程不会触发 |
| 字符集/排序规则不匹配（zh_CN.UTF-8 vs C） | 低 | 中文 ORDER BY 顺序变化 | 创建库时用 `LC_COLLATE='C'`，跟 supabase 一致 |
| pg_trgm 索引在 restore 后未重建 | 中 | LIKE 'X%' 查询慢 | restore 完跑 `REINDEX SCHEMA public` |
| 阿里云 RDS 不允许 `CREATE EXTENSION` 直接执行 | 中 | 部分扩展用不上 | 用控制台/钉钉客服开权限或预装 |
| `pgcrypto` 缺失 → `gen_random_uuid()` 失败 | 高（第一次部署常见） | 所有 INSERT 失败 | §2.3 显式启用 |
| DEV 用账号权限太低 | 中 | restore 报 permission denied | 用高权限账号建库，应用层用普通账号 |

---

## 9. 演练报告模板（跑完填）

跑完后在本文件末尾追加一段：

```markdown
## 演练结果（YYYY-MM-DD）

- **新实例：** 阿里云 RDS PG 16 / 1c2g / xx 区
- **数据量：** prod dump xx MB → restore 用时 xx 分钟
- **测试：** 452/452 pass  / X 个 fail（具体见下）
- **手测：** 6/6 路径通过 / 列出未过的
- **性能对比：** Supabase 平均查询 X ms → 新实例 Y ms
- **遇到的坑：**
  1. ...
  2. ...
- **生产迁移可行性结论：** 可行 / 需先解决 X / 建议放弃
- **生产迁移所需新增工作：**
  1. ...
```

---

## 10. 与本演练 plan 无关、属于"生产迁移 plan" 的事项

提前列一下，免得演练中混进来：

- [ ] 生产实例规格、HA、备份策略、跨可用区部署
- [ ] 在线数据同步方案（pg_logical_repl / Aiven 自带 / 双写）
- [ ] 客户私有部署方案（OpenSpec 单独提案）
- [ ] CI/CD 改造（GitHub Actions 跑测试时连哪个 DB）
- [ ] Vercel 环境变量切换 + preview deployment 影响
- [ ] 监控/告警接入（CloudMonitor / Datadog / 自建 Prometheus）
- [ ] 数据加密、审计、合规（等保 2.0 / GDPR 看客户）
- [ ] Supabase 账号停用 / 数据销毁 SOP
- [ ] 回滚预案（生产）：保留 Supabase 实例 30 天 + 双写 7 天

这些是生产迁移正式 plan 该覆盖的，演练**不展开**。

---

## 11. 演练后的下一步

跑完后基于结果决定：

- ✅ 全绿 → 写"生产迁移 plan"（含上面 §10 全部内容），约 1-2 周准备 + 1 个停机窗口执行
- ⚠️ 部分坑 → 修复后再跑一次演练，成本同上
- ❌ 致命问题 → 回到 Supabase，记录 issue，3-6 个月后 Supabase 涨价/出问题再考虑

---

**结尾提醒：** 数据库迁移是高风险操作。演练阶段任何看不懂的报错都别"先继续看看"——停下、查、问。生产阶段则连"看不懂"都不允许出现，那时候必须**演练通过+回滚预案就位**双保险。

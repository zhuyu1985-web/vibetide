# Vibetide 数据库 Migration 工作流指南

> 目标读者：在本项目里写代码、改 schema、迁数据库的人。
> 看完你能回答：每个 `npm run db:*` 是干什么的、什么时候要手动跑、为什么有时 AI 助手让我跑、手写 SQL 安不安全、迁库要导出/恢复哪些文件。

---

## 1. 一句话总览

本项目 schema 的"唯一真相源"是 **`src/db/schema/*.ts`（Drizzle ORM 定义）**，DB 上的真实结构必须由这些 TypeScript 文件**推导**出来，**绝不**反过来。

Drizzle 把这套真相落到磁盘上靠两个东西：

| 东西 | 路径 | 作用 |
|------|------|------|
| **Migration SQL 文件** | `supabase/migrations/NNNN_xxx.sql` | 每次 schema 变更的"补丁"，按编号有序 |
| **Journal + Snapshot** | `supabase/migrations/meta/_journal.json` + `meta/NNNN_snapshot.json` | Drizzle 自己的"账本"，记录"目前演化到第 N 步、状态长这样" |

只要这三样（schema TS + migration SQL + journal）始终匹配，DB 就能完整重建。**所有问题，本质都是这三样的某一份失同步**。

---

## 2. 三种迁移命令的分工

> 这三个最常被搞混。先明确：它们解决的是**不同的问题**。

### 2.1 `npm run db:generate` —— 写代码后的"产出补丁"

| 项 | 内容 |
|---|---|
| 调用 | `drizzle-kit generate` |
| 输入 | `src/db/schema/*.ts`（你改完的 schema）+ `meta/` 里的"上一份 snapshot" |
| 输出 | `supabase/migrations/NNNN_xxx.sql` + `meta/NNNN_snapshot.json` + 追加一条 `_journal.json` 条目 |
| 是否动 DB | **不动**（只写文件） |
| 何时跑 | **每次改完 schema TS 之后**，提交代码前 |

工作机制：Drizzle 拿"上一份 snapshot"和"当前 schema TS"做 diff，差异翻译成 SQL DDL（`CREATE TABLE` / `ALTER TABLE` / `CREATE INDEX` / `CREATE TYPE` 等），同时把新状态的完整快照存成下一份 snapshot。这就是"为什么写完代码 SQL 会自动出来"的原因。

#### 关键事实
- **不会自动跑**。Drizzle 不监听你保存 schema TS。必须**手动**跑这一条。AI 助手让你跑，就是因为它没办法替你"想清楚改完了" —— 你才知道。
- 文件编号是顺序整数 `0000, 0001, 0002, …`，**编号自动递增**，不要手改。
- 命名后缀是 Drizzle 自动起的（如 `0043_equal_frank_castle.sql`），随机但稳定。
- 生成时如果出现"列改名 / 表改名"这类歧义，Drizzle 会进入**交互式提问**让你确认，**不要 pipe `echo` 进去**绕过。

### 2.2 `npm run db:migrate` —— 把已经存在的补丁"应用到 DB"

| 项 | 内容 |
|---|---|
| 调用 | `drizzle-kit migrate` |
| 输入 | `supabase/migrations/*.sql` + `_journal.json` + 目标 DB 里的 `drizzle.__drizzle_migrations` 表 |
| 输出 | 在 DB 上执行 SQL，并写一行到 `__drizzle_migrations` 表标记"已应用" |
| 是否动 DB | **会动**（严格按 journal 顺序） |
| 何时跑 | 部署、迁库、本地新克隆、CI |

工作机制：连到 DB，读 `__drizzle_migrations` 表知道"已经跑到第几号"，把缺的几个 SQL 文件**按 journal 顺序**依次执行，每跑成一个就在 `__drizzle_migrations` 里登记。已应用的不会重跑（按文件 hash 比较）。

#### 关键事实
- **天然幂等**（同一份 migration 不会被跑第二次）。
- 顺序由 **`_journal.json`** 而不是文件名字典序决定。journal 缺一条 → 那个 SQL 文件就被忽略，**这是手写 SQL 最容易漏跑的原因**（见 §4）。
- 通常**部署流水线里跑**；本地写代码时大多数情况用 `db:push` 更顺手（见下）。

### 2.3 `npm run db:push` —— "脏快路径"，直接对齐

| 项 | 内容 |
|---|---|
| 调用 | `drizzle-kit push` |
| 输入 | `src/db/schema/*.ts` + 目标 DB 当前真实结构 |
| 输出 | 立刻在 DB 上跑 DDL，让 DB 跟 schema TS 对齐 |
| 是否动 DB | **会动**（且**不产出**任何 migration SQL 文件！） |
| 何时跑 | 本地开发、原型探索 |

工作机制：跳过 migration 文件，直接 introspect DB → diff schema TS → 生成 SQL → 立即执行。

#### 关键事实
- **不留痕**。你 push 改了表，但不会有对应的 `.sql` 文件 — 队友拉代码看不到这次变更。**所以生产/共享环境不要用 `db:push`**。
- 本地"我快速试个想法"非常顺手，但**确认想法可行后必须改回 `db:generate` 走正规流程**。
- 涉及"列改名 / 表改名 / 列类型不兼容"时会触发交互式确认，跟 `db:generate` 类似。

### 2.4 `npm run db:seed` —— 喂数据，**和 schema 无关**

| 项 | 内容 |
|---|---|
| 调用 | `tsx src/db/seed.ts` |
| 输入 | DB（schema 必须先到位）+ 写死的初始数据 |
| 输出 | INSERT 一堆默认 org / 员工 / skill / 工作流模板 / mock 文章 |
| 是否动 DB | **会动数据，不动结构** |
| 何时跑 | 新建 DB、本地重置、新建 org 想要 builtin 数据 |

#### 关键事实
- **schema 不在位时跑会爆**。规则是：先 `db:migrate`（或 `db:push`）建结构，再 `db:seed` 灌数据。
- 项目里**还有多份按模块拆的 seed**：`db:seed:research` / `db:seed:mock-articles` / `db:cleanup-empty-workflows` 等。它们**互相独立**，按需跑。
- 大多数 seed 设计成**幂等**（如果该 org 已存在 builtin 模板就跳过/upsert），但请看脚本头部注释确认 —— 个别脚本是 destructive。

---

## 3. 典型场景的标准动作

### 3.1 我改完一个 schema TS 文件

```
1. npm run db:generate          # 写出 0044_xxx.sql + snapshot + journal
2. ls supabase/migrations/      # 肉眼检查新生成的 SQL，确认没异常
3. npm run db:migrate           # 应用到本地 DB
   # 或者本地开发期想跳过文件直接对齐：npm run db:push
4. bash scripts/verify-schema-sync.sh    # 确认 16 个 fingerprint 全 OK
5. git add src/db/schema supabase/migrations
6. git commit -m "feat(db): ..."
```

**为什么 AI 助手会让你"手动跑 db:generate"？**
因为 AI 不能保证它修改 `src/db/schema/*.ts` 之后你不会再继续改 —— 让你最后自己跑 `db:generate` 一次，确保**最终态**才被定格成 migration SQL。如果 AI 自动跑了再被你回手改两笔，就会出现"残留补丁文件没人需要"的脏状态。

### 3.2 我克隆下代码，本地没 DB

```
1. createdb / 启 Supabase docker / 用 Sealos 给的 DSN
2. 配 .env.local 里的 DATABASE_URL
3. npm run db:migrate           # 按 journal 顺序跑全部 0000..N
4. npm run db:seed              # 灌初始数据
5. bash scripts/verify-schema-sync.sh
```

### 3.3 我要把本地数据库迁到云上（或反过来）

走**全量 + 增量**导出（见 §5），**不要**靠 `db:migrate` 来迁数据（migrate 只迁结构，不搬数据）。

### 3.4 我只想刷新某个 seed 的内容

直接跑对应 `npm run db:seed:*`。schema 不动就不用碰 migration。

---

## 4. 手写 SQL 的边界与陷阱

### 4.1 标准纪律

**禁止**手工往 `supabase/migrations/` 扔 `YYYYMMDD_xxx.sql` 文件。原因：

- Drizzle 的 `_journal.json` 是它**自己维护**的账本，手写 SQL 不会被自动登记 → `db:migrate` 会**直接忽略**这个文件。
- 后果实战例子：本项目 2026-04 一批手写的 `20260421000002_*.sql` / `20260421000004_*.sql` 重建了 `missed_topics` 表，因为没进 journal，新克隆/重建的 DB 上**这张表根本不存在**，`/missing-topics` 页面进就 500。这是直到 2026-05-31 才被发现修复的真实事故（见 §6.1）。

### 4.2 真正需要手写 SQL 的两类场景

1. **数据迁移（结构 + 行级数据搬运）**。比如"把 column A 拆成 column B/C 并把存量数据按规则填入"。这种**写成临时 `scripts/migration-NNN.ts`** 跟 Drizzle 标准 migration **配合**使用：
   - Drizzle migration 负责加 B/C 列
   - 临时脚本负责回填数据
   - 完事后**不留**手写 SQL 文件

2. **极少数 Drizzle 表达不了的对象**（特殊 partial index、复杂 GIN 表达式、触发器、RLS policy）。这种**仍然走 `db:generate`** —— Drizzle 允许在 schema 里用 `sql\`...\`` 写裸 SQL，让 generate 把它当作正常 migration 产出。

### 4.3 已经手写了，怎么收尾

两条路二选一：

- **A. 标准化收编**：把手写 SQL 的"等价效果"翻译进 `src/db/schema/*.ts`，跑 `db:generate` 让 Drizzle 写一份**正规**的 0NNN_xxx.sql + snapshot + journal 条目，然后**删掉原手写文件**。
- **B. 强行打进 journal**：在 `_journal.json` 末尾追加一条对应 `tag` 字段，让 `db:migrate` 把它当作"已知 migration"。**不推荐** —— 这会让 snapshot 跟 journal 对不上，后续 `db:generate` 会反复弹 drift 提示。

不管哪条，处理完务必跑 `bash scripts/verify-schema-sync.sh` 验证。

### 4.4 AI 能识别我手写的 SQL 吗

**不能完全**。AI（包括我）拿到的视野是：

- 能看到 `supabase/migrations/` 里的文件清单 → 能"知道有这个 SQL 存在"
- 但**不会**自动判断它有没有被 `db:migrate` 应用过（除非主动去查 `__drizzle_migrations` 表或 journal）
- 也不会**自动**把它纳入下一次 `db:generate` 的考量 —— 如果你手写了 `CREATE TABLE foo`，但没写进 schema TS，`db:generate` 还是会以"foo 不该存在"为前提算 diff，**输出一个 DROP TABLE foo** 的 migration。

所以**唯一稳的做法**：手写 SQL 之后立刻把对应改动同步进 schema TS（§4.3 路 A）。

---

## 5. 迁库 / 备份 / 恢复 —— 三个真正"工程级"的脚本

> 这部分跟 Drizzle migration **是两套独立机制**。Drizzle 管"schema 演化"，下面这套管"完整数据库快照 + 增量 + 恢复"。

### 5.1 总览

| 脚本 | 角色 |
|---|---|
| `./scripts/db-export-full.sh` | **全量**：当前 DB 的 schema + data 整体导出 |
| `./scripts/db-export-incremental.sh` | **增量**：从"上次全量"以来新增的 migration + 新表数据 |
| `psql ... -f full.sql` | **恢复**：把上面任一份导出灌到目标 DB |

输出统一进 `backups/<日期>-<vN>[-incremental]/`，登记在 `backups/MANIFEST.md`（每行一条全量或增量）。

### 5.2 全量导出 `db-export-full.sh`

```bash
./scripts/db-export-full.sh                 # 自动 v1 / v2 / ... 递增
./scripts/db-export-full.sh 2026-05-12 v2   # 手动指定 DATE + VERSION
```

执行链路（脚本里 7 步，编号跟文件里一致）：

1. **读 `.env.local` 的 DATABASE_URL** —— 跳过注释行，取首条未注释的。
2. **探测孤儿行**（child 指向已删除 parent）—— 用一组 SQL 查 `knowledge_items` / `knowledge_sync_logs` / `knowledge_relations` 等，把"指向不存在 parent 的 id"列到 `orphan-rows.log`。
3. **`pg_dump` 全量** —— `--clean --if-exists --schema=public --quote-all-identifiers --format=plain`，输出到 `_raw.sql`。
4. **后处理过滤孤儿** —— 用 Python 扫 `_raw.sql`，遇到 `COPY public."<table>" FROM stdin;` 就检查首列 id，命中孤儿 set 就跳过这行。**注意：只动导出文件，源库不动**。
5. **加 metadata header** —— 在 `full.sql` 顶部写一段注释，记导出时间、数据源（密码已 redact）、pg_dump 版本、孤儿数。
6. **写 `README.md`** —— 单份备份的恢复说明 + 孤儿校验 SQL。
7. **追加 `MANIFEST.md`** —— 一行登记表，下次增量靠它找基线。

为什么这么麻烦？因为 `pg_dump` 默认按字母序 COPY 数据，最后才 `ADD CONSTRAINT FOREIGN KEY`。一旦源库有孤儿，恢复时**最后这一步会爆 violates foreign key**。脚本提前在 SQL 文件层面剔除，**不需要清理源库**就能保证恢复成功。

### 5.3 增量导出 `db-export-incremental.sh`

```bash
./scripts/db-export-incremental.sh                  # 自动版本号
./scripts/db-export-incremental.sh 2026-05-20 v1    # 手动
```

执行链路（脚本里 7 步）：

1. **读 MANIFEST 找基线** —— 反向找最后一条 `full` 记录，取 `BASE_DATE`。
2. **筛 migration 文件** —— 列出 `supabase/migrations/*.sql`，用 `git log` 拿每个文件"首次进 main"的时间戳，**晚于** BASE_DATE 的全收。**未提交的本地新文件**也强制纳入。
3. **检测新增表** —— 用 perl 扫这批 migration 里的 `CREATE TABLE` 语句，拿到表名列表。
4. **对新增表 data-only dump** —— `pg_dump --data-only --table=public.<t>` 把新表数据导出来。
5. **拼接 `incremental.sql`** —— 顺序是：header → `BEGIN;` → 每个 migration 文件全文（按 ls 排序）→ 新表数据 → `COMMIT;`。**整个增量是一个事务**。
6. **写 `README.md`** —— 列基线、含哪些 migration、新增哪些表。
7. **追加 MANIFEST**。

#### 设计取舍

- **不导出既有表的行级变化**。"老表新增了几万行业务数据"不在增量范围里 —— 这种情况要么走全量、要么走应用层数据同步脚本。**所以增量是"补结构 + 新表数据"，不是"补任意业务数据"**。
- 多次执行安全靠**每个 migration 文件自己的 idempotency**。项目惯例 `CREATE TABLE IF NOT EXISTS` / `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object`，所以增量 SQL 在已应用过部分 migration 的目标库上可重复跑。

### 5.4 恢复

```bash
# 全量恢复（目标库可以是空库或要被覆盖的库）
psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -f backups/2026-05-30-v1/full.sql

# 增量恢复（目标库必须先恢复了对应基线的 full）
psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -f backups/2026-05-30-v2-incremental/incremental.sql
```

关键参数：

- **`-v ON_ERROR_STOP=1`** —— 任何一条 SQL 失败立刻终止，不再继续往下跑。**必加**，否则会出现"前面 50 个语句报错你都没看见，结果库一半新一半旧"。
- 全量 SQL 里头部已经 `--clean --if-exists` 会先 DROP 再 CREATE，**目标库会被清掉同名 public schema 对象**。生产数据库恢复前请二次确认。

### 5.5 何时跑全量 vs 增量

| 场景 | 推荐 |
|---|---|
| 准备做大改动，需要"反悔点" | **全量** |
| 把本地小改动同步到另一台 dev 机 | **增量** |
| 准备 demo 给客户，要带最新业务数据 | **全量** |
| 上线前给运维一份 "从上次部署以来" | **增量** |
| 新环境冷启动 | **全量** + 后续累计的所有**增量**按顺序灌 |

---

## 6. 真实事故案例（背景知识，看了少踩坑）

### 6.1 `missed_topics` 隐身事故（2026-04 → 2026-05-31）

**症状**：`/missing-topics` 页面进去 500，报 `relation "missed_topics" does not exist`。

**根因**：
- 2026-04-21 的两个手写 SQL `20260421000002_*.sql` / `20260421000004_*.sql` 在 v2 同题模块里重建了 `missed_topics`，但**没进 `_journal.json`**。
- 任何之后克隆/迁建的 DB 跑 `db:migrate` 都会**跳过**这两个文件 → 表不存在。
- 雪上加霜：`scripts/verify-schema-sync.sh` 还把 `missed_topics` 列为"废表应已删 = OK"，掩盖了 drift 一个多月。

**教训**：
1. 手写 SQL 必须走 §4.3 收编，否则迁库必漏。
2. fingerprint 验证脚本要跟 schema 同步演化，废表变回有效表时必须翻转检查方向。

### 6.2 手写 SQL 与 `db:generate` 互相 stomp

如果你手写 SQL 加了一张 `CREATE TABLE foo`，但忘了同步 schema TS，下次别人跑 `db:generate` 会产出一份 `DROP TABLE foo`（因为 Drizzle 觉得"foo 不该存在"）。在 review 时如果没看出来，merge 进去就是数据丢失事故。

**防御**：永远 schema-first，TS 改完再 generate，**不要 SQL-first**。

---

## 7. 常见问题速查

**Q: 为什么 AI 助手让我跑 `db:generate`，不能自动跑？**
A: 它没法判断你 schema 改完了没。让你自己跑能避免"AI 提前出 migration → 你又改两笔 → 多一份没用的补丁文件"。

**Q: 为什么有时候让我跑 `db:push`，有时候让我跑 `db:migrate`？**
A: `db:push` 适合本地一次性对齐（不留 migration 文件）；`db:migrate` 适合"已经有 migration 文件，把它应用到 DB"。本次 `missed_topics` 修复选了直接 `CREATE TABLE` 而不是 `db:push`，是因为 V2 表已经存在，只缺一张表，`db:push` 会触发它对整库做一遍 diff、有可能误改其他表。

**Q: 我能不能直接 `psql` 改 schema？**
A: 紧急止血可以（救火允许），但**事后必须**回头补一笔 schema TS 改动 + `db:generate`，让 journal 跟生产对齐。否则下次部署 `db:migrate` 会把你紧急改的东西**还原**。

**Q: `_journal.json` 我能手改吗？**
A: 99% 不要。它跟 `meta/NNNN_snapshot.json` 是一对，乱改会让 `db:generate` / `db:migrate` 都报错。唯一合法场景是 §4.3 路 B（强行打进 journal），且必须同时给出配对 snapshot —— 绝大多数情况下你不需要也不应该走这条。

**Q: 我重置了本地 DB，要按顺序跑 `supabase/migrations/` 里所有 SQL 吗？**
A: 不要手工 `psql -f` 跑。**用 `npm run db:migrate`** —— 它会按 journal 顺序、做 hash 校验、登记到 `__drizzle_migrations`，比手工跑稳得多。

**Q: 我同事拉了我的代码，跑 `db:migrate` 报"snapshot mismatch"怎么办？**
A: 通常是你只 commit 了 `src/db/schema/` 没 commit `supabase/migrations/`（或反过来）。让他拉完整代码，确保 `meta/` 目录里的 snapshot 和 journal 都齐了再跑。

**Q: 备份太大（几百 MB）能直接进 git 吗？**
A: 不要。`backups/` 应该在 `.gitignore` 里或单独传给运维。MANIFEST.md 可以进 git 当作"备份清单"。

---

## 8. 决策树速查

```
我改了 schema TS
  └─ npm run db:generate           # 产 SQL 补丁
     └─ git add 必须包含 supabase/migrations/ 整个目录
        └─ 本地验证：npm run db:migrate / db:push
           └─ bash scripts/verify-schema-sync.sh   # 16 个 fingerprint 全 OK

我要迁数据库 / 给同事一份数据
  └─ ./scripts/db-export-full.sh           # 全量
     └─ psql ... -v ON_ERROR_STOP=1 -f backups/<日期>/full.sql

我做完一次小改动，只想同步 schema 演化
  └─ ./scripts/db-export-incremental.sh    # 增量
     └─ 目标库先有对应 full → psql ... -f incremental.sql

我刚拉代码 / 新建本地环境
  └─ npm run db:migrate
     └─ npm run db:seed

我紧急在 prod 上 psql 改了一笔
  └─ 立刻反向更新 src/db/schema/*.ts
     └─ npm run db:generate   # 让 journal 追上 prod
        └─ commit + push
```

---

## 9. 参考

- Drizzle 官方文档：<https://orm.drizzle.team/docs/migrations>
- 项目内 ADR：`docs/adr/`
- Schema 验证脚本：`scripts/verify-schema-sync.sh`
- Migration journal：`supabase/migrations/meta/_journal.json`
- Backup 登记：`backups/MANIFEST.md`
- `CLAUDE.md` §"Schema Migration 规范" —— 同一份纪律的简版（这份文档是它的展开版）

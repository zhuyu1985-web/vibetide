# 同题竞对 / 漏题分析 真数据升级设计

> **日期：** 2026-06-03
> **状态：** 已确认（brainstorming 阶段定稿，待 plan）
> **范围：** 后端数据链路 + Inngest 调度；**UI 不动**
> **相关 ADR：** —
> **前置依赖：** `2026-04-17-benchmarking-redesign-design.md`（UX 已完成）、Collection Hub（TikHub adapter 已落地）、`accountAnalyticsCrawlCron`（my_accounts cron 已跑）

---

## 1. 背景与现状

### 1.1 用户诉求

同题竞对（`/topic-compare`）和漏题分析（`/missing-topics`）两个模块当前展示的还是 seed 写死的演示数据，无法支撑真实运营场景。用户希望升级为基于 **TikHub API** 抓取的真实账号 + 真实传播数据，并完成测试联调及验证。

### 1.2 调研结论（关键事实）

| 项 | 状态 |
|---|---|
| 同题 DAL `listTopicCompareItems` / `getTopicCompareDetail` | ✅ 直接查 DB，**不是 mock**（`src/lib/dal/topic-compare.ts:44-406`） |
| 漏题 DAL `listMissingTopics` / `getMissingTopicKpis` | ✅ 直接查 DB（`src/lib/dal/missing-topics.ts:45-329`） |
| TikHub 适配器（5 平台 keyword + 4 平台 account） | ✅ 已落地（`src/lib/collection/adapters/tikhub/`） |
| `accountAnalyticsCrawlCron` 每天 05:00 SH 抓 my_accounts | ✅ 已跑（`src/inngest/functions/account-analytics/crawl-cron.ts`） |
| 抓取数据落 `collected_items` | ✅ 已落 |
| **`collected_items` → `benchmark_posts` / `my_posts` sync** | ❌ **断点 #1** |
| **`benchmark_accounts` 纳入 cron** | ❌ **断点 #2**（`crawlCronEnabled` 字段在，cron 没扫） |
| 同题匹配算法 `findSameTopicMatches` | ✅ 已实现（关键词召回 + LLM 判定 + 2h 缓存，`src/lib/topic-matching/find-matches.ts`） |
| **新 my_post 自动触发同题匹配** | ❌ **断点 #3** |
| 漏题检测算法 `detectMissedTopicsForOrg` | ✅ 已实现（`src/lib/topic-matching/missed-topic-finder.ts`） |
| **漏题检测每日自动运行** | ❌ **断点 #4** |

**核心诊断：所有算法和适配能力都现成，只缺四段管线接线**。UI / DAL / 表结构都不动。

### 1.3 问题边界（非目标）

本设计**不**做以下事情：

- ❌ 改 UI（漏题 / 同题前端已经在查真 DB，自然受益）
- ❌ 新增/替换分析算法（`findSameTopicMatches` / `detectMissedTopicsForOrg` 保持原样）
- ❌ 扩展平台覆盖到 TikHub account 模式不支持的平台（小红书/视频号/B 站/头条/快报等留后续 spec）
- ❌ keyword search 前置发现（漏题分析仍是"对标账号已发 - 我方未发"反推，不引入"主题字典扫全网"路线）
- ❌ 引入 stats 时间序列（不做 views 演化趋势分析）
- ❌ 新增邮件/钉钉告警、Prometheus metrics、SLO 看板

---

## 2. 用户决策回顾

brainstorming 阶段已锁定的 4 个关键决策：

| Q | 决策 | 理由 |
|---|---|---|
| my_posts 数据源 | **TikHub Account 模式回抓**（用户场景 B：我方账号在外部平台上的真实表现）；articles 表（智能体稿件库）拿不到外部传播数据 | 拿传播数据是核心痛点 |
| 升级范围 | **范围 B**：全自动管线（sync + 自动 topic_match + daily missed_topic） | A 留太多手动按钮没人点；C 的 keyword 字典是新维护负担 |
| 平台覆盖 | **范围 A**：仅 TikHub account 模式支持的 4 个平台（抖音 / 微博 / 快手 / 微信公众号），其他平台 v2 再扩 | 先把主链路打稳比覆盖宽重要 |
| 回填 + 刷新策略 | **B + Y**：toggle 开启时单次回填最近 30 条；每日全量 upsert 最近 30 条（stats 滚动新鲜，旧帖也跟刷） | 第一天就有数据看；views 演化跟得到 |

---

## 3. 架构

### 3.1 总览

```
┌─ Daily 05:00 SH ─────────────────────────────────────────────────┐
│  accountAnalyticsCrawlCron (扩展)                                 │
│   ├─ scan my_accounts WHERE crawlCronEnabled=true (已有)          │
│   └─ scan benchmark_accounts WHERE crawlCronEnabled=true (★NEW)   │
│       (含 organization_id IS NULL 的全局 preset 对标账号)          │
│   过滤平台 ∈ {douyin, weibo, kuaishou, wechat_mp}                 │
│   ↓                                                              │
│   ensureTikHubAccountSource(...) 复用 (已有)                       │
│   ↓                                                              │
│   collection/source.run-requested × N                            │
│   ↓ TikHub adapter (account 模式) → collected_items (已有)         │
└──────────────────────────────────────────────────────────────────┘

┌─ Sync 层 (★NEW) ──────────────────────────────────────────────────┐
│  Inngest fn: topicCompareSyncFromCollection                      │
│   ↑ collection/run.completed                                     │
│   1. 读 run 的 collected_items                                    │
│   2. 看 source binding 指向 my_account 还是 benchmark_account      │
│   3. benchmark: upsert benchmark_posts                            │
│   4. my:      upsert my_posts + my_post_distributions             │
│   5. newMyPostIds → 派 topic-compare/my-post.created               │
└──────────────────────────────────────────────────────────────────┘

┌─ topic_match 接线 (★NEW) ─────────────────────────────────────────┐
│  Inngest fn: topicCompareFindMatchesOnNew                         │
│   ↑ topic-compare/my-post.created (concurrency=4)                 │
│   findSameTopicMatches({orgId, myPostId})  (现有算法,2h 缓存)      │
└──────────────────────────────────────────────────────────────────┘

┌─ Daily 06:00 SH (★NEW) ───────────────────────────────────────────┐
│  Inngest cron: missedTopicDetectionDaily                          │
│   for each org with enabled benchmark_account (concurrency=2):    │
│     detectMissedTopicsForOrg({orgId, sinceDays:14})  (现有算法)    │
└──────────────────────────────────────────────────────────────────┘

┌─ Cold-start backfill (★NEW) ──────────────────────────────────────┐
│  Server action: toggle crawlCronEnabled=true → 派 backfill event  │
│  topicCompareBackfill (concurrency=2, 退避)                        │
│   ├─ ensureTikHubAccountSource(...)                               │
│   ├─ 直接调 TikHub 一次(最近 30 条),不走完整 collection_runs       │
│   └─ 喂给 sync 纯函数                                              │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 关键设计点

- **不新建表**。复用 `collected_items`（抓取层）+ `benchmark_posts` / `my_posts` / `my_post_distributions`（分析层），sync function 是桥
- **不动 UI 与 DAL**。前端 / DAL 已查真表，DB 有数据立刻活
- **dedup 键**：`benchmark_posts(account_id, source_url)` / `my_posts(org, content_fingerprint)` / `my_post_distributions(post_id, my_account_id)`。新加/升级 2 个 unique constraint
- **传播数据滚动新鲜**：每日全量 upsert 最近 30 条，upsert 只刷 stats，不动 `created_at`，旧帖也能持续看到 views 演化
- **2h LLM 缓存防雪崩**：sync 触发的 find-matches 命中 `topicMatches.expiresAt` 内就 skip，只有新帖真跑 LLM

---

## 4. 组件清单

### 4.1 新建（5 个文件）

| 文件 | 用途 | 体量 |
|---|---|---|
| `src/lib/topic-compare/sync-collected.ts` | 纯函数 sync 层：输入 `collectedItems[]` + source binding，输出 `{benchmarkPostsUpserted, myPostsUpserted, distributionsUpserted, newMyPostIds[], parseFailed}` | ~180 行 |
| `src/lib/topic-compare/backfill.ts` | 单账号 backfill：调 TikHub adapter → 喂给 sync 层 → 返回统计 | ~80 行 |
| `src/inngest/functions/topic-compare/sync-on-run-completed.ts` | Inngest fn，监听 `collection/run.completed`，按 source binding 分流到 sync 层 | ~100 行 |
| `src/inngest/functions/topic-compare/find-matches-on-new-mypost.ts` | Inngest fn，监听 `topic-compare/my-post.created`，调 `findSameTopicMatches`（concurrency=4） | ~50 行 |
| `src/inngest/functions/topic-compare/missed-topic-cron.ts` | Inngest cron（06:00 SH），遍历有启用账号的 org，调 `detectMissedTopicsForOrg` | ~60 行 |

### 4.2 修改（5 个文件）

| 文件 | 改动 |
|---|---|
| `src/inngest/functions/account-analytics/crawl-cron.ts` | 扩展循环：扫 `benchmark_accounts WHERE crawlCronEnabled=true AND (organization_id IS NULL OR organization_id=?)`。复用 `ensureTikHubAccountSource` |
| `src/inngest/events.ts` | 加 3 个 event 类型（见 §5.1） |
| `src/inngest/functions/index.ts` | 注册 3 个新函数 |
| `src/app/actions/<my-or-benchmark-account-management>.ts` | toggle `crawlCronEnabled` 时，true 派 `topic-compare/backfill.requested`，false 不做事 |
| `src/db/schema/topic-compare-v2.ts` | 加 unique constraint：① `benchmark_posts(benchmark_account_id, source_url)` ② `my_posts(organization_id, content_fingerprint)` 从 index 升级为 unique。`my_post_distributions` 已有 unique，不动 |

### 4.3 平台护栏

新增常量 `TIKHUB_ACCOUNT_SUPPORTED_PLATFORMS = ['douyin','weibo','kuaishou','wechat_mp']`：

- `crawl-cron` 启动前过滤，账号 platform 不在列表里直接 skip + step.run log "skipped: platform not in TikHub account mode"
- backfill fn 同样过滤
- UI 上 toggle 旁应标"仅 4 平台可开"（**plan 阶段决定是否合并到本次范围**）

### 4.4 Migration

走 CLAUDE.md §Schema Migration 规范的标准流程：

```bash
# 改 src/db/schema/topic-compare-v2.ts 加 unique constraint
npm run db:generate    # 产 0044_xxx.sql + snapshot
npm run db:migrate
bash scripts/verify-schema-sync.sh
```

⚠️ `my_posts(org, fingerprint)` 从普通 index 升级为 unique，**若 DB 现有重复 fingerprint 会失败**。precheck：

```bash
npx tsx scripts/precheck-my-posts-fingerprint-dupes.ts
# 列出冲突 (org, fingerprint)，运营手工合并或 scripts/merge-duplicate-my-posts.ts 处理
```

---

## 5. 数据流与事件契约

### 5.1 新增 Inngest events

```ts
"topic-compare/my-post.created": {
  data: {
    organizationId: string;
    myPostId: string;
    contentFingerprint: string;
    source: "sync" | "backfill" | "manual";
  };
};

"topic-compare/backfill.requested": {
  data: {
    organizationId: string;
    accountKind: "my" | "benchmark";
    accountId: string;
    triggeredBy: "toggle" | "admin-script";
    triggeredByUserId: string | null;
  };
};

"topic-compare/missed-topic-detection.triggered": {
  data: {
    organizationId: string;
    sinceDays: number;
    triggeredBy: "daily-cron" | "manual";
  };
};
```

### 5.2 Flow A — Daily cron 链路

1. **05:00 SH** `accountAnalyticsCrawlCron` 扫 my + benchmark accounts（`crawlCronEnabled=true`）
2. 过滤平台白名单
3. `ensureTikHubAccountSource` 为每个账号准备 source
4. 派 `collection/source.run-requested` × N
5. TikHub adapter 跑 → `collected_items` 落表 → 派 `collection/run.completed`
6. `topicCompareSyncFromCollection` 消费：
   - load `collected_items WHERE run_id=...`
   - 看 source binding
   - benchmark 侧：`db.insert(benchmarkPosts).onConflictDoUpdate({target:[account_id,source_url], set:{views,likes,...}})`
   - my 侧：upsert `my_posts`（拿 `my_post_id`）+ upsert `my_post_distributions`，新 my_post 加到 `newMyPostIds[]`
   - 对每个 new my_post 派 `topic-compare/my-post.created`
7. `topicCompareFindMatchesOnNew` 并发消费（concurrency=4）：调 `findSameTopicMatches` upsert `topic_matches`

### 5.3 Flow B — Backfill on toggle

1. UI / 脚本 toggle `crawlCronEnabled=false→true`
2. Server action update DB + 派 `topic-compare/backfill.requested`
3. `topicCompareBackfill` 消费（concurrency=2）：
   - `ensureTikHubAccountSource(accountId)`
   - 同步调 TikHub 一次（最近 30 条），不走完整 `collection_runs`
   - 直接喂 sync 纯函数
   - 写一行 audit log

### 5.4 Flow C — Missed topic daily

1. **06:00 SH** Inngest cron
2. `db.select distinct organization_id` from `benchmark_accounts` + `my_accounts` where `crawlCronEnabled=true`
3. 对每个 org（concurrency=2）：`detectMissedTopicsForOrg({orgId, sinceDays:14})`，step output 记 `{scanned, created, covered}`
4. 出错 org 不阻塞下一个

### 5.5 Dedup / Idempotency 矩阵

| 表 | unique key | 重跑同一 cron 的语义 |
|---|---|---|
| `collected_items` | 已有 `(source_id, external_id)` | 老帖 update，新帖 insert |
| `benchmark_posts` | ★新加 `(benchmark_account_id, source_url)` | views/likes 刷新，`created_at` 不动 |
| `my_posts` | ★升级为 unique `(organization_id, content_fingerprint)` | 同上 |
| `my_post_distributions` | 已有 `(my_post_id, my_account_id)` | stats 刷新 |
| `topic_matches` | 已有 `(my_post_id)` | 2h 缓存内不重算 |
| `missed_topics` | 已有 `(org_id, content_fingerprint)` | upsert 但**人工 decision 不被覆盖**（算法 set 子句已规避） |

Inngest 函数级幂等：每个 fn 用 `step.run()` 包关键步骤，框架自带 retry+dedup。

### 5.6 时序时间表

```
05:00 SH       accountAnalyticsCrawlCron 触发,fan-out
05:00-05:30    各 TikHub 抓取并发(rate limit 自动调)
05:00-06:00    sync-on-run-completed 增量消费 collection/run.completed
05:00-06:00    find-matches-on-new-mypost 增量消费 my-post.created (LLM concurrency=4)
06:00 SH       missedTopicDetectionDaily 触发(此时 sync 基本完成)
```

`missedTopicDetectionDaily` 选 06:00 而非串行，是为了**解耦**：sync 卡住不应拖死漏题分析；漏题跑的是已落 DB 的 `benchmark_posts`，多跑一次无害（人工 decision 不被覆盖）。

---

## 6. 错误处理与监控

### 6.1 失败分类

| 类别 | 检测 | 处理 | 用户感知 |
|---|---|---|---|
| TikHub 临时错误 (5xx / timeout / 429) | `http-client.ts` rate limiter + retry | Inngest step.run 3 次指数退避 | 无 |
| TikHub 账号不存在 / 已注销 | adapter 返回 404 | sync fn 捕获 → 自动 `crawlCronEnabled=false` + 在 `notes` 字段追加 audit | 账号列表能看到 notes |
| TikHub 配额耗尽 | adapter 抛专门错误 | sync fn 不重试，整批挂起，console.error + 派 budget event（如有 audit table） | 第二天在 Inngest UI 查 |
| `collected_items` 解析失败 | sync 层 try/catch 每行 | 跳过该行，`parseFailed++`，step output 报告 | 不阻塞同 run 其他行 |
| fingerprint dedup 冲突（不同内容 hash 撞） | unique constraint 抛错 | 走 update（按 source_url 二次判断），冲突计数 | 极少 |
| LLM 调用失败（DeepSeek 5xx） | `findSameTopicMatches` 抛错 | Inngest 自动重试 3 次，仍失败则该 my_post 当日无对比 | DAL 查不到就显示"暂无对标"，第二天 cron 再补 |
| `detectMissedTopicsForOrg` 单 org 超时 | step timeout | 跳过该 org 继续下一个 | 该 org 漏题不更新 |
| Schema unique constraint 升级时 DB 现有重复 | `precheck-my-posts-fingerprint-dupes.ts` | 阻断 `db:generate`，列出冲突 | deploy 前必修 |

### 6.2 不静默吞错纪律

- 所有 `catch` 必须**至少** `console.error` + 计数到 step output
- TikHub 账号自动停用必须**留 audit** 到 `accounts.notes` 字段
- Sync fn 的 step output **必须**返回 `{processed, succeeded, parseFailed, upserted, newMyPostIds}` 五个数
- Inngest cron 跑完写一条统计

### 6.3 监控点

1. **Inngest 函数页**：4 个新函数的成功率 + step output 直接可读
2. **`*_accounts.lastCrawledAt`**：DB 自带字段，运营在 `/topic-compare/accounts` 看
3. **`scripts/verify-topic-compare-pipeline.sh`**（新增运维脚本）：
   - crawl-enabled 账号数
   - 最近 24h `lastCrawledAt` 更新数
   - `benchmark_posts` / `my_posts` 表行数变化
   - `topic_matches` / `missed_topics` 表行数变化
   - 列出最近 7 天没成功抓取的"僵尸账号"

### 6.4 不做的监控

- ❌ 新 metric / Prometheus（项目当前无此栈）
- ❌ 邮件 / 钉钉告警（项目当前无告警链路）
- ❌ SLO 看板（YAGNI）

---

## 7. 测试策略

### 7.1 单元测试（Vitest）

| 模块 | 覆盖 | 用例数 |
|---|---|---|
| `sync-collected.ts` | mock `collectedItems` + source binding → 验证 upsert 参数、`newMyPostIds`、`parseFailed`。覆盖 4 平台 mapper | ~12 |
| `backfill.ts` | TikHub adapter mock 返回 30 条 → 验证 sync 调用、统计 | ~3 |

**必须覆盖的边界**：

- `collected_item` 缺 `views` / `likes` → mapper default 0
- 同 `collected_item` 消费两次 → 第二次只 update
- 1 个 my_account 30 条，5 条 fingerprint 已存在 → 5 update + 25 insert
- benchmark_post 撞 `(account_id, source_url)` → upsert
- platform ∉ 白名单 → sync 整批跳过 `skipped: true`

### 7.2 集成测试（Vitest + 本地 DB）

| 场景 | 步骤 |
|---|---|
| Flow A 端到端 | seed 1 my_account + 3 collected_items → 派 `collection/run.completed` → 校验 `my_posts` 3 行 / distributions 3 行 / `topic-compare/my-post.created` 派 3 次 |
| Flow B backfill | toggle action → 校验 `topic-compare/backfill.requested` 派出 → mock TikHub 30 条 → 校验落表 |
| Dedup 二次跑 | 同 collected_items 喂 sync 两次 → DB 行数不变、stats 刷新 |
| `detectMissedTopicsForOrg` 真数据 | seed 10 benchmark_posts + 3 my_posts（1 个能软匹配）→ 校验 `missed_topics` 9 suspected + 1 covered |

### 7.3 不写的测试

- ❌ TikHub HTTP 契约测试（adapter 自有测试）
- ❌ Inngest 框架重试逻辑（信任）
- ❌ LLM matcher 语义准确率（模型层问题，单测脆弱）
- ❌ UI 层（本次不改）

### 7.4 联调验证清单

```bash
# 1. Schema 同步
npx tsx scripts/precheck-my-posts-fingerprint-dupes.ts
npm run db:generate
npm run db:migrate
bash scripts/verify-schema-sync.sh

# 2. 单测
npx vitest run src/lib/topic-compare

# 3. 启 Inngest dev server (默认随 next dev)
npm run dev

# 4. seed 真 TikHub 账号
npx tsx scripts/topic-compare-smoke-account.ts --platform douyin --handle xxx

# 5. Inngest UI 手动触发 topic-compare/backfill.requested
#    校验:collected_items 增 30 条,my_posts ≤30,distributions ≤30
#    topic-compare/my-post.created 派出 ≤30 次,topic_matches 落表

# 6. Inngest UI 手动触发 missedTopicDetectionDaily
#    校验:missed_topics 表有内容

# 7. 打开 /topic-compare 看真账号数据
# 8. 打开 /missing-topics 看真漏题
```

### 7.5 上线验收

`bash scripts/verify-topic-compare-pipeline.sh` 期望输出：

```
crawl-enabled my_accounts: 5
crawl-enabled benchmark_accounts: 12
last 24h: 17/17 accounts crawled successfully ✓
benchmark_posts last 24h delta: +84
my_posts last 24h delta: +12
topic_matches last 24h delta: +12
missed_topics last 24h delta: +9
zombie accounts (>7d no crawl): 0
```

---

## 8. 范围估算与里程碑

整体 ~6 工作日：

| 阶段 | 内容 | 人日 |
|---|---|---|
| P1 | Schema migration + sync 纯函数 + 单测 | 1.5 |
| P2 | crawl-cron 扩展 + sync-on-run-completed Inngest fn + 集成测试 | 1.5 |
| P3 | backfill 路径 + toggle server action + 集成测试 | 1 |
| P4 | find-matches-on-new-mypost + missed-topic-cron + 集成测试 | 1 |
| P5 | 联调（步骤 1-8）+ verify 脚本 + 文档 | 1 |

里程碑：
- **M1**：P1+P2 完成 → 4 平台的对标账号可手动触发回填，benchmark_posts 真数据进库
- **M2**：P3 完成 → toggle 即时生效，运营可在 `/topic-compare/accounts` 一键开启自动抓
- **M3**：P4+P5 完成 → 全链路自动跑，verify 脚本验收通过

---

## 9. 后续 spec（不在本次范围）

- 扩展平台：小红书 / 视频号 keyword search 模式抓取（数据质量验证 + 模糊匹配兜底）
- B 站 / 头条 / 快报：第三方抓取接入（TikHub 暂不支持）
- Stats 时间序列：跟踪 views/likes 7/14/30 日演化曲线
- Keyword 主题字典：用 TikHub keyword search 做"我方账号池外"的话题发现（与现行漏题机制互补）

---

## 10. 参考

- `docs/superpowers/specs/2026-04-17-benchmarking-redesign-design.md` — UX 重构（已交付）
- `CLAUDE.md` §Schema Migration 规范、§Inngest（Background Jobs）
- `docs/adr/2026-05-29-workflow-template-schedule-on-scheduled-jobs.md` — 调度统一到 scheduled_jobs（本设计沿用 Inngest cron，不与 scheduled_jobs 冲突）
- `src/lib/topic-matching/find-matches.ts`、`src/lib/topic-matching/missed-topic-finder.ts` — 现有算法
- `src/inngest/functions/account-analytics/crawl-cron.ts` — 现有 cron（本次扩展点）
- `src/lib/collection/adapters/tikhub/` — 现有 TikHub 适配器

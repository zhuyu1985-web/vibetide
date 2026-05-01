# ADR-0001 · 平台数据库与基础设施战略：留 Supabase 自托管，按 ROI 渐进激活

- **状态：** Accepted
- **日期：** 2026-05-01
- **决策者：** zhuyu（华栖云 / VibeTide）
- **上下文范围：** 整个 VibeTide 平台（生产 / 开发 / 客户私有部署）
- **关联文档：**
  - 备选迁移演练 plan：`docs/plans/2026-05-01-db-migration-dev-rehearsal-plan.md`（**本 ADR 决定后不执行**）
  - 自托管 Supabase 迁移历史：`docs/supabase-localization-guide.md`

---

## TL;DR

留在 **self-hosted Supabase**，不迁出。**所有部署形态——内部生产 / 开发 / 客户私有部署——使用完全一致的栈，不分 SKU、不做"极简版"分支**。

四条理由：

1. 自托管栈已经在跑，沉没成本低
2. 7 个未激活的能力（Realtime / pgvector / Storage / Studio / Materialized Views / FTS / pg_cron）每个都对应平台未来 6-12 个月的明确需求点
3. Drizzle ORM 已经把代码和"数据库提供商"解耦，**保留 Supabase 不增加任何 lock-in**——任意时点想迁出依然可行
4. 客户私有部署场景下，Supabase 的"运维门户 + 一站式"是销售层面的差异化

标准化原则：one stack, one deployment template. 客户硬件不达标的，要么升级硬件要么走客户化项目报价——**不通过精简产品 SKU 来吸收硬件差异**。接下来按 P0 → P3 顺序渐进激活相关能力，不做整体改造。

---

## 1. Context（背景与现状）

### 1.1 当前架构

```
Next.js 16 (RSC + Server Action)
        ↓
Drizzle ORM (typed query)
        ↓ 走 SQL/TCP，不经 PostgREST
postgres 驱动 (npm: postgres)
        ↓
Self-hosted Supabase 栈中的 PostgreSQL 实例
```

**已经替代掉的 Supabase 组件：**
- Auth (GoTrue) → iron-session + argon2id 自建（2026-04-30 完成）
- PostgREST → Drizzle 直连，零 HTTP 层
- Realtime → 暂用 SSE + 轮询替代

**仍在依赖的 Supabase 组件：** PostgreSQL（数据库本体）+ pg_trgm 扩展。

### 1.2 触发本 ADR 的事件

2026-05-01 评估"是否迁出 Supabase"时，发现：

1. 当前用法（"Supabase 只是个托管 PG"）→ 迁出技术成本极低（< 半天）
2. **但**未来 6-12 个月的产品路线图中有 7 个明确需求点会用到 Supabase 自托管栈中的其他组件
3. 现在迁出 → 6 个月后又要为某个能力（Realtime / Storage / pgvector）单独搭建/采购，反而是高成本反复折腾

→ 决定不迁。**本 ADR 作为这个反向决定的固化记录**，避免后续团队成员/未来的自己再次提出"Supabase 用不到这么多功能，迁出去吧"的提案。

### 1.3 关键约束

- **客户主要为中国大陆媒体行业**：电视台 / 报业 / 政府宣传部门 / 融媒体中心
- **私有部署是核心交付形态**：客户不会接受云端 Supabase 或 SaaS-only 模式
- **客户群分层**：从央媒级别（资源充足）到地市融媒（4c8g 单机）都有
- **AI / 工作流密集**：Inngest 已是核心编排引擎，不可替代
- **多租户**：单实例承载多 organization

---

## 2. Decision（决定）

### 2.1 主决定

> **留在 self-hosted Supabase 架构，不做迁移。所有部署形态——内部生产 / 开发 / 客户私有部署——使用完全一致的栈，不做版本/SKU 分支。**

标准化原则：one stack, one deployment template, one set of operational practices. 任何"为某个客户定制部署形态"的需求按客户化项目（custom integration）计费，不进入产品标准 SKU。

### 2.2 子决定

| 子决定 | 选择 |
|---|---|
| 是否迁出 Supabase 到纯 PG | ❌ 不迁 |
| 是否切换到云端 Supabase | ❌ 不切（私有部署需求决定） |
| 数据库 ORM | ✅ 继续用 Drizzle（不引入 supabase-js） |
| Auth | ✅ 维持 iron-session 自建（不回到 GoTrue） |
| 后台任务编排 | ✅ 维持 Inngest（不替换为 pg_cron / Edge Functions） |
| 前端到 DB 的访问方式 | ✅ Server-First（不启用 PostgREST 暴露给前端） |
| 渐进激活 Supabase 其他能力 | ✅ 按 §4 路线图执行 |

---

## 3. Considered Options（替代方案及评估）

### 选项 A · 迁出到纯 PG（云厂商 RDS 或自建）

- **代表实现：** 阿里云 RDS PG / Neon / 自建 Postgres on ECS
- **优点：** 简化栈、资源占用低、扩展性好、跨云迁移容易
- **缺点：** 需要为未来 6-12 个月内会激活的 4-5 个 Supabase 组件单独搭建 → 总成本反而更高
- **决策：** ❌ 否决。短期收益不明显，长期需要重复建设

### 选项 B · 切换到云端 Supabase（managed）

- **优点：** 零运维、自动备份、CDN
- **缺点：** 中国大陆延迟差（首尔/东京）、无法满足客户私有部署刚需、跨境合规风险
- **决策：** ❌ 否决。与产品交付形态冲突

### 选项 C · 留 Self-hosted Supabase，全部激活其能力

- **优点：** 最大化 Supabase 价值
- **缺点：** Auth / PostgREST 已经被替代，激活会破坏现有体系；Edge Functions 不如 Inngest
- **决策：** ❌ 否决。不要为了"用满"而用

### 选项 D · 留 Self-hosted Supabase，按 ROI 渐进激活（**采纳**）

- **优点：** 保留现有体系不破坏；按业务需求触发激活；架构 optionality 最强
- **缺点：** 维护一份"哪些组件激活、哪些没激活"的认知地图（→ 本 ADR 解决）
- **决策：** ✅ 采纳

### 选项 E · 双栈：内部用 Supabase，给客户私有部署用极简 PG

- **优点：** 内部生产力高、客户部署轻量
- **缺点：**
  - 双轨维护翻倍：每个 feature 都要在两个栈下测试 / 文档 / 部署脚本各一份
  - 功能等价性无法保证：Realtime / Storage / pgvector 等能力在"极简版"下要么禁用要么找替代实现，导致客户拿到的产品形态实际比内部少一截
  - 测试覆盖空洞：CI 跑不了双栈全量回归
  - 销售复杂度上升：每次报价要先确认硬件规格匹配哪个 SKU
- **决策：** ❌ **明确否决（不暂缓）**。小团队 / 单产品阶段不做双栈。客户硬件不达标 → 列入合同硬性前置条件，不通过技术兼容来吸收

---

## 4. Activation Roadmap（激活路线图）

按 ROI 与触发条件排序。**不要批量激活**，每个等到对应业务节点再做。

### 🔴 P0（已经/即将触发）

#### 4.1 raw_events 分区表 + pg_partman

- **触发条件：** 数据采集模块 v2 启动前（即将开工）
- **替代什么：** 当前采集结果直接写入业务表（articles / hot_topics 等）
- **变成什么：** 入口先写 schema-less 的 `raw_events` 表（按月分区），异步抽取到结构化表
- **Supabase 价值：** pg_partman 扩展自托管已装、Studio 可视化分区管理
- **工作量：** 2-3 天
- **验收：** 单表能稳定承载 100 万行/天 × 6 个月，SELECT 不退化

#### 4.2 pgvector + HNSW 索引

- **触发条件：** 知识库 chunks > 5k 时（接近阈值）
- **替代什么：** `embedding` 字段当前是 jsonb，应用层 cosine 全表扫
- **变成什么：** `embedding vector(1024)` 列 + HNSW 索引，查询从 O(N) 变 O(log N)
- **工作量：** 1-2 天 + 后台数据迁移
- **验收：** 100 万 chunks 下检索 P95 < 50ms

### 🟡 P1（近 3-6 个月）

#### 4.3 Realtime 推送 mission 进度 / 团队消息

- **触发条件：** 多用户协作场景出现 / SSE 服务端负载升高
- **替代什么：** `/api/missions/[id]/progress` SSE + 2s 轮询
- **变成什么：** 前端 `supabase.channel().on('postgres_changes', ...)` 直接订阅
- **工作量：** 半天（旧 SSE 路径可保留作 fallback）
- **验收：** 进度推送延迟 < 200ms，服务端无轮询负载

#### 4.4 Materialized Views + pg_cron refresh（分析仪表盘）

- **触发条件：** 数据采集模块产出的分析仪表盘上线时
- **替代什么：** 仪表盘直查原始表
- **变成什么：** 物化视图聚合 + pg_cron 每 5 分钟 `REFRESH CONCURRENTLY`
- **工作量：** 1 天
- **验收：** 仪表盘查询从秒级降到 50ms 内

#### 4.5 Storage（媒资 Phase 2 起用）

- **触发条件：** 媒资模块 Phase 2 kickoff
- **替代什么：** 当前 `media_assets` 表只存 URL，没有上传层
- **变成什么：** Supabase Storage bucket + RLS policy + 自动缩略图
- **客户私有部署：** 一律使用 Supabase Storage，不提供"切换到外部对象存储"的适配层。如果某个客户合同强制要求接他们已有的 OSS/OBS/NAS，**作为单独的客户化项目报价**，不进入标准产品
- **工作量：** 2-3 天（去掉适配层后变轻）
- **验收：** 上传 1GB 视频不丢、缩略图自动生成、跨 org 权限隔离

### 🟢 P2（按需）

#### 4.6 Studio 给客户运维使用

- **触发条件：** 第一个私有部署客户上线时
- **做什么：** 部署 Studio 容器、建只读 `analyst` 角色、给客户 IT 培训
- **不做什么：** 不给 superuser / 不暴露给客户终端用户

#### 4.7 PostgreSQL FTS + 中文分词（zhparser / pg_jieba）

- **触发条件：** 内部全站搜索性能不够时 / KB 检索想做"FTS 预过滤 + vector 重排"两阶段时
- **工作量：** 1 天

### 🔵 P3（长期）

#### 4.8 pg_cron 替代部分 Inngest 简单任务

- **仅适用：** 纯 SQL 操作（aggregations、materialized view refresh、定期清理）
- **不适用：** 调三方 API / 发邮件 / 复杂 DAG / 需要重试观测

#### 4.9 pgsodium / Vault（敏感字段加密）

- **触发条件：** 客户合规审查要求字段级加密时

---

## 5. Non-Goals（明确不做）

| 项 | 原因 |
|---|---|
| ❌ 启用 GoTrue (Supabase Auth) | iron-session 体系已稳定，社交登录 / 邮件验证非当前需求 |
| ❌ 启用 PostgREST 给前端直查 | Server-First 架构下不需要；安全模型用 RLS 表达不动业务规则 |
| ❌ 启用 Supabase Edge Functions | Inngest 全面更优 |
| ❌ 用 pg_cron 替换 Inngest | 不要让"DB 内调度"侵入业务编排 |
| ❌ 把 Drizzle 替换为 supabase-js | 类型安全、灵活性、Server Action 体系 Drizzle 强 |
| ❌ 启用 Realtime 给所有表 | 只对明确需要推送的表开 publication，避免广播风暴 |
| ❌ 把 raw_events 立刻 schema 化 | 第一版 schema-less，3-6 个月后再决定字段升级 |
| ❌ 双栈 / 极简版 PG-only SKU / "客户特供"部署模板 | 双轨维护成本翻倍且功能不等价；客户硬件不达标走"提升硬件"或"客户化项目"两条路，不通过精简产品 SKU 解决 |
| ❌ Storage / Realtime 的可插拔 adapter 层（替换为外部对象存储 / 自建 ws 等） | 标准化原则下不预留逃生通道；真有客户强制要求时按客户化项目处理 |

---

## 6. Consequences（后果）

### 6.1 正面后果

- ✅ 现有体系（Drizzle + iron-session + Inngest）零改动
- ✅ 未来 6-12 个月每激活一个 Supabase 能力都是"开关"级别成本（小时-天级）
- ✅ 客户私有部署交付时附带运维门户（Studio）作为差异化
- ✅ optionality 最大：架构没绑死任何一边，未来真要迁出 Drizzle 是 escape hatch
- ✅ 不做整体迁移 → 当前迭代节奏不被打断

### 6.2 负面后果 / 需承担的债务

- 🟡 需要持续维护 Supabase 自托管栈（docker-compose 12 容器，约 2-4GB 内存基础占用）
- 🟡 **硬件门槛进入客户合同**：客户私有部署硬件不达标时拒绝交付或要求升级，而非提供精简版本（销售/售前必须前置确认硬件规格）
- 🟡 Supabase 版本升级需要跟进（~每季度一次，可能有 breaking change）
- 🟡 Studio / Storage / Realtime 等组件即使不激活，仍在跑，占资源
- 🟡 双轨认知负担：团队需要清楚"哪些组件激活了、哪些没"，避免误用 supabase-js 等被替代的客户端

### 6.3 反面 cap（如果决策错了，最坏会怎样）

- 最坏情况：6 个月后发现激活的组件实际未上线、Supabase 栈纯属维护负担
- 兜底：执行原 plan `docs/plans/2026-05-01-db-migration-dev-rehearsal-plan.md`，迁出成本仍然 < 半天
- → 决策可逆性高，反面 cap 低

---

## 7. Risks & Mitigation（风险与缓解）

| 风险 | 概率 | 后果 | 缓解 |
|---|---|---|---|
| 客户硬件规格不足以跑 Supabase 全栈 | 高 | 客户拒收 / 销售流失 | **售前前置确认硬件规格**：在标准报价单中列入最低硬件要求（建议 ≥ 8c16g，最低 4c8g 不保证生产级体验）；不达标的客户走"硬件升级"或"客户化项目报价"两条路，不通过技术 hack 兜底 |
| 客户合规审计要求"组件最小化" / 安全扫描挑刺无用服务 | 中 | 私有部署中标失败 | 准备"docker-compose 上各组件作用 + 安全说明"文档作为合规附件；个别客户强制要求时按客户化项目处理（≠ 标准 SKU 分叉） |
| Supabase 自托管版本升级引入 breaking change | 中 | 需紧急修补 | 锁定具体 docker tag，不用 `latest`；每季度评估升级 |
| Realtime 大表广播放大写入流量 | 中 | DB 与网络压力 | 仅对必要表启用 publication，filter 必须带 organization_id |
| pgvector 索引 build 时间长（百万级数据） | 中 | 上线窗口长 | 先 INSERT 数据再 CREATE INDEX；HNSW 支持 CONCURRENTLY |
| 新人误用 supabase-js 重复造轮子 | 中 | 双 ORM 体系混乱 | CLAUDE.md / 本 ADR 明确禁止；ESLint 规则可加 `no-restricted-imports` |
| 销售/售前未前置确认硬件，签约后才发现不达标 | 中 | 项目延期 / 客户关系受损 | **标准报价模板必须包含硬件 checklist**；售前合同评审强制环节 |

---

## 8. Revisit Triggers（什么情况下重新评估本 ADR）

本 ADR 应在以下任一情况发生时重新审视：

1. **核心组件激活计划全部完成**（P0 / P1 都做完）后 6 个月——评估实际收益是否如预期
2. **客户私有部署交付反馈**：累计 3-5 个真实客户落地后，看 Supabase 全栈是否在客户侧成为问题
3. **Supabase 项目方向变化**：如果 Supabase 转向 cloud-only（self-host 不再受支持）
4. **底层依赖出现重大事件**：PostgreSQL 版本破坏性升级、Inngest 商业模式变化等
5. **客户硬件分布反例**：累计 ≥ 30% 客户在售前因硬件门槛流失，需要重新评估"标准化优先"vs"市场覆盖优先"的权衡——但即便此时 reopen，也是 reopen 整体战略，**不通过加 SKU 解决**

每次 revisit 写一份新 ADR（如 ADR-0001-revisit-2026-Q4），不要修改本文。

---

## 9. 附录：架构能力分配总图

```
                    ┌─ Frontend (Next.js RSC + 'use client') ─┐
                    │                                          │
                    │  ✅ Server Action / RSC（Drizzle 直连）    │
                    │  ✅ SSE（暂存）                            │
                    │  🟡 Supabase Realtime（P1 接入）           │
                    │  ❌ supabase-js 客户端（不引入）           │
                    │  ❌ PostgREST 直查（不开放）                │
                    │                                          │
                    └────────────────┬─────────────────────────┘
                                     │
              ┌──────────────────────┴───────────────────────┐
              │                                              │
              ▼                                              ▼
   ┌──────────────────────┐                     ┌──────────────────────┐
   │   Server Layer       │                     │  Background          │
   │   (Drizzle + DAL +   │                     │  (Inngest 主，        │
   │    Server Actions)   │                     │   pg_cron 仅纯 SQL)   │
   │                      │                     │                      │
   │  - iron-session auth │                     │  - 数据采集编排       │
   │  - 业务规则授权       │                     │  - mission 执行      │
   └────────────┬─────────┘                     └─────────┬────────────┘
                │                                          │
                └──────────┬───────────────────────────────┘
                           ▼
              ┌────────────────────────────────────┐
              │   Self-hosted Supabase Stack       │
              │                                    │
              │  ✅ PostgreSQL（含扩展）             │
              │       └─ pg_trgm（已用）            │
              │       └─ pgvector（P0 接入）        │
              │       └─ pg_partman（P0 接入）      │
              │       └─ pg_jieba（P2 按需）        │
              │  ✅ Studio（P2 给客户运维）          │
              │  🟡 Realtime（P1 接入）              │
              │  🟡 Storage（P1 媒资 Phase 2）       │
              │  ❌ GoTrue（不启用）                 │
              │  ❌ PostgREST（不暴露）              │
              │  ❌ Edge Functions（不启用）         │
              │  ❌ Kong API Gateway（按需）         │
              └────────────────────────────────────┘

图例：
✅ 已激活并使用
🟡 P0/P1 路线图内待激活
❌ 明确不启用（已被替代或不符合架构）
```

---

## 10. 决策签收

- 决策人：zhuyu
- 日期：2026-05-01
- 下次 revisit：2026-Q4 或 P0/P1 路线图完成 6 个月后

如有团队成员/未来自己想推翻本决定，请：
1. 阅读全文（特别是 §3 替代方案评估）
2. 起一份新 ADR 说明为什么情况变化、新决定是什么
3. 不要直接修改本文档（保留决策历史）

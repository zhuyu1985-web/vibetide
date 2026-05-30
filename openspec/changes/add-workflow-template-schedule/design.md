## Context

VibeTide 内部已有两条几乎要"对接"但当前断开的基建：

1. **`scheduled_jobs` + `scheduledJobsRunner`**（`src/inngest/functions/scheduler/scheduled-jobs-runner.ts`）——
   每分钟跑一次的 master scheduler，扫表派发 typed Inngest event，业务函数订阅 event。当前是**单租户**（无 `organization_id`），且每条 cron 的 `event_name` 写死，对应一个固定业务函数。13 条 event 全枚举在 `src/inngest/events.ts:381-393`。

2. **`workflow_templates`**（`src/db/schema/workflows.ts:51`）——
   场景模板单一真相源（B.1 已确立），表上**已经留了** `triggerType` enum + `triggerConfig.{cron, timezone}` jsonb 字段，但全 codebase 无消费者，等同 stub。启动 mission 的唯一入口是 `startMissionFromTemplate(templateId, inputs, options)`（`src/app/actions/workflow-launch.ts:107`），需要 `requireAuth()` + 当前用户的 org。

业务诉求是"运营在 `/workflows/[id]` 上挑一个场景、填 cron、填默认参数、点保存 → 到点自动启动 mission"。从架构看，最低代价、最少新增系统数的做法是：**把 1 嫁接到 2**。

### 关键约束（不能违反）

- **不引入新的 cron 引擎/调度器** —— ADR `2026-05-01-platform-supabase-strategy.md` §5 明确禁止替换 Inngest；架构纪律也要求 cron 必须经 `scheduled_jobs` 统一管理。
- **多租户隔离** —— `workflow_templates` 已是 per-org，schedule 必然 per-org，且 cron 自动启动的 mission 必须落到对应 org 下（不能跨 org 串）。
- **B.1 单一真相源不能被绕过** —— schedule 触发 mission 必须仍经 `startMissionFromTemplate` 路径（保留 leader 选择、defaultTeam 解析、prompt rendering、source 去重等所有现有逻辑），不能直接 INSERT `missions`。
- **Schema migration 走 Drizzle 标准流程** —— `npm run db:generate` 一次 + `db:migrate` 一次，禁手工 SQL 文件（CLAUDE.md schema 纪律）。

### 利益相关方

- **运营 / 内容主理人**：UI 上自助配置定时（主诉求方）
- **平台管理员**：`/admin/scheduled-jobs` 现有列表的连续性
- **工程师**：未来不需要再为"加一个新定时场景"写新 Inngest 函数
- **架构 owner（B.2 待办的归并方）**：确保新 schedule 表设计与 B.2 "mission 下游消费者迁到 workflowTemplateId" 不冲突

## Goals / Non-Goals

**Goals**
- 一个 workflow_template 可以挂 0~N 条 cron schedule，每条独立启停。
- schedule 到点 → 通过 typed event → 走 `startMissionFromTemplate` 启动 mission，附带运营预设的 `inputParams`。
- 启动失败可观测（schedule 行的 `last_run_status='failed'`、`team_messages` 里有一行系统提示）。
- 与现有 13 条平台级 cron 完全向后兼容，旧 job 行不动一字。
- 管理员能在 `/admin/scheduled-jobs` 看到 platform 类与 workflow_template 类的全部 job。

**Non-Goals**
- ❌ webhook / API key / 事件触发 —— 只做 cron。
- ❌ 跨模板编排 / 条件分支（"模板 A 跑完后跑模板 B"）—— 单条 schedule 单模板。
- ❌ 自定义重试策略 —— schedule 派发失败时 runner 不重试这一次，等下一轮 cron tick。Mission 内部失败走现有 `handle-task-failure` Inngest 函数。
- ❌ schedule 历史详情页 —— V1 只在 schedule 行上记录 `last_run_at` / `last_run_status`，不存 run history 表。
- ❌ UI 上的 cron builder（"每周一三五早上 9 点" → 自动生成 cron 字符串）—— V1 让用户直接写 cron 表达式 + 服务端用 `cron-parser` 校验合法。

## Decisions

### D1: 扩展 `scheduled_jobs` 表 vs 新建 `workflow_template_schedules` 表

**选择**：扩展 `scheduled_jobs`，加 `kind` 列区分 platform / workflow_template。

**Why**：
- runner 已是稳定基建（容错、`next_run_at` 计算、`total_runs` 统计、`enabled` toggle 全套都写好了），单表共享逻辑零成本。
- 管理员后台只需要一个 `/admin/scheduled-jobs` 入口，不分裂为两个。
- `scheduledJobsRunner` 的 hot loop 只是一个 `WHERE enabled AND next_run_at <= NOW()`，再多一个 `kind` 字段判断分支零性能成本。
- 未来如果再加 `webhook` 等触发，仍是同一张表 + 同一个 runner。

**Alternatives considered**：
- **新建 `workflow_template_schedules` 表 + 独立 runner** —— 否定。复制现有 cron-parser / next_run_at / 失败统计逻辑，分裂调度状态来源，违反"复用现有基建"目标。
- **直接用 `workflow_templates.triggerConfig` 字段存 cron** —— 否定。单字段只能表达"一个模板一条 cron"，无法支持"早 8 点抓热点 + 晚 8 点写报告"这种常见多 schedule 需求；且要重新发明 next_run_at 计算、enabled toggle、失败统计。

### D2: 派发路径 —— 加 typed event vs runner 直接调 server action

**选择**：加一个新 typed event `scheduled-jobs/workflow-template.run`，runner 派 event，再用一个新 Inngest 函数订阅、在 handler 里调 service 入口。

**Why**：
- 保持 `scheduledJobsRunner` 的职责清晰 —— 它只做"扫表 + 派发 + 更新 next_run_at"，不做业务逻辑。
- Inngest dashboard 上能看到 workflow-template-launch 这一类执行历史，便于 debug；如果 runner 直接调 server action，所有逻辑都挤在 runner 的一次 step 里，可观测性差一档。
- 失败重试可以由订阅函数自己 declare（`retries: 3`），不污染 runner。
- 与现有 13 条 event 派发模式一致，团队不需要学新心智模型。

**Alternatives considered**：
- **runner 在循环里直接 `await startMissionFromTemplateScheduled(...)`** —— 否定。runner 串行化（`concurrency: 1`）会被慢 mission 拖累；且把业务逻辑塞进 scheduler 违反单一职责。
- **每条 workflow_template schedule 动态注册一个独立 Inngest cron 函数** —— 否定。Inngest 函数列表是部署时静态注册的，"在 DB 改 cron 立即生效"会破。

### D3: 启动 mission 的服务入口

**选择**：在 `src/app/actions/workflow-launch.ts` 拆出新函数 `startMissionFromTemplateScheduled(templateId, orgId, inputs, { scheduledJobId, scheduledFireAt })`，与 `startMissionFromTemplate` 共享内部 `_buildAndInsertMission` helper。

**Why**：
- `startMissionFromTemplate` 必须 `requireAuth()`（user-initiated path），scheduled 路径没有 user session，不能直接复用。
- 拆出 service 版本能显式接 `orgId`、显式带 `triggerSource: "schedule"`、显式写 `sourceModule='schedule'` + `sourceEntityId=scheduledJobId` 让 missions 表自带"同一 schedule 一分钟内只插一行"的去重（复用现有 `missions_source_dedup_uidx`）。
- 两个入口共享 helper 保证 leader 解析、defaultTeam → employee ids、prompt rendering、run stats 更新等逻辑完全一致，避免行为分叉。

**Alternatives considered**：
- **给 `startMissionFromTemplate` 加 `skipAuth` 参数** —— 否定。`"use server"` 函数加"跳过 auth"flag 是 anti-pattern，容易被业务代码误用，安全风险大。

### D4: cron 周期下限

**选择**：服务端拒绝周期 < 1 分钟的 cron（即不允许 `* * * * *` 这种每分钟 schedule for workflow_template kind，但平台级 13 条仍可保留每分钟）。

**Why**：
- Mission 启动涉及 leader-plan、多步骤 AI 调用，每分钟一次没有业务意义且会迅速耗 token 配额。
- 多租户场景下 10 org × 30 模板 × 每分钟 = 300 次/分钟的启动峰值，会把 Inngest 队列打爆。

**Alternatives considered**：
- 不限制 —— 否定（见上）。
- 全局限速（每 org 每分钟 N 个 schedule 触发） —— 复杂且 V1 不必要。1 分钟下限够用。

### D5: UI 位置

**选择**：在 `/workflows/[id]` 详情页加一个"定时任务"tab，与"基本信息""步骤"等并列。

**Why**：
- 与模板强耦合的配置应该长在模板详情页，运营心智自然。
- `/scenarios/customize` 是 B.2 待重写的页面，避免在它上面再加新功能拖累 B.2。
- 管理员仍可在 `/admin/scheduled-jobs` 看到所有 schedule 的全局视图。

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| 多租户 cron 风暴 | 服务端校验周期下限 1 分钟；runner 内对 `workflow_template` kind 做 `sendEvent` 批量 + per-org jitter（错峰 ±15 秒） |
| schedule 触发的 mission 与用户手动启动并发 | 现有 `missions_source_dedup_uidx` 已按 `(org, sourceModule, sourceEntityId)` 去重；不同 sourceModule（'schedule' vs 'manual'）天然不撞，无需额外锁 |
| `triggerConfig.cron` 字段双轨期混淆 | proposal 阶段就标 `@deprecated`，新 UI 不读不写；后续清理可单独提 change |
| Inngest event 名爆炸（每个模板一个 event？） | 不会 —— 所有 workflow_template schedule **共享一个 event 名** `scheduled-jobs/workflow-template.run`，payload 里带 `workflowTemplateId` 区分 |
| schedule 启动的 mission 失败如何让运营知道 | mission 详情页本来就有失败提示；schedule 行的 `last_run_status` 在 `/admin/scheduled-jobs` 与 `/workflows/[id]` 定时任务 tab 都展示；mission 启动失败时往 `team_messages` 写一行系统提示带 schedule 名 |
| Inngest 内 step.sendEvent 失败 | runner 已有 try-catch 容错（见 `scheduled-jobs-runner.ts:62-136`），单条失败不影响其他；增加测试覆盖新 kind 分支 |

## Migration Plan

1. **Schema 变更**：`npm run db:generate` 产出一个新 migration，加 4 列到 `scheduled_jobs`、新增 `scheduled_job_kind` enum。旧行 `kind` 默认 `'platform'`、`organization_id` 默认 NULL，完全兼容。
2. **代码迁移顺序**（每步 `tsc --noEmit` + `build` 通过才能合并）：
   1. Schema + DAL + 单元测试（不影响 runtime）
   2. `events.ts` 加新 event 类型 + scheduler runner 派发分叉（旧路径仍走老逻辑）
   3. 新 Inngest 函数 + `startMissionFromTemplateScheduled` service 入口
   4. UI tab + server actions
3. **回滚预案**：若新功能出 bug，UI 上"启用"toggle 关闭即停止，schedule 行可整行删除；schema 列保留不删（不需要回滚 migration）。
4. **数据兼容性**：现有 13 条平台级 cron 行 `kind` 自动为 `'platform'`、无 `organization_id`、无 `workflow_template_id` —— runner 走老分支，行为完全不变。

## Open Questions

1. **schedule 触发 mission 的 `leaderEmployeeId` 选择**：跟手动启动一样走 `getOrProvisionLeader(orgId)` 即可？—— 倾向是；除非有 schedule 想绑定特定 leader，但 V1 不做这个配置。
2. **运营改 schedule cron 后，runner 何时生效**：runner 每分钟扫表读最新 `cron_expression`，最长 60 秒生效。可接受不需要额外推送机制。
3. **scheduled mission 是否要在 `/missions` 列表上有视觉标记**：建议加一个小 icon（钟表 emoji）让运营一眼区分手动 vs 定时触发，但 V1 可只通过 `sourceModule='schedule'` 字段过滤，UI 标记下一个 change 再做。

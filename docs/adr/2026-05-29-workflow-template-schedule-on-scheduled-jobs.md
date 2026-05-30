# ADR-0002 · workflow_template 定时任务嫁接到 `scheduled_jobs` 表,而非新建独立表

- **状态:** Accepted
- **日期:** 2026-05-29
- **决策者:** zhuyu(华栖云 / VibeTide)
- **上下文范围:** workflow_templates 模块 + scheduled_jobs 平台基建
- **关联文档:**
  - OpenSpec change:`openspec/changes/add-workflow-template-schedule/`(proposal / design / tasks / spec deltas)
  - 上游基建 ADR:`docs/adr/2026-05-01-platform-supabase-strategy.md`(规定不替换 Inngest)

---

## TL;DR

**为 workflow_template 增加"定时启动 mission"能力时,扩展现有 `scheduled_jobs` 表加 `kind` 字段区分 platform vs workflow_template,而不是新建独立的 `workflow_template_schedules` 表 + 独立 runner。**

理由:
1. `scheduledJobsRunner` 已是稳定的 cron 中枢(每分钟扫表、cron-parser 算 next_run_at、容错统计、enabled toggle 全套已实现)
2. 管理员后台 `/settings/scheduled-jobs` 只需要一个入口看全平台 cron,不要分裂为两个
3. runner 的 hot loop 只是 `WHERE enabled AND next_run_at <= NOW()`,再多一个 `kind` 字段判断零成本
4. 未来再加 webhook / event 触发,仍是同一张表 + 同一个 runner,扩展性好

---

## 1. Context

### 1.1 现状

VibeTide 已有两条几乎要"对接"但当前断开的基建:

1. **`scheduled_jobs` + `scheduledJobsRunner`**(`src/inngest/functions/scheduler/scheduled-jobs-runner.ts`)——
   每分钟跑一次的 master scheduler,扫表派发 typed Inngest event,业务函数订阅 event。当前是**单租户**(无 `organization_id`),且每条 cron 的 `event_name` 写死,对应一个固定业务函数。13 条 event 全枚举在 `src/inngest/events.ts`。

2. **`workflow_templates`**(`src/db/schema/workflows.ts`)——
   场景模板单一真相源(B.1 已确立),表上**已经留了** `triggerType` enum + `triggerConfig.{cron, timezone}` jsonb 字段,但全 codebase 无消费者,等同 stub。启动 mission 的唯一入口是 `startMissionFromTemplate(templateId, inputs, options)`,需要 `requireAuth()` + 当前用户的 org。

### 1.2 业务诉求

运营在 `/workflows/[id]` 上挑一个场景、填 cron、填默认参数、点保存 → 到点自动启动 mission。允许同一模板挂 0..N 条独立 schedule(例如早 8 抓热点 + 晚 8 出报告)。

---

## 2. Decision

**扩展 `scheduled_jobs` 表**,新增 4 列:
- `kind` enum `'platform' | 'workflow_template'`(default `'platform'`)
- `organization_id` uuid(nullable —— platform 行为 NULL)
- `workflow_template_id` uuid(nullable —— platform 行为 NULL)
- `payload` jsonb(workflow_template 行承载 mission inputParams)

**`scheduledJobsRunner` 按 `kind` 分叉**:
- `kind='platform'` → 派发 `job.eventName`(老路径,完全向后兼容)
- `kind='workflow_template'` → 派发统一 typed event `scheduled-jobs/workflow-template.run`,data 含 `workflowTemplateId` / `organizationId` / `inputParams`

新增订阅函数 `workflowTemplateScheduledLaunch`,把 event 翻译成 `startMissionFromTemplateScheduled(templateId, orgId, inputs, { source: { module: "schedule", entityId: jobId, ... } })` 调用。

---

## 3. Alternatives Considered

### 3.1 新建 `workflow_template_schedules` 表 + 独立 runner

**否定理由:**
- 要复制现有的 cron-parser / next_run_at / 失败统计逻辑
- 分裂调度状态来源,管理员后台必须看两个入口
- 没有显著好处(可观测性、性能、可维护性都更差)

### 3.2 直接用 `workflow_templates.triggerConfig` 字段存 cron

**否定理由:**
- 单字段只能表达"一个模板一条 cron",无法支持"早 8 + 晚 8"的多 schedule 场景
- 需要重新发明 next_run_at 计算、enabled toggle、失败统计

### 3.3 每条 schedule 动态注册 Inngest cron 函数

**否定理由:**
- Inngest 函数列表是部署时静态注册,DB 改 cron 无法即时生效
- 函数注册爆炸(N org × M template × K schedule)

---

## 4. Consequences

### Positive

- 一张表 + 一个 runner 管所有 cron,运维心智成本恒定
- 老 13 条平台级 cron 行为零变化(kind default `'platform'`)
- 新功能开发只新增 ~600 行代码(2 个 schema 列 + 1 个新 enum + 1 个新 event + 1 个新 Inngest 函数 + DAL / actions / UI)
- 未来加 webhook / event 触发只需再加 `kind` 枚举值

### Negative

- `scheduled_jobs` 表 schema 含 nullable 字段(`organization_id` / `workflow_template_id` / `payload`),平台行用不上,有列空间浪费(可忽略)
- runner 函数稍微复杂(多一个 if 分叉),但远小于"维护两个 runner"的成本
- `workflow_templates.triggerConfig` 字段保留为 `@deprecated`,后续单独 change 清理

### Migration Plan

1. 一次 Drizzle migration 加 4 列 + 新 enum + 复合索引(已完成 `supabase/migrations/0042_funny_gorilla_man.sql`)
2. 老平台级行 `kind` 自动 default `'platform'`,无需 data migration
3. 回滚:UI 删 schedule 行即可;schema 列保留不删

---

## 5. Open Questions

- mission 失败时是否要在某处展示"由定时任务 #xxx 触发"?V1 通过 `mission.sourceModule='schedule'` + `sourceEntityId=jobId` 关联,后续 UI 可加视觉标记
- 是否需要 schedule 历史详情页(run history)?V1 只在 row 上记 `last_run_at` / `last_run_status`,如果实际使用中需要按周分析失败率再加专表

---

## 6. 后续(本 ADR 不涵盖,留待后续 change)

- `workflow_templates.triggerConfig` 列删除清理
- `mission.sourceModule='schedule'` 行在 `/missions` 列表上加 icon
- schedule failure 通知(via mission_messages / 通知中心)
- 多租户 cron 风暴更严格的限流(超出 1 分钟下限的全局速率限制)

# Change: 给 workflow_templates 加上"按场景配置定时任务"能力

## Why

目前 `workflow_templates` 表上的 `triggerType` / `triggerConfig.cron` 是 stub —— schema 留了字段但运行时无人读取，启动 mission 只有"用户手动点 → `startMissionFromTemplate`"一条路径。业务方反馈：很多场景（每日早报、热点抓取、栏目同步等）希望按 cron 自动跑，目前要么靠管理员手工点击，要么得让工程师在 `src/inngest/functions/` 写一个新硬编码函数 + 在 `events.ts` 加新事件名 + 部署，节奏严重错配运营节奏。

平台层已有一套成熟基建（`scheduled_jobs` 表 + `scheduledJobsRunner` 每分钟扫描派发 typed event），但它是**单租户、固定 eventName**：每条 cron 只能触发一个写死的事件，做不到"运营在 UI 上挑一个场景模板 + 填 cron + 填默认参数 → 自动按时启动 mission"。

这次只解决一件事：**让任意 workflow_template 都能被绑定 0~N 条 cron 调度，到点自动以指定参数走 `startMissionFromTemplate` 启动 mission**，复用已有调度中枢，不新建并行系统。

## What Changes

- **复用 `scheduled_jobs` 表**，新增 4 列：`organization_id`（nullable, 平台级 cron 保留 NULL）、`kind`（`'platform' | 'workflow_template'`, 默认 `'platform'` 保留旧行）、`workflow_template_id`（指向 `workflow_templates.id`, 仅 `kind='workflow_template'` 时非空）、`payload`（jsonb, 当 kind='workflow_template' 时承载 `inputParams`）。
- **新增一条 typed event** `scheduled-jobs/workflow-template.run`，payload 在原 `ScheduledJobPayload` 之外多带 `workflowTemplateId`、`organizationId`、`inputParams`。
- **新增一个 Inngest 函数**订阅该 event，调用一个新的 service 版 `startMissionFromTemplateScheduled(templateId, orgId, inputs, { scheduledJobId })`，绕过 `requireAuth`、显式传 orgId、把 `mission.sourceModule='schedule'` + `sourceEntityId=scheduledJobId` 写入做天然去重。
- **`scheduledJobsRunner` 派发逻辑分叉**：根据 `job.kind` 选择派发 typed 平台事件（保持向后兼容）还是 `workflow-template.run` 事件（附带 payload）。
- **新增 DAL** `src/lib/dal/workflow-template-schedules.ts`：list / create / update / toggle / delete，多租户按 `organizationId` 过滤。
- **新增 server actions** `src/app/actions/workflow-template-schedules.ts`：所有写操作走 `requireAuth` + 校验模板所有权 + 校验 cron 表达式合法（用 `cron-parser`）+ `revalidatePath`。
- **新增 UI** `/workflows/[id]` 的"定时任务"tab（与现有"基本信息""步骤"等 tab 并列），列出该模板的全部 schedule、支持新增 / 启用禁用 / 删除、附"下一次执行时间"实时预览。
- **MODIFIED**：`workflow_templates.triggerConfig` 字段标记为 `@deprecated`（保留列避免破坏旧行，但 UI 与新启动路径都不再读它）；`triggerType` 枚举的 `scheduled` 值由 stub 升级为实际"该模板存在至少一条 enabled schedule"的派生状态（runtime 计算，不写库）。
- 不在范围：webhook 触发、API key 触发、跨模板编排（`scheduled_jobs.kind` 预留枚举位但 V1 只实现 `platform` + `workflow_template` 两种）。

## Impact

- **Affected specs**: 新增 capability `workflow-template-scheduling`（首次为该领域立 spec）。
- **Affected code**:
  - `src/db/schema/scheduled-jobs.ts` — 加 4 列 + 新增 `scheduled_job_kind` 枚举
  - `src/db/schema/workflows.ts` — 注释 `triggerConfig` 为 deprecated（不删列）
  - `src/inngest/events.ts` — 新增 1 个 typed event + 扩展 `ScheduledJobPayload` 联合类型
  - `src/inngest/functions/scheduler/scheduled-jobs-runner.ts` — 派发分叉逻辑
  - `src/inngest/functions/` 新增 `workflow-template-scheduled-launch.ts`
  - `src/app/actions/workflow-launch.ts` — 拆出 `startMissionFromTemplateScheduled` service 入口
  - `src/lib/dal/workflow-template-schedules.ts`（新增）
  - `src/app/actions/workflow-template-schedules.ts`（新增）
  - `src/app/(dashboard)/workflows/[id]/` — 加"定时任务"tab + 子组件
  - Drizzle migration（一个 `db:generate` 产出）
- **Affected ops**: 管理员侧 `/admin/scheduled-jobs` 现有列表需增加"租户 + 关联模板"两列展示（kind=workflow_template 的 job），但保留旧列表能完整看到平台级 cron。
- **Risk surface**:
  - 多租户 cron 风暴（10 org × 30 模板 × `* * * * *`）→ 在 server action 校验时拒绝周期 < 1 分钟的 cron，并在 runner 内做 per-org dispatch jitter
  - schedule 派发 → mission 启动失败的可观测性 → 复用现有 `last_run_status` 字段，并写一行 `team_messages` 让用户在 mission 详情里看到"由定时任务 #xxx 触发"


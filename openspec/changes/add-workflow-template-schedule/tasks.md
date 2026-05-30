# Tasks

## 1. Schema 与基础设施

- [x] 1.1 在 `src/db/schema/enums.ts` 新增 `scheduledJobKindEnum`(值:`platform`、`workflow_template`)
- [x] 1.2 在 `src/db/schema/scheduled-jobs.ts` 加 4 列:`organizationId`(uuid,nullable,外键 `organizations.id`)、`kind`(enum,default `'platform'`)、`workflowTemplateId`(uuid,nullable,外键 `workflow_templates.id`)、`payload`(jsonb,nullable)
- [x] 1.3 加复合索引 `(organization_id, kind, workflow_template_id, enabled)` 支持"按租户/模板查 schedule"
- [x] 1.4 在 `workflow_templates.triggerConfig` 字段头加 `@deprecated` JSDoc 注释(不删字段)
- [x] 1.5 `npm run db:generate` 产出 migration(`supabase/migrations/0042_funny_gorilla_man.sql`);review SQL 输出确认无意外 DROP/RENAME
- [x] 1.6 `npm run db:migrate` 应用到 dev DB;跑 `bash scripts/verify-schema-sync.sh` 确认 fingerprint 全绿

## 2. DAL 与 service 入口

- [x] 2.1 新建 `src/lib/dal/workflow-template-schedules.ts`:`listSchedulesByTemplate(orgId, templateId)`、`listSchedulesByOrg(orgId)`、`getScheduleById(orgId, id)`、`createSchedule(orgId, input)`、`updateSchedule(orgId, id, input)`、`toggleSchedule(orgId, id, enabled)`、`deleteSchedule(orgId, id)`、`listSchedulesWithTemplateName(orgId)`
- [x] 2.2 所有 DAL 函数严格 `WHERE organization_id = orgId AND kind = 'workflow_template'`,避免误读平台级 cron
- [x] 2.3 在 `src/lib/cron.ts`(新建)写 `validateCronExpression(expr, timezone)`:用 `cron-parser` 校验合法 + 检查相邻两次执行间隔 ≥ 60 秒(拒绝高频)
- [x] 2.4 在 `src/app/actions/workflow-launch.ts` 抽出 `_buildAndInsertMission(orgId, templateId, inputs, options)` + `_insertMissionRow` 内部 helper,让两个入口共享
- [x] 2.5 新增 `startMissionFromTemplateScheduled(templateId, orgId, inputs, options)` —— 跳过 `requireAuth`、显式接 orgId、`options.source = { module: "schedule", entityId: scheduledJobId, entityType: "scheduled_job" }`
- [x] 2.6 单元测试:`__tests__/workflow-launch.test.ts` 加 4 个 case 覆盖 scheduled 路径(验证 requireAuth/getCurrentUserOrg 不被调用、source 去重、race 处理、cross-org 拒绝)。12/12 通过

## 3. Server actions(运营写路径)

- [x] 3.1 新建 `src/app/actions/workflow-template-schedules.ts`,导出 `createWorkflowTemplateSchedule` / `updateWorkflowTemplateSchedule` / `toggleWorkflowTemplateSchedule` / `deleteWorkflowTemplateSchedule`
- [x] 3.2 每个 action `requireAuth()` + 校验当前用户 org 拥有该 `workflowTemplateId`(via `_loadOwnedTemplate` helper)
- [x] 3.3 创建/更新时调 `validateCronExpression` 拒绝高频 cron 并返回字段级错误(与 `startMissionFromTemplate` 错误格式一致)
- [x] 3.4 写入成功后 `revalidatePath(\`/workflows/\${templateId}\`)` 与 `/admin/scheduled-jobs`

## 4. Inngest 事件与调度器

- [x] 4.1 在 `src/inngest/events.ts` 新增 `"scheduled-jobs/workflow-template.run"` 联合类型,payload 包含 `jobName`、`jobId`、`dispatchedAt`、`scheduledAt`(同基础 `ScheduledJobPayload`) + `workflowTemplateId`、`organizationId`、`inputParams`
- [x] 4.2 修改 `src/inngest/functions/scheduler/scheduled-jobs-runner.ts`:在派发循环里按 `job.kind` 分叉 —— `'platform'` 走老逻辑(cast 到既有 typed event);`'workflow_template'` 派 `scheduled-jobs/workflow-template.run` event,data 里塞 `job.workflowTemplateId` / `job.organizationId` / `job.payload`。引入 `PlatformScheduledEventName` 类型缩窄避免新 event 串到老路径
- [x] 4.3 在多 workflow_template job 批量派发时加 per-job ±15 秒 jitter。**实现偏离原 spec**:采用 Inngest `sendEvent` 的 `ts` 字段(durable delayed delivery)而非 `step.sleep`,因为后者在 for 循环中会序列化,30+ jobs 时会超 60s tick 窗口。jitter 通过 `computeJitterMs(jobId)` deterministic 计算,便于排查
- [x] 4.4 新建 `src/inngest/functions/workflow-template-scheduled-launch.ts`:订阅 `scheduled-jobs/workflow-template.run`、调 `startMissionFromTemplateScheduled`、retries: 3、失败时回写 `scheduled_jobs.lastRunStatus='failed'` + `totalFailures+=1` 并回滚 `totalRuns`(scheduler 已 +1)。注:原 spec 提到的 `team_messages` 表已被 `mission_messages` 替代;后者要求 missionId,pre-mission 失败无法写入,改为依赖 logger + scheduled_jobs row 状态
- [x] 4.5 在 `src/inngest/functions/index.ts` 注册新函数
- [x] 4.6 跳过完整 Inngest function 集成测试(项目现有 Inngest 测试均为降级模式,见 `research/__tests__/report-generate.test.ts` 的说明)。startMissionFromTemplateScheduled 端到端覆盖由 `workflow-launch.test.ts` 4 个新 case 验证,runner 分叉逻辑由 dev 环境手工验证(task 7.6)

## 5. UI(`/workflows/[id]` 定时任务 tab)

- [x] 5.1 在 `src/app/(dashboard)/workflows/[id]/page.tsx` 加 `listSchedulesByTemplate` 数据加载;`workflow-detail-client.tsx` 现有 tab 结构加"定时任务"tab,带 count badge
- [x] 5.2 新建 client 组件 `schedule-list-client.tsx`:用 `DataTable` 展示 schedule 列表(列:启用 toggle、displayName、cron、timezone、上次执行、下次执行、操作)
- [x] 5.3 新建 `schedule-form-dialog.tsx`:表单含 displayName、description、cron expression(带"下一次执行预览",用 `cron-parser` 在浏览器端跑 3 次 nextRun)、timezone(默认 `Asia/Shanghai`)、payload 编辑器(按模板 `inputFields` 渲染表单,复用 `WorkflowLaunchDialog` 导出的 `FieldRenderer`)
- [x] 5.4 用统一 shared primitives:`<DataTable>`、`<Button>`、`<Input>`、`<Textarea>`、`<Switch>`、`<Dialog>` 等;遵循 CLAUDE.md 设计系统规则(无原生 `<input type=checkbox>`,改 `<Switch>`)
- [x] 5.5 空态:列表为空时展示 GlassCard 居中提示 + "新建第一条" CTA(`variant="ghost"` 无边框)

## 6. 管理员后台兼容

- [x] 6.1 `/settings/scheduled-jobs` 列表加列"类型 / 关联"(kind=platform 显示"平台级"灰标;kind=workflow_template 显示紫色"工作流模板"标签 + org name + 模板名链接到 `/workflows/{id}`)。新增 DAL `listScheduledJobsWithRelations` LEFT JOIN org + template
- [x] 6.2 列表头部加 kind 筛选 `<Select>`("全部/平台级/工作流模板",各带计数)

## 7. 文档与验证

- [x] 7.1 更新 CLAUDE.md "Inngest" 章节,描述 scheduledJobsRunner 按 kind 分叉 + 新 `workflowTemplateScheduledLaunch` 函数
- [x] 7.2 在 CLAUDE.md 新增 "Workflow Template Schedules" 子章节,说明 DAL / actions / cron 校验 / service 入口 / 触发链路
- [x] 7.3 在 `docs/adr/` 新增 ADR-0002 `2026-05-29-workflow-template-schedule-on-scheduled-jobs.md` 记录"schedule 嫁接 scheduled_jobs 而非新表"的决策,并在 CLAUDE.md ADR 列表中加引用
- [x] 7.4 `npx tsc --noEmit` 全绿(零错误)
- [x] 7.5 `npm run build` 通过(34 dashboard routes 编译通过)
- [ ] 7.6 手工验收:在 dev 环境创建一条 `*/5 * * * *`(每 5 分钟)schedule,等 5 分钟确认 mission 自动启动 + `last_run_at` 更新 —— **留给 owner 在 dev 环境执行**
- [x] 7.7 `openspec validate add-workflow-template-schedule --strict --no-interactive` 通过

## 8. 编辑器 Trigger UI 重构(2026-05-29 追加)

**背景:** 提案最初只动详情页"定时任务" tab,没动 `/workflows/[id]/edit` 编辑器里那张读 `triggerConfig` 的"触发器"卡片。运营看到"定时触发:每天 10:00"却点不进去改 cron,也无法理解卡片跟新 schedule 系统的关系。本节把编辑器统一到 schedule 系统。

- [x] 8.1 重写 `src/components/workflows/trigger-card.tsx`:props 由 `triggerType/triggerConfig` 换成 `scheduleCount/enabledCount/nextSummary`,卡片显示"定时任务 N/M 启用中 · 摘要",右侧 CTA "管理定时" / "添加定时"
- [x] 8.2 新建 `src/components/workflows/schedule-sheet.tsx`:右侧 Sheet 嵌入 `ScheduleListClient`,带 `onSchedulesChange` 回调把列表变化向上回传
- [x] 8.3 给 `ScheduleListClient` 加可选 `onSchedulesChange` prop;`setSchedules` 包装一层同步外部 listener。详情页 tab 不传 callback,行为不变
- [x] 8.4 重构 `src/components/workflows/workflow-editor.tsx`:
  - 删 `triggerType` / `triggerConfig` / `isEnabled` 三个 state(以及 `handleToggleEnabled`)
  - 加 `schedules` state(从新 prop `initialSchedules` 初始化)+ `scheduleSheetOpen` state
  - `handleTriggerClick` 改为打开 Sheet;create mode 下提示先保存
  - `handleSave` 调 server action 时始终传 `triggerType: "manual"` + `triggerConfig: null`(API 签名保持兼容,但不再写 deprecated 字段)
  - `runTestWithInputs` 始终以 manual + null 模拟测试运行
  - `handleWorkflowGenerated` 丢弃 AI 生成的 triggerType/triggerConfig
- [x] 8.5 重构 `BottomActionBar`:移除 `onToggleEnabled` / `isEnabled` / `triggerType` 三个 prop 与"开启/已开启"按钮,只保留"测试运行" + "保存更改"
- [x] 8.6 更新 `WorkflowCanvas`:props 由 `triggerType/triggerConfig` 改为 `scheduleCount/enabledScheduleCount/nextScheduleSummary`,转交给 TriggerCard
- [x] 8.7 更新 `/workflows/[id]/edit/page.tsx`:用 `listSchedulesByTemplate(orgId, id)` 加载 schedule 列表,通过 `initialSchedules` + `workflowMeta` 两个新 prop 传给 WorkflowEditor
- [x] 8.8 在 spec.md 加 `MODIFIED Requirement: Legacy triggerConfig Stub Is Deprecated`(扩展到包含编辑器 UI 删除)+ `ADDED Requirement: Editor Trigger Card Surfaces Schedule Management Sheet`(4 个 scenario)
- [x] 8.9 `npx tsc --noEmit` 通过 + `npm run build` 通过 + `vitest workflow-launch` 12/12 通过 + `openspec validate --strict` 通过

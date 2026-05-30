# Workflow Template Scheduling

## ADDED Requirements

### Requirement: Per-Template Schedule Configuration

A `workflow_template` SHALL support 0..N independently configured cron schedules. Each schedule MUST belong to one organization, target exactly one template, store a cron expression with timezone, an enabled flag, and a default `inputParams` payload (matching the template's `inputFields` shape).

#### Scenario: Operator creates a schedule for a template

- **WHEN** an authenticated operator opens `/workflows/{templateId}` 定时任务 tab and submits the schedule form with `cronExpression="0 9 * * 1-5"`, `timezone="Asia/Shanghai"`, `payload={topic:"hot-news"}`
- **THEN** a row is inserted into `scheduled_jobs` with `kind='workflow_template'`, `organization_id` = operator's org, `workflow_template_id` = the template's id, `payload` = the submitted params, `enabled=true`
- **AND** the form returns success and the schedule appears in the tab's list with computed `nextRunAt`

#### Scenario: Template can hold multiple independent schedules

- **WHEN** a template already has one schedule (`0 9 * * *`) and an operator adds a second (`0 18 * * *`)
- **THEN** both rows coexist; toggling one's `enabled` does not affect the other; deleting one preserves the other

#### Scenario: Schedule is org-scoped

- **WHEN** operator A in org X queries schedules for template T (which exists in org X) via the DAL
- **THEN** only rows with `organization_id = X` and `workflow_template_id = T` and `kind='workflow_template'` are returned; no platform-level cron rows (`kind='platform'`) appear; no rows from other orgs leak

### Requirement: Cron Expression Validation

The system MUST validate cron expressions on the server before persisting and reject expressions whose computed interval between two consecutive runs is less than 60 seconds.

#### Scenario: Valid cron expression is accepted

- **WHEN** server action receives `cronExpression="0 9 * * *"` and `timezone="Asia/Shanghai"`
- **THEN** the server parses with `cron-parser`, computes two successive runs are 24h apart, and persists the row

#### Scenario: Sub-minute cron is rejected

- **WHEN** server action receives `cronExpression="* * * * *"` (every minute) for `kind='workflow_template'`
- **THEN** the server returns a field-level error `{cronExpression: "执行周期不能小于 1 分钟"}` and does not persist

#### Scenario: Malformed cron is rejected

- **WHEN** server action receives `cronExpression="invalid"`
- **THEN** `cron-parser` throws; the server catches and returns `{cronExpression: "cron 表达式格式错误"}`

### Requirement: Master Scheduler Dispatches Workflow-Template Schedules

The existing `scheduledJobsRunner` (`src/inngest/functions/scheduler/scheduled-jobs-runner.ts`) MUST treat `scheduled_jobs` rows with `kind='workflow_template'` differently from `kind='platform'` rows: instead of dispatching the row's hardcoded `eventName`, it MUST dispatch a single typed event `scheduled-jobs/workflow-template.run` whose data payload includes `workflowTemplateId`, `organizationId`, and `inputParams` from the row.

#### Scenario: Workflow-template job is due and dispatched

- **WHEN** the runner's minute tick selects a row with `kind='workflow_template'`, `enabled=true`, `nextRunAt <= now`
- **THEN** the runner calls `step.sendEvent` with name `scheduled-jobs/workflow-template.run` and data `{ jobName, jobId, dispatchedAt, scheduledAt, workflowTemplateId, organizationId, inputParams }`
- **AND** updates the row's `lastRunAt`, `lastRunStatus='success'`, `totalRuns += 1`, and recomputes `nextRunAt`

#### Scenario: Platform-kind jobs continue old behavior

- **WHEN** the runner's tick processes a row with `kind='platform'` (the 13 legacy rows)
- **THEN** the runner casts `row.eventName` to the existing typed union and dispatches it unchanged
- **AND** the row's update path is identical to current behavior

#### Scenario: Burst protection via jitter

- **WHEN** the runner's tick selects ≥ 5 workflow-template-kind rows all due in the same minute
- **THEN** each dispatch is offset by a ±15-second jitter implemented via Inngest's durable `step.sleep("jitter", "Xs")` (no sandbox-unsafe timers)
- **AND** all rows still get dispatched within the same minute window

### Requirement: Scheduled Mission Launch Service Path

A new service function `startMissionFromTemplateScheduled(templateId, orgId, inputs, options)` MUST exist that mirrors `startMissionFromTemplate` but accepts an explicit `orgId` (instead of resolving from session) and skips `requireAuth()`. The resulting `mission` row MUST have `sourceModule='schedule'` and `sourceEntityId={scheduledJobId}` so the existing partial unique index `missions_source_dedup_uidx` prevents duplicate insertions from the same schedule.

#### Scenario: Scheduled launch creates a mission with proper provenance

- **WHEN** the new Inngest function `workflow-template-scheduled-launch` receives `scheduled-jobs/workflow-template.run` event for schedule `S` referencing template `T` in org `O` with `inputParams={...}`
- **THEN** it calls `startMissionFromTemplateScheduled(T, O, inputParams, { source: { module: "schedule", entityId: S, entityType: "scheduled_job" } })`
- **AND** the mission row is created with `organizationId=O`, `workflowTemplateId=T`, `sourceModule="schedule"`, `sourceEntityId=S`
- **AND** leader is resolved via `getOrProvisionLeader(O)` and team is resolved via `template.defaultTeam` slug→employee-id mapping (identical to manual launch path)

#### Scenario: Concurrent scheduler ticks do not double-insert missions

- **WHEN** two concurrent ticks both attempt to launch the same schedule `S` (e.g. transient duplicate dispatch)
- **THEN** the second insert hits the partial unique index, is detected as duplicate, and reuses the winning mission id without erroring the Inngest function
- **AND** only one mission row exists for `(O, "schedule", S)`

#### Scenario: Scheduled launch failure is observable

- **WHEN** `startMissionFromTemplateScheduled` throws (e.g. template input validation fails after schema drift)
- **THEN** the Inngest handler updates `scheduled_jobs` row with `lastRunStatus='failed'` and increments `totalFailures`
- **AND** writes a system message to `team_messages` for the org's team identifying the failing schedule by name
- **AND** the Inngest function retries up to 3 times per Inngest's standard retry policy

### Requirement: Operator-Facing Schedule Management UI

The dashboard MUST expose schedule CRUD inside `/workflows/{templateId}` as a dedicated "定时任务" tab using the project's shared design primitives (`<DataTable>`, `<Button>`, `<Input>`, `<DatePicker>`, `<SearchInput>`), not bespoke markup.

#### Scenario: Operator sees per-template schedule list

- **WHEN** an authenticated operator opens `/workflows/{templateId}` and switches to "定时任务" tab
- **THEN** the page renders a `<DataTable>` with columns: enabled toggle, displayName, cronExpression, timezone, lastRunAt, nextRunAt, actions
- **AND** an empty-state CTA appears when no schedules exist
- **AND** all buttons in the tab are borderless per the project's CLAUDE.md instruction

#### Scenario: Cron input shows live next-run preview

- **WHEN** the operator types a valid cron expression into the schedule form
- **THEN** the form computes and displays "下一次执行: YYYY-MM-DD HH:mm:ss (timezone)" using `cron-parser` in the browser
- **AND** an invalid expression instead shows an inline error without crashing the form

#### Scenario: Toggle persists immediately

- **WHEN** the operator clicks a row's enabled toggle from on→off
- **THEN** the server action `toggleWorkflowTemplateSchedule` updates the DB row's `enabled=false`
- **AND** within at most 60 seconds the master scheduler's next tick stops dispatching for this row
- **AND** the row's `nextRunAt` is not recomputed while disabled

### Requirement: Admin Backend Continuity for Existing Cron List

The existing `/admin/scheduled-jobs` page MUST continue to list all `scheduled_jobs` rows (both `kind='platform'` and `kind='workflow_template'`) and add columns showing the row's tenant and linked template for the `workflow_template` kind.

#### Scenario: Admin sees both kinds in one list

- **WHEN** a platform admin opens `/admin/scheduled-jobs`
- **THEN** rows of both kinds appear; the 13 legacy platform cron rows show "平台级" in the tenant column and "—" in the template column; workflow_template rows show the org name and a template name link
- **AND** a kind filter allows narrowing to either category

### Requirement: Legacy `triggerConfig` Stub Is Deprecated

The `workflow_templates.triggerConfig` jsonb column AND its companion `triggerType` enum MUST be marked deprecated in the schema; no new code (UI, server actions, or runtime consumers) MAY read or write them as decision inputs. The columns SHALL be retained for backward compatibility but not removed in this change. The legacy "开启/已开启" toggle in the workflow editor's bottom action bar and the "手动 ↔ 定时" trigger-type toggle in the canvas's TriggerCard MUST be removed in favor of the schedule system.

#### Scenario: New code does not depend on triggerConfig

- **WHEN** grepping `src/` after this change ships
- **THEN** the only references to `triggerConfig` / `triggerType` are the schema definition (with `@deprecated` JSDoc), the server-action signature (preserved for backward-compat but always called with `triggerType: "manual"` + `triggerConfig: null` from the editor), and any pre-existing read-only diagnostic logging
- **AND** no UI surface presents these fields for editing

#### Scenario: Editor's bottom action bar no longer has "开启/已开启" toggle

- **WHEN** the operator opens `/workflows/[id]/edit`
- **THEN** the bottom action bar shows only "测试运行" and "保存更改" buttons
- **AND** no toggle that purports to enable/disable scheduling appears (since that toggle was a stub that only mutated React state without persisting)

### Requirement: Editor Trigger Card Surfaces Schedule Management Sheet

When the operator is editing a workflow at `/workflows/[id]/edit`, the canvas's "入门" section MUST present a TriggerCard that summarizes the template's currently mounted schedules and, on click, opens a Sheet embedding the same `ScheduleListClient` used by the detail-page "定时任务" tab so the operator can perform full CRUD without leaving the editor.

#### Scenario: TriggerCard reflects current schedule count

- **WHEN** the operator opens `/workflows/[id]/edit` for a template with 2 enabled and 1 disabled schedules
- **THEN** the TriggerCard shows "定时任务 2/3 启用中 · {次最近一条 cron 摘要}"
- **AND** when the operator adds, edits, deletes, or toggles a schedule inside the Sheet the TriggerCard's count updates immediately without a page reload

#### Scenario: TriggerCard click opens the Sheet

- **WHEN** the operator clicks the TriggerCard on an edit-mode page (workflow has an id)
- **THEN** a right-side Sheet opens with the schedule list, "新建定时任务" CTA, and per-row toggle/edit/delete actions
- **AND** the operator can close the Sheet via the standard Sheet close affordance

#### Scenario: Create-mode editor defers schedule configuration

- **WHEN** the operator opens `/workflows/new` (no persisted template id yet) and clicks the TriggerCard
- **THEN** a toast informs the operator "请先保存工作流,然后再配置定时任务"
- **AND** the Sheet does not open

#### Scenario: TriggerCard shows manual-only when no schedule exists

- **WHEN** the operator opens `/workflows/[id]/edit` for a template with zero schedules
- **THEN** the TriggerCard shows "手动触发(尚未配置定时任务)" and an "添加定时" CTA
- **AND** clicking it opens the Sheet so the operator can add the first schedule

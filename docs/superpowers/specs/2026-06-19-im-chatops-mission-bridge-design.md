# IM ChatOps → Mission 引擎 Design（统一渠道通道）

## Summary

把 IM（钉钉 / 企微 / 飞书）当成 mission 引擎的一个**对话式前端**：用户在群里 @机器人 发自然语言请求 → VibeTide 后台做意图识别，不清楚就**多轮澄清**，问清楚后规划并启动一个 ad-hoc mission → mission 多步执行（过程留站内）→ **只把最终结果（markdown 摘要 + 查看链接）发回 IM**。

明确**不做**对话中心（cowork）双向同步——IM 交互自成闭环（IM ↔ 澄清 agent ↔ mission 引擎），mission 照常出现在站内 mission 控制台。

本期只做**钉钉**，渠道适配层留好抽象口，企微/飞书后续接入。

> **本设计已过一轮 spec 评审**，修正了三处关键事实（详见「结果回执（核心新建，非复用）」「实现期事实更正」）：① `mission-notifier` 是零调用死代码，不可复用；② `mission.sourceContext` 结构化列不存在；③ `recognizeIntent` 不产澄清问题。回执闭环按这些事实重新设计。

## 决策汇总（已与 owner 确认）

| 决策 | 结论 |
|---|---|
| 触发自由度 | 自由自然语言 → LLM 规划 ad-hoc mission |
| 平台范围 | 钉钉先做通，适配器留口；企微/飞书 P2 |
| 会话粒度 | per(configId + chatId + externalUserId)，群里各人澄清互不干扰 |
| 执行并发 | 一个会话同时只跑一个 mission；运行中再发回"上一个还在处理中" |
| 澄清上限 | ≤5 轮；闲置 30 分钟过期重置 |
| 结果形态 | markdown 摘要 + "在系统查看"链接 |
| 对话中心 | 不做双向同步（明确 out-of-scope） |

## Scope

In scope：
- 钉钉群 @机器人 发自然语言 → 多轮澄清 → 规划 ad-hoc mission → 执行 → 结果回群。
- `channel_sessions` 会话状态机（多轮上下文 + 状态 + 并发 + 过期 + **渠道三元组**，作为回执反查与去重的真相源）。
- `clarifyOrPlan` 澄清 agent（**新写**的澄清感知 LLM 调用）。
- 无登录态 ad-hoc mission 启动器（抽取 `startAdHocMission` 的物化 helper）。
- **结果回执闭环（核心新建）**：mission 完成 → 取产物 → 经渠道出站发回群。

Out of scope：
- 对话中心（cowork）双向同步 / 镜像。
- 企微、飞书适配（P2，本期只留抽象口）。
- 把 mission 中间过程/产物文件推回 IM（只回最终结果）。
- 把"链接收稿"硬编码分支重构进澄清循环（本期并存）。
- 修复/删除 `mission-notifier` 死代码（本期不依赖它，也不动它）。

## Architecture

分层（详见架构图）：

```
IM(钉钉/企微/飞书) ↕ 接收+发送
渠道适配层（钉钉 Stream ✓ / 企微 ◐ / 飞书 待建）
   ↓
网关 + 会话状态 channel_sessions（新）
   ↓
clarifyOrPlan：够清楚？ ──不清楚──▶ 澄清问题（sessionWebhook）回 IM（多轮）
   ↓ 清楚
无登录态 ad-hoc 启动器（抽取自 startAdHocMission 的物化 helper）
   ↓ executeMissionDirect（过程留站内）
完成回调 → 结果回执（新建）── markdown 摘要 + 查看链接 ──▶ 经 config.appKey 自定义机器人 webhook 发回 IM
```

## 核心：澄清状态机

`channel_sessions` 键 = (configId, chatId, externalUserId)，一个 IM 会话一份状态。**它同时是回执反查的真相源**（存渠道三元组 + activeMissionId）：

| 字段 | 说明 |
|---|---|
| organizationId / configId / platform / chatId / externalUserId | 渠道三元组 + 归属（回执反查用） |
| status | `idle` / `clarifying` / `running` |
| contextTurns | jsonb，累积多轮上下文 [{role, content}] |
| activeMissionId | running 时关联的 mission（完成回执 / 复位用） |
| clarifyRounds | 已澄清轮数（≤5 上限） |
| expiresAt | 闲置 30 分钟过期 |

`clarifyOrPlan(orgId, session, message)` —— **一次新写的、澄清感知的 LLM 调用**（不是"包一层"）。现有 `recognizeIntent` 只回 `confidence` 数值、**不产澄清问题**，所以要新写 prompt 输出判别式结果；execute 分支可选择性复用 `recognizeIntent` 做 steps 规划：
- `{ action: "clarify", question }` —— 信息不足，回一个澄清问题
- `{ action: "execute", summary, steps }` —— 信息够，规划好 steps 可执行

## 数据流

1. 入站消息 → 载 / 新建 session（按三元组键）。
2. session.status == `running` → 回"⏳ 上一个请求还在处理中，稍候"，不打断。
3. 否则 `clarifyOrPlan`（LLM，数秒）：
   - `clarify` → 回澄清问题（**走 sessionWebhook**，快）；status=`clarifying`；clarifyRounds++；追加 contextTurns。轮数 >5 → 回"没太理解，请换个说法或用 #命令"并重置。
   - `execute` → 调无登录态 ad-hoc 启动器（显式 orgId；mission 打 `sourceModule='channel:dingtalk'` + `sourceEntityId=externalMessageId` 仅作去重/审计）；session.status=`running`、记 activeMissionId；秒回"✅ 收到，正在处理：<summary>"。
4. **完成回执（核心新建）**：ad-hoc 启动器在 `executeMissionDirect(...).then()` 完成回调里 → 取 mission 最终产物 → **按闭包内的渠道三元组**（config.appKey）发 **markdown 摘要 + 查看链接**（`/missions/[id]` 或主产物 `/articles/[id]`）回群 → 复位 session 为 `idle`。失败走 `.catch()` 回失败原因。

> 回执**不经** `mission-notifier`（死代码）、也**不依赖** `mission.sourceContext`（列不存在）。渠道三元组由启动器闭包持有（来自触发时的 StandardizedMessage），回执直接用它取 config 出站；session.activeMissionId 仅用于并发判定与复位。

## 出站时序（关键约束）

- **澄清问题**：紧跟用户消息、在 sessionWebhook 有效期（约几分钟）内 → 用 **sessionWebhook**（`postToSessionWebhook` 现成）。
- **最终结果**：mission 可能跑几分钟、sessionWebhook 多半过期 → 走 **自定义机器人 webhook（`config.appKey`）**（`sendChannelMessage` → `sendDingtalkMessage` 现成，一直有效）。
- 代价：自定义机器人 webhook 一个只能发到它所在的一个群 → **多群要每群配一个自定义机器人 webhook**（单群无忧；该自定义机器人也要在群里）。
- 实现：最终结果优先尝试仍有效的 sessionWebhook（mission 快时），过期回退 config.appKey。

## 结果回执（核心新建，非复用）

⚠️ 评审确证：现有回执链**断裂**，本期必须新建，**不能**当"待确认"小事：
- `mission-notifier`（`notifyMissionStatus` / `getMissionOriginChannel`）**零调用、死代码**；mission 两条完成路径（`mission-executor.ts` 直跑 / Inngest `leader-consolidate`）都只写 DB status，无任何渠道通知 hook。
- `getMissionOriginChannel` 按 `channel_messages.missionId(inbound)` 反查，但 `recordInboundMessage` 无 missionId 入参 → 该关联从未建立 → 对任何 mission 都返回 null。
- `mission.sourceContext` 结构化列不存在（`startMissionFromModule` 只把它塞进 instruction 文本）。

**因此新建：**
- **完成派发**：在无登录态 ad-hoc 启动器内 `void executeMissionDirect(missionId, orgId).then(() => sendChannelResult(channelCtx, missionId)).catch((err) => sendChannelFailure(channelCtx, err))`。channelCtx 由触发消息闭包持有，**不查 mission.source\* 也不查 channel_messages**。`executeMissionDirect` 经核实是"全相 await 完才 resolve"（`mission-executor.ts:2125`），故 `.then()` 成立。
- **`sendChannelResult(channelCtx, missionId)`**（新）：读 mission `finalOutput` → 拼 markdown 摘要 + 链接（`/missions/[id]`）→ `getChannelConfig(channelCtx.configId)` → `sendChannelMessage`（appKey）→ 复位 session。
  ⚠️ **必处理两点**（评审确认）：
  1. `finalOutput` 形态随完成降级级别不同：Level 1（满额完成）是 `StepOutput`、有 `.summary`；Level 2/3（超时降级）只有 `.message`；Level 4（失败）`{error, message, failureReasons}`。取摘要须 `finalOutput.summary ?? finalOutput.message ?? 兜底文案`，否则降级 mission 回执拿到 `undefined`。
  2. Level 4 失败是 mission **正常 resolve 返回 `status:"failed"`**（不抛异常），`.catch()` 兜不住。`sendChannelResult` 内须自行判 `mission.status === "failed"` 走失败文案——失败兜底**不能只靠** `.catch()`（`.catch()` 只兜 executeMissionDirect 本身抛错的极端情况）。
- **完成时机依赖（实现期第一步必须验证）**：上述 `.then()` 成立的前提是 `executeMissionDirect` **解析于 mission 完成**（直跑路径）。若它实为"派发即返回"（异步走 Inngest，不等完成），则改为新增一个 `mission/completed` Inngest 事件 + handler 做回执。**Plan 第 1 步先读 `mission-executor.ts` 确认 executeMissionDirect 的解析语义，再定回执挂载点。**
- 局限：`.then()` 回调跑在 Stream worker 进程内；worker 若在 mission 执行中重启，回执丢失（mission 仍在 DB 完成、站内可见）。P2 用 Inngest 完成事件做持久化回执。

## Components

新建：
- `src/db/schema/channel-sessions.ts` —— `channel_sessions` 表 + 唯一索引 (configId, chatId, externalUserId)。
- `src/lib/dal/channel-sessions.ts` —— `getOrCreateSession` / `updateSession` / `resetSession`（无 auth，按三元组键）。
- `src/lib/channels/clarify-or-plan.ts` —— `clarifyOrPlan`，**新写澄清感知 LLM 调用**，返回判别式结果。
- `src/lib/channels/start-channel-mission.ts` —— 无登录态 ad-hoc 启动器：调抽取出的物化 helper 建 mission（scenario='custom'）+ fire-and-forget 执行 + 完成回执。
- `src/lib/channels/channel-result-notify.ts` —— `sendChannelResult` / `sendChannelFailure`（按 channelCtx 出站 + 复位 session）。

复用 / 抽取：
- 钉钉 Stream 接收（`scripts/dingtalk-stream.ts`）/ HTTP webhook route。
- `recognizeIntent`（`src/lib/agent/intent-recognition.ts`）—— 仅 execute 分支 steps 规划可选用。
- **抽取**：把 `startAdHocMission`（`src/app/actions/ad-hoc-mission.ts`）里物化 mission + task DAG + executeMissionDirect 的内联逻辑抽成收显式 orgId 的内部 helper（去掉 requireAuth），登录态/无登录态两入口共用。
- `sendChannelMessage`（`outbound.ts`）/ `postToSessionWebhook`（`session-webhook.ts`）/ `getChannelConfig`（`dal/channels.ts`）。

改动：
- `src/lib/channels/gateway.ts` `handleInboundMessage` 自由消息分支：现 MVP "已识别意图" → 换成 session-aware 澄清循环。`#命令` 与 链接收稿 快速路径保留不动。

**不依赖**：`mission-notifier.ts`（死代码，本期不碰）、`mission.sourceContext`（不存在）、cowork conversations。

## Schema

```
channel_sessions
  id              uuid pk
  organization_id uuid not null  → organizations
  config_id       uuid not null  → channel_configs
  platform        channel_platform_enum not null   -- 现 enum 仅 dingtalk/wechat_work（飞书 P2 再扩）
  chat_id         text not null
  external_user_id text not null
  status          text not null default 'idle'      -- idle | clarifying | running
  context_turns   jsonb not null default '[]'
  active_mission_id uuid → missions (set null)
  clarify_rounds  integer not null default 0
  expires_at      timestamptz
  created_at / updated_at
  UNIQUE (config_id, chat_id, external_user_id)
```

迁移：本地 `db:push`（journal 空；**push 是交互式 TUI**，加表时按提示确认，不能用管道自动应答——如卡住可直接 `db.execute` 跑 `CREATE TABLE`）；生产 `db:generate` → `db:migrate`。

## 与现有"链接收稿"的关系

- `#命令` 快速路径：保留。
- 链接收稿（`extractUrls` → link-ingest）：本期**保留为硬编码快速路径**（已测、可靠）；自由自然语言走澄清循环。后续可统一，本期不动。

## Error Handling

- 澄清超 5 轮 → 回"没太理解，请换个说法或用 #命令"，重置 session。
- 闲置 >30 分钟 → session 过期，下条视为新话题。
- 执行中再发 → 回"⏳ 上一个请求还在处理中"。
- mission 失败 → `.catch()` 回失败原因，复位 session。
- LLM 调用失败 → 回"系统忙，请稍后再试"，session 不前进。
- worker 在 mission 执行中重启 → 回执丢失（mission 站内仍完成）；P2 用 Inngest 完成事件兜底。
- 最终结果出站：sessionWebhook 过期且无可用 appKey → 仅记日志，不阻断 mission。

## 实现期事实更正（评审确认，Plan 必须据此）

1. `executeMissionDirect` 的解析语义（完成 vs 派发）—— Plan 第 1 步读 `mission-executor.ts` 确认，决定回执挂 `.then()` 还是新 Inngest 事件。
2. ad-hoc 物化逻辑当前**内联**在 `startAdHocMission` server action（含 requireAuth）—— 须先**抽取 helper**，不能直接 import 调用。
3. `clarifyOrPlan` 须**新写** LLM 调用产澄清问题；`recognizeIntent` 现成返回结构不足以直接产问。
4. 渠道三元组**不入** mission（无 sourceContext 列）—— 存 `channel_sessions` + 启动器闭包持有；mission 仅打 sourceModule/sourceEntityId 作去重审计。

## Verification

- 单测 `clarifyOrPlan`（mock LLM：clarify / execute 两路；累积上下文）。
- 单测 session 状态机（idle→clarifying→running→idle；轮数上限；过期；running 拦截）。
- 单测物化 helper（mock db：mission + task DAG + scenario='custom' + sourceModule 正确）。
- 单测 `sendChannelResult`（mock：取产物 → 拼 markdown+链接 → sendChannelMessage → 复位 session）。
- 单测 gateway 自由分支三路（running 拦截 / clarify / execute）。
- `npx tsc --noEmit` + `npm run build` + `npm test` 全过。

## Rollout

1. **先读 `mission-executor.ts` 定 executeMissionDirect 解析语义 + 回执挂载点**（命门）。
2. schema `channel_sessions` + DAL。
3. 抽取 ad-hoc 物化 helper（重构，保持 startAdHocMission 行为不变）。
4. `clarifyOrPlan`（TDD）+ 无登录态启动器 + `sendChannelResult`/`sendChannelFailure`（TDD）。
5. gateway 自由分支接入澄清循环。
6. 钉钉端到端手测：@机器人 发模糊请求 → 多轮澄清 → 执行 → 群里收到 markdown 结果 + 链接。

## Future（P2）

- 企微、飞书适配器（统一 `ChannelAdapter`：receive + send；飞书需先扩 `channel_platform_enum`）。
- 回执持久化：新增 `mission/completed` Inngest 事件，替代 worker 进程内 `.then()`（解 worker 重启丢回执）。
- "链接收稿"统一进澄清循环。
- 多群结果回执（每群自定义机器人 webhook 配置模型）。
- 清理 `mission-notifier` 死代码（或接入新完成事件复活它）。

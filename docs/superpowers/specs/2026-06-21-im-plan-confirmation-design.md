# Phase 1a：IM 计划确认卡 + 要素收集 Design

## Summary

把 IM 机器人的"澄清够了→直接开跑"改成"澄清够了→先给一张**计划确认卡**让用户确认/改参数→确认后才执行"。这是用户要的"让用户完成更详细参数"的核心触点。

新增会话状态 `confirming`：`clarifyOrPlan` 判定信息够（execute）后不直接执行，而是把规划好的 steps 存进 session、发一张计划卡（"我将：①②③，回复 开始 执行，或说要改的地方"）；用户回 `开始` 才执行，回 `取消` 放弃，回别的（改）则带上下文重新规划、更新卡。

要素收集 = 更聪明的澄清追问（问关键缺失项）+ 计划卡把规划摆出来让用户改，两者是同一机制。

**不在本期（Phase 1b）**：running 中的全局取消、结果后一键跟进。

## Scope

In scope：
- `channel_sessions` 加 `pendingPlan` jsonb（存待确认的 `{summary, steps}`）；新状态值 `confirming`。
- `clarifyOrPlan` 的 clarify 分支 prompt 改成"问关键缺失要素"（slot-filling 感知）。
- `formatPlanCard(summary, steps)` 计划卡格式化（纯函数）。
- gateway 自由分支：execute → 进 confirming 发卡（不直接跑）；confirming 态分流 确认 / 取消 / 改。

Out of scope（Phase 1b）：
- running 中输入"取消"中止 mission（本期 confirming 内的"取消"只是放弃未执行的计划）。
- 结果卡一键跟进（换角度/配图/发布）+ lastResult 上下文。
- 结构化参数 slot 系统（本期参数以 step 描述 + 摘要呈现，不做独立 param schema）。
- 真·中途取消 direct mission（引擎不支持，见 Phase 0 备注）。

## 会话状态机

`idle → clarifying → confirming → running → idle`（running→idle 由 Phase 0 的终态回执复位）。

| 状态 | 含义 | 进入 | 退出 |
|---|---|---|---|
| idle | 空闲 | 初始 / 复位 | 收到消息 → clarify 或 confirming |
| clarifying | 多轮澄清中 | clarifyOrPlan 判 clarify | 够清楚 → confirming |
| **confirming（新）** | 计划已提，等确认/改 | clarifyOrPlan 判 execute | `开始`→running / `取消`→idle / 改→留 confirming |
| running | mission 执行中 | confirming 收 `开始` | 终态回执（Phase 0）→ idle |

## Schema

`channel_sessions` 加一列：
```
pending_plan jsonb   -- 待确认计划 { summary: string, steps: IntentStep[] }；非 confirming 态为 null
```
`status` 是 text 列，`confirming` 直接用，无需改 enum。迁移：本地 `db:push`（交互卡住用 `db.execute` 兜底）。

> ⚠️ schema 文件（`channel-sessions.ts`）声明 `pendingPlan: jsonb("pending_plan").$type<{ summary: string; steps: IntentStep[] }>()` 需 **`import type { IntentStep } from "@/lib/agent/types";`**——有先例（`src/db/schema/workflows.ts:22` 即 `import type` 业务类型进 schema 层），`@/lib/agent/types` 无 server-only/db 依赖、不成 import 环，安全。

`updateSession` 的 `Partial<Pick<...>>` 白名单加 `pendingPlan`。

## 数据流

> **会话续期纪律（Phase 0 已建立，本期必须遵守）**：过期复位只在 `expiresAt` 非 null 时触发（`getOrCreateSession` 短路 `existing.expiresAt && ...`）。所以**每一处把 session 推进到非 idle 态的 `updateSession` 都必须写 `expiresAt: new Date(Date.now() + SESSION_TTL_MS)`（30min）**——让用户每次交互刷新 30min 窗口。confirming / 编辑重规划 / 转 running 都要写；只有复位 idle 不写（idle 不需过期）。`SESSION_TTL_MS` 已在 gateway 定义。

**进入 confirming（execute 不再直跑）**：
1. idle/clarifying 态收到消息 → `clarifyOrPlan`。
2. `clarify` → 回澄清问题（同现状，slot-filling prompt 问关键缺失项）→ clarifying（写 expiresAt）。
3. `execute` → **不执行**；`updateSession(status:"confirming", pendingPlan:{summary,steps}, contextTurns:[...turns, {role:"assistant", content: 计划卡文本}], expiresAt: now+30min)` → 回 `formatPlanCard(summary, steps)`。

**confirming 态分流**（下一条消息 `msg`）：
- 命中 `开始`/`确认`/`ok`/`yes`（`isConfirm(text)`）→ 读 `session.pendingPlan` → `startChannelMission(orgId, { message: pendingPlan.summary, summary: pendingPlan.summary, steps: pendingPlan.steps, externalMessageId: msg.externalMessageId, channelCtx })` → `updateSession(status:"running", activeMissionId, pendingPlan:null, expiresAt: now+30min)` → 回 `✅ 收到，正在处理：<summary>`。
  > ⚠️ **去重关键**：`externalMessageId` 传**当前这条"开始"消息的 `msg.externalMessageId`**（不是原始请求的）。它经 `sourceEntityId` 进 `missions_source_dedup_uidx`(org+sourceModule+sourceEntityId) 做幂等——用"开始"消息的 id 对"这次启动"唯一、钉钉重投"开始"能正确去重。`pendingPlan` **只存 `{summary, steps}`**，不存原始 externalMessageId。
- 命中 `取消`/`cancel`/`算了`（`isCancel(text)`）→ `updateSession(status:"idle", pendingPlan:null, clarifyRounds:0, contextTurns:[])`（idle 不写 expiresAt）→ 回 `已取消，可重新发起。`
- 其它（视为**编辑**）→ `clarifyOrPlan(orgId, session, text)`（session.contextTurns 已含上一版计划，LLM 据此调整）：
  - 新 `execute` → `updateSession(status:"confirming", pendingPlan:新{summary,steps}, contextTurns:[...turns, {role:"assistant", content:新计划卡}], expiresAt: now+30min)` → 回新计划卡（留 confirming）。
  - `clarify` → 回澄清问题（留 clarifying / confirming，按澄清轮数计，写 expiresAt）。

## Components

新建：
- `src/lib/channels/format-plan-card.ts` — `formatPlanCard(summary, steps): string`，纯函数：
  ```
  📋 我将：
  1. <step1.taskDescription>
  2. <step2.taskDescription>
  ...
  回复 开始 执行，或直接说要改的地方（如"换财经""加配图"）。
  ```
- `src/lib/channels/confirm-keywords.ts` — `isConfirm(text)` / `isCancel(text)`（关键词匹配，trim + 小写 + 命中集合）。

改动：
- `src/db/schema/channel-sessions.ts`（加 pendingPlan 列）。
- `src/lib/dal/channel-sessions.ts`（updateSession 白名单加 pendingPlan；ChannelSessionRow 自动含）。
- `src/lib/channels/clarify-or-plan.ts`（clarify prompt 改 slot-filling 感知，问关键缺失要素；execute 分支不变）。
- `src/lib/channels/gateway.ts`（`handleFreeFormMessage` 加 confirming 分流 + execute 改进 confirming）。

复用：`clarifyOrPlan`、`startChannelMission`（Phase 0/IM）、`updateSession`/`getOrCreateSession`。

## Error Handling

- confirming 态但 `pendingPlan` 为空（异常）→ 当作 idle 重新 clarifyOrPlan。
- 编辑重规划澄清轮数仍计入 `clarifyRounds`，超 5 轮 → 回"没太理解，请换个说法或用 #命令" + 复位。
- `clarifyOrPlan` 抛错 → 回"系统忙，请稍后再试"（同现状）。
- 过期：confirming 态也受 30min 过期重置（Phase 0 的 getOrCreateSession 已对任何非 idle 态生效）。

## Verification

- 单测 `formatPlanCard`（步骤渲染 + 含"开始"提示）。
- 单测 `isConfirm`/`isCancel`（命中/不命中/大小写/中英文）。
- 单测 gateway：
  - execute → 进 confirming、存 pendingPlan、回计划卡（不调 startChannelMission）。
  - confirming + `开始` → 调 startChannelMission、status running、清 pendingPlan。
  - confirming + `取消` → status idle、清 pendingPlan。
  - confirming + 编辑 → 重调 clarifyOrPlan、更新 pendingPlan、回新卡。
- 单测 clarifyOrPlan slot-filling prompt 改动不破现有 execute/clarify 两路（沿用现有测试）。
- ⚠️ **必改现有断言**：`gateway-clarify-loop.test.ts` 现有"execute → `updateSession(status:"running", activeMissionId)` + 调 `startChannelMission`"那条用例（约 :100-107）**会失败**——Phase 1a 把 execute 改成 → confirming（不调 startChannelMission）。需把它改成"execute → status confirming + 存 pendingPlan + **不调** startChannelMission"，并把"running + startChannelMission"断言**迁移到新增的"confirming + 开始"用例**。这不是"沿用"，是迁移。
- `tsc --noEmit` + `build` + `npm test` 全过。

## Rollout

1. schema pendingPlan + DAL 白名单。
2. formatPlanCard + confirm-keywords（纯函数 TDD）。
3. clarifyOrPlan slot-filling prompt（小改）。
4. gateway confirming 分流 + execute 改进 confirming。
5. 全量验证 + 端到端手测（@机器人 发模糊请求 → 澄清 → 计划卡 → 改一次 → 开始 → 执行）。

## Future（Phase 1b / 后续）

- 全局取消（running 中）：标 mission cancelled + 派 mission/cancelled + 复位（orphan 续跑但反查不到 session 不回执）。
- 一键跟进：结果卡列动作 + lastResult 上下文。
- 结构化参数 slot 系统（按 task-type 定 required/optional 参数，计划卡显式列参数）。

# Phase 1b：IM running 中全局取消 Design

## Summary

补上 IM 机器人「任务执行中无法叫停」的体验缺口。当前 `channel_sessions.status === "running"` 时，gateway 对用户任何输入只回"⏳ 处理中"，用户被动等到终态、无法中途撤回。

本期让用户在 running 态发"取消/算了/停"即可**协作式中止** mission：标 `missions.status='cancelled'` → 执行器轮次循环（已存在的 cancelled 检查 + Phase 0 的 3min 任务硬超时）≤3min 内真停 → gateway 同步回"已取消" + 复位 session。

**关键复用**：mission 引擎已具备协作式取消基建——`mission_status` 枚举含 `cancelled`；`executeAllTasksDirect` 的轮次循环每轮开头查 `status === "cancelled"` 就停（`mission-executor.ts:1889-1901`）。本期不引入 AbortController 真中断（Phase 0 已列为 P2）。

**不在本期**：一键跟进（下一期 1c）、取消并交付半成品、AbortController 硬中断、Inngest 路径 mission 的取消（IM mission 走 direct 执行器，天然覆盖）。

## Scope

In scope：
- 新建无登录态 `cancelChannelMission(missionId, organizationId)`：org 隔离 + 终态守卫地标 `cancelled`。
- gateway running 分支：`isCancel(text)` → 取消流程；非取消词 → "处理中"回复**加取消提示**。
- `executeMissionDirect` 加一处「取消短路」早退：task 执行返回后、降级总结前重读 status，若 `cancelled` 直接 return（不总结、不派终态事件、不回执）。

Out of scope（后续）：
- 一键跟进 / lastResult 上下文（Phase 1c 独立 spec）。
- 取消时交付已完成部分的半成品。
- AbortController 穿透 in-flight LLM fetch 的硬中断（P2）。
- Inngest 异步执行路径的 mission 取消（IM mission 不走此路径）。

## 会话状态机

`running ──收到"取消"──▶ idle`（取消复位）。其余转移同 Phase 1a。

| 状态 | 收到"取消"类消息 | 收到其它消息 |
|---|---|---|
| running | 标 cancelled + 复位 idle + 同步回"已取消" | 回"处理中（回复取消可中止）" |

## 数据流

**running 态收到消息 `msg`（gateway `handleFreeFormMessage` running 分支）**：
1. `isCancel(text)`（复用 `confirm-keywords.ts`：取消/cancel/算了/不用了/停）命中：
   - `session.activeMissionId` 为空（异常）→ 直接 `resetSession(channelCtx)` + 回"任务已结束，无需取消。"
   - 否则 → `const ok = await cancelChannelMission(session.activeMissionId, msg.organizationId)` → `resetSession(channelCtx)` → 回 `ok ? "🛑 已取消任务，可重新发起。" : "任务已结束，无需取消。"`
2. 非取消词 → 回 `"⏳ 上一个请求还在处理中，完成后会在群里回结果。回复\"取消\"可中止。"`

> **不双回执**：`resetSession` 清 `activeMissionId`（Phase 1a-T5 起也清 `expiresAt`）。orphan 执行器随后即便触发 `mission/reached-terminal`，handler 的 `getSessionByActiveMissionId(missionId)` 反查不到 active session → 静默 return。复用 Phase 0「复位即去重」双保险。

**cancelChannelMission(missionId, organizationId)**（无 `requireAuth`，对齐 `start-channel-mission.ts` 无登录态模式）：
```
UPDATE missions
   SET status='cancelled', completedAt=now()
 WHERE id=missionId
   AND organization_id=organizationId
   AND status NOT IN ('completed','failed','cancelled')
RETURNING id;
返回 rows.length > 0
```
- org 隔离防越权；终态守卫（`status NOT IN (...)`）防"取消与完成赛跑"时把 completed 误覆盖成 cancelled。
- 改了行（返回 true）= 真取消了一个在途 mission；0 行（false）= mission 已是终态 → gateway 回"任务已结束"。

**executeMissionDirect 取消短路**（`mission-executor.ts`，插在 :2196 task 执行块结束之后、:2198 Phase 3 降级之前）：
```ts
// Phase 2.5: 取消短路 — 协作停后保持 cancelled 状态，跳过总结，不派终态事件
const cancelCheck = await db
  .select({ status: missions.status })
  .from(missions)
  .where(eq(missions.id, missionId))
  .limit(1);
if (cancelCheck[0]?.status === "cancelled") {
  console.log(`[mission-executor] Mission ${missionId} cancelled, skipping consolidation`);
  return { status: "cancelled", taskCount: plan.taskCount };
}
```
- 没有它：协作停后 Phase 3 会按 task 完成率落 Level2/3/4，**把 `cancelled` 覆写成 completed/failed 并白派一次 `mission/reached-terminal`**。虽然 session 已复位、不会双回执，但 mission 状态在 web /missions 上失真，且白烧一次总结 LLM。
- 有它：mission 状态如实保 `cancelled`，省一次总结开销，不派多余事件。
- `plan` 来自 :2183 `leaderPlanDirect`，`plan.taskCount` 在该点可用；返回形态 `{ status, taskCount }` 与既有 return 一致。

## 协作停时序（方案 A）

```
用户发"取消"
   │
   ├─ gateway: cancelChannelMission → missions.status='cancelled'（同步）
   ├─ gateway: resetSession → idle, activeMissionId=null（同步）
   └─ gateway: 回"🛑 已取消任务"（同步，用户立即看到）

执行器（orphan，后台）
   ├─ 当前 in-flight 的那次 LLM 调用：不强杀，自然结束 或 ≤3min 撞 Phase 0 任务硬超时
   ├─ 轮次循环下一轮（:1889）重读 status → 见 cancelled → 标剩余 pending/ready 任务 failed → break
   ├─ executeAllTasksDirect 返回
   └─ Phase 2.5 早退守卫 → 见 cancelled → return，不总结/不派事件/不回执
```
最坏 ≤3min 真停；用户**立即**收到"已取消"（不等执行器）。

## Components

新建：
- `src/lib/channels/cancel-channel-mission.ts` — `cancelChannelMission(missionId, organizationId): Promise<boolean>`（org 隔离 + 终态守卫）。

改动：
- `src/lib/channels/gateway.ts` — `handleFreeFormMessage` running 分支（:269-271）加取消分流 + "处理中"加取消提示。
- `src/lib/mission-executor.ts` — `executeMissionDirect` 插「Phase 2.5 取消短路」早退（:2196 后）。

复用：`isCancel`（`confirm-keywords.ts`，Phase 1a）、`resetSession`（`channel-sessions.ts` DAL，Phase 1a-T5 已清 expiresAt）、`executeAllTasksDirect` 现有 cancelled 检查（:1889-1901）、Phase 0 任务硬超时与终态去重。

不依赖：`cancelMission`（带 `requireAuth`，IM 无登录态不可用）、AbortController。

## Error Handling

- `activeMissionId` 为空但 status=running（异常）→ 仅复位 + 回"任务已结束，无需取消"，不抛。
- 取消与完成赛跑：
  - 用户"取消"先到（mission 仍在途）→ cancelChannelMission 改行成功 → 回"已取消"；执行器后续被守卫挡住。
  - mission 先完成（终态事件已复位 session）→ session 已是 idle，用户"取消"落入自由消息分支 → `clarifyOrPlan` 当模糊输入追问（可接受，少见边界）。
  - mission 先完成但 session 尚未复位（窗口极小）→ cancelChannelMission 终态守卫 0 行 → 回"任务已结束，无需取消" + 复位。
- 取消落在规划阶段（task 未跑）→ 标 cancelled，规划完进执行的首轮检查（:1893）立即停，0 个 task 执行 → Phase 2.5 早退。
- cancelChannelMission DB 异常 → 向上抛，gateway running 分支 try/catch 回"系统忙，请稍后再试"（对齐 clarifyOrPlan 错误处理）。

## Verification

- 单测 `cancelChannelMission`（mock db）：在途 mission → 改 1 行返回 true；已 completed → 终态守卫 0 行返回 false；跨 org → 0 行返回 false。
- 单测 gateway running 分支：
  - running + "取消" → 调 `cancelChannelMission(activeMissionId, org)` + `resetSession` + 回"已取消"，**不调** `startChannelMission`。
  - running + "取消" 但 `activeMissionId` 空 → 仅 `resetSession` + 回"任务已结束"，不调 cancelChannelMission。
  - running + 非取消词 → 回"处理中"且含"取消"提示，不调 cancelChannelMission/resetSession。
- 单测 `executeMissionDirect` 取消短路：mock 让 `executeAllTasksDirect` 返回后 status=cancelled → 不调 `leaderConsolidateDirect`、不派 `mission/reached-terminal`、返回 `{status:"cancelled"}`。
- 回归：现有 gateway-clarify-loop、mission-executor 测试不破。
- `tsc --noEmit` + `build` + `npm test` 全过。

## Rollout

1. `cancelChannelMission` helper（无登录态 + org 隔离 + 终态守卫，TDD）。
2. `executeMissionDirect` Phase 2.5 取消短路早退。
3. gateway running 分支取消分流 + "处理中"加提示。
4. 全量验证 + 终审。
5. 端到端手测：@机器人 起一个稍长的任务 → running 中发"取消" → 立即收到"已取消"；观察 ≤3min 执行器停、web /missions 该 mission 状态为 `cancelled`、群里**不**再来终态回执。

## Future（1c 及后续）

- 一键跟进：结果后保留 lastResult 上下文 + 跟进意图识别（换角度/配图/发布）。
- 取消并交付已完成部分（"已取消，已完成：①②"）。
- AbortController 真中断 in-flight LLM 调用（替代协作式 ≤3min）。
- 统一 `mission/reached-terminal` 覆盖 cancelled 终态（web 通知/analytics 订阅）。

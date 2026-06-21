# Mission 终态统一事件 + 渠道回执稳妥化 + 任务级硬超时 Design

## Summary

修两个连在一起的问题（钉钉触发的 mission 超时失败后，群里石沉大海、用户被永久"处理中"卡住）：

1. **渠道回执只挂在 `executeMissionDirect().then()`（进程内 promise）上** —— 当外部看门狗 `employee-status-guard`（30min 扫卡死任务）把 mission 标 failed（经 Inngest `leader-consolidate` 写 DB）时，worker 里那个 promise 还 hang/孤儿，`.then()` 永不触发 → 钉钉群收不到任何通知。
2. **任务级无硬超时** —— 执行阶段的 LLM 调用（`executeAgent`）卡住时，`executeMissionDirect` 的 15min 软超时是"任务之间的时间戳检查"，不中断 in-flight 的 hang，任务一卡 30min 才被看门狗杀。

**方案**：
- **A. 统一终态事件 `mission/reached-terminal`** + 专职 Inngest handler：mission 一进终态（无论哪条路径写的）就派事件，handler 按 `channel_sessions.activeMissionId` 反查 session → 通知钉钉 + 复位。回执不再依赖进程内 promise。
- **B. 任务级硬超时**：`executeAllTasksDirect` 里给每个 `executeTaskDirect` 包一个 `Promise.race` 硬超时（默认 3min），超了标该任务 failed 继续，不再卡 30min。

两者合力：卡死任务 ~3min 失败 → mission 进终态 → 事件 → 钉钉 ~3min 内收到失败回执。

## Scope

In scope：
- 新事件 `mission/reached-terminal`（completed/failed），在所有 mission 终态写入点派发（带 `id` 去重）。
- 新 handler `channelMissionTerminalNotify`：反查 channel_session → `sendChannelResult` → 复位。
- 新 DAL `getSessionByActiveMissionId`。
- `start-channel-mission` 去掉脆弱的 `.then()`（改由事件驱动），保留 `.catch()` 兜 executeMissionDirect 自身抛错的极端情况。
- `executeAllTasksDirect` 给每任务加 `Promise.race` 硬超时（`TASK_TIMEOUT_MS`，默认 3min）。

Out of scope：
- 用 AbortController 真正中断 hang 的 LLM 调用（本期用 Promise.race 包络 + 标失败，orphan promise 放弃；真 abort 列 P2）。
- 重构 mission 引擎的双执行路径（直跑 vs Inngest）——只在现有终态写入点加事件，不改架构。
- 修复/复活死代码 `mission-notifier`。
- web /missions 的失败展示（已能显示"失败"，本期不动）。

## Part A：统一终态事件 + 渠道回执

### A1. 新事件
`src/inngest/events.ts` 加：
```
"mission/reached-terminal": {
  data: { missionId: string; organizationId: string; status: "completed" | "failed" };
};
```

### A2. 在所有终态写入点派事件（带 id 去重）
mission.status 写成终态（completed/failed）后，紧跟 `await inngest.send({ name:"mission/reached-terminal", id:\`terminal:${missionId}\`, data:{missionId, organizationId, status} })`。点位（**已评审核实修正行号**，`src/lib/mission-executor.ts` + `leader-consolidate.ts`）：

| 写入点 | 真实位置 | 覆盖场景 |
|---|---|---|
| `leaderConsolidateDirect` 写 completed | **:2107-2108**（在 `leaderConsolidateDirect` :2044 内）| Level1 满额 + **Level2/3 非超时正常分支**（它们都调 leaderConsolidateDirect）→ 派发点放这里一次性覆盖 |
| Level2 超时降级 completed | executeMissionDirect **:2199** | Level2 超时 |
| Level3 超时降级 completed | executeMissionDirect **:2229** | Level3 超时 |
| Level4 failed | executeMissionDirect **:2261** | <30% 失败 |
| **leaderPlanDirect 轮次上限 failed** | **:2030**（"执行轮次已达上限，任务被强制终止"）| 规划阶段卡死强制终止——**评审补漏，同类漏回执必须含** |
| leader-consolidate failed | `leader-consolidate.ts` **:70** | **看门狗杀任务路径（本 bug 关键）** |
| leader-consolidate completed | `leader-consolidate.ts` **:153-166**（complete-mission step）| Inngest 异步路径正常完成 |

> ⚠️ 关键更正：`executeMissionDirect` 的 **Level1 分支（:2182-2185）自身不写 status**，只 `await leaderConsolidateDirect(...)` 后 return。所以 Level1（及 Level2/3 正常分支）的 completed 派发点必须放在 **`leaderConsolidateDirect` 内 :2108 之后**，不能放 executeMissionDirect 的 Level1 分支。
> `id:terminal:${missionId}` 让多点派发对同一 mission 只投一次（Inngest 事件幂等，本仓 gateway.ts:142 已有同款实践）。⚠️ inngest 去重窗口非永久；直跑完成 vs 看门狗 30min 后到 leader-consolidate 可能跨窗口 → 靠 handler 的"复位即去重"双保险（A4：复位清 activeMissionId → 重复事件反查不到 active session）兜住。
> executeMissionDirect / leaderConsolidateDirect 在 worker 进程内 `inngest.send` 可行（既有 ad-hoc 路径就在进程内用）。

### A3. 新 DAL `getSessionByActiveMissionId`
`src/lib/dal/channel-sessions.ts` 加：按 `activeMissionId == missionId` 查 session（无 auth）。返回 `ChannelSessionRow | null`。

### A4. 新 handler `channelMissionTerminalNotify`
`src/inngest/functions/channel-mission-terminal-notify.ts`，订阅 `mission/reached-terminal`：
- `getSessionByActiveMissionId(missionId)` → null 则 return（非渠道 mission）。
- 从 session 取渠道三元组 → 组 channelCtx → `sendChannelResult(channelCtx, missionId)`（它读 mission 终态拼 markdown+链接、出站、复位 session）。
- 注册进 `src/inngest/functions/index.ts`。

> `sendChannelResult` 已兼容 finalOutput 多形态 + 自判 `status==='failed'`（IM-T4 已做），handler 直接复用。复位会清 activeMissionId → 重复事件反查不到 active session → 自然去重。

### A5. 改 start-channel-mission
`src/lib/channels/start-channel-mission.ts`：去掉 `.then(() => sendChannelResult(...))`（回执改由事件驱动，覆盖看门狗/worker 重启）。保留 `.catch((err) => sendChannelFailure(channelCtx, missionId, err))` —— 兜 executeMissionDirect **在写任何终态前就抛错**的极端情况（此时无终态事件）。

## Part B：任务级硬超时

⚠️ **结构（评审核实）**：`executeAllTasksDirect`（:1862）**不是单层串行 for**——它是 `Promise.allSettled([...employeeGroups.values()].map(async (group) => { for (const task of group) await executeTaskDirect(...) }))`（:1947-1953）：**按员工分组、组间并发（allSettled）、组内串行（for await）**。要包的就是 **:1950 那个"组内 for 里的 `await executeTaskDirect`"**，`Promise.race` 是 **per-task** 的、跑在并发 group 内；race 超时 → `.catch` 标该 task failed → 组内 for 继续下一个 task → allSettled 照常等所有 group。**不要把 race 包到 allSettled 外层**（会破坏并发）。

`src/lib/mission-executor.ts` 的 `executeAllTasksDirect`，把 :1950 组内 `await executeTaskDirect(task.id, missionId, cachedMission)` 包成硬超时：
```ts
const TASK_TIMEOUT_MS = 3 * 60 * 1000; // 单任务硬超时（可调）
await Promise.race([
  executeTaskDirect(task.id, missionId, cachedMission),
  new Promise((_, reject) => setTimeout(() => reject(new Error("任务执行超时（超过 3 分钟），已自动跳过")), TASK_TIMEOUT_MS)),
]).catch(async (err) => {
  await db.update(missionTasks)
    .set({ status: "failed", errorMessage: err instanceof Error ? err.message : String(err) })
    .where(eq(missionTasks.id, task.id));
});
```
- 超时 → 标该任务 failed → 继续后续任务 → 走 Phase 3 降级 → mission 进终态 → 事件 → 回执。
- orphan：超时后被 race 放弃的 `executeTaskDirect` promise 继续在后台跑（不中断 LLM），任务已标 failed；理论上 orphan 完成后可能回写 task 状态（小概率竞态），可接受。P2 用 AbortController 真中断。
- `TASK_TIMEOUT_MS` 取 3min：内容生成任务正常 30-60s，3min 留足余量又远小于 30min。

## Components

新建：
- `src/inngest/functions/channel-mission-terminal-notify.ts`（handler）。
- DAL `getSessionByActiveMissionId`（`channel-sessions.ts` 内）。

改动：
- `src/inngest/events.ts`（加事件类型）。
- `src/inngest/functions/index.ts`（注册 handler）。
- `src/lib/mission-executor.ts`（4 终态点派事件 + executeAllTasksDirect 任务硬超时）。
- `src/inngest/functions/leader-consolidate.ts`（2 终态点派事件）。
- `src/lib/channels/start-channel-mission.ts`（去 `.then()`，留 `.catch()`）。

复用：`sendChannelResult`/`sendChannelFailure`（IM-T4）、`channel_sessions` DAL。

不依赖：`mission-notifier`（死代码）。

## Error Handling

- handler 反查不到 session（非渠道 mission / 已复位）→ 静默 return。
- `sendChannelResult` 内 sendChannelMessage 失败被吞（fire-and-forget），不阻断；Inngest step 失败可重试。
- executeMissionDirect 写终态前抛错 → `.catch()` → sendChannelFailure（兜底）。
- 任务硬超时 orphan 回写竞态 → 接受（P2 abort 根治）。
- 事件多点派发 → `id` 去重 + 复位去重，不重复回执。

## Verification

- 单测 `getSessionByActiveMissionId`（mock db）。
- 单测 handler `channelMissionTerminalNotify`：反查到 session → 调 sendChannelResult；反查不到 → 不调。
- 单测 executeAllTasksDirect 任务硬超时：mock executeTaskDirect 永不 resolve → race 超时 → 标 task failed（用假定时器 `vi.useFakeTimers`）。
- 回归：现有 ad-hoc / mission 测试不破（去 `.then()` 后 start-channel-mission 行为变化需相应改测试）。
- `tsc --noEmit` + `build` + `npm test` 全过。

## Rollout

1. 事件类型 + DAL `getSessionByActiveMissionId`。
2. handler + 注册。
3. executor 4 点 + leader-consolidate 2 点派事件。
4. start-channel-mission 去 `.then()`。
5. executeAllTasksDirect 任务硬超时。
6. 端到端手测：@机器人 触发一个会超时的请求 → ~3min 内群里收到失败回执（而非 30min/永不）。

## Future（P2）

- AbortController 真中断 hang 的 LLM 调用（替代 Promise.race 放弃 orphan）。
- 统一 `mission/reached-terminal` 取代散落的 task 级事件，作为 mission 终态唯一真相源（web 通知、analytics 等都订阅）。
- `TASK_TIMEOUT_MS` / `MISSION_TIMEOUT_MS` 做成 org 级可配。

# Phase 0：Mission 终态统一事件 + 渠道稳妥回执 + 任务硬超时 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 钉钉触发的 mission 一进终态（无论谁写的——直跑降级 / Inngest leader-consolidate / 看门狗杀任务）就稳妥把结果/失败回执发回群；并给任务级硬超时让卡死任务 ~3min 失败而非 30min。

**Architecture:** 新增 `mission/reached-terminal` Inngest 事件，在所有 mission 终态写入点派发（带 `id` 去重）；专职 handler 按 `channel_sessions.activeMissionId` 反查 session → 复用 `sendChannelResult` 回执 + 复位。回执不再依赖进程内 `.then()`（覆盖看门狗/worker 重启）。`executeAllTasksDirect` 组内 per-task 包 `Promise.race` 硬超时。

**Tech Stack:** Inngest 3.54（事件 + `id` 去重）、Drizzle、Vitest。

**Spec:** `docs/superpowers/specs/2026-06-21-mission-terminal-channel-notify-design.md`

---

## Preflight

- Node 22 + pnpm；本地库 5433 在跑（commit 过全量测试）；禁止 `--no-verify`；commit 只 add 本 task 文件。
- 新测试 DB-free：`vi.mock` + `vi.hoisted()`。
- **已核实事实（评审 + 二次核对）**：
  - mission 终态写入点（`src/lib/mission-executor.ts`）：`leaderConsolidateDirect` 写 completed 在 **:2104-2111**；executeMissionDirect Level2-timeout completed **:2197-2207**、Level3-timeout completed **:2227-2237**、Level4 failed **:2258-2270**。Level1 + Level2/3-正常分支都调 `leaderConsolidateDirect`（→ :2104 一处覆盖）。
  - **`leaderPlanDirect` 轮次上限（:2029-2036）只标 missionTasks failed、不写 mission 终态、不 throw** → 返回后由 executeMissionDirect 降级写终态 → 已被 Level4 覆盖，**不在此派事件**。
  - `leader-consolidate.ts`（Inngest）：failed **:70**、completed **:153-166**。看门狗 `employee-status-guard` 杀任务 → `mission/task-failed` → `handle-task-failure` → `mission/all-tasks-done` → `leader-consolidate` 写 failed(:70)——**这条是本 bug 的关键路径**。
  - `executeAllTasksDirect`（:1862）是 **`Promise.allSettled` 组间并发 + 组内 `for await` 串行**（:1947-1953）；要包的是 :1950 组内 `await executeTaskDirect(...)`。
  - `inngest.send({id,name,data})` 带 id 去重本仓已用（gateway.ts:142）。`sendChannelResult(channelCtx, missionId)`（IM-T4）已兼容 finalOutput 多形态 + 自判 failed + 复位 session。

## File Structure

新建：
- `src/inngest/functions/channel-mission-terminal-notify.ts` — 终态事件 handler。
- 测试若干。

改动：
- `src/inngest/events.ts`（加事件）。
- `src/lib/dal/channel-sessions.ts`（加 `getSessionByActiveMissionId`）。
- `src/lib/mission-executor.ts`（`emitMissionTerminal` helper + 4 终态点派发 + executeAllTasksDirect 任务硬超时）。
- `src/inngest/functions/leader-consolidate.ts`（2 终态点派发）。
- `src/inngest/functions/index.ts`（注册 handler）。
- `src/lib/channels/start-channel-mission.ts`（去 `.then()`）。

---

## Task 1: 事件类型 + DAL getSessionByActiveMissionId

**Files:**
- Modify: `src/inngest/events.ts`
- Modify: `src/lib/dal/channel-sessions.ts`
- Test: `src/lib/dal/__tests__/channel-sessions.test.ts`（已存在，追加）

- [ ] **Step 1: 加事件类型**

`src/inngest/events.ts` 的 `InngestEvents` 加：
```ts
  /** mission 进入终态（completed/failed），所有终态写入点派发。渠道回执 handler 消费。 */
  "mission/reached-terminal": {
    data: { missionId: string; organizationId: string; status: "completed" | "failed" };
  };
```

- [ ] **Step 2: 追加 DAL 失败测试**

在 `src/lib/dal/__tests__/channel-sessions.test.ts` 末尾加（复用文件现有 `findFirst` hoisted mock）：
```ts
describe("getSessionByActiveMissionId", () => {
  it("按 activeMissionId 查到 → 返回 session", async () => {
    findFirst.mockResolvedValue({ id: "s1", activeMissionId: "m1", status: "running" });
    const s = await getSessionByActiveMissionId("m1");
    expect(s?.id).toBe("s1");
  });
  it("查不到 → 返回 null", async () => {
    findFirst.mockResolvedValue(undefined);
    const s = await getSessionByActiveMissionId("mx");
    expect(s).toBeNull();
  });
});
```
> 在文件顶部 import 补 `getSessionByActiveMissionId`。

- [ ] **Step 3: 跑测试确认失败**

Run: `npx vitest run src/lib/dal/__tests__/channel-sessions.test.ts` → 新用例 FAIL（函数未定义）。

- [ ] **Step 4: 实现 DAL**

`src/lib/dal/channel-sessions.ts` 加：
```ts
export async function getSessionByActiveMissionId(
  missionId: string,
): Promise<ChannelSessionRow | null> {
  const row = await db.query.channelSessions.findFirst({
    where: eq(channelSessions.activeMissionId, missionId),
  });
  return row ?? null;
}
```
> `eq` 已 import。channel_sessions 行数极小（活跃会话数），按 activeMissionId 全表扫无性能问题。

- [ ] **Step 5: 跑测试 + tsc** → PASS；`npx tsc --noEmit` 0 errors。

- [ ] **Step 6: Commit**
```bash
git add src/inngest/events.ts src/lib/dal/channel-sessions.ts src/lib/dal/__tests__/channel-sessions.test.ts
git commit -m "feat(mission): mission/reached-terminal 事件 + getSessionByActiveMissionId DAL"
```

---

## Task 2: 终态回执 handler + 注册

**Files:**
- Create: `src/inngest/functions/channel-mission-terminal-notify.ts`
- Modify: `src/inngest/functions/index.ts`
- Test: `src/inngest/functions/__tests__/channel-mission-terminal-notify.test.ts`

- [ ] **Step 1: 写失败测试（mock DAL + sendChannelResult）**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const { getSessionByActiveMissionId, sendChannelResult } = vi.hoisted(() => ({
  getSessionByActiveMissionId: vi.fn(), sendChannelResult: vi.fn(),
}));
vi.mock("@/lib/dal/channel-sessions", () => ({ getSessionByActiveMissionId }));
vi.mock("@/lib/channels/channel-result-notify", () => ({ sendChannelResult }));

import { runTerminalNotify } from "../channel-mission-terminal-notify";

beforeEach(() => { vi.clearAllMocks(); });

it("反查到 session → 调 sendChannelResult（channelCtx 来自 session）", async () => {
  getSessionByActiveMissionId.mockResolvedValue({
    id: "s1", organizationId: "org1", configId: "cfg1", platform: "dingtalk",
    chatId: "c1", externalUserId: "u1", activeMissionId: "m1",
  });
  await runTerminalNotify("m1");
  expect(sendChannelResult).toHaveBeenCalledWith(
    { organizationId: "org1", configId: "cfg1", platform: "dingtalk", chatId: "c1", externalUserId: "u1" },
    "m1",
  );
});

it("反查不到 session（非渠道 mission）→ 不调 sendChannelResult", async () => {
  getSessionByActiveMissionId.mockResolvedValue(null);
  await runTerminalNotify("mx");
  expect(sendChannelResult).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 实现**

```ts
// src/inngest/functions/channel-mission-terminal-notify.ts
import { inngest } from "@/inngest/client";
import { getSessionByActiveMissionId } from "@/lib/dal/channel-sessions";
import { sendChannelResult } from "@/lib/channels/channel-result-notify";

/** 核心逻辑（可单测）：mission 终态 → 反查渠道 session → 回执（sendChannelResult 内部复位）。 */
export async function runTerminalNotify(missionId: string): Promise<void> {
  const session = await getSessionByActiveMissionId(missionId);
  if (!session) return; // 非渠道 mission，或已复位（去重）
  await sendChannelResult(
    {
      organizationId: session.organizationId,
      configId: session.configId,
      platform: session.platform as "dingtalk" | "wechat_work",
      chatId: session.chatId,
      externalUserId: session.externalUserId,
    },
    missionId,
  );
}

export const channelMissionTerminalNotify = inngest.createFunction(
  { id: "channel-mission-terminal-notify", retries: 2 },
  { event: "mission/reached-terminal" },
  async ({ event, step }) => {
    await step.run("notify", () => runTerminalNotify(event.data.missionId));
    return { ok: true };
  },
);
```

- [ ] **Step 4: 注册**

`src/inngest/functions/index.ts`：import + 加入 functions 数组：
```ts
import { channelMissionTerminalNotify } from "./channel-mission-terminal-notify";
// ...
  // Channel mission terminal notify
  channelMissionTerminalNotify,
```

- [ ] **Step 5: 跑测试 + tsc** → PASS（2 passed）；tsc 0 errors。

- [ ] **Step 6: Commit**
```bash
git add src/inngest/functions/channel-mission-terminal-notify.ts src/inngest/functions/index.ts src/inngest/functions/__tests__/channel-mission-terminal-notify.test.ts
git commit -m "feat(mission): channelMissionTerminalNotify handler（终态→反查 session→回执）"
```

---

## Task 3: 在所有 mission 终态写入点派事件

**Files:**
- Modify: `src/lib/mission-executor.ts`（emitMissionTerminal helper + 4 点）
- Modify: `src/inngest/functions/leader-consolidate.ts`（2 点）

> 本 task 无新单测（派发是副作用，集成性；逻辑由 handler 单测 + 端到端覆盖）。重点是**派发点准确、不漏**，用 `id` 去重保证多点对同一 mission 只投一次。

- [ ] **Step 1: 加 emitMissionTerminal helper（mission-executor.ts）**

文件顶部确认已 import `inngest`（没有则 `import { inngest } from "@/inngest/client";`）。加：
```ts
/** mission 进入终态时派统一事件（带 id 去重）。供渠道回执 handler 消费。 */
async function emitMissionTerminal(
  missionId: string, organizationId: string, status: "completed" | "failed",
): Promise<void> {
  await inngest.send({
    name: "mission/reached-terminal",
    id: `terminal:${missionId}`,
    data: { missionId, organizationId, status },
  });
}
```

- [ ] **Step 2: 在 4 个终态写入点后调用**

逐处在 `db.update(missions).set({status:...}).where(...)` 之后插入 `await emitMissionTerminal(missionId, organizationId, "...")`：
- `leaderConsolidateDirect` 写 completed 后（**:2104-2111** 那段 `.update(missions).set({status:"completed",...})` 之后）：`await emitMissionTerminal(missionId, organizationId, "completed");`（该函数已有 `missionId`/`organizationId` 形参）。
- executeMissionDirect Level2-timeout completed（**:2197-2207** 的 set 之后）：`await emitMissionTerminal(missionId, organizationId, "completed");`。
- executeMissionDirect Level3-timeout completed（**:2227-2237** 的 set 之后）：同上 completed。
- executeMissionDirect Level4 failed（**:2258-2270** 的 set 之后）：`await emitMissionTerminal(missionId, organizationId, "failed");`。

> 注意：Level1 + Level2/3-**正常**分支都走 `leaderConsolidateDirect`，已被第一处覆盖，**不要**在 executeMissionDirect 的 Level1/2/3 正常分支重复派。`leaderPlanDirect` 轮次上限（:2029）只标 task failed、非 mission 终态，**不派**。

- [ ] **Step 3: leader-consolidate.ts 两点派发**

`src/inngest/functions/leader-consolidate.ts`：
- failed 分支（**:70** `.update(missions).set({status:"failed"...})` 之后）：包一个 step 派事件：
  ```ts
  await step.run("emit-terminal-failed", () =>
    inngest.send({ name: "mission/reached-terminal", id: `terminal:${missionId}`,
      data: { missionId, organizationId, status: "failed" } }));
  ```
- completed 分支（**:153-166** complete-mission step 写 completed 之后）：同样派 `status:"completed"`。
> 确认该文件已 import `inngest` + 有 `missionId`/`organizationId`（事件 data 里有；从 `event.data` 取）。

- [ ] **Step 4: 类型检查 + 全量测试**

Run: `npx tsc --noEmit` → 0 errors；`npm test` → 全绿（现有 mission 测试不受影响，新增派发是 fire-and-forget）。

- [ ] **Step 5: Commit**
```bash
git add src/lib/mission-executor.ts src/inngest/functions/leader-consolidate.ts
git commit -m "feat(mission): 所有 mission 终态写入点派 mission/reached-terminal 事件"
```

---

## Task 4: start-channel-mission 去 .then()（事件驱动回执）

**Files:**
- Modify: `src/lib/channels/start-channel-mission.ts`

- [ ] **Step 1: 去掉 .then()，保留 .catch()**

把：
```ts
  void executeMissionDirect(missionId, orgId)
    .then(() => sendChannelResult(input.channelCtx, missionId))
    .catch((err) => sendChannelFailure(input.channelCtx, missionId, err));
```
改为：
```ts
  // 回执改由 mission/reached-terminal 事件驱动（覆盖看门狗杀任务 / worker 重启）。
  // 这里只 fire-and-forget 执行；.catch 兜 executeMissionDirect 在写任何终态前就抛错的极端情况。
  void executeMissionDirect(missionId, orgId).catch((err) =>
    sendChannelFailure(input.channelCtx, missionId, err),
  );
```
删掉不再用的 `sendChannelResult` import（保留 `sendChannelFailure`）。顺手更新文件顶部 JSDoc（:7-8）里"`.then(sendChannelResult)`"那句过时描述，改成"回执由 mission/reached-terminal 事件驱动"。

- [ ] **Step 2: tsc + 相关测试**

Run: `npx tsc --noEmit` → 0 errors。`npx vitest run src/lib/channels/__tests__/gateway-clarify-loop.test.ts` → 仍 PASS（该测试把 startChannelMission 整体 mock，不触 .then()）。

- [ ] **Step 3: Commit**
```bash
git add src/lib/channels/start-channel-mission.ts
git commit -m "refactor(channel): 回执改由 mission/reached-terminal 事件驱动，去 .then()"
```

---

## Task 5: executeAllTasksDirect 任务级硬超时

**Files:**
- Create: `src/lib/missions/run-with-timeout.ts`（可单测的小工具）
- Modify: `src/lib/mission-executor.ts`（:1950 包超时）
- Test: `src/lib/missions/__tests__/run-with-timeout.test.ts`

- [ ] **Step 1: 写失败测试（fake timers）**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runWithTimeout } from "../run-with-timeout";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("按时完成 → 正常 resolve", async () => {
  const p = runWithTimeout(Promise.resolve("ok"), 1000, "超时");
  await expect(p).resolves.toBe("ok");
});

it("超时未完成 → reject 超时错误", async () => {
  const never = new Promise(() => {});
  const p = runWithTimeout(never, 1000, "任务执行超时");
  const assertion = expect(p).rejects.toThrow("任务执行超时");
  await vi.advanceTimersByTimeAsync(1001);
  await assertion;
});
```

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 实现 helper**

```ts
// src/lib/missions/run-with-timeout.ts
/** 把 promise 与一个硬超时竞速；超时则 reject(Error(msg))。用于给单任务执行兜硬超时。 */
export function runWithTimeout<T>(promise: Promise<T>, ms: number, msg: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(msg)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
```

- [ ] **Step 4: 跑测试确认通过** → PASS（2 passed）。

- [ ] **Step 5: 在 executeAllTasksDirect :1950 包超时**

`src/lib/mission-executor.ts`：顶部加 `import { runWithTimeout } from "@/lib/missions/run-with-timeout";`，加常量 `const TASK_TIMEOUT_MS = 3 * 60 * 1000;`（放 MISSION_TIMEOUT_MS 旁，:54 附近）。
把 :1950 的：
```ts
        for (const task of group) {
          await executeTaskDirect(task.id, missionId, cachedMission);
        }
```
改为（**仍在组内 for、组间 allSettled 并发不变**）：
```ts
        for (const task of group) {
          try {
            await runWithTimeout(
              executeTaskDirect(task.id, missionId, cachedMission),
              TASK_TIMEOUT_MS,
              "任务执行超时（超过 3 分钟），已自动跳过",
            );
          } catch (err) {
            await db.update(missionTasks)
              .set({ status: "failed", errorMessage: err instanceof Error ? err.message : String(err) })
              .where(eq(missionTasks.id, task.id));
          }
        }
```
> orphan：超时后被放弃的 executeTaskDirect 继续后台跑（不中断 LLM），任务已标 failed，小概率竞态可接受（P2 用 AbortController）。`db`/`missionTasks`/`eq` 已在文件 import。

- [ ] **Step 6: tsc + 全量测试** → tsc 0 errors；`npm test` 全绿。

- [ ] **Step 7: Commit**
```bash
git add src/lib/missions/run-with-timeout.ts src/lib/missions/__tests__/run-with-timeout.test.ts src/lib/mission-executor.ts
git commit -m "feat(mission): executeAllTasksDirect 任务级硬超时（3min，卡死快速失败）"
```

---

## Task 6: 全量验证 + 端到端手测

- [ ] **Step 1: 全量验证**
```bash
npx tsc --noEmit   # 0 errors
npm run build      # 通过
npm test           # 全绿（新增 ~6 测试）
```

- [ ] **Step 2: 端到端手测**

1. 起 `pnpm run dingtalk:stream`（重启加载新代码）+ inngest dev server（终态事件 + handler 要 Inngest 跑）。
2. 群里 @机器人 触发一个会失败/超时的请求 → 期望 **~3min 内**群里收到 `❌ 任务失败：…` + 链接（而非 30min/永不）。
3. 触发一个能成功的请求 → 群里收到 `✅ 已完成：…`（经事件驱动，不再靠 .then()）。
4. 站内 /missions 看到终态正确。

- [ ] **Step 3: 收尾 commit（如有微调）**

---

## 备注 / 风险

- **handler 需 Inngest 在跑**：终态回执经 `mission/reached-terminal` 事件 → handler，本地需 inngest dev server；生产需 Inngest 配好。（直跑 mission 本身不需 inngest，但**回执**需要。）这是相对"纯 .then()"的新依赖，但换来覆盖看门狗/worker 重启的稳妥性。
- **id 去重窗口**：直跑完成 vs 看门狗 30min 后到 leader-consolidate 可能跨 inngest 去重窗口 → 靠 handler "复位即去重"（sendChannelResult 复位清 activeMissionId，重复事件反查不到 active session → no-op）兜住。
- **orphan 竞态**（任务硬超时）：P2 用 AbortController 真中断。
- **不依赖** `mission-notifier`（死代码）、`mission.sourceContext`（不存在）。

# IM running 中全局取消 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 IM 机器人在 mission 执行中收到"取消"即可协作式中止任务（标 cancelled + 复位 session + 同步回执），≤3min 真停。

**Architecture:** 复用 mission 引擎已有的协作式取消（`executeAllTasksDirect` 轮次循环每轮查 `status==='cancelled'`）。gateway running 分支识别 `isCancel` → 无登录态 `cancelChannelMission` 标 cancelled → `resetSession` 同步复位（清 activeMissionId → Phase 0 终态 handler 反查不到 → 不双回执）。`executeMissionDirect` 加一处取消短路早退，避免 Phase 3 把 cancelled 覆写成 failed/completed。

**Tech Stack:** TypeScript / Drizzle ORM / Vitest。复用 `isCancel`（confirm-keywords）、`resetSession`（channel-sessions DAL）、Phase 0 任务硬超时与终态去重。

**Spec:** `docs/superpowers/specs/2026-06-21-im-running-cancel-design.md`

**分支：** `claude/im-running-cancel`（off `main`）。

---

### Task 1b-T1: cancelChannelMission 无登录态取消 helper

**Files:**
- Create: `src/lib/channels/cancel-channel-mission.ts`
- Test: `src/lib/channels/__tests__/cancel-channel-mission.test.ts`

无 `requireAuth`（IM 无登录态，对齐 `start-channel-mission.ts`）。org 隔离 + 终态守卫（`status NOT IN (completed,failed,cancelled)`）防把已终态 mission 误覆盖。

- [ ] **Step 1: 写失败测试**

`src/lib/channels/__tests__/cancel-channel-mission.test.ts`：
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { returningUpd, where, set, update } = vi.hoisted(() => {
  const returningUpd = vi.fn();
  const where = vi.fn(() => ({ returning: returningUpd }));
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  return { returningUpd, where, set, update };
});

vi.mock("@/db", () => ({ db: { update } }));

import { cancelChannelMission } from "../cancel-channel-mission";

beforeEach(() => {
  returningUpd.mockReset();
  set.mockClear();
  update.mockClear();
});

describe("cancelChannelMission", () => {
  it("在途 mission → 改 1 行，标 cancelled，返回 true", async () => {
    returningUpd.mockResolvedValue([{ id: "m1" }]);
    const ok = await cancelChannelMission("m1", "org1");
    expect(ok).toBe(true);
    expect(update).toHaveBeenCalled();
    const patch = (set.mock.calls as unknown as [unknown[]][])[0][0];
    expect(patch).toMatchObject({ status: "cancelled" });
  });

  it("已终态 mission（终态守卫 0 行）→ 返回 false", async () => {
    returningUpd.mockResolvedValue([]);
    const ok = await cancelChannelMission("m1", "org1");
    expect(ok).toBe(false);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/lib/channels/__tests__/cancel-channel-mission.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**

`src/lib/channels/cancel-channel-mission.ts`：
```ts
import { and, eq, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { missions } from "@/db/schema";

/**
 * 无登录态取消渠道发起的 mission（IM ChatOps 用，无 requireAuth）。
 * org 隔离 + 终态守卫：只取消仍在途的 mission，防把已 completed/failed 误覆盖成 cancelled。
 * @returns 是否真取消了一个在途 mission（false = 该 mission 已是终态 / 不属于该 org）
 */
export async function cancelChannelMission(
  missionId: string,
  organizationId: string,
): Promise<boolean> {
  const rows = await db
    .update(missions)
    .set({ status: "cancelled", completedAt: new Date() })
    .where(
      and(
        eq(missions.id, missionId),
        eq(missions.organizationId, organizationId),
        notInArray(missions.status, ["completed", "failed", "cancelled"]),
      ),
    )
    .returning({ id: missions.id });
  return rows.length > 0;
}
```

- [ ] **Step 4: 跑测试确认通过 + tsc**

Run: `npx vitest run src/lib/channels/__tests__/cancel-channel-mission.test.ts && npx tsc --noEmit`
Expected: PASS（2 passed）、tsc 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/channels/cancel-channel-mission.ts src/lib/channels/__tests__/cancel-channel-mission.test.ts
git commit -m "feat(channel): cancelChannelMission 无登录态取消（org 隔离 + 终态守卫）"
```

---

### Task 1b-T2: executeMissionDirect 取消短路早退

**Files:**
- Modify: `src/lib/mission-executor.ts`（加导出谓词 `shouldShortCircuitForCancel` + 在 :2196 task 执行块后插早退）
- Test: `src/lib/__tests__/mission-executor-short-circuit.test.ts`（加 `shouldShortCircuitForCancel` 用例）

协作停后，执行器会继续走 Phase 3 四级降级总结、可能把 `cancelled` 覆写成 completed/failed 并白派一次终态事件。早退守卫：task 执行返回后重读 status，`cancelled` 则 return。谓词抽出来对齐 codebase 既有 `shouldXxx` 惯例，并 pin 住"只有 cancelled 短路，failed/completed 不短路（仍走降级）"的语义。

- [ ] **Step 1: 写失败测试**

在 `src/lib/__tests__/mission-executor-short-circuit.test.ts` 顶部 import 加 `shouldShortCircuitForCancel`，并加一个 describe：
```ts
describe("shouldShortCircuitForCancel", () => {
  it("cancelled → 短路跳过总结", () => {
    expect(shouldShortCircuitForCancel("cancelled")).toBe(true);
  });
  it("failed/completed/executing/undefined → 不短路（仍走 Phase 3 降级）", () => {
    expect(shouldShortCircuitForCancel("failed")).toBe(false);
    expect(shouldShortCircuitForCancel("completed")).toBe(false);
    expect(shouldShortCircuitForCancel("executing")).toBe(false);
    expect(shouldShortCircuitForCancel(undefined)).toBe(false);
  });
});
```
> import 行从 `import { getNestedField, ... } from "../mission-executor";` 扩成含 `shouldShortCircuitForCancel`。

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/lib/__tests__/mission-executor-short-circuit.test.ts`
Expected: FAIL（`shouldShortCircuitForCancel is not a function`）

- [ ] **Step 3: 实现谓词 + 接早退**

在 `src/lib/mission-executor.ts` 加导出谓词（放在文件内其它 `shouldXxx` 谓词附近）：
```ts
/** mission 已被协作式取消时短路：跳过 Phase 3 降级总结，保持 cancelled 状态，不派终态事件。 */
export function shouldShortCircuitForCancel(status: string | null | undefined): boolean {
  return status === "cancelled";
}
```

在 `executeMissionDirect` 里，task 执行块（`if (!isMissionTimedOut()) { await executeAllTasksDirect(...) } else { ... }`，约 :2186-2196）**结束之后**、`// Phase 3: 4-level degradation strategy`（约 :2198）**之前**插入：
```ts
  // Phase 2.5: 取消短路 — 协作停后保持 cancelled，跳过总结，不派终态事件（gateway 已同步回执 + 复位 session）
  const cancelCheck = await db
    .select({ status: missions.status })
    .from(missions)
    .where(eq(missions.id, missionId))
    .limit(1);
  if (shouldShortCircuitForCancel(cancelCheck[0]?.status)) {
    console.log(`[mission-executor] Mission ${missionId} cancelled, skipping consolidation`);
    return { status: "cancelled", taskCount: plan.taskCount };
  }
```
> `db` / `missions` / `eq` 在该文件已 import（executeMissionDirect 上下文已大量使用）。`plan` 来自上方 `leaderPlanDirect`（:2183），`plan.taskCount` 可用。返回形态 `{ status, taskCount }` 与现有 return（:2212 等）一致。

- [ ] **Step 4: 跑测试 + tsc**

Run: `npx vitest run src/lib/__tests__/mission-executor-short-circuit.test.ts && npx tsc --noEmit`
Expected: PASS、tsc 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/mission-executor.ts src/lib/__tests__/mission-executor-short-circuit.test.ts
git commit -m "feat(mission): executeMissionDirect 取消短路早退（保持 cancelled，不覆写/不白派终态）"
```

---

### Task 1b-T3: gateway running 分支取消分流

**Files:**
- Modify: `src/lib/channels/gateway.ts`（running 分支 → `handleRunningMessage`）
- Test: `src/lib/channels/__tests__/gateway-clarify-loop.test.ts`（改 running 用例 + 加取消用例）

running 分支现在对任何输入只回"处理中"（:269-271）。改为：`isCancel` → 取消流程；非取消 → "处理中"**加取消提示**。

- [ ] **Step 1: 改测试（先红）**

`src/lib/channels/__tests__/gateway-clarify-loop.test.ts`：

(a) 把 `resetSession` 提进 hoisted 句柄并加 `cancelChannelMission` mock。改顶部：
```ts
const {
  getOrCreateSession, updateSession, resetSession,
  clarifyOrPlan, startChannelMission, cancelChannelMission,
  recordInboundMessage, recordOutboundMessage,
} = vi.hoisted(() => ({
  getOrCreateSession: vi.fn(),
  updateSession: vi.fn(),
  resetSession: vi.fn(),
  clarifyOrPlan: vi.fn(),
  startChannelMission: vi.fn(),
  cancelChannelMission: vi.fn(),
  recordInboundMessage: vi.fn().mockResolvedValue({ messageId: "x" }),
  recordOutboundMessage: vi.fn().mockResolvedValue({ messageId: "y" }),
}));

vi.mock("@/lib/dal/channel-sessions", () => ({
  getOrCreateSession, updateSession, resetSession,
}));
vi.mock("@/lib/channels/clarify-or-plan", () => ({ clarifyOrPlan }));
vi.mock("@/lib/channels/start-channel-mission", () => ({ startChannelMission }));
vi.mock("@/lib/channels/cancel-channel-mission", () => ({ cancelChannelMission }));
```

(b) 把现有 `it("running 中 → 回'处理中'，不调 clarifyOrPlan")` 用例改成（msg 默认 textContent="帮我搞个东西" 非取消词）：
```ts
it("running + 非取消词 → 回'处理中'含取消提示，不调 clarifyOrPlan/cancel", async () => {
  getOrCreateSession.mockResolvedValue({ id: "s1", status: "running", activeMissionId: "m1", contextTurns: [], clarifyRounds: 0 });
  const r = await handleInboundMessage(msg);
  expect(r.reply).toContain("处理中");
  expect(r.reply).toContain("取消");
  expect(clarifyOrPlan).not.toHaveBeenCalled();
  expect(cancelChannelMission).not.toHaveBeenCalled();
  expect(resetSession).not.toHaveBeenCalled();
});
```

(c) 加 3 个用例：
```ts
it("running + 取消 → cancelChannelMission + resetSession + 回已取消", async () => {
  getOrCreateSession.mockResolvedValue({ id: "s1", status: "running", activeMissionId: "m1", contextTurns: [], clarifyRounds: 0 });
  cancelChannelMission.mockResolvedValue(true);
  const r = await handleInboundMessage({ ...msg, textContent: "取消" });
  expect(cancelChannelMission).toHaveBeenCalledWith("m1", "org1");
  expect(resetSession).toHaveBeenCalled();
  expect(startChannelMission).not.toHaveBeenCalled();
  expect(r.reply).toContain("已取消");
});

it("running + 取消 但 cancel 返回 false（已终态）→ 回任务已结束", async () => {
  getOrCreateSession.mockResolvedValue({ id: "s1", status: "running", activeMissionId: "m1", contextTurns: [], clarifyRounds: 0 });
  cancelChannelMission.mockResolvedValue(false);
  const r = await handleInboundMessage({ ...msg, textContent: "取消" });
  expect(resetSession).toHaveBeenCalled();
  expect(r.reply).toContain("已结束");
});

it("running + 取消 但 activeMissionId 空 → 仅 resetSession，不调 cancelChannelMission", async () => {
  getOrCreateSession.mockResolvedValue({ id: "s1", status: "running", activeMissionId: null, contextTurns: [], clarifyRounds: 0 });
  const r = await handleInboundMessage({ ...msg, textContent: "取消" });
  expect(cancelChannelMission).not.toHaveBeenCalled();
  expect(resetSession).toHaveBeenCalled();
  expect(r.reply).toContain("已结束");
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/lib/channels/__tests__/gateway-clarify-loop.test.ts`
Expected: FAIL（running 分支还没分流 / cancelChannelMission 未接）

- [ ] **Step 3: 改 gateway.ts**

(a) 顶部加 import（`isCancel` / `ChannelSessionRow` 已在 1a-T4 引入；新增 2 个）：
```ts
import { resetSession } from "@/lib/dal/channel-sessions";  // 若该行已有 getOrCreateSession/updateSession，合并进同一 import
import { cancelChannelMission } from "./cancel-channel-mission";
```
> 注意现有 `import { getOrCreateSession, updateSession } from "@/lib/dal/channel-sessions"` 直接补 `resetSession` 进去，别新开一行重复 import。

(b) 把 running 分支（:269-271）替换为：
```ts
  if (session.status === "running") {
    return handleRunningMessage(text, msg, session, channelCtx);
  }
```

(c) 加 `handleRunningMessage`（top-level，与 handleConfirmingMessage 同级）：
```ts
async function handleRunningMessage(
  text: string,
  msg: StandardizedMessage,
  session: ChannelSessionRow,
  channelCtx: { organizationId: string; configId: string; platform: "dingtalk" | "wechat_work"; chatId: string; externalUserId: string },
): Promise<{ reply: string; missionId?: string }> {
  if (!isCancel(text)) {
    return { reply: "⏳ 上一个请求还在处理中，完成后会在群里回结果。回复\"取消\"可中止。" };
  }
  if (!session.activeMissionId) {
    await resetSession(channelCtx);
    return { reply: "任务已结束，无需取消。" };
  }
  let ok = false;
  try {
    ok = await cancelChannelMission(session.activeMissionId, msg.organizationId);
  } catch (err) {
    console.error("[gateway] cancelChannelMission failed:", err);
    return { reply: "系统忙，请稍后再试。" };
  }
  await resetSession(channelCtx);
  return { reply: ok ? "🛑 已取消任务，可重新发起。" : "任务已结束，无需取消。" };
}
```

- [ ] **Step 4: 跑测试 + tsc**

Run: `npx vitest run src/lib/channels/__tests__/gateway-clarify-loop.test.ts && npx tsc --noEmit`
Expected: PASS、tsc 0 errors。以测试为准微调文案断言。

- [ ] **Step 5: Commit**

```bash
git add src/lib/channels/gateway.ts src/lib/channels/__tests__/gateway-clarify-loop.test.ts
git commit -m "feat(channel): running 中 isCancel → 协作式取消 mission + 复位回执；处理中加取消提示"
```

---

### Task 1b-T4: 全量验证 + 终审 + 合并

**Files:** 无新增（验证 + 合并）

- [ ] **Step 1: 全量验证**

```bash
npx tsc --noEmit && npm run build && npx vitest run
```
Expected: tsc 0 errors、build exit 0、全量测试全 PASS（在 1134 基础上 +本期新增用例）

- [ ] **Step 2: 终审**

Dispatch 一个 code-reviewer subagent 审本期相对 main 的 diff（`src/lib/channels/cancel-channel-mission.ts` / `gateway.ts` / `mission-executor.ts` 及测试），按 spec 核对：
- cancelChannelMission org 隔离 + 终态守卫；
- 早退守卫插入点正确（Phase 3 之前）、`cancelled` 不被覆写；
- gateway 不双回执（resetSession 清 activeMissionId）、activeMissionId 空兜底、cancel 异常回"系统忙"；
- 文案与 isCancel 提示自洽。
修真实问题，re-review 直到 ✅。

- [ ] **Step 3: 端到端手测清单（交付给用户跑）**

1. @机器人 起一个稍长任务（如"写一篇深度稿"）→ confirming 回"开始"→ 进 running。
2. running 中发"取消"→ **立即**收到"🛑 已取消任务，可重新发起"。
3. 观察 ≤3min 后台执行器停；web `/missions` 该 mission 状态为 `cancelled`；群里**不再**来终态回执。
4. running 中发非取消词（如"还要多久"）→ 回"处理中…回复取消可中止"。
5. 任务正常完成后再发"取消"→ 回"任务已结束，无需取消"（或落自由消息分支追问，二者皆可接受）。

- [ ] **Step 4: 合并回 main**

REQUIRED SUB-SKILL: `superpowers:finishing-a-development-branch`。全量测试通过后，ff-merge `claude/im-running-cancel` → `main`，删除分支。

---

## Remember
- DRY：复用 `isCancel` / `resetSession` / Phase 0 终态去重，不重复造。
- 不双回执的根因是 `resetSession` 清 `activeMissionId`——别在 cancel 路径漏掉 resetSession。
- `cancelChannelMission` 终态守卫（`notInArray` status）是防赛跑覆盖的关键，别简化掉。
- 早退守卫必须在 Phase 3 降级**之前**——插错位置（之后）就拦不住 cancelled 被覆写。

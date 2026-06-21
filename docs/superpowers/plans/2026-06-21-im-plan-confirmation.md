# Phase 1a：IM 计划确认卡 + 要素收集 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** IM 机器人澄清够了后不直接开跑，先发一张**计划确认卡**让用户确认/改参数，回 `开始` 才执行。

**Architecture:** 加会话状态 `confirming` + `pendingPlan` 字段。clarifyOrPlan 判 execute → 存 pendingPlan + 发计划卡（不执行）；confirming 态分流 `开始`（执行存好的 steps）/ `取消`（放弃）/ 编辑（带上下文重规划、更新卡）。

**Tech Stack:** Drizzle、Vitest、现有 clarifyOrPlan/startChannelMission/session DAL（IM + Phase 0）。

**Spec:** `docs/superpowers/specs/2026-06-21-im-plan-confirmation-design.md`

---

## Preflight

- Node 22 + pnpm；本地库 5433 在跑（commit 过全量测试）；禁止 `--no-verify`；commit 只 add 本 task 文件；新测试 `vi.hoisted()`。
- 本地 schema 用 `db:push`（交互 TUI 卡住用临时 `db.execute(sql\`ALTER TABLE ...\`)` 兜底）。
- **会话续期纪律**：每处把 session 推进到非 idle 态的 `updateSession` 都写 `expiresAt: new Date(Date.now()+SESSION_TTL_MS)`（gateway 已有该常量 :250）；只有复位 idle 不写。
- **已核实**（评审）：`handleFreeFormMessage` 在 `gateway.ts:252-303`（running 拦截 :265、clarifyOrPlan :271、execute 分支 :294-302）；gateway 已 import `getOrCreateSession`/`updateSession`/`clarifyOrPlan`/`startChannelMission`/`SESSION_TTL_MS`/`MAX_CLARIFY_ROUNDS`。`clarifyOrPlan(orgId, session, message)` 用 `session.contextTurns` 拼上下文（编辑重规划成立）。`updateSession` 白名单在 `channel-sessions.ts:57-69`。`startChannelMission` 入参 `{message, steps, summary, externalMessageId, channelCtx}`。

## File Structure

新建：`src/lib/channels/format-plan-card.ts`、`src/lib/channels/confirm-keywords.ts`（+ 测试）。
改动：`src/db/schema/channel-sessions.ts`、`src/lib/dal/channel-sessions.ts`、`src/lib/channels/clarify-or-plan.ts`、`src/lib/channels/gateway.ts`、`src/lib/channels/__tests__/gateway-clarify-loop.test.ts`（改现有断言）。

---

## Task 1: schema pendingPlan + DAL 白名单

**Files:**
- Modify: `src/db/schema/channel-sessions.ts`
- Modify: `src/lib/dal/channel-sessions.ts`

- [ ] **Step 1: schema 加 pendingPlan 列**

`channel-sessions.ts` 顶部加 `import type { IntentStep } from "@/lib/agent/types";`（先例 `workflows.ts:22`，安全无环）。在 `contextTurns` 列后加：
```ts
  pendingPlan: jsonb("pending_plan").$type<{ summary: string; steps: IntentStep[] }>(),
```

- [ ] **Step 2: 推库**

`npm run db:push`；若交互卡住，临时脚本 `db.execute(sql\`ALTER TABLE channel_sessions ADD COLUMN IF NOT EXISTS pending_plan jsonb\`)` + `npx tsx --env-file=.env.local`，完事删脚本。确认列存在。

- [ ] **Step 3: DAL updateSession 白名单加 pendingPlan**

`channel-sessions.ts` 的 `updateSession` 的 `Partial<Pick<ChannelSessionRow, ...>>` 加 `"pendingPlan"`：
```ts
  patch: Partial<Pick<ChannelSessionRow, "status" | "contextTurns" | "activeMissionId" | "clarifyRounds" | "expiresAt" | "pendingPlan">>,
```
> `ChannelSessionRow = $inferSelect` 加列后自动含 pendingPlan，无需改类型定义。`resetSession` 顺手把 `pendingPlan: null` 加进它的 `.set({...})`（复位也清计划）。

- [ ] **Step 4: tsc + commit**

`npx tsc --noEmit` → 0 errors。
```bash
git add src/db/schema/channel-sessions.ts src/lib/dal/channel-sessions.ts
git commit -m "feat(channel): channel_sessions 加 pendingPlan + DAL 白名单（计划确认）"
```

---

## Task 2: formatPlanCard + confirm-keywords（纯函数 TDD）

**Files:**
- Create: `src/lib/channels/format-plan-card.ts` + 测试
- Create: `src/lib/channels/confirm-keywords.ts` + 测试

- [ ] **Step 1: 写失败测试**

```ts
// src/lib/channels/__tests__/format-plan-card.test.ts
import { describe, it, expect } from "vitest";
import { formatPlanCard } from "../format-plan-card";
const steps = [
  { employeeSlug: "xiaolei", employeeName: "小蕾", skills: [], taskDescription: "抓科技热榜" },
  { employeeSlug: "xiaolei", employeeName: "小蕾", skills: [], taskDescription: "写800字短稿" },
];
describe("formatPlanCard", () => {
  it("渲染步骤 + 开始提示", () => {
    const card = formatPlanCard("抓个科技热点写成稿", steps as never);
    expect(card).toContain("抓科技热榜");
    expect(card).toContain("写800字短稿");
    expect(card).toContain("开始");
  });
});
```
```ts
// src/lib/channels/__tests__/confirm-keywords.test.ts
import { describe, it, expect } from "vitest";
import { isConfirm, isCancel } from "../confirm-keywords";
describe("isConfirm/isCancel", () => {
  it("确认词命中", () => { expect(isConfirm("开始")).toBe(true); expect(isConfirm(" 确认 ")).toBe(true); expect(isConfirm("OK")).toBe(true); });
  it("取消词命中", () => { expect(isCancel("取消")).toBe(true); expect(isCancel("算了")).toBe(true); });
  it("普通编辑不命中", () => { expect(isConfirm("换财经")).toBe(false); expect(isCancel("换财经")).toBe(false); });
});
```

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 实现**

```ts
// src/lib/channels/format-plan-card.ts
import type { IntentStep } from "@/lib/agent/types";

/** 把规划好的 steps 渲染成「计划确认卡」文本，发给 IM 让用户确认/改。 */
export function formatPlanCard(summary: string, steps: IntentStep[]): string {
  const lines = steps.map((s, i) => `${i + 1}. ${s.taskDescription}`).join("\n");
  return [
    `📋 我将：${summary}`,
    lines,
    `回复 开始 执行，或直接说要改的地方（如"换财经""加配图"）。`,
  ].filter(Boolean).join("\n");
}
```
```ts
// src/lib/channels/confirm-keywords.ts
const CONFIRM = new Set(["开始", "确认", "ok", "yes", "好", "可以", "执行"]);
const CANCEL = new Set(["取消", "cancel", "算了", "不用了", "停"]);
const norm = (t: string) => t.trim().toLowerCase();
export function isConfirm(text: string): boolean { return CONFIRM.has(norm(text)); }
export function isCancel(text: string): boolean { return CANCEL.has(norm(text)); }
```

- [ ] **Step 4: 跑测试通过 + tsc + commit**

```bash
git add src/lib/channels/format-plan-card.ts src/lib/channels/confirm-keywords.ts src/lib/channels/__tests__/format-plan-card.test.ts src/lib/channels/__tests__/confirm-keywords.test.ts
git commit -m "feat(channel): formatPlanCard 计划卡 + isConfirm/isCancel 关键词"
```

---

## Task 3: clarifyOrPlan slot-filling prompt（小改）

**Files:**
- Modify: `src/lib/channels/clarify-or-plan.ts`（仅 clarify 分支 prompt）

- [ ] **Step 1: 改 clarify 的 prompt 为"问关键缺失要素"**

`clarify-or-plan.ts` 里那段 `generateText` 的 prompt（约 :60-64）改成 slot-filling 感知：
```ts
    prompt: `你是任务助手。用户在 IM 里的请求信息还不足以执行。基于对话：\n${fullMessage}\n\n` +
      `想想要把这个任务做好还缺哪些关键信息（比如：领域/主题、篇幅、风格/调性、是否配图、目标渠道等，按任务类型挑最关键的 1-2 项）。` +
      `用一句简洁中文问用户，把缺的关键项问出来。只输出问题本身。`,
```
> 只动这段 prompt 字符串，execute 判定（:45-51）与函数签名/返回不变。

- [ ] **Step 2: tsc + 现有测试**

`npx tsc --noEmit` → 0 errors；`npx vitest run src/lib/channels/__tests__/clarify-or-plan.test.ts` → 仍 PASS（mock 了 recognizeIntent + generateText，prompt 字符串变化不影响断言）。

- [ ] **Step 3: commit**
```bash
git add src/lib/channels/clarify-or-plan.ts
git commit -m "feat(channel): clarifyOrPlan 澄清问关键缺失要素（slot-filling 感知）"
```

---

## Task 4: gateway — execute→confirming + confirming 分流

**Files:**
- Modify: `src/lib/channels/gateway.ts`
- Modify: `src/lib/channels/__tests__/gateway-clarify-loop.test.ts`（改现有 execute 断言 + 加 confirming 用例）

- [ ] **Step 1: 改测试（先改断言，TDD 红）**

`gateway-clarify-loop.test.ts`：
1. 顶部 mock 加 `formatPlanCard`、`isConfirm`/`isCancel`（或不 mock，用真实——它们是纯函数，真实更好；不 mock）。`startChannelMission` 保持 mock。
2. **改现有"execute → 起 mission"用例**（约 :96-107）：现在 execute 应 → confirming + 不调 startChannelMission：
```ts
it("execute → 进 confirming 发计划卡，不直接起 mission", async () => {
  getOrCreateSession.mockResolvedValue({ id: "s1", status: "idle", contextTurns: [], clarifyRounds: 0 });
  clarifyOrPlan.mockResolvedValue({ action: "execute", summary: "抓热点", steps: [{ employeeSlug: "xiaolei", employeeName: "小蕾", skills: [], taskDescription: "抓热点" }] });
  const r = await handleInboundMessage(msg);
  expect(startChannelMission).not.toHaveBeenCalled();
  expect(updateSession).toHaveBeenCalledWith("s1", expect.objectContaining({ status: "confirming" }));
  expect(r.reply).toContain("开始"); // 计划卡含"开始"提示
});
```
3. **加 confirming 用例**：
```ts
it("confirming + 开始 → 起 mission，status running，清 pendingPlan", async () => {
  getOrCreateSession.mockResolvedValue({ id: "s1", status: "confirming", contextTurns: [], clarifyRounds: 0,
    pendingPlan: { summary: "抓热点", steps: [{ employeeSlug: "xiaolei", employeeName: "小蕾", skills: [], taskDescription: "抓热点" }] } });
  startChannelMission.mockResolvedValue({ missionId: "mis1" });
  const r = await handleInboundMessage({ ...msg, textContent: "开始" });
  expect(startChannelMission).toHaveBeenCalled();
  expect(updateSession).toHaveBeenCalledWith("s1", expect.objectContaining({ status: "running", activeMissionId: "mis1", pendingPlan: null }));
  expect(r.reply).toContain("收到");
});
it("confirming + 取消 → status idle，清 pendingPlan，不起 mission", async () => {
  getOrCreateSession.mockResolvedValue({ id: "s1", status: "confirming", contextTurns: [], clarifyRounds: 0, pendingPlan: { summary: "x", steps: [] } });
  const r = await handleInboundMessage({ ...msg, textContent: "取消" });
  expect(startChannelMission).not.toHaveBeenCalled();
  expect(updateSession).toHaveBeenCalledWith("s1", expect.objectContaining({ status: "idle", pendingPlan: null }));
  expect(r.reply).toContain("取消");
});
it("confirming + 编辑 → 重规划，更新 pendingPlan，回新卡，留 confirming", async () => {
  getOrCreateSession.mockResolvedValue({ id: "s1", status: "confirming", contextTurns: [], clarifyRounds: 0, pendingPlan: { summary: "科技", steps: [] } });
  clarifyOrPlan.mockResolvedValue({ action: "execute", summary: "财经热点", steps: [{ employeeSlug: "xiaolei", employeeName: "小蕾", skills: [], taskDescription: "抓财经热榜" }] });
  const r = await handleInboundMessage({ ...msg, textContent: "换财经" });
  expect(startChannelMission).not.toHaveBeenCalled();
  expect(updateSession).toHaveBeenCalledWith("s1", expect.objectContaining({ status: "confirming", pendingPlan: expect.objectContaining({ summary: "财经热点" }) }));
  expect(r.reply).toContain("抓财经热榜");
});
```
> mock 顶部加 `vi.mock("@/lib/channels/start-channel-mission", ...)` 已有；不要 mock formatPlanCard/confirm-keywords（用真实）。

- [ ] **Step 2: 跑测试确认失败**（execute 改断言后红 + 新 confirming 用例红）

- [ ] **Step 3: 改 gateway.ts**

1. 顶部 import 加（**这 4 个都是必加**——评审确认 gateway 当前没有 IntentStep / ChannelSessionRow import）：
```ts
import { formatPlanCard } from "./format-plan-card";
import { isConfirm, isCancel } from "./confirm-keywords";
import type { IntentStep } from "@/lib/agent/types";
import type { ChannelSessionRow } from "@/lib/dal/channel-sessions";
```
2. 加一个 enterConfirming helper（DRY，execute 与编辑重规划共用）：
```ts
async function enterConfirming(
  sessionId: string, turns: { role: string; content: string }[],
  summary: string, steps: IntentStep[],
): Promise<{ reply: string }> {
  const card = formatPlanCard(summary, steps);
  await updateSession(sessionId, {
    status: "confirming",
    pendingPlan: { summary, steps },
    contextTurns: [...turns, { role: "assistant", content: card }],
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  return { reply: card };
}
```
（顶部确认有 `import type { IntentStep } from "@/lib/agent/types";`，没有则加。）
3. `handleFreeFormMessage` 里 running 拦截（:267）之后、clarifyOrPlan（:269）之前，插 confirming 分流：
```ts
  if (session.status === "confirming") {
    return handleConfirmingMessage(text, msg, session, channelCtx);
  }
```
4. 把现有 execute 分支（:294-302）整体替换为（execute → 进 confirming）：
```ts
  return enterConfirming(session.id, turns, result.summary, result.steps);
```
5. 新增 `handleConfirmingMessage`：
```ts
async function handleConfirmingMessage(
  text: string, msg: StandardizedMessage, session: ChannelSessionRow,
  channelCtx: { organizationId: string; configId: string; platform: "dingtalk" | "wechat_work"; chatId: string; externalUserId: string },
): Promise<{ reply: string; missionId?: string }> {
  const plan = session.pendingPlan;
  if (!plan) {
    // 异常兜底：confirming 但无计划 → 复位 idle 让用户重发
    await updateSession(session.id, { status: "idle", pendingPlan: null, contextTurns: [], clarifyRounds: 0 });
    return { reply: "请重新说一下你的需求。" };
  }

  if (isCancel(text)) {
    await updateSession(session.id, { status: "idle", pendingPlan: null, clarifyRounds: 0, contextTurns: [] });
    return { reply: "已取消，可重新发起。" };
  }

  if (isConfirm(text)) {
    const { missionId } = await startChannelMission(msg.organizationId, {
      message: plan.summary, summary: plan.summary, steps: plan.steps,
      externalMessageId: msg.externalMessageId, channelCtx,
    });
    await updateSession(session.id, {
      status: "running", activeMissionId: missionId, pendingPlan: null,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });
    return { reply: `✅ 收到，正在处理：${plan.summary}。完成后在群里回结果。`, missionId };
  }

  // 编辑 → 带上下文重规划
  let result;
  try {
    result = await clarifyOrPlan(msg.organizationId, session, text);
  } catch (err) {
    console.error("[gateway] clarifyOrPlan failed:", err);
    return { reply: "系统忙，请稍后再试。" };
  }
  const turns = [...(session.contextTurns ?? []), { role: "user", content: text }];
  if (result.action === "clarify") {
    const rounds = session.clarifyRounds + 1;
    if (rounds > MAX_CLARIFY_ROUNDS) {
      await updateSession(session.id, { status: "idle", clarifyRounds: 0, contextTurns: [], pendingPlan: null, expiresAt: null });
      return { reply: "没太理解你的需求，请换个说法，或用 #场景名 直接发起任务。" };
    }
    await updateSession(session.id, {
      status: "clarifying", clarifyRounds: rounds,
      contextTurns: [...turns, { role: "assistant", content: result.question }],
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });
    return { reply: result.question };
  }
  return enterConfirming(session.id, turns, result.summary, result.steps);
}
```
> `ChannelSessionRow` 从 `@/lib/dal/channel-sessions` import（确认 gateway 顶部已 import，没有则加 `import type { ChannelSessionRow } from "@/lib/dal/channel-sessions";`）。

- [ ] **Step 4: 跑测试 + tsc**

`npx vitest run src/lib/channels/__tests__/gateway-clarify-loop.test.ts` → 全 PASS（改后的 execute 用例 + 3 个 confirming 用例 + 原 running 拦截/clarify 用例）；`npx tsc --noEmit` → 0 errors。

- [ ] **Step 5: commit**
```bash
git add src/lib/channels/gateway.ts src/lib/channels/__tests__/gateway-clarify-loop.test.ts
git commit -m "feat(channel): execute→计划确认卡(confirming)，confirming 态分流 确认/取消/编辑"
```

---

## Task 5: 全量验证 + 端到端手测

- [ ] **Step 1: 全量**
```bash
npx tsc --noEmit   # 0 errors
npm run build      # 通过
npm test           # 全绿
```

- [ ] **Step 2: 端到端手测**（worker + inngest 起着）

1. @机器人 发模糊请求"帮我弄个热点稿" → 期望先**澄清问关键要素**（领域/篇幅…）。
2. 答"科技 800字" → 期望回**计划确认卡**（"我将：①…②… 回复 开始 或说要改的"）。
3. 回"换财经" → 期望回**更新后的计划卡**（财经）。
4. 回"开始" → 期望 `✅ 收到，正在处理…`，随后（Phase 0）群里收到结果/失败回执。
5. 在计划卡阶段回"取消" → 期望"已取消"，再发新请求正常。

- [ ] **Step 3: 收尾 commit（如有微调）**

---

## 备注

- externalMessageId：confirming"开始"用**当前"开始"消息的** `msg.externalMessageId`（去重对"这次启动"唯一）；pendingPlan 只存 `{summary, steps}`。
- 续期：confirming / 编辑 / 转 running 都写 expiresAt（30min）；idle 复位不写。
- Phase 1b（后续）：running 中全局取消 + 结果卡一键跟进。

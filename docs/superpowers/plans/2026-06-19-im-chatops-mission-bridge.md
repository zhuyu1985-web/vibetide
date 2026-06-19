# IM ChatOps → Mission 引擎 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 钉钉群 @机器人 发自然语言 → 后台多轮澄清问清楚 → 规划并跑一个 ad-hoc mission → 只把最终结果（markdown 摘要 + 查看链接）发回群。

**Architecture:** 复用钉钉 Stream 接收 + `recognizeIntent` + ad-hoc mission 物化 + `sendChannelMessage`/`postToSessionWebhook`。新增：`channel_sessions` 澄清状态机、`clarifyOrPlan` 澄清 agent、无登录态 ad-hoc 启动器（抽 `startAdHocMission` 物化 helper）、`sendChannelResult` 结果回执（挂 `executeMissionDirect().then()`）。不碰对话中心、不依赖死代码 `mission-notifier`、不依赖不存在的 `mission.sourceContext`。

**Tech Stack:** Next.js 16、Drizzle、Vitest、AI SDK v6（`generateText` + `getLanguageModel`）、钉钉 Stream SDK。

**Spec:** `docs/superpowers/specs/2026-06-19-im-chatops-mission-bridge-design.md`

---

## Preflight（开工前必读）

- **Node 22 + pnpm**（`pnpm dev` / `pnpm test`，别混 npm）。
- **每个 commit 走 pre-commit 全量 vitest**（当前 1099 全绿），必须本地库 5433 在跑；**禁止 `--no-verify`**。
- **commit 只 `git add` 本 task 文件**（工作区有无关 WIP，不要 `git add -A`）。
- **新测试 DB-free**：`vi.mock("@/db")` / `vi.mock` LLM 与 DAL；mock 用 `vi.hoisted()` 包，避免 hoisting TDZ。
- **本地 schema 用 `db:push`**（journal 空；push 是交互式 TUI，加表卡住时可临时写 `scripts/_tmp-*.ts` 用 `db.execute(sql\`CREATE TABLE ...\`)` + `npx tsx --env-file=.env.local` 跑，完事删脚本）。生产 `db:generate`→`db:migrate`。

## 已核实事实（评审确认，照此实现）

- `executeMissionDirect(missionId, orgId)`（`src/lib/mission-executor.ts:2125`）**全相 await 完才 resolve**，返回终态对象。故完成回执挂 `.then()` 成立。
- `mission.finalOutput`（jsonb）**四种形态**：Level1 满额 = `StepOutput`（有 `.summary`，`src/lib/agent/types.ts:116`）；Level2/3 降级 = `{ degradation_level, message, completedTasks }`（只有 `.message`）；Level4 失败 = `{ error:true, message, failureReasons }` 且 mission **正常 resolve、status='failed'**（不抛）。→ 取摘要 `finalOutput.summary ?? finalOutput.message ?? 兜底`；失败靠判 `mission.status==='failed'`，不能只靠 `.catch()`。
- `mission-notifier.ts` 是死代码、`mission.sourceContext` 列不存在、`channel_messages.missionId(inbound)` 关联从不建立 → **都不依赖**。
- `recognizeIntent`（`src/lib/agent/intent-recognition.ts`）返回 `IntentResult{summary,confidence,intentType,steps,reasoning}`，**不产澄清问题**。
- ad-hoc 物化逻辑内联在 `startAdHocMission`（`src/app/actions/ad-hoc-mission.ts:55-100`，"use server" 文件只能导出 action）→ 抽到独立非-server 模块。
- **`IntentStep`（`src/lib/agent/types.ts:194`）字段 = `{ employeeSlug, employeeName, skills, taskDescription, dependsOn? }`——无 `skillSlug`！** 所有测试 fixture 用完整 IntentStep，别写 `{skillSlug:...}`。
- **`ChatIntentType`（types.ts:184-192）无 `'workflow'`**；合法值含 `content_creation` / `information_retrieval` / `general_chat` 等。
- **`getLanguageModel(config)` 必传参**（`model-router.ts:101`）；照 `intent-recognition.ts:206-211` 传 `{ provider, model, temperature, maxTokens }`，不可空调（空调 tsc 必挂）。

## File Structure

新建：
- `src/db/schema/channel-sessions.ts` — `channel_sessions` 表。
- `src/lib/dal/channel-sessions.ts` — session DAL（无 auth，按三元组键）。
- `src/lib/missions/materialize-ad-hoc.ts` — 从 `startAdHocMission` 抽出的物化 helper（非 "use server"）。
- `src/lib/channels/clarify-or-plan.ts` — `clarifyOrPlan` 澄清 agent。
- `src/lib/channels/start-channel-mission.ts` — 无登录态 ad-hoc 启动器 + 完成回执挂载。
- `src/lib/channels/channel-result-notify.ts` — `sendChannelResult` / `sendChannelFailure`。
- 各自 `__tests__/`。

修改：
- `src/db/schema/index.ts`（导出新表）
- `src/app/actions/ad-hoc-mission.ts`（改用抽出的 helper，行为不变）
- `src/lib/channels/gateway.ts`（`handleFreeFormMessage` → 澄清循环）

---

## Task 1: channel_sessions schema + DAL

**Files:**
- Create: `src/db/schema/channel-sessions.ts`
- Modify: `src/db/schema/index.ts`（加 `export * from "./channel-sessions";`，照现有导出风格）
- Create: `src/lib/dal/channel-sessions.ts`
- Test: `src/lib/dal/__tests__/channel-sessions.test.ts`

- [ ] **Step 1: 写表 schema**

```ts
// src/db/schema/channel-sessions.ts
import { pgTable, uuid, text, jsonb, integer, timestamp, unique } from "drizzle-orm/pg-core";
import { organizations } from "./users";
import { channelConfigs } from "./channels";
import { missions } from "./missions";
import { channelPlatformEnum } from "./enums";

/** 一个 IM 会话（configId+chatId+发送者）一份澄清/执行状态。回执反查的真相源。 */
export const channelSessions = pgTable("channel_sessions", {
  id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  configId: uuid("config_id").notNull().references(() => channelConfigs.id, { onDelete: "cascade" }),
  platform: channelPlatformEnum("platform").notNull(),
  chatId: text("chat_id").notNull(),
  externalUserId: text("external_user_id").notNull(),
  status: text("status").notNull().default("idle"), // idle | clarifying | running
  contextTurns: jsonb("context_turns").$type<{ role: string; content: string }[]>().notNull().default([]),
  activeMissionId: uuid("active_mission_id").references(() => missions.id, { onDelete: "set null" }),
  clarifyRounds: integer("clarify_rounds").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [unique("channel_sessions_triple_uidx").on(t.configId, t.chatId, t.externalUserId)]);
```
> 看 `src/db/schema/channels.ts` 确认 `unique` 用法与本仓一致；不一致就照本仓写法（如 `uniqueIndex`）。

- [ ] **Step 2: 导出 + 推库**

`src/db/schema/index.ts` 加 `export * from "./channel-sessions";`（位置照字母/现有顺序）。
Run: `npm run db:push`（交互 TUI 按提示建表；若卡住用 Preflight 的 `db.execute` 兜底）。
确认列在：临时脚本 `select column_name from information_schema.columns where table_name='channel_sessions'`。

- [ ] **Step 3: 写 DAL 失败测试**

```ts
// src/lib/dal/__tests__/channel-sessions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const { findFirst, returning, values, insert, set, where, update } = vi.hoisted(() => {
  const returning = vi.fn();
  const values = vi.fn(() => ({ returning }));
  const insert = vi.fn(() => ({ values }));
  const where = vi.fn();
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  return { findFirst: vi.fn(), returning, values, insert, set, where, update };
});
vi.mock("@/db", () => ({ db: { query: { channelSessions: { findFirst } }, insert, update } }));

import { getOrCreateSession, resetSession } from "../channel-sessions";

const key = { organizationId: "org1", configId: "cfg1", platform: "dingtalk" as const, chatId: "c1", externalUserId: "u1" };
beforeEach(() => { findFirst.mockReset(); returning.mockReset(); insert.mockClear(); update.mockClear(); where.mockReset(); });

describe("getOrCreateSession", () => {
  it("已存在 → 直接返回", async () => {
    findFirst.mockResolvedValue({ id: "s1", ...key, status: "idle", contextTurns: [], clarifyRounds: 0 });
    const s = await getOrCreateSession(key);
    expect(s.id).toBe("s1");
    expect(insert).not.toHaveBeenCalled();
  });
  it("不存在 → 插入新行", async () => {
    findFirst.mockResolvedValue(undefined);
    returning.mockResolvedValue([{ id: "s2", ...key, status: "idle", contextTurns: [], clarifyRounds: 0 }]);
    const s = await getOrCreateSession(key);
    expect(insert).toHaveBeenCalled();
    expect(s.id).toBe("s2");
  });
});

describe("resetSession", () => {
  it("按三元组键复位 idle + 清 activeMissionId", async () => {
    where.mockResolvedValue(undefined);
    await resetSession({ configId: "cfg1", chatId: "c1", externalUserId: "u1" });
    expect(update).toHaveBeenCalled();
    const patch = set.mock.calls[0][0];
    expect(patch).toMatchObject({ status: "idle", activeMissionId: null, clarifyRounds: 0 });
  });
});
```

- [ ] **Step 4: 跑测试确认失败** → `npx vitest run src/lib/dal/__tests__/channel-sessions.test.ts`（模块不存在）

- [ ] **Step 5: 实现 DAL**

```ts
// src/lib/dal/channel-sessions.ts
import { db } from "@/db";
import { channelSessions } from "@/db/schema/channel-sessions";
import { and, eq } from "drizzle-orm";

export type ChannelSessionRow = typeof channelSessions.$inferSelect;
export interface SessionKey {
  organizationId: string; configId: string; platform: "dingtalk" | "wechat_work";
  chatId: string; externalUserId: string;
}

export async function getOrCreateSession(key: SessionKey): Promise<ChannelSessionRow> {
  const existing = await db.query.channelSessions.findFirst({
    where: and(
      eq(channelSessions.configId, key.configId),
      eq(channelSessions.chatId, key.chatId),
      eq(channelSessions.externalUserId, key.externalUserId),
    ),
  });
  if (existing) return existing;
  const [row] = await db.insert(channelSessions).values({
    organizationId: key.organizationId, configId: key.configId, platform: key.platform,
    chatId: key.chatId, externalUserId: key.externalUserId,
  }).returning();
  return row;
}

export async function updateSession(
  id: string,
  patch: Partial<Pick<ChannelSessionRow, "status" | "contextTurns" | "activeMissionId" | "clarifyRounds" | "expiresAt">>,
): Promise<void> {
  await db.update(channelSessions).set({ ...patch, updatedAt: new Date() }).where(eq(channelSessions.id, id));
}

/** 按三元组键复位（mission 完成回执时用，回调内无 session id）。 */
export async function resetSession(key: Pick<SessionKey, "configId" | "chatId" | "externalUserId">): Promise<void> {
  await db.update(channelSessions)
    .set({ status: "idle", activeMissionId: null, clarifyRounds: 0, contextTurns: [], updatedAt: new Date() })
    .where(and(
      eq(channelSessions.configId, key.configId),
      eq(channelSessions.chatId, key.chatId),
      eq(channelSessions.externalUserId, key.externalUserId),
    ));
}
```

- [ ] **Step 6: 跑测试确认通过 + tsc** → PASS（4 passed）；`npx tsc --noEmit` → 0 errors

- [ ] **Step 7: Commit**
```bash
git add src/db/schema/channel-sessions.ts src/db/schema/index.ts src/lib/dal/channel-sessions.ts src/lib/dal/__tests__/channel-sessions.test.ts
git commit -m "feat(channel): channel_sessions 表 + DAL（澄清状态机）"
```

---

## Task 2: 抽取 materializeAdHocMission helper

**Files:**
- Create: `src/lib/missions/materialize-ad-hoc.ts`
- Modify: `src/app/actions/ad-hoc-mission.ts:55-100`（改用 helper，行为不变）
- Test: `src/lib/missions/__tests__/materialize-ad-hoc.test.ts`

- [ ] **Step 1: 写失败测试（mock db + 依赖）**

```ts
// src/lib/missions/__tests__/materialize-ad-hoc.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const { missionReturning, taskReturning, missionValues, taskValues, insert,
        getOrProvisionLeader, loadAvailableEmployees, buildAdHocTasks } = vi.hoisted(() => {
  const missionReturning = vi.fn();
  const taskReturning = vi.fn();
  const missionValues = vi.fn(() => ({ returning: missionReturning }));
  const taskValues = vi.fn(() => ({ returning: taskReturning }));
  let n = 0;
  const insert = vi.fn(() => (n++ === 0 ? { values: missionValues } : { values: taskValues }));
  return { missionReturning, taskReturning, missionValues, taskValues, insert,
    getOrProvisionLeader: vi.fn(), loadAvailableEmployees: vi.fn(), buildAdHocTasks: vi.fn() };
});
vi.mock("@/db", () => ({ db: { insert } }));
vi.mock("@/app/actions/missions", () => ({ getOrProvisionLeader }));
vi.mock("@/lib/mission-core", () => ({ loadAvailableEmployees }));
vi.mock("@/lib/agent/intent-to-tasks", () => ({ buildAdHocTasks }));

import { materializeAdHocMission } from "../materialize-ad-hoc";

beforeEach(() => { vi.clearAllMocks(); });

it("插入 mission(scenario=custom) + 透传 sourceModule/sourceEntityId", async () => {
  getOrProvisionLeader.mockResolvedValue({ id: "leader1" });
  loadAvailableEmployees.mockResolvedValue([]);
  buildAdHocTasks.mockReturnValue({ tasks: [], teamMemberIds: ["leader1"] });
  missionReturning.mockResolvedValue([{ id: "m1" }]);
  const r = await materializeAdHocMission("org1", {
    message: "抓个热点",
    steps: [{ employeeSlug: "xiaolei", employeeName: "小蕾", skills: ["x"], taskDescription: "抓热点" }],
    summary: "热点", sourceModule: "channel:dingtalk", sourceEntityId: "msg1",
  });
  expect(r.missionId).toBe("m1");
  const v = missionValues.mock.calls[0][0];
  expect(v).toMatchObject({ organizationId: "org1", scenario: "custom",
    sourceModule: "channel:dingtalk", sourceEntityId: "msg1" });
});
```

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 实现 helper**（把 `ad-hoc-mission.ts:55-100` 物化逻辑搬来，加可选 source 字段；**不含** requireAuth、**不含** executeMissionDirect）

```ts
// src/lib/missions/materialize-ad-hoc.ts
import { db } from "@/db";
import { missions, missionTasks } from "@/db/schema";
import { getOrProvisionLeader } from "@/app/actions/missions";
import { loadAvailableEmployees } from "@/lib/mission-core";
import { buildAdHocTasks } from "@/lib/agent/intent-to-tasks";
import type { IntentStep } from "@/lib/agent/types";

export interface MaterializeAdHocInput {
  message: string;
  steps: IntentStep[];
  title?: string;
  summary?: string;
  conversationId?: string | null;
  projectId?: string | null;
  sourceModule?: string;      // 渠道触发时打 'channel:dingtalk'（去重/审计用）
  sourceEntityId?: string;    // externalMessageId
}

/** 把 intent.steps 物化成 mission + task DAG，返回 missionId。不执行、不要 auth。 */
export async function materializeAdHocMission(
  orgId: string, input: MaterializeAdHocInput,
): Promise<{ missionId: string }> {
  const leader = await getOrProvisionLeader(orgId);
  const employees = await loadAvailableEmployees(orgId);
  const { tasks, teamMemberIds } = buildAdHocTasks(input.steps, employees, leader.id);
  const title = (input.title?.trim() || input.message.trim()).slice(0, 60) || "新任务";

  const [mission] = await db.insert(missions).values({
    organizationId: orgId, title, scenario: "custom", userInstruction: input.message,
    leaderEmployeeId: leader.id, status: "queued", teamMembers: teamMemberIds,
    inputParams: input.summary ? { intentSummary: input.summary } : {},
    projectId: input.projectId ?? null, conversationId: input.conversationId ?? null,
    ...(input.sourceModule ? { sourceModule: input.sourceModule } : {}),
    ...(input.sourceEntityId ? { sourceEntityId: input.sourceEntityId } : {}),
  }).returning({ id: missions.id });
  const missionId = mission.id;

  const taskIds: string[] = [];
  for (const def of tasks) {
    const depIds = def.dependsOnIndices.map((i) => taskIds[i]).filter((v): v is string => Boolean(v));
    const [created] = await db.insert(missionTasks).values({
      missionId, title: def.title, description: def.description,
      assignedEmployeeId: def.assignedEmployeeId, assignedRole: def.assignedRole,
      dependencies: depIds, priority: def.priority, status: "pending",
    }).returning({ id: missionTasks.id });
    taskIds.push(created.id);
  }
  return { missionId };
}
```
> 核对 `missions` schema 确有 `sourceModule`/`sourceEntityId` 列（`src/db/schema/missions.ts:55-56`，有）。

- [ ] **Step 4: 重构 `startAdHocMission` 用 helper**

`ad-hoc-mission.ts` 删 :55-100 的物化代码，改为：
```ts
  const { missionId } = await materializeAdHocMission(orgId, {
    message: input.message, steps, title: input.title, summary: input.summary,
    conversationId: input.conversationId, projectId: input.projectId,
  });
```
保留其后的 `revalidatePath` + `executeMissionDirect(...).then().catch()` 不变。加 import。删掉不再用的 import（`getOrProvisionLeader`/`loadAvailableEmployees`/`buildAdHocTasks`/`missions`/`missionTasks` 若 helper 用了就从 action 移除，避免未用 import lint 报错——以 tsc/eslint 为准）。

- [ ] **Step 5: 跑测试 + tsc** → PASS；`npx tsc --noEmit` 0 errors（确认 startAdHocMission 重构后不破）

- [ ] **Step 6: Commit**
```bash
git add src/lib/missions/materialize-ad-hoc.ts src/lib/missions/__tests__/materialize-ad-hoc.test.ts src/app/actions/ad-hoc-mission.ts
git commit -m "refactor(mission): 抽出 materializeAdHocMission helper（去 auth，加 source 字段）"
```

---

## Task 3: clarifyOrPlan 澄清 agent

**Files:**
- Create: `src/lib/channels/clarify-or-plan.ts`
- Test: `src/lib/channels/__tests__/clarify-or-plan.test.ts`

- [ ] **Step 1: 写失败测试（mock recognizeIntent + generateText + loadAvailableEmployees）**

```ts
// src/lib/channels/__tests__/clarify-or-plan.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const { recognizeIntent, generateText, loadAvailableEmployees } = vi.hoisted(() => ({
  recognizeIntent: vi.fn(), generateText: vi.fn(), loadAvailableEmployees: vi.fn(),
}));
vi.mock("@/lib/agent/intent-recognition", () => ({ recognizeIntent }));
vi.mock("ai", () => ({ generateText }));
vi.mock("@/lib/agent/model-router", () => ({ getLanguageModel: () => ({}) }));
vi.mock("@/lib/mission-core", () => ({ loadAvailableEmployees }));

import { clarifyOrPlan } from "../clarify-or-plan";

beforeEach(() => { vi.clearAllMocks(); loadAvailableEmployees.mockResolvedValue([]); });

it("高置信 + 有 steps → execute", async () => {
  recognizeIntent.mockResolvedValue({ summary: "抓热点", confidence: 0.9, intentType: "content_creation", steps: [{ employeeSlug: "xiaolei", employeeName: "小蕾", skills: ["x"], taskDescription: "抓热点" }], reasoning: "" });
  const r = await clarifyOrPlan("org1", { contextTurns: [] } as never, "今天抓个科技热点写成稿");
  expect(r.action).toBe("execute");
  if (r.action === "execute") { expect(r.steps.length).toBe(1); expect(r.summary).toBe("抓热点"); }
});

it("低置信 / 无 steps → clarify，产出问题", async () => {
  recognizeIntent.mockResolvedValue({ summary: "不明确", confidence: 0.3, intentType: "general_chat", steps: [], reasoning: "" });
  generateText.mockResolvedValue({ text: "你想针对哪个平台、什么主题？" });
  const r = await clarifyOrPlan("org1", { contextTurns: [] } as never, "帮我搞个东西");
  expect(r.action).toBe("clarify");
  if (r.action === "clarify") expect(r.question).toContain("？");
});
```

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 实现**

```ts
// src/lib/channels/clarify-or-plan.ts
import { generateText } from "ai";
import { getLanguageModel } from "@/lib/agent/model-router";
import { recognizeIntent } from "@/lib/agent/intent-recognition";
import { loadAvailableEmployees } from "@/lib/mission-core";
import type { IntentStep } from "@/lib/agent/types";
import type { ChannelSessionRow } from "@/lib/dal/channel-sessions";

export type ClarifyOrPlanResult =
  | { action: "clarify"; question: string }
  | { action: "execute"; summary: string; steps: IntentStep[] };

const CONFIDENCE_THRESHOLD = 0.6;

/** 用累积上下文 + 最新消息判定：信息够→规划 steps 执行；不够→产一个澄清问题。 */
export async function clarifyOrPlan(
  orgId: string, session: ChannelSessionRow, message: string,
): Promise<ClarifyOrPlanResult> {
  // 累积上下文拼进消息，让 recognizeIntent 看到多轮
  const ctx = (session.contextTurns ?? []).map((t) => `${t.role}: ${t.content}`).join("\n");
  const fullMessage = ctx ? `${ctx}\nuser: ${message}` : message;

  const employees = await loadAvailableEmployees(orgId);
  const catalog = employees.map((e) => ({
    slug: e.slug, name: e.name, nickname: e.nickname, title: e.title, skills: e.skills ?? [],
  }));
  const intent = await recognizeIntent(fullMessage, "xiaolei", catalog, [], []);

  if (intent.confidence >= CONFIDENCE_THRESHOLD && intent.steps.length > 0
      && intent.intentType !== "general_chat") {
    return { action: "execute", summary: intent.summary, steps: intent.steps };
  }

  // 信息不足 → 生成一个中文澄清问题。getLanguageModel 必传 config（照 intent-recognition.ts:206-211）。
  const modelName = process.env.OPENAI_MODEL ?? "deepseek-chat";
  const { text } = await generateText({
    model: getLanguageModel({ provider: "openai", model: modelName, temperature: 0.3, maxTokens: 256 }),
    prompt: `你是任务助手。用户在 IM 里的请求信息不足以执行。基于对话：\n${fullMessage}\n\n` +
      `用一句中文问一个最关键的澄清问题，帮你补齐执行所需信息。只输出问题本身。`,
    maxOutputTokens: 256,
  });
  return { action: "clarify", question: text.trim() || "能再具体说说你想做什么吗？" };
}
```
> `loadAvailableEmployees` 返回的字段名以真实实现为准（看 `src/lib/mission-core`）；catalog 映射对齐 `recognizeIntent` 第 3 参的 `EmployeeSkillInfo`（slug/name/nickname/title/skills）。

- [ ] **Step 4: 跑测试 + tsc** → PASS（2 passed）；tsc 0 errors

- [ ] **Step 5: Commit**
```bash
git add src/lib/channels/clarify-or-plan.ts src/lib/channels/__tests__/clarify-or-plan.test.ts
git commit -m "feat(channel): clarifyOrPlan 澄清 agent（够清楚→规划 / 不够→问）"
```

---

## Task 4: 渠道结果回执 + 无登录态启动器

**Files:**
- Create: `src/lib/channels/channel-result-notify.ts`
- Create: `src/lib/channels/start-channel-mission.ts`
- Test: `src/lib/channels/__tests__/channel-result-notify.test.ts`

- [ ] **Step 1: 写 `sendChannelResult` 失败测试（mock db + outbound + dal + session）**

```ts
// src/lib/channels/__tests__/channel-result-notify.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const { findFirst, getChannelConfig, sendChannelMessage, resetSession } = vi.hoisted(() => ({
  findFirst: vi.fn(), getChannelConfig: vi.fn(), sendChannelMessage: vi.fn(), resetSession: vi.fn(),
}));
vi.mock("@/db", () => ({ db: { query: { missions: { findFirst } } } }));
vi.mock("@/lib/dal/channels", () => ({ getChannelConfig }));
vi.mock("@/lib/channels/outbound", () => ({ sendChannelMessage }));
vi.mock("@/lib/dal/channel-sessions", () => ({ resetSession }));

import { sendChannelResult } from "../channel-result-notify";
const ctx = { organizationId: "org1", configId: "cfg1", platform: "dingtalk" as const, chatId: "c1", externalUserId: "u1" };
beforeEach(() => { vi.clearAllMocks(); getChannelConfig.mockResolvedValue({ id: "cfg1", platform: "dingtalk", appKey: "https://oapi/x" }); });

it("满额完成 → 用 finalOutput.summary 发 markdown + 链接 + 复位", async () => {
  findFirst.mockResolvedValue({ id: "m1", status: "completed", title: "T", finalOutput: { summary: "完成了X" } });
  await sendChannelResult(ctx, "m1");
  const arg = sendChannelMessage.mock.calls[0][0];
  expect(arg.content).toContain("完成了X");
  expect(arg.content).toContain("/missions/m1");
  expect(resetSession).toHaveBeenCalledWith({ configId: "cfg1", chatId: "c1", externalUserId: "u1" });
});

it("降级完成 → 退到 finalOutput.message", async () => {
  findFirst.mockResolvedValue({ id: "m1", status: "completed", title: "T", finalOutput: { message: "部分完成" } });
  await sendChannelResult(ctx, "m1");
  expect(sendChannelMessage.mock.calls[0][0].content).toContain("部分完成");
});

it("status=failed（正常 resolve）→ 失败文案", async () => {
  findFirst.mockResolvedValue({ id: "m1", status: "failed", title: "T", finalOutput: { error: true, message: "炸了" } });
  await sendChannelResult(ctx, "m1");
  expect(sendChannelMessage.mock.calls[0][0].content).toContain("失败");
});
```

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 实现 `channel-result-notify.ts`**

```ts
// src/lib/channels/channel-result-notify.ts
import { db } from "@/db";
import { missions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getChannelConfig } from "@/lib/dal/channels";
import { sendChannelMessage } from "@/lib/channels/outbound";
import { resetSession } from "@/lib/dal/channel-sessions";

export interface ChannelCtx {
  organizationId: string; configId: string;
  platform: "dingtalk" | "wechat_work"; chatId: string; externalUserId: string;
}

function siteUrl() { return process.env.NEXT_PUBLIC_SITE_URL ?? ""; }

export async function sendChannelResult(ctx: ChannelCtx, missionId: string): Promise<void> {
  const mission = await db.query.missions.findFirst({ where: eq(missions.id, missionId) });
  const config = await getChannelConfig(ctx.configId);
  const reset = () => resetSession({ configId: ctx.configId, chatId: ctx.chatId, externalUserId: ctx.externalUserId });
  if (!mission || !config) { await reset(); return; }

  const fo = (mission.finalOutput ?? {}) as { summary?: string; message?: string };
  const link = `${siteUrl()}/missions/${missionId}`;
  let content: string;
  if (mission.status === "failed") {
    content = `❌ 任务失败：${fo.message ?? fo.summary ?? "执行未完成"}\n详情：${link}`;
  } else {
    const summary = fo.summary ?? fo.message ?? "已完成";
    content = `✅ 已完成：${summary}\n在系统查看：${link}`;
  }
  await sendChannelMessage({ config, chatId: ctx.chatId, type: "markdown", title: mission.title ?? "任务结果", content });
  await reset();
}

export async function sendChannelFailure(ctx: ChannelCtx, missionId: string, err: unknown): Promise<void> {
  const config = await getChannelConfig(ctx.configId);
  await resetSession({ configId: ctx.configId, chatId: ctx.chatId, externalUserId: ctx.externalUserId });
  if (!config) return;
  const msg = err instanceof Error ? err.message : String(err);
  await sendChannelMessage({ config, chatId: ctx.chatId, type: "text",
    content: `❌ 处理出错：${msg}，可稍后重试或换个说法。` });
}
```
> 核对 `sendChannelMessage` 的 `SendOptions`（`outbound.ts:17`）字段（config/chatId/type/title?/content）与上面一致；钉钉 `chatId` 仅用于日志，实际发往 `config.appKey` 群。

- [ ] **Step 4: 实现 `start-channel-mission.ts`**（无测试文件——薄壳；逻辑在 helper/notify 里已测）

```ts
// src/lib/channels/start-channel-mission.ts
import { materializeAdHocMission } from "@/lib/missions/materialize-ad-hoc";
import { executeMissionDirect } from "@/lib/mission-executor";
import { sendChannelResult, sendChannelFailure, type ChannelCtx } from "./channel-result-notify";
import type { IntentStep } from "@/lib/agent/types";

/** 无登录态启动：物化 ad-hoc mission + fire-and-forget 执行 + 完成回执。返回 missionId。 */
export async function startChannelMission(
  orgId: string,
  input: { message: string; summary: string; steps: IntentStep[]; externalMessageId: string; channelCtx: ChannelCtx },
): Promise<{ missionId: string }> {
  const { missionId } = await materializeAdHocMission(orgId, {
    message: input.message, steps: input.steps, summary: input.summary,
    sourceModule: `channel:${input.channelCtx.platform}`, sourceEntityId: input.externalMessageId,
  });
  // executeMissionDirect 跑完才 resolve（已核实），故 .then() 即完成回执
  void executeMissionDirect(missionId, orgId)
    .then(() => sendChannelResult(input.channelCtx, missionId))
    .catch((err) => sendChannelFailure(input.channelCtx, missionId, err));
  return { missionId };
}
```

- [ ] **Step 5: 跑测试 + tsc** → notify 测试 PASS（3 passed）；tsc 0 errors

- [ ] **Step 6: Commit**
```bash
git add src/lib/channels/channel-result-notify.ts src/lib/channels/start-channel-mission.ts src/lib/channels/__tests__/channel-result-notify.test.ts
git commit -m "feat(channel): 结果回执 sendChannelResult + 无登录态 ad-hoc 启动器"
```

---

## Task 5: gateway 自由消息分支 → 澄清循环

**Files:**
- Modify: `src/lib/channels/gateway.ts`（`handleFreeFormMessage` 重写为 session-aware）
- Test: `src/lib/channels/__tests__/gateway-clarify-loop.test.ts`

- [ ] **Step 1: 写失败测试（mock session DAL + clarifyOrPlan + startChannelMission + record actions）**

```ts
// src/lib/channels/__tests__/gateway-clarify-loop.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const { getOrCreateSession, updateSession, clarifyOrPlan, startChannelMission,
        recordInboundMessage, recordOutboundMessage } = vi.hoisted(() => ({
  getOrCreateSession: vi.fn(), updateSession: vi.fn(), clarifyOrPlan: vi.fn(), startChannelMission: vi.fn(),
  recordInboundMessage: vi.fn().mockResolvedValue({ messageId: "x" }),
  recordOutboundMessage: vi.fn().mockResolvedValue({ messageId: "y" }),
}));
vi.mock("@/lib/dal/channel-sessions", () => ({ getOrCreateSession, updateSession, resetSession: vi.fn() }));
vi.mock("@/lib/channels/clarify-or-plan", () => ({ clarifyOrPlan }));
vi.mock("@/lib/channels/start-channel-mission", () => ({ startChannelMission }));
vi.mock("@/app/actions/channels", () => ({ recordInboundMessage, recordOutboundMessage }));

import { handleInboundMessage } from "../gateway";
const msg = { platform: "dingtalk" as const, configId: "cfg1", organizationId: "org1",
  externalMessageId: "m1", externalUserId: "u1", chatId: "c1", textContent: "帮我搞个东西", rawMessage: {} };
beforeEach(() => { vi.clearAllMocks(); });

it("running 中 → 回'处理中'，不调 clarifyOrPlan", async () => {
  getOrCreateSession.mockResolvedValue({ id: "s1", status: "running", contextTurns: [], clarifyRounds: 0 });
  const r = await handleInboundMessage(msg);
  expect(r.reply).toContain("处理中");
  expect(clarifyOrPlan).not.toHaveBeenCalled();
});

it("clarify → 回问题，session=clarifying，轮数+1", async () => {
  getOrCreateSession.mockResolvedValue({ id: "s1", status: "idle", contextTurns: [], clarifyRounds: 0 });
  clarifyOrPlan.mockResolvedValue({ action: "clarify", question: "针对哪个平台？" });
  const r = await handleInboundMessage(msg);
  expect(r.reply).toContain("针对哪个平台");
  expect(updateSession).toHaveBeenCalledWith("s1", expect.objectContaining({ status: "clarifying", clarifyRounds: 1 }));
});

it("execute → 起 mission，session=running，回收到", async () => {
  getOrCreateSession.mockResolvedValue({ id: "s1", status: "idle", contextTurns: [], clarifyRounds: 0 });
  clarifyOrPlan.mockResolvedValue({ action: "execute", summary: "抓热点", steps: [{ employeeSlug: "xiaolei", employeeName: "小蕾", skills: ["x"], taskDescription: "抓热点" }] });
  startChannelMission.mockResolvedValue({ missionId: "mis1" });
  const r = await handleInboundMessage(msg);
  expect(startChannelMission).toHaveBeenCalled();
  expect(updateSession).toHaveBeenCalledWith("s1", expect.objectContaining({ status: "running", activeMissionId: "mis1" }));
  expect(r.reply).toContain("收到");
});
```

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 重写 `handleFreeFormMessage`**（gateway.ts；保留 `#命令` 与链接快速路径不动）

把现有 `handleFreeFormMessage`（约 :248）整体替换为 session-aware 版本：
```ts
import { getOrCreateSession, updateSession } from "@/lib/dal/channel-sessions";
import { clarifyOrPlan } from "./clarify-or-plan";
import { startChannelMission } from "./start-channel-mission";

const MAX_CLARIFY_ROUNDS = 5;

async function handleFreeFormMessage(text: string, msg: StandardizedMessage): Promise<{ reply: string; missionId?: string }> {
  const channelCtx = {
    organizationId: msg.organizationId, configId: msg.configId, platform: msg.platform,
    chatId: msg.chatId, externalUserId: msg.externalUserId,
  };
  const session = await getOrCreateSession(channelCtx);

  if (session.status === "running") {
    return { reply: "⏳ 上一个请求还在处理中，完成后会在群里回结果，请稍候。" };
  }

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
      await updateSession(session.id, { status: "idle", clarifyRounds: 0, contextTurns: [] });
      return { reply: "没太理解你的需求，请换个说法，或用 #场景名 直接发起任务。" };
    }
    await updateSession(session.id, {
      status: "clarifying", clarifyRounds: rounds,
      contextTurns: [...turns, { role: "assistant", content: result.question }],
    });
    return { reply: result.question };
  }

  // execute
  const { missionId } = await startChannelMission(msg.organizationId, {
    message: text, summary: result.summary, steps: result.steps,
    externalMessageId: msg.externalMessageId, channelCtx,
  });
  await updateSession(session.id, { status: "running", activeMissionId: missionId, contextTurns: turns });
  return { reply: `✅ 收到，正在处理：${result.summary}。完成后在群里回结果。`, missionId };
}
```
> 现有 `recordInboundMessage`/`recordOutboundMessage` 调用保留（在 `handleInboundMessage` 顶部，不动）。`StandardizedMessage` 已含 configId/chatId/externalUserId/platform/organizationId。

- [ ] **Step 4: 跑测试 + tsc** → PASS（3 passed）；tsc 0 errors

- [ ] **Step 5: Commit**
```bash
git add src/lib/channels/gateway.ts src/lib/channels/__tests__/gateway-clarify-loop.test.ts
git commit -m "feat(channel): gateway 自由消息走澄清循环（多轮→ad-hoc mission）"
```

---

## Task 6: 全量验证 + 端到端手测

- [ ] **Step 1: 全量验证**
```bash
npx tsc --noEmit        # 0 errors
npm run build           # 通过
npm test                # 全绿（含新增 ~12 个测试）
```

- [ ] **Step 2: 端到端手测（Stream worker + 真实钉钉）**

1. dev server + Inngest dev + `pnpm run dingtalk:stream` 都起（见 spec / 既有 runbook）。
2. 群里 @机器人 发一个**模糊**请求（如"帮我弄个热点"）→ 期望群里回一个**澄清问题**。
3. 回答澄清（如"科技类，写成短稿"）→ 期望回 `✅ 收到，正在处理：…`。
4. 等 mission 跑完 → 期望群里回 `✅ 已完成：<摘要>` + `/missions/[id]` 链接。
5. mission 运行中再发一条 → 期望回 `⏳ 上一个请求还在处理中`。
6. 站内 `/missions` 能看到该 mission 全过程（过程不进群）。

- [ ] **Step 3: 收尾 commit（如有手测微调）**

---

## 备注 / 风险

- **完成回执依赖 worker 存活**：`.then()` 跑在 Stream worker 进程，worker 在 mission 执行中重启 → 回执丢失（mission 站内仍完成）。P2 用 `mission/completed` Inngest 事件持久化。
- **出站时序**：澄清问题走 sessionWebhook（快）；最终结果走 `config.appKey` 自定义机器人 webhook（mission 慢、sessionWebhook 已过期）。单群无忧，多群需每群一个自定义机器人 webhook。
- **`loadAvailableEmployees` / `recognizeIntent` 第3参字段名**：以真实实现为准微调 catalog 映射（Task 3 Step 3 注）。
- **不依赖** `mission-notifier`（死代码）、`mission.sourceContext`（不存在列）、cowork conversations。

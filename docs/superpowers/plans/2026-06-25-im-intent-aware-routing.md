# IM Phase 1 · 意图感知路由 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 IM 机器人在任何阶段都先做意图分诊——继续当前流程 / 优雅挡住还做不了的新任务 / 听不懂就反问——彻底治掉"刚性状态机吞新意图、答非所问"。

**Architecture:** 不重写状态机。① 在 `handleContentLoopMessage` 的 `switch` 之前加两个**全局规则意图**（`isResumePrevious`→恢复暂存、`isHotTopicIntent`→暂存当前+重启热点线，带「回到上一篇」面包屑）；② 各活跃阶段原本"无脑 fallthrough"（drafting/translating→当改稿，hot_list/topic_select→提示选编号）处，先跑一个**轻量 LLM 分诊** `classifyInPhase`，只在所有廉价解析器都不命中时触发一次，分 `continue`/`new_task`/`clarify` 路由。

**Tech Stack:** TypeScript, Drizzle（`ContentLoopContext` 是 jsonb，加字段免迁移）, Vitest（`vi.hoisted` mock 模型/DAL）, AI SDK v6（`generateText` + `getLanguageModel`/`getDefaultModel`）。

**Spec:** [2026-06-25-im-intent-aware-routing-design.md](../specs/2026-06-25-im-intent-aware-routing-design.md)

---

## 关键既有锚点（实施时直接用）

```
gateway.ts:315            阶段锁 if (scenarioPhase !== "idle") return handleContentLoopMessage(...)
                          （isGreeting 已在 :298 前置；#场景 在 handleInboundMessage:136 上游，均先于阶段锁）
orchestrator.ts:172       handleContentLoopMessage(text, msg, session, channelCtx)
orchestrator.ts:178       isExitLoop(text) → 复位 idle（已是全局；新全局意图加在它之后、switch(:191)之前）
orchestrator.ts:192       case "hot_list"  → :217 `if (sel == null) return "说编号选一个"`   ← fallthrough A
orchestrator.ts:239       case "topic_select" → :249 `if (sel == null) return "说 A/B/C…"`    ← fallthrough B
orchestrator.ts:268       case "drafting"  → :295 `// 其余自由文本 = 改稿指令` revise          ← fallthrough C（核心）
orchestrator.ts:302       case "translating" → :329 `// 其余自由文本 = 改外文稿` revise         ← fallthrough D
orchestrator.ts:59        dispatchStep(step, session, channelCtx, msg, extra?)  // 已接 msg
orchestrator.ts:153       startContentLoop(msg, session, channelCtx)  // loopContext:{} 会清空
intents.ts                isHotTopicIntent/isExitLoop/isRegenerate/parseSelection/... + 复用模式
channel-sessions.ts       ContentLoopContext（jsonb 内嵌；加 parkedContext? 免迁移）；ContentLoopPhase 类型
model-router              getLanguageModel({provider:"openai",model:getDefaultModel(),temperature,maxTokens}) + ai:generateText
```

**纪律**：每任务 TDD（先写失败测试）；每 commit `npx tsc --noEmit` 零错 + 相关 `vitest run` 绿；不 `--no-verify`（husky 跑全量）。

---

## Task 1: `parkedContext` 类型 + `isResumePrevious` 谓词

**Files:**
- Modify: `src/db/schema/channel-sessions.ts`（`ContentLoopContext` interface）
- Modify: `src/lib/channels/content-loop/intents.ts`
- Test: `src/lib/channels/content-loop/__tests__/intents.test.ts`（追加）

- [ ] **Step 1: 加 `parkedContext` 字段**（jsonb 内嵌，免迁移）

在 `ContentLoopContext` interface 末尾加：
```ts
  /** 切换到新任务时暂存的上一段闭环上下文（一层，供「回到上一篇」恢复）。 */
  parkedContext?: {
    scenarioPhase: ContentLoopPhase;
    /** 暂存时的 loopContext 快照（不含 parkedContext 自身，避免套娃）。 */
    loopContext: Record<string, unknown>;
    articleTitle?: string;
    parkedAt: string;
  };
```
（`ContentLoopPhase` 同文件已导出，直接引用。）

- [ ] **Step 2: 写 `isResumePrevious` 失败测试**

在 `intents.test.ts` 追加：
```ts
import { isResumePrevious } from "../intents";
describe("isResumePrevious", () => {
  it.each(["回到上一篇","回到刚才那篇","接着改刚才的","继续上一篇","回上一篇"])("命中：%s", (t) => {
    expect(isResumePrevious(t)).toBe(true);
  });
  it.each(["写一篇稿","获取热点","你好","改导语"])("不命中：%s", (t) => {
    expect(isResumePrevious(t)).toBe(false);
  });
});
```

- [ ] **Step 3: 跑确认失败**

Run: `npx vitest run src/lib/channels/content-loop/__tests__/intents.test.ts`
Expected: FAIL（`isResumePrevious` 未定义）。

- [ ] **Step 4: 实现 `isResumePrevious`**（intents.ts，仿现有谓词风格）

```ts
/** 「回到上一篇 / 接着改刚才那篇」——从暂存恢复上一段闭环。纯规则，无 LLM。 */
export function isResumePrevious(text: string): boolean {
  return /(回到?|继续|接着改?).{0,4}(上一篇|刚才|上一个|之前那?篇)/.test(text.trim());
}
```

- [ ] **Step 5: 跑确认通过 + tsc**

Run: `npx vitest run src/lib/channels/content-loop/__tests__/intents.test.ts && npx tsc --noEmit`
Expected: PASS + 零类型错误。

- [ ] **Step 6: Commit**

```bash
git add src/db/schema/channel-sessions.ts src/lib/channels/content-loop/intents.ts src/lib/channels/content-loop/__tests__/intents.test.ts
git commit -m "feat(channel): ContentLoopContext 加 parkedContext + isResumePrevious 谓词（IM 意图层地基）"
```

---

## Task 2: `classifyInPhase` LLM 分诊器

**Files:**
- Create: `src/lib/channels/content-loop/intent-classify.ts`
- Test: `src/lib/channels/content-loop/__tests__/intent-classify.test.ts`

> 设计取舍（与 spec 一致）：Phase 1 唯一"已支持的 switch"是热点线，且被 `isHotTopicIntent` 规则在上游截获，所以分诊器只需 `continue`/`new_task`/`clarify` 三类——`new_task` 一律走"能力建设中"优雅挡（§Task 4）。

- [ ] **Step 1: 写失败测试**（mock `generateText` + model-router）

```ts
// intent-classify.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const genTextMock = vi.hoisted(() => vi.fn());
vi.mock("ai", () => ({ generateText: genTextMock }));
vi.mock("@/lib/agent/model-router", () => ({ getLanguageModel: vi.fn(), getDefaultModel: () => "m" }));
import { classifyInPhase } from "../intent-classify";

describe("classifyInPhase", () => {
  beforeEach(() => genTextMock.mockReset());

  it("改稿指令 → continue", async () => {
    genTextMock.mockResolvedValue({ text: '{"kind":"continue","confidence":0.9}' });
    const r = await classifyInPhase("drafting", "导语再短一点，加个数据", { activeArticleTitle: "AI泡沫" });
    expect(r.kind).toBe("continue");
  });
  it("立项做成片 → new_task + capabilityHint", async () => {
    genTextMock.mockResolvedValue({ text: '{"kind":"new_task","confidence":0.8,"capabilityHint":"立项+成片"}' });
    const r = await classifyInPhase("drafting", "今天寒潮，立项做快讯+成片", {});
    expect(r.kind).toBe("new_task");
    if (r.kind === "new_task") expect(r.capabilityHint).toContain("成片");
  });
  it("听不懂 → clarify 带问题", async () => {
    genTextMock.mockResolvedValue({ text: '{"kind":"clarify","confidence":0.5,"question":"你是想继续改这篇，还是开个新任务？"}' });
    const r = await classifyInPhase("drafting", "嗯那个", {});
    expect(r.kind).toBe("clarify");
  });
  it("模型抛错 / JSON 解析失败 → 降级 continue（绝不更糟）", async () => {
    genTextMock.mockRejectedValue(new Error("timeout"));
    const r = await classifyInPhase("drafting", "x", {});
    expect(r.kind).toBe("continue");
    genTextMock.mockResolvedValue({ text: "不是JSON" });
    const r2 = await classifyInPhase("drafting", "x", {});
    expect(r2.kind).toBe("continue");
  });
});
```

- [ ] **Step 2: 跑确认失败** → `npx vitest run src/lib/channels/content-loop/__tests__/intent-classify.test.ts` → FAIL（模块不存在）。

- [ ] **Step 3: 实现 `intent-classify.ts`**

```ts
import { generateText } from "ai";
import { getLanguageModel, getDefaultModel } from "@/lib/agent/model-router";
import type { ContentLoopPhase } from "@/db/schema/channel-sessions";

export type InPhaseClassification =
  | { kind: "continue"; confidence: number }
  | { kind: "new_task"; confidence: number; capabilityHint: string }
  | { kind: "clarify"; confidence: number; question: string };

const PHASE_DESC: Partial<Record<ContentLoopPhase, string>> = {
  hot_list: "正在让用户从今日热点里选一条",
  topic_select: "正在让用户从 3 个创作视角里选一个",
  drafting: "用户正在改一篇已生成的中文初稿",
  translating: "用户正在改一篇外文译稿",
};

/** 阶段感知意图分诊：仅在阶段廉价解析器都不命中时调一次。失败一律降级 continue。 */
export async function classifyInPhase(
  phase: ContentLoopPhase,
  text: string,
  ctx: { activeArticleTitle?: string },
): Promise<InPhaseClassification> {
  const phaseDesc = PHASE_DESC[phase] ?? `当前处于 ${phase} 阶段`;
  const titleLine = ctx.activeArticleTitle ? `当前在制稿件：《${ctx.activeArticleTitle}》。\n` : "";
  const prompt =
    `你是 IM 机器人的意图分诊器。${phaseDesc}。${titleLine}` +
    `用户刚发来一条消息：「${text}」。判断它属于以下哪类，只输出 JSON：\n` +
    `- "continue"：是对当前任务的继续指令（如改稿/调整当前稿件）。\n` +
    `- "new_task"：是一个全新的、与当前任务无关的生产请求（如"立项""做视频/成片""拉前方素材""写另一个主题"）。给出 capabilityHint 概括是什么能力。\n` +
    `- "clarify"：含糊、看不出意图。给出一句简短中文澄清问题 question。\n` +
    `格式：{"kind":"continue|new_task|clarify","confidence":0~1,"capabilityHint":"...","question":"..."}`;

  try {
    const { text: out } = await generateText({
      model: getLanguageModel({ provider: "openai", model: getDefaultModel(), temperature: 0.1, maxTokens: 120 }),
      prompt,
      maxOutputTokens: 120,
    });
    const j = JSON.parse(out.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")) as {
      kind?: string; confidence?: number; capabilityHint?: string; question?: string;
    };
    const confidence = typeof j.confidence === "number" ? j.confidence : 0.5;
    if (j.kind === "new_task") {
      return { kind: "new_task", confidence, capabilityHint: (j.capabilityHint ?? "新任务").trim() };
    }
    if (j.kind === "clarify") {
      return { kind: "clarify", confidence, question: (j.question ?? "你是想继续当前这篇，还是开个新任务？").trim() };
    }
    return { kind: "continue", confidence };
  } catch (err) {
    console.error("[content-loop] classifyInPhase 失败，降级 continue:", err);
    return { kind: "continue", confidence: 0 };
  }
}
```

- [ ] **Step 4: 跑确认通过 + tsc** → `npx vitest run src/lib/channels/content-loop/__tests__/intent-classify.test.ts && npx tsc --noEmit` → PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/channels/content-loop/intent-classify.ts src/lib/channels/content-loop/__tests__/intent-classify.test.ts
git commit -m "feat(channel): classifyInPhase 阶段感知意图分诊器（continue/new_task/clarify，异常降级 continue）"
```

---

## Task 3: 全局意图（回到上一篇 / 热点重启带暂存）

**Files:**
- Modify: `src/lib/channels/content-loop/orchestrator.ts`
- Test: `src/lib/channels/content-loop/__tests__/orchestrator-park.test.ts`（新建）

加在 `handleContentLoopMessage` 的 `isExitLoop`（:178）之后、`switch`（:191）之前。

- [ ] **Step 1: 写失败测试**（mock updateSession / inngest）

```ts
// orchestrator-park.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const updateSessionMock = vi.hoisted(() => vi.fn());
const sendMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/dal/channel-sessions", () => ({ updateSession: updateSessionMock, CONTENT_LOOP_TTL_MS: 604800000 }));
vi.mock("@/inngest/client", () => ({ inngest: { send: sendMock } }));
import { handleContentLoopMessage } from "../orchestrator";

const sess = (phase: string, loopContext: Record<string, unknown> = {}) =>
  ({ id: "s1", organizationId: "o1", scenarioPhase: phase, loopContext, lastArticleId: "a1" } as never);
const msg = { externalMessageId: "m1", replyWebhook: "w" } as never;
const ctx = { organizationId: "o1", configId: "c1", platform: "dingtalk", chatId: "g1", externalUserId: "u1" } as never;

describe("全局意图：热点重启暂存 + 回到上一篇恢复", () => {
  beforeEach(() => { updateSessionMock.mockReset(); sendMock.mockReset(); });

  it("drafting 中说「获取今天的热点」→ 暂存当前 + 切 hot_list + 面包屑", async () => {
    const r = await handleContentLoopMessage("获取今天的热点", msg, sess("drafting", { selectedTopic: { title: "旧" } }), ctx);
    expect(updateSessionMock).toHaveBeenCalledWith("s1", expect.objectContaining({
      scenarioPhase: "hot_list",
      loopContext: expect.objectContaining({ parkedContext: expect.objectContaining({ scenarioPhase: "drafting" }) }),
    }));
    expect(r.reply).toContain("回到上一篇");
    expect(sendMock).toHaveBeenCalled(); // 派了 fetch_topics
  });

  it("说「回到上一篇」→ 从 parkedContext 恢复", async () => {
    const parked = { scenarioPhase: "drafting", loopContext: { selectedTopic: { title: "旧" } }, parkedAt: "x" };
    const r = await handleContentLoopMessage("回到上一篇", msg, sess("hot_list", { parkedContext: parked }), ctx);
    expect(updateSessionMock).toHaveBeenCalledWith("s1", expect.objectContaining({ scenarioPhase: "drafting" }));
    expect(r.reply).toContain("已回到");
  });

  it("没有 parkedContext 时「回到上一篇」→ 友好提示，不报错", async () => {
    const r = await handleContentLoopMessage("回到上一篇", msg, sess("drafting", {}), ctx);
    expect(r.reply).toContain("没有");
  });

  it("hot_list 中说「重新获取热点」→ 不 park（仍走 case hot_list 的 isRegenerate 重抓）", async () => {
    const r = await handleContentLoopMessage("重新获取热点", msg, sess("hot_list", { topicCandidates: [] }), ctx);
    // 全局 isHotTopicIntent 被 phase!==hot_list 守卫挡住 → 不写 parkedContext
    const parkCall = updateSessionMock.mock.calls.find(
      (c) => (c[1] as { loopContext?: { parkedContext?: unknown } })?.loopContext?.parkedContext,
    );
    expect(parkCall).toBeUndefined();
    expect(r.reply).toContain("重新获取"); // isRegenerate 的轻量重抓回执
  });
});
```

- [ ] **Step 2: 跑确认失败** → FAIL。

- [ ] **Step 3: 实现**

在 orchestrator.ts 顶部 import 补：① `isHotTopicIntent, isResumePrevious`（与现有 intents import 合并）；② **`ContentLoopPhase`** 到类型 import（现在只有 `ContentLoopContext`）——改为 `import type { ContentLoopContext, ContentLoopPhase } from "@/db/schema/channel-sessions";`（Task 3/4 的代码都引用 `ContentLoopPhase`，漏了会 tsc 报错）。在 `handleContentLoopMessage` 的 `isExitLoop` 块之后、`const ctx =`（:189）之后、`switch`（:191）之前插入：

```ts
  const ctx = (session.loopContext ?? {}) as ContentLoopContext;

  // ── 全局意图（任何阶段都先于阶段动作；纯规则，无 LLM）──
  // 回到上一篇：从暂存恢复
  if (isResumePrevious(text)) {
    const parked = ctx.parkedContext;
    if (!parked) return { reply: "没有可恢复的上一篇。说「获取今天的热点」开始新的吧。" };
    await updateSession(session.id, {
      scenarioPhase: parked.scenarioPhase,
      loopContext: parked.loopContext as ContentLoopContext,
      expiresAt: loopTtl(),
    });
    return { reply: `已回到${parked.articleTitle ? `《${parked.articleTitle}》` : "上一篇"}，继续说修改要求，或「退出」结束。` };
  }
  // 获取热点 = 切到热点线：先暂存当前再重启。
  // ⚠️ 仅在「不是 hot_list 阶段」时作为全局切换——hot_list 内的"重新获取/重新抓取"仍由
  //    case "hot_list" 的 isRegenerate 处理（轻量重抓，不 park 空上下文）。否则会和 isRegenerate
  //    重叠（"重新获取热点"两者都命中），且 park 一个半空的 hot_list 上下文。
  if (isHotTopicIntent(text) && session.scenarioPhase !== "hot_list") {
    const snapshot = { ...ctx };
    delete (snapshot as { parkedContext?: unknown }).parkedContext; // 不套娃
    await updateSession(session.id, {
      scenarioPhase: "hot_list",
      status: "idle",
      loopContext: {
        parkedContext: {
          scenarioPhase: session.scenarioPhase as ContentLoopPhase,
          loopContext: snapshot,
          articleTitle: ctx.selectedTopic?.title,
          parkedAt: new Date().toISOString(),
        },
      },
      activeTopicId: null,
      expiresAt: loopTtl(),
    });
    await dispatchStep("fetch_topics", session, channelCtx, msg);
    return { reply: "🔍 正在获取今天的热点，稍候…\n📎 刚才那篇已存稿件库，随时说「回到上一篇」继续。" };
  }

  switch (session.scenarioPhase) {
```

> 注：原 `case "hot_list"` 里 `isRegenerate→fetch_topics` 仍在，不冲突（isHotTopicIntent 与 isRegenerate 词面不同）。`startContentLoop`（idle 态入口）不改——它清空 loopContext 是对的（idle 没有要暂存的）。

- [ ] **Step 4: 跑确认通过 + 全量回归**

Run: `npx vitest run src/lib/channels/content-loop/__tests__/orchestrator-park.test.ts && npx tsc --noEmit && npx vitest run src/lib/channels`
Expected: PASS + 零类型错 + content-loop 既有测试不回归。

- [ ] **Step 5: Commit**

```bash
git add src/lib/channels/content-loop/orchestrator.ts src/lib/channels/content-loop/__tests__/orchestrator-park.test.ts
git commit -m "feat(channel): 全局意图——热点重启自动暂存 + 回到上一篇恢复（任何阶段生效）"
```

---

## Task 4: 各活跃阶段 fallthrough 接分诊（核心：治答非所问）

**Files:**
- Modify: `src/lib/channels/content-loop/orchestrator.ts`（4 个 fallthrough 点 + 一个共享 helper）
- Test: `src/lib/channels/content-loop/__tests__/orchestrator-classify.test.ts`（新建）

- [ ] **Step 1: 写失败测试**（mock classifyInPhase + dispatchStep/updateSession）

```ts
// orchestrator-classify.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const classifyMock = vi.hoisted(() => vi.fn());
const sendMock = vi.hoisted(() => vi.fn());
const updateSessionMock = vi.hoisted(() => vi.fn());
vi.mock("../intent-classify", () => ({ classifyInPhase: classifyMock }));
vi.mock("@/inngest/client", () => ({ inngest: { send: sendMock } }));
vi.mock("@/lib/dal/channel-sessions", () => ({ updateSession: updateSessionMock, CONTENT_LOOP_TTL_MS: 604800000 }));
import { handleContentLoopMessage } from "../orchestrator";

const sess = (phase: string, lc: Record<string, unknown> = {}) =>
  ({ id:"s1", organizationId:"o1", scenarioPhase:phase, loopContext:lc, lastArticleId:"a1" } as never);
const msg = { externalMessageId:"m1", replyWebhook:"w" } as never;
const ctx = { organizationId:"o1", configId:"c1", platform:"dingtalk", chatId:"g1", externalUserId:"u1" } as never;

describe("drafting fallthrough 接分诊", () => {
  beforeEach(() => { classifyMock.mockReset(); sendMock.mockReset(); updateSessionMock.mockReset(); });

  it("continue → 照旧派 revise（行为不变）", async () => {
    classifyMock.mockResolvedValue({ kind:"continue", confidence:0.9 });
    const r = await handleContentLoopMessage("导语短一点", msg, sess("drafting"), ctx);
    expect(classifyMock).toHaveBeenCalledWith("drafting", "导语短一点", expect.anything());
    expect(sendMock).toHaveBeenCalled(); // revise 事件
    expect(r.reply).toContain("改稿");
  });

  it("new_task（立项做成片）→ 优雅挡，不派 revise、不答非所问", async () => {
    classifyMock.mockResolvedValue({ kind:"new_task", confidence:0.8, capabilityHint:"立项+成片" });
    const r = await handleContentLoopMessage("今天寒潮立项做成片", msg, sess("drafting"), ctx);
    expect(sendMock).not.toHaveBeenCalled();              // 没派 revise
    expect(r.reply).toContain("建设中");
    expect(r.reply).not.toContain("正在按你的要求改稿");
  });

  it("clarify → 反问", async () => {
    classifyMock.mockResolvedValue({ kind:"clarify", confidence:0.4, question:"你是想继续改这篇，还是开个新任务？" });
    const r = await handleContentLoopMessage("嗯那个", msg, sess("drafting"), ctx);
    expect(sendMock).not.toHaveBeenCalled();
    expect(r.reply).toContain("还是开个新任务");
  });
});

describe("hot_list fallthrough 接分诊", () => {
  beforeEach(() => { classifyMock.mockReset(); });
  it("非选择且 new_task → 优雅挡（不再只回'说编号'）", async () => {
    classifyMock.mockResolvedValue({ kind:"new_task", confidence:0.8, capabilityHint:"成片" });
    const r = await handleContentLoopMessage("帮我做个视频", msg, sess("hot_list", { topicCandidates:[{idx:1,title:"t"}] }), ctx);
    expect(r.reply).toContain("建设中");
  });
  it("continue（其实是想选但没说清）→ 回选择提示", async () => {
    classifyMock.mockResolvedValue({ kind:"continue", confidence:0.6 });
    const r = await handleContentLoopMessage("那个不错", msg, sess("hot_list", { topicCandidates:[{idx:1,title:"t"}] }), ctx);
    expect(r.reply).toContain("编号");
  });
});
```

- [ ] **Step 2: 跑确认失败** → FAIL。

- [ ] **Step 3: 实现共享 helper + 改 4 个 fallthrough**

在 orchestrator.ts 顶部 import `classifyInPhase`（from `./intent-classify`）。标题直接用 `ctx.selectedTopic?.title`，无需 `getArticleById`。加 helper（放在 `handleContentLoopMessage` 之上）：

```ts
/** 能力建设中（Phase2）的统一优雅回执。 */
function capabilityTodoReply(hint: string): string {
  return (
    `「${hint}」这个能力还在建设中 🚧。我目前能帮你：\n` +
    `① 说「获取今天的热点」挑个热点写稿\n② 继续完善当前这篇\n要哪个？`
  );
}

/**
 * 活跃阶段 fallthrough 统一分诊：所有廉价解析器都不命中时调一次 LLM。
 * - continue   → 调 onContinue()（阶段各自的默认：drafting=改稿，hot_list=提示选编号）
 * - new_task   → 能力建设中优雅挡（不执行、不切、不吞）
 * - clarify    → 反问
 */
async function routeFallthrough(
  phase: ContentLoopPhase,
  text: string,
  ctx: ContentLoopContext,
  onContinue: () => Promise<{ reply: string }> | { reply: string },
): Promise<{ reply: string }> {
  const cls = await classifyInPhase(phase, text, { activeArticleTitle: ctx.selectedTopic?.title });
  if (cls.kind === "new_task") return { reply: capabilityTodoReply(cls.capabilityHint) };
  if (cls.kind === "clarify") return { reply: cls.question };
  return onContinue(); // continue
}
```

然后改 4 个 fallthrough：

**drafting（:295-299）**——把 `// 其余自由文本 = 改稿指令 … return {reply:"✏️ 正在按你的要求改稿，稍候…"}` 整段替换为：
```ts
      // fallthrough：分诊判 continue(改稿) / new_task(优雅挡) / clarify(反问)
      return routeFallthrough("drafting", text, ctx, async () => {
        await dispatchStep("revise", session, channelCtx, msg, { instruction: text });
        return { reply: "✏️ 正在按你的要求改稿，稍候…" };
      });
```

**translating（:329-333）**——同理替换"其余自由文本 = 改外文稿"段：
```ts
      return routeFallthrough("translating", text, ctx, async () => {
        await dispatchStep("revise", session, channelCtx, msg, { instruction: text });
        return { reply: `✏️ 正在按你的要求修改${lang.label}稿，稍候…` };
      });
```

**hot_list（:217-218）**——把 `if (sel == null) { return {reply:"说编号选一个…"} }` 改为：
```ts
      if (sel == null) {
        return routeFallthrough("hot_list", text, ctx, () => ({ reply: "说编号选一个，比如「选第 2 个」。" }));
      }
```

**topic_select（:249-250）**——把 `if (sel == null) { return {reply:"说 A/B/C…"} }` 改为：
```ts
      if (sel == null) {
        return routeFallthrough("topic_select", text, ctx, () => ({ reply: "说 A / B / C 或「选第 N 个」锁定视角。" }));
      }
```

- [ ] **Step 4: 跑确认通过 + 全量回归**

Run: `npx vitest run src/lib/channels/content-loop/__tests__/orchestrator-classify.test.ts && npx tsc --noEmit && npx vitest run src/lib/channels`
Expected: PASS + 零类型错 + content-loop 既有测试不回归（编号选择/改稿正常路径不触发 classify，因为解析器先命中）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/channels/content-loop/orchestrator.ts src/lib/channels/content-loop/__tests__/orchestrator-classify.test.ts
git commit -m "feat(channel): 活跃阶段 fallthrough 接意图分诊（new_task 优雅挡 / clarify 反问 / continue 照旧）—— 治答非所问"
```

---

## 全局验收清单
- [ ] drafting 中发"今天寒潮立项做成片" → 回"建设中"+菜单，**不**再"正在改稿"、**不**推旧稿。
- [ ] drafting 中发"导语短一点" → 照旧改稿（continue，解析器/分诊都对）。
- [ ] 任何阶段发"获取今天的热点" → 暂存当前 + 重启热点线 + 面包屑；"回到上一篇" → 恢复。
- [ ] 编号选择 / A·B·C / 退出 / 问候 / 换一批 等既有交互零回归（不触发 LLM）。
- [ ] `npx tsc --noEmit` + `npm run build` + `npm run test` 全绿。
- [ ] 手测前**重启 `npm run dingtalk:stream` worker**（见 [[dingtalk-stream-worker-restart]]）。

## 风险与回退
- 分诊误判：低成本（仅 fallthrough 触发一次）；异常降级 continue 保持原行为；Task 4 测试覆盖三类。
- 既有阶段动作零回归：分诊只在"廉价解析器全不命中"后才跑，编号/命令/确认词都先被解析器截获。
- parked 仅一层；恢复缺失友好提示。每个 commit 独立 build。

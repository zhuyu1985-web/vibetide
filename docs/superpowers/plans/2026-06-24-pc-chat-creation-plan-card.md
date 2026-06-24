# PC 对话框创作计划卡 + 钉钉热点卡死修复 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 cowork 对话中心对"写稿类"请求先弹一张可校对的「创作计划卡」，确认后轻量直产并落进可编辑的稿件库（articles 草稿），同时修掉钉钉「热点还在抓取中」永久卡死的 P0 Bug。

**Architecture:** cowork 走 server action（非 SSE）。`submitCoworkMessage` 在 `content_creation` 意图分支先调 `buildCreationPlan` 落一条 `plan_card` 消息（不起 mission）；用户在 `CreationPlanForm` 改+确认后调 `confirmCreationPlan` server action → 检索→`content_generate`→`archive_to_drafts(initialStatus:"draft")`→落 `draft_result` 消息（带 articleId）→ `DraftResultCard` 给「打开编辑器」深链 + 「说一句改一版」。钉钉侧 `hot_list` 阶段补失败/超时转移。

**Tech Stack:** Next.js 16 server actions, Drizzle ORM, Vitest（`vi.hoisted` mock db/tool）, AI SDK v6（`generateText`）, 既有工具 `trending_topics`/`content_generate`/`archive_to_drafts`（经 `invokeToolDirectly`）, 既有 `appendArticleVersion`。

**Spec:** [2026-06-24-pc-chat-content-creation-plan-card-design.md](../specs/2026-06-24-pc-chat-content-creation-plan-card-design.md)

---

## 关键既有签名（实施时直接用，无需再查）

```ts
// invokeToolDirectly（src/lib/agent/tool-registry.ts:2244）
invokeToolDirectly(toolName, rawParams, { organizationId?, operatorId? }):
  Promise<{ ok:true; toolName; params; result:unknown } | { ok:false; toolName; params; error:string }>

// archive_to_drafts：articles[]{ title(长度1~200), body(≥10字), summary?, sourceTopicId?, language:"zh"|"en"(默认en) },
//   initialStatus:"draft"|"approved"(默认 approved ⚠️必须显式传 "draft"), organizationId
//   result → { firstArticleId:string|null, firstTitle, totalCreated, ... }
// content_generate：{ outline, style?(默认professional,自由串), maxLength?(默认2000) } → { content, wordCount, tokensUsed }
// trending_topics：{ mode:"hot"|"platforms"|"search"(默认hot), platforms?, query?, limit?(默认20) }
//   result → { topics:[{ platform, rank, heat, title, url }], crossPlatformTopics, warnings, ... }  // ⚠️ topics 无 topicId

// appendArticleVersion（src/lib/dal/article-versions.ts:15）
appendArticleVersion({ organizationId, articleId, language, title?, body?, summary?, wordCount?,
  changeKind:"initial"|"rewrite"|"translate"|"revise_after_reject", changeInstruction?, reviewId?, createdBy? }):
  Promise<{ versionNo:number }>

// cowork-submit（src/app/actions/cowork-submit.ts:38）
submitCoworkMessage(conversationId, message): Promise<CoworkSubmitResult>
// appendMessage（src/lib/dal/cowork-conversations.ts）入参 { role, content?, kind?, missionId?, meta? }
// requireAuth() / getCurrentUserOrg() / getConversationById(orgId,userId,convId)

// 会话消息表（src/db/schema/conversations.ts:69）conversation_messages.kind = text 列（非枚举，加值免迁移）；meta = jsonb
// recognizeIntentForOrg（src/lib/cowork/intent-routing.ts:26）→ IntentResult{ intentType:ChatIntentType, summary, confidence, steps[] }
```

**纪律：** 每个 commit 都要 `npx tsc --noEmit` 零错 + 相关 `vitest run` 绿。设计系统：可点击元素**不带边框**；用 `<Button>`/`<Input>`/`<Textarea>` 等共享原语、不 hand-roll、不覆盖颜色类；UI 全中文；弹层内滚动列表 `h-X` 不用 `max-h-X`。

---

## Phase 0 — P0 钉钉 `hot_list` 卡死修复（独立先行）

**目标**：抓榜失败/超时不再被无声吸收成"稍等"；用户永远有"重新获取/退出"出口。

### Task 0.1: 给 `ContentLoopContext` 加 `hotlistWaitCount`

**Files:**
- Modify: `src/db/schema/channel-sessions.ts:37-82`（`ContentLoopContext` interface）

`loopContext` 是 jsonb（`channel-sessions.ts:134`），加可选字段**无需迁移**。

- [ ] **Step 1: 加字段**

在 `ContentLoopContext` interface 末尾（`pendingDistribution` 后）加：

```ts
  /** hot_list：连续"候选为空"次数，用于超过阈值后主动提示出口（P0 防无声卡死）。 */
  hotlistWaitCount?: number;
```

- [ ] **Step 2: 验证类型**

Run: `npx tsc --noEmit`
Expected: 零错误。

- [ ] **Step 3: Commit**

```bash
git add src/db/schema/channel-sessions.ts
git commit -m "feat(channel): ContentLoopContext 加 hotlistWaitCount（P0 防卡死，jsonb 免迁移）"
```

### Task 0.2: `hot_list` 空候选时计数 + 超阈值给出口提示

**Files:**
- Modify: `src/lib/channels/content-loop/intents.ts:23-25`（拓宽 `isRegenerate` 命中"重新获取/重新抓取"）
- Modify: `src/lib/channels/content-loop/orchestrator.ts:187-217`（`hot_list` case）
- Test: `src/lib/channels/content-loop/__tests__/intents.test.ts`（追加用例）
- Test: `src/lib/channels/content-loop/__tests__/orchestrator-hotlist.test.ts`（新建）

当前 :192-194 空候选直接回"热点还在抓取中"。改为：记数，<阈值给"稍等"，≥阈值给明确出口。

⚠️ **前置修正（评审发现）**：出口提示里让用户回的"重新获取"**目前不被 `isRegenerate` 命中**——现有正则 `/(换一?批|换一?个|重新(来|生成|出)|再来|再出|换换)/` 的 `重新` 分支只含 `来|生成|出`，不含"获取"。若不修，用户照提示回"重新获取"会落空（正是本 P0 要消灭的死胡同）。故本任务**先拓宽 `isRegenerate`**，再改 orchestrator。

- [ ] **Step 1: 写失败测试**

```ts
// src/lib/channels/content-loop/__tests__/orchestrator-hotlist.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const updateSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/dal/channel-sessions", () => ({
  updateSession: updateSessionMock,
  CONTENT_LOOP_TTL_MS: 604800000,
}));
vi.mock("@/inngest/client", () => ({ inngest: { send: vi.fn() } }));

import { handleContentLoopMessage } from "../orchestrator";

const baseSession = (loopContext: Record<string, unknown>) =>
  ({ id: "s1", organizationId: "o1", scenarioPhase: "hot_list", loopContext } as never);
const msg = { externalMessageId: "m1" } as never;
const ctx = { organizationId: "o1", configId: "c1", platform: "dingtalk", chatId: "g1", externalUserId: "u1" } as never;

describe("hot_list 空候选：计数 + 出口提示", () => {
  beforeEach(() => { updateSessionMock.mockReset(); });

  it("首次空候选：回'稍等'且把 hotlistWaitCount 记为 1", async () => {
    const r = await handleContentLoopMessage("选第1个", msg, baseSession({}), ctx);
    expect(r.reply).toContain("还在抓取");
    expect(updateSessionMock).toHaveBeenCalledWith("s1", expect.objectContaining({
      loopContext: expect.objectContaining({ hotlistWaitCount: 1 }),
    }));
  });

  it("达到阈值(3)：回带'重新获取/退出'出口的提示", async () => {
    const r = await handleContentLoopMessage("选第1个", msg, baseSession({ hotlistWaitCount: 3 }), ctx);
    expect(r.reply).toContain("重新获取");
    expect(r.reply).toContain("退出");
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/lib/channels/content-loop/__tests__/orchestrator-hotlist.test.ts`
Expected: FAIL（当前无计数逻辑）。

- [ ] **Step 3: 拓宽 `isRegenerate` 命中"重新获取"（先做，否则出口提示落空）**

在 `intents.test.ts` 追加用例：

```ts
it("'重新获取/重新抓取' 命中 isRegenerate", () => {
  for (const t of ["重新获取", "重新抓取", "重新获取一下", "重新拉取"]) {
    expect(isRegenerate(t)).toBe(true);
  }
});
```

把 `src/lib/channels/content-loop/intents.ts:24` 的正则改为（仅在 `重新` 分支补 `获取|抓取|拉取`）：

```ts
export function isRegenerate(text: string): boolean {
  return /(换一?批|换一?个|重新(来|生成|出|获取|抓取|拉取)|再来|再出|换换)/.test(text.trim());
}
```

Run: `npx vitest run src/lib/channels/content-loop/__tests__/intents.test.ts`
Expected: PASS（含新用例）。

- [ ] **Step 4: 实现 hot_list 计数 + 出口**

把 `orchestrator.ts` `case "hot_list"` 里的空候选分支（:192-195）替换为：

```ts
      const cands = ctx.topicCandidates ?? [];
      if (cands.length === 0) {
        const waited = (ctx.hotlistWaitCount ?? 0) + 1;
        await updateSession(session.id, {
          loopContext: { ...ctx, hotlistWaitCount: waited },
          expiresAt: loopTtl(),
        });
        if (waited >= 3) {
          return {
            reply:
              "热点抓取似乎没成功（可能热榜服务暂时不可用）。回复「重新获取」再试一次，或回复「退出」结束。",
          };
        }
        return { reply: "热点还在抓取中，稍等几秒再选。" };
      }
```

> 注：`isRegenerate` 在 `hot_list` 分支 :188 已处理"重抓"——经 Step 3 拓宽后，"重新获取"会命中 → `dispatchStep("fetch_topics")` 重新抓榜，出口真正可用。`isExitLoop` 命中"退出"。Task 0.3 的失败回滚走 idle 后，提示用"获取今天的热点"（`isHotTopicIntent` 已命中，见 intents.test.ts），与此处的 hot_list 内提示各自正确。

- [ ] **Step 5: 跑测试确认通过 + 全量**

Run: `npx vitest run src/lib/channels/content-loop/__tests__/orchestrator-hotlist.test.ts src/lib/channels/content-loop/__tests__/intents.test.ts && npx tsc --noEmit`
Expected: PASS + 零类型错误。

- [ ] **Step 6: Commit**

```bash
git add src/lib/channels/content-loop/orchestrator.ts src/lib/channels/content-loop/intents.ts src/lib/channels/content-loop/__tests__/
git commit -m "fix(channel): hot_list 空候选计数+出口 + 拓宽 isRegenerate 命中'重新获取'（P0 防无声卡死）"
```

### Task 0.3: `fetch_topics` 失败/空 → 回滚 phase 到 idle + 明确出口

**Files:**
- Modify: `src/inngest/functions/content-loop-step.ts:311-341`（`fetch_topics` 分支）
- Test: `src/inngest/functions/__tests__/content-loop-step-fetch.test.ts`（新建）

当前失败（:317-319）与空（:325-328）只 `pushCard` 不回滚，导致 `scenarioPhase` 留在 `hot_list`，用户后续消息继续撞 :194。

- [ ] **Step 1: 写失败测试**（mock `invokeToolDirectly`、`getSessionById`、`updateSession`、`getChannelConfig`、`sendChannelMessage`）

```ts
// src/inngest/functions/__tests__/content-loop-step-fetch.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());
const getSessionMock = vi.hoisted(() => vi.fn());
const updateSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/agent/tool-registry", () => ({ invokeToolDirectly: invokeMock }));
vi.mock("@/lib/dal/channel-sessions", () => ({
  getSessionById: getSessionMock, updateSession: updateSessionMock, CONTENT_LOOP_TTL_MS: 604800000,
}));
vi.mock("@/lib/dal/channels", () => ({ getChannelConfig: vi.fn(async () => null) }));
vi.mock("@/lib/channels/outbound", () => ({ sendChannelMessage: vi.fn() }));
// 其余 import 的 DAL/工具按需 mock 成空实现（appendArticleVersion 等本用例不触达）

import { runContentLoopStep } from "../content-loop-step";

const data = { organizationId: "o1", sessionId: "s1", step: "fetch_topics",
  channelCtx: { organizationId:"o1", configId:"c1", platform:"dingtalk", chatId:"g1", externalUserId:"u1" } } as never;

describe("fetch_topics 失败/空 → 回滚 idle", () => {
  beforeEach(() => { invokeMock.mockReset(); updateSessionMock.mockReset();
    getSessionMock.mockResolvedValue({ id:"s1", organizationId:"o1", scenarioPhase:"hot_list", loopContext:{} }); });

  it("抓榜失败 → scenarioPhase 回滚 idle", async () => {
    invokeMock.mockResolvedValue({ ok: false, error: "TRENDING_API_KEY 未配置" });
    await runContentLoopStep(data);
    expect(updateSessionMock).toHaveBeenCalledWith("s1", expect.objectContaining({ scenarioPhase: "idle" }));
  });

  it("抓到 0 条 → 同样回滚 idle", async () => {
    invokeMock.mockResolvedValue({ ok: true, result: { topics: [] } });
    await runContentLoopStep(data);
    expect(updateSessionMock).toHaveBeenCalledWith("s1", expect.objectContaining({ scenarioPhase: "idle" }));
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/inngest/functions/__tests__/content-loop-step-fetch.test.ts`
Expected: FAIL（当前不回滚）。

- [ ] **Step 3: 实现**

在 `content-loop-step.ts` `fetch_topics` 分支，失败分支（:317-319）与空分支（:325-327）各加一次回滚 + 出口文案：

```ts
    if (!r.ok) {
      await updateSession(session.id, {
        scenarioPhase: "idle",
        loopContext: { ...ctx, topicCandidates: undefined, hotlistWaitCount: 0 },
      });
      await pushCard(data.channelCtx, "热点",
        `获取热点失败：${r.error}\n回复「获取今天的热点」可重试。`);
      return;
    }
    // ...
    if (topics.length === 0) {
      await updateSession(session.id, {
        scenarioPhase: "idle",
        loopContext: { ...ctx, topicCandidates: undefined, hotlistWaitCount: 0 },
      });
      await pushCard(data.channelCtx, "热点", "没抓到热点，回复「获取今天的热点」可重试。");
      return;
    }
```

成功分支保持原样（写 `topicCandidates` + pushCard 热点卡），但顺手清零：成功 `updateSession` 的 `loopContext` 里加 `hotlistWaitCount: 0`。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/inngest/functions/__tests__/content-loop-step-fetch.test.ts && npx tsc --noEmit`
Expected: PASS + 零类型错误。

- [ ] **Step 5: Commit**

```bash
git add src/inngest/functions/content-loop-step.ts src/inngest/functions/__tests__/content-loop-step-fetch.test.ts
git commit -m "fix(channel): fetch_topics 失败/空回滚 scenarioPhase=idle + 重试出口（P0）"
```

### Task 0.4: 失败处理器也回滚 phase

**Files:**
- Modify: `src/inngest/functions/content-loop-step.ts:684-699`（`contentLoopStepFailureHandler`）

终态失败（retries 用尽）目前只补推错误卡。对 `fetch_topics` 失败补回滚，防止 retry 全失败后仍卡 `hot_list`。

- [ ] **Step 1: 实现**

在 `contentLoopStepFailureHandler` 的 `notify-failure` step 里，若 `data.step === "fetch_topics"`，先回滚：

```ts
    await step.run("notify-failure", async () => {
      if (data.step === "fetch_topics") {
        const s = await getSessionById(data.sessionId);
        if (s && s.scenarioPhase === "hot_list") {
          await updateSession(data.sessionId, { scenarioPhase: "idle" });
        }
      }
      await pushCard(data.channelCtx, "内容闭环", "❌ 处理失败，请重试，或说「退出」结束。");
    });
```

（`getSessionById`/`updateSession` 已在文件顶部 import。）

- [ ] **Step 2: 验证 + 全量回归**

Run: `npx tsc --noEmit && npx vitest run src/inngest src/lib/channels`
Expected: 零类型错误 + 全绿。

- [ ] **Step 3: Commit**

```bash
git add src/inngest/functions/content-loop-step.ts
git commit -m "fix(channel): fetch_topics 终态失败也回滚 hot_list→idle（P0 收口）"
```

> **Phase 0 验收**：钉钉里热榜服务不可用时，机器人回"获取热点失败…可重试"而非永久"稍等"；会话退回 idle，用户发"获取今天的热点"能重新发起。

---

## Phase 1 — 共享改稿模块 + 创作计划库 + 出稿 server action

### Task 1.1: 抽取共享 `revise.ts`

**Files:**
- Create: `src/lib/content/revise.ts`
- Test: `src/lib/content/__tests__/revise.test.ts`

把 `content-loop-step.ts` 的纯函数 `reviseDraft`/`splitTitleBody`/`deriveTitle` 原样搬出（**保持纯签名**，不接 articleId、不读写 DB）。

- [ ] **Step 1: 写测试（splitTitleBody/deriveTitle 是纯函数，可直接断言）**

```ts
// src/lib/content/__tests__/revise.test.ts
import { describe, it, expect } from "vitest";
import { splitTitleBody, deriveTitle } from "../revise";

describe("splitTitleBody", () => {
  it("首行标题 + 其后正文", () => {
    expect(splitTitleBody("我的标题\n\n正文一\n正文二", "兜底")).toEqual({ title: "我的标题", body: "正文一\n正文二" });
  });
  it("去 markdown # 与 标题: 前缀", () => {
    expect(splitTitleBody("# 标题：真题\n\n正文", "兜底").title).toBe("真题");
  });
  it("无正文 → 整段当正文，标题用兜底", () => {
    expect(splitTitleBody("只有一行", "兜底").body).toBe("只有一行");
  });
});
describe("deriveTitle", () => {
  it("取首个非空行（≤60）", () => { expect(deriveTitle("标题行\n正文", "fb")).toBe("标题行"); });
  it("首行过长 → 用兜底截断", () => { expect(deriveTitle("x".repeat(80), "兜底")).toBe("兜底"); });
});
```

- [ ] **Step 2: 跑确认失败**

Run: `npx vitest run src/lib/content/__tests__/revise.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 创建 `src/lib/content/revise.ts`**

把 `content-loop-step.ts:106-170` 的 `deriveTitle` / `splitTitleBody` / `reviseDraft` **原样**粘进新文件并 `export`，顶部加 import：

```ts
import { generateText } from "ai";
import { getLanguageModel, getDefaultModel } from "@/lib/agent/model-router";

export function deriveTitle(content: string, fallback: string): string { /* 原样 */ }
export function splitTitleBody(text: string, fallbackTitle: string): { title: string; body: string } { /* 原样 */ }
export async function reviseDraft(
  body: string, title: string, instruction: string, language: string,
): Promise<{ title: string; body: string } | null> { /* 原样（含 console.error 前缀保留） */ }
```

- [ ] **Step 4: 跑确认通过**

Run: `npx vitest run src/lib/content/__tests__/revise.test.ts && npx tsc --noEmit`
Expected: PASS + 零类型错误。

- [ ] **Step 5: Commit**

```bash
git add src/lib/content/revise.ts src/lib/content/__tests__/revise.test.ts
git commit -m "refactor(content): 抽取共享 revise.ts（reviseDraft/splitTitleBody/deriveTitle 纯函数）"
```

### Task 1.2: `content-loop-step.ts` 改引用共享模块（行为不变）

**Files:**
- Modify: `src/inngest/functions/content-loop-step.ts`（删本地 3 函数，改 import）

- [ ] **Step 1: 改 import + 删本地副本**

删掉 `content-loop-step.ts:106-170` 的 `deriveTitle`/`splitTitleBody`/`reviseDraft` 本地定义，在 import 区加：

```ts
import { reviseDraft, splitTitleBody, deriveTitle } from "@/lib/content/revise";
```

（`generateText` / `getLanguageModel` / `getDefaultModel` 若仅这三函数用，则一并清理未用 import——以 `npx tsc --noEmit` 报错为准；`generateAngles`/`translateDraft` 仍在本文件用 `generateText`，故 `generateText` 等大概率仍需保留。）

- [ ] **Step 2: 全量回归（保证钉钉改稿行为不变）**

Run: `npx tsc --noEmit && npx vitest run src/inngest src/lib/channels src/lib/content`
Expected: 零类型错误 + 全绿（含 Phase 0 新增测试）。

- [ ] **Step 3: Commit**

```bash
git add src/inngest/functions/content-loop-step.ts
git commit -m "refactor(content): content-loop-step 改用共享 revise.ts（去重，行为不变）"
```

### Task 1.3: `CreationPlan` 类型 + 渠道适配规则

**Files:**
- Create: `src/lib/cowork/creation-plan.ts`
- Test: `src/lib/cowork/__tests__/creation-plan.test.ts`

- [ ] **Step 1: 写测试**

```ts
// src/lib/cowork/__tests__/creation-plan.test.ts
import { describe, it, expect } from "vitest";
import { CHANNEL_PRESETS, planToGenerateParams, defaultPlanForChannel } from "../creation-plan";

describe("渠道适配", () => {
  it("小红书默认短、口语", () => {
    const p = defaultPlanForChannel("xiaohongshu");
    expect(p.wordCount).toBeLessThanOrEqual(600);
    expect(p.genre).toBe("xiaohongshu");
  });
  it("planToGenerateParams 注入字数与渠道风格提示到 outline", () => {
    const params = planToGenerateParams({
      topic: { title: "某热点" }, topicOptions: [], topicFromHotlist: true,
      angle: "深度解读", genre: "news", channel: "wechat_mp", wordCount: 1000,
      illustrate: false, hotlistAvailable: true,
    });
    expect(params.outline).toContain("某热点");
    expect(params.outline).toContain("深度解读");
    expect(params.outline).toContain("1000");
    expect(params.maxLength).toBeGreaterThanOrEqual(1000);
    expect(typeof params.style).toBe("string");
  });
});
```

- [ ] **Step 2: 跑确认失败** — `npx vitest run src/lib/cowork/__tests__/creation-plan.test.ts` → FAIL。

- [ ] **Step 3: 实现 `src/lib/cowork/creation-plan.ts`**

```ts
export interface CreationPlanTopicOption { topicId?: string; title: string; heat?: string; source?: string; }

export type CreationGenre = "news" | "commentary" | "explainer" | "xiaohongshu" | "script";
export type CreationChannel = "wechat_mp" | "xiaohongshu" | "official_app" | "douyin";

export interface CreationPlan {
  topic: { title: string; topicId?: string };
  topicOptions: CreationPlanTopicOption[];
  topicFromHotlist: boolean;
  angle: string;
  genre: CreationGenre;
  channel: CreationChannel;
  wordCount: number;
  purpose?: string;
  illustrate: boolean;
  hotlistAvailable: boolean;
}

export const CHANNEL_PRESETS: Record<CreationChannel, {
  label: string; genre: CreationGenre; wordCount: number; styleHint: string;
}> = {
  wechat_mp:    { label: "微信公众号", genre: "news",        wordCount: 1000, styleHint: "客观、有小标题、段落完整" },
  xiaohongshu:  { label: "小红书",     genre: "xiaohongshu", wordCount: 400,  styleHint: "口语化、适度 emoji、分点、结尾带话题标签" },
  official_app: { label: "官网/App",   genre: "news",        wordCount: 1200, styleHint: "正式、规范、可含信源标注" },
  douyin:       { label: "抖音",       genre: "script",      wordCount: 500,  styleHint: "口播脚本、短句、开头抓人" },
};

export const GENRE_LABELS: Record<CreationGenre, string> = {
  news: "新闻消息", commentary: "深度评论", explainer: "大众解读", xiaohongshu: "小红书种草", script: "口播脚本",
};

export function defaultPlanForChannel(channel: CreationChannel): Pick<CreationPlan, "genre" | "wordCount"> {
  const p = CHANNEL_PRESETS[channel];
  return { genre: p.genre, wordCount: p.wordCount };
}

/** 计划 → content_generate 入参（outline 注入选题/角度/渠道适配/字数；style 取渠道风格提示）。 */
export function planToGenerateParams(plan: CreationPlan): { outline: string; style: string; maxLength: number } {
  const preset = CHANNEL_PRESETS[plan.channel];
  const outline =
    `热点选题：${plan.topic.title}\n` +
    `创作角度：${plan.angle}\n` +
    `体裁：${GENRE_LABELS[plan.genre]}\n` +
    `目标渠道：${preset.label}（风格要求：${preset.styleHint}）\n` +
    `目标字数：约 ${plan.wordCount} 字\n` +
    (plan.purpose ? `用途：${plan.purpose}\n` : "") +
    `要求：原创新闻/资讯稿件，含标题、导语、正文，观点清晰，有数据或案例支撑；` +
    `**只使用检索到的真实资料，检索为空则如实说明、严禁从训练数据补填任何事实/日期/数据**。`;
  return { outline, style: plan.genre, maxLength: Math.max(plan.wordCount + 200, 600) };
}
```

- [ ] **Step 4: 跑确认通过** — `npx vitest run src/lib/cowork/__tests__/creation-plan.test.ts && npx tsc --noEmit` → PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/cowork/creation-plan.ts src/lib/cowork/__tests__/creation-plan.test.ts
git commit -m "feat(cowork): CreationPlan 类型 + 渠道适配规则 + planToGenerateParams"
```

### Task 1.4: `buildCreationPlan()` 预填（热榜 Top1 + 角度 + 默认，含降级）

**Files:**
- Modify: `src/lib/cowork/creation-plan.ts`（加 `buildCreationPlan`）
- Test: `src/lib/cowork/__tests__/build-plan.test.ts`

- [ ] **Step 1: 写测试（mock `invokeToolDirectly` + `generateText`）**

```ts
// src/lib/cowork/__tests__/build-plan.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const invokeMock = vi.hoisted(() => vi.fn());
const genTextMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/agent/tool-registry", () => ({ invokeToolDirectly: invokeMock }));
vi.mock("ai", () => ({ generateText: genTextMock }));
vi.mock("@/lib/agent/model-router", () => ({ getLanguageModel: vi.fn(), getDefaultModel: () => "m" }));
import { buildCreationPlan } from "../creation-plan";

describe("buildCreationPlan", () => {
  beforeEach(() => { invokeMock.mockReset(); genTextMock.mockReset(); genTextMock.mockResolvedValue({ text: "深度解读：行业影响" }); });

  it("热榜可用：预选 Top1 + 备选 + 角度", async () => {
    invokeMock.mockResolvedValue({ ok: true, result: { topics: [
      { title: "热点A", heat: "100w", platform: "weibo" }, { title: "热点B", heat: "80w", platform: "zhihu" }] } });
    const plan = await buildCreationPlan("o1", "帮我写篇今天的热点稿");
    expect(plan.topic.title).toBe("热点A");
    expect(plan.topicOptions.length).toBeGreaterThanOrEqual(2);
    expect(plan.topicFromHotlist).toBe(true);
    expect(plan.hotlistAvailable).toBe(true);
    expect(plan.angle).toContain("行业影响");
  });

  it("热榜失败：降级 hotlistAvailable=false，topic 空待用户填", async () => {
    invokeMock.mockResolvedValue({ ok: false, error: "x" });
    const plan = await buildCreationPlan("o1", "写篇稿");
    expect(plan.hotlistAvailable).toBe(false);
    expect(plan.topicFromHotlist).toBe(false);
    expect(plan.topic.title).toBe("");
  });
});
```

- [ ] **Step 2: 跑确认失败** → FAIL。

- [ ] **Step 3: 实现 `buildCreationPlan`**（加到 creation-plan.ts，注意它需 server 侧依赖，文件本身保持可被 server action import）

```ts
import { invokeToolDirectly } from "@/lib/agent/tool-registry";
import { generateText } from "ai";
import { getLanguageModel, getDefaultModel } from "@/lib/agent/model-router";

const DEFAULT_CHANNEL: CreationChannel = "wechat_mp";

export async function buildCreationPlan(organizationId: string, userMessage: string): Promise<CreationPlan> {
  const preset = CHANNEL_PRESETS[DEFAULT_CHANNEL];
  // 1. 选题：今日热榜
  let topicOptions: CreationPlanTopicOption[] = [];
  let hotlistAvailable = false;
  const r = await invokeToolDirectly("trending_topics", { mode: "hot", limit: 10 }, { organizationId });
  if (r.ok) {
    const topics = ((r.result as { topics?: { title: string; heat?: unknown; platform?: string }[] }).topics) ?? [];
    topicOptions = topics.slice(0, 8).map((t) => ({
      title: t.title, heat: t.heat != null ? String(t.heat) : undefined, source: t.platform,
    }));
    hotlistAvailable = topicOptions.length > 0;
  }
  const top1 = topicOptions[0];
  // 2. 角度（仅在有选题时调 LLM；失败兜底固定句）
  let angle = "结合最新进展的深度解读";
  if (top1) {
    try {
      const { text } = await generateText({
        model: getLanguageModel({ provider: "openai", model: getDefaultModel(), temperature: 0.6, maxTokens: 60 }),
        prompt: `为热点「${top1.title}」给一个适合新媒体资讯稿的创作切入角度，一句话（≤20字），只输出这句话本身。`,
        maxOutputTokens: 60,
      });
      const a = text.trim().replace(/^["'「]|["'」]$/g, "");
      if (a) angle = a;
    } catch { /* 用兜底 angle */ }
  }
  // 3. 默认值
  return {
    topic: { title: top1?.title ?? "" },
    topicOptions, topicFromHotlist: !!top1,
    angle, genre: preset.genre, channel: DEFAULT_CHANNEL, wordCount: preset.wordCount,
    illustrate: false, hotlistAvailable,
  };
}
```

- [ ] **Step 4: 跑确认通过** → `npx vitest run src/lib/cowork/__tests__/build-plan.test.ts && npx tsc --noEmit` → PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/cowork/creation-plan.ts src/lib/cowork/__tests__/build-plan.test.ts
git commit -m "feat(cowork): buildCreationPlan 预填（热榜Top1+角度LLM+渠道默认，含降级）"
```

### Task 1.5: `confirmCreationPlan` 出稿 server action（落 articles 草稿 + draft_result 消息）

**Files:**
- Create: `src/app/actions/cowork-content-creation.ts`
- Test: `src/app/actions/__tests__/cowork-content-creation.test.ts`

- [ ] **Step 1: 写测试（mock auth/org/工具/DAL）**

```ts
// src/app/actions/__tests__/cowork-content-creation.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const invokeMock = vi.hoisted(() => vi.fn());
const appendMessageMock = vi.hoisted(() => vi.fn());
const appendVersionMock = vi.hoisted(() => vi.fn());
const getConvoMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn(async () => ({ id: "u1" })) }));
vi.mock("@/lib/dal/auth", () => ({ getCurrentUserOrg: vi.fn(async () => "o1") }));
vi.mock("@/lib/agent/tool-registry", () => ({ invokeToolDirectly: invokeMock }));
vi.mock("@/lib/dal/cowork-conversations", () => ({ appendMessage: appendMessageMock, getConversationById: getConvoMock }));
vi.mock("@/lib/dal/article-versions", () => ({ appendArticleVersion: appendVersionMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { confirmCreationPlan } from "../cowork-content-creation";

const plan = { topic:{title:"热点A"}, topicOptions:[], topicFromHotlist:true, angle:"角度",
  genre:"news", channel:"wechat_mp", wordCount:1000, illustrate:false, hotlistAvailable:true } as never;

describe("confirmCreationPlan", () => {
  beforeEach(() => { invokeMock.mockReset(); appendMessageMock.mockReset(); appendVersionMock.mockReset();
    getConvoMock.mockResolvedValue({ id: "cv1", projectId: null }); });

  it("写稿→落 draft 草稿→落 draft_result 消息带 articleId", async () => {
    invokeMock.mockImplementation(async (tool: string) =>
      tool === "content_generate" ? { ok:true, result:{ content:"标题\n\n正文", wordCount: 4 } }
      : { ok:true, result:{ firstArticleId:"art1", firstTitle:"标题" } }); // archive_to_drafts
    const res = await confirmCreationPlan("cv1", plan);
    expect(res.ok).toBe(true);
    // archive_to_drafts 必须用 initialStatus draft
    expect(invokeMock).toHaveBeenCalledWith("archive_to_drafts",
      expect.objectContaining({ initialStatus: "draft", organizationId: "o1" }), expect.anything());
    expect(appendMessageMock).toHaveBeenCalledWith("cv1", expect.objectContaining({
      kind: "draft_result", meta: expect.objectContaining({ articleId: "art1" }),
    }));
  });

  it("落库没拿到 articleId → 降级 draft_result（仍带正文，标记未入库）", async () => {
    invokeMock.mockImplementation(async (tool: string) =>
      tool === "content_generate" ? { ok:true, result:{ content:"标题\n\n正文", wordCount:4 } }
      : { ok:true, result:{ firstArticleId: null } });
    const res = await confirmCreationPlan("cv1", plan);
    expect(res.ok).toBe(true);
    expect(appendMessageMock).toHaveBeenCalledWith("cv1", expect.objectContaining({
      kind: "draft_result", meta: expect.objectContaining({ articleId: null, archived: false }),
    }));
  });
});
```

- [ ] **Step 2: 跑确认失败** → FAIL（模块不存在）。

- [ ] **Step 3: 实现 `src/app/actions/cowork-content-creation.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { getCurrentUserOrg } from "@/lib/dal/auth";
import { appendMessage, getConversationById } from "@/lib/dal/cowork-conversations";
import { appendArticleVersion } from "@/lib/dal/article-versions";
import { invokeToolDirectly } from "@/lib/agent/tool-registry";
import { deriveTitle, splitTitleBody } from "@/lib/content/revise";
import { planToGenerateParams, GENRE_LABELS, CHANNEL_PRESETS, type CreationPlan } from "@/lib/cowork/creation-plan";

export type ConfirmPlanResult = { ok: false; error: string } | { ok: true; articleId: string | null };

export async function confirmCreationPlan(conversationId: string, plan: CreationPlan): Promise<ConfirmPlanResult> {
  const user = await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) return { ok: false, error: "用户未关联组织" };
  if (!plan.topic?.title?.trim()) return { ok: false, error: "请先填写选题" };
  const convo = await getConversationById(orgId, user.id, conversationId);
  if (!convo) return { ok: false, error: "对话不存在或无权访问" };

  // 1. 写稿
  const { outline, style, maxLength } = planToGenerateParams(plan);
  const gen = await invokeToolDirectly("content_generate", { outline, style, maxLength },
    { organizationId: orgId, operatorId: user.id });
  if (!gen.ok) {
    await appendMessage(conversationId, { role: "assistant", content: `写稿失败：${gen.error}`, kind: "text" });
    revalidatePath(`/cowork/${conversationId}`);
    return { ok: false, error: gen.error };
  }
  const { content } = gen.result as { content: string; wordCount: number };
  const { title, body } = splitTitleBody(content, deriveTitle(content, plan.topic.title));

  // 2. 落 articles 草稿（⚠️ 必须显式 initialStatus:"draft"）
  const arch = await invokeToolDirectly("archive_to_drafts", {
    articles: [{ title, body, language: "zh", ...(plan.topic.topicId ? { sourceTopicId: plan.topic.topicId } : {}) }],
    initialStatus: "draft", dedupBySourceUrl: false, organizationId: orgId,
  }, { organizationId: orgId, operatorId: user.id });
  const articleId = arch.ok ? ((arch.result as { firstArticleId?: string | null }).firstArticleId ?? null) : null;

  if (articleId) {
    await appendArticleVersion({
      organizationId: orgId, articleId, language: "zh", title, body,
      wordCount: body.length, changeKind: "initial", createdBy: user.id,
    }).catch((e) => console.error("[cowork-content] 初稿版本留痕失败:", e));
  }

  // 3. 落 draft_result 消息
  await appendMessage(conversationId, {
    role: "assistant",
    content: title,
    kind: "draft_result",
    meta: {
      articleId, archived: !!articleId, title, body, wordCount: body.length,
      channel: CHANNEL_PRESETS[plan.channel].label, genre: GENRE_LABELS[plan.genre], illustrate: plan.illustrate,
    },
  });
  revalidatePath(`/cowork/${conversationId}`);
  return { ok: true, articleId };
}
```

> 配图（`plan.illustrate`）留到 Phase 3 接 AIGC；本任务先把开关透传进 meta。

- [ ] **Step 4: 跑确认通过** → `npx vitest run src/app/actions/__tests__/cowork-content-creation.test.ts && npx tsc --noEmit` → PASS。

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/cowork-content-creation.ts src/app/actions/__tests__/cowork-content-creation.test.ts
git commit -m "feat(cowork): confirmCreationPlan 出稿→archive_to_drafts 落 draft 草稿→draft_result 消息"
```

---

## Phase 2 — 计划卡接入对话（消息类型 + 触发门 + 渲染 + 组件）

### Task 2.1: `kind` 联合补 `draft_result`

**Files:**
- Modify: `src/lib/dal/cowork-conversations.ts`（`AppendMessageInput.kind` 联合；及任何对外暴露的 message 类型）

`kind` 是 text 列，免迁移。

- [ ] **Step 1: 改类型**

把 `AppendMessageInput.kind` 的联合从 `"text" | "mission_card" | "plan_card"` 改为加上 `"draft_result"`。若文件里另有 `ConversationMessage`/读取侧的 kind 类型，同步加。

- [ ] **Step 2: 验证** — `npx tsc --noEmit` → 零错误。

- [ ] **Step 3: Commit**

```bash
git add src/lib/dal/cowork-conversations.ts
git commit -m "feat(cowork): 消息 kind 联合补 draft_result（text 列免迁移）"
```

### Task 2.2: `submitCoworkMessage` content_creation 分支落 plan_card（不起 mission）

**Files:**
- Modify: `src/app/actions/cowork-submit.ts:59-63`（intent 之后、startAdHocMission 之前）
- Test: `src/app/actions/__tests__/cowork-submit-plan-gate.test.ts`

- [ ] **Step 1: 写测试（mock recognizeIntentForOrg / buildCreationPlan / appendMessage / startAdHocMission）**

```ts
// src/app/actions/__tests__/cowork-submit-plan-gate.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const recognizeMock = vi.hoisted(() => vi.fn());
const buildPlanMock = vi.hoisted(() => vi.fn());
const appendMessageMock = vi.hoisted(() => vi.fn());
const startMissionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn(async () => ({ id: "u1" })) }));
vi.mock("@/lib/dal/auth", () => ({ getCurrentUserOrg: vi.fn(async () => "o1") }));
vi.mock("@/lib/dal/cowork-conversations", () => ({
  appendMessage: appendMessageMock, getConversationById: vi.fn(async () => ({ id: "cv1", projectId: null })) }));
vi.mock("@/lib/cowork/intent-routing", () => ({ recognizeIntentForOrg: recognizeMock }));
vi.mock("@/lib/cowork/creation-plan", () => ({ buildCreationPlan: buildPlanMock }));
vi.mock("@/app/actions/ad-hoc-mission", () => ({ startAdHocMission: startMissionMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { submitCoworkMessage } from "../cowork-submit";

describe("content_creation → plan_card gate", () => {
  beforeEach(() => { [recognizeMock, buildPlanMock, appendMessageMock, startMissionMock].forEach(m => m.mockReset()); });

  it("写稿意图：落 plan_card，且不起 mission", async () => {
    recognizeMock.mockResolvedValue({ intentType: "content_creation", summary: "写热点稿", confidence: 0.9, steps: [{}] });
    buildPlanMock.mockResolvedValue({ topic: { title: "热点A" }, topicOptions: [] });
    const res = await submitCoworkMessage("cv1", "帮我写篇今天的热点稿");
    expect(res).toMatchObject({ ok: true, kind: "plan" });
    expect(appendMessageMock).toHaveBeenCalledWith("cv1", expect.objectContaining({ kind: "plan_card" }));
    expect(startMissionMock).not.toHaveBeenCalled();
  });

  it("非写稿意图：维持原行为（起 mission）", async () => {
    recognizeMock.mockResolvedValue({ intentType: "information_retrieval", summary: "查", confidence: 0.9, steps: [{}] });
    startMissionMock.mockResolvedValue({ ok: true, missionId: "m1" });
    const res = await submitCoworkMessage("cv1", "查个资料");
    expect(startMissionMock).toHaveBeenCalled();
    expect(buildPlanMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 跑确认失败** → FAIL。

- [ ] **Step 3: 实现** — 在 `cowork-submit.ts` 第 59 行 `const intent = ...` 之后、第 62 行 `if (intent.steps...)` 之前插入分支，并在返回类型 union 里加 `{ ok: true; kind: "plan" }`：

```ts
  // 2.5 写稿类意图 → 先弹创作计划卡（不起 mission，等用户确认后走 confirmCreationPlan）
  if (intent.intentType === "content_creation") {
    const { buildCreationPlan } = await import("@/lib/cowork/creation-plan");
    const plan = await buildCreationPlan(orgId, text);
    await appendMessage(conversationId, {
      role: "assistant",
      content: plan.topic.title ? `已读到今天的热点，帮你拟了份创作计划，确认或改一改 👇` : `帮你拟了份创作计划，填一下选题再开始 👇`,
      kind: "plan_card",
      meta: { plan },
    });
    revalidatePath(`/cowork/${conversationId}`);
    return { ok: true, kind: "plan" };
  }
```

并在文件顶部 `CoworkSubmitResult` union 加：`| { ok: true; kind: "plan" }`。

- [ ] **Step 4: 跑确认通过** → `npx vitest run src/app/actions/__tests__/cowork-submit-plan-gate.test.ts && npx tsc --noEmit` → PASS。

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/cowork-submit.ts src/app/actions/__tests__/cowork-submit-plan-gate.test.ts
git commit -m "feat(cowork): submitCoworkMessage content_creation 分支落 plan_card（不起 mission）"
```

### Task 2.3: `CreationPlanForm` 组件

**Files:**
- Create: `src/components/cowork/creation-plan-form.tsx`

客户端组件：渲染 plan 字段（选题下拉换 / 角度可改 / 体裁·渠道·字数·配图 / 用途选填），「开始撰写」调 `confirmCreationPlan`。遵守设计系统：`<Button>`/`<Select>`/`<Input>`/`<Textarea>`，**不带边框**，颜色不覆盖。

- [ ] **Step 1: 实现**（无独立单测，靠 tsc + 集成）

```tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GlassCard } from "@/components/shared/glass-card";
import { confirmCreationPlan } from "@/app/actions/cowork-content-creation";
import {
  type CreationPlan, type CreationChannel, type CreationGenre,
  CHANNEL_PRESETS, GENRE_LABELS, CHANNEL_DEFAULTS_NOTE,
} from "@/lib/cowork/creation-plan";

const WORD_OPTIONS = [600, 1000, 1500, 2000];

export function CreationPlanForm({ conversationId, plan: initial }: { conversationId: string; plan: CreationPlan }) {
  const [plan, setPlan] = useState<CreationPlan>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const set = <K extends keyof CreationPlan>(k: K, v: CreationPlan[K]) => setPlan((p) => ({ ...p, [k]: v }));

  const onConfirm = async () => {
    setSubmitting(true);
    const res = await confirmCreationPlan(conversationId, plan);
    setSubmitting(false);
    if (res.ok) setDone(true);
  };

  if (done) return <GlassCard className="p-3 text-sm text-muted-foreground">✅ 已开始撰写，稍候出稿…</GlassCard>;

  return (
    <GlassCard className="max-w-md space-y-3 p-4">
      <div className="text-sm font-medium">📋 创作计划 · 确认后开始撰写</div>

      {/* 选题 */}
      <Field label="选题">
        {plan.topicOptions.length > 0 ? (
          <Select value={plan.topic.title} onValueChange={(v) => set("topic", { ...plan.topic, title: v })}>
            <SelectTrigger><SelectValue placeholder="选一个热点" /></SelectTrigger>
            <SelectContent>
              {plan.topicOptions.map((t) => (
                <SelectItem key={t.title} value={t.title}>{t.title}{t.heat ? ` · ${t.heat}` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input value={plan.topic.title} placeholder="输入你想写的主题"
            onChange={(e) => set("topic", { ...plan.topic, title: e.target.value })} />
        )}
      </Field>

      <Field label="角度">
        <Input value={plan.angle} onChange={(e) => set("angle", e.target.value)} />
      </Field>

      <Field label="体裁">
        <ChipRow<CreationGenre> value={plan.genre} options={Object.keys(GENRE_LABELS) as CreationGenre[]}
          label={(g) => GENRE_LABELS[g]} onPick={(g) => set("genre", g)} />
      </Field>

      <Field label="渠道">
        <ChipRow<CreationChannel> value={plan.channel}
          options={Object.keys(CHANNEL_PRESETS) as CreationChannel[]}
          label={(c) => CHANNEL_PRESETS[c].label}
          onPick={(c) => setPlan((p) => ({ ...p, channel: c, ...CHANNEL_PRESETS[c] && {} }))} />
      </Field>

      <Field label="字数">
        <ChipRow<number> value={plan.wordCount} options={WORD_OPTIONS}
          label={(n) => String(n)} onPick={(n) => set("wordCount", n)} />
      </Field>

      <Field label="用途">
        <Input value={plan.purpose ?? ""} placeholder="选填：给领导审阅 / 对外发布…"
          onChange={(e) => set("purpose", e.target.value)} />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={plan.illustrate}
          onChange={(e) => set("illustrate", e.target.checked)} />
        出稿后顺便配一张题图（AIGC）
      </label>

      <div className="flex gap-2 pt-1">
        <Button onClick={onConfirm} disabled={submitting || !plan.topic.title.trim()}>
          {submitting ? "撰写中…" : "✅ 开始撰写"}
        </Button>
      </div>
    </GlassCard>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div className="flex items-start gap-2">
    <div className="w-12 shrink-0 pt-2 text-xs text-muted-foreground">{label}</div>
    <div className="min-w-0 flex-1">{children}</div>
  </div>);
}

function ChipRow<T extends string | number>({ value, options, label, onPick }:
  { value: T; options: T[]; label: (v: T) => string; onPick: (v: T) => void }) {
  return (<div className="flex flex-wrap gap-1.5">
    {options.map((o) => (
      <Button key={String(o)} size="sm" variant={o === value ? "default" : "ghost"} onClick={() => onPick(o)}>
        {label(o)}
      </Button>
    ))}
  </div>);
}
```

> 渠道切换时若想联动默认字数/体裁，可在 `onPick(channel)` 里 `set` 默认值——但 owner 要求"用户改了以用户为准"，故默认仅在 buildCreationPlan 初值阶段给一次，切渠道不强制覆盖用户已改字段（保持当前实现：只切 channel）。`CHANNEL_DEFAULTS_NOTE` 若未定义可移除该 import。

- [ ] **Step 2: 验证** — `npx tsc --noEmit`。修掉未用 import / 占位（如 `CHANNEL_DEFAULTS_NOTE`）。

- [ ] **Step 3: Commit**

```bash
git add src/components/cowork/creation-plan-form.tsx
git commit -m "feat(cowork): CreationPlanForm 计划卡组件（共享原语、无边框、可改可确认）"
```

### Task 2.4: `DraftResultCard` 组件

**Files:**
- Create: `src/components/cowork/draft-result-card.tsx`

- [ ] **Step 1: 实现**

```tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/shared/glass-card";

export interface DraftResultMeta {
  articleId: string | null; archived: boolean; title: string; body: string;
  wordCount: number; channel: string; genre: string; illustrate: boolean;
}

export function DraftResultCard({ meta }: { meta: DraftResultMeta }) {
  const [expanded, setExpanded] = useState(false);
  const preview = meta.body.slice(0, 180);
  return (
    <GlassCard className="max-w-md space-y-2 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        📄 初稿已生成
        <span className={`ml-auto text-xs ${meta.archived ? "text-emerald-600" : "text-amber-600"}`}>
          {meta.archived ? "✓ 已存入稿件库 · 草稿" : "未入库（可重试）"}
        </span>
      </div>
      <div className="text-[15px] font-semibold">{meta.title}</div>
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>📝 约 {meta.wordCount} 字</span><span>🏷 {meta.genre}</span><span>📡 {meta.channel}</span>
      </div>
      <div className="whitespace-pre-wrap text-sm text-foreground/90">
        {expanded ? meta.body : preview}{!expanded && meta.body.length > 180 ? "…" : ""}
      </div>
      {meta.body.length > 180 && (
        <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "收起" : "展开全文"}
        </Button>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        {meta.articleId && (
          <Button asChild><Link href={`/articles/${meta.articleId}`}>📝 打开编辑器精修</Link></Button>
        )}
        {/* 换角度重写 / 提交审核：Phase 3 / 后续接入；此处先占位为进编辑器后操作 */}
      </div>
    </GlassCard>
  );
}
```

> 「说一句改一版」输入框在 Phase 3 接 `reviseDraftInConversation` 后加进本卡底部。「换角度重写」「提交审核」按现有审核中心/重生成能力后续接（非本期硬需求）。

- [ ] **Step 2: 验证** — `npx tsc --noEmit`。

- [ ] **Step 3: Commit**

```bash
git add src/components/cowork/draft-result-card.tsx
git commit -m "feat(cowork): DraftResultCard 出稿结果卡（预览+打开编辑器深链）"
```

### Task 2.5: `conversation-thread.tsx` 渲染 plan_card / draft_result

**Files:**
- Modify: `src/components/cowork/conversation-thread.tsx`（`MessageBubble`，`mission_card` 分支:274 之后）

- [ ] **Step 1: 实现** — 在 `if (message.kind === "mission_card" ...)` 分支之后、文末通用文本分支之前加：

```tsx
  if (message.kind === "plan_card") {
    const plan = (message.meta as { plan?: CreationPlan } | null)?.plan;
    if (!plan) return null;
    return (
      <div className="flex justify-start">
        <CreationPlanForm conversationId={message.conversationId} plan={plan} />
      </div>
    );
  }
  if (message.kind === "draft_result") {
    const meta = message.meta as DraftResultMeta | null;
    if (!meta) return null;
    return (<div className="flex justify-start"><DraftResultCard meta={meta} /></div>);
  }
```

顶部 import：

```tsx
import { CreationPlanForm } from "@/components/cowork/creation-plan-form";
import { DraftResultCard, type DraftResultMeta } from "@/components/cowork/draft-result-card";
import type { CreationPlan } from "@/lib/cowork/creation-plan";
```

> ✅ `MessageBubble` 能直接拿到 `message.conversationId`：`ConversationMessage = typeof conversationMessages.$inferSelect`（conversations.ts:144），表有非空 `conversation_id` 列（conversations.ts:72-74），故 `message.conversationId` 一定存在，**无需额外透传**。直接传给 `CreationPlanForm` / `DraftResultCard` 即可。

- [ ] **Step 2: 验证 + 全量** — `npx tsc --noEmit && npm run build`
Expected: 类型零错 + 构建通过。

- [ ] **Step 3: Commit**

```bash
git add src/components/cowork/conversation-thread.tsx
git commit -m "feat(cowork): 对话渲染 plan_card→CreationPlanForm / draft_result→DraftResultCard"
```

> **Phase 2 验收（手测）**：cowork 里发"帮我写一篇今天的热点稿件" → 出现计划卡 → 改字段 → 开始撰写 → 出现初稿卡 → 点「打开编辑器」进 `/articles/[id]` 能编辑。

---

## Phase 3 — 对话内"说一句改一版" + 配图

### Task 3.1: `reviseDraftInConversation` server action

**Files:**
- Modify: `src/app/actions/cowork-content-creation.ts`（加 action）
- Test: `src/app/actions/__tests__/cowork-revise.test.ts`

- [ ] **Step 1: 写测试**（mock db 读 article、reviseDraft、appendArticleVersion、appendMessage）

```ts
// src/app/actions/__tests__/cowork-revise.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const findArticleMock = vi.hoisted(() => vi.fn());
const updateArticleMock = vi.hoisted(() => vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })));
const reviseMock = vi.hoisted(() => vi.fn());
const appendVersionMock = vi.hoisted(() => vi.fn());
const appendMessageMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn(async () => ({ id: "u1" })) }));
vi.mock("@/lib/dal/auth", () => ({ getCurrentUserOrg: vi.fn(async () => "o1") }));
vi.mock("@/db", () => ({ db: { query: { articles: { findFirst: findArticleMock } }, update: updateArticleMock } }));
vi.mock("@/db/schema/articles", () => ({ articles: { id: "id", organizationId: "org" } }));
vi.mock("@/lib/content/revise", () => ({ reviseDraft: reviseMock }));
vi.mock("@/lib/dal/article-versions", () => ({ appendArticleVersion: appendVersionMock }));
vi.mock("@/lib/dal/cowork-conversations", () => ({ appendMessage: appendMessageMock, getConversationById: vi.fn(async () => ({ id: "cv1" })) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { reviseDraftInConversation } from "../cowork-content-creation";

describe("reviseDraftInConversation", () => {
  beforeEach(() => { [findArticleMock, reviseMock, appendVersionMock, appendMessageMock].forEach(m => m.mockReset()); });
  it("改稿→写回+版本+新 draft_result", async () => {
    findArticleMock.mockResolvedValue({ id:"art1", title:"老标题", body:"老正文", language:"zh", version:1 });
    reviseMock.mockResolvedValue({ title:"新标题", body:"新正文" });
    const res = await reviseDraftInConversation("cv1", "art1", "导语短一点");
    expect(res.ok).toBe(true);
    expect(appendVersionMock).toHaveBeenCalledWith(expect.objectContaining({ changeKind:"rewrite", changeInstruction:"导语短一点" }));
    expect(appendMessageMock).toHaveBeenCalledWith("cv1", expect.objectContaining({ kind:"draft_result" }));
  });
});
```

- [ ] **Step 2: 跑确认失败** → FAIL。

- [ ] **Step 3: 实现**（加到 cowork-content-creation.ts；DB 读写参照钉钉 revise step content-loop-step.ts:431-484）

```ts
import { db } from "@/db";
import { and, eq } from "drizzle-orm";
import { articles } from "@/db/schema/articles";
import { reviseDraft } from "@/lib/content/revise";
import { CHANNEL_PRESETS } from "@/lib/cowork/creation-plan"; // 若 draft_result meta 需 channel，可从原 meta 透传

export async function reviseDraftInConversation(
  conversationId: string, articleId: string, instruction: string,
): Promise<ConfirmPlanResult> {
  const user = await requireAuth();
  const orgId = await getCurrentUserOrg();
  if (!orgId) return { ok: false, error: "用户未关联组织" };
  const convo = await getConversationById(orgId, user.id, conversationId);
  if (!convo) return { ok: false, error: "对话不存在或无权访问" };

  const article = await db.query.articles.findFirst({
    where: and(eq(articles.id, articleId), eq(articles.organizationId, orgId)),
  });
  if (!article) return { ok: false, error: "找不到稿件" };

  const revised = await reviseDraft(article.body ?? "", article.title, instruction.trim(), article.language);
  if (!revised) {
    await appendMessage(conversationId, { role: "assistant", content: "改稿失败，请重说一次修改要求。", kind: "text" });
    revalidatePath(`/cowork/${conversationId}`);
    return { ok: false, error: "改稿失败" };
  }
  await db.update(articles).set({
    title: revised.title, body: revised.body, wordCount: revised.body.length,
    version: (article.version ?? 1) + 1, updatedAt: new Date(),
  }).where(eq(articles.id, articleId));
  await appendArticleVersion({
    organizationId: orgId, articleId, language: article.language,
    title: revised.title, body: revised.body, wordCount: revised.body.length,
    changeKind: "rewrite", changeInstruction: instruction.trim(), createdBy: user.id,
  }).catch((e) => console.error("[cowork-content] 改稿版本留痕失败:", e));

  await appendMessage(conversationId, {
    role: "assistant", content: revised.title, kind: "draft_result",
    meta: { articleId, archived: true, title: revised.title, body: revised.body,
      wordCount: revised.body.length, channel: "—", genre: "—", illustrate: false },
  });
  revalidatePath(`/cowork/${conversationId}`);
  return { ok: true, articleId };
}
```

- [ ] **Step 4: 跑确认通过** → `npx vitest run src/app/actions/__tests__/cowork-revise.test.ts && npx tsc --noEmit` → PASS。

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/cowork-content-creation.ts src/app/actions/__tests__/cowork-revise.test.ts
git commit -m "feat(cowork): reviseDraftInConversation 对话内改稿（复用 reviseDraft + 版本链）"
```

### Task 3.2: `DraftResultCard` 加"说一句改一版"输入

**Files:**
- Modify: `src/components/cowork/draft-result-card.tsx`

- [ ] **Step 1: 实现** — 卡底部加一个轻量输入（仅在 `meta.articleId` 存在时显示），回车/点按调 `reviseDraftInConversation`：

```tsx
// 需要 conversationId：在 conversation-thread 渲染 draft_result 时把它一并传入
import { Input } from "@/components/ui/input";
import { reviseDraftInConversation } from "@/app/actions/cowork-content-creation";
// props 改为 { meta, conversationId }
const [instr, setInstr] = useState("");
const [revising, setRevising] = useState(false);
const onRevise = async () => {
  if (!meta.articleId || !instr.trim()) return;
  setRevising(true);
  await reviseDraftInConversation(conversationId, meta.articleId, instr.trim());
  setRevising(false); setInstr("");
};
// JSX（articleId 存在时）：
<div className="flex gap-2 pt-1">
  <Input value={instr} placeholder='说一句改一版，如"导语短一点、加个数据"'
    onChange={(e) => setInstr(e.target.value)}
    onKeyDown={(e) => { if (e.key === "Enter") onRevise(); }} disabled={revising} />
  <Button variant="ghost" onClick={onRevise} disabled={revising || !instr.trim()}>
    {revising ? "改稿中…" : "改一版"}
  </Button>
</div>
```

同步在 Task 2.5 的 `draft_result` 渲染处把 `conversationId={message.conversationId}` 传入 `DraftResultCard`。

- [ ] **Step 2: 验证 + 构建** — `npx tsc --noEmit && npm run build` → 通过。

- [ ] **Step 3: Commit**

```bash
git add src/components/cowork/draft-result-card.tsx src/components/cowork/conversation-thread.tsx
git commit -m "feat(cowork): DraftResultCard 加对话内'说一句改一版'入口"
```

### Task 3.3: 配图开关接 AIGC（题图）

**Files:**
- Modify: `src/app/actions/cowork-content-creation.ts`（`confirmCreationPlan` 内 `plan.illustrate` 分支）

- [ ] **Step 1: 接入** — 先查现有 AIGC 文生图入口（[[aigc-provider-kie-ai]]，grep `kie` / `文生图` / `image` 工具），在 `archive_to_drafts` 拿到 `articleId` 后，若 `plan.illustrate`：异步触发题图生成并写回 article 封面字段（参照现有 AIGC 调用范式）。题图失败不阻断出稿（catch 落日志）。

> 若现有 AIGC 入口尚不具备"按文生题图并写回 article 封面"的现成函数，则本任务降级为：仅在 draft_result 文案提示"题图生成已排队"，实际生成留 follow-up（记 `log` 不静默吞）。实施时据现状二选一并在 commit message 注明。

- [ ] **Step 2: 验证 + 全量回归** — `npx tsc --noEmit && npm run build && npm run test`
Expected: 全绿。

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/cowork-content-creation.ts
git commit -m "feat(cowork): 计划卡配图开关接 AIGC 题图（失败不阻断出稿）"
```

> **Phase 3 验收**：出稿卡里打"导语短一点"能即时改一版并同步回稿件库（version+1）；勾了配图的稿件出题图（或明确排队提示）。

---

## 全局验收清单

- [ ] 钉钉热榜不可用 → 回"获取失败可重试"，会话退 idle，可重新发起（不再永久"稍等"）。
- [ ] cowork 发"写篇今天的热点稿" → 计划卡（选题预选 Top1 可换、字段可改）→ 开始撰写 → 初稿卡。
- [ ] 初稿卡「打开编辑器」进 `/articles/[id]`，是稿件库里的可编辑草稿（status=draft）。
- [ ] 初稿卡"说一句改一版"能改并同步回稿件库 + 版本链。
- [ ] 其它意图（查资料/分析）在 cowork 行为不变（仍走 mission_card）。
- [ ] `npx tsc --noEmit`、`npm run build`、`npm run test` 全绿。

## 风险与回退

- **意图误判**：非写稿被判 `content_creation` → 计划卡可不填直接忽略（不点开始撰写就不产出）；必要时加 `confidence` 门槛或在 plan_card 上给"其实我想…"返回普通对话的入口。
- **抓榜慢**：`buildCreationPlan` 同步抓榜在 server action 内，若超时，降级 `hotlistAvailable:false` 让用户自填主题，不阻塞。
- **`message.conversationId` 透传**：Task 2.5 若发现 `ConversationMessage` 不含 conversationId，统一改为从 thread 外层透传（已在任务里标注二选一）。
- 每阶段独立可回退（Phase 0 与 Phase 1-3 解耦；Phase 1 纯后端、Phase 2 才接 UI）。

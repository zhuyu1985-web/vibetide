# cowork 对话交互层增强（Phase 1）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 BRTV 原型验证有效的四种对话交互（意图 chip / 输入语义建议 / 稿件卡内联快编 / 多版本卡）+ 深度编辑器右侧嵌入，融入真实 `src/app/(dashboard)/cowork/`，全部复用现有后端。

**Architecture:** 在现有 cowork 消息渲染体系（`MessageBubble` 按 `kind` 分支）上做增量：意图 chip 读 `message.meta.intent`；稿件卡三键接 `/api/ai/edit` 流式；多版本卡复用 `generateVariantAction` + `listVariantsByArticle`；深度编辑把整页文章编辑器 `ArticleDetailClient` 改成可嵌入、用右侧 Sheet 打开。逻辑用 Vitest TDD，UI 用 tsc/build + 手动走查门禁。

**Tech Stack:** Next.js 16 / React 19 / TypeScript strict / Drizzle / AI SDK v6 / Tiptap 3 / Vitest / 设计系统（Button/GlassCard/共享 tag）。

**Spec:** [docs/superpowers/specs/2026-06-25-cowork-conversational-interactions-design.md](../specs/2026-06-25-cowork-conversational-interactions-design.md)

**纪律：** 全中文 UI；可点击元素无边框走 `Button` variant，不裸 `<button>`；不裸 `<input>/<select>/<textarea>`；本期**无 DB schema 变更**（`kind` 是 text 列，只改 TS union）；每个 commit `npx tsc --noEmit` 零错 + `npm run build` 通过（husky 会跑测试，须全绿）；实现于 `main`，每任务/里程碑独立可 build 绿提交。

---

## 文件结构（决策锁定）

**新增：**
- `src/lib/cowork/intent-chip-view.ts` — 纯函数：`IntentResult → { typeLabel, employees[] }`（可测）
- `src/components/cowork/intent-chip.tsx` — 意图 chip UI
- `src/lib/cowork/input-suggestions.ts` — 纯函数：会话上下文 → 建议数组（可测）
- `src/components/cowork/input-suggestions.tsx` — 建议 chip 行 UI
- `src/lib/cowork/use-card-ai-edit.ts` — `/api/ai/edit` 流式封装 hook（流解析可测）
- `src/components/cowork/multi-version-card.tsx` — 多版本卡 UI
- `src/app/actions/cowork-cards.ts` — cowork 卡片相关 server actions（采用回写、落多版本卡）
- `src/components/cowork/article-editor-sheet.tsx` — 深度编辑右侧 Sheet 容器

**改造：**
- `src/app/actions/cowork-submit.ts` — assistant 消息 `meta` 存完整 `intent`
- `src/lib/dal/cowork-conversations.ts` — `AppendMessageInput.kind` 加 `"multi_version_card"`；新增 `updateMessageMeta`
- `src/components/cowork/conversation-thread.tsx` — `MessageBubble` 接 IntentChip + `multi_version_card` 分支；输入区上方接 InputSuggestions
- `src/components/cowork/draft-result-card.tsx` — 三键内联编辑 + 「多版本」按钮 + 深度编辑入口
- `src/app/(dashboard)/articles/[id]/store.ts` / `article-detail-client.tsx` / `features/editor/article-editor.tsx` — 可嵌入改造（M5）

---

# M1 · 意图识别 chip

### Task 1.1: assistant 消息存完整 intent（**三处落点都要写**）

**Files:**
- Modify: `src/app/actions/cowork-submit.ts`

> ⚠️ 该文件有**三个** assistant 消息落点，都要把完整 `intent` 写进 `meta`（`intent` 变量在 :60 起即在作用域内）。**特别注意 `content_creation` 走 plan_card 分支并提前 return（:63-76），写稿这一最典型场景恰在这里——漏了它写稿时就没有意图 chip。**

- [ ] **Step 1: 三处都加 `meta.intent`**
  - **plan_card**（约 :66-73，`content_creation`）：`meta: { plan, intent }`。
  - **mission_card**（约 :97-103）：`meta` 从 `{ intentSummary, confidence }` 改为 `{ intentSummary: intent.summary, confidence: intent.confidence, intent }`。
  - **text / general_chat**（约 :134-138，当前 `appendMessage` **没有 meta 字段**）：补 `meta: { intent }`（general_chat 无 steps，chip 只显类型）。

```ts
// 完整 IntentResult（intentType/steps/...），供 IntentChip 渲染
meta: { ...existingMetaFields, intent },
```

- [ ] **Step 2: 验证** — `npx tsc --noEmit` 零错。`IntentResult`（`src/lib/agent/types.ts:202`）是可序列化对象，可直接进 jsonb。
- [ ] **Step 3: Commit** — `git commit -m "feat(cowork): 三处 assistant 落点 meta 存完整 intent，供意图 chip 渲染"`

### Task 1.2: IntentChip 视图纯函数（TDD）

**Files:**
- Create: `src/lib/cowork/intent-chip-view.ts`
- Test: `src/lib/cowork/__tests__/intent-chip-view.test.ts`（按邻近测试目录约定放置，参照同类已有测试位置）

- [ ] **Step 1: 写失败测试**

```ts
import { describe, it, expect } from "vitest";
import { toIntentChipView } from "../intent-chip-view";

describe("toIntentChipView", () => {
  it("返回 intentType 中文 label", () => {
    const v = toIntentChipView({ intentType: "content_creation", summary: "", confidence: 0.9, steps: [], reasoning: "" } as any);
    expect(v.typeLabel).toBe("内容创作");
  });
  it("从 steps 提取派单员工（去重、保序）", () => {
    const v = toIntentChipView({ intentType: "media_production", summary: "", confidence: 0.8, reasoning: "",
      steps: [ { employeeSlug: "xiaofa", employeeName: "渠道运营师", skills: [], taskDescription: "" },
               { employeeSlug: "xiaofa", employeeName: "渠道运营师", skills: [], taskDescription: "" } ] } as any);
    expect(v.employees.map(e => e.slug)).toEqual(["xiaofa"]);
  });
  it("低置信度标记 tentative", () => {
    const v = toIntentChipView({ intentType: "general_chat", summary: "", confidence: 0.3, steps: [], reasoning: "" } as any);
    expect(v.tentative).toBe(true);
    expect(v.employees).toEqual([]);
  });
});
```

- [ ] **Step 2: 跑测试确认失败** — `npx vitest run src/lib/cowork/__tests__/intent-chip-view.test.ts`，预期 FAIL（模块不存在）。
- [ ] **Step 3: 实现**

```ts
import type { IntentResult } from "@/lib/agent/types";
import { INTENT_TYPE_LABELS } from "@/lib/agent/types";

export interface IntentChipView {
  typeLabel: string;
  employees: { slug: string; name: string }[];
  tentative: boolean;
}

export function toIntentChipView(intent: IntentResult): IntentChipView {
  const seen = new Set<string>();
  const employees: { slug: string; name: string }[] = [];
  for (const s of intent.steps ?? []) {
    if (seen.has(s.employeeSlug)) continue;
    seen.add(s.employeeSlug);
    employees.push({ slug: s.employeeSlug, name: s.employeeName });
  }
  return {
    typeLabel: INTENT_TYPE_LABELS[intent.intentType] ?? intent.intentType,
    employees,
    tentative: (intent.confidence ?? 1) < 0.5,
  };
}
```

- [ ] **Step 4: 跑测试确认通过** — 同 Step 2 命令，预期 PASS。
- [ ] **Step 5: Commit** — `git commit -m "feat(cowork): 意图 chip 视图纯函数 + 单测"`

### Task 1.3: IntentChip 组件 + 接入 MessageBubble

**Files:**
- Create: `src/components/cowork/intent-chip.tsx`
- Modify: `src/components/cowork/conversation-thread.tsx`（`MessageBubble` assistant 分支顶部，约 :280-340）

- [ ] **Step 1: 组件** — 用 `toIntentChipView` + `resolveEmployeeVisual`（`@/components/shared/employee-visual`）渲染。头像/名/配色**必须**走 resolver，不裸用 EMPLOYEE_META。结构：「意图识别 → {typeLabel} → 派单 [头像]{name}（多人叠头像+「等N人」）」；`tentative` 时加「待确认」弱化样式。用设计系统 tag 类，不裸 `<button>`（chip 不可点则用 `<span>`）。

```tsx
"use client";
import { toIntentChipView } from "@/lib/cowork/intent-chip-view";
import { resolveEmployeeVisual } from "@/components/shared/employee-visual";
import type { IntentResult } from "@/lib/agent/types";

export function IntentChip({ intent }: { intent: IntentResult }) {
  const view = toIntentChipView(intent);
  return (
    <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs">
      <span className="tag tag-ai">意图识别 → {view.typeLabel}{view.tentative ? " · 待确认" : ""}</span>
      {view.employees.length > 0 && (
        <span className="inline-flex items-center gap-1">
          <span className="text-muted-foreground">派单</span>
          {view.employees.slice(0, 3).map((e) => {
            const v = resolveEmployeeVisual(e.slug);
            return (
              <span key={e.slug} className="inline-flex items-center gap-1">
                {/* 头像：v.SvgAvatar（组件，可能 undefined）优先，回退 v.Icon；名用 v.name??e.name；色 v.color */}
                {v.SvgAvatar ? <v.SvgAvatar className="h-4 w-4" /> : <v.Icon className="h-4 w-4" style={{ color: v.color }} />}
                <span style={{ color: v.color }}>{v.name ?? e.name}</span>
              </span>
            );
          })}
          {view.employees.length > 3 && <span className="text-muted-foreground">等 {view.employees.length} 人</span>}
        </span>
      )}
    </div>
  );
}
```
> `resolveEmployeeVisual` 返回 `EmployeeVisual`（`employee-visual.ts:11`）：`{ avatarSlug, SvgAvatar?(组件), Icon, color, bgColor, name?, nickname?, description? }`——**无 `avatar` 字段**。实现前 `Read` 确认 `SvgAvatar`/`Icon` 的 props（className/size），按真实签名接。

- [ ] **Step 2: 接入** — 在 `conversation-thread.tsx` 的 `MessageBubble` 里，assistant 消息（含 mission_card/plan_card/text）正文气泡上方：若 `message.meta?.intent` 存在则 `<IntentChip intent={message.meta.intent as IntentResult} />`。`meta` 当前是 `Record<string, unknown>`，做窄化判断（存在且有 intentType 字段才渲染），向后兼容旧消息。
- [ ] **Step 3: 验证** — `npx tsc --noEmit` + `npm run build`；起 dev 手动发一条「写一篇关于 X 的稿件」，确认 AI 回复顶部出现意图 chip + 员工头像。
- [ ] **Step 4: Commit** — `git commit -m "feat(cowork): AI 回复顶部意图识别 chip"`

---

# M2 · 输入框语义建议

### Task 2.1: 建议纯函数（TDD）

**Files:**
- Create: `src/lib/cowork/input-suggestions.ts`
- Test: `src/lib/cowork/__tests__/input-suggestions.test.ts`

- [ ] **Step 1: 写失败测试**（覆盖：空会话 / 有 draft / mission 执行中 / 兜底）

```ts
import { describe, it, expect } from "vitest";
import { suggestInputs } from "../input-suggestions";

describe("suggestInputs", () => {
  it("空会话给立项类建议", () => {
    const s = suggestInputs({ messageCount: 0, hasDraft: false, hasRunningMission: false });
    expect(s.some(x => x.fill.includes("立项"))).toBe(true);
  });
  it("有稿件给多版本/送审建议", () => {
    const s = suggestInputs({ messageCount: 4, hasDraft: true, hasRunningMission: false });
    expect(s.some(x => x.label.includes("多版本"))).toBe(true);
  });
  it("mission 执行中给看进度建议", () => {
    const s = suggestInputs({ messageCount: 2, hasDraft: false, hasRunningMission: true });
    expect(s.some(x => x.label.includes("进度"))).toBe(true);
  });
  it("每条都有 label 与 fill 且不超过 4 条", () => {
    const s = suggestInputs({ messageCount: 1, hasDraft: false, hasRunningMission: false });
    expect(s.length).toBeLessThanOrEqual(4);
    expect(s.every(x => x.label && x.fill)).toBe(true);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现**

```ts
export interface CoworkInputContext {
  messageCount: number;
  hasDraft: boolean;
  hasRunningMission: boolean;
}
export interface InputSuggestion { label: string; fill: string }

export function suggestInputs(ctx: CoworkInputContext): InputSuggestion[] {
  if (ctx.hasRunningMission) {
    return [
      { label: "看执行进度", fill: "看一下当前任务执行进度" },
      { label: "补充素材", fill: "把相关素材补充进来" },
    ];
  }
  if (ctx.hasDraft) {
    return [
      { label: "多版本分产", fill: "出各端版本：微博、抖音、视频号" },
      { label: "改得更口语化", fill: "把稿件改得更口语化、更适合短视频" },
      { label: "送审", fill: "送审这条稿件" },
      { label: "补背景数据", fill: "补充相关背景与数据支撑" },
    ];
  }
  if (ctx.messageCount === 0) {
    return [
      { label: "监测今日热点", fill: "监测今天的全网热点，给我几个选题" },
      { label: "立项做快讯+成片", fill: "今天的热点这条，立项做快讯+成片，把素材拉进来" },
      { label: "写一篇深度稿", fill: "围绕这个主题写一篇深度稿" },
    ];
  }
  return [
    { label: "写条快讯", fill: "先出一条快讯" },
    { label: "查素材", fill: "查一下相关素材" },
    { label: "出深度稿", fill: "围绕这个主题出一篇深度稿" },
  ];
}
```

- [ ] **Step 4: 跑测试确认通过**
- [ ] **Step 5: Commit** — `git commit -m "feat(cowork): 输入语义建议纯函数 + 单测"`

### Task 2.2: InputSuggestions 组件 + 接入输入区

**Files:**
- Create: `src/components/cowork/input-suggestions.tsx`
- Modify: `src/components/cowork/conversation-thread.tsx`（输入框上方，约 :174-249）

- [ ] **Step 1: 组件** — 横向可滚动 chip 行；点击 = 把 `fill` 填入输入框（受控 `setInput`），不直接发送（避免误触），focus textarea。chip 用 `Button variant="secondary"`（无边框，size sm）或设计系统 tag-pill，不裸 `<button>`。

```tsx
"use client";
import { Button } from "@/components/ui/button";
import type { InputSuggestion } from "@/lib/cowork/input-suggestions";

export function InputSuggestions({ items, onPick }: { items: InputSuggestion[]; onPick: (fill: string) => void }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-2 flex gap-2 overflow-x-auto">
      {items.map((s) => (
        <Button key={s.label} variant="secondary" size="sm" className="flex-none whitespace-nowrap"
          onClick={() => onPick(s.fill)}>{s.label}</Button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 接入** — `conversation-thread.tsx`：从消息列表派生 `CoworkInputContext`（`messageCount = messages.length`；`hasDraft = messages.some(m => m.kind === "draft_result")`；`hasRunningMission =` 是否有未完成 mission_card，可由现有 `useMissionLive`/抽屉状态或简单按"有 mission_card 且 mission 未终态"推断——MVP 先用"会话里有 mission_card"近似，标注 TODO）。在输入框 `<div>` 上方渲染 `<InputSuggestions items={suggestInputs(ctx)} onPick={(f) => setInput(f)} />`。
- [ ] **Step 3: 验证** — `npx tsc --noEmit` + `npm run build`；手动：空会话/出稿后建议随上下文变化、点击填入输入框。
- [ ] **Step 4: Commit** — `git commit -m "feat(cowork): 输入框上方上下文语义建议 chip"`

---

# M3 · 稿件卡内联快速编辑

### Task 3.1: use-card-ai-edit 流式 hook（TDD 流解析）

**Files:**
- Create: `src/lib/cowork/use-card-ai-edit.ts`
- Test: `src/lib/cowork/__tests__/use-card-ai-edit.test.ts`（测纯解析部分；hook 的 React 部分可后续手测）

> 先 `Read` `src/app/(dashboard)/articles/[id]/features/editor/ai-diff-preview.tsx:80-110` 复用其 `fetch("/api/ai/edit")` + `response.body.getReader()` 流读取写法，保持一致。

- [ ] **Step 1: 抽纯函数 + 测试** — 把"读 ReadableStream 累积文本"抽成可测纯函数 `readTextStream(reader, onChunk)`；测试用 mock reader 喂分片，断言累积结果与 onChunk 调用次数。

```ts
import { describe, it, expect, vi } from "vitest";
import { readTextStream } from "../use-card-ai-edit";

function mockReader(chunks: string[]) {
  let i = 0; const enc = new TextEncoder();
  return { read: async () => i < chunks.length ? { done: false, value: enc.encode(chunks[i++]) } : { done: true, value: undefined } } as any;
}
describe("readTextStream", () => {
  it("累积分片并回调", async () => {
    const onChunk = vi.fn();
    const out = await readTextStream(mockReader(["北京", "升级发布", "寒潮预警"]), onChunk);
    expect(out).toBe("北京升级发布寒潮预警");
    expect(onChunk).toHaveBeenCalledTimes(3);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现** — `readTextStream` + `useCardAiEdit` hook：

```ts
import { useCallback, useState } from "react";

export async function readTextStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk: (acc: string) => void,
): Promise<string> {
  const dec = new TextDecoder();
  let acc = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    acc += dec.decode(value, { stream: true });
    onChunk(acc);
  }
  return acc;
}

type CardEditMode = "polish" | "rewrite" | "expand";
const INSTRUCTION: Record<CardEditMode, string> = {
  polish: "润色这段文字，保持事实与口径不变",
  rewrite: "整体改写得更精炼、更有新闻性，保持事实不变",
  expand: "在保持事实前提下扩写，补充背景与细节",
};

export function useCardAiEdit() {
  const [streaming, setStreaming] = useState(false);
  const [partial, setPartial] = useState<string | null>(null);
  const editText = useCallback(async (text: string, mode: CardEditMode): Promise<string> => {
    setStreaming(true); setPartial("");
    try {
      const res = await fetch("/api/ai/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullContent: text, selectedText: text, instruction: INSTRUCTION[mode], mode: mode === "polish" ? "polish" : "rewrite" }),
      });
      if (!res.ok || !res.body) throw new Error("ai edit failed");
      return await readTextStream(res.body.getReader(), setPartial);
    } finally {
      setStreaming(false);
    }
  }, []);
  return { editText, streaming, partial };
}
```

- [ ] **Step 4: 跑测试确认通过**
- [ ] **Step 5: Commit** — `git commit -m "feat(cowork): 稿件卡 AI 编辑流式 hook（润色/改写/扩写）+ 流解析单测"`

### Task 3.2: 采用回写 server action + DAL updateMessageMeta

**Files:**
- Modify: `src/lib/dal/cowork-conversations.ts`（加 `updateMessageMeta`）
- Create: `src/app/actions/cowork-cards.ts`（`adoptDraftEdit`）

- [ ] **Step 1: DAL** — 加 `updateMessageMeta(messageId, metaPatch)`：读现有 meta、浅合并、写回。
- [ ] **Step 2: action** — `adoptDraftEdit({ conversationId, messageId, articleId, body })`：`requireAuth` → `updateArticle(articleId, { body })`（`src/app/actions/articles.ts:58`）→ `updateMessageMeta(messageId, { bodyPreview: body.slice(0, 200) })` → `revalidatePath('/cowork/' + conversationId)`。
- [ ] **Step 3: 验证** — `npx tsc --noEmit`。（DB action 不单测，靠 tsc + 手测。）
- [ ] **Step 4: Commit** — `git commit -m "feat(cowork): 稿件卡采用回写 action（updateArticle + 同步消息 meta 预览）"`

### Task 3.3: DraftResultCard 三键内联编辑

**Files:**
- Modify: `src/components/cowork/draft-result-card.tsx`

- [ ] **Step 1: UI** — 正文预览下方加三键「AI 润色 / AI 改写 / AI 扩写」（`Button variant="secondary" size="sm"`，无边框）；点击调 `useCardAiEdit().editText(preview, mode)`，流式把 `partial` 实时回填预览（loading 态禁用三键）；改完显示「采用」「撤销」；采用调 `adoptDraftEdit`（乐观更新卡内预览），撤销回原文。「深度编辑」按钮先保留现有跳转（M5 再替换为 Sheet）。
- [ ] **Step 2: 验证** — `npx tsc --noEmit` + `npm run build`；手测：点润色→预览流式变化→采用→刷新预览不回落（因 meta 已更新）。
- [ ] **Step 3: Commit** — `git commit -m "feat(cowork): 稿件卡内联 AI 润色/改写/扩写 + 采用回写"`

---

# M4 · 多版本生成卡

### Task 4.1: kind union 扩展（仅 TS）

**Files:**
- Modify: `src/lib/dal/cowork-conversations.ts`（`AppendMessageInput.kind` union）
- Grep 检查：是否有别处对 kind 做穷举类型/校验需同步（`MessageKind` 类型定义处）

- [ ] **Step 1: 加值** — union 加 `"multi_version_card"`（**不动 `conversations.ts` schema 文件**，kind 是 text 列）。
- [ ] **Step 2: 验证** — `npx tsc --noEmit` 零错（确认 MessageBubble 的 switch 若有 exhaustive 检查，下一任务补分支）。
- [ ] **Step 3: Commit** — `git commit -m "feat(cowork): 消息 kind 加 multi_version_card（TS union）"`

### Task 4.2: 落多版本卡 action

**Files:**
- Modify: `src/app/actions/cowork-cards.ts`（加 `startMultiVersion`）

- [ ] **Step 1: action** — `startMultiVersion({ conversationId, articleId, platforms })`：`requireAuth` → `appendMessage(conversationId, { role: "assistant", kind: "multi_version_card", executedByEmployeeId?, meta: { articleId, platforms } })` → `revalidatePath`。默认 platforms = `["weibo","douyin","wechat_oa","xiaohongshu"]`。
- [ ] **Step 2: 验证** — `npx tsc --noEmit`。
- [ ] **Step 3: Commit** — `git commit -m "feat(cowork): 落多版本卡 action"`

### Task 4.3: MultiVersionCard 组件

**Files:**
- Create: `src/components/cowork/multi-version-card.tsx`

> 先 `Read` `src/app/actions/article-channel-variants.ts`，确认两个**现成 server action**：`listVariantsAction(articleId): Promise<ArticleChannelVariantItem[]>`（:17）与 `generateVariantAction({articleId, platform})`（:55）。**不要新造 `getVariantsAction`**——直接用 `listVariantsAction`。

- [ ] **Step 1: UI + 逻辑**（`"use client"`）— props `{ articleId, platforms }`。挂载时调 **`listVariantsAction(articleId)`** 拉现状（client 可直接调该 server action）。每平台一行：平台名（中文 label）+ 状态 badge（未生成/生成中/已就绪/失败）+ 就绪后「预览/进编辑器」。顶部「一键生成」：对未就绪平台逐个发起，本地标「生成中」：

```ts
async function genOne(platform: string) {
  setStatus(platform, "generating");
  try {
    const item = await generateVariantAction({ articleId, platform });
    // skill 失败时 action 不抛错而返回 status:"failed" + body（原因）
    setVariant(platform, item); // item.status ∈ ready/failed
  } catch (e) {
    // 前置 throw（文章不存在 :63 / 无正文 :66）不在内部 catch 里 —— 这里兜
    setStatus(platform, "failed", e instanceof Error ? e.message : "生成失败");
  }
}
```
失败（返回 `status:"failed"` 或被 catch）显示原因 + 单独「重试」。用 GlassCard + Button（无边框），状态 badge 用设计系统 pill。
- [ ] **Step 2: 验证** — `npx tsc --noEmit` + `npm run build`。
- [ ] **Step 3: Commit** — `git commit -m "feat(cowork): 多版本生成卡（复用 generateVariantAction + listVariantsByArticle）"`

### Task 4.4: 接入 MessageBubble + 稿件卡「多版本」按钮

**Files:**
- Modify: `src/components/cowork/conversation-thread.tsx`（`MessageBubble` 加 `multi_version_card` 分支）
- Modify: `src/components/cowork/draft-result-card.tsx`（加「多版本」按钮 → `startMultiVersion`）

- [ ] **Step 1: 分支 + 按钮** — MessageBubble：`message.kind === "multi_version_card"` → `<MultiVersionCard articleId={meta.articleId} platforms={meta.platforms} />`。DraftResultCard：加「多版本」按钮（`Button variant="secondary" size="sm"`）调 `startMultiVersion({ conversationId, articleId, platforms: 默认 })`。
- [ ] **Step 2: 验证** — `npx tsc --noEmit` + `npm run build`；手测：稿件卡点「多版本」→ 落卡 → 一键生成 → 状态回填 → 失败重试。
- [ ] **Step 3: Commit** — `git commit -m "feat(cowork): 接入多版本卡 + 稿件卡多版本入口"`

---

# M5 · 深度编辑器右侧嵌入（最重 · 设 checkpoint）

> **🛑 CHECKPOINT：** 完成 Task 5.1–5.3（编辑器改造为可嵌入并能在隔离容器渲染+保存）后**停下来**，向用户/审阅确认嵌入可行、不破坏整页编辑器，再做 Task 5.4 接入 cowork。若 5.2 store 隔离受阻 → 走兜底（spec §5：精简编辑容器 / 新标签开整页）。

### Task 5.1: getArticleDetailBundle 数据包装 action

**Files:**
- Create/Modify: `src/app/actions/cowork-cards.ts` 或新 `src/app/actions/article-bundle.ts`

> 先 `Read` `src/app/(dashboard)/articles/[id]/page.tsx` 抄那 6 路 `Promise.all`（`getArticle` / `getAnnotations` / `getAIAnalysisCache` / org / `articleLanguage` / `externalPublications`）。

- [ ] **Step 1: action** — `getArticleDetailBundle(articleId)`：`requireAuth` → 复用 page.tsx 同款 6 路 `Promise.all`（`getArticle` / `getAnnotations` / `getAIAnalysisCache` / org / `articleLanguage` / `externalPublications`）→ 返回 `ArticleDetailClientProps` 所需全部字段。**务必照搬 page.tsx 每路的 `.catch()` 兜底**（`page.tsx:21-43`），否则附属查询（annotations/aiAnalysis/publications）抖动会让整个 Sheet 加载失败。org 隔离由 `getArticle` 内部保证（`articles.ts:150`），无需额外校验。
- [ ] **Step 2: 验证** — `npx tsc --noEmit`。
- [ ] **Step 3: Commit** — `git commit -m "feat(cowork): getArticleDetailBundle 包装（复用文章详情 6 路查询）"`

### Task 5.2: 文章编辑器 store 隔离

**Files:**
- Modify: `src/app/(dashboard)/articles/[id]/store.ts`

> 先 `Read` store.ts 看是模块级单例 `create(...)` 还是已支持 provider。

- [ ] **Step 1: 改造** — 把全局单例改为可作用域化：优先用 React Context 注入 store 实例（`createArticlePageStore()` 工厂 + `ArticlePageStoreProvider`），整页与嵌入各自独立实例；保留 `useArticlePageStore` API 兼容整页用法（默认全局实例 fallback）。
- [ ] **Step 2: 验证** — `npx tsc --noEmit` + `npm run build`；**整页编辑器 `/articles/[id]` 手测不回归**（读/编辑/保存/AI 改写/渠道面板均正常）。
- [ ] **Step 3: Commit** — `git commit -m "refactor(article-editor): store 工厂化支持多实例隔离（为 cowork 嵌入铺路）"`

### Task 5.3: ArticleDetailClient 可嵌入

**Files:**
- Modify: `src/app/(dashboard)/articles/[id]/article-detail-client.tsx`、`features/editor/article-editor.tsx`

- [ ] **Step 1: 改造** — 加 `embedded?: boolean` + `onExitEditor?: () => void` + `initialViewMode?: "read" | "edit"`：
  - `embedded` 时布局用 `h-full` + flex basis 取代 `h-[calc(100vh-64px)]` 与三栏百分比；
  - `onExitEdit` / 左栏「打开编辑器」在 embedded 时走 `onExitEditor`（关 Sheet），不跳路由、不读 `useSearchParams`；
  - `initialViewMode` 注入初始模式（替代 `?mode=edit`）。
  - 整页用法默认值保持原行为。
- [ ] **Step 2: 验证** — `npx tsc --noEmit` + `npm run build`；整页 `/articles/[id]` 再次手测不回归。
- [ ] **Step 3: Commit** — `git commit -m "feat(article-editor): 支持 embedded 模式（相对布局 + 导航反转 + 注入初始模式）"`

> **🛑 在此 CHECKPOINT 暂停**：临时在某处用隔离 store + bundle + embedded 渲染一次编辑器（或写最小 harness），确认能加载/编辑/保存且整页不回归，再继续 5.4。

### Task 5.4: ArticleEditorSheet + 接入稿件卡「深度编辑」

**Files:**
- Create: `src/components/cowork/article-editor-sheet.tsx`
- Modify: `src/components/cowork/draft-result-card.tsx`（「深度编辑」改为打开 Sheet）

- [ ] **Step 1: Sheet** — 右侧宽 `Sheet`（设计系统 `@/components/ui/sheet`），打开时 `getArticleDetailBundle(articleId)`（loading/error 态，error 给「新页打开」兜底链接）→ 用独立 store provider 挂 `<ArticleDetailClient {...bundle} embedded initialViewMode="edit" onExitEditor={close} />`。
- [ ] **Step 2: 接入** — DraftResultCard「深度编辑」从 `<Link href=/articles/[id]>` 改为 `onClick` 打开 `<ArticleEditorSheet articleId={meta.articleId} />`。
- [ ] **Step 3: 验证** — `npx tsc --noEmit` + `npm run build`；手测：稿件卡点深度编辑→右侧 Sheet 打开三栏编辑器→改字保存→返回关 Sheet→稿件卡预览同步；整页编辑器仍正常。
- [ ] **Step 4: Commit** — `git commit -m "feat(cowork): 稿件卡深度编辑右侧 Sheet 打开完整文章编辑器"`

---

## 收尾

- [ ] 全量 `npx tsc --noEmit` + `npm run build` + `npm run test` 全绿。
- [ ] 五个里程碑手动走查清单（spec §7）全过。
- [ ] 更新 spec 状态为「已实施」；如有 follow-up（多版本自然语言入口、多语种、输入建议 LLM 化）记入 spec §9 / 新建 follow-up 票。

## 风险登记

1. **M5 store 隔离**最高风险——CHECKPOINT 前置，受阻即走兜底，不阻塞 M1–M4 交付。
2. `resolveEmployeeVisual` 返回 `SvgAvatar?(组件)/Icon/color/name?`（无 `avatar`），头像组件可能 undefined 需判空（Task 1.3）。
3. `/api/ai/edit` 流式格式实读 `ai-diff-preview.tsx:106` 对齐（Task 3.1）。
4. `MessageBubble` 实为 **if 链 + fallthrough 到 text**（非 exhaustive switch），加 `multi_version_card` union 后 **tsc 不报错**；中间态（4.1 已加 union、4.4 未加分支）多版本卡消息会暂渲染成普通文本气泡，可 build，顺序 4.1→4.4 无倒置。
5. `generateVariantAction` 前置两处 `throw`（文章不存在/无正文）不在内部 catch——「一键生成」循环须 try/catch 兜（Task 4.3）。
6. `getArticleDetailBundle` 须保留 page.tsx 每路 `.catch()` 韧性（Task 5.1）。

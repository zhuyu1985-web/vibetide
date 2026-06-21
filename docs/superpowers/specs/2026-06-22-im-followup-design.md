# Phase 1c：IM 一键跟进（带上下文的再请求）Design

## Summary

mission 出结果后，让用户回一句"换个财经角度 / 改成1500字 / 换个开头"就能在上次基础上重做，不必重述。

**核心机制（比 brainstorm 初稿更简）**：不新增 schema 字段。结果交付时把"上次请求 + 已完成摘要"**直接写进 `channel_sessions.contextTurns`** 并设 30min 跟进窗口（复位为 idle）。用户在窗口内回话时，`clarifyOrPlan` 本就读 `contextTurns` → **自动把上次上下文带进规划**，gateway 与规划器**零改动**。窗口过期由 `getOrCreateSession` 现有过期复位（已清 contextTurns）兜住。

> **简化说明**：brainstorm 初稿提议加 `last_result jsonb {missionId, instruction, resultSummary}`。但 MVP 范围是"带上下文的再请求"（不精确操作上一篇 artifact），只需要**文本上下文**——而 `contextTurns` 正是承载文本上下文的现成字段。故不加 schema 字段、不加 gateway seeding 逻辑，复用 contextTurns 即可，行为完全一致。

## Scope

In scope：
- 新 DAL `recordSessionResult(key, { instruction, resultSummary })`：按三元组键软复位为 idle（清 activeMissionId/pendingPlan/clarifyRounds）+ **写 contextTurns = [{user:instruction},{assistant:`已完成：<resultSummary>`}]** + expiresAt = now + 30min。
- `channel-result-notify.ts` 的 `sendChannelResult`：**成功**路径用 `recordSessionResult` 替代 `resetSession`；结果消息**末尾加跟进提示**。
- **失败**路径（status=failed）保持 `resetSession`（失败无产出可跟进，全清）。

Out of scope：
- 新 schema 字段（简化掉，复用 contextTurns）。
- 精确操作上一篇 artifact 的跟进（"给这篇加配图""把这篇发布到XX"——需要 artifact + 增量/发布 task 集成，列后续 Phase 1d）。
- gateway / `clarifyOrPlan` / confirming / running / 取消 任何改动（无需改）。

## 数据流

```
mission 完成 → channelMissionTerminalNotify(Inngest) → sendChannelResult(ctx, missionId)
  ├─ status === 'failed' → resetSession(全清，无跟进)   + 发"❌ 任务失败…"
  └─ 成功 → recordSessionResult(key, {instruction: mission.title, resultSummary})
            contextTurns = [{user:mission.title}, {assistant:'已完成：<summary>'}]
            status=idle, expiresAt=now+30min
          + 发"✅ 已完成：<summary>\n在系统查看：<link>\n想继续可以说：换个角度 / 换个方向 / 调整篇幅。"

用户 30min 内回 "换个财经角度"
  → handleInboundMessage → handleFreeFormMessage
  → getOrCreateSession（未过期，返回含 contextTurns 的 session）
  → status=idle（非 running/confirming）→ clarifyOrPlan(orgId, session, "换个财经角度")
  → fullMessage = "user: <mission.title>\nassistant: 已完成：<summary>\nuser: 换个财经角度"
  → 规划器看到上次主题 → 不过度澄清 → 带上下文重新规划（财经版）
  → 正常 confirming 确认卡 → 开始 → 起新 mission
  → 新 mission 完成 → recordSessionResult 覆写 contextTurns 为新结果（链式可续）

30min 无动作 → 下条消息触发 getOrCreateSession 过期复位（清 contextTurns）→ 干净 idle
```

## 为什么 gateway 零改动

`clarifyOrPlan` 已经 `const ctx = (session.contextTurns ?? []).map(...).join("\n")` 把 contextTurns 拼进 fullMessage（`clarify-or-plan.ts:77-78`）。结果交付把上下文写进 contextTurns 后，下一条自由消息天然带上它——无需任何 seeding 代码。confirming/running 态本就不读 contextTurns 做规划，不受影响。

## Components

新建：
- DAL `recordSessionResult(key: Pick<SessionKey,"configId"|"chatId"|"externalUserId">, args: { instruction: string; resultSummary: string }): Promise<void>`（`channel-sessions.ts` 内）。`FOLLOWUP_WINDOW_MS = 30*60*1000`。

改动：
- `src/lib/channels/channel-result-notify.ts`：成功路径 `resetSession` → `recordSessionResult`（instruction 取 `mission.title ?? summary`，resultSummary 取 `summary`）；成功消息末尾加跟进提示。

复用：`clarifyOrPlan`（读 contextTurns，不改）、confirming 流、`getOrCreateSession` 过期复位、`resetSession`（失败路径仍用）。

**明确不改 `sendChannelFailure`**：`channel-result-notify.ts` 另一个导出 `sendChannelFailure`（executor 抛异常时由 `start-channel-mission.ts` 的 `.catch()` 调用）也调 `resetSession`——它**保持不变**。原因：executor 抛错=没有产出可跟进，全清复位才对，不写跟进上下文。实现者看到这第二个 `resetSession` 调用不要误改。

不动：schema、gateway、规划器、执行下游、`sendChannelFailure`。

## Error Handling

- **失败 mission**（status=failed）→ `resetSession` 全清，不写跟进上下文（失败没产出可跟进）。
- **过期**：30min 窗口到，`getOrCreateSession` 过期分支清 contextTurns → 回干净 idle（无需新代码，现有逻辑覆盖）。
- **窗口内发全新请求**（与上次无关）→ 规划器 latest 优先，按新请求规划，旧上下文无害忽略（新规划器 prompt 以最新消息主题为准）。
- **mission.title 为空** → instruction 兜底用 resultSummary 或 "上一个任务"。
- **连续跟进** → 每次新 mission 完成时 `recordSessionResult` 覆写 contextTurns 为最新结果，旧的自然被替换。

## Verification

- 单测 DAL `recordSessionResult`（mock db）：写 contextTurns=[2 turns]、status idle、expiresAt 非空（≈now+30min）、清 activeMissionId/pendingPlan。
- 单测 `sendChannelResult`（mock db/outbound/DAL）：
  - 成功 mission → 调 `recordSessionResult`（不调 resetSession）、出站消息含"想继续"提示。
  - 失败 mission → 调 `resetSession`（不调 recordSessionResult）、消息为"❌ 任务失败"、不含跟进提示。
- 回归：现有 `channel-result-notify` 测试（若有断言 resetSession 的成功用例）需迁移到断言 recordSessionResult。
- 端到端手测：起任务→出结果（带跟进提示）→回"换个财经角度"→应出**财经版新计划卡**（不重新澄清主题）→开始→新结果。
- `tsc --noEmit` + `build` + `npm test` 全过。

## Rollout

1. DAL `recordSessionResult` + 单测。
2. `sendChannelResult` 成功路径切换 + 跟进提示 + 单测。
3. 全量验证 + 终审。
4. 端到端手测（钉钉）：结果后回"换个角度"验证跟进链路。
5. 合并 main。

## Future（Phase 1d 及后续）

- 精确操作上一篇 artifact 的跟进（加配图/发布到指定渠道）——需要把上次 mission 的产出 artifact/article 接入新 mission 的输入。
- 跟进提示按任务类型定制（写稿类提"换角度/配图"，检索类提"深挖某条/换平台"）。
- 多轮跟进的上下文压缩（contextTurns 累积过长时摘要化）。

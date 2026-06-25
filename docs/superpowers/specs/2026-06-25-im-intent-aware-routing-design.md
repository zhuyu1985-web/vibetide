# IM 内容生产线 · Phase 1：意图感知路由（意图地基）

- **日期**：2026-06-25
- **状态**：设计已与 owner 对齐（可视化 brainstorm），待 spec 评审
- **作者**：zhuyu（与 Claude 协作）
- **关联**：[[voice-content-loop-design]]、[[dingtalk-stream-worker-restart]]、本次 PC 计划卡 spec `docs/superpowers/specs/2026-06-24-pc-chat-content-creation-plan-card-design.md`

> **这是三期 IM 体验梳理路线的第一期。** 路线：Phase 1 意图层（懂不懂你）→ Phase 2 能力层（立项/快讯/成片/素材）→ Phase 3 交互层（IM 原生计划卡/反问校对）。**本 spec 只覆盖 Phase 1**；Phase 2/3 各自单独走 brainstorm→spec→计划。

---

## 1. 背景与问题

IM 线（钉钉/企微机器人）当前是一台 **9 阶段刚性状态机**（`channel_sessions.scenario_phase`：idle→hot_list→topic_select→drafting→translating→review_pending→approved→publishing→analytics），只覆盖「热点 → 写文字稿」一条主线。

**核心病根（手测实锤）**：`gateway.ts` `handleFreeFormMessage` 的**阶段锁**（`:315`）——
```ts
if (session.scenarioPhase && session.scenarioPhase !== "idle") {
  return handleContentLoopMessage(text, msg, session, channelCtx);
}
```
一旦不在 idle，**每条消息都被无脑灌给当前阶段**。后果：用户在 `drafting` 阶段发「今天寒潮，立项做快讯+成片」这种**全新任务**，被 `drafting` 当成「改稿指令」吞掉 → 机器人回「正在按你的要求改稿」并推出旧稿 → **答非所问**。

> 注：本次已修的相邻问题（双机器人 / 卡死自愈 / 任务中心可见性 / 问候拦截）已落 `main`，不在本期范围；本期专治「刚性状态机吞新意图」。

---

## 2. 目标 / 非目标

### 2.1 目标（Phase 1）
- **G1**：任何阶段收到消息，都先做**意图分诊**，正确区分「继续当前流程 / 新任务 / 听不懂」，不再被当前阶段无脑吞。
- **G2**：判出「新任务」时——已支持的（热点/写稿类）**切换 + 留「回到上一篇」面包屑**；属于 Phase 2 能力的（立项/成片/素材）**优雅告知"在建设中"**，绝不吞、不强切。
- **G3**：真听不懂时**反问澄清**，而不是硬塞进某分支。
- **G4**：性能——多数消息（编号/确认词/明确命令）走规则**零延迟**；只有「活跃阶段里一段不像阶段动作的自由文字」才调一次 LLM。

### 2.2 非目标（明确不做，留后期）
- 不加任何新能力本体（立项/快讯/成片/素材汇入 = **Phase 2**）。
- 不做 IM 原生计划卡 / 反问校对 / 多轮可视化编排（= **Phase 3**）。
- 不改产物形态、不动 content-loop 各阶段已有的执行逻辑（fetch_topics/gen_draft/revise/translate/publish…）。
- 不碰 PC cowork 线。

---

## 3. 锁定决策（brainstorm 输出）

| # | 决策点 | 选定 |
|---|---|---|
| D1 | 意图判定机制 | **混合**：规则兜明显的（~90%，0 延迟）；只有「活跃阶段里的模糊自由文字」才过一次 LLM 分诊 |
| D2 | 判出「新任务」对在制稿的处置 | **切换 + 面包屑**「回到上一篇」（草稿一直在稿件库不会丢）；**LLM 低置信时退到「先确认一句」**（B 模式）再切 |
| D3 | Phase 2 能力意图（立项/成片/素材） | Phase 1 **识别但不执行**：优雅告知"在建设中" + 给当前可用能力菜单；绝不吞、不变成改稿 |
| D4 | 听不懂 | 反问澄清（一句，问最关键缺失） |
| D5 | 复用 | 规则层复用现有 11 个 `intents.ts` 谓词；LLM 层复用 `model-router` + 借鉴 `clarifyOrPlan`/`recognizeIntent` |

---

## 4. 架构与数据流

**总策略**：不重写状态机，而是在两处插入意图分诊——① 一批**全局意图**前置到阶段锁之前（任何阶段都生效）；② 各活跃阶段「原本无脑 fallthrough」的那一刻，换成 **LLM 分诊**。这样既最小化改动，又彻底治住「吞新意图」。

### 4.1 全局意图前置（规则层，gateway `handleFreeFormMessage`，阶段锁 `:315` 之前）
按顺序判，命中即处理、不进阶段锁（复用现有谓词，0 延迟）：
1. `isExitLoop` → 退出闭环（现已在 orchestrator 内，但前置后任何阶段一致）
2. `isGreeting` → 友好菜单 + 复位（**已实现**，保留）
3. **`isResumePrevious`（新增谓词）**「回到上一篇 / 接着改刚才那篇」→ 从暂存恢复上一个阶段（见 §6）
4. `isHotTopicIntent` → `startContentLoop`（重启热点线，任何阶段都允许）
5. `#场景` 快捷命令 → 现有 `handleQuickCommand`（已在 gateway 上游，确认其先于阶段锁）

> 其余（编号选择 / A·B·C / 发布 / 换一批 / 改稿自由文字 / 真·新任务）**仍进阶段锁** → `handleContentLoopMessage`，在那里做 §4.2。

### 4.2 活跃阶段内的 LLM 分诊（orchestrator `handleContentLoopMessage`）
每个阶段**先跑自己的廉价解析器**（`parseSelection` / `isRegenerate` / `isFinalizeIntent` / `isTranslateIntent` / `isSubmitReviewIntent` / `parseMultiSelection` …，全部现成）。**命中就按阶段动作处理（0 延迟，行为不变）。**

只有当**所有阶段解析器都不命中**（即原本会无脑 fallthrough 成「改稿指令」或「说编号选一个」的那一刻）→ 调一次 **LLM 分诊** `classifyInPhase(phase, text, ctx)`：

```
返回 { kind, confidence, capabilityHint? }，kind ∈:
  • "continue"      → 这是对当前阶段的合法自由指令（如 drafting 的改稿）→ 按原阶段逻辑处理（drafting→revise；其余阶段→该阶段兜底提示）
  • "switch"        → 这是一个新的【已支持】意图（热点/写稿类）→ 暂存当前上下文(§6) + 切换 + 面包屑；confidence 低 → 先确认(D2 B 模式)
  • "capability_todo" → 这是 Phase 2 能力意图（立项/成片/拉素材…）→ 优雅告知 §5，不切不吞
  • "clarify"       → 真听不懂 → 反问一句
```

> 关键：`hot_list`/`topic_select` 阶段「非选择的自由文字」、`drafting`/`translating` 阶段「非改稿命令的自由文字」——以前都被当成「该阶段动作」无脑处理，现在统一交给分诊判一次。**这是本期唯一新增的 LLM 调用点，且只在 fallthrough 触发。**

### 4.3 兜底
- `session.status === "running" / "confirming"` 分支（gateway :285/:289）不变。
- idle 态自由文字 → 现有 `clarifyOrPlan`（不变）。

---

## 5. Phase 2 能力意图的「优雅挡」

`classifyInPhase` 识别到「立项 / 做视频/成片 / 拉前方素材 / 多产物」等 Phase 2 能力词或语义 → `kind="capability_todo"`，回执统一模板（不吞、不切、不改稿）：

> 「『XX』这个能力（立项/成片/素材汇入）还在建设中 🚧。目前我能帮你：① 说「获取今天的热点」挑热点写稿 ② 直接说「写一篇关于XX的稿子」。要先来一篇吗？」

（capabilityHint 带回具体是哪类，便于话术里点名 + 后续埋点统计需求热度。）

---

## 6. 暂存与「回到上一篇」

切换（D2）时，把当前 `scenarioPhase` + `loopContext` 暂存进 `loopContext.parkedContext`（jsonb 内嵌，**无迁移**）：
```ts
loopContext.parkedContext = { scenarioPhase, loopContext: <当前 loopContext 快照>, articleTitle, parkedAt }
```
- `isResumePrevious` 命中 → 用 parkedContext 还原 `scenarioPhase` + `loopContext`，回执「已回到《X》，继续说修改要求」。
- 只保留**最近一次** parked（一层，YAGNI；多层栈不做）。
- parkedContext 随会话 TTL 自然过期；新会话/退出清空。

---

## 7. LLM 分诊器（新增 `src/lib/channels/content-loop/intent-classify.ts`）

```ts
export type InPhaseClassification =
  | { kind: "continue"; confidence: number }
  | { kind: "switch"; confidence: number; targetIntent: "hot_topic" | "write_article"; topicHint?: string }
  | { kind: "capability_todo"; confidence: number; capabilityHint: string }
  | { kind: "clarify"; confidence: number; question: string };

export async function classifyInPhase(
  phase: ContentLoopPhase,
  text: string,
  ctx: { activeArticleTitle?: string },
): Promise<InPhaseClassification>;
```
- 单次 `generateText`（小模型、低 token、确定性 JSON），prompt 给定**当前阶段语义**（如「用户正在 drafting 改《X》初稿」）+ 用户消息 → 判类。
- 鲁棒性：JSON 解析失败 / LLM 异常 → **降级为 `continue`**（保持现有行为，绝不因分诊器挂掉而更糟）。
- 置信度：prompt 要求返回 0~1；`switch` 且 `confidence < 阈值(如 0.6)` → 走 D2 的「先确认」。
- 反伪造/越权：分诊器只分类，不执行；`targetIntent` 仅限本期已支持集合。

---

## 8. 复用资产

| 资产 | 位置 | 用途 |
|---|---|---|
| 11 个意图谓词 | `content-loop/intents.ts` | 规则层 + 各阶段解析（全部现成，0 改动） |
| `clarifyOrPlan` | `channels/clarify-or-plan.ts` | idle 兜底（不变）；分诊器 prompt 可借鉴其 planner 结构 |
| `recognizeIntent` | `agent/intent-recognition.ts` | 分诊器 prompt 设计参考（不直接调，避免重负载） |
| `getLanguageModel`/`getDefaultModel` | `agent/model-router` | 分诊器调模型 |
| `updateSession` | `dal/channel-sessions` | 暂存/恢复/复位 |

---

## 9. 文件清单

**新增**
- `src/lib/channels/content-loop/intent-classify.ts` — `classifyInPhase` LLM 分诊器 + 类型
- （测试）`intent-classify.test.ts`、扩 `intents.test.ts`（`isResumePrevious`）、扩 orchestrator 测试

**改动**
- `src/lib/channels/content-loop/intents.ts` — 加 `isResumePrevious`
- `src/lib/channels/gateway.ts` — 阶段锁前前置 `isExitLoop`/`isResumePrevious`/`isHotTopicIntent`（`isGreeting` 已在）
- `src/lib/channels/content-loop/orchestrator.ts` — 各活跃阶段 fallthrough 处接 `classifyInPhase` + switch/capability_todo/clarify 分支 + parkedContext 暂存/恢复
- `src/db/schema/channel-sessions.ts` — `ContentLoopContext` 加 `parkedContext?`（jsonb 内嵌，无迁移）

---

## 10. 错误处理与边界
- 分诊器异常/超时 → 降级 `continue`（现有行为），不阻断、不答非所问加剧。
- `switch` 低置信 → 先确认，避免误切。
- parked 只一层；恢复时若 parkedContext 缺失 → 友好提示「没有可恢复的上一篇」。
- 多租户：分诊器与暂存均按会话/org 隔离（沿用现有 channelCtx）。
- IM webhook 超时：分诊在异步 step 之外的同步路由里，但只在 fallthrough 触发、单次小模型调用（~1s），可接受；若担心，可先同步回「🤔 在想…」再异步定夺（本期默认同步，留作优化项）。

## 11. 测试策略
- **单测**：`classifyInPhase` 四类输出（mock 模型返回各 JSON）；异常→降级 continue；`isResumePrevious` 谓词正/反例。
- **阶段动作不回归**：drafting 的「改导语」仍走 revise（分诊判 continue）；hot_list 的「选第2个」仍走 parseSelection（不触发 LLM）。
- **核心场景**：drafting 收「今天寒潮立项做成片」→ 分诊判 capability_todo → 回「在建设中」、**不**改稿、**不**切；收「写一篇关于AI的稿」→ switch → 暂存+切+面包屑；「回到上一篇」→ 恢复。
- **验证**：`tsc --noEmit` + `npm run build` + 相关 `vitest`（遵守 [[commit-requires-passing-tests]]）。

## 12. 风险与权衡
- **分诊误判**：LLM 把「改稿」误判「新任务」→ 用 D2 低置信确认 + 降级 continue 兜底；prompt 给足阶段上下文降低误判。
- **延迟**：仅 fallthrough 单次小模型调用；绝大多数消息不触发。必要时「先回在想…再异步」。
- **能力词覆盖**：capability_todo 靠语义判而非穷举词表，避免漏；埋点统计真实需求热度，反哺 Phase 2 排序。
- **暂存语义**：只一层 parked，避免状态爆炸（守 [[voice-content-loop-design]] 的「不把复杂塞进一个结构」精神）。

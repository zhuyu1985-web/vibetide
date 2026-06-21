# IM 规划器重建 Design

## Summary

修复 IM 机器人「澄清/计划」大脑的根因问题。探针实测（真 DeepSeek + 真 DB，华栖云传媒 org / 13 工种）证实：

| 输入 | 现状 conf | 现状判定 | 应该 |
|---|---|---|---|
| 帮我写点东西 | 0.65 | **execute**（编空洞步骤） | 澄清 |
| 写篇稿子 | 0.7 | **execute** | 澄清（无主题） |
| 写一篇AI行业的深度稿 | 0.85 | execute（**单步笼统**） | execute（多步真实计划） |
| 抓今天的科技热点 | general_chat 0.5 | **clarify** | execute（trending） |

三个根因，**都在底层意图层 `recognizeIntent`，不在 Phase 1a/1b 代码里**：
1. clarify-vs-execute 判定靠 `recognizeIntent` 自评 confidence 过 0.6——信号噪声大、对模糊请求过度自信，从不检查"有没有具体主题"。1a 的 slot-filling 澄清基本是死代码。
2. `recognizeIntent` 是「对话中心执行路由器」，prompt"选最少技能组合"，写稿请求只产 1 个笼统步骤，喂给 `formatPlanCard` 渲染出空话。
3. 清晰检索请求（抓热点）被误判 general_chat → 被澄清门拦下。

**方案**：把 `clarifyOrPlan` 的内核从「复用 recognizeIntent + 后置 confidence 门」换成「一个**专为 IM 设计的规划 prompt**，自己显式判断 clarify-vs-execute 并产**自适应深度**的真实计划」。对外签名/返回类型不变，gateway 与 Phase 1a/1b 全部代码、测试、执行下游均不动。

## Scope

In scope：
- 重写 `src/lib/channels/clarify-or-plan.ts` 的 `clarifyOrPlan` 实现（新 prompt + 单次结构化 LLM 调用 + 解析校验）。签名 `clarifyOrPlan(orgId, session, message): Promise<ClarifyOrPlanResult>` 与返回类型 `{action:"clarify",question} | {action:"execute",summary,steps}` **不变**。
- 从 `intent-recognition.ts` **导出** `buildSkillCatalog` / `buildEmployeeCatalog` / `isGreeting`（纯函数，供规划器复用，不改 `recognizeIntent` 行为）。

Out of scope：
- 不改 `recognizeIntent`（对话中心继续用）。
- 不改 gateway、Phase 1a（confirming 卡）、Phase 1b（取消）、执行下游（`materializeAdHocMission` / `startChannelMission`）。
- 不引入 pgvector / 结构化参数 slot schema / 多 LLM 串联（YAGNI，单次调用足够）。

## 新规划器：决策逻辑

`clarifyOrPlan` 新流程：

1. **问候快路径**：`isGreeting(message)`（复用）→ 直接 `{action:"clarify", question:"你好！想让我帮你做什么？"}`，不调 LLM。
2. 拼 `fullMessage`（`session.contextTurns` + 最新 message，与现状一致）。
3. `loadAvailableEmployees(orgId)` → 员工/技能目录（复用 `buildEmployeeCatalog` / `buildSkillCatalog`）。
4. **单次 LLM 调用**（generateText + JSON.parse，与 recognizeIntent 同款，对 DeepSeek 兼容性最稳；temperature 0.2 / maxOutputTokens 1024 / 15s 超时）。新 prompt 见下。
5. **解析 + 校验**（确定性）：
   - JSON 解析失败 / `needClarify` 非布尔 → 当作 clarify 兜底。
   - `needClarify === true` → `{action:"clarify", question: q || "能再具体说说你想做什么吗？"}`。
   - `needClarify === false` → 校验 steps：过滤非法 `employeeSlug`（不在目录）+ 非法 `skills`（不在 `getBuiltinSkillSlugs()`）；缺失 `employeeName` 用目录 nickname 回填。
     - 校验后 steps **非空** → `{action:"execute", summary, steps}`。
     - 校验后 steps **为空** → **退回 clarify**（`"能再具体说说要做什么吗？"`）。**绝不像旧 recognizeIntent 那样 fabricate 一个空洞步骤。**

> 关键纪律：决策（clarify vs execute）由 **prompt 显式判断**，不再读 confidence。校验层只做"合法性过滤 + 空则退回 clarify"，不补造步骤。

## 新 Prompt（规划器的心脏）

system：
```
你是 IM 群里的任务规划助手。基于对话历史和最新消息，判断并只输出 JSON。

## 第一步：判断信息是否足够开工
- 写作/内容创作类（写稿/推文/文案/脚本/笔记等）：必须有【具体主题或对象】。
  "帮我写点东西""写篇稿子""做个内容""随便写写" —— 没有具体主题 → 信息不足。
- 检索/热点/搜索类（抓热点、搜某关键词进展、查某网页）：动作+对象明确即可，通常足够。
- 数据分析/审核/发布类：对象明确即可。
信息不足 → { "needClarify": true, "question": "<一句简洁中文，问最关键缺失的 1 项；写作类优先问主题，再问篇幅/风格/渠道>" }

## 第二步：信息足够 → 产出【自适应深度】执行计划
{ "needClarify": false, "summary": "<一句话方案>", "steps": [...] }
- 步数按复杂度自适应：发通知/简单改写 1-2 步；常规写稿 2-3 步；深度稿/系列/多平台 3-4 步。
  不为凑步数注水，也不要把复杂任务压成一步。
- 内容创作典型分解（按需取舍）：① 联网搜集资料 ② 拟提纲 ③ 撰写正文 ④ 配图。
- 每个 step 选技能最匹配的工种员工，绑该步所需技能，taskDescription 写成人看得懂的一句话。

## 技能/检索路由（重要）
- "热点/热榜/热搜/今天最火/各平台在讨论什么" → 必须用 trending_topics（实时热榜），不要 web_search。
- "某关键词最新进展/全网怎么报道 XX" → web_search。
- "某网页/URL 正文" → web_deep_read。

## 技能目录
{SKILL_CATALOG}
## 员工
{EMPLOYEE_CATALOG}

只输出 JSON（不含 markdown）：
{ "needClarify": true|false, "question": "...", "summary": "...", "steps": [{"employeeSlug":"","employeeName":"","skills":[],"taskDescription":""}] }
```
user：`fullMessage`。

## Components

新建：无（重写既有文件 + 导出复用）。

改动：
- `src/lib/channels/clarify-or-plan.ts` — 重写 `clarifyOrPlan` 实现（新 prompt + 解析校验）。删除旧的 `CONFIDENCE_THRESHOLD` 门与对 `recognizeIntent` 的调用。
- `src/lib/agent/intent-recognition.ts` — `export` `buildSkillCatalog`、`buildEmployeeCatalog`、`isGreeting`（仅加 export 关键字，零行为变更）。

复用：`loadAvailableEmployees`、`getBuiltinSkillSlugs`、`getLanguageModel`、`IntentStep` 类型、`ClarifyOrPlanResult` 类型。

不动：`recognizeIntent`、gateway、Phase 1a/1b、`materializeAdHocMission`、`startChannelMission`。

## Error Handling

- LLM 抛错/超时（15s）→ **向上抛**，由 gateway 既有 try/catch 回 `"系统忙，请稍后再试。"`。**规划器绝不在出错时 fabricate execute。**
- LLM 成功但 JSON 不合法 / `needClarify` 缺失 → clarify 兜底（不抛、不 execute）。
- `needClarify:false` 但 steps 校验后为空 → clarify 兜底（不 execute）。
- 问候语 → 快路径 clarify，不调 LLM。
- 多轮：用户答完澄清后，`fullMessage` 含主题 → 规划器判够 → execute（与 confirming 流自然衔接）。

## Verification

**双层验证**：

1. **单测（确定性，mock LLM）** `clarify-or-plan.test.ts`（新建或扩展）：
   - mock `loadAvailableEmployees` 返回固定目录、mock `ai` 的 `generateText` 返回构造 JSON。
   - 用例：`needClarify:true` → clarify；合法 steps → execute（summary/steps 透传）；含非法 employeeSlug/skill → 被过滤；`needClarify:false` 但 steps 校验后空 → 退回 clarify；JSON 解析失败 → clarify 兜底；`generateText` 抛错 → 向上抛（gateway 兜）；问候语 → 快路径 clarify 不调 LLM。
2. **经验回归（真 LLM，探针）** `scripts/_im-chain-probe.ts` 重跑同一批输入，断言（人工核对或脚本断言）：
   - "帮我写点东西""写篇稿子""随便写写""我想做个内容" → **clarify**。
   - "写一篇AI行业的深度稿" → execute，steps **2-4 步**且真实（含搜集/撰写等）。
   - "抓今天的科技热点" → **execute**（trending_topics）。
   - "成都美食小红书800字配3图" → execute 多步。
   - 多轮补全 → execute。
3. **（Ultracode）穷尽验证 workflow**：扇出更大一批输入（不同任务类型/模糊度/多轮/边界）跑重建后的规划器，每条决策由评审 agent 判「clarify-vs-execute 对不对 + 计划深度合不合理」，汇总打分。
4. `tsc --noEmit` + `build` + `npm test` 全过。

## Rollout

1. 导出 `intent-recognition.ts` 的 3 个纯函数。
2. 重写 `clarify-or-plan.ts`（TDD：先写 mock-LLM 单测，再实现）。
3. 探针回归（真 LLM）确认四类输入行为正确。
4. workflow 穷尽验证（Ultracode）。
5. 全量 tsc/build/test + 终审 + 合并 main。
6. 端到端手测（钉钉）：重跑用户那条主线（帮我写点东西→澄清；AI深度稿→真实多步卡；抓热点→执行）。

## Future

- 结构化参数 slot 系统（按任务类型定 required/optional，计划卡显式列参数）。
- 规划器产出的 plan 与执行 task 的双向校验（plan step ↔ mission task 一致性断言）。
- 一键跟进（Phase 1c）：lastResult 上下文喂回规划器做"换角度/配图/发布"。

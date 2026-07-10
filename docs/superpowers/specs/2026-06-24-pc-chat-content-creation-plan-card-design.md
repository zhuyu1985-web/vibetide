# PC 对话框内容生产「创作计划卡」体验改造 + 钉钉热点卡死修复

- **日期**：2026-06-24
- **状态**：设计已与 owner 对齐，待 spec 评审
- **作者**：zhuyu（与 Claude 协作 brainstorm）
- **关联记忆**：[[cowork-transformation]]、[[voice-content-loop-design]]、[[inngest-dev-mode-cloud-fallback]]、[[aigc-provider-kie-ai]]

---

## 1. 背景与问题

用户在两条入口做内容生产测试，都不满意：

### 1.1 钉钉：永久卡在"热点还在抓取中"（Bug）

钉钉里 `@bot 帮我写一篇今天的热点稿件` 后，机器人反复回 `热点还在抓取中，稍等几秒再选。`，永不解锁。

根因（已核实）：内容闭环编排器 `src/lib/channels/content-loop/orchestrator.ts:192-194` 的 `hot_list` 阶段，只要 `loopContext.topicCandidates` 为空就回这句。候选只由异步 Inngest 步骤 `fetch_topics`（`src/inngest/functions/content-loop-step.ts:311-341`）在抓榜成功后写回。问题在于 **`hot_list` 是一个没有失败转移、没有超时转移的状态**：

- 抓榜失败/超时（TopHub 不可达，或 `TRENDING_API_KEY` 未配 → `src/lib/agent/tool-registry.ts:999` 直接 throw），`updateSession(topicCandidates)` 永不执行，候选永远为空。
- 失败分支只 `pushCard(错误信息)` 后 return（`content-loop-step.ts:317-319`），**不回滚 `scenarioPhase`**；`contentLoopStepFailureHandler`（`content-loop-step.ts:684-699`）也只补推一张错误卡。
- 于是 `scenarioPhase` 永远停在 `hot_list`，用户下一条消息继续命中 :194。:194 的"稍等"是**被动**的——要用户主动再发消息才会重读 DB，且没有计数/退避/自动重试。
- 唯一逃生口是 `isRegenerate`（说"重新获取"，:188）或 `isExitLoop`（说"退出"，:173），但 UI 完全没提示，用户不可能知道。

叠加 [[inngest-dev-mode-cloud-fallback]]：本地若没起 Inngest dev server / 没配 `INNGEST_DEV=1`，`fetch_topics` 事件根本没人消费，必然空候选。

### 1.2 PC 对话框（cowork 对话中心）：体验单薄（UX）

> **目标面已校正（规划期追踪发现）**：用户测试的"PC 对话框"是 **cowork 对话中心**（`/cowork/[conversationId]`，首页输入框 `home-workspace-client.tsx:53` 也 `startCoworkConversation` 跳转到这里）。它**不走** `/api/chat/intent-execute` + `useChatStream`（那是次要/遗留的 `src/components/home/embedded-chat-panel.tsx`，本次不动）。cowork 真实链路是 **server action `submitCoworkMessage`（`src/app/actions/cowork-submit.ts`）→ `recognizeIntentForOrg` → `startAdHocMission` → mission 引擎 → `missionArtifacts`**。

用户在对话框输入"帮我写一篇今天的热点新闻稿件"，列出 4 点不满，全部验证属实（对 cowork 真实链路）：

1. **不反问校对**：`submitCoworkMessage:59-63` 拿到 `intent` 后**直接 `startAdHocMission`**，从不询问"写哪个热点 / 方向 / 字数 / 风格 / 用途 / 发哪个渠道"。整个 cowork 链路没有任何 slot-filling。
2. **产出不可编辑（不在稿件库）**：mission 产出的正文**只落 `missionArtifacts` 表**（`mission-executor.ts:1787`），由 `artifact-preview-workspace.tsx` 的 TipTap 编辑 `missionArtifacts.content`（`saveCoworkArtifactDraft`），**与 `articles` 稿件库完全隔离，cowork 里没有任何 `/articles/[id]` 链接**。`articles` 表只有当 mission 显式跑 `archive_to_drafts` 下游步骤时才落——content_generate 默认不落。这正是"不是稿件库格式、不能用编辑器编辑"的根因。
3. **单发体验薄**：意图 → 直接起 mission → 产物气泡，无"下笔前校对"、无可编辑稿件库草稿、无对话内迭代。
4. （隐含）**渠道无关**：用户明说关心"发微信还是小红书"，但现链路完全不区分渠道。

> 旁注：`src/lib/dal/cowork-conversations.ts:25` 的 `AppendMessageInput.kind` 已预留 `"plan_card"` 取值（schema 留了钩子但从未被实例化/渲染）——本方案正好把它用起来。

### 1.3 关键认知

用户想要的能力，**钉钉侧内容闭环基本都已造好且成熟**：`clarify-or-plan` 反问、`archive_to_drafts` 落库、`reviseDraft` 改稿、`appendArticleVersion` 版本链、`trending_topics` 取榜。PC 对话框是"穷亲戚"。而且 PC 端**额外**有钉钉没有的优势——稿件库富文本编辑器 + 编辑器内置 AI 改稿助手（`src/app/(dashboard)/articles/[id]/features/ai-chat/`）。

> **结论：本次改造主要是"接线 + 加一张计划卡"，不是造轮子。**

---

## 2. 目标 / 非目标

### 2.1 目标

- **G1（P0 Bug）**：钉钉 `hot_list` 卡死有确定的失败/超时出口，用户永远不会无声卡住。
- **G2**：PC 对话框对"写稿类"请求，出稿前弹一张**创作计划卡**让用户校对（主题/角度/体裁/渠道/字数/用途/配图），可改可确认。
- **G3**：确认后产出**直接落稿件库为可编辑草稿**，对话给预览 + 一键进编辑器。
- **G4**：出稿后支持对话内"说一句改一版"的轻量改稿（复用 `reviseDraft`），同步回稿件库 + 版本链。
- **G5**：单渠道适配——目标渠道驱动字数/风格/格式默认。

### 2.2 非目标（YAGNI，明确不做）

- 对话内"选热点→选视角"多步编排（那是钉钉闭环模式，PC 用计划卡一步到位）。
- 对话内送审/发布编排（PC 有审核中心 + 发布流，职责不重叠）。
- **多渠道并行出多版** / **跨渠道一键改写**（owner 选定单渠道出一篇）。
- 视频/播客（`media_production` 意图）走计划卡——本次只覆盖 `content_creation`。
- 海外真发。

---

## 3. 锁定的产品决策（brainstorm 输出）

| # | 决策点 | 选定 |
|---|---|---|
| D1 | 改造档位 | **档2 · 计划确认增强**（反问 + 计划卡 + 落库 + 进编辑器） |
| D2 | 触发门 | 仅 `intentType === "content_creation"` 弹计划卡；其余意图行为不变 |
| D3 | 计划卡字段 | 选题(热点) / 角度 / 体裁 / 目标渠道 / 字数 / 用途(选填) / 配图开关；全部 AI 预填、可改 |
| D4 | 选题(热点)解析 | **AI 自动预选今日热榜 Top1 + 可下拉换**（换列表 / 直接打字说主题） |
| D5 | 出稿后落库 | 生成同时调 `archive_to_drafts` 落 `articles` 草稿，回执带 `articleId` |
| D6 | 改稿路径 | 编辑器为主 + 对话内"说一句改一版"快捷入口（复用 `reviseDraft`） |
| D7 | 渠道适配 | 单渠道，仅驱动字数/风格/格式默认，出一篇 |
| D8 | 钉钉 Bug | **并入本方案，作 P0 先修** |
| D9 | 出稿引擎（规划期定） | **轻量直产**——计划卡确认后专用 server action 直接 检索→写稿→`archive_to_drafts` 落库，**不进 mission 引擎**；mission 路径继续服务其它多步意图 |
| D10 | 目标面（规划期校正） | **cowork 对话中心**（`submitCoworkMessage` 链路）；intent-execute / 首页 embedded-chat-panel 本期不动 |

---

## 4. 端到端体验（目标流程）

```
用户：帮我写一篇今天的热点新闻稿件
  │
  ├─（意图识别 = content_creation）
  ▼
小策：已读到今天的全网热榜，帮你拟了份创作计划，确认或改一改 👇
  ┌─────────── 创作计划卡 ───────────┐
  │ 选题  🔥[今日Top1]      换一个▾  │  ← 可下拉换/打字
  │ 角度  深度解读：行业影响    改✎  │
  │ 体裁  [新闻消息] 深度评论 大众…  │
  │ 渠道  [微信公众号] 小红书 官网…  │  ← 单选，驱动默认
  │ 字数  600 [1000] 1500 2000       │
  │ 用途  （选填）                   │
  │ 配图  ◯——                       │
  │ [✅ 开始撰写] [✏️ 我再改改] [取消] │
  └──────────────────────────────────┘
  │（点"开始撰写"，带确认后的计划参数）
  ▼
小策：✓ 已按计划检索今日真实资料   ✓ 已撰写初稿并存入稿件库
  ┌─────────── 初稿已生成 · 已存入稿件库·草稿 ───────────┐
  │ 《标题》  约1050字 · 新闻消息 · 公众号               │
  │ 导语…正文…（预览，可展开全文）                       │
  │ [📝 打开编辑器精修] [🔄 换角度重写] [📤 提交审核] 🖼配图 │
  └──────────────────────────────────────────────────────┘
  │
  ├─ 用户在对话里："导语再短一点，加个数据"  → reviseDraft(articleId) → 同步回稿件库 + 版本 v2
  └─ 或点"打开编辑器精修" → /articles/{articleId}
```

---

## 5. 架构与数据流（cowork 轻量直产，**不进 mission 引擎**）

**决策 D9（规划期新增）**：cowork 的 content_creation 出稿走**轻量直产**——计划卡确认后由专用 server action 直接 检索→写稿→落库，**不调 `startAdHocMission`**。mission 引擎继续服务其它多步意图。理由：契合 §2.2"不做多步编排"，且一步落进可编辑稿件库；用 mission 引擎写单篇是杀鸡用牛刀且产物落在 missionArtifacts 而非 articles。

### 5.1 全链路（server action 驱动，非 SSE；与 cowork 现有形态一致）

```
submitCoworkMessage(convId, text)                       [改] cowork-submit.ts
  → 落 user 消息
  → recognizeIntentForOrg → intent
  → 若 intent.intentType === "content_creation":         [新增分支，先于 startAdHocMission]
       buildCreationPlan(intent, text, orgId)            [新] 预填：trending Top1 + 角度 LLM + 渠道默认
       appendMessage(kind="plan_card", meta={ plan })    复用已预留的 plan_card kind
       return { ok, kind:"plan" }                        ← 不起 mission
  → 否则维持现状（steps>0 → startAdHocMission；general_chat → 简单回复）

[客户端] conversation-thread.tsx 渲染 kind==="plan_card" → <CreationPlanForm>（可改可确认）

confirmCreationPlan(convId, plan)                        [新] server action（用户点"开始撰写"）
  → 落一条"撰写中"占位（可选）
  → 检索真实资料（trending/web_search by plan.topic）
  → content_generate(outline 含渠道适配, style, maxLength)
  → archive_to_drafts({ articles:[{title,body,language:"zh",sourceTopicId}],
                        initialStatus:"draft", organizationId })  → firstArticleId
  → appendArticleVersion(articleId, changeKind="initial")
  → (若 plan.illustrate) 触发 AIGC 题图（异步）
  → appendMessage(kind="draft_result", meta={ articleId,title,wordCount,channel })
  → return { ok, articleId }

[客户端] conversation-thread.tsx 渲染 kind==="draft_result" → <DraftResultCard>
         （预览 + 「打开编辑器」深链 /articles/{articleId} + 换角度重写 + 提交审核 + 配图态）

reviseDraftInConversation(convId, articleId, instruction) [新] server action（对话内"说一句改一版"）
  → 读 article → reviseDraft(body,title,instruction,language) → 写回 articles + appendArticleVersion("rewrite")
  → appendMessage(kind="draft_result", meta 更新)
```

### 5.2 触发门 & 消息类型

- 触发门：`submitCoworkMessage` 里判 `intent.intentType === "content_creation"`（D2）。其余意图分支**一字不改**。
- 新增 `message.kind`：`"draft_result"`（`plan_card` 已存在于 `cowork-conversations.ts:25` 的联合类型，只需补 `"draft_result"`）。两者都靠 `message.meta`（jsonb）携带结构化数据，**无需新建表**。
- 渲染插入点：`src/components/cowork/conversation-thread.tsx` 的 `MessageBubble`，在 `message.kind === "mission_card"` 分支（:274）之后加 `plan_card` / `draft_result` 两个分支（参照 mission_card 写法）。

### 5.3 `buildCreationPlan`（预填，不写稿）

新模块 `src/lib/cowork/creation-plan.ts`：
1. 选题：`invokeToolDirectly("trending_topics", { mode:"hot", limit:10 }, { organizationId })` 取 `topics[0]` 作 Top1 + 前 N 条作"换一个"备选。返回的 `topics` item 形如 `{ platform, rank, heat, title, url }`（**无 topicId**，故 `topic.topicId` 多为空，`sourceTopicId` 可不传）。失败/空 → `hotlistAvailable:false`，选题降级为"请输入主题"。
2. 角度：一次轻量 `generateText`（≤300 tokens）据选题给 1 句切入点。
3. 体裁/渠道/字数：取 §8 渠道默认。
4. 返回 `CreationPlan`（§6），塞进 `plan_card` 消息的 `meta.plan`。

> 注：抓榜是 HTTP，可能慢。`submitCoworkMessage` 是 server action（已是 await 形态，非 SSE），抓榜在动作内同步完成即可；若要更顺滑可后续异步化，本期同步即可（一次 plan 一次抓榜，可接受）。

### 5.4 出稿 server action `confirmCreationPlan`

`src/app/actions/cowork-content-creation.ts`（新）：
- 用 `plan` 构造：检索 query = `plan.topic.title`；`content_generate` 的 `outline` 注入"热点 + 角度 + 渠道适配提示（§8）+ 字数"，`style` 取渠道映射，`maxLength = plan.wordCount + 余量`。
- 落库：`invokeToolDirectly("archive_to_drafts", { articles:[{ title, body, language:"zh", summary? }], initialStatus:"draft", organizationId }, { organizationId, operatorId:user.id })`。⚠️ **必须显式传 `initialStatus:"draft"`**——该工具默认 `"approved"`（tool-registry.ts:1868）。取返回 `result.firstArticleId`。
- `appendArticleVersion({ articleId, language:"zh", title, body, wordCount, changeKind:"initial" })`。
- 反伪造：沿用 cowork 现有真实数据约束精神——检索为空则如实告知、不补填（写进 content_generate 的 outline 约束）。
- 失败降级：`archive_to_drafts` 没拿到 `firstArticleId` → draft_result 卡降级为"正文已生成但暂未入库，可重试"，不丢正文。

### 5.5 对话内"说一句改一版"

`draft_result` 出现后，会话内的 `articleId` 记在最近一条 draft_result 消息的 `meta` 里（客户端把它随 `reviseDraftInConversation(convId, articleId, instruction)` 回传，**不依赖 channel_sessions.lastArticleId**——那是钉钉侧字段，cowork 用消息 meta 自己追踪）。server action：读 article → `reviseDraft(body,title,instruction,language)` → 写回 articles（version+1）+ `appendArticleVersion("rewrite", changeInstruction=instruction)` → 落新 `draft_result`。

> ⚠️ 精度（避免规划误读）：`content-loop-step.ts:139` 现有 `reviseDraft(body, title, instruction, language)` 是**纯函数**——入参是已取出的稿件文本，**不接 articleId、自身不读写 DB**，"读 article / 落库 / 写版本"由调用方做（钉钉调用方已是这套，见 content-loop-step.ts:431-484）。抽到 `src/lib/content/revise.ts` 时**保持该纯签名**，cowork 与钉钉各自负责 DB 读写，避免复制 `reviseDraft` / `splitTitleBody` / `deriveTitle`。改稿意图判定：cowork 没有现成 detector，需写一个轻量判定（有 draft_result 上下文时，非命令式自由文本即视作改稿指令，参照 orchestrator.ts:275 的 fallthrough）。

---

## 6. 数据结构

`CreationPlan` 在 `plan_card` 消息的 `meta.plan` 里往返；`draft_result` 的 `meta` 携带 `{ articleId, title, wordCount, channel }`。

```ts
// src/lib/cowork/creation-plan.ts（新增）
export interface CreationPlanTopicOption {
  topicId?: string;
  title: string;
  heat?: string;
  source?: string;
}

export interface CreationPlan {
  // 选题（D4：预选 Top1 + 备选）
  topic: { title: string; topicId?: string };
  topicOptions: CreationPlanTopicOption[]; // 供"换一个"下拉
  topicFromHotlist: boolean;               // false = 用户自填主题

  angle: string;                            // 角度/切入点
  genre: "news" | "commentary" | "explainer" | "xiaohongshu" | "script"; // 体裁
  channel: "wechat_mp" | "xiaohongshu" | "official_app" | "douyin";       // 单选
  wordCount: number;                        // 目标字数
  purpose?: string;                         // 用途（选填）
  illustrate: boolean;                      // 配图开关

  // 元信息
  hotlistAvailable: boolean;                // 热榜服务是否可用（降级提示用）
}
```

---

## 7. 文件清单（新增 / 改动）

**新增**
- `src/lib/cowork/creation-plan.ts` — `CreationPlan` 类型 + 默认值/渠道适配规则 + `buildCreationPlan()`
- `src/app/actions/cowork-content-creation.ts` — server actions：`confirmCreationPlan()` + `reviseDraftInConversation()`
- `src/lib/content/revise.ts` — 从 content-loop-step 抽取的共享 `reviseDraft`/`splitTitleBody`/`deriveTitle`
- `src/components/cowork/creation-plan-form.tsx` — 计划卡表单组件（可改可确认）
- `src/components/cowork/draft-result-card.tsx` — 出稿结果卡（预览 + 进编辑器深链 + 动作）

**改动**
- `src/app/actions/cowork-submit.ts` — `submitCoworkMessage` 加 content_creation 分支（buildCreationPlan + 落 plan_card，先于 startAdHocMission）
- `src/lib/dal/cowork-conversations.ts` — `AppendMessageInput.kind` 联合补 `"draft_result"`（`plan_card` 已存在）
- `src/components/cowork/conversation-thread.tsx` — `MessageBubble` 加 `plan_card` / `draft_result` 两个渲染分支（参照 `mission_card`:274）
- `src/inngest/functions/content-loop-step.ts` — 引用共享 `reviseDraft`/`splitTitleBody`/`deriveTitle`（去重，行为不变）
- `src/lib/channels/content-loop/orchestrator.ts` + `content-loop-step.ts` — `hot_list` 失败/超时转移（P0）

> **明确不动**：`src/app/api/chat/intent-execute/route.ts`、`src/hooks/use-chat-stream.ts`、`src/components/home/embedded-chat-panel.tsx`（次要/遗留面，本期不改；若日后该面仍在用，可复用同一批新组件，另起 follow-up）。

> 注意遵守设计系统：所有可点击元素**不带边框**；按钮用 `<Button>` variant、不 hand-roll；弹层内可滚动列表用固定高度 `h-X` 非 `max-h-X`；UI 文案全中文。

---

## 8. 渠道适配规则（单渠道，驱动默认）

| 渠道 | 默认体裁 | 默认字数 | 风格提示（注入 content_generate） |
|---|---|---|---|
| 微信公众号 | 新闻消息 | 1000 | 客观、有小标题、段落完整 |
| 小红书 | 种草/解读 | 400 | 口语化、emoji、分点、话题标签 |
| 官网/App | 新闻消息 | 1200 | 正式、规范、可含信源 |
| 抖音 | 口播脚本 | 500 | 短句、口播节奏、开头抓人 |

用户在卡上改任一字段则以用户值为准（默认仅作初值）。

---

## 9. P0 钉钉 Bug 修复（先做）

**目标**：`hot_list` 永不无声卡死。

1. **失败/超时转移**（`orchestrator.ts` + `content-loop-step.ts:311-341,684-699`）：
   - `fetch_topics` 失败/超时 → 回滚 `scenarioPhase = 'idle'`（**选定此最小改动方案**，不新增 `hot_list_failed` 态——避免给状态机加态），错误卡明确写："抓取失败，回复『重新获取』重试，或『退出』结束"。
   - `contentLoopStepFailureHandler` 同样回滚 phase，不只是补推卡。
2. **被动提示加计数**（`orchestrator.ts:192-194`）：`loopContext` 记 `hotlistWaitCount`，每次空候选 +1；超过阈值（如 3）主动提示"抓取似乎失败了，回复『重新获取』或『退出』"。
3. **热榜服务优雅降级**（`tool-registry.ts:999`、`trending-api.ts`）：`TRENDING_API_KEY` 缺失 / TopHub 不可达时不 throw 死，返回明确"热榜服务未配置/不可达"，由上层回滚 idle + 提示，而非把失败吞进"稍等"。

> 该项改动小、最痛，作为第一阶段独立落地、独立验证。

---

## 10. 复用资产清单（成熟，直接接线）

| 资产 | 位置 | 用途 |
|---|---|---|
| `archive_to_drafts` | `tool-registry.ts:1842` | 落 articles 草稿，返回 articleId |
| `reviseDraft` / `splitTitleBody` | `content-loop-step.ts:139,117`（抽共享） | 对话内改稿 |
| `appendArticleVersion` | `src/lib/dal/article-versions.ts` | 版本链留痕 |
| `trending_topics` | tool-registry | 取今日热榜 Top1 + 列表 |
| `content_generate` | tool-registry | 写稿 |
| 稿件编辑器 + 内置 AI 助手 | `/articles/[id]`、`features/ai-chat/` | 精修 |
| AIGC 文生图 | [[aigc-provider-kie-ai]] | 配图 |

---

## 11. 错误处理与边界

- 热榜不可用 → 计划卡选题字段降级为"请输入主题"，`topicFromHotlist=false`，不阻塞其余字段。
- `archive_to_drafts` 失败 → 结果卡降级：仍展示稿件正文，但提示"暂未存入稿件库，可复制或重试"，不丢内容。
- 用户在计划卡点"取消" → 回到普通对话，不产出（不落 plan_card 后续动作）。
- 反伪造：`confirmCreationPlan` 的 `content_generate` outline 注入"只用真实检索资料、检索空则如实说明、禁止补填"约束，沿用项目既有反伪造精神。
- 多租户：所有 server action 走 `requireAuth` + `getCurrentUserOrg`，`buildCreationPlan` / `archive_to_drafts` / 改稿均按 `organizationId` 隔离；`confirmCreationPlan`/`reviseDraftInConversation` 必须校验 `conversationId` 归属当前 org+user（参照 `submitCoworkMessage:48` 的 `getConversationById` 守卫）。

---

## 12. 测试策略

- **单测**：`CreationPlan` 默认值/渠道适配规则（genre/channel → style/maxLength/outline 映射）；`reviseDraft` 抽取后行为不变（迁移现有 content-loop 测试）；`buildCreationPlan` 在热榜空/失败时降级 `hotlistAvailable:false`。
- **P0 回归**：构造 `fetch_topics` 失败 → 断言 phase 回滚 idle + 错误卡含出口文案 + 计数提示；`TRENDING_API_KEY` 缺失 → 断言不 throw、优雅降级。
- **集成**：`submitCoworkMessage("写...热点稿")` → 断言落 `plan_card` 消息且未起 mission；`confirmCreationPlan(plan)` → 断言 `articles` 新增 `status='draft'` 行 + 落 `draft_result` 消息携带 articleId；`reviseDraftInConversation` → 断言 article version+1 + 新 article_version 行。
- **验证命令**：`npx tsc --noEmit` + `npm run build` + 相关 `vitest run`（遵守 [[commit-requires-passing-tests]]）。

---

## 13. 里程碑（粗）

1. **阶段 0（P0 Bug）**：钉钉 `hot_list` 失败/超时转移 + 计数提示 + 热榜降级。独立 commit + 验证。
2. **阶段 1（共享改稿 + 出稿内核）**：抽 `src/lib/content/revise.ts`（content-loop 改引用，行为不变）；`CreationPlan` 类型 + `buildCreationPlan` + `confirmCreationPlan`（落 `archive_to_drafts` draft + `draft_result` 消息）。
3. **阶段 2（计划卡接入对话）**：`cowork-conversations.ts` 补 `draft_result` kind；`submitCoworkMessage` content_creation 分支落 `plan_card`；`conversation-thread.tsx` 渲染 `plan_card`/`draft_result`；`CreationPlanForm` + `DraftResultCard` 组件。
4. **阶段 3（迭代 + 配图）**：`reviseDraftInConversation` + 对话内改稿识别；配图开关接 AIGC 文生图。

（详细分步留给下面的任务拆解。）

---

## 14. 风险与权衡

- **抓榜延迟拖慢计划卡**：用骨架渲染 + 选题字段单独 loading 化解。
- **意图误判**（非写稿被判 content_creation 弹了计划卡）：计划卡可"取消"低成本退出；必要时给 `intentType` 加置信门槛。
- **`reviseDraft` 抽取回归**：迁移钉钉现有测试守护。
- **职责边界**：坚持 §2.2 非目标，避免计划卡膨胀成第二个 mission DAG（违背 [[voice-content-loop-design]] 的"7 步不塞进一个 DAG"红线精神）。

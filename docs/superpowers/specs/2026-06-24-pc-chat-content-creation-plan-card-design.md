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

### 1.2 PC 对话框：体验单薄（UX）

用户在对话框输入"帮我写一篇今天的热点新闻稿件"，列出 4 点不满，全部验证属实：

1. **不反问校对**：`/api/chat/intent-execute/route.ts` 收到的是**已定好的** `intent.steps`，直接执行，从不询问"写哪个热点 / 什么方向 / 多少字 / 什么风格 / 什么用途 / 发哪个渠道"。现有唯一"确认"是 `src/components/chat/intent-bubble.tsx:263` 的 `IntentConfirmCard`，只能**删步骤**，不能填参数，且仅在 `confidence < 0.8` 时出现（`src/hooks/use-chat-stream.ts:384-395`）。
2. **产出不可编辑**：`intent-execute` 全程**不调 `archive_to_drafts`**，只 `streamText` 吐 markdown 累进 `fullAssistantOutput`（route.ts:224、:1048），结束后只 `notifyChatMessage()` 推 IM。产出从不落 `articles` 表 → 编辑器 `/articles/[id]` 必须命中 articles 一行否则 `notFound()` → "不能用编辑器编辑"。
3. **单发体验薄**：意图 → 步骤 → 一坨 markdown 就完，无"下笔前校对"、无落库、无迭代。
4. （隐含）**渠道无关**：用户明说关心"发微信还是小红书"，但现链路完全不区分渠道。

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

## 5. 架构与数据流

### 5.1 三段式（现两段，中间插一段）

```
现在： /api/chat/intent ─► /api/chat/intent-execute（吐 markdown，不落库）
改后： /api/chat/intent ─► 【新】/api/chat/plan ─► 计划卡(用户改+确认) ─► /api/chat/intent-execute（带 plan，落库）
```

### 5.2 客户端路由插入点

`src/hooks/use-chat-stream.ts:377-395` 的意图路由分支新增一支：

```
intentResult.intentType === "general_chat"  → 自由对话（不变）
intentResult.intentType === "content_creation" → 【新】拉创作计划 → 渲染 CreationPlanCard（不再按 confidence 自动执行）
其余意图（information_retrieval / deep_analysis / …）→ 维持现状（高置信自动执行 / 低置信 IntentConfirmCard）
```

新增 hook 状态：`pendingPlan: CreationPlan | null`（与 `pendingIntent` 并列）。计划卡 onConfirm → 走 `executeIntentFn`，body 多带 `plan` 字段。

### 5.3 服务端：`/api/chat/plan`（新增 route）

仅对 content_creation 调用，职责是**预填计划卡**（不写稿、不落库）：

1. 选题：调 `trending_topics`（mode=hot/platforms，复用 tool-registry）取今日 Top1 + 备选列表（供"换一个"下拉）。失败时返回"无热榜"状态，选题字段降级为"请直接输入主题"。
2. 角度：一次轻量 LLM（`generateText`，≤300 tokens）据选题给 1 个建议切入点。
3. 体裁/渠道/字数：给默认值（见 §8 渠道适配表）。
4. 返回 `CreationPlan`（见 §6）。

> 注：选题预选可能慢（HTTP 抓榜）。计划卡先用骨架占位渲染，选题字段单独 loading，避免整卡卡住——契合 D4"最少打断"。

### 5.4 服务端：`intent-execute` 改造

`src/app/api/chat/intent-execute/route.ts`：

- 入参新增可选 `plan?: CreationPlan`。当带 `plan` 时：
  - 用 `plan` 字段构造生成参数（替代/补充现有 `step.taskDescription` 与预抓逻辑）：选题 → 检索 query；体裁/字数/渠道 → `content_generate` 的 style/maxLength + 渠道适配提示。
  - 生成结束后，**强制调 `archive_to_drafts`**（`tool-registry.ts:1842`）落库，拿 `firstArticleId`。⚠️ 该工具默认 `initialStatus: "approved"`（tool-registry.ts:1868），G3 要的是**可编辑草稿**，故必须**显式传 `initialStatus: "draft"` + `organizationId`**，不能用默认值（否则会落成 approved 稿）。工具本身支持 draft，无需改工具。
  - 通过 SSE 新增事件 `draft-saved`（payload：`{ articleId, title, wordCount, channel }`），客户端据此渲染"初稿已生成"结果卡（含进编辑器深链）。
  - 若 `plan.illustrate` 为真，触发题图（复用 [[aigc-provider-kie-ai]] 现成 AIGC 文生图路径），异步回执。
- 不带 `plan` 时：行为完全不变（其余意图、旧调用方）。

### 5.5 对话内"说一句改一版"

出稿后，会话记住最近 `articleId`。用户后续自由文本若被识别为改稿意图（复用钉钉 `revise` 的判定思路），PC 路径：① 按 `articleId` 读 article → ② 调 `reviseDraft(body, title, instruction, language)` → ③ 写回 articles + `appendArticleVersion`（changeKind='rewrite'）→ ④ 回执新版预览。

> ⚠️ 精度（避免规划误读）：`content-loop-step.ts:139` 现有 `reviseDraft(body, title, instruction, language)` 是**纯函数**——入参是已取出的稿件文本，**不接 articleId、自身不读写 DB**，"读 article / 落库 / 写版本"由调用方做（钉钉调用方已是这套）。抽到 `src/lib/content/revise.ts` 时**保持该纯签名**，PC 与钉钉各自负责 DB 读写，避免复制 `reviseDraft` / `splitTitleBody`。

---

## 6. 数据结构

```ts
// src/lib/chat/creation-plan.ts（新增）
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
- `src/app/api/chat/plan/route.ts` — 预填计划卡
- `src/lib/chat/creation-plan.ts` — `CreationPlan` 类型 + 默认值/渠道适配规则
- `src/components/chat/creation-plan-card.tsx` — 计划卡组件（可改可确认）
- `src/components/chat/draft-result-card.tsx` — 出稿结果卡（预览 + 进编辑器 + 动作）
- `src/lib/content/revise.ts` — 从 content-loop-step 抽取的共享 `reviseDraft`/`splitTitleBody`

**改动**
- `src/hooks/use-chat-stream.ts` — 路由分支 + `pendingPlan` 状态 + 改稿识别
- `src/app/api/chat/intent-execute/route.ts` — 接 `plan` 入参 + 落库 + `draft-saved` 事件
- `src/app/(dashboard)/cowork/cowork-client.tsx`（及 `embedded-chat-panel.tsx`）— 渲染计划卡/结果卡
- `src/inngest/functions/content-loop-step.ts` — 引用共享 `reviseDraft`（去重）
- `src/lib/channels/content-loop/orchestrator.ts` — `hot_list` 失败/超时转移（P0）

> 注意遵守设计系统：所有可点击元素**不带边框**；按钮用 `<Button>` variant、不 hand-roll；弹层内可滚动列表用固定高度 `h-X` 非 `max-h-X`。

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
- 用户在计划卡点"取消" → 回到普通对话，不产出。
- 反伪造硬约束（`intent-execute` 现有 `hardConstraints`、空结果短路）继续生效，计划卡链路不得绕过。
- 多租户：`/api/chat/plan` 与落库均按 `organizationId` 隔离（沿用现有 `requireAuth` + orgId）。

---

## 12. 测试策略

- **单测**：`CreationPlan` 默认值/渠道适配规则；`reviseDraft` 抽取后行为不变（迁移现有 content-loop 测试）；计划卡 → intent-execute 参数映射。
- **P0 回归**：构造 `fetch_topics` 失败 → 断言 phase 回滚 + 错误卡含出口文案 + 计数提示；`TRENDING_API_KEY` 缺失 → 断言不 throw、优雅降级。
- **集成**：content_creation 意图 → plan → execute → 断言 articles 表新增草稿、SSE 发 `draft-saved`、editor 深链可打开。
- **验证命令**：`npx tsc --noEmit` + `npm run build` + 相关 `vitest run`（遵守 [[commit-requires-passing-tests]]）。

---

## 13. 里程碑（粗）

1. **阶段 0（P0 Bug）**：钉钉 `hot_list` 失败/超时转移 + 热榜降级。独立 commit + 验证。
2. **阶段 1（落库内核）**：`reviseDraft` 抽共享；`intent-execute` 接 `plan` + `archive_to_drafts` + `draft-saved`。
3. **阶段 2（计划卡）**：`/api/chat/plan` + `CreationPlanCard` + use-chat-stream 路由分支。
4. **阶段 3（结果卡 + 改稿 + 配图）**：`DraftResultCard` + 对话内改稿识别 + 配图开关接 AIGC。

（详细分步留给 writing-plans。）

---

## 14. 风险与权衡

- **抓榜延迟拖慢计划卡**：用骨架渲染 + 选题字段单独 loading 化解。
- **意图误判**（非写稿被判 content_creation 弹了计划卡）：计划卡可"取消"低成本退出；必要时给 `intentType` 加置信门槛。
- **`reviseDraft` 抽取回归**：迁移钉钉现有测试守护。
- **职责边界**：坚持 §2.2 非目标，避免计划卡膨胀成第二个 mission DAG（违背 [[voice-content-loop-design]] 的"7 步不塞进一个 DAG"红线精神）。

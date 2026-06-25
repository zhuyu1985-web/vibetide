# cowork 对话交互层增强（Phase 1）设计

> 状态：草案 · 待评审
> 日期：2026-06-25
> 范围：把 BRTV 原型里验证有效的几种对话交互模式，融入现有 `src/app/(dashboard)/cowork/` 真实系统。
> 关联：[2026-06-24 plan_card 设计](2026-06-24-pc-chat-content-creation-plan-card-design.md)、[2026-06-25 IM 意图路由](2026-06-25-im-intent-aware-routing-design.md)。

## 1. 背景与目标

BRTV 原型（`prototype-brtv/cowork.html`）的对话工作台里有几种交互被认为体验很好，希望落到真实 cowork：

1. **意图识别 chip** —— AI 回复顶部展示「意图识别 → 类型 → 派单某员工」。
2. **输入框语义建议** —— 输入框上方根据当前对话语境给一排快捷指令 chip。
3. **稿件卡内联快速编辑 + 深度编辑** —— 短稿先展示部分正文，卡上有「润色 / 改写 / 扩写」一键改稿；要深度编辑则在右侧打开完整文章编辑器（左右三栏布局）。
4. **多版本生成卡** —— 一张卡列出各端版本（平台 / 状态 / 预览）+ 一键生成。

**目标**：以上四件，全部**复用现有后端能力**，落在现有 cowork 的消息渲染体系里，遵守设计系统（用 `Button`/`GlassCard`/共享 tag，不裸 `<button>`），全中文。

**非目标（Phase 2 另立 spec）**：视频快速播放器 + 快速剪辑 + 深度剪辑左右界面 —— 现有系统无任何视频剪辑基建（时间轴 / 出入点 / 导出转码），是独立大工程，本期不做。原型里的「电视长版 / 听听FM 音频版」版本类型暂无后端 skill，本期多版本卡只覆盖现有的社媒多平台 + 多语种。

## 2. 现有可复用能力（已核实）

| 能力 | 位置 | 说明 |
|---|---|---|
| 消息 kind 体系 | `src/db/schema/conversations.ts:76`；渲染 `src/components/cowork/conversation-thread.tsx:251` `MessageBubble` | 现有 `text / mission_card / plan_card / draft_result`，按 kind 分支渲染，可扩展 |
| 意图识别 | `src/lib/agent/intent-recognition.ts`、`src/lib/cowork/intent-routing.ts` `recognizeIntentForOrg`；类型 `src/lib/agent/types.ts:202` `IntentResult` | 产出 `intentType / summary / confidence / steps[{employeeSlug, employeeName, skills, taskDescription}]` |
| 意图中文 label | `src/lib/agent/types.ts:214` `INTENT_TYPE_LABELS` | 8 种 intentType 中文名 |
| 员工视觉解析（单一真相源） | `src/components/shared/employee-visual.ts` `resolveEmployeeVisual(employeeId)` | **chip 头像/名/配色必须走它**，不要裸用 `EMPLOYEE_META[slug]`——工种实例 slug（director/reporter…）在 `EMPLOYEE_META` 查不到会空头像。底层数据 `EMPLOYEE_META`(`constants.ts:46`)/`CRAFT_META`(`:603`) 仅由该 resolver 内部消费 |
| 提交链路 | `src/app/actions/cowork-submit.ts:39`；DAL `src/lib/dal/cowork-conversations.ts` `appendMessage` | 现在 assistant 消息 `meta` 只写 `{intentSummary, confidence}`，未存完整 intent |
| 稿件卡 | `src/components/cowork/draft-result-card.tsx:30` | 已有 ≤200 字预览 + 「打开编辑器精修」`<Link href=/articles/[id]>` + 「说一句改一版」`reviseDraftInConversation` |
| AI 编辑接口 | `src/app/api/ai/edit/route.ts` | POST `{fullContent, selectedText?, instruction, mode}`，mode ∈ `polish/continue/rewrite/summarize/translate/extract`，**流式**纯文本返回 |
| 文章编辑器 | `src/app/(dashboard)/articles/[id]/article-detail-client.tsx:42`（三栏：左 AI助手/素材/AIGC、中 Tiptap、右 信息/渠道） | props 接**完整 `article: ArticleDetail` 对象** + org/annotations/…，server page 预取；用全局 Zustand `store.ts` |
| 保存 action | `src/app/actions/articles.ts:58` `updateArticle`、`:132` `saveAndSubmitArticle` | 可直接复用 |
| 多版本生成 | `src/app/actions/article-channel-variants.ts` `generateVariantAction({articleId, platform})`（**同步**，非 mission/inngest） | 调 `channelRewriteArticle` skill，写 `article_channel_variants`，返回 `ArticleChannelVariantItem{status}` |
| 多版本读取 | `src/lib/dal/article-channel-variants.ts` `listVariantsByArticle(articleId)` / `getVariant` | 平台枚举 `wechat_oa/weibo/douyin/xiaohongshu/zhihu/toutiao/kuaishou/bilibili`（`channel-rewrite.ts:25`） |
| 多语种 | `src/lib/agent/skills/cross-language-rewrite.ts` `crossLanguageRewriteArticles`（当前仅 en） | 本期多语种作为多版本卡的一类（可选纳入，见 §4.4） |

## 3. 四个功能详细设计

### 3.1 意图识别 chip

**用户看到**：assistant 消息（尤其 `mission_card` / `plan_card`）顶部一行 chip：`意图识别 → {INTENT_TYPE_LABELS[intentType]} → 派单 [员工头像]员工名`，hover 显示 summary / 置信度 / 技能。

**数据**：在 `cowork-submit.ts` 把完整 `IntentResult` 写进 assistant 消息 `meta.intent`（当前只写了 summary/confidence）。

**组件**：新增 `src/components/cowork/intent-chip.tsx`：
- 输入 `intent: IntentResult`。
- 渲染 intentType label（用现有 tag 样式）+ 第一个 step 的员工头像+名（多 step 时叠头像 + 「等 N 人」）。
- **员工头像/名/配色统一走 `resolveEmployeeVisual(step.employeeSlug)`（`src/components/shared/employee-visual.ts`），不要直接 `EMPLOYEE_META[slug]`**——`steps[].employeeSlug` 可能是工种实例 slug（director/reporter…），裸查 `EMPLOYEE_META` 会空头像（见 MEMORY「新 mission 已派工种实例」）。
- 置信度低（<0.5）时弱化展示或加「待确认」。

**接入**：`MessageBubble`（`conversation-thread.tsx:251`）在 assistant 分支顶部，若 `message.meta?.intent` 存在则渲染 `<IntentChip>`。**无新表**（只多写 meta）。向后兼容：旧消息无 `meta.intent` → 不渲染。

### 3.2 输入框语义建议 chips

**用户看到**：输入框（`conversation-thread.tsx:174`）上方一排横向可滚动快捷指令 chip；点击 = 填入输入框（可再编辑）或直接发送（默认填入，二次确认发送，避免误触）。

**逻辑（Phase 1 纯前端规则，零延迟、无 LLM）**：新增纯函数 `src/lib/cowork/input-suggestions.ts`：
```
suggestInputs(ctx: {
  messageCount: number;
  lastAssistantKind?: MessageKind;        // text/mission_card/plan_card/draft_result/multi_version_card
  hasRunningMission: boolean;
  hasDraft: boolean;                       // 会话里出现过 draft_result
}): { label: string; fill: string }[]
```
规则示例：
- 会话空 → 「监测今日热点」「立项做快讯+成片」「写一篇深度稿」。
- 有 draft → 「多版本一键分产」「改得更口语化」「送审」「补充背景数据」。
- mission 执行中 → 「看执行进度」「补充素材」。
- 默认兜底 → 通用 3 条。

**组件**：`src/components/cowork/input-suggestions.tsx`（渲染 chip 行）。**纯 UI、无持久化、无后端**。可扩展点：未来可接轻 LLM 生成更贴语境的建议（本期不做，函数签名留好）。

### 3.3 稿件卡：内联快速编辑 + 深度编辑

增强现有 `DraftResultCard`（`draft-result-card.tsx`），不新建 kind（继续用 `draft_result`）。

**内联快速编辑**：卡片正文预览下方加三个按钮「AI 润色 / AI 改写 / AI 扩写」：
- 复用 `/api/ai/edit`（流式），mode：润色=`polish`，改写=`rewrite`+instruction「整体改写更精炼」，扩写=`rewrite`+instruction「在保持事实前提下扩写、补背景与细节」。
- 新增 client hook `src/lib/cowork/use-card-ai-edit.ts`：封装对 `/api/ai/edit` 的流式 fetch（参考 `features/editor/ai-diff-preview.tsx:87` 读流写法），返回 `{editText(text, mode), streaming, partial}`，把流式增量回填到卡片预览（实时打字 + 完成后 ai-mark 高亮变更段）。
- 「采用」→ 直接 `updateArticle(articleId,{body})` 把改后的正文写回 article（内联编辑已拿到完整改后文本，无需再次 LLM）。
- **卡片显示同步**：`DraftResultCard` 预览来自消息 `meta.bodyPreview`（`draft-result-card.tsx:16`），与 article 正文不联动。采用后需让 server action 同时把该 assistant 消息的 `meta.bodyPreview` 更新为新预览（DAL 加一个 `updateMessageMeta` 或在 `updateArticle` 的 cowork 包装里一并写），否则刷新页面预览会回落旧文。卡内先做乐观更新即时反馈。
- 失败/中断：保留原文，提示「改写失败，请重试」。

**深度编辑**：「深度编辑」按钮 → 在 cowork 右侧打开**完整文章编辑器**（见 §5）。替换现有 `<Link href=/articles/[id]>` 跳整页的做法。

### 3.4 多版本生成卡

**用户看到**：用户说「出各端版本 / 多版本 / 分产」→ 一张 `multi_version_card`：列出目标平台（默认勾选 weibo / douyin / wechat_oa / xiaohongshu，可调）+ 每个版本状态（未生成 / 生成中 / 已就绪 / 失败）+ 就绪后可点开预览/进编辑器；顶部「一键生成」。

**调用链**（全部已存在，同步生成）：
- 触发：对每个选中 platform 调 `generateVariantAction({articleId, platform})`（前端逐个/并发发起）。**注意：该 action 内部 try/catch，skill 失败时不抛错，而是 upsert 一行 `status:"failed"` + `body:"channel_rewrite skill 失败：…"` 并正常返回 `ArticleChannelVariantItem`**——所以判失败看返回项 `status === "failed"`，不要依赖 Promise reject。
- 状态：发起后该平台标「生成中」，action 返回项即回填其 `status`；初次加载/复访用 `listVariantsByArticle(articleId)` 拉全量。
- 读取：`listVariantsByArticle` 返回 `ArticleChannelVariantItem[]`，卡片渲染 title/summary/status/hashtags。

**入口（已拍板）**：Phase 1 多版本卡**只由稿件卡上的「多版本」按钮触发**（拿当前 articleId 落一条 `multi_version_card` 消息）。「在对话里用自然语言（多版本/分产）触发」留 follow-up（需在 `cowork-submit.ts` 意图路由加识别分支）。

**多语种（已拍板：留 follow-up）**：本期只做**渠道社媒多平台**。`crossLanguageRewriteArticles` 是**批量数组**接口（`crossLanguageRewriteArticles({articles[],targetLanguage})`），形态与单篇 `generateVariantAction({articleId,platform})` 不一致，纳入本期会增加适配成本，故「英文版」作为后续单独 follow-up。

**组件**：`src/components/cowork/multi-version-card.tsx`；消息 `kind="multi_version_card"`，`meta` 存 `{articleId, platforms[]}`。

## 4. 数据模型变更（最小 —— 本期**无 DB schema 变更**）

- **`conversationMessages.kind` 是普通 `text("kind")` 列，不是 pgEnum**（`src/db/schema/conversations.ts:79`）。新增 `"multi_version_card"` **只改 TS union 类型**：`src/lib/dal/cowork-conversations.ts` 的 `AppendMessageInput.kind`（+ `MessageBubble` 的 kind 分支）。**不需要 `db:generate` / `db:migrate`**（列类型没变），也不涉及 `verify-schema-sync`。
- 意图 chip 仅写 `meta.intent`（jsonb，无 schema 变更）。
- 输入建议、稿件卡内联编辑：无数据变更。

## 5. 深度编辑器嵌入（最大/最高风险项）

**目标**：cowork 右侧以宽 Sheet/分栏打开 `ArticleDetailClient`（edit 模式），保留其三栏左右布局，「返回」关闭 Sheet 回对话。

**已知改造点（5 处）**：
1. **Store 隔离**：`articles/[id]/store.ts` 是全局 Zustand 单例 → cowork 内嵌会与（潜在的）整页编辑器状态冲突。方案：store 工厂化/加 `scopeId` 命名空间，或嵌入态用独立 provider 实例。
2. **数据加载**：`ArticleDetailClientProps` 有 **6 个必填 prop**（`page.tsx` 6 路 `Promise.all` 预取）：`article`（完整对象）、`organizationId`、`initialAnnotations`、`initialAIAnalysis`、`articleLanguage`、`externalPublications`。cowork 内只有 `articleId` → 需 wrapper（新增 `getArticleDetailBundle(articleId)` server action 复用这 6 路查询）+ loading/error。**多租户安全**：`getArticle(id)` 内部已 `getCurrentUserOrg()` + `eq(articles.organizationId, orgId)`（`src/lib/dal/articles.ts:150`），bundle 复用它即天然 org 隔离，嵌入不绕过权限。
3. **视口假设**：`article-detail-client.tsx:138` `h-[calc(100vh-64px)]` + 三栏百分比宽度写死 → 加 `embedded` prop 时改用 `h-full` + flex basis，相对父容器。
4. **导航反转**：`onExitEdit` 与左栏「打开编辑器」`<Link>` → embedded 时改走 `onClose` callback（关 Sheet），不跳路由。
5. **路由参数**：内部 `useSearchParams('?mode=edit')` → embedded 时由 prop 指定初始 viewMode。

**风险与兜底（评审重点）**：
- 若上述改造侵入过大/影响整页编辑器稳定性 → **降级**：保持整页编辑器不动，cowork 右侧 Sheet 内挂载一个**精简编辑容器**（复用 `ArticleEditor` 主体 + 必要 store 子集，不带左右栏全部 panel），仍是「右侧打开、可编辑、保存回写」。
- 最终兜底：「深度编辑」退化为新标签打开 `/articles/[id]`（最差体验，仅在前两者都不可行时）。
- 实施计划阶段会把「编辑器嵌入」单独拆成一个里程碑并设 checkpoint：先验证 store 隔离 + 嵌入渲染可行，再接 cowork。

## 6. 错误处理

- AI 编辑流式失败/中断：回滚到改写前文本，toast 提示，可重试。
- 多版本失败：`generateVariantAction` **不抛错**，返回项 `status:"failed"`、失败原因在返回项 `body` 字段（`"channel_rewrite skill 失败：…"`）。卡片据 `status` 标「失败」并提供单独重试，不要用 try/catch 判失败。
- 编辑器嵌入数据加载失败：Sheet 内 error 态 + 「在新页打开」兜底链接。
- 意图 meta 缺失：chip 不渲染（向后兼容旧消息）。

## 7. 测试策略

- **单测（Vitest）**：`input-suggestions.ts` 纯函数（各上下文分支）；`intent-chip` 的 intent→展示字段映射；`use-card-ai-edit` 的流解析（mock fetch stream）。
- **类型/构建**：`npx tsc --noEmit` + `npm run build` 必过。
- **手动走查**：意图 chip 显示、输入建议点击、稿件卡三键改稿（流式回填+采用回写+卡片预览同步）、深度编辑右侧打开+保存+返回、多版本一键生成+状态回填+失败重试。
- 本期**无 DB schema 变更**（kind 是 text 列），不涉及 migration / `verify-schema-sync`。

## 8. 组件/文件清单

**新增**：
- `src/components/cowork/intent-chip.tsx`
- `src/components/cowork/input-suggestions.tsx` + `src/lib/cowork/input-suggestions.ts`
- `src/lib/cowork/use-card-ai-edit.ts`
- `src/components/cowork/multi-version-card.tsx`
- `src/components/cowork/article-editor-sheet.tsx`（深度编辑右侧 Sheet 容器）+ `getArticleDetailBundle` 包装（DAL/action）

**改造**：
- `src/app/actions/cowork-submit.ts`（assistant 消息 `meta` 存完整 `intent`）
- `src/lib/dal/cowork-conversations.ts`（`AppendMessageInput.kind` TS union 加 `"multi_version_card"`——**仅 TS，schema 文件 `conversations.ts` 不动**，kind 是 text 列）
- `src/components/cowork/conversation-thread.tsx`（MessageBubble 接 IntentChip + multi_version_card 分支；输入区上方接 InputSuggestions）
- `src/components/cowork/draft-result-card.tsx`（三键内联编辑 + 深度编辑入口 + 「多版本」按钮落卡）
- `articles/[id]/store.ts`、`article-detail-client.tsx`、`features/editor/article-editor.tsx`（可嵌入改造，见 §5）

## 9. 风险与开放问题

1. **编辑器嵌入复杂度**（§5）—— 最大不确定性，已设三级兜底与 checkpoint。
2. ~~多版本两入口~~（已定）：Phase 1 只做稿件卡按钮触发，自然语言触发留 follow-up。
3. ~~多语种是否纳入本期~~（已定）：留 follow-up（批量接口形态与单篇生成不一致）。
4. **输入建议是否够"语境"** —— Phase 1 规则版可能偏模板化；保留 LLM 升级位。
5. **意图 chip 的"派单"语义** —— general_chat 无 steps 时不显示「派单」，只显示类型。

## 10. 分期内里程碑（供 writing-plans 细化）

- M1：意图 chip（meta 存 intent + IntentChip + 接入）—— 最小、独立、可先上。
- M2：输入语义建议（纯前端）。
- M3：稿件卡内联三键快速编辑（接 /api/ai/edit）。
- M4：多版本生成卡（复用 generateVariantAction + listVariantsByArticle）。
- M5：深度编辑器嵌入（最重，独立里程碑 + checkpoint + 兜底）。
